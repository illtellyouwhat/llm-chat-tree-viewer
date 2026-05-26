(function () {
  // If panel already exists, decide what to do
  const existing = document.getElementById('cttv-panel');
  if (existing) {
    const currentMatch = location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
    const currentId = currentMatch?.[1];
    const loadedId = existing.dataset.conversationId;
    const isVisible = !existing.classList.contains('hidden');

    if (isVisible && currentId === loadedId) {
      // Same conversation, panel open — toggle closed
      existing.classList.add('hidden');
      existing.style.width = '';
      setPageSquish(false);
      return;
    }
    // Otherwise fall through: panel is hidden, or we're on a different conversation.
    // Remove the old panel and rebuild fresh below.
    existing.remove();
  }

  // Build panel shell
  const panel = document.createElement('div');
  panel.id = 'cttv-panel';
  panel.innerHTML = `
    <div id="cttv-resize-handle"></div>
    <div id="cttv-header">
      <div id="cttv-header-text">
        <h1>Chat Tree - View your whole AI chat at once.</h1>
        <p>Click to navigate to that chat turn. Right click for annotation options. Shift-click to select multiple.</p>
      </div>
      <div id="cttv-header-buttons">
        <button id="cttv-add-note" title="Add sticky note">📝</button>
        <button id="cttv-toggle-colorkey" title="Show/hide color key">🎨</button>
        <button id="cttv-settings" title="Settings">⚙</button>
        <button id="cttv-detach" title="Open in separate window">⇱</button>
        <button id="cttv-close">✕</button>
      </div>
    </div>
    <div id="cttv-settings-dialog" class="hidden">
      <div id="cttv-settings-title">Settings<button id="cttv-settings-close">✕</button></div>
      <div class="cttv-settings-section">
        <div class="cttv-settings-label">Appearance</div>
        <div class="cttv-settings-row">
          <label for="cttv-color-user">User turn color</label>
          <input type="color" id="cttv-color-user" value="#99cc99">
        </div>
        <div class="cttv-settings-row">
          <label for="cttv-color-assistant">Assistant turn color</label>
          <input type="color" id="cttv-color-assistant" value="#9999cc">
        </div>
        <button id="cttv-colors-reset">Reset to defaults</button>
        <div class="cttv-settings-row">
          <label for="cttv-user-only">Show user turns only</label>
          <input type="checkbox" id="cttv-user-only">
        </div>
      </div>
      <div class="cttv-settings-section">
        <div class="cttv-settings-label">Annotations</div>
        <button id="cttv-export-btn">⬇ Export annotations...</button>
        <div class="cttv-settings-hint">Saves all annotations across all conversations to a JSON file.</div>
        <button id="cttv-import-btn">⬆ Import annotations...</button>
        <div class="cttv-settings-hint">Merges annotations from a previously exported file.</div>
      </div>
      <div class="cttv-settings-section">
        <div class="cttv-settings-label">Export</div>
        <button id="cttv-export-md-btn">📄 Export as Markdown...</button>
        <div class="cttv-settings-hint">Downloads a .md file. Check below to include only annotated turns (starred, colored, or noted).</div>
        <div class="cttv-settings-row">
          <label for="cttv-md-notes-only">Annotated turns only</label>
          <input type="checkbox" id="cttv-md-notes-only">
        </div>
        <button id="cttv-export-canvas-btn">🗺 Export as Obsidian Canvas...</button>
        <div class="cttv-settings-hint">Full conversation tree. Downloads a .canvas file.</div>
      </div>
      <div id="cttv-settings-status"></div>
    </div>
    <div id="cttv-body">
      <div id="cttv-error"></div>
      <div id="cttv-map"></div>
      <div id="cttv-menu" class="hidden">
        <button data-action="star">⭐ Star</button>
        <div id="cttv-colors">
          <span data-color="#e55" style="color:#e55">●</span>
          <span data-color="#e93" style="color:#e93">●</span>
          <span data-color="#9c9" style="color:#9c9">●</span>
          <span data-color="#69f" style="color:#69f">●</span>
          <span data-color="#c6f" style="color:#c6f">●</span>
          <span data-color="">✕</span>
        </div>
        <button data-action="notes">📝 Notes...</button>
        <button data-action="unimportant">👁 Mark unimportant</button>
      </div>
      <div id="cttv-notes-dialog" class="hidden">
        <div id="cttv-notes-label">Notes for this turn:</div>
        <textarea id="cttv-notes-ta" rows="5"></textarea>
        <label id="cttv-notes-preview-label">
          <input type="checkbox" id="cttv-notes-preview-toggle" checked>
          Show chat text in hover preview
        </label>
        <div id="cttv-notes-buttons">
          <button id="cttv-notes-cancel">Cancel</button>
          <button id="cttv-notes-save">Save</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  function setPageSquish(active) {
    const main = document.querySelector('main');
    if (main) main.style.marginRight = active ? '33vw' : '';
  }
  setPageSquish(true);

  const resizeHandle = document.getElementById('cttv-resize-handle');
  let resizing = false;

  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    resizing = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const newWidth = window.innerWidth - e.clientX;
    const clamped = Math.max(200, Math.min(newWidth, window.innerWidth * 0.8));
    panel.style.width = clamped + 'px';
    const main = document.querySelector('main');
    if (main) main.style.marginRight = clamped + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (resizing) {
      resizing = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
  });


  document.getElementById('cttv-close').addEventListener('click', () => {
    panel.classList.add('hidden');
    panel.style.width = '';
    setPageSquish(false);
  });

  let conversationId = location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/)?.[1] || null;
  panel.dataset.conversationId = conversationId || '';
  let cttvEidToSectionId = {};
  let cttvNodeIdToSectionId = {};
  let cttvConversationData = null;

  document.getElementById('cttv-detach').addEventListener('click', () => {
    const handoff = cttvConversationData
      ? { conversationId, data: cttvConversationData, selectedId: getSelectedId() }
      : {};
    chrome.storage.local.set({ 'cttv-handoff': handoff }, () => {
      if (chrome.runtime.lastError) {
        showError('Could not open detached window: conversation too large for storage.');
        return;
      }
      try { chrome.runtime.sendMessage({ type: 'detach' }); } catch (_) {}
      panel.classList.add('hidden');
      panel.style.width = '';
      setPageSquish(false);
    });
  });

  const { selectNode, loadConversationData, loadAnnotations, applyPrefs, setConversationId, getMapping, getNodes, getTree, getSelectedId, refreshAllNodes, loadCanvasNotes, renderCanvasNotes, loadColorKey, renderColorKey, createNoteFromDrag } = initPanel({
    onNodeClick(nodeId) {
      navigateToNode(nodeId);
    },

    onAnnotationsSaved() {
      // content.js is the ChatGPT tab — no cross-tab notification needed
    },

    onPrefsSaved(prefs) {
      try { chrome.runtime.sendMessage({ type: 'prefsUpdated', prefs }).catch(() => {}); } catch (_) {}
    },

    boot({ loadConversationData, loadAnnotations, applyPrefs, setConversationId, loadCanvasNotes, renderCanvasNotes, loadColorKey, renderColorKey }) {
      // Prefs must be loaded before the first render — merge into one storage read.
      chrome.storage.local.get(['cttv-prefs'], result => {
        applyPrefs(result['cttv-prefs'] || {});
        setConversationId(conversationId);
        if (conversationId) loadAnnotations(() => {
          loadCanvasNotes(() => {
            loadColorKey(() => {
              renderColorKey();
              renderCanvasNotes();
              loadConversation(conversationId);
            });
          });
        });
      });
    },
  });

  if (!conversationId) {
    showError('Please open a ChatGPT conversation to use Chat Tree Viewer.');
  }

  // Maps EID keys ("eid:role") → DOM section data-turn-id.
  // Also populates cttvNodeIdToSectionId: real API node ID → DOM section data-turn-id,
  // which handles "synthetic" sections (data-turn-id = "request-{convId}-{N}") that
  // ChatGPT uses for in-progress or recently-completed responses. Those sections carry
  // the real node ID in a child element's data-message-id attribute.
  function buildEidMap(mapping) {
    const result = {};
    cttvNodeIdToSectionId = {};
    document.querySelectorAll('section[data-turn-id]').forEach(section => {
      const sectionId = section.getAttribute('data-turn-id');
      const domRole = section.getAttribute('data-turn');

      // Resolve which API node this section belongs to
      let apiNodeId = sectionId;
      if (sectionId.startsWith('request-')) {
        // Synthetic section: real node ID is inside data-message-id
        const msgEl = section.querySelector('[data-message-id]');
        if (msgEl) apiNodeId = msgEl.getAttribute('data-message-id');
      }

      const node = mapping[apiNodeId];
      const eid = node?.message?.metadata?.turn_exchange_id;
      if (eid && domRole) result[`${eid}:${domRole}`] = sectionId;
      if (apiNodeId && domRole) cttvNodeIdToSectionId[apiNodeId] = sectionId;
    });
    return result;
  }

  function waitForSections(timeout = 5000) {
    return new Promise(resolve => {
      if (document.querySelector('section[data-turn-id]')) { resolve(); return; }
      const obs = new MutationObserver(() => {
        if (document.querySelector('section[data-turn-id]')) { obs.disconnect(); resolve(); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(); }, timeout);
    });
  }

  // Walk the parsed tree to find the deepest node in the currently visible branch.
  //
  // ChatGPT DOM / API ID relationship (hard-won knowledge):
  //
  // 1. SECTION IDs vs API NODE IDs
  //    Most sections have data-turn-id = the API mapping node ID directly.
  //    However, some sections use a different ID (e.g. older conversations may use EIDs).
  //    During and after streaming, new assistant turns get a SYNTHETIC section ID:
  //      "request-{conversationId}-{N}"
  //    The real API node ID is stored inside: section > [data-message-id].
  //    buildEidMap() resolves this and populates cttvNodeIdToSectionId (nodeId → sectionId).
  //
  // 2. INACTIVE BRANCHES ARE REMOVED FROM THE DOM
  //    ChatGPT React does NOT hide inactive branch sections via CSS (display:none etc).
  //    It removes them from the DOM entirely. So offsetParent checks don't help.
  //    Only the active branch's sections exist in the DOM at any time.
  //
  // 3. BRANCH SIBLINGS SHARE THE SAME EID
  //    When a user edits a message and gets a new response, both the old and new assistant
  //    nodes share the same turn_exchange_id (EID). EID lookup alone cannot distinguish
  //    which sibling is active. Always prefer direct node ID match (cttvNodeIdToSectionId)
  //    over EID match when choosing between siblings at a branch point.
  function findActiveLeaf() {
    const allIds = new Set(
      [...document.querySelectorAll('section[data-turn-id]')].map(s => s.getAttribute('data-turn-id'))
    );

    // True if this tree node has a DOM section (direct match via cttvNodeIdToSectionId,
    // which handles both normal and synthetic section IDs).
    function nodeDirectMatch(n) {
      return !!cttvNodeIdToSectionId[n.id];
    }

    // Fallback: match via EID for nodes whose section ID doesn't equal the API node ID.
    // Only use when no sibling has a direct match — branch siblings share an EID, so
    // EID alone would falsely match the inactive sibling too.
    function nodeEidMatch(n) {
      if (!n.eid) return false;
      const domId = cttvEidToSectionId[`${n.eid}:${n.role}`];
      return !!(domId && allIds.has(domId));
    }

    function walk(n) {
      const children = n.children || [];
      // Prefer direct match over EID match when picking which child to follow.
      const visibleChild = children.find(c => nodeDirectMatch(c))
                        || children.find(c => nodeEidMatch(c));
      if (visibleChild) return walk(visibleChild);
      return (nodeDirectMatch(n) || nodeEidMatch(n)) ? n : null;
    }

    const tree = getTree();
    return tree ? walk(tree) : null;
  }

  function getScrollContainer() {
    const section = document.querySelector('section[data-turn-id]');
    if (!section) return null;
    let el = section.parentElement;
    while (el && el !== document.body) {
      if (getComputedStyle(el).overflowY === 'auto' || getComputedStyle(el).overflowY === 'scroll') return el;
      el = el.parentElement;
    }
    return null;
  }

  async function scrollToTurn(node) {
    const MAX_ATTEMPTS = 5;
    const WAIT_MS = 350;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const domId = cttvEidToSectionId[`${node.eid}:${node.role}`] || node.id;
      const section = document.querySelector(`section[data-turn-id="${domId}"]`);
      const container = getScrollContainer();
      if (!section || !container) return;
      const cRect = container.getBoundingClientRect();
      const sRect = section.getBoundingClientRect();
      if (sRect.top >= cRect.top && sRect.top < cRect.bottom - 100) return;
      const prevScrollTop = container.scrollTop;
      container.scrollTo({
        top: container.scrollTop + (sRect.top - cRect.top) - 60,
        behavior: attempt === 0 ? 'smooth' : 'auto',
      });
      await new Promise(r => setTimeout(r, WAIT_MS));
      if (Math.abs(container.scrollTop - prevScrollTop) < 2) return;
    }
  }

  async function navigateToNode(nodeId) {
    if (!getTree() || !getMapping()) return;
    const targetNode = getNodes()[nodeId];
    if (!targetNode) return;

    document.getElementById('cttv-map').classList.add('cttv-loading');

    // Build full raw ancestor chain (includes system/tool nodes parseTree omitted)
    const chain = [];
    let cur = nodeId;
    while (cur && getMapping()[cur]) {
      chain.unshift(cur);
      cur = getMapping()[cur].parent;
    }

    // Walk top-down, switching branches where needed
    for (const id of chain) {
      const apiNode = getMapping()[id];
      const eid = apiNode?.message?.metadata?.turn_exchange_id;
      const apiRole = apiNode?.message?.author?.role;
      // Use role-qualified EID key; user nodes always get user section, others get assistant section
      const eidRole = apiRole === 'user' ? 'user' : 'assistant';
      const domSectionId = eid ? cttvEidToSectionId[`${eid}:${eidRole}`] : null;
      const inDOM = domSectionId
        ? !!document.querySelector(`section[data-turn-id="${domSectionId}"]`)
        : !!document.querySelector(`section[data-turn-id="${id}"]`);

      if (inDOM) continue;

      // Not in DOM — check if this is a branch point (siblings exist)
      const parent = apiNode?.parent;
      if (!parent) continue;
      const siblings = getMapping()[parent]?.children || [];
      if (siblings.length <= 1) continue;

      // Find which sibling's user section is currently visible (branch buttons are on user sections)
      let visibleSectionEl = null;
      let visibleIdx = -1;
      for (let i = 0; i < siblings.length; i++) {
        const sibEid = getMapping()[siblings[i]]?.message?.metadata?.turn_exchange_id;
        const sibDomId = sibEid ? cttvEidToSectionId[`${sibEid}:user`] : siblings[i];
        const el = sibDomId ? document.querySelector(`section[data-turn-id="${sibDomId}"]`) : null;
        if (el) { visibleSectionEl = el; visibleIdx = i; break; }
      }
      if (!visibleSectionEl) continue;

      const targetIdx = siblings.indexOf(id);
      const btnLabel = targetIdx > visibleIdx ? 'Next response' : 'Previous response';

      for (let attempt = 0; attempt < siblings.length; attempt++) {
        // Target is a user node (siblings are always user nodes)
        const checkEid = getMapping()[id]?.message?.metadata?.turn_exchange_id;
        const checkId = checkEid ? cttvEidToSectionId[`${checkEid}:user`] : id;
        if (checkId && document.querySelector(`section[data-turn-id="${checkId}"]`)) break;

        document.dispatchEvent(new CustomEvent('cttv-click-branch', {
          detail: { selector: visibleSectionEl.getAttribute('data-turn-id'), label: btnLabel }
        }));
        await new Promise(r => setTimeout(r, 500));

        // Rebuild EID map — DOM changed after branch switch
        cttvEidToSectionId = buildEidMap(getMapping());

        // Update visibleSectionEl — always look for user section (has the branch buttons)
        for (let i = 0; i < siblings.length; i++) {
          const sibEid = getMapping()[siblings[i]]?.message?.metadata?.turn_exchange_id;
          const sibDomId = sibEid ? cttvEidToSectionId[`${sibEid}:user`] : siblings[i];
          const el = sibDomId ? document.querySelector(`section[data-turn-id="${sibDomId}"]`) : null;
          if (el) { visibleSectionEl = el; break; }
        }
      }
    }

    // Rebuild EID map one final time before scrolling — ensures we have current DOM state
    cttvEidToSectionId = buildEidMap(getMapping());
    document.getElementById('cttv-map').classList.remove('cttv-loading');
    selectNode(nodeId);
    await scrollToTurn(targetNode);
  }

  function showError(msg) {
    document.getElementById('cttv-error').textContent = msg;
  }

  async function loadConversation(id) {
    showError('');
    document.getElementById('cttv-map').classList.add('cttv-loading');
    try {
      const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
      const session = await sessionRes.json();
      const token = session.accessToken;
      const res = await fetch(`/backend-api/conversation/${id}`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.status === 401 || res.status === 403) {
        showError('You must be logged in to ChatGPT to use Chat Tree Viewer.');
        return;
      }
      if (res.status === 404) {
        showError('Conversation not found. The API path may have changed — check the browser Network tab for the correct endpoint.');
        return;
      }
      if (!res.ok) {
        showError(`Failed to load conversation (HTTP ${res.status}).`);
        return;
      }
      const data = await res.json();
      cttvConversationData = data;
      document.getElementById('cttv-error').textContent = '';
      cttvEidToSectionId = buildEidMap(data.mapping);
      loadConversationData(data, null);  // core handles mapping + tree + render
      document.getElementById('cttv-map').classList.remove('cttv-loading');
      // Wait for ChatGPT to render sections before finding active leaf
      await waitForSections();
      cttvEidToSectionId = buildEidMap(getMapping());
      const activeTreeNode = findActiveLeaf();
      if (activeTreeNode) selectNode(activeTreeNode.id, true);
      // Keep popout in sync — the injected panel and popout must always show identical state.
      // content.js is the source of truth for conversation data and pushes every reload to both.
      try { chrome.runtime.sendMessage({ type: 'conversationReloaded', data, selectedId: activeTreeNode?.id || null }).catch(() => {}); } catch (_) {}
    } catch (e) {
      document.getElementById('cttv-map').classList.remove('cttv-loading');
      showError('Error fetching conversation: ' + e.message);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'navigateTo' && msg.nodeId) {
      navigateToNode(msg.nodeId);
    } else if (msg.type === 'reopenPanel') {
      panel.classList.remove('hidden');
      setPageSquish(true);
      // Full reload so inline panel is always identical to what the popout was showing.
      if (conversationId) loadAnnotations(() => loadConversation(conversationId));
    } else if (msg.type === 'annotationsUpdated') {
      loadAnnotations(() => {
        refreshAllNodes();
      });
    } else if (msg.type === 'prefsUpdated') {
      applyPrefs(msg.prefs);
    }
  });

  // ChatGPT is a SPA — navigating between chats changes the URL without a page reload.
  navigation.addEventListener('navigate', (e) => {
    const url = new URL(e.destination.url);
    if (url.protocol !== 'https:') return;
    const newId = url.pathname.match(/\/c\/([a-zA-Z0-9-]+)/)?.[1];

    // No conversation ID = new chat or home — close panel unless we're already showing an error
    if (!newId) {
      conversationId = null;
      panel.classList.add('hidden');
      panel.style.width = '';
      setPageSquish(false);
      try { chrome.runtime.sendMessage({ type: 'closePanel' }).catch(() => {}); } catch (_) {}
      return;
    }

    if (newId === conversationId) return;

    const panelWasOpen = !panel.classList.contains('hidden');
    try {
      chrome.runtime.sendMessage({ type: 'isPopoutOpen' }, ({ open: popoutOpen } = {}) => {
        conversationId = newId;
        setConversationId(newId);
        if (!panelWasOpen && !popoutOpen) return;
        // Map was open — reload for new conversation.
        // If the popout is open, keep the injected panel hidden — the popout will update
        // via conversationReloaded, maintaining the invariant that only one view is visible.
        panel.dataset.conversationId = newId;
        cttvEidToSectionId = {};
        cttvNodeIdToSectionId = {};
        cttvConversationData = null;
        showError('');
        if (!popoutOpen) {
          panel.classList.remove('hidden');
          setPageSquish(true);
        }
        loadAnnotations(() => {
          loadCanvasNotes(() => {
            loadColorKey(() => {
              renderColorKey();
              renderCanvasNotes();
              loadConversation(newId);
            });
          });
        });
      });
    } catch (_) {}
  });

  // Watch for ChatGPT's "Response complete" announcement in the aria-live status div.
  // This fires exactly once when streaming finishes — no debounce needed.
  const statusEl = document.querySelector('[aria-live="polite"][role="status"]');
  if (statusEl) {
    const statusObserver = new MutationObserver(() => {
      if (statusEl.textContent.trim() === 'Response complete') {
        loadAnnotations(() => loadConversation(conversationId));
      }
    });
    statusObserver.observe(statusEl, { childList: true, subtree: true, characterData: true });
  }

  let lastDragSelection = '';
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection()?.toString()?.trim();
    if (sel) lastDragSelection = sel;
  });

  document.addEventListener('dragstart', (e) => {
    if (e.target?.closest?.('#cttv-panel')) return;

    const anchor = e.target?.closest?.('a');
    if (anchor?.href) {
      const linkText = anchor.textContent?.trim() || anchor.href;
      const md = `[${linkText}](${anchor.href})`;
      e.dataTransfer?.setData('text/plain', md);
      e.dataTransfer?.setData('application/cttv-link', md);
      return;
    }

    const selection = window.getSelection();
    let mdText = '';
    if (selection && selection.rangeCount > 0) {
      const frag = document.createElement('div');
      frag.appendChild(selection.getRangeAt(0).cloneContents());
      mdText = htmlToMarkdown(frag.innerHTML).trim();
    }
    const text = mdText || selection?.toString()?.trim() || lastDragSelection;
    lastDragSelection = '';
    if (!text) return;
    e.dataTransfer?.setData('application/cttv-text', text);
    e.dataTransfer?.setData('text/plain', text);
  });

})();
