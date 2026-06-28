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

  // The Stash mark: a small stack of saved cards with the brand-red marker.
  // Mirrors the product icon, so the pill reads as "memory", not a generic dot.
  const markSvg = (s) => `<svg class="stash-mark" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect class="s-back" x="8" y="3.5" width="12" height="15" rx="3" fill="#0b0b0c" opacity="0.3"/>
      <rect class="s-front" x="4" y="6" width="13" height="15" rx="3" fill="#0b0b0c"/>
      <circle cx="8" cy="11.5" r="2" fill="#c8102e"/></svg>`;

  function setCount(n) {
    if (!btn) return;
    const c = btn.querySelector('.s-count');
    if (c) c.textContent = n > 999 ? '999+' : String(n);
    btn.classList.toggle('s-empty', !n);
  }
  function refreshCount() { chrome.storage.local.get({ stashs: [] }, (r) => setCount((r.stashs || []).length)); }

  function injectStyles() {
    if (document.getElementById('stash-mem-style')) return;
    const css = `
      /* Stash = LIGHT pill (Airlock is the dark one): same family, clearly distinct. */
      #stash-mem-btn{position:fixed;right:20px;bottom:20px;z-index:2147483600;display:inline-flex;align-items:center;gap:8px;
        background:#f6f3ee;color:#0b0b0c;border:1px solid #e4decf;border-radius:999px;padding:8px 13px 8px 11px;
        font:600 13px/1 ui-sans-serif,system-ui,-apple-system,sans-serif;cursor:pointer;
        box-shadow:0 4px 16px rgba(11,11,12,.14),0 1px 3px rgba(11,11,12,.10);
        transition:transform .16s cubic-bezier(.2,.7,.2,1),box-shadow .16s ease,border-color .16s ease;
        animation:stash-pill-in .42s cubic-bezier(.2,.8,.2,1) both}
      #stash-mem-btn:hover{transform:translateY(-2px);border-color:#d9d1c0;box-shadow:0 12px 28px rgba(11,11,12,.20),0 2px 6px rgba(11,11,12,.12)}
      #stash-mem-btn:active{transform:translateY(0) scale(.97)}
      #stash-mem-btn .stash-mark{display:block;flex:0 0 auto}
      #stash-mem-btn .stash-mark .s-front{transition:transform .2s cubic-bezier(.2,.7,.2,1)}
      #stash-mem-btn .stash-mark .s-back{transition:transform .2s cubic-bezier(.2,.7,.2,1)}
      #stash-mem-btn:hover .stash-mark .s-front{transform:translateY(-1.6px)}
      #stash-mem-btn:hover .stash-mark .s-back{transform:translate(1.2px,1px)}
      #stash-mem-btn .s-label{letter-spacing:-.01em}
      #stash-mem-btn .s-div{width:1px;height:13px;background:#ddd5c8}
      #stash-mem-btn .s-count{font-size:12px;color:#7c7770;font-weight:700;min-width:7px;text-align:center;font-variant-numeric:tabular-nums}
      #stash-mem-btn.s-empty .s-div,#stash-mem-btn.s-empty .s-count{display:none}
      @keyframes stash-pill-in{from{opacity:0;transform:translateY(12px) scale(.9)}to{opacity:1;transform:none}}

      #stash-mem-panel{position:fixed;right:20px;bottom:70px;z-index:2147483600;width:362px;max-width:calc(100vw - 40px);
        background:#f6f3ee;color:#0b0b0c;border:1px solid #ddd5c8;border-radius:18px;box-shadow:0 24px 64px rgba(11,11,12,.28);
        font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden;display:none;transform-origin:bottom right}
      #stash-mem-panel.open{display:block;animation:stash-panel-in .26s cubic-bezier(.2,.8,.2,1)}
      @keyframes stash-panel-in{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}
      .stash-mem-head{padding:14px 16px 11px;border-bottom:1px solid #ddd5c8;display:flex;align-items:flex-start;gap:9px}
      .stash-mem-head .stash-mark{margin-top:1px;flex:0 0 auto}
      .stash-mem-title{font:600 14px/1.2 inherit;margin:0}
      .stash-mem-sub{font-size:11px;color:#7c7770;margin-top:3px}
      .stash-save-row{padding:12px 16px 4px}
      .stash-save-btn{width:100%;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;
        background:#0b0b0c;color:#f6f3ee;border:none;border-radius:11px;padding:11px 14px;font:600 13px/1 ui-sans-serif,system-ui,-apple-system,sans-serif;
        cursor:pointer;transition:transform .12s ease,background .18s ease,opacity .15s ease}
      .stash-save-btn:hover{transform:translateY(-1px);opacity:.93}
      .stash-save-btn:active{transform:translateY(0) scale(.99)}
      .stash-save-btn.saved{background:#c8102e}
      .stash-save-btn.saved::before{content:"";width:13px;height:13px;flex:0 0 13px;background:#f6f3ee;
        -webkit-mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'/></svg>") center/contain no-repeat;
        mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'/></svg>") center/contain no-repeat}
      .stash-recall-label{padding:14px 16px 0;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#a8a299;
        border-top:1px solid #ece6da;margin-top:10px}
      .stash-mem-search{box-sizing:border-box;margin:9px 16px 0;width:calc(100% - 32px);padding:9px 12px;border:1px solid #ddd5c8;border-radius:10px;
        background:#fbfaf6;font:13px ui-sans-serif,system-ui,sans-serif;color:#0b0b0c;outline:none;transition:border-color .15s ease,box-shadow .15s ease}
      .stash-mem-search:focus{border-color:#0b0b0c;box-shadow:0 0 0 3px rgba(11,11,12,.05)}
      .stash-mem-list{max-height:344px;overflow-y:auto;padding:8px}
      .stash-mem-item{width:100%;text-align:left;background:#fbfaf6;border:1px solid #ddd5c8;border-radius:12px;padding:11px 12px;margin:6px 0;cursor:pointer;
        transition:border-color .14s ease,transform .1s ease,box-shadow .14s ease;display:block;font-family:inherit;
        animation:stash-item-in .32s cubic-bezier(.2,.8,.2,1) both}
      .stash-mem-item:hover{border-color:#0b0b0c;transform:translateY(-1px);box-shadow:0 6px 16px rgba(11,11,12,.08)}
      .stash-mem-item:active{transform:translateY(0) scale(.99)}
      @keyframes stash-item-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
      .stash-mem-it-top{display:flex;align-items:center;gap:7px;margin-bottom:4px}
      .stash-mem-it-dot{width:7px;height:7px;border-radius:50%;flex:0 0 7px}
      .stash-mem-it-title{font:600 13px/1.25 inherit;color:#0b0b0c;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .stash-mem-it-pct{font-size:10px;font-weight:700;color:#c8102e;background:rgba(200,16,46,.10);padding:2px 6px;border-radius:999px;flex:0 0 auto;font-variant-numeric:tabular-nums}
      .stash-mem-it-snip{font-size:12px;line-height:1.45;color:#5c574f;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .stash-mem-it-ins{margin-top:8px;font-size:11px;font-weight:600;color:#7c7770;display:flex;align-items:center;gap:5px;opacity:0;transition:opacity .14s ease}
      .stash-mem-item:hover .stash-mem-it-ins{opacity:1}
      .stash-mem-msg{padding:22px 18px;text-align:center;font-size:13px;color:#7c7770;line-height:1.5}
      .stash-dots{display:inline-flex;gap:4px;vertical-align:middle;margin-right:7px}
      .stash-dots i{width:5px;height:5px;border-radius:50%;background:#c8102e;display:inline-block;animation:stash-bounce 1s infinite ease-in-out}
      .stash-dots i:nth-child(2){animation-delay:.16s}.stash-dots i:nth-child(3){animation-delay:.32s}
      @keyframes stash-bounce{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}
      .stash-mem-foot{padding:9px 16px 12px;font-size:11px;color:#a8a299;border-top:1px solid #ddd5c8}
      @media (prefers-reduced-motion: reduce){#stash-mem-btn,#stash-mem-panel.open,.stash-mem-item{animation:none}}
    `;
    const st = document.createElement('style');
    st.id = 'stash-mem-style'; st.textContent = css;
    document.documentElement.appendChild(st);
  }

  let panel, listEl, searchEl, btn, saveBtn, debounce;

  // Same dedup identity as the popup: re-saving a chat updates one entry.
  const entrySig = (it) => (it.url
    ? `${it.type || 'chat'}|${it.url}`
    : `${it.type || 'chat'}|${(it.title || '').trim().toLowerCase()}|${(it.data && it.data[0] && it.data[0].content || '').slice(0, 120)}`);

  function flashSave(text, ok) {
    if (!saveBtn) return;
    saveBtn.textContent = text;
    saveBtn.classList.toggle('saved', !!ok);
    clearTimeout(saveBtn._t);
    saveBtn._t = setTimeout(() => { saveBtn.classList.remove('saved'); setSaveLabel(); }, 2200);
  }

  // Label reflects whether this exact conversation is already in the stash.
  function setSaveLabel() {
    if (!saveBtn) return;
    const url = location.href;
    chrome.storage.local.get({ stashs: [] }, (r) => {
      const exists = (r.stashs || []).some((it) => it.url === url);
      if (!saveBtn.classList.contains('saved')) saveBtn.textContent = exists ? 'Update this conversation' : 'Save this conversation';
    });
  }

  // The pill saves the live chat itself, so you never have to open the popup.
  function saveCurrentChat() {
    const source = siteSource();
    const data = extractChat(source);
    if (!data || !data.length) { flashSave('Nothing to save here yet', false); return; }
    let title = cleanTitle(document.title);
    if (!title || /^(chatgpt|claude|gemini)$/i.test(title)) title = (data.find((m) => m.role === 'user')?.content || 'Conversation').slice(0, 80);
    const partial = { type: 'chat', source, title, url: location.href, data };
    chrome.storage.local.get({ stashs: [], embeddings: {} }, (res) => {
      const stashs = res.stashs || [];
      const embeddings = res.embeddings || {};
      const sig = entrySig(partial);
      const idx = stashs.findIndex((it) => entrySig(it) === sig);
      let updated, isUpdate = false;
      if (idx !== -1) {
        isUpdate = true;
        const old = stashs[idx];
        const changed = JSON.stringify(old.data) !== JSON.stringify(partial.data);
        const merged = { ...old, title: partial.title || old.title, url: partial.url || old.url, source: partial.source || old.source, type: 'chat', data: partial.data, timestamp: new Date().toISOString(), tags: old.tags || [], highlights: old.highlights || [] };
        if (changed) { delete embeddings[old.id]; delete merged.summary; }
        updated = [merged, ...stashs.filter((_, i) => i !== idx)];
      } else {
        const entry = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), timestamp: new Date().toISOString(), ...partial };
        updated = [entry, ...stashs];
      }
      chrome.storage.local.set({ stashs: updated, embeddings }, () => {
        flashSave(isUpdate ? 'Updated' : 'Saved', true);
        refreshCount();
      });
    });
  }

  function build() {
    injectStyles();
    btn = document.createElement('button');
    btn.id = 'stash-mem-btn';
    btn.innerHTML = `${markSvg(18)}<span class="s-label">Stash</span><span class="s-div"></span><span class="s-count">0</span>`;
    btn.addEventListener('click', toggle);

    panel = document.createElement('div');
    panel.id = 'stash-mem-panel';
    panel.innerHTML = `
      <div class="stash-mem-head">
        ${markSvg(22)}
        <div>
          <div class="stash-mem-title">Stash this conversation</div>
          <div class="stash-mem-sub">Save it here, or pull from what you have saved.</div>
        </div>
      </div>
      <div class="stash-save-row">
        <button id="stash-save-btn" class="stash-save-btn">Save this conversation</button>
      </div>
      <div class="stash-recall-label">Pull from your memory</div>
      <input class="stash-mem-search" type="text" placeholder="What is this about?">
      <div class="stash-mem-list"></div>
      <div class="stash-mem-foot">Click one to drop it into your prompt as context.</div>`;
    listEl = panel.querySelector('.stash-mem-list');
    searchEl = panel.querySelector('.stash-mem-search');
    saveBtn = panel.querySelector('#stash-save-btn');
    saveBtn.addEventListener('click', () => saveCurrentChat());
    searchEl.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => run(searchEl.value), 350); });
    document.body.appendChild(btn);
    document.body.appendChild(panel);
    refreshCount();
    document.addEventListener('click', (e) => {
      if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close();
    });
    // Coexist with the Airlock pill (a sibling made. extension at bottom:22 right:22):
    // stack Stash above it when present. Airlock may load late, so re-check a while.
    adjustForAirlock();
    let checks = 0;
    const t = setInterval(() => { adjustForAirlock(); if (++checks > 12) clearInterval(t); }, 1500);
  }

  function adjustForAirlock() {
    if (!btn || !panel) return;
    const raised = !!document.getElementById('airlock-pill');
    btn.style.bottom = raised ? '78px' : '20px';
    panel.style.bottom = raised ? '128px' : '70px';
  }

  function close() { panel.classList.remove('open'); }
  function toggle() {
    if (panel.classList.contains('open')) { close(); return; }
    adjustForAirlock();
    refreshCount();
    setSaveLabel();
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
    listEl.innerHTML = '<div class="stash-mem-msg"><span class="stash-dots"><i></i><i></i><i></i></span>Searching your memory</div>';
    chrome.runtime.sendMessage({ target: 'background', type: 'SUGGEST', query }, (res) => {
      if (chrome.runtime.lastError) console.warn('[stash] suggest channel error:', chrome.runtime.lastError.message);
      if (res && res.error) console.warn('[stash] suggest error:', res.error);
      if (chrome.runtime.lastError || !res || res.error) { listEl.innerHTML = '<div class="stash-mem-msg">Could not reach your memory. The model may still be loading, try again in a moment.</div>'; return; }
      renderResults(res.results || []);
    });
  }

  function renderResults(results) {
    if (!results.length) { listEl.innerHTML = '<div class="stash-mem-msg">Nothing relevant saved yet. Keep stashing and this gets useful fast.</div>'; return; }
    listEl.innerHTML = '';
    results.forEach((r, i) => {
      const pct = Math.min(99, Math.max(0, Math.round(r.score * 100)));
      const item = document.createElement('button');
      item.className = 'stash-mem-item';
      item.style.animationDelay = `${i * 45}ms`;
      item.innerHTML = `
        <div class="stash-mem-it-top">
          <span class="stash-mem-it-dot" style="background:${SRC_COLOR[r.source] || '#a8a299'}"></span>
          <span class="stash-mem-it-title">${esc(r.title)}</span>
          <span class="stash-mem-it-pct">${pct}%</span>
        </div>
        <div class="stash-mem-it-snip">${esc(r.snippet || '')}</div>
        <div class="stash-mem-it-ins">Insert as context &rarr;</div>`;
      item.addEventListener('click', () => insert(r));
      listEl.appendChild(item);
    });
  }

  const SRC_LABEL = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', web: 'web page' };
  const INJECT_CAP = 8000; // inject the real memory, capped so it never floods the composer

  // Reconstruct the full memory (not just the preview snippet) so the model has
  // something it can actually use. Pulled fresh from storage by id at click time.
  function buildContext(item, r) {
    const title = (item && item.title) || r.title || 'Saved memory';
    const src = (item && item.source) || r.source;
    let body = '';
    if (item && Array.isArray(item.data) && item.data.length) {
      body = item.data.map((m) => {
        const c = (m.content || '').trim();
        if (!c) return '';
        const who = m.role === 'user' ? 'Me' : m.role === 'assistant' ? 'AI' : '';
        return who ? `${who}: ${c}` : c;
      }).filter(Boolean).join('\n\n');
    } else if (item && item.summary) {
      body = item.summary;
    } else {
      body = r.snippet || '';
    }
    body = body.replace(/\n{3,}/g, '\n\n').trim();
    let tail = '';
    if (body.length > INJECT_CAP) { body = body.slice(0, INJECT_CAP).trim(); tail = '\n[... rest of this memory truncated]'; }
    const where = src && SRC_LABEL[src] ? ` (from ${SRC_LABEL[src]})` : '';
    return `\n\nContext from my Stash — "${title}"${where}:\n\n${body}${tail}\n`;
  }

  function insert(r) {
    chrome.storage.local.get({ stashs: [] }, (res) => {
      const item = (res.stashs || []).find((s) => s.id === r.id);
      window.postMessage({ __stash: 'inject', text: buildContext(item, r) }, '*');
      close();
    });
  }

  if (document.body) build();
  else window.addEventListener('DOMContentLoaded', build);
})();
