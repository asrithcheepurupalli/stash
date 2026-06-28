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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'background') return; // not ours
  if (msg.type === 'SUGGEST') {
    (async () => {
      try {
        await ensureOffscreen();
        const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'SUGGEST', query: msg.query });
        sendResponse(res || { results: [] });
      } catch (e) {
        sendResponse({ error: String(e) });
      }
    })();
    return true; // async response
  }
});
