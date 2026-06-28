/**
 * Stash MAIN-world injector. Runs in the page's own context (content scripts in
 * the isolated world cannot reliably drive ProseMirror / Quill composers). The
 * panel in content.js postMessages the text to inject; this types it into the
 * live composer via execCommand, which the rich editors accept.
 */
(() => {
  const SEL = [
    '#prompt-textarea',                                  // ChatGPT
    'div.ProseMirror[contenteditable="true"]',           // ChatGPT / Claude
    'div[contenteditable="true"][translate="no"]',       // Claude
    'rich-textarea .ql-editor[contenteditable="true"]',  // Gemini
    'div[contenteditable="true"]',
    'textarea',
  ];
  const findBox = () => {
    for (const s of SEL) { const el = document.querySelector(s); if (el) return el; }
    return null;
  };

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.__stash !== 'inject') return;
    const el = findBox();
    if (!el) return;
    el.focus();
    let ok = false;
    try { ok = document.execCommand('insertText', false, e.data.text); } catch (_e) { ok = false; }
    if (!ok) {
      if (el.tagName === 'TEXTAREA') el.value += e.data.text;
      else { const p = el.querySelector('p') || el; p.textContent = (p.textContent || '') + e.data.text; }
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
})();
