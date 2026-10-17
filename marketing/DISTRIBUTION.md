# Stash distribution kit

> House rules: no em or en dashes, made. "we" voice, no invented metrics. ChatGPT, Claude and Gemini are named only as functional compatibility. Launch copy for X, LinkedIn, Show HN and Product Hunt already lives in `LAUNCH.md`; this file covers what that does not: search, Reddit, SEO and the paid test.

Order of work: 1) store listing, 2) guide pages deployed, 3) Show HN, 4) Reddit (one post every 2 to 3 days, never two on the same day), 5) ChatGPT ads test.

---

## 1. Chrome Web Store listing v2 (search led)

People find extensions by searching for the problem. The current listing leads with the brand idea. This version leads with the words people type: save, search, export, ChatGPT, Claude, Gemini, history.

**Summary** (manifest `description`, max 132 chars):

Save ChatGPT, Claude and Gemini chats and the pages you read to a private archive you can search. Stored only on your device.

**First paragraph of the Description** (replaces the current opener, rest stays):

Save your ChatGPT, Claude and Gemini conversations and the web pages you read into one private archive you can search. It lives only on your device, so there is no account and no server to trust.

Lost a chat from last month? Search it. Want to continue an old conversation in a fresh thread? Reopen it and pick up where you left off. Want a past answer inside today's prompt? Pull it in as context with one click.

**Keywords to work into the body naturally (do not stuff):** save ChatGPT conversations, search chat history, export AI chats, Claude chat history, Gemini conversations, AI chat archive, private, local, offline.

**Screenshot captions** (the first two matter most):
1. Save any AI chat in one click
2. Search every conversation you have ever had
3. Pull a past chat back into your prompt
4. Ask across everything you saved (Pro)
5. Nothing leaves your device

**Check before pasting:** the store limits and category rules are unchanged, and the permission justifications in `CHROME-STORE.md` still apply. Updating a published listing's text does not need a new package, so it should not reset review.

---

## 2. Search pages (built, in `public/guides/`)

Four pages, each aimed at a real query, each linked to the others and to the store:

| Page | Target query |
|---|---|
| `/guides/search-old-chatgpt-conversations.html` | how to search old ChatGPT conversations |
| `/guides/save-ai-chats-claude-chatgpt-gemini.html` | how to save ChatGPT / Claude / Gemini chats |
| `/guides/ai-memory-on-your-device-vs-in-the-cloud.html` | local vs cloud AI memory |
| `/guides/continue-an-ai-chat-in-a-new-thread.html` | continue AI chat in a new thread |

