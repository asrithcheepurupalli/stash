/**
 * Stash on-device intelligence (Pro). Everything here runs locally in the
 * dashboard page using a bundled MiniLM embedding model via transformers.js.
 * No text ever leaves the machine.
 *
 * Loaded dynamically (import('./ai.js')) only when Pro is active, so Free users
 * never pay the ~22MB model cost.
 */

import { pipeline, env } from './vendor/transformers.min.js';

// Run fully offline from the packaged files; no network, no remote models.
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = chrome.runtime.getURL('models/');
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('vendor/');
env.backends.onnx.wasm.numThreads = 1; // extension pages have no SharedArrayBuffer

const MODEL = 'Xenova/all-MiniLM-L6-v2';
let _extractor = null;
let _loading = null;

export async function getExtractor(onProgress) {
  if (_extractor) return _extractor;
  if (!_loading) _loading = pipeline('feature-extraction', MODEL, { dtype: 'q8', progress_callback: onProgress });
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

// Text we embed for an item: title carries the most signal, then the body.
export function itemText(item) {
  const body = (item.data || []).map((m) => m.content).join('\n');
  return `${item.title || ''}\n${body}`;
}

// Build / refresh the embedding index for items that lack a current vector.
// Vectors live under storage key `embeddings` keyed by item id, fully local.
export async function buildIndex(items, existing, onProgress) {
  const index = { ...(existing || {}) };
  const missing = items.filter((it) => it.id && !index[it.id]);
  for (let i = 0; i < missing.length; i++) {
    const it = missing[i];
    index[it.id] = await embed(itemText(it));
    if (onProgress) onProgress(i + 1, missing.length);
  }
  return { index, added: missing.length };
}

export async function search(query, items, index, topK = 20) {
  const q = await embed(query);
  return items
    .filter((it) => it.id && index[it.id])
    .map((it) => ({ item: it, score: cosine(q, index[it.id]) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ---- extractive summary (embedding-centrality) -------------------------------
function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

export async function summarize(item) {
  const text = (item.data || []).map((m) => m.content).join(' ');
  let sentences = splitSentences(text);
  if (sentences.length <= 2) return clip(text, 320);
  sentences = sentences.slice(0, 40); // cap work on long threads
  const ex = await getExtractor();
  const vecs = [];
  for (const s of sentences) {
    const out = await ex(clip(s, 1000), { pooling: 'mean', normalize: true });
    vecs.push(Array.from(out.data));
  }
  const centroid = new Array(vecs[0].length).fill(0);
  vecs.forEach((v) => v.forEach((x, i) => { centroid[i] += x / vecs.length; }));
  const ranked = sentences
    .map((s, i) => ({ s, i, score: cosine(vecs[i], centroid) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(3, Math.ceil(sentences.length * 0.25)))
    .sort((a, b) => a.i - b.i); // restore reading order
  return ranked.map((r) => r.s).join(' ').slice(0, 600);
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
