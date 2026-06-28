/**
 * Stash content script. Runs on the supported chat sites (ChatGPT, Claude,
 * Gemini). Extracts the current conversation on request, and injects saved
 * context back into the composer when resuming a thread.
 *
 * Page capture for arbitrary sites does NOT happen here; the popup uses
 * chrome.scripting on the active tab for that.
 */

function siteSource() {
  const h = location.hostname;
  if (h.includes('claude')) return 'claude';
  if (h.includes('gemini')) return 'gemini';
  return 'chatgpt'; // chatgpt.com / chat.openai.com
}

function cleanTitle(raw) {
  return (raw || '')
    .replace(/\s*[|\\/\-–—]\s*(ChatGPT|Claude|Gemini|Google Gemini).*$/i, '')
    .trim();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_CHAT') {
    const source = siteSource();
    const data = extractChat(source);
    let title = cleanTitle(document.title);
    if (!title || /^(chatgpt|claude|gemini)$/i.test(title)) {
      title = (data.find((m) => m.role === 'user')?.content || 'Conversation').slice(0, 80);
    }
    sendResponse({ data, url: location.href, title, source, type: 'chat' });
  }
  return true;
});

// Clean a message node into readable text: drop interactive cruft (Copy/Edit
// buttons, icons, screen-reader-only labels) that otherwise scrape as stray
// words, and normalise whitespace while keeping code-block line breaks.
function cleanText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('button, [role="button"], svg, .sr-only, [aria-hidden="true"]').forEach((n) => n.remove());
  return (clone.innerText || clone.textContent || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pushMsg(arr, role, el) {
  const content = cleanText(el);
  if (content) arr.push({ role, content });
}

function extractChat(source) {
  try {
    if (source === 'claude') return extractClaude();
    if (source === 'gemini') return extractGemini();
    return extractChatGPT();
  } catch (_e) {
    return [];
  }
}

function extractChatGPT() {
  const out = [];
  document.querySelectorAll('[data-message-author-role]').forEach((el) => {
    const role = el.getAttribute('data-message-author-role') === 'user' ? 'user' : 'assistant';
    pushMsg(out, role, el);
  });
  return out;
}

function extractClaude() {
  const out = [];
  // user bubbles + assistant bubbles, in document order
  document.querySelectorAll('[data-testid="user-message"], .font-claude-message').forEach((el) => {
    const isUser = el.matches('[data-testid="user-message"]') || !!el.closest('[data-testid="user-message"]');
    pushMsg(out, isUser ? 'user' : 'assistant', el);
  });
  return out;
}

function extractGemini() {
  const out = [];
  document.querySelectorAll('user-query, model-response').forEach((el) => {
    const isUser = el.tagName.toLowerCase() === 'user-query';
    pushMsg(out, isUser ? 'user' : 'assistant', el);
  });
  return out;
}

// ----- Resume: inject saved context into the composer on load -----
chrome.storage.local.get(['pending_resume_context'], (result) => {
  if (!result.pending_resume_context) return;
  const context = result.pending_resume_context;

  const selectors = [
    '#prompt-textarea', // ChatGPT
    'div[contenteditable="true"][translate="no"]', // Claude
    'rich-textarea .ql-editor[contenteditable="true"]', // Gemini
    'div.ProseMirror[contenteditable="true"]',
    'div[contenteditable="true"]',
    'textarea',
  ];
  const findBox = () => {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  };

  const inject = () => {
    const box = findBox();
    if (!box) return false;
    if (box.tagName === 'TEXTAREA') {
      box.value = context;
    } else {
      const p = box.querySelector('p') || box;
      p.innerText = context;
    }
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new Event('change', { bubbles: true }));
    chrome.storage.local.remove(['pending_resume_context']);
    return true;
  };

  if (!inject()) {
    const obs = new MutationObserver((m, o) => {
      if (inject()) o.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 10000);
  }
});
