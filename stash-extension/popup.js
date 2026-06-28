/**
 * Stash popup. Saves the current AI conversation (ChatGPT, Claude, Gemini) or
 * the current web page to the on-device archive, and previews recent items.
 */

// Runs in the page's own context via chrome.scripting. Must be self-contained.
function extractPageContent() {
  const sel = window.getSelection && window.getSelection().toString();
  let text = '';
  if (sel && sel.trim().length > 40) {
    text = sel.trim(); // honour an explicit selection verbatim
  } else {
    const root = document.querySelector('article') || document.querySelector('main') ||
      document.querySelector('[role="main"]') || document.body;
    const clone = root.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,nav,header,footer,aside,button,svg,[aria-hidden="true"]')
      .forEach((n) => n.remove());
    text = (clone.innerText || clone.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  return { title: (document.title || '').trim() || location.href, url: location.href, text: text.slice(0, 200000) };
}

const CHAT_HOSTS = [
  { re: /(^|\.)chatgpt\.com$/, s: 'chatgpt' },
  { re: /(^|\.)chat\.openai\.com$/, s: 'chatgpt' },
  { re: /(^|\.)claude\.ai$/, s: 'claude' },
  { re: /(^|\.)gemini\.google\.com$/, s: 'gemini' },
];

document.addEventListener('DOMContentLoaded', async () => {
  const saveBtn = document.getElementById('save-btn');
  const savePageBtn = document.getElementById('save-page-btn');
  const statusMessage = document.getElementById('status-message');
  const searchInput = document.getElementById('search-input');
  const stashsList = document.getElementById('stashs-list');
  const searchContainer = document.getElementById('search-container');
  const mainView = document.getElementById('main-view');
  const readerView = document.getElementById('reader-view');
  const backBtn = document.getElementById('back-btn');
  const chatContent = document.getElementById('chat-content');
  const openDashboardBtn = document.getElementById('open-dashboard');

  let allStashs = [];
  let currentTab = null;
  let isChat = false;
  let currentSource = 'web';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  let host = '';
  try { host = new URL(tab.url).hostname; } catch (_e) { /* chrome:// etc */ }
  const match = CHAT_HOSTS.find((h) => h.re.test(host));
  isChat = !!match;
  currentSource = match ? match.s : 'web';

  if (isChat) {
    saveBtn.textContent = 'Save conversation';
    savePageBtn.classList.remove('hidden');
  } else {
    saveBtn.textContent = 'Save this page';
    savePageBtn.classList.add('hidden');
  }

  loadStashs();

  openDashboardBtn.addEventListener('click', () => chrome.tabs.create({ url: 'dashboard.html' }));
  backBtn.addEventListener('click', () => {
    readerView.classList.add('hidden');
    mainView.classList.remove('hidden');
  });

  saveBtn.addEventListener('click', () => (isChat ? saveConversation() : savePage()));
  savePageBtn.addEventListener('click', savePage);

  searchInput.addEventListener('input', (e) => renderStashs(e.target.value.toLowerCase()));

  function saveConversation() {
    chrome.tabs.sendMessage(currentTab.id, { action: 'GET_CHAT' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.data || !response.data.length) {
        showStatus("Couldn't read this conversation", true);
        return;
      }
      saveEntry({
        type: 'chat',
        source: response.source || currentSource,
        title: response.title,
        url: response.url,
        data: response.data,
      });
    });
  }

  async function savePage() {
    try {
      const [{ result } = {}] = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: extractPageContent,
      });
      if (!result || !result.text) {
        showStatus("Couldn't read this page", true);
        return;
      }
      saveEntry({
        type: 'page',
        source: 'web',
        title: result.title,
        url: result.url,
        data: [{ role: 'page', content: result.text }],
      });
    } catch (_e) {
      showStatus("Can't save this page", true);
    }
  }

  // Two saves of the same chat/page should refresh one entry, not pile up
  // duplicates. Identity = type + URL (or type + title + opening text when there
  // is no URL). On a match we update in place, keep the tags/highlights/summary
  // the user added, and only drop the cached embedding when the content changed.
  const entrySig = (it) => (it.url
    ? `${it.type || 'chat'}|${it.url}`
    : `${it.type || 'chat'}|${(it.title || '').trim().toLowerCase()}|${(it.data && it.data[0] && it.data[0].content || '').slice(0, 120)}`);

  function saveEntry(partial) {
    chrome.storage.local.get({ stashs: [], embeddings: {} }, (result) => {
      const stashs = result.stashs;
      const embeddings = result.embeddings || {};
      const sig = entrySig(partial);
      const idx = stashs.findIndex((it) => entrySig(it) === sig);
      let updated, statusMsg;
      if (idx !== -1) {
        const old = stashs[idx];
        const changed = JSON.stringify(old.data) !== JSON.stringify(partial.data);
        const merged = {
          ...old,
          title: partial.title || old.title,
          url: partial.url || old.url,
          source: partial.source || old.source,
          type: partial.type || old.type,
          data: partial.data,
          timestamp: new Date().toISOString(),
          tags: old.tags || [],
          highlights: old.highlights || [],
        };
        if (changed) { delete embeddings[old.id]; delete merged.summary; } // re-embed / re-summarize
        updated = [merged, ...stashs.filter((_, i) => i !== idx)];
        statusMsg = partial.type === 'page' ? 'Page updated' : 'Updated';
      } else {
        const entry = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), timestamp: new Date().toISOString(), ...partial };
        updated = [entry, ...stashs];
        statusMsg = partial.type === 'page' ? 'Page saved' : 'Saved';
      }
      chrome.storage.local.set({ stashs: updated, embeddings }, () => {
        allStashs = updated;
        searchContainer.classList.remove('hidden');
        renderStashs();
        showStatus(statusMsg, false);
      });
    });
  }

  function loadStashs() {
    chrome.storage.local.get({ stashs: [] }, (result) => {
      allStashs = result.stashs;
      if (allStashs.length > 0) {
        searchContainer.classList.remove('hidden');
        renderStashs();
      }
    });
  }

  function itemMeta(item) {
    const date = new Date(item.timestamp).toLocaleDateString();
    if ((item.type || 'chat') === 'page') {
      let d = '';
      try { d = new URL(item.url).hostname.replace(/^www\./, ''); } catch (_e) {}
      return `${date} • ${d || 'page'}`;
    }
    return `${date} • ${item.data.length} messages`;
  }

  function renderStashs(query = '') {
    stashsList.innerHTML = '';
    const filtered = allStashs.filter((item) => {
      if (!query) return true;
      const titleMatch = item.title?.toLowerCase().includes(query);
      const contentMatch = item.data.some((m) => m.content.toLowerCase().includes(query));
      return titleMatch || contentMatch;
    });

    if (filtered.length === 0) {
      stashsList.innerHTML = `<div class="stash-meta" style="text-align:center;padding:10px;">No results found</div>`;
      return;
    }

    filtered.forEach((item) => {
      const raw = item.title || item.data[0]?.content || 'Untitled';
      const excerpt = raw.substring(0, 42) + (raw.length > 42 ? '...' : '');
      const el = document.createElement('div');
      el.className = 'stash-item';
      el.innerHTML = `<div class="stash-title">${escapeHtml(excerpt)}</div><div class="stash-meta">${itemMeta(item)}</div>`;
      el.addEventListener('click', () => openItem(item));
      stashsList.appendChild(el);
    });
  }

  function openItem(stash) {
    mainView.classList.add('hidden');
    readerView.classList.remove('hidden');
    chatContent.innerHTML = '';
    stash.data.forEach((msg) => {
      const el = document.createElement('div');
      el.className = `message ${msg.role}`;
      const label = msg.role === 'page' ? 'Saved page' : msg.role;
      el.innerHTML = `<div class="message-role">${label}</div><div class="message-body">${escapeHtml(msg.content)}</div>`;
      chatContent.appendChild(el);
    });
    chatContent.scrollTop = 0;
  }

  function showStatus(text, isError) {
    statusMessage.textContent = text;
    statusMessage.style.color = isError ? 'var(--red)' : 'var(--red)';
    statusMessage.classList.remove('hidden');
    if (!isError) {
      saveBtn.textContent = 'Saved';
      saveBtn.disabled = true;
      saveBtn.style.opacity = '0.5';
      saveBtn.style.cursor = 'default';
    }
    setTimeout(() => statusMessage.classList.add('hidden'), 3000);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
});
