/**
 * Stash Popup Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save-btn');
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

  // Initialize
  loadStashs();

  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'dashboard.html' });
  });

  backBtn.addEventListener('click', () => {
    readerView.classList.add('hidden');
    mainView.classList.remove('hidden');
  });

  saveBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      chrome.tabs.sendMessage(tab.id, { action: "GET_CHAT" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }

        if (response && response.data) {
          saveToStorage(response);
        }
      });
    } catch (error) {
      console.error("Stash Error:", error);
    }
  });

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    renderStashs(query);
  });

  function loadStashs() {
    chrome.storage.local.get({ stashs: [] }, (result) => {
      allStashs = result.stashs;
      if (allStashs.length > 0) {
        searchContainer.classList.remove('hidden');
        renderStashs();
      }
    });
  }

  function renderStashs(query = "") {
    stashsList.innerHTML = "";
    
    const filtered = allStashs.filter(item => {
      if (!query) return true;
      const titleMatch = item.title?.toLowerCase().includes(query);
      const contentMatch = item.data.some(msg => msg.content.toLowerCase().includes(query));
      return titleMatch || contentMatch;
    });

    if (filtered.length === 0) {
      stashsList.innerHTML = `<div class="stash-meta" style="text-align: center; padding: 10px;">No results found</div>`;
      return;
    }

    filtered.forEach(item => {
      const displayTitle = item.title || item.data[0]?.content.substring(0, 40) + "...";
      const excerpt = displayTitle.substring(0, 40) + (displayTitle.length > 40 ? "..." : "");
      
      const el = document.createElement('div');
      el.className = 'stash-item';
      el.innerHTML = `
        <div class="stash-title">${excerpt}</div>
        <div class="stash-meta">${new Date(item.timestamp).toLocaleDateString()} • ${item.data.length} messages</div>
      `;
      el.addEventListener('click', () => openChat(item));
      stashsList.appendChild(el);
    });
  }

  function openChat(stash) {
    mainView.classList.add('hidden');
    readerView.classList.remove('hidden');
    
    chatContent.innerHTML = "";
    stash.data.forEach(msg => {
      const msgEl = document.createElement('div');
      msgEl.className = `message ${msg.role}`;
      msgEl.innerHTML = `
        <div class="message-role">${msg.role}</div>
        <div class="message-body">${msg.content}</div>
      `;
      chatContent.appendChild(msgEl);
    });
    // Scroll to top
    chatContent.scrollTop = 0;
  }

  function saveToStorage(response) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp: timestamp,
      data: response.data,
      url: response.url,
      title: response.title
    };

    chrome.storage.local.get({ stashs: [] }, (result) => {
      const updatedStashs = [entry, ...result.stashs];
      chrome.storage.local.set({ stashs: updatedStashs }, () => {
        allStashs = updatedStashs;
        searchContainer.classList.remove('hidden');
        renderStashs();
        showSuccess();
      });
    });
  }

  function showSuccess() {
    statusMessage.classList.remove('hidden');
    saveBtn.innerText = "Saved";
    saveBtn.disabled = true;
    saveBtn.style.opacity = "0.5";
    saveBtn.style.cursor = "default";
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      statusMessage.classList.add('hidden');
    }, 3000);
  }
});
