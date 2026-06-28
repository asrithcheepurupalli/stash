# Chrome Web Store listing — Stash

> No em or en dashes (house rule). made. "we" voice. Everything below is paste-ready
> for the Developer Dashboard. Screenshots and tiles are in /marketing.

---

## Store listing

**Name:** Stash

**Summary** (this is the manifest `description`, max 132 chars):
Save your AI chats and the pages you read into a private, searchable memory that lives only on your device.

**Category:** Productivity

**Language:** English

---

## Detailed description (paste into "Description")

> PLAIN TEXT ONLY. The store does NOT render Markdown, so no `**bold**` or `###`.
> Paste exactly the block below (caps headers + bullet dots create the hierarchy).

Your best thinking now happens inside AI chat windows, and then it scrolls away. Stash keeps all of it.

Stash saves your AI conversations and the web pages you read into one private memory that lives only on your machine. Save it once, find it anytime. No servers, no account, and no one else can reach it.

Save without leaving the chat. A small pill sits on your AI chats. One click saves the conversation you are in, and your saved memories are always a click away to pull back into your prompt as context. The pages you read save the same way.

Find anything, your way. Search your whole archive by keyword, or open any saved chat and pick up exactly where you left off in a fresh thread.

A memory profile. A quiet home screen shows what you keep, a full year of your saving habits, and a way straight back into anything.

STASH PRO ADDS ON-DEVICE INTELLIGENCE

Pro bundles a small AI model right into the extension, so your memory works for you. Like the rest of Stash, it runs entirely on your machine and sends nothing anywhere.

• Ask across everything. Ask a question and get an answer assembled from the best passages across all your saved chats and pages, with every line citing the memory it came from.
• Memory inside your chats. The pill surfaces your related past conversations and drops the right one into your prompt as context.
• It organizes itself. Your memory sorts into named collections by topic.
• Summaries and tags, written for you. Summarize any thread in a sentence or two, and let your archive tag itself.

Pro is a one-time purchase. No subscription, nothing to cancel.

PRIVACY IS THE WHOLE POINT

A memory cannot leak if it never leaves. Stash makes no network calls of its own. Everything you save is stored locally with your browser's storage. There is no cloud, no account, no tracking, and nothing for us to sell, because we never receive it. The single time Stash touches the internet is the optional moment you activate a Pro license, and it only asks for that permission then.

Stash is a made. product, part of a small family of local-first tools.

---

## Single purpose (paste into "Single purpose")

Stash lets you save your AI chat conversations and the web pages you read into a private, searchable archive that is stored on your own device.

---

## Permission justifications (paste each into its field)

**storage:** Stash stores the user's saved AI conversations, saved web pages, tags, highlights and settings locally on the device with chrome.storage.local. This local archive is the core function of the extension: a private memory the user can search and revisit. None of it is sent to a server.

**unlimitedStorage:** Saved conversations and full web pages can be large, and a user's archive accumulates over time, so it can exceed the default storage quota. unlimitedStorage lets users keep their full history on-device rather than forcing Stash to evict older items. All of this data stays local to the device.

**scripting:** When the user clicks Save, Stash injects a content script into the active AI chat or web page to read its visible text and capture it into the local archive. The same injection places a previously saved memory back into the chat input box when the user chooses to insert or resume one.

**activeTab:** Stash reads the content of the page the user is currently viewing only when the user explicitly clicks Save in the Stash popup, so it can capture that page into the on-device archive. It is never used to read tabs in the background or without a user action.

**offscreen:** Stash Pro runs a small on-device search model inside an offscreen document to power the in-chat "pull from memory" feature without slowing the page. No data leaves the device.

**Host permissions (chatgpt.com, chat.openai.com, claude.ai, gemini.google.com):** Stash adds its save-and-recall pill to these AI chat sites and reads the conversation when the user saves it.

**Optional host permission (api.gumroad.com):** Requested only when a user chooses to activate a Pro license, in order to verify the license key with the payment provider. It is never requested or used otherwise, and only the license key the user typed is sent.

---

## Data usage disclosures (the "Privacy practices" form)

NOTE: Chrome counts data handled LOCALLY as "handled" too (no local-only exemption),
so tick the categories Stash stores even though nothing is transmitted.

- **Remote code?** No, I am not using remote code. (Model + ONNX wasm are bundled in the package and loaded via chrome.runtime.getURL with allowRemoteModels=false.)
- **What user data do you collect? (checkboxes)** Tick **Website content** (stores page + chat message text) and **Web history** (stores the URL, title and time of each saved item). Leave all others unchecked: no PII, health, financial, authentication, location, or user-activity logging. (Personal communications: leave off — that category targets interpersonal email/DMs; Website content covers the saved chat text.)
- **Certify all three:** do not sell/transfer to third parties; do not use for unrelated purposes; do not use for creditworthiness/lending. All true.
- **Data transfer note:** The only data that ever leaves the device is the Pro license key, sent to Gumroad at the moment the user activates Pro, solely to verify the purchase. No saved content is ever transmitted.
- **Privacy policy URL:** https://stash.made-by-ac.com/privacy.html

---

## Privacy policy

Live at **https://stash.made-by-ac.com/privacy.html** (paste this into the required Privacy Policy URL field).
Support page live at **https://stash.made-by-ac.com/support.html**. Source text below.

**Stash privacy policy**

Stash is built so that your data never leaves your device.

- Everything you save in Stash, your conversations, the pages you read, your tags and highlights, is stored locally in your own browser. We do not have servers that receive it, and we cannot see it.
- Stash makes no network requests of its own while you use it. You can open your browser's network tab and watch it stay quiet.
- The only time Stash contacts the internet is when you choose to activate a Stash Pro license. At that moment, and only then, the license key you enter is sent to our payment provider (Gumroad) to confirm the purchase. No saved content is included.
- We do not use analytics, trackers, or third-party scripts. We collect no personal information, sell nothing, and share nothing, because none of it reaches us.
- Your whole archive exports to a file you keep, and you can delete everything at any time from inside the extension.

If you have a question, write to us at hello@made-by-ac.com.

This policy may be updated as Stash evolves. Last updated: June 2026.
