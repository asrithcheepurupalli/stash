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

// =====================================================================
// In-chat memory panel (Pro): surface relevant saved items as you type and
// inject the one you pick into the live composer. The hero feature.
// =====================================================================
(() => {
  const COMPOSER_SELECTORS = [
    '#prompt-textarea',
    'div.ProseMirror[contenteditable="true"]',
    'div[contenteditable="true"][translate="no"]',
    'rich-textarea .ql-editor[contenteditable="true"]',
    'div[contenteditable="true"]',
    'textarea',
  ];
  const SRC_COLOR = { chatgpt: '#10a37f', claude: '#d97757', gemini: '#4285f4', web: '#a8a299' };

  function composerEl() {
    for (const s of COMPOSER_SELECTORS) { const el = document.querySelector(s); if (el) return el; }
    return null;
  }
  function getDraft() {
    const el = composerEl();
    if (!el) return '';
    return (el.tagName === 'TEXTAREA' ? el.value : (el.innerText || el.textContent || '')).trim();
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function injectStyles() {
    if (document.getElementById('stash-mem-style')) return;
    const css = `
      #stash-mem-btn{position:fixed;right:20px;bottom:20px;z-index:2147483600;display:inline-flex;align-items:center;gap:7px;
        background:#0b0b0c;color:#f6f3ee;border:none;border-radius:999px;padding:9px 14px;font:600 13px/1 ui-sans-serif,system-ui,-apple-system,sans-serif;
        cursor:pointer;box-shadow:0 6px 22px rgba(11,11,12,.28);transition:transform .12s ease,opacity .12s ease}
      #stash-mem-btn:hover{transform:translateY(-1px)}
      #stash-mem-btn .dot{width:6px;height:6px;border-radius:50%;background:#c8102e;display:inline-block}
      #stash-mem-panel{position:fixed;right:20px;bottom:70px;z-index:2147483600;width:360px;max-width:calc(100vw - 40px);
        background:#f6f3ee;color:#0b0b0c;border:1px solid #ddd5c8;border-radius:18px;box-shadow:0 24px 60px rgba(11,11,12,.26);
        font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden;display:none}
      #stash-mem-panel.open{display:block}
      .stash-mem-head{padding:14px 16px 10px;border-bottom:1px solid #ddd5c8}
      .stash-mem-title{font:600 14px/1.2 inherit;display:flex;align-items:center;gap:7px;margin:0}
      .stash-mem-title .dot{width:6px;height:6px;border-radius:50%;background:#c8102e;display:inline-block}
      .stash-mem-sub{font-size:11px;color:#7c7770;margin-top:3px}
      .stash-mem-search{box-sizing:border-box;margin:10px 16px 0;width:calc(100% - 32px);padding:9px 12px;border:1px solid #ddd5c8;border-radius:10px;
        background:#fbfaf6;font:13px ui-sans-serif,system-ui,sans-serif;color:#0b0b0c;outline:none}
      .stash-mem-list{max-height:340px;overflow-y:auto;padding:8px}
      .stash-mem-item{width:100%;text-align:left;background:#fbfaf6;border:1px solid #ddd5c8;border-radius:12px;padding:11px 12px;margin:6px 0;cursor:pointer;
        transition:border-color .12s ease;display:block;font-family:inherit}
      .stash-mem-item:hover{border-color:#0b0b0c}
      .stash-mem-it-top{display:flex;align-items:center;gap:7px;margin-bottom:4px}
      .stash-mem-it-dot{width:7px;height:7px;border-radius:50%;flex:0 0 7px}
      .stash-mem-it-title{font:600 13px/1.25 inherit;color:#0b0b0c;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .stash-mem-it-pct{font-size:11px;color:#a8a299}
      .stash-mem-it-snip{font-size:12px;line-height:1.4;color:#5c574f;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .stash-mem-msg{padding:22px 18px;text-align:center;font-size:13px;color:#7c7770}
      .stash-mem-foot{padding:8px 16px 12px;font-size:11px;color:#a8a299;border-top:1px solid #ddd5c8}
    `;
    const st = document.createElement('style');
    st.id = 'stash-mem-style'; st.textContent = css;
    document.documentElement.appendChild(st);
  }

  let panel, listEl, searchEl, btn, debounce;

  function build() {
    injectStyles();
    btn = document.createElement('button');
    btn.id = 'stash-mem-btn';
    btn.innerHTML = '<span class="dot"></span> Stash';
    btn.addEventListener('click', toggle);

    panel = document.createElement('div');
    panel.id = 'stash-mem-panel';
    panel.innerHTML = `
      <div class="stash-mem-head">
        <div class="stash-mem-title"><span class="dot"></span> Pull from your memory</div>
        <div class="stash-mem-sub">Relevant saved chats and pages, on your device.</div>
      </div>
      <input class="stash-mem-search" type="text" placeholder="What is this about?">
      <div class="stash-mem-list"></div>
      <div class="stash-mem-foot">Click one to drop it into your prompt as context.</div>`;
    listEl = panel.querySelector('.stash-mem-list');
    searchEl = panel.querySelector('.stash-mem-search');
    searchEl.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => run(searchEl.value), 350); });
    document.body.appendChild(btn);
    document.body.appendChild(panel);
    document.addEventListener('click', (e) => {
      if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close();
    });
  }

  function close() { panel.classList.remove('open'); }
  function toggle() {
    if (panel.classList.contains('open')) { close(); return; }
    chrome.storage.local.get({ pro_active: false }, (r) => {
      panel.classList.add('open');
      if (!r.pro_active) {
        listEl.innerHTML = '<div class="stash-mem-msg">Memory in your chats is a Stash Pro feature. Turn it on in the dashboard to use it.</div>';
        searchEl.style.display = 'none';
        return;
      }
      searchEl.style.display = '';
      searchEl.value = getDraft().slice(0, 200);
      searchEl.focus();
      run(searchEl.value);
    });
  }

  function run(query) {
    if (!query || !query.trim()) { listEl.innerHTML = '<div class="stash-mem-msg">Start your prompt, or type what you are working on, and your related memories show up here.</div>'; return; }
    listEl.innerHTML = '<div class="stash-mem-msg">Searching your memory...</div>';
    chrome.runtime.sendMessage({ target: 'background', type: 'SUGGEST', query }, (res) => {
      if (chrome.runtime.lastError || !res || res.error) { listEl.innerHTML = '<div class="stash-mem-msg">Could not reach your memory. The model may still be loading, try again in a moment.</div>'; return; }
      renderResults(res.results || []);
    });
  }

  function renderResults(results) {
    if (!results.length) { listEl.innerHTML = '<div class="stash-mem-msg">Nothing relevant saved yet. Keep stashing and this gets useful fast.</div>'; return; }
    listEl.innerHTML = '';
    results.forEach((r) => {
      const pct = Math.min(99, Math.max(0, Math.round(r.score * 100)));
      const item = document.createElement('button');
      item.className = 'stash-mem-item';
      item.innerHTML = `
        <div class="stash-mem-it-top">
          <span class="stash-mem-it-dot" style="background:${SRC_COLOR[r.source] || '#a8a299'}"></span>
          <span class="stash-mem-it-title">${esc(r.title)}</span>
          <span class="stash-mem-it-pct">${pct}%</span>
        </div>
        <div class="stash-mem-it-snip">${esc(r.snippet || '')}</div>`;
      item.addEventListener('click', () => insert(r));
      listEl.appendChild(item);
    });
  }

  function insert(r) {
    const text = `\n\nContext from my Stash ("${r.title}"):\n${r.snippet || ''}\n`;
    window.postMessage({ __stash: 'inject', text }, '*');
    close();
  }

  if (document.body) build();
  else window.addEventListener('DOMContentLoaded', build);
})();
