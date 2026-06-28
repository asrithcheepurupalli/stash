/**
 * Recall Content Script
 * Extracts messages from the current ChatGPT conversation.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_CHAT") {
    const chatData = extractChat();
    sendResponse({ 
      data: chatData,
      url: window.location.href,
      title: document.title.replace(" | ChatGPT", "")
    });
  }
  return true; 
});

// Check for pending resume context on load
chrome.storage.local.get(['pending_resume_context'], (result) => {
  if (result.pending_resume_context) {
    const context = result.pending_resume_context;
    
    // Attempt to inject into prompt
    const injectContext = () => {
      const textarea = document.querySelector('#prompt-textarea');
      if (textarea) {
          // ChatGPT uses a contenteditable div or textarea depending on version
          // We try both common selectors
          const p = textarea.querySelector('p') || textarea;
          p.innerText = context;
          
          // Trigger events so ChatGPT's internal state updates
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Clear it so it doesn't paste again on refresh
        chrome.storage.local.remove(['pending_resume_context']);
        return true;
      }
      return false;
    };

    // ChatGPT is a heavy SPA, wait for element to exist
    if (!injectContext()) {
      const observer = new MutationObserver((mutations, obs) => {
        if (injectContext()) obs.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      
      // Stop checking after 10 seconds to avoid memory leaks
      setTimeout(() => observer.disconnect(), 10000);
    }
  }
});

function extractChat() {
  const messageElements = document.querySelectorAll('[data-message-author-role]');
  const messages = [];

  messageElements.forEach((el) => {
    const role = el.getAttribute('data-message-author-role');
    const content = el.innerText || el.textContent;

    if (role && content) {
      messages.push({
        role: role === 'user' ? 'user' : 'assistant',
        content: content.trim()
      });
    }
  });

  return messages;
}
