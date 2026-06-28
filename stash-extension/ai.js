/**
 * Stash on-device intelligence (Pro). Everything here runs locally in the
 * dashboard page using a bundled MiniLM embedding model via transformers.js.
 * No text ever leaves the machine.
 *
 * Loaded dynamically (import('./ai.js')) only when Pro is active, so Free users
 * never pay the ~22MB model cost.
 */

import { pipeline, env } from '@huggingface/transformers';

// Run fully offline from the packaged files; no network, no remote models.
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = chrome.runtime.getURL('models/');
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('vendor/');
env.backends.onnx.wasm.numThreads = 1; // extension pages have no SharedArrayBuffer
// The browser Cache API rejects chrome-extension:// URLs; the model is bundled
// so there is nothing to cache anyway. Disabling it removes a noisy warning.
env.useBrowserCache = false;

const MODEL = 'Xenova/all-MiniLM-L6-v2';
let _extractor = null;
let _loading = null;

export async function getExtractor(onProgress) {
  if (_extractor) return _extractor;
  if (!_loading) _loading = pipeline('feature-extraction', MODEL, { dtype: 'q8', device: 'wasm', progress_callback: onProgress });
  _extractor = await _loading;
  return _extractor;
}

const clip = (s, n = 1600) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

export async function embed(text) {
  const ex = await getExtractor();
  const out = await ex(clip(text), { pooling: 'mean', normalize: true });
  return Array.from(out.data);
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d;
}

// Text we read over for an item (title first, it carries the most signal).
export function itemText(item) {
  const body = (item.data || []).map((m) => m.content).join('\n');
  return `${item.title || ''}\n${body}`;
}

