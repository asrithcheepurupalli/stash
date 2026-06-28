/**
 * Recall Popup Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save-btn');
  const statusMessage = document.getElementById('status-message');
  const searchInput = document.getElementById('search-input');
  const recallsList = document.getElementById('recalls-list');
  const searchContainer = document.getElementById('search-container');
  const mainView = document.getElementById('main-view');
  const readerView = document.getElementById('reader-view');
  const backBtn = document.getElementById('back-btn');
  const chatContent = document.getElementById('chat-content');
  const openDashboardBtn = document.getElementById('open-dashboard');

  let allRecalls = [];

  // Initialize
  loadRecalls();

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
      console.error("Recall Error:", error);
    }
  });

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    renderRecalls(query);
  });

  function loadRecalls() {
    chrome.storage.local.get({ recalls: [] }, (result) => {
      allRecalls = result.recalls;
      if (allRecalls.length > 0) {
        searchContainer.classList.remove('hidden');
        renderRecalls();
      }
    });
  }

  function renderRecalls(query = "") {
    recallsList.innerHTML = "";
    
    const filtered = allRecalls.filter(item => {
      if (!query) return true;
      const titleMatch = item.title?.toLowerCase().includes(query);
      const contentMatch = item.data.some(msg => msg.content.toLowerCase().includes(query));
      return titleMatch || contentMatch;
    });

    if (filtered.length === 0) {
      recallsList.innerHTML = `<div class="recall-meta" style="text-align: center; padding: 10px;">No results found</div>`;
      return;
    }

    filtered.forEach(item => {
      const displayTitle = item.title || item.data[0]?.content.substring(0, 40) + "...";
      const excerpt = displayTitle.substring(0, 40) + (displayTitle.length > 40 ? "..." : "");
      
      const el = document.createElement('div');
      el.className = 'recall-item';
      el.innerHTML = `
        <div class="recall-title">${excerpt}</div>
        <div class="recall-meta">${new Date(item.timestamp).toLocaleDateString()} • ${item.data.length} messages</div>
      `;
      el.addEventListener('click', () => openChat(item));
      recallsList.appendChild(el);
    });
  }

  function openChat(recall) {
    mainView.classList.add('hidden');
    readerView.classList.remove('hidden');
    
    chatContent.innerHTML = "";
    recall.data.forEach(msg => {
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

    chrome.storage.local.get({ recalls: [] }, (result) => {
      const updatedRecalls = [entry, ...result.recalls];
      chrome.storage.local.set({ recalls: updatedRecalls }, () => {
        allRecalls = updatedRecalls;
        searchContainer.classList.remove('hidden');
        renderRecalls();
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
