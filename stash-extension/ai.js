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

export async function search(query, items, index, topK = 20) {
  const q = await embed(query);
  const qTerms = [...new Set(tokenize(query))];
  const scored = items
    .filter((it) => it.id && isChunked(index[it.id]))
    .map((it) => {
      let best = -1; // semantic: best-matching chunk (max-pool), not the average
      for (const v of index[it.id]) { const s = cosine(q, v); if (s > best) best = s; }
      let lex = 0; // light lexical boost so exact terms (names, code) are not missed
      if (qTerms.length) {
        const hay = itemText(it).toLowerCase();
        lex = qTerms.filter((t) => hay.includes(t)).length / qTerms.length;
      }
      return { item: it, score: best + 0.12 * lex, sem: best };
    })
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  const top = scored[0].score; // drop weak matches so "best matches" are actually good
  return scored.filter((r) => r.sem >= 0.18 && r.score >= top * 0.55).slice(0, topK);
}

// ---- extractive summary (TextRank over sentence embeddings) ------------------
function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 400);
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

// TextRank-lite: a sentence scores by how similar it is to all the others, so
// genuinely representative sentences win (better than "closest to the average").
function rankSentences(sentences, vecs, k) {
  const n = sentences.length;
  const score = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const sim = cosine(vecs[i], vecs[j]);
      if (sim > 0.2) score[i] += sim;
    }
  }
  const order = sentences.map((s, i) => i).sort((a, b) => score[b] - score[a]);
  const picked = [];
  for (const i of order) {
    if (picked.length >= k) break;
    if (picked.some((p) => cosine(vecs[i], vecs[p]) > 0.85)) continue; // skip near-dupes
    picked.push(i);
  }
  return picked.sort((a, b) => a - b); // reading order
}

export async function summarize(item) {
  const page = (item.type || 'chat') === 'page';
  // Chats: lead with the user's intent (the question), then the key answer
  // sentences. Pages: rank the page's own sentences.
  let lead = '';
  let bodyText;
  if (!page) {
    const firstUser = (item.data || []).find((m) => m.role === 'user');
    if (firstUser) lead = splitSentences(firstUser.content)[0] || clip(firstUser.content, 160);
    const answers = (item.data || []).filter((m) => m.role !== 'user').map((m) => m.content).join(' ');
    bodyText = answers || (item.data || []).map((m) => m.content).join(' ');
  } else {
    bodyText = (item.data || []).map((m) => m.content).join(' ');
  }
  let sentences = splitSentences(bodyText).slice(0, 40);
  if (sentences.length <= 2) {
    const fb = clip(bodyText, 360);
    return lead && !fb.startsWith(lead) ? `${lead} ${fb}`.slice(0, 600) : fb;
  }
  const vecs = await embedAll(sentences);
  const k = Math.min(3, Math.max(2, Math.round(sentences.length * 0.2)));
  const picked = rankSentences(sentences, vecs, k).map((i) => sentences[i]);
  const parts = [];
  if (lead) parts.push(lead.replace(/\s+/g, ' ').trim());
  picked.forEach((s) => { if (!parts.includes(s)) parts.push(s); });
  return parts.join(' ').slice(0, 600);
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