// Break an item into chunks so retrieval can match the RIGHT part of a long
// thread instead of a blurred average of the whole thing (the big quality win).
function chunksFor(item) {
  const out = [];
  const pushPiece = (txt) => {
    const t = String(txt || '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    if (t.length <= 520) { out.push(t); return; }
    const sents = t.split(/(?<=[.!?])\s+/);
    let buf = '';
    for (const s of sents) {
      if ((buf + ' ' + s).length > 480) { if (buf) out.push(buf.trim()); buf = s; }
      else buf = buf ? buf + ' ' + s : s;
    }
    if (buf) out.push(buf.trim());
  };
  if (item.title) out.push(String(item.title).trim());
  (item.data || []).forEach((m) => pushPiece(m.content));
  return out.slice(0, 12); // bound work on huge items
}

// Per-item chunk vectors, cached under storage key `embeddings`.
// Stored shape per id: array of vectors. Old single-vector entries (number[])
// are detected and rebuilt.
function isChunked(v) { return Array.isArray(v) && Array.isArray(v[0]); }

export async function buildIndex(items, existing, onProgress) {
  const index = { ...(existing || {}) };
  const missing = items.filter((it) => it.id && !isChunked(index[it.id]));
  for (let i = 0; i < missing.length; i++) {
    const it = missing[i];
    const vecs = [];
    for (const c of chunksFor(it)) vecs.push(await embed(c));
    index[it.id] = vecs.length ? vecs : [await embed(itemText(it))];
    if (onProgress) onProgress(i + 1, missing.length);
  }
  return { index, added: missing.length };
}

const tokenize = (s) => (String(s || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []);

// Trigram set for fuzzy matching, so a typo ("petiod") still scores against the
// real word ("period") instead of dropping to zero on an exact-substring miss.
const triset = (s) => {
  const p = `  ${s} `;
  const out = new Set();
  for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
  return out;
};

// Lexical score in [0,1]: full credit for an exact term, partial credit for the
// closest fuzzy token (trigram Dice), so misspelled queries still surface.
function lexScore(qTerms, it) {
  if (!qTerms.length) return 0;
  const hay = itemText(it).toLowerCase();
  let credit = 0;
  let tokSet = null;
  for (const t of qTerms) {
    if (hay.includes(t)) { credit += 1; continue; }
    if (!tokSet) tokSet = new Set(hay.match(/[a-z0-9]{3,}/g) || []);
    const tg = triset(t);
    let best = 0;
    for (const u of tokSet) {
      if (Math.abs(u.length - t.length) > 2) continue; // length gate keeps it cheap
      const ug = triset(u);
      let m = 0;
      for (const g of tg) if (ug.has(g)) m++;
      const sim = (2 * m) / (tg.size + ug.size);
      if (sim > best) { best = sim; if (best >= 0.9) break; }
    }
    if (best >= 0.55) credit += 0.6; // near-miss / typo: partial credit
  }
  return credit / qTerms.length;
}

export async function search(query, items, index, topK = 20) {
  const q = await embed(query);
  const qTerms = [...new Set(tokenize(query))];
  const scored = items
    .filter((it) => it.id && isChunked(index[it.id]))
    .map((it) => {
      let best = -1; // semantic: best-matching chunk (max-pool), not the average
      for (const v of index[it.id]) { const s = cosine(q, v); if (s > best) best = s; }
      const lex = lexScore(qTerms, it); // exact + fuzzy (typo-tolerant) term overlap
      return { item: it, score: best + 0.16 * lex, sem: best, lex };
    })
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  const top = scored[0].score; // drop weak matches so "best matches" are actually good
  // Keep semantically-close items, OR ones a strong fuzzy term match vouches for
  // (so a typo'd keyword query still returns its result even if the vector dips).
  return scored.filter((r) => (r.sem >= 0.16 || r.lex >= 0.5) && r.score >= top * 0.55).slice(0, topK);
}

// ---- extractive summary: clean -> TextRank relevance -> MMR selection --------
// This is the best an EXTRACTIVE summary gets without a heavy generative model:
// it still stitches your own sentences, but it strips noise, drops filler, and
// picks lines that are both important AND non-redundant.

// Drop code blocks and unwrap inline code/markdown so they do not pollute the summary.
function stripNoise(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 320);
}

// Tidy a sentence for reading: unwrap markdown, drop list/heading prefixes and
// conversational lead-ins ("Sure,", "Here's", "Basically,"), then recapitalise.
function cleanSentence(s) {
  let t = String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/, '').replace(/^\s*[-*]\s+/, '').replace(/^\s*\d+\.\s+/, '')
    .replace(/^(sure|certainly|of course|absolutely|great question|here(?:'s| is)|let me|i'd be happy|happy to help|no problem|got it|understood|basically|essentially|in short|in summary|to summarize)[,:]?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t;
}

function isBoilerplate(s) {
  if (s.length < 25) return true;
  if (/^(let me know|i hope (this|that) helps|hope (this|that) helps|feel free to|does (that|this) (help|make sense)|is there anything else|happy to help)\b/i.test(s)) return true;
  return (s.match(/[a-z]{2,}/gi) || []).length < 4; // mostly symbols / urls
}

async function embedAll(sentences) {
  const ex = await getExtractor();
  const vecs = [];
  for (const s of sentences) {
    const out = await ex(clip(s, 600), { pooling: 'mean', normalize: true });
    vecs.push(Array.from(out.data));
  }
  return vecs;
}

// TextRank-lite relevance, normalised to 0..1.
function textRankRel(vecs) {
  const n = vecs.length;
  const score = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const sim = cosine(vecs[i], vecs[j]);
      if (sim > 0.2) score[i] += sim;
    }
  }
  const max = Math.max(...score, 1e-6);
  return score.map((s) => s / max);
}

// Maximal Marginal Relevance: pick important sentences that are NOT redundant
// with what we already picked, so the summary covers more ground.
function mmrSelect(vecs, rel, k, lambda = 0.72) {
  const picked = [];
  const rem = vecs.map((_, i) => i);
  while (picked.length < k && rem.length) {
    let bestIdx = -1, bestScore = -Infinity;
    for (const i of rem) {
      let maxSim = 0;
      for (const p of picked) maxSim = Math.max(maxSim, cosine(vecs[i], vecs[p]));
      const sc = lambda * rel[i] - (1 - lambda) * maxSim;
      if (sc > bestScore) { bestScore = sc; bestIdx = i; }
    }
    picked.push(bestIdx);
    rem.splice(rem.indexOf(bestIdx), 1);
  }
  return picked.sort((a, b) => a - b); // reading order
}

