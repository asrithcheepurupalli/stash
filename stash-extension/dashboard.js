/**
 * Stash Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const sidebarList = document.getElementById('sidebar-list');
    const searchInput = document.getElementById('dashboard-search');
    const typeFilters = document.getElementById('type-filters');
    const tagFilterContainer = document.getElementById('tag-filter-container');
    const chatView = document.getElementById('chat-view');
    const overview = document.getElementById('overview');
    const answerView = document.getElementById('answer-view');
    const answerQuery = document.getElementById('answer-query');
    const answerPassages = document.getElementById('answer-passages');
    const answerSources = document.getElementById('answer-sources');
    const ovIdentity = document.getElementById('ov-identity');
    const ovStats = document.getElementById('ov-stats');
    const ovHeatmap = document.getElementById('ov-heatmap');
    const ovHeatSub = document.getElementById('ov-heat-sub');
    const ovTopics = document.getElementById('ov-topics');
    const ovCollections = document.getElementById('ov-collections');
    const reorganizeBtn = document.getElementById('ov-reorganize');
    const ovRevisit = document.getElementById('ov-revisit');
    const homeBtn = document.getElementById('home-btn');
    const messagesContainer = document.getElementById('chat-messages');
    const chatSummary = document.getElementById('chat-summary');
    const summaryText = document.getElementById('summary-text');
    const activeChatTitle = document.getElementById('active-chat-title');
    const activeChatDate = document.getElementById('active-chat-date');
    const activeTags = document.getElementById('active-tags');
    const addTagBtn = document.getElementById('add-tag-btn');
    const deleteBtn = document.getElementById('delete-chat');
    const copyBtn = document.getElementById('copy-chat');
    const exportAllBtn = document.getElementById('export-all');
    const importAllBtn = document.getElementById('import-all');
    const importFile = document.getElementById('import-file');
    const exportMDBtn = document.getElementById('export-md');
    const continueBtn = document.getElementById('continue-chat');
    const searchMode = document.getElementById('search-mode');
    const aiStatus = document.getElementById('ai-status');
    const genSummaryBtn = document.getElementById('gen-summary');
    const suggestedTags = document.getElementById('suggested-tags');
    const proToggle = document.getElementById('pro-toggle');
    const licensePanel = document.getElementById('license-panel');
    const licenseKey = document.getElementById('license-key');
    const licenseActivate = document.getElementById('license-activate');
    const licenseCancel = document.getElementById('license-cancel');
    const licenseMsg = document.getElementById('license-msg');

    let allStashs = [];
    let currentActiveStash = null;
    let selectedTag = null;
    let typeFilter = 'all';       // all | chat | page
    let sourceFilter = null;      // chatgpt | claude | gemini | web
    let visibleItems = [];        // flat order for keyboard nav
    let cursor = -1;

    // ---- Pro / on-device AI state -----------------------------------------
    let proActive = false;
    let mode = 'filter';          // filter (free) | ask (Pro, semantic)
    let ai = null;                // lazily import('./ai.js')
    let embIndex = {};            // { [id]: vector }, persisted in storage
    let askResults = null;        // last semantic ranking, or null in filter mode
    let collections = null;       // auto-organized clusters, or null until built
    let collecting = false;

    // ---- helpers -----------------------------------------------------------
    const SOURCE_LABELS = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', web: 'Web' };
    const RESUME_URLS = { chatgpt: 'https://chatgpt.com/', claude: 'https://claude.ai/new', gemini: 'https://gemini.google.com/app' };
    const isPage = (item) => (item.type || 'chat') === 'page';
    const sourceOf = (item) => item.source || 'chatgpt';
    const sourceLabel = (item) => SOURCE_LABELS[sourceOf(item)] || 'Chat';
    function domainOf(item) { try { return new URL(item.url).hostname.replace(/^www\./, ''); } catch (_e) { return ''; } }
    function metaFor(item) {
        const date = new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (isPage(item)) return `${date} • ${domainOf(item) || 'Web'}`;
        return `${date} • ${sourceLabel(item)} • ${item.data.length} msg`;
    }
    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }
    function roleLabel(role) {
        if (role === 'page') return 'Saved page';
        if (role === 'user') return 'You';
        if (role === 'assistant') return 'Assistant';
        return role;
    }

    // Small, safe markdown -> HTML for the reading view (escapes first).
    function renderMarkdown(src) {
        let s = escapeHtml(src);
        const blocks = [];
        s = s.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (m, lang, code) => {
            blocks.push(`<pre class="md-pre"><code>${code.replace(/\n$/, '')}</code></pre>`);
            return `@@B${blocks.length - 1}@@`;
        });
        s = s.replace(/^######\s?(.*)$/gm, '<h6>$1</h6>')
             .replace(/^#####\s?(.*)$/gm, '<h5>$1</h5>')
             .replace(/^####\s?(.*)$/gm, '<h4>$1</h4>')
             .replace(/^###\s?(.*)$/gm, '<h3>$1</h3>')
             .replace(/^##\s?(.*)$/gm, '<h2>$1</h2>')
             .replace(/^#\s?(.*)$/gm, '<h1>$1</h1>');
        s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
             .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        s = s.replace(/(?:^|\n)((?:\s*[-*]\s+.*(?:\n|$))+)/g, (m, list) => {
            const items = list.trim().split('\n').map((li) => `<li>${li.replace(/^\s*[-*]\s+/, '')}</li>`).join('');
            return `\n<ul class="md-ul">${items}</ul>`;
        });
        s = s.split(/\n{2,}/).map((p) => {
            const t = p.trim();
            if (!t) return '';
            if (/^<(h\d|ul|pre|blockquote)/.test(t) || t.includes('@@B')) return p;
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('\n');
        s = s.replace(/@@B(\d+)@@/g, (m, i) => blocks[+i]);
        return s;
    }

    // ---- data --------------------------------------------------------------
    function loadData() {
        chrome.storage.local.get({ stashs: [], pro_active: false, embeddings: {} }, (result) => {
            allStashs = result.stashs;
            proActive = result.pro_active;
            embIndex = result.embeddings || {};
            updateProUI();
            renderTypeFilters();
            renderTagFilters();
            renderSidebar(searchInput.value);
            renderOverview();
        });
    }

    // ===================== Memory profile (overview) =====================
    const OV_STOP = new Set(('the a an and or but if then this that these those is are was were be been being to of in on for with as by at from into about over after before your you we they it he she him her them our their its can could would should will just like get got make made use used using one two also not no yes do does did how what when where why who which while because so than too very more most some any all each other out up down off here there with what your into how can will tell told idea ideas key here thing things lately good great need needs want wants look looking really actually going gonna lot lots sure okay ok well maybe something someone anything everything nothing let lets give given take takes work works working help helps way ways much many even still around across within without your you also more new first second next last best better example explain explained understand understood right left'
        // common filler verbs / adjectives / adverbs / quantifiers / time words that
        // otherwise dominate by sheer frequency and make topics meaningless
        + ' have has had having only through possible possibly feel feels felt feeling small smaller time times day days daily keep keeps kept keeping week weeks weekly perfect perfectly slightly slight think thinks thought thinking complete completely incomplete increase increased increases increasing decrease decreased reduce reduced reduces change changed changes changing set sets setting point points part parts kind kinds sort sorts type types case cases number numbers group groups level levels place placed places area areas side sides start started starts begin began stop stopped stops able allow allows almost already although always among amount another answer anyone anymore appear apply approach ask asked asking available away back bad become becomes becoming begin behind below beside bit both bring brought build built came care cause certain clear come comes coming common consider contain continue cover create created current currently decide deep depend describe detail determine different difficult directly done dont down due during early easy either else end ended ends enough especially even ever every everyone exactly far few find finds follow following force form four full general goes gone half handle happen happens hard held high hold however include includes including indeed inside instead involve issue issues itself large later least leave leaves less line lines little long longer low main matter mean means meant might mind minute moment month months move must near nearly need never nice none nor normally note now occur off offer often old once onto open order others otherwise outside overall own particular particularly past per perhaps plus probably problem problems process provide put quite rather real reason reasons receive recent recently regard related relatively remain require requires result results return run said same say says second see seem seems seen sees several shall short show shows side simple simply since single situation soon space special specific state states step steps such system take taken takes taking term terms third though three throughout thus today together took toward towards true try trying turn type under unless until upon useful usually value various want wanted wants week well went whatever whenever whether whole whom whose within without word words world yet able actual amount basically certainly clearly definitely easily entirely fairly fully generally largely mainly mostly nearly overall partly possibly previously primarily quickly rarely roughly simply slightly somewhat specifically typically usually virtually'
        + ' guide guides tutorial tutorials overview intro introduction summary notes note tips basics review reviews question questions thread chat conversation page article post hold appeal'
        ).split(/\s+/).filter(Boolean));

    function dayKey(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
    function listify(a) { return a.length <= 1 ? (a[0] || '') : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`; }

    const cleanWord = (raw) => raw.replace(/^[.#+-]+/, '').replace(/[.#+-]+$/, '');

    // Terms for ONE item as a Map term->weight. Titles and tags are topical and
    // get heavy weight; body text is mostly filler so it only contributes lightly.
    // Each term counts once per item (max weight wins) so a long chat cannot spam.
    function itemTerms(it) {
        const terms = new Map();
        const bump = (w, by) => { if (w.length >= 4 && !OV_STOP.has(w)) terms.set(w, Math.max(terms.get(w) || 0, by)); };
        (`${it.title || ''}`.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || []).forEach((raw) => bump(cleanWord(raw), 6));
        (it.tags || []).forEach((t) => { const w = String(t).toLowerCase(); if (w.length >= 2 && !OV_STOP.has(w)) terms.set(w, Math.max(terms.get(w) || 0, 7)); });
        const body = (it.data || []).map((m) => m.content).join(' ').toLowerCase();
        (body.match(/[a-z][a-z0-9+#.-]{2,}/g) || []).forEach((raw) => bump(cleanWord(raw), 1));
        return terms;
    }

    // Topics = distinctive terms across your memory. Score = accumulated weight x
    // IDF (so words in almost every item, generic filler, sink); needs >= 2 items
    // (recurring), and drops words present in most items when the archive is big.
    function topTopics(n) {
        const score = {}, df = {}, strong = {};
        allStashs.forEach((it) => itemTerms(it).forEach((w, term) => {
            score[term] = (score[term] || 0) + w;
            df[term] = (df[term] || 0) + 1;
            if (w >= 6) strong[term] = true; // came from a title or tag
        }));
        const N = allStashs.length || 1;
        return Object.entries(score)
            // a title/tag word is topical even once; a body-only word must recur
            .filter(([term]) => (strong[term] || df[term] >= 2) && (N < 8 || df[term] <= N * 0.6))
            .map(([term, s]) => [term, s * Math.log((N + 1) / df[term])])
            .sort((a, b) => b[1] - a[1])
            .slice(0, n)
            .map(([label]) => ({ label, count: df[label] }));
    }

    // ===================== Auto-organize (collections) =====================
    // Cluster items by their embeddings (full version of "what you keep"): an item
    // vector = mean of its chunk vectors; leader clustering + a merge pass groups
    // similar memories; each group is named by its most distinctive terms (TF x
    // inverse cluster frequency). All on-device, reusing the same index Ask uses.
    const CLUSTER_T = 0.42;

    function meanVec(chunks) {
        if (!chunks || !chunks.length || !Array.isArray(chunks[0])) return null;
        const d = chunks[0].length;
        const out = new Array(d).fill(0);
        for (const v of chunks) for (let i = 0; i < d; i++) out[i] += v[i];
        let norm = 0;
        for (let i = 0; i < d; i++) { out[i] /= chunks.length; norm += out[i] * out[i]; }
        norm = Math.sqrt(norm) || 1;
        for (let i = 0; i < d; i++) out[i] /= norm;
        return out;
    }

    function clusterItems(items) {
        const pts = [];
        for (const it of items) {
            if (!it.id) continue;
            const v = meanVec(embIndex[it.id]);
            if (v) pts.push({ it, v });
        }
        pts.sort((a, b) => new Date(b.it.timestamp) - new Date(a.it.timestamp)); // stable order
        const clusters = [];
        for (const p of pts) {
            let best = null, bestS = CLUSTER_T;
            for (const c of clusters) { const s = ai.cosine(p.v, c.centroid); if (s > bestS) { bestS = s; best = c; } }
            if (best) { best.pts.push(p); best.centroid = meanVec(best.pts.map((x) => x.v)); }
            else clusters.push({ pts: [p], centroid: p.v });
        }
        for (let i = 0; i < clusters.length; i++) { // merge near-duplicate clusters
            for (let j = i + 1; j < clusters.length; j++) {
                if (ai.cosine(clusters[i].centroid, clusters[j].centroid) >= CLUSTER_T + 0.08) {
                    clusters[i].pts.push(...clusters[j].pts);
                    clusters[i].centroid = meanVec(clusters[i].pts.map((x) => x.v));
                    clusters.splice(j, 1); j--;
                }
            }
        }
        return clusters.map((c) => c.pts.map((p) => p.it));
    }

    // Title-weighted term tally for a cluster, so collection names come from the
    // topical words in titles/tags, not filler buried in the conversation bodies.
    function termCounts(items) {
        const counts = {};
        items.forEach((it) => itemTerms(it).forEach((w, term) => { counts[term] = (counts[term] || 0) + w; }));
        return counts;
    }

    function nameClusters(clusters) {
        const perCluster = clusters.map(termCounts);
        const cf = {};
        perCluster.forEach((c) => Object.keys(c).forEach((w) => { cf[w] = (cf[w] || 0) + 1; }));
        const N = clusters.length;
        const tc = (w) => w.charAt(0).toUpperCase() + w.slice(1);
        const usedPrimary = new Set();
        return clusters.map((items, i) => {
            const ranked = Object.entries(perCluster[i])
                .map(([w, tf]) => [w, tf * Math.log((N + 1) / (1 + (cf[w] || 0)))])
                .sort((a, b) => b[1] - a[1]);
            const picks = [];
            for (const [w, score] of ranked) {
                if (score <= 0) break;
                if (!picks.length && usedPrimary.has(w)) continue; // avoid two collections sharing a headline term
                picks.push(w);
                if (picks.length === 2) break;
            }
            if (picks[0]) usedPrimary.add(picks[0]);
            let name = picks.map(tc).join(' & ');
            if (!name) name = (items[0].title || items[0].data?.[0]?.content || `Collection ${i + 1}`).slice(0, 24);
            return { name, items };
        });
    }

    async function buildCollections() {
        if (collecting) return;
        collecting = true;
        reorganizeBtn.classList.add('hidden');
        ovCollections.innerHTML = '<div class="ov-coll-loading"><span class="stash-dots3"><i></i><i></i><i></i></span>Organizing your memory...</div>';
        try {
            await ensureAI(true);
            const groups = clusterItems(allStashs).filter((c) => c.length >= 2).sort((a, b) => b.length - a.length);
            collections = nameClusters(groups).slice(0, 10);
            renderCollections();
        } catch (err) {
            console.error('[stash] organize failed', err);
            ovCollections.innerHTML = '<div class="ov-empty">Could not organize right now. Open the console and send me the error.</div>';
        } finally {
            collecting = false;
        }
    }

    function renderCollections() {
        if (allStashs.length < 6) {
            reorganizeBtn.classList.add('hidden');
            ovCollections.innerHTML = '<div class="ov-empty">Save a handful more and Stash sorts your memory into collections automatically.</div>';
            return;
        }
        if (!proActive) {
            reorganizeBtn.classList.add('hidden');
            ovCollections.innerHTML = '<div class="ov-empty">Auto-organize groups your memory into themed collections, on your device. Turn on Pro (top right) to use it.</div>';
            return;
        }
        if (!collections) {
            reorganizeBtn.classList.add('hidden');
            ovCollections.innerHTML = '<button id="ov-organize-btn" class="ov-coll-cta">Organize my memory into collections</button>';
            const b = document.getElementById('ov-organize-btn');
            if (b) b.addEventListener('click', buildCollections);
            return;
        }
        if (!collections.length) {
            reorganizeBtn.classList.remove('hidden');
            ovCollections.innerHTML = '<div class="ov-empty">Your memories are varied so far. Save a few more on related topics and clear collections will form.</div>';
            return;
        }
        reorganizeBtn.classList.remove('hidden');
        ovCollections.innerHTML = collections.map((c, i) => {
            const dots = c.items.slice(0, 5).map((it) => `<span class="nav-dot src-${sourceOf(it)}"></span>`).join('');
            const sample = c.items.slice(0, 2).map((it) => escapeHtml((it.title || it.data?.[0]?.content || 'Untitled').slice(0, 38))).join('  ·  ');
            return `<button class="ov-coll" data-i="${i}" style="animation-delay:${Math.min(i, 8) * 40}ms">
                <div class="ov-coll-top"><span class="ov-coll-name">${escapeHtml(c.name)}</span><span class="ov-coll-n">${c.items.length}</span></div>
                <div class="ov-coll-dots">${dots}</div>
                <div class="ov-coll-sample">${sample}</div></button>`;
        }).join('');
        ovCollections.querySelectorAll('.ov-coll').forEach((b) => b.addEventListener('click', () => {
            const c = collections[+b.dataset.i];
            if (c) renderCollectionItems(c);
        }));
    }

    function renderCollectionItems(coll) {
        if (mode === 'ask') setMode('filter');
        searchInput.value = '';
        sidebarList.innerHTML = '';
        visibleItems = [];
        const group = document.createElement('div');
        group.className = 'timeline-group';
        group.innerHTML = `<div class="timeline-label">Collection &middot; ${escapeHtml(coll.name)}</div>`;
        coll.items.forEach((item, idx) => {
            visibleItems.push(item);
            const raw = item.title || item.data[0]?.content || 'Untitled';
            const title = raw.substring(0, 60) + (raw.length > 60 ? '...' : '');
            const el = document.createElement('div');
            el.className = 'nav-item';
            el.style.animationDelay = `${Math.min(idx, 14) * 22}ms`;
            el.innerHTML = `<div class="nav-item-row"><span class="nav-dot src-${sourceOf(item)}"></span><div class="nav-item-title">${escapeHtml(title)}</div></div><div class="nav-item-meta">${metaFor(item)}</div>`;
            el.addEventListener('click', () => openItem(item));
            group.appendChild(el);
        });
        sidebarList.appendChild(group);
        if (coll.items[0]) openItem(coll.items[0]);
    }

    function countSince(nDays) { const cut = Date.now() - nDays * 86400000; return allStashs.filter((it) => +new Date(it.timestamp) >= cut).length; }
    function currentStreak(perDay) {
        let streak = 0; const d = new Date(); d.setHours(0, 0, 0, 0);
        if (!perDay[dayKey(d)]) d.setDate(d.getDate() - 1); // today not required to keep a streak alive
        while (perDay[dayKey(d)]) { streak++; d.setDate(d.getDate() - 1); }
        return streak;
    }

    function showOverview() {
        currentActiveStash = null;
        chatView.classList.add('hidden');
        answerView.classList.add('hidden');
        overview.classList.remove('hidden');
        overview.classList.remove('view-in'); void overview.offsetWidth; overview.classList.add('view-in');
        renderOverview();
        renderSidebar(searchInput.value);
    }

    function renderOverview() {
        const total = allStashs.length;
        const chats = allStashs.filter((i) => !isPage(i)).length;
        const pages = total - chats;
        const perDay = {};
        allStashs.forEach((it) => { const k = dayKey(it.timestamp); perDay[k] = (perDay[k] || 0) + 1; });

        // identity
        if (!total) {
            ovIdentity.textContent = 'Save your first chat or page, and your memory profile starts filling in here.';
        } else {
            const topics = topTopics(3).map((t) => t.label);
            const firstTs = allStashs.reduce((min, it) => Math.min(min, +new Date(it.timestamp)), Infinity);
            const days = Math.max(1, Math.round((Date.now() - firstTs) / 86400000));
            const srcCount = {};
            allStashs.forEach((it) => { const s = sourceLabel(it); srcCount[s] = (srcCount[s] || 0) + 1; });
            const topSrc = Object.entries(srcCount).sort((a, b) => b[1] - a[1])[0]?.[0];
            let line = `You have kept ${total} thing${total === 1 ? '' : 's'} over the last ${days} day${days === 1 ? '' : 's'}.`;
            if (topics.length) line += ` Lately you lean toward ${listify(topics)}.`;
            if (topSrc) line += ` Most of it comes from ${topSrc}.`;
            ovIdentity.textContent = line;
        }

        // stat cards
        const stats = [
            { n: total, l: 'saved' },
            { n: chats, l: 'chats' },
            { n: pages, l: 'pages' },
            { n: countSince(7), l: 'this week' },
            { n: currentStreak(perDay), l: 'day streak' },
        ];
        ovStats.innerHTML = stats.map((c) => `<div class="ov-stat"><span class="ov-stat-n">${c.n}</span><span class="ov-stat-l">${c.l}</span></div>`).join('');

        renderHeatmap(perDay);

        // topics
        const topics = topTopics(14);
        if (!topics.length) {
            ovTopics.innerHTML = '<span class="ov-empty">Save and tag a few things, and the topics you keep show up here.</span>';
        } else {
            ovTopics.innerHTML = topics.map((t) => `<button class="ov-topic" data-q="${escapeHtml(t.label)}">${escapeHtml(t.label)} <span>${t.count}</span></button>`).join('');
            ovTopics.querySelectorAll('.ov-topic').forEach((b) => b.addEventListener('click', () => {
                if (mode === 'ask') setMode('filter');
                searchInput.value = b.dataset.q;
                renderSidebar(b.dataset.q);
                searchInput.focus();
            }));
        }

        // jump back in
        const card = document.getElementById('ov-revisit-card');
        const recent = [...allStashs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 4);
        if (!recent.length) { card.classList.add('hidden'); } else {
            card.classList.remove('hidden');
            ovRevisit.innerHTML = recent.map((it) => {
                const title = (it.title || it.data[0]?.content || 'Untitled').slice(0, 56);
                return `<button class="ov-rev" data-id="${it.id || it.timestamp}"><span class="nav-dot src-${sourceOf(it)}"></span><span class="ov-rev-t">${escapeHtml(title)}</span><span class="ov-rev-m">${metaFor(it)}</span></button>`;
            }).join('');
            ovRevisit.querySelectorAll('.ov-rev').forEach((b) => b.addEventListener('click', () => {
                const it = allStashs.find((x) => (x.id || x.timestamp) === b.dataset.id);
                if (it) openItem(it);
            }));
        }

        renderCollections();
    }

    if (reorganizeBtn) reorganizeBtn.addEventListener('click', () => { collections = null; buildCollections(); });

    // GitHub-style contribution heatmap of saves per day over the last ~year.
    function renderHeatmap(perDay) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const end = new Date(today); end.setDate(end.getDate() + (6 - end.getDay())); // Saturday of this week
        const WEEKS = 53;
        const start = new Date(end); start.setDate(start.getDate() - (WEEKS * 7 - 1));
        let max = 0; Object.values(perDay).forEach((v) => { if (v > max) max = v; });
        const level = (c) => { if (!c) return 0; if (max <= 1) return 3; const r = c / max; return r > 0.66 ? 4 : r > 0.33 ? 3 : 2; };
        const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let cols = '';
        let labels = '';
        let lastMonth = -1;
        for (let w = 0; w < WEEKS; w++) {
            const colDate = new Date(start); colDate.setDate(start.getDate() + w * 7);
            const m = colDate.getMonth();
            labels += `<span class="heat-mlabel">${(m !== lastMonth && colDate.getDate() <= 7) ? MONTHS[m] : ''}</span>`;
            if (m !== lastMonth && colDate.getDate() <= 7) lastMonth = m;
            let cells = '';
            for (let dow = 0; dow < 7; dow++) {
                const cell = new Date(start); cell.setDate(start.getDate() + w * 7 + dow);
                if (cell > today) { cells += '<i class="heat-cell future"></i>'; continue; }
                const c = perDay[dayKey(cell)] || 0;
                cells += `<i class="heat-cell lvl${level(c)}" title="${c} saved on ${dayKey(cell)}"></i>`;
            }
            cols += `<div class="heat-col">${cells}</div>`;
        }
        ovHeatmap.innerHTML = `<div class="heat-months">${labels}</div><div class="heat-grid">${cols}</div>`;
        const totalSaves = Object.values(perDay).reduce((a, b) => a + b, 0);
        ovHeatSub.textContent = `${totalSaves} saved in the last year`;
    }

    function presentSources() {
        const set = new Set(allStashs.filter((i) => !isPage(i)).map(sourceOf));
        return ['chatgpt', 'claude', 'gemini'].filter((s) => set.has(s));
    }

    function renderTypeFilters() {
        typeFilters.innerHTML = '';
        if (allStashs.length === 0) return;
        const chip = (label, active, onClick) => {
            const el = document.createElement('button');
            el.className = `filter-chip ${active ? 'active' : ''}`;
            el.textContent = label;
            el.onclick = onClick;
            return el;
        };
        const hasPages = allStashs.some(isPage);
        typeFilters.appendChild(chip('All', typeFilter === 'all' && !sourceFilter, () => { typeFilter = 'all'; sourceFilter = null; refresh(); }));
        typeFilters.appendChild(chip('Chats', typeFilter === 'chat' && !sourceFilter, () => { typeFilter = 'chat'; sourceFilter = null; refresh(); }));
        if (hasPages) typeFilters.appendChild(chip('Pages', typeFilter === 'page', () => { typeFilter = 'page'; sourceFilter = null; refresh(); }));
        presentSources().forEach((s) => {
            typeFilters.appendChild(chip(SOURCE_LABELS[s], sourceFilter === s, () => { sourceFilter = sourceFilter === s ? null : s; typeFilter = 'all'; refresh(); }));
        });
    }

    function refresh() {
        renderTypeFilters();
        renderTagFilters();
        renderSidebar(searchInput.value);
    }

    function renderTagFilters() {
        tagFilterContainer.innerHTML = '';
        const tags = new Set();
        allStashs.forEach((r) => { if (r.tags) r.tags.forEach((t) => tags.add(t)); });
        if (tags.size === 0) return;
        tags.forEach((tag) => {
            const chip = document.createElement('div');
            chip.className = `tag-chip ${selectedTag === tag ? 'active' : ''}`;
            chip.textContent = `#${tag}`;
            chip.onclick = () => { selectedTag = selectedTag === tag ? null : tag; refresh(); };
            tagFilterContainer.appendChild(chip);
        });
    }

    function matchesFilters(item, query) {
        if (typeFilter === 'chat' && isPage(item)) return false;
        if (typeFilter === 'page' && !isPage(item)) return false;
        if (sourceFilter && sourceOf(item) !== sourceFilter) return false;
        if (selectedTag && !(item.tags && item.tags.includes(selectedTag))) return false;
        if (query) {
            const q = query.toLowerCase();
            const inTitle = item.title?.toLowerCase().includes(q);
            const inBody = item.data.some((m) => m.content.toLowerCase().includes(q));
            if (!inTitle && !inBody) return false;
        }
        return true;
    }

    function groupStashs(stashs) {
        const groups = { 'Today': [], 'Yesterday': [], 'This Week': [], 'Older': [] };
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
        const week = new Date(today); week.setDate(week.getDate() - 7);
        stashs.forEach((item) => {
            const d = new Date(item.timestamp);
            if (d >= today) groups['Today'].push(item);
            else if (d >= yesterday) groups['Yesterday'].push(item);
            else if (d >= week) groups['This Week'].push(item);
            else groups['Older'].push(item);
        });
        return groups;
    }

    function renderSidebar(query = '') {
        if (mode === 'ask') { renderAskList(); return; }
        sidebarList.innerHTML = '';
        visibleItems = [];
        const filtered = allStashs.filter((item) => matchesFilters(item, query));

        if (filtered.length === 0) {
            sidebarList.innerHTML = '<div class="nav-empty">No matches</div>';
            return;
        }

        const grouped = groupStashs(filtered);
        let idx = 0;
        Object.keys(grouped).forEach((groupName) => {
            if (grouped[groupName].length === 0) return;
            const groupEl = document.createElement('div');
            groupEl.className = 'timeline-group';
            groupEl.innerHTML = `<div class="timeline-label">${groupName}</div>`;

            grouped[groupName].forEach((item) => {
                visibleItems.push(item);
                const raw = item.title || item.data[0]?.content || 'Untitled';
                const title = raw.substring(0, 60) + (raw.length > 60 ? '...' : '');
                const navItem = document.createElement('div');
                const active = currentActiveStash && (currentActiveStash.id ? currentActiveStash.id === item.id : currentActiveStash.timestamp === item.timestamp);
                navItem.className = `nav-item ${active ? 'active' : ''}`;
                navItem.style.animationDelay = `${Math.min(idx, 14) * 22}ms`;
                navItem.innerHTML = `
                    <div class="nav-item-row">
                        <span class="nav-dot src-${sourceOf(item)}" title="${isPage(item) ? 'Web page' : sourceLabel(item)}"></span>
                        <div class="nav-item-title">${escapeHtml(title)}</div>
                    </div>
                    <div class="nav-item-meta">${metaFor(item)}</div>`;
                navItem.addEventListener('click', () => { openItem(item, query); });
                groupEl.appendChild(navItem);
                idx++;
            });
            sidebarList.appendChild(groupEl);
        });
    }

    function openItem(item, query = '') {
        currentActiveStash = item;
        cursor = visibleItems.findIndex((i) => i === item);
        renderChat(item);
        renderSidebar(query);
    }

    function renderChat(stash) {
        overview.classList.add('hidden');
        answerView.classList.add('hidden');
        chatView.classList.remove('hidden');
        chatView.classList.remove('view-in'); void chatView.offsetWidth; chatView.classList.add('view-in');

        const displayTitle = stash.title || stash.data[0]?.content || 'Untitled';
        activeChatTitle.textContent = displayTitle.substring(0, 100) + (displayTitle.length > 100 ? '...' : '');
        const when = new Date(stash.timestamp).toLocaleString();
        activeChatDate.textContent = isPage(stash) ? `${sourceLabel(stash)} • ${domainOf(stash)} • ${when}` : `${sourceLabel(stash)} • ${when}`;
        continueBtn.textContent = isPage(stash) ? 'Open original' : 'Resume (New Chat)';

        renderTags(stash);

        if (proActive || stash.summary) {
            chatSummary.classList.remove('hidden');
            summaryText.textContent = stash.summary || '';
            summaryText.classList.toggle('hidden', !stash.summary);
            if (genSummaryBtn) { genSummaryBtn.classList.toggle('hidden', !proActive); genSummaryBtn.textContent = stash.summary ? 'Re-summarize' : 'Summarize'; }
            if (suggestedTags) suggestedTags.innerHTML = '';
        } else {
            chatSummary.classList.add('hidden');
        }

        messagesContainer.innerHTML = '';
        messagesContainer.appendChild(chatSummary);

        stash.data.forEach((msg, i) => {
            const highlighted = stash.highlights && stash.highlights.includes(i);
            const block = document.createElement('div');
            block.className = `message-block ${highlighted ? 'highlighted' : ''} ${msg.role === 'user' ? 'is-user' : ''}`;
            block.innerHTML = `
                <div class="highlight-btn" title="Mark as insight">★</div>
                <div class="message-label">${roleLabel(msg.role)}</div>
                <div class="message-text ${msg.role === 'assistant' ? 'assistant-text' : ''}">${renderMarkdown(msg.content)}</div>`;
            block.querySelector('.highlight-btn').onclick = () => toggleHighlight(stash, i);
            messagesContainer.appendChild(block);
        });
        messagesContainer.scrollTop = 0;
    }

    function toggleHighlight(stash, index) {
        if (!stash.highlights) stash.highlights = [];
        const i = stash.highlights.indexOf(index);
        if (i > -1) stash.highlights.splice(i, 1); else stash.highlights.push(index);
        chrome.storage.local.set({ stashs: allStashs }, () => renderChat(stash));
    }

    function renderTags(stash) {
        activeTags.innerHTML = '';
        if (stash.tags) stash.tags.forEach((tag) => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip-mini';
            chip.textContent = `#${tag}`;
            chip.title = 'Remove tag';
            chip.onclick = () => {
                stash.tags = stash.tags.filter((t) => t !== tag);
                chrome.storage.local.set({ stashs: allStashs }, () => { renderTags(stash); renderTagFilters(); });
            };
            activeTags.appendChild(chip);
        });
    }

    // Inline tag add (replaces prompt())
    addTagBtn.addEventListener('click', () => {
        if (!currentActiveStash || addTagBtn.dataset.editing) return;
        addTagBtn.dataset.editing = '1';
        const input = document.createElement('input');
        input.className = 'tag-input';
        input.placeholder = 'tag, then Enter';
        addTagBtn.replaceWith(input);
        input.focus();
        const done = (commit) => {
            if (commit) {
                const clean = input.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                if (clean) {
                    if (!currentActiveStash.tags) currentActiveStash.tags = [];
                    if (!currentActiveStash.tags.includes(clean)) currentActiveStash.tags.push(clean);
                    chrome.storage.local.set({ stashs: allStashs }, () => { renderTags(currentActiveStash); renderTagFilters(); });
                }
            }
            input.replaceWith(addTagBtn);
            delete addTagBtn.dataset.editing;
        };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); });
        input.addEventListener('blur', () => done(true));
    });

    // ---- search + keyboard nav --------------------------------------------
    let askTimer = null;
    searchInput.addEventListener('input', (e) => {
        const v = e.target.value;
        if (mode === 'ask') { clearTimeout(askTimer); askTimer = setTimeout(() => runAsk(v), 350); }
        else { renderSidebar(v); }
    });

    document.addEventListener('keydown', (e) => {
        const typing = document.activeElement === searchInput || document.activeElement?.classList?.contains('tag-input');
        if (e.key === '/' && !typing) { e.preventDefault(); searchInput.focus(); return; }
        if (e.key === 'Escape') { if (typing) { searchInput.blur(); } searchInput.value = ''; renderSidebar(''); return; }
        if (typing) return;
        if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); move(1); }
        else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
        else if (e.key === 'Enter' && cursor >= 0 && visibleItems[cursor]) { openItem(visibleItems[cursor], searchInput.value); }
    });
    function move(delta) {
        if (!visibleItems.length) return;
        cursor = Math.max(0, Math.min(visibleItems.length - 1, cursor + delta));
        openItem(visibleItems[cursor], searchInput.value);
        const node = sidebarList.querySelectorAll('.nav-item')[cursor];
        if (node) node.scrollIntoView({ block: 'nearest' });
    }

    // ---- resume / delete / export -----------------------------------------
    continueBtn.addEventListener('click', () => {
        if (!currentActiveStash) return;
        if (isPage(currentActiveStash)) { if (currentActiveStash.url) window.open(currentActiveStash.url, '_blank'); return; }
        const context = 'CONTEXT FROM PREVIOUS CONVERSATION:\n' + convertToMarkdown(currentActiveStash) +
            '\n\n--- END OF CONTEXT ---\nPlease resume this conversation based on the history above.';
        const dest = RESUME_URLS[sourceOf(currentActiveStash)] || 'https://chatgpt.com/';
        chrome.storage.local.set({ pending_resume_context: context }, () => window.open(dest, '_blank'));
    });

    deleteBtn.addEventListener('click', () => {
        if (!currentActiveStash) return;
        if (!confirm('Delete this from your stash?')) return;
        const key = currentActiveStash.id || currentActiveStash.timestamp;
        allStashs = allStashs.filter((r) => (r.id || r.timestamp) !== key);
        collections = null; // memory changed: collections need rebuilding
        // keep the ask list and embedding index in sync so it does not reappear
        if (askResults) askResults = askResults.filter((r) => (r.item.id || r.item.timestamp) !== key);
        if (currentActiveStash.id && embIndex[currentActiveStash.id]) {
            delete embIndex[currentActiveStash.id];
            chrome.storage.local.set({ embeddings: embIndex });
        }
        chrome.storage.local.set({ stashs: allStashs }, () => {
            refresh(); showOverview();
        });
    });

    function convertToMarkdown(stash) {
        let md = `# ${stash.title || 'Stash Export'}\n\n*Source: ${stash.url || 'N/A'}*\n*Saved: ${new Date(stash.timestamp).toLocaleString()}*\n\n---\n\n`;
        stash.data.forEach((msg) => { md += `### ${roleLabel(msg.role)}\n\n${msg.content}\n\n`; });
        return md;
    }

    copyBtn.addEventListener('click', () => {
        if (!currentActiveStash) return;
        navigator.clipboard.writeText(convertToMarkdown(currentActiveStash)).then(() => {
            const t = copyBtn.textContent; copyBtn.textContent = 'Copied'; copyBtn.classList.add('ok');
            setTimeout(() => { copyBtn.textContent = t; copyBtn.classList.remove('ok'); }, 1600);
        });
    });

    exportMDBtn.addEventListener('click', () => {
        if (!currentActiveStash) return;
        download(convertToMarkdown(currentActiveStash), 'text/markdown',
            `${(currentActiveStash.title || 'stash').replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)}-${new Date().toISOString().slice(0, 10)}.md`);
    });

    exportAllBtn.addEventListener('click', () => {
        download(JSON.stringify(allStashs, null, 2), 'application/json', `stash-backup-${new Date().toISOString().slice(0, 10)}.json`);
    });

    // Import / restore a backup. Additive merge (dedup by id/timestamp) so it
    // never overwrites what is already there. The archive is now safe to rebuild
    // on a fresh install, which is the whole point of trusting it with your memory.
    importAllBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                const incoming = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.stashs) ? parsed.stashs : null);
                if (!incoming) throw new Error('not a stash backup');
                const keys = new Set(allStashs.map((r) => r.id || r.timestamp));
                let added = 0, skipped = 0;
                for (const it of incoming) {
                    if (!it || !Array.isArray(it.data)) { skipped++; continue; }
                    if (!it.id) it.id = `${it.timestamp || new Date().toISOString()}-${Math.random().toString(36).slice(2, 7)}`;
                    const key = it.id || it.timestamp;
                    if (keys.has(key)) { skipped++; continue; }
                    keys.add(key);
                    allStashs.push(it);
                    added++;
                }
                allStashs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                collections = null; // new memories: rebuild collections on next organize
                chrome.storage.local.set({ stashs: allStashs }, () => {
                    refresh(); renderOverview();
                    alert(added ? `Imported ${added} item${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} already present` : ''}.` : 'Nothing new to import. Everything in that file is already in your stash.');
                });
            } catch (_err) {
                alert('That does not look like a Stash backup file (.json exported from Stash).');
            }
            importFile.value = '';
        };
        reader.readAsText(file);
    });

    function download(content, type, name) {
        const url = URL.createObjectURL(new Blob([content], { type }));
        const a = document.createElement('a'); a.href = url; a.download = name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // ===================== Pro: on-device AI =====================
    function setAiStatus(msg) {
        if (!msg) { aiStatus.classList.add('hidden'); aiStatus.textContent = ''; return; }
        aiStatus.classList.remove('hidden'); aiStatus.textContent = msg;
    }

    const licensed = () => window.StashLicense && window.StashLicense.configured();

    function updateProUI() {
        if (proActive) proToggle.textContent = 'Pro: active';
        else proToggle.textContent = licensed() ? 'Activate Pro' : 'Pro: off';
        proToggle.classList.toggle('on', proActive);
        searchMode.querySelectorAll('.pro-tag').forEach((t) => t.classList.toggle('unlocked', proActive));
    }

    function openLicense() {
        licenseMsg.classList.add('hidden'); licenseMsg.textContent = '';
        licensePanel.classList.remove('hidden');
        licenseKey.value = '';
        licenseKey.focus();
    }
    function closeLicense() { licensePanel.classList.add('hidden'); }

    function setProActive(on) {
        proActive = on;
        if (!on && mode === 'ask') setMode('filter');
        updateProUI();
        if (currentActiveStash) renderChat(currentActiveStash);
    }

    proToggle.addEventListener('click', () => {
        if (!licensed()) {
            // No Gumroad product configured yet: keep the dev switch for testing.
            chrome.storage.local.set({ pro_active: !proActive });
            setProActive(!proActive);
            return;
        }
        if (proActive) {
            if (confirm('Remove your Pro license from this device? Your saved memory stays; the AI features turn off.')) {
                window.StashLicense.clear().then(() => setProActive(false));
            }
        } else {
            openLicense();
        }
    });

    if (licenseCancel) licenseCancel.addEventListener('click', closeLicense);
    if (licenseActivate) licenseActivate.addEventListener('click', async () => {
        const key = licenseKey.value;
        licenseActivate.disabled = true; licenseActivate.textContent = 'Checking...';
        licenseMsg.classList.add('hidden');
        const res = await window.StashLicense.verify(key);
        licenseActivate.disabled = false; licenseActivate.textContent = 'Activate';
        if (res.ok) {
            closeLicense();
            setProActive(true);
            setAiStatus(res.email ? `Pro active. Thanks${res.email ? `, ${res.email}` : ''}.` : 'Pro active. Welcome in.');
        } else {
            licenseMsg.textContent = res.error || 'Could not activate.';
            licenseMsg.classList.remove('hidden');
        }
    });
    if (licenseKey) licenseKey.addEventListener('keydown', (e) => { if (e.key === 'Enter') licenseActivate.click(); else if (e.key === 'Escape') closeLicense(); });

    function setMode(next) {
        mode = next;
        searchMode.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === next));
        searchInput.placeholder = next === 'ask' ? 'Ask your stash anything...' : 'Search your stash...';
        if (next === 'filter') { askResults = null; setAiStatus(''); if (!answerView.classList.contains('hidden')) showOverview(); renderSidebar(searchInput.value); }
        else if (searchInput.value.trim()) runAsk(searchInput.value);
        else { askResults = null; renderSidebar(''); }
    }

    searchMode.addEventListener('click', (e) => {
        const btn = e.target.closest('.mode-btn'); if (!btn) return;
        if (btn.dataset.mode === 'ask' && !proActive) { setAiStatus('Ask is a Pro feature. Turn on Pro to search by meaning.'); return; }
        setMode(btn.dataset.mode);
    });

    async function ensureAI(buildIdx) {
        if (!ai) { setAiStatus('Loading on-device model (first time only)...'); ai = await import(chrome.runtime.getURL('ai.bundle.js')); }
        if (buildIdx) {
            const { index, added } = await ai.buildIndex(allStashs, embIndex, (n, t) => setAiStatus(`Indexing your stash ${n}/${t}...`));
            if (added) { embIndex = index; chrome.storage.local.set({ embeddings: embIndex }); }
        }
        setAiStatus('');
    }

    let askSeq = 0;
    async function runAsk(query) {
        if (!query.trim()) { askResults = null; answerView.classList.add('hidden'); renderSidebar(''); if (!currentActiveStash) showOverview(); return; }
        const seq = ++askSeq;
        try {
            await ensureAI(true);
            askResults = await ai.search(query, allStashs, embIndex, 25);
            if (seq !== askSeq) return; // a newer query superseded this one
            renderAskList();
            if (!askResults.length) { showAnswer(query); renderAnswer(null, query, true); return; }
            showAnswer(query);
            renderAnswer(null, query, false); // loading state
            const top = askResults.slice(0, 5).map((r) => r.item);
            const ans = await ai.answer(query, top);
            if (seq !== askSeq) return;
            renderAnswer(ans, query, false);
        } catch (err) {
            console.error('[stash] ask failed', err);
            setAiStatus('On-device model could not load. Open the console and send me the error.');
        }
    }

    function showAnswer(query) {
        overview.classList.add('hidden');
        chatView.classList.add('hidden');
        answerView.classList.remove('hidden');
        answerView.classList.remove('view-in'); void answerView.offsetWidth; answerView.classList.add('view-in');
        answerQuery.textContent = query;
    }

    // Render the assembled answer: relevant passages, each citing its source.
    function renderAnswer(ans, query, empty) {
        answerQuery.textContent = query;
        if (empty) {
            answerPassages.innerHTML = '<div class="ov-empty">Nothing in your memory speaks to that yet. Try different words, or save a few more things.</div>';
            answerSources.innerHTML = '';
            return;
        }
        if (!ans) {
            answerPassages.innerHTML = '<div class="answer-loading"><span class="stash-dots3"><i></i><i></i><i></i></span>Reading across your memory...</div>';
            answerSources.innerHTML = '';
            return;
        }
        if (!ans.passages.length) {
            answerPassages.innerHTML = '<div class="ov-empty">Your top matches did not have a clear passage for that. The closest memories are in the list on the left.</div>';
        } else {
            answerPassages.innerHTML = ans.passages.map((p, i) => {
                const title = (p.item.title || p.item.data?.[0]?.content || 'Untitled').slice(0, 54);
                return `<div class="answer-passage" style="animation-delay:${Math.min(i, 8) * 50}ms">
                    <p class="answer-text">${escapeHtml(p.text)}</p>
                    <button class="answer-cite" data-id="${p.item.id || p.item.timestamp}">
                        <span class="nav-dot src-${sourceOf(p.item)}"></span>${escapeHtml(title)}</button></div>`;
            }).join('');
            answerPassages.querySelectorAll('.answer-cite').forEach((b) => b.addEventListener('click', () => {
                const it = allStashs.find((x) => (x.id || x.timestamp) === b.dataset.id);
                if (it) openItem(it);
            }));
        }
        answerSources.innerHTML = (ans.sources || []).map((it) => {
            const title = (it.title || it.data?.[0]?.content || 'Untitled').slice(0, 56);
            return `<button class="answer-source" data-id="${it.id || it.timestamp}"><span class="nav-dot src-${sourceOf(it)}"></span><span class="answer-source-t">${escapeHtml(title)}</span><span class="ov-rev-m">${metaFor(it)}</span></button>`;
        }).join('');
        answerSources.querySelectorAll('.answer-source').forEach((b) => b.addEventListener('click', () => {
            const it = allStashs.find((x) => (x.id || x.timestamp) === b.dataset.id);
            if (it) openItem(it);
        }));
    }

    function renderAskList() {
        sidebarList.innerHTML = '';
        visibleItems = [];
        if (!askResults || !askResults.length) { sidebarList.innerHTML = '<div class="nav-empty">No matches yet</div>'; return; }
        const group = document.createElement('div');
        group.className = 'timeline-group';
        group.innerHTML = '<div class="timeline-label">Best matches</div>';
        askResults.forEach((r, idx) => {
            const item = r.item;
            visibleItems.push(item);
            const raw = item.title || item.data[0]?.content || 'Untitled';
            const title = raw.substring(0, 60) + (raw.length > 60 ? '...' : '');
            const pct = Math.min(99, Math.max(0, Math.round(r.score * 100)));
            const active = currentActiveStash && currentActiveStash.id === item.id;
            const el = document.createElement('div');
            el.className = `nav-item ${active ? 'active' : ''}`;
            el.style.animationDelay = `${Math.min(idx, 14) * 22}ms`;
            el.innerHTML = `
                <div class="nav-item-row">
                    <span class="nav-dot src-${sourceOf(item)}"></span>
                    <div class="nav-item-title">${escapeHtml(title)}</div>
                    <span class="match-pct">${pct}%</span>
                </div>
                <div class="nav-item-meta">${metaFor(item)}</div>`;
            el.addEventListener('click', () => openItem(item));
            group.appendChild(el);
        });
        sidebarList.appendChild(group);
    }

    if (genSummaryBtn) genSummaryBtn.addEventListener('click', async () => {
        if (!currentActiveStash) return;
        if (!proActive) { setAiStatus('Summaries are a Pro feature.'); return; }
        const orig = genSummaryBtn.textContent;
        genSummaryBtn.textContent = 'Working...'; genSummaryBtn.disabled = true;
        try {
            await ensureAI(false);
            currentActiveStash.summary = await ai.summarize(currentActiveStash);
            const tags = ai.suggestTags(currentActiveStash);
            chrome.storage.local.set({ stashs: allStashs }, () => { renderChat(currentActiveStash); renderSuggestedTags(tags); });
        } catch (err) {
            console.error('[stash] summarize failed', err);
            setAiStatus('Could not summarize. Open the console and send me the error.');
        } finally {
            genSummaryBtn.disabled = false;
        }
    });

    function renderSuggestedTags(tags) {
        if (!suggestedTags || !currentActiveStash) return;
        suggestedTags.innerHTML = '';
        const have = new Set(currentActiveStash.tags || []);
        const fresh = (tags || []).filter((t) => !have.has(t));
        if (!fresh.length) return;
        const label = document.createElement('span'); label.className = 'suggest-label'; label.textContent = 'Suggested:';
        suggestedTags.appendChild(label);
        fresh.forEach((tag) => {
            const chip = document.createElement('button');
            chip.className = 'suggest-chip'; chip.textContent = `+ ${tag}`;
            chip.onclick = () => {
                if (!currentActiveStash.tags) currentActiveStash.tags = [];
                currentActiveStash.tags.push(tag);
                chrome.storage.local.set({ stashs: allStashs }, () => { renderTags(currentActiveStash); renderTagFilters(); chip.remove(); });
            };
            suggestedTags.appendChild(chip);
        });
    }

    if (homeBtn) homeBtn.addEventListener('click', () => { searchInput.value = ''; if (mode === 'ask') setMode('filter'); showOverview(); });

    loadData();
});
