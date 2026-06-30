# Stash launch announcement

> Post when the Web Store listing is approved. made. voice ("we / our"). No em or en
> dashes. No AI tells. ChatGPT / Claude / Gemini are named only as functional
> compatibility (the extension works on them).
>
> Placeholders to fill at launch:
> - https://chromewebstore.google.com/detail/mppjogomhpmhfocknjgokeimbmolhkif = the Chrome Web Store URL (https://chromewebstore.google.com/detail/...)
> - https://stash.made-by-ac.com  = https://stash.made-by-ac.com
>
> Assets to attach: the 5 store screenshots (marketing/store/01..05), og.png for link
> previews, and the marquee tile for banners.

---

## One-liner (use anywhere)

Stash keeps every AI chat and the pages you read in one private memory that lives only on your device. No account, no cloud, nothing phones home.

---

## X / Twitter

**Hero post**

Your best thinking happens inside AI chats. Then it scrolls away.

Stash keeps all of it. Every ChatGPT, Claude and Gemini conversation, and the pages you read, in one private memory that lives only on your device.

No account. No cloud. Nothing phones home.

https://chromewebstore.google.com/detail/mppjogomhpmhfocknjgokeimbmolhkif

**Thread (optional follow-ups)**

2/ One small pill sits on your AI chats. Click it to save the thread you are in. Click again to pull a past one back into your prompt as context. The pages you read save the same way.

3/ Search your whole archive, or reopen any saved chat right where you left off. A quiet home screen shows what you keep and a full year of your saving habits.

4/ Stash Pro bundles a small AI model into the extension, fully on-device. Ask a question and get an answer drawn from the best passages across everything you saved, each line cited. It even sorts itself into collections. One time, $39, no subscription.

5/ Why local-first? A memory cannot leak if it never leaves. Stash makes no network calls of its own. Your record of your own thinking stays yours.

Free to use: https://chromewebstore.google.com/detail/mppjogomhpmhfocknjgokeimbmolhkif

---

## LinkedIn

We kept losing our best thinking inside AI chat windows. The answer you found at midnight, gone by next week, buried under a hundred tabs.

So we built Stash.

Stash keeps every AI conversation and the pages you read in one searchable memory, and it lives only on your device. No account, no cloud, no tracking. A memory cannot leak if it never leaves.

A small pill sits on your AI chats: one click to save the thread you are in, one click to pull a past one back in as context. Pro adds a small AI model that runs entirely on your machine, so you can ask a question and get an answer drawn from everything you have saved, with every line cited.

Stash is free. Pro is a one time $39, no subscription, nothing to cancel.

It is the sibling to Airlock, our privacy firewall for AI. Airlock guards what you send. Stash keeps what you get back. Neither one ever phones home.

https://chromewebstore.google.com/detail/mppjogomhpmhfocknjgokeimbmolhkif

---

## Reddit (r/SideProject, r/chrome_extensions, r/productivity, r/ChatGPT)

**Title:** We built Stash, a local-first memory for your AI chats and the pages you read (nothing leaves your device)

**Body:**

Our best thinking kept happening inside AI chats and then scrolling away, buried under tabs. We wanted it back without handing it to another cloud.

Stash is a Chrome extension that saves your ChatGPT, Claude and Gemini conversations and the pages you read into one searchable memory. The part that matters: it all stays on your device. No account, no servers, no tracking. It makes no network calls of its own, you can open the network tab and watch it stay quiet.

How it works: a small pill sits on your AI chats. One click saves the thread. One click pulls a past one back into your prompt as context. Pages save the same way. Everything is searchable, and you can reopen any saved chat right where you left off.

It is free. There is an optional Pro ($39 once, no subscription) that bundles a small AI model into the extension, still fully on-device, so you can ask a question and get an answer assembled from across everything you saved, with citations.

Happy to answer anything about how the on-device search works or the privacy model. https://chromewebstore.google.com/detail/mppjogomhpmhfocknjgokeimbmolhkif

---

## Hacker News (Show HN)

**Title (primary):** Show HN: Stash, a local-first memory for your AI chats (on-device, no servers)

Alternates:
- Show HN: On-device memory for your AI chats and the pages you read
- Show HN: A Chrome extension that saves your AI chats on-device, no cloud

**URL field:** https://stash.made-by-ac.com

**First comment (post within a minute of submitting):**

Hi HN. We are a small studio, and we built Stash to fix our own problem: our best thinking kept happening inside AI chats and then scrolling away, and every "memory" option wanted to sync it all to someone's cloud. We did not want that.

Stash is a Chrome extension that saves your conversations (ChatGPT, Claude, Gemini) and the web pages you read into one searchable archive. The whole thing lives in the browser and makes no network calls of its own, so you can open the network tab and watch it stay quiet.

Under the hood:

