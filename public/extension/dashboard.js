/**
 * Stash Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const sidebarList = document.getElementById('sidebar-list');
    const searchInput = document.getElementById('dashboard-search');
    const tagFilterContainer = document.getElementById('tag-filter-container');
    const chatView = document.getElementById('chat-view');
    const emptyState = document.getElementById('empty-state');
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
    const exportMDBtn = document.getElementById('export-md');
    const continueBtn = document.getElementById('continue-chat');

    let allStashs = [];
    let currentActiveStash = null;
    let selectedTag = null;

    const SOURCE_LABELS = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', web: 'Web' };
    const RESUME_URLS = { chatgpt: 'https://chatgpt.com/', claude: 'https://claude.ai/new', gemini: 'https://gemini.google.com/app' };
    const isPage = (item) => (item.type || 'chat') === 'page';
    const sourceLabel = (item) => SOURCE_LABELS[item.source] || 'Chat';
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

    // Load data
    function loadData() {
        chrome.storage.local.get({ stashs: [] }, (result) => {
            allStashs = result.stashs;
            renderSidebar();
            renderTagFilters();
        });
    }

    function renderTagFilters() {
        tagFilterContainer.innerHTML = "";
        const tags = new Set();
        allStashs.forEach(r => {
            if (r.tags) r.tags.forEach(t => tags.add(t));
        });

        if (tags.size === 0) return;

        tags.forEach(tag => {
            const chip = document.createElement('div');
            chip.className = `tag-chip ${selectedTag === tag ? 'active' : ''}`;
            chip.textContent = `#${tag}`;
            chip.onclick = () => {
                selectedTag = selectedTag === tag ? null : tag;
                renderTagFilters();
                renderSidebar(searchInput.value);
            };
            tagFilterContainer.appendChild(chip);
        });
    }

    // Helper: Group by Date
    function groupStashs(stashs) {
        const groups = {
            'Today': [],
            'Yesterday': [],
            'This Week': [],
            'Older': []
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        stashs.forEach(item => {
            const date = new Date(item.timestamp);
            if (date >= today) groups['Today'].push(item);
            else if (date >= yesterday) groups['Yesterday'].push(item);
            else if (date >= sevenDaysAgo) groups['This Week'].push(item);
            else groups['Older'].push(item);
        });

        return groups;
    }

    // Render Sidebar (Timeline Mode)
    function renderSidebar(query = "") {
        sidebarList.innerHTML = "";
        
        const filtered = allStashs.filter(item => {
            const matchesQuery = !query || 
                (item.title?.toLowerCase().includes(query.toLowerCase()) || 
                 item.data.some(msg => msg.content.toLowerCase().includes(query.toLowerCase())));
            
            const matchesTag = !selectedTag || (item.tags && item.tags.includes(selectedTag));
            
            return matchesQuery && matchesTag;
        });

        const grouped = groupStashs(filtered);

        Object.keys(grouped).forEach(groupName => {
            if (grouped[groupName].length === 0) return;

            const groupEl = document.createElement('div');
            groupEl.className = 'timeline-group';
            groupEl.innerHTML = `<div class="timeline-label">${groupName}</div>`;

            grouped[groupName].forEach((item) => {
                const displayTitle = item.title || item.data[0]?.content || "Untitled";
                const title = displayTitle.substring(0, 60) + (displayTitle.length > 60 ? "..." : "");

                const navItem = document.createElement('div');
                navItem.className = `nav-item ${currentActiveStash?.timestamp === item.timestamp ? 'active' : ''}`;
                navItem.innerHTML = `
                    <div class="nav-item-title">${title}</div>
                    <div class="nav-item-meta">${metaFor(item)}</div>
                `;
                
                navItem.addEventListener('click', () => {
                    currentActiveStash = item;
                    renderChat(item);
                    renderSidebar(query);
                });

                groupEl.appendChild(navItem);
            });

            sidebarList.appendChild(groupEl);
        });
    }

    // Render Chat
    function renderChat(stash) {
        emptyState.classList.add('hidden');
        chatView.classList.remove('hidden');
        
        const displayTitle = stash.title || stash.data[0]?.content || "Untitled";
        activeChatTitle.textContent = displayTitle.substring(0, 100) + (displayTitle.length > 100 ? "..." : "");
        const when = new Date(stash.timestamp).toLocaleString();
        activeChatDate.textContent = isPage(stash)
            ? `${sourceLabel(stash)} • ${domainOf(stash)} • ${when}`
            : `${sourceLabel(stash)} • ${when}`;
        continueBtn.textContent = isPage(stash) ? 'Open original' : 'Resume (New Chat)';

        renderTags(stash);

        // Handle Summary
        if (stash.summary) {
            chatSummary.classList.remove('hidden');
            summaryText.textContent = stash.summary;
        } else {
            chatSummary.classList.add('hidden');
        }
        
        messagesContainer.innerHTML = "";
        // Re-add Summary container since we cleared innerHTML
        messagesContainer.appendChild(chatSummary);

        stash.data.forEach((msg, idx) => {
            const isHighlighted = stash.highlights && stash.highlights.includes(idx);
            
            const block = document.createElement('div');
            block.className = `message-block ${isHighlighted ? 'highlighted' : ''}`;
            block.innerHTML = `
                <div class="highlight-btn" title="Toggle Insight">★</div>
                <div class="message-label">${roleLabel(msg.role)}</div>
                <div class="message-text ${msg.role === 'assistant' ? 'assistant-text' : ''}">${escapeHtml(msg.content)}</div>
            `;

            block.querySelector('.highlight-btn').onclick = () => toggleHighlight(stash, idx);

            messagesContainer.appendChild(block);
        });
        
        messagesContainer.scrollTop = 0;
    }

    function toggleHighlight(stash, index) {
        if (!stash.highlights) stash.highlights = [];
        const idx = stash.highlights.indexOf(index);
        if (idx > -1) stash.highlights.splice(idx, 1);
        else stash.highlights.push(index);

        chrome.storage.local.set({ stashs: allStashs }, () => {
            renderChat(stash);
        });
    }

    function renderTags(stash) {
        activeTags.innerHTML = "";
        if (stash.tags) {
            stash.tags.forEach(tag => {
                const chip = document.createElement('span');
                chip.className = 'tag-chip-mini';
                chip.textContent = `#${tag}`;
                activeTags.appendChild(chip);
            });
        }
    }

    addTagBtn.addEventListener('click', () => {
        if (!currentActiveStash) return;
        const tag = prompt("Enter tag name (e.g. coding, ideas):");
        if (tag) {
            const cleanTag = tag.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanTag) {
                if (!currentActiveStash.tags) currentActiveStash.tags = [];
                if (!currentActiveStash.tags.includes(cleanTag)) {
                    currentActiveStash.tags.push(cleanTag);
                    chrome.storage.local.set({ stashs: allStashs }, () => {
                        renderTags(currentActiveStash);
                        renderTagFilters();
                    });
                }
            }
        }
    });

    // Search
    searchInput.addEventListener('input', (e) => {
        renderSidebar(e.target.value);
    });

    // Continue in ChatGPT (Resume logic)
    continueBtn.addEventListener('click', () => {
        if (!currentActiveStash) return;

        // A saved page just reopens at its source.
        if (isPage(currentActiveStash)) {
            if (currentActiveStash.url) window.open(currentActiveStash.url, '_blank');
            return;
        }

        const context = "CONTEXT FROM PREVIOUS CONVERSATION:\n" +
                        convertToMarkdown(currentActiveStash) +
                        "\n\n--- END OF CONTEXT ---\n" +
                        "Please resume this conversation based on the history above.";

        // Resume into the same assistant it came from; content.js injects it on load.
        const dest = RESUME_URLS[currentActiveStash.source] || 'https://chatgpt.com/';
        chrome.storage.local.set({ pending_resume_context: context }, () => {
            window.open(dest, '_blank');
        });
    });

    // Delete
    deleteBtn.addEventListener('click', () => {
        if (!currentActiveStash) return;
        if (confirm("Are you sure you want to delete this conversation?")) {
            allStashs = allStashs.filter(r => r.timestamp !== currentActiveStash.timestamp);
            chrome.storage.local.set({ stashs: allStashs }, () => {
                currentActiveStash = null;
                chatView.classList.add('hidden');
                emptyState.classList.remove('hidden');
                renderSidebar(searchInput.value);
            });
        }
    });

    // Helper: Convert to Markdown
    function convertToMarkdown(stash) {
        let md = `# ${stash.title || "Stash Export"}\n\n`;
        md += `*Source: ${stash.url || "N/A"}*\n`;
        md += `*Date: ${new Date(stash.timestamp).toLocaleString()}*\n\n---\n\n`;
        
        stash.data.forEach(msg => {
            md += `### ${msg.role.toUpperCase()}\n\n${msg.content}\n\n`;
        });
        
        return md;
    }

    // Copy as Markdown
    copyBtn.addEventListener('click', () => {
        if (!currentActiveStash) return;
        const mdText = convertToMarkdown(currentActiveStash);
        navigator.clipboard.writeText(mdText).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = "Copied!";
            setTimeout(() => copyBtn.textContent = originalText, 2000);
        });
    });

    // Export as Markdown File
    exportMDBtn.addEventListener('click', () => {
        if (!currentActiveStash) return;
        const mdText = convertToMarkdown(currentActiveStash);
        const blob = new Blob([mdText], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeTitle = (currentActiveStash.title || "stash").replace(/[^a-z0-9]/gi, '-').toLowerCase();
        a.href = url;
        a.download = `${safeTitle}-${new Date().toISOString().slice(0,10)}.md`;
        a.click();
    });

    // Export All (JSON Backup)
    exportAllBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(allStashs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stash-backup-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    });

    loadData();
});
