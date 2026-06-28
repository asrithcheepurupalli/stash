/**
 * Stash offscreen worker. Answers semantic-search requests for the in-chat
 * memory panel using the bundled embedding model. Reuses the same index
 * (storage key `embeddings`) the dashboard builds, so it is usually warm.
 *
 * Offscreen documents only get chrome.runtime (NO chrome.storage), so the
 * background worker reads storage and passes { stashs, embeddings } in the
 * message; we return any newly computed embeddings for the worker to persist.
 *
 * The model bundle (ai.bundle.js, ~1.2MB) is LOADED LAZILY on first use, NOT as
 * a static top-level import: a static import would delay registering the message
 * listener below until the whole bundle parsed, and the first request would hit
 * "no receiving end". Registering the listener first, importing on demand, fixes
 * that race.
 */

let aiMod = null;
function getAI() {
  if (!aiMod) aiMod = import('./ai.bundle.js');
  return aiMod;
}

function snippetOf(item) {
  if (item.summary) return String(item.summary).slice(0, 280);
  const body = (item.data || []).map((m) => m.content).join(' ').replace(/\s+/g, ' ').trim();
  return body.slice(0, 280);
}

async function suggest({ query, stashs, embeddings }) {
  if (!query || !query.trim() || !stashs || !stashs.length) return { results: [] };
  const { buildIndex, search } = await getAI();
  const { index, added } = await buildIndex(stashs, embeddings || {});
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
    embeddings: added ? index : undefined, // hand the new index back to the worker to save
  };
}

// Registered synchronously, before any heavy import, so we are always reachable.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen') return;
  if (msg.type === 'PING') { sendResponse({ ok: true }); return true; }
  if (msg.type === 'SUGGEST') {
    suggest(msg).then(sendResponse).catch((e) => sendResponse({ error: String(e && e.message || e) }));
    return true; // async
  }
});