Sitemap updated. After deploy, submit the four URLs in Search Console (needs the user's login). Add 1 to 2 pages a week from real questions seen on Reddit, for example "export Claude conversations" and "ChatGPT chat history disappeared".

---

## 3. Reddit posts (value first)

Rules for all of them: read each subreddit's self-promotion rule first. Say you are the maker. Put no link in the post body; add the link in a reply only if someone asks, or where the rule allows it. Answer every comment for the first 6 hours.

### 3a. r/ChatGPT

**Title:** The system I use so a good ChatGPT chat is never lost

**Body:**
I used to solve something in a chat, then three weeks later spend 20 minutes trying to find it. What fixed it for me:

1. Rename the chat the moment it becomes useful. "pricing page copy v3" beats "New chat".
2. At the end, ask for a two line summary of the decision. Search for that later, not for the whole chat.
3. Save the finished chat somewhere searchable the same day. Later is when you forget.
4. When a thread gets long and starts contradicting itself, ask for a one paragraph brief (goal, decisions, constraints, open questions), fix it, and paste it into a new chat.

The built-in search is fine for recent chats. It falls over when you remember the idea but not the words.

I got tired of doing step 3 by hand, so we built a small extension for it. Happy to share if it is useful, but the list works without it. What do you do to keep track of old chats?

### 3b. r/ClaudeAI

**Title:** How I hand a long Claude conversation off to a fresh one without losing the plot

**Body:**
Long threads drift for me: early constraints get ignored, answers get slower. What works:

Ask for a brief, not a summary. Something like: "Write a handoff brief for a new conversation: the goal in one sentence, decisions made, hard constraints with their exact wording, and the single open question."

Then read it. This is the step people skip, and it is where you catch the wrong assumption before it travels into the next thread. Paste it as the first message of a new chat, then ask your next question.

Two things that made the biggest difference: keeping constraints in their original wording, and ending the brief with the one question I want answered next.

We are a small studio and made a tool that does the saving and reopening part locally (it is mentioned in my profile if you are curious). Mostly I am interested in how other people handle handoffs, especially for coding sessions.

### 3c. r/PKMS (also fits r/ObsidianMD)

**Title:** Are AI chats notes? What I keep, what I throw away, and where it lives

**Body:**
I changed my mind on this a few times. My current view: a chat is a draft, not a note. Most of it is scaffolding. What deserves to be kept is the decision and the reasoning behind it.

What I do now: save the whole conversation to an archive as raw material, write a two line summary of the decision, and only promote that summary into my notes. The raw chat stays searchable in case I need the detail.

The part I care about most is that none of it sits on someone else's server, because chats tend to contain more private context than anything else I write.

How do you handle AI conversations in your system? Do they go into the vault, a separate archive, or nowhere?

### 3d. r/LocalLLaMA (technical, read the self-promo rule first)

**Title:** Built a Chrome extension with on-device retrieval over saved chats (MiniLM in an MV3 offscreen document), notes and questions

**Body:**
Sharing how we did the on-device part, and looking for feedback.

- The embedding model (quantized all-MiniLM-L6-v2) and the ONNX runtime ship inside the extension package. Loading goes through chrome.runtime.getURL with remote models disabled, so there is no fetch at runtime and the network tab stays empty.
- Inference runs in an MV3 offscreen document so it does not block the page or the service worker.
- "Ask across everything" is extractive: embed the query, pull the best passages, assemble with TextRank plus MMR, cite the source of every line. Nothing is generated, which felt like the honest default for a memory tool.

Open questions: is the offscreen document a safe long-term home for the model given how MV3 treats them, and how much further can a model this small be pushed for retrieval before a bigger one is worth the download? Link in a comment if the mods are fine with it.

---

## 4. ChatGPT ads test (Stash only, 14 days)

**Why a test and not a launch:** ChatGPT ads are young, there are no published benchmarks, and a one time $39 product will not pay back its acquisition cost at paid rates. The goal is to learn which message earns clicks. Do not scale on this.

**Setup** (ads.openai.com, self-serve, India is on the supported list as of the October 2026 availability page):
- Objective: Clicks (CPC). Start the max bid at the recommended range and lower it after day 3 if the delivery is healthy. Only Free and Go users see ads, which is worth remembering when reading results.
- Budget: the minimum daily budget (about 725 rupees in India), 14 days, roughly 10,000 rupees total. Hard stop at 12,000 rupees.
- Billing entity must match the advertiser. New accounts may only target the home country at first, so expect Indian traffic and judge it as a messaging test, not a revenue test.

**Context hints** (describe the conversations you want to appear in, in plain language):
- A: The user is in a long conversation and is worried about losing it, or is trying to find an earlier chat they cannot locate.
- B: The user asks how to save, export, search or organize their chat history or past conversations.

Do not target health or political conversations (they are excluded anyway).

**Ad copy** (trim to the fields Ads Manager shows):

| Variant | Headline | Body |
|---|---|---|
| 1 | Never lose a good chat again | Save your AI chats in one click and search them later. Private, on your device. |
| 2 | Search your old AI chats | Stash keeps every conversation and page you read in one private archive. Free. |
| 3 | Your chats, kept on your device | No account, no cloud. Save, search and reopen any AI conversation. |

Run A with variants 1 and 2, B with variants 2 and 3. Landing page: `https://stash.made-by-ac.com/guides/search-old-chatgpt-conversations.html` for hint B, `https://stash.made-by-ac.com/guides/save-ai-chats-claude-chatgpt-gemini.html` for hint A. Add `?utm_source=chatgpt&utm_medium=cpc&utm_campaign=<hint>-<variant>` to each.

**Measure** (ad platform numbers plus the Web Store dashboard; see tracking below):
- CTR. The one early report we found was 0.91%. Below 0.5% means the message or hint is wrong.
- Clicks from the platform versus the day's installs delta in the Web Store dashboard.
- Cost per click versus the recommended $3 to $5 range. One agency test in Malaysia saw about $0.50, so expect variance.

**Decision rule on day 14:** if one variant holds a CTR over 0.7% and the cost per install is under about $8, run it another 2 weeks. Otherwise stop and put the money into a flat-fee small creator sponsorship instead.

**Tracking and the privacy promise:** the site and extension say there are no analytics, trackers or third-party scripts. Do not add one for this test. Use the platform's own click counts, the Vercel request logs for the two landing URLs, and the Web Store installs delta. It is coarser, and it keeps the promise.

---

## 5. Cross promotion with Airlock (live on the Web Store since 2026-06-30)

Add a small "From the same studio" strip on both landing pages and in the two store descriptions: "Airlock guards what you send. Stash keeps what you get back." Both products now share an audience of privacy-minded heavy AI users, so every visit to one is a free lead for the other.