- Saving reads the conversation straight from the page DOM (per-site extractors) and stores it with chrome.storage.local, with unlimitedStorage so long threads and full pages fit.
- Search and the Pro features run on-device. We bundle a quantized all-MiniLM-L6-v2 embedding model and the ONNX runtime into the package itself, loaded via chrome.runtime.getURL with remote models disabled, and run inference in an MV3 offscreen document so it does not block the page. No server in the loop.
- "Ask across everything" is extractive, not generative: we embed the query, pull the best passages across your saved items, and assemble the answer with TextRank plus MMR, every line cited back to its source. Nothing is invented, which felt like the honest default for a memory tool.

The only time it touches the network is an optional license check, and only if you choose to buy Pro. Stash itself is free; Pro is a one-time $39, no subscription.

Things we are genuinely unsure about and would like input on: whether the offscreen document is the right long-term home for the model, how far a small on-device model can be pushed for retrieval before it stops feeling worth it, and which sites beyond the three are worth writing extractors for. Happy to go deep on any of it.

**Be ready for these (fast, honest replies make or break the thread):**

- *Open source?* Not yet. But the privacy claim does not require trust: no network calls (verify in the network tab), and the model + runtime ship inside the package. We have considered open-sourcing the extractors at least.
- *Why paid / why $39?* Save, search and resume are free forever. Pro is the on-device model features (ask-across-everything, auto-collections). One-time because we dislike subscriptions for a tool that runs entirely on your machine with no server cost to us.
- *Why not the AI's built-in memory or export?* Built-in memory is per-tool and lives on their servers; you cannot search across tools or across the pages you read. Stash is cross-tool, local, and yours to export.
- *Is a model that small any good?* Retrieval over your own corpus is a far easier task than open-domain. For "find the thing I already saw" it is plenty. Would love stress tests.
- *What happens on uninstall?* Data lives in browser storage, so uninstall clears it. Export to a file any time, re-import to restore.
- *Firefox / Safari?* Chromium first (MV3). Firefox is feasible and on the list if there is demand.
- *Robust to site DOM changes?* Per-site extractors that we validate and fix when sites change (we updated Claude's selector recently, for example).

---

## Product Hunt

**Name:** Stash

**Tagline (60 char max), primary:** A private memory for everything you do with AI
Alternates:
- On-device memory for your AI chats and the pages you read
- Your AI chats and reading, kept on your own device

**Description (260 char max):**
Stash saves your AI conversations and the pages you read into one searchable memory that lives only on your machine. No account, no cloud, nothing phones home. Pro adds a small on-device AI to ask across everything you saved, with citations.

**Links:** Website https://stash.made-by-ac.com · Chrome Web Store https://chromewebstore.google.com/detail/mppjogomhpmhfocknjgokeimbmolhkif

**Topics:** Productivity, Chrome Extensions, Artificial Intelligence, Privacy

**Pricing:** Freemium (free, with a one-time $39 Pro)

**Thumbnail:** marketing/store/ph-thumbnail-512.png

**Gallery order:** 01-dashboard, 02-pill, 03-ask, 04-collections, 05-private (the 1280x800 store shots; PH recommends 1270x760, close enough). Optional banner: promo-marquee-1400x560.

**First maker comment (post the moment it goes live):**
Hi Product Hunt. We are the small studio behind Stash.

We built it because our best thinking kept disappearing into AI chat windows, and the existing answer was always "sync it to our cloud." We did not want that. So Stash keeps everything on your device and makes no network calls of its own. A memory cannot leak if it never leaves.

A pill on your AI chats saves a thread in one click and pulls a past one back into your prompt as context. Pro runs a small AI model on your machine so you can ask a question and get an answer drawn from across everything you saved, each line cited. It is free to use, with a one-time Pro.

It is the sibling to Airlock, our privacy firewall for AI. Happy to answer anything.

**Launch mechanics:**
1. Create as a draft, then schedule for 12:01am PT on a Tue, Wed or Thu (full leaderboard day).
2. Add it to your "Upcoming" page a few days early so people can hit "notify me."
3. Add yourself as a maker. Set pricing to Freemium.
4. Day-of: be in the comments all day. You may share the link and invite people to check it out and give feedback. Do NOT say "please upvote" (PH penalizes vote solicitation); "we just launched, would love your thoughts" is fine.

---

## Short blurb (email / newsletter / made. audience)

Stash is out. It keeps every AI chat and the pages you read in one private memory that lives only on your device. No account, no cloud, nothing phones home. Free to use, with an optional one time Pro. https://chromewebstore.google.com/detail/mppjogomhpmhfocknjgokeimbmolhkif

---

## Posting notes

- Lead with the privacy hook on Reddit and HN; lead with the "scrolls away" pain on X and LinkedIn.
- HN and Reddit reward honesty and answering questions in the comments fast. Be present for the first few hours.
- Reuse the made. design assets: og.png drives the link preview, the store screenshots carry the gallery.
- Cross-link Airlock in every post; the two reinforce each other.