export async function summarize(item) {
  const page = (item.type || 'chat') === 'page';
  let lead = '';
  let rawBody;
  if (!page) {
    const firstUser = (item.data || []).find((m) => m.role === 'user');
    if (firstUser) lead = cleanSentence(splitSentences(stripNoise(firstUser.content))[0] || clip(firstUser.content, 160));
    const answers = (item.data || []).filter((m) => m.role !== 'user').map((m) => m.content).join('\n');
    rawBody = answers || (item.data || []).map((m) => m.content).join('\n');
  } else {
    rawBody = (item.data || []).map((m) => m.content).join('\n');
  }

  let cands = splitSentences(stripNoise(rawBody)).map(cleanSentence).filter((s) => s && !isBoilerplate(s));
  const seen = new Set();
  cands = cands.filter((s) => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 40);

  if (cands.length <= 2) {
    const fb = cands.join(' ') || clip(stripNoise(rawBody), 360);
    return (lead && !fb.toLowerCase().startsWith(lead.slice(0, 20).toLowerCase())) ? `${lead} ${fb}`.slice(0, 600) : fb.slice(0, 600);
  }

  const vecs = await embedAll(cands);
  const rel = textRankRel(vecs);
  const k = Math.min(4, Math.max(2, Math.round(cands.length * 0.25)));
  const picked = mmrSelect(vecs, rel, k).map((i) => cands[i]);

  const parts = [];
  if (lead) parts.push(lead);
  picked.forEach((s) => { if (!parts.some((p) => p.toLowerCase() === s.toLowerCase())) parts.push(s); });
  return parts.join(' ').slice(0, 600);
}

// "Ask across everything": assemble a synthesized answer from the BEST passages
// across the top matching memories. Extractive (no text generation) and honest:
// every line is a real sentence from your own saved content, with its source. We
// embed the query + candidate sentences, keep the relevant ones, and MMR-pick a
// non-redundant set so the answer spans multiple memories instead of repeating.
export async function answer(query, items) {
  const top = (items || []).slice(0, 5);
  if (!top.length) return { passages: [], sources: [] };
  const q = await embed(query);
  const cands = []; // { text, item }
  for (const it of top) {
    const page = (it.type || 'chat') === 'page';
    const raw = page
      ? (it.data || []).map((m) => m.content).join('\n')
      : ((it.data || []).filter((m) => m.role !== 'user').map((m) => m.content).join('\n') || (it.data || []).map((m) => m.content).join('\n'));
    let sents = splitSentences(stripNoise(raw)).map(cleanSentence).filter((s) => s && !isBoilerplate(s));
    const seen = new Set();
    sents = sents.filter((s) => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 30);
    for (const s of sents) cands.push({ text: s, item: it });
  }
  if (!cands.length) return { passages: [], sources: top };

  const vecs = await embedAll(cands.map((c) => c.text));
  const rel = vecs.map((v) => cosine(q, v));
  // keep only sentences actually relevant to the question, best first
  let pool = rel.map((s, i) => [i, s]).filter(([, s]) => s >= 0.24).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([i]) => i);
  if (!pool.length) pool = rel.map((s, i) => [i, s]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([i]) => i);
  const picked = mmrSelect(pool.map((i) => vecs[i]), pool.map((i) => rel[i]), Math.min(6, pool.length), 0.7).map((j) => pool[j]);

  const passages = picked
    .map((i) => ({ text: cands[i].text, item: cands[i].item, score: rel[i] }))
    .sort((a, b) => b.score - a.score);
  // sources actually cited, in first-appearance order
  const sources = [];
  passages.forEach((p) => { if (!sources.includes(p.item)) sources.push(p.item); });
  return { passages, sources };
}

// ---- keyword tag suggestions (no model needed) -------------------------------
const STOP = new Set('the a an and or but if then this that these those is are was were be been being to of in on for with as by at from into about over after before your you we they it he she him her them our their its can could would should will just like get got make made use used using one two also not no yes do does did how what when where why who which while because so than too very more most some any all each other out up down off here there'.split(' '));
export function suggestTags(item, max = 4) {
  const text = itemText(item).toLowerCase();
  const counts = {};
  (text.match(/[a-z][a-z0-9-]{3,}/g) || []).forEach((w) => {
    if (STOP.has(w)) return;
    counts[w] = (counts[w] || 0) + 1;
  });
  return Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}
