/**
 * Stash background service worker.
 *
 * The in-page memory panel (content.js) cannot run the embedding model inside a
 * host page like chatgpt.com (host CSP + we do not want to pollute the page), so
 * the model lives in an offscreen document. This worker owns that offscreen doc
 * and relays semantic-search requests to it.
 *
 * Flow: content.js -> {target:'background'} -> ensureOffscreen() ->
 *       {target:'offscreen'} -> offscreen.js (model) -> back to content.js
 */

let creating = null;

async function ensureOffscreen() {
  if (chrome.offscreen.hasDocument) {
    const has = await chrome.offscreen.hasDocument();
    if (has) return;
  }
  if (creating) { await creating; return; }
  try {
    creating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Run the on-device search model to find relevant saved memories.',
    });
    await creating;
  } catch (e) {
    // A racing create or "single offscreen document" error: treat as ready.
    if (!String(e).includes('Only a single offscreen')) console.warn('[stash] offscreen create', e);
  } finally {
    creating = null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The offscreen page registers its listener after its module loads, so the very
// first message can race it ("no receiving end"). Retry until it answers.
async function askOffscreen(payload, tries = 12) {
  let lastErr = 'offscreen not responding';
  for (let i = 0; i < tries; i++) {
    try {
      const res = await chrome.runtime.sendMessage(payload);
      if (res !== undefined) return res;
    } catch (e) {
      lastErr = String(e && e.message || e);
    }
    await sleep(250);
  }
  throw new Error(lastErr);
}

// Offscreen documents can only use chrome.runtime (no chrome.storage), so the
// worker owns storage: it reads stashs + the cached index here and passes them
// to the offscreen, then persists any embeddings the offscreen newly computed.
function getStash() {
  return new Promise((resolve) => chrome.storage.local.get({ stashs: [], embeddings: {} }, resolve));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'background') return; // not ours
  if (msg.type === 'SUGGEST') {
    (async () => {
      try {
        const { stashs, embeddings } = await getStash();
        if (!stashs.length) { sendResponse({ results: [] }); return; }
        await ensureOffscreen();
        const res = await askOffscreen({ target: 'offscreen', type: 'SUGGEST', query: msg.query, stashs, embeddings });
        if (res && res.embeddings) chrome.storage.local.set({ embeddings: res.embeddings }); // persist newly built index
        sendResponse(res ? { results: res.results || [] } : { results: [] });
      } catch (e) {
        sendResponse({ error: String(e && e.message || e) });
      }
    })();
    return true; // async response
  }
});
