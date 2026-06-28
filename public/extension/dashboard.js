/**
 * Recall Dashboard Logic
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

    let allRecalls = [];
    let currentActiveRecall = null;
    let selectedTag = null;

    // Load data
    function loadData() {
        chrome.storage.local.get({ recalls: [] }, (result) => {
            allRecalls = result.recalls;
            renderSidebar();
            renderTagFilters();
        });
    }

    function renderTagFilters() {
        tagFilterContainer.innerHTML = "";
        const tags = new Set();
        allRecalls.forEach(r => {
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
    function groupRecalls(recalls) {
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

        recalls.forEach(item => {
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
        
        const filtered = allRecalls.filter(item => {
            const matchesQuery = !query || 
                (item.title?.toLowerCase().includes(query.toLowerCase()) || 
                 item.data.some(msg => msg.content.toLowerCase().includes(query.toLowerCase())));
            
            const matchesTag = !selectedTag || (item.tags && item.tags.includes(selectedTag));
            
            return matchesQuery && matchesTag;
        });

        const grouped = groupRecalls(filtered);

        Object.keys(grouped).forEach(groupName => {
            if (grouped[groupName].length === 0) return;

            const groupEl = document.createElement('div');
            groupEl.className = 'timeline-group';
            groupEl.innerHTML = `<div class="timeline-label">${groupName}</div>`;

            grouped[groupName].forEach((item) => {
                const displayTitle = item.title || item.data[0]?.content || "Untitled Chat";
                const title = displayTitle.substring(0, 60) + (displayTitle.length > 60 ? "..." : "");
                const date = new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                const navItem = document.createElement('div');
                navItem.className = `nav-item ${currentActiveRecall?.timestamp === item.timestamp ? 'active' : ''}`;
                navItem.innerHTML = `
                    <div class="nav-item-title">${title}</div>
                    <div class="nav-item-meta">${date} • ${item.data.length} messages</div>
                `;
                
                navItem.addEventListener('click', () => {
                    currentActiveRecall = item;
                    renderChat(item);
                    renderSidebar(query);
                });

                groupEl.appendChild(navItem);
            });

            sidebarList.appendChild(groupEl);
        });
    }

    // Render Chat
    function renderChat(recall) {
        emptyState.classList.add('hidden');
        chatView.classList.remove('hidden');
        
        const displayTitle = recall.title || recall.data[0]?.content || "Untitled Chat";
        activeChatTitle.textContent = displayTitle.substring(0, 100) + (displayTitle.length > 100 ? "..." : "");
        activeChatDate.textContent = new Date(recall.timestamp).toLocaleString();
        
        renderTags(recall);

        // Handle Summary
        if (recall.summary) {
            chatSummary.classList.remove('hidden');
            summaryText.textContent = recall.summary;
        } else {
            chatSummary.classList.add('hidden');
        }
        
        messagesContainer.innerHTML = "";
        // Re-add Summary container since we cleared innerHTML
        messagesContainer.appendChild(chatSummary);

        recall.data.forEach((msg, idx) => {
            const isHighlighted = recall.highlights && recall.highlights.includes(idx);
            
            const block = document.createElement('div');
            block.className = `message-block ${isHighlighted ? 'highlighted' : ''}`;
            block.innerHTML = `
                <div class="highlight-btn" title="Toggle Insight">★</div>
                <div class="message-label">${msg.role}</div>
                <div class="message-text ${msg.role === 'assistant' ? 'assistant-text' : ''}">${msg.content}</div>
            `;

            block.querySelector('.highlight-btn').onclick = () => toggleHighlight(recall, idx);

            messagesContainer.appendChild(block);
        });
        
        messagesContainer.scrollTop = 0;
    }

    function toggleHighlight(recall, index) {
        if (!recall.highlights) recall.highlights = [];
        const idx = recall.highlights.indexOf(index);
        if (idx > -1) recall.highlights.splice(idx, 1);
        else recall.highlights.push(index);

        chrome.storage.local.set({ recalls: allRecalls }, () => {
            renderChat(recall);
        });
    }

    function renderTags(recall) {
        activeTags.innerHTML = "";
        if (recall.tags) {
            recall.tags.forEach(tag => {
                const chip = document.createElement('span');
                chip.className = 'tag-chip-mini';
                chip.textContent = `#${tag}`;
                activeTags.appendChild(chip);
            });
        }
    }

    addTagBtn.addEventListener('click', () => {
        if (!currentActiveRecall) return;
        const tag = prompt("Enter tag name (e.g. coding, ideas):");
        if (tag) {
            const cleanTag = tag.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanTag) {
                if (!currentActiveRecall.tags) currentActiveRecall.tags = [];
                if (!currentActiveRecall.tags.includes(cleanTag)) {
                    currentActiveRecall.tags.push(cleanTag);
                    chrome.storage.local.set({ recalls: allRecalls }, () => {
                        renderTags(currentActiveRecall);
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
        if (!currentActiveRecall) return;
        
        const context = "CONTEXT FROM PREVIOUS CONVERSATION:\n" + 
                        convertToMarkdown(currentActiveRecall) + 
                        "\n\n--- END OF CONTEXT ---\n" +
                        "Please resume this conversation based on the history above.";
        
        // Save to storage so content.js can pick it up
        chrome.storage.local.set({ pending_resume_context: context }, () => {
            window.open('https://chatgpt.com/', '_blank');
        });
    });

    // Delete
    deleteBtn.addEventListener('click', () => {
        if (!currentActiveRecall) return;
        if (confirm("Are you sure you want to delete this conversation?")) {
            allRecalls = allRecalls.filter(r => r.timestamp !== currentActiveRecall.timestamp);
            chrome.storage.local.set({ recalls: allRecalls }, () => {
                currentActiveRecall = null;
                chatView.classList.add('hidden');
                emptyState.classList.remove('hidden');
                renderSidebar(searchInput.value);
            });
        }
    });

    // Helper: Convert to Markdown
    function convertToMarkdown(recall) {
        let md = `# ${recall.title || "Recall Export"}\n\n`;
        md += `*Source: ${recall.url || "N/A"}*\n`;
        md += `*Date: ${new Date(recall.timestamp).toLocaleString()}*\n\n---\n\n`;
        
        recall.data.forEach(msg => {
            md += `### ${msg.role.toUpperCase()}\n\n${msg.content}\n\n`;
        });
        
        return md;
    }

    // Copy as Markdown
    copyBtn.addEventListener('click', () => {
        if (!currentActiveRecall) return;
        const mdText = convertToMarkdown(currentActiveRecall);
        navigator.clipboard.writeText(mdText).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = "Copied!";
            setTimeout(() => copyBtn.textContent = originalText, 2000);
        });
    });

    // Export as Markdown File
    exportMDBtn.addEventListener('click', () => {
        if (!currentActiveRecall) return;
        const mdText = convertToMarkdown(currentActiveRecall);
        const blob = new Blob([mdText], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeTitle = (currentActiveRecall.title || "recall").replace(/[^a-z0-9]/gi, '-').toLowerCase();
        a.href = url;
        a.download = `${safeTitle}-${new Date().toISOString().slice(0,10)}.md`;
        a.click();
    });

    // Export All (JSON Backup)
    exportAllBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(allRecalls, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recall-backup-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    });

    loadData();
});
