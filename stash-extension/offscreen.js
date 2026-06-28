/**
 * Stash offscreen worker. Loads the bundled embedding model and answers
 * semantic-search requests for the in-chat memory panel. Reuses the same index
 * (storage key `embeddings`) the dashboard builds, so it is usually warm.
 */

import { buildIndex, search } from './ai.bundle.js';

function getData() {
  return new Promise((resolve) => chrome.storage.local.get({ stashs: [], embeddings: {} }, resolve));
}

function snippetOf(item) {
  if (item.summary) return String(item.summary).slice(0, 280);
  const body = (item.data || []).map((m) => m.content).join(' ').replace(/\s+/g, ' ').trim();
  return body.slice(0, 280);
}

async function suggest(query) {
  if (!query || !query.trim()) return { results: [] };
  const { stashs, embeddings } = await getData();
  if (!stashs.length) return { results: [] };
  const { index, added } = await buildIndex(stashs, embeddings);
  if (added) chrome.storage.local.set({ embeddings: index });
  const hits = await search(query, stashs, index, 5);
  return {
    results: hits.map((h) => ({
      id: h.item.id,
      title: h.item.title || (h.item.data[0]?.content || 'Untitled').slice(0, 70),
      source: h.item.source || 'chatgpt',
      type: h.item.type || 'chat',
      url: h.item.url,
      snippet: snippetOf(h.item),
      score: h.score,
    })),
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen') return;
  if (msg.type === 'SUGGEST') {
    suggest(msg.query).then(sendResponse).catch((e) => sendResponse({ error: String(e) }));
    return true; // async
  }
});
