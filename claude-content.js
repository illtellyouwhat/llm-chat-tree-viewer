(function () {
  // Guard: if panel already exists for this conversation, toggle closed
  const existing = document.getElementById('cttv-panel');
  if (existing) {
    const currentMatch = location.pathname.match(/\/chat\/([a-f0-9-]+)/);
    const currentId = currentMatch?.[1];
    const loadedId = existing.dataset.conversationId;
    const isVisible = !existing.classList.contains('hidden');
    if (isVisible && currentId === loadedId) {
      existing.classList.add('hidden');
      existing.style.width = '';
      setPageSquish(false);
      return;
    }
    existing.remove();
  }

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
        <div class="cttv-export-btn-row">
          <button id="cttv-export-md-btn">📄 Export as Markdown...</button>
          <label class="cttv-inline-check"><input type="checkbox" id="cttv-md-notes-only"> Annotated only</label>
        </div>
        <div class="cttv-settings-hint">Downloads a .md file. Annotated = starred, colored, or noted.</div>
        <div class="cttv-export-btn-row">
          <button id="cttv-export-canvas-btn">🗺 Export as Obsidian Canvas...</button>
          <label class="cttv-inline-check"><input type="checkbox" id="cttv-canvas-notes-only"> Annotated only</label>
        </div>
        <div class="cttv-settings-hint">Downloads a .canvas file. Annotated = starred, colored, or noted.</div>
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

  let conversationId = location.pathname.match(/\/chat\/([a-f0-9-]+)/)?.[1] || null;
  panel.dataset.conversationId = conversationId || '';
  let cttvConversationData = null;
  let streamingObserver = null;

  document.getElementById('cttv-detach').addEventListener('click', () => {
    const handoff = cttvConversationData
      ? { conversationId, data: cttvConversationData, selectedId: getSelectedId(), conversationUrl: claudeAdapter.conversationUrl }
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

  const claudeAdapter = {
    conversationUrl: location.href,

    onNodeClick(nodeId) {
      scrollToTurn(nodeId);
    },

    onAnnotationsSaved() {},

    onPrefsSaved(prefs) {
      try { chrome.runtime.sendMessage({ type: 'prefsUpdated', prefs }).catch(() => {}); } catch (_) {}
    },

    boot({ loadConversationData: _lcd, loadAnnotations, applyPrefs, setConversationId,
           loadCanvasNotes, renderCanvasNotes, loadColorKey, renderColorKey }) {
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
  };
  const {
    selectNode, loadConversationData, loadAnnotations, applyPrefs, setConversationId,
    getSelectedId, refreshAllNodes, loadCanvasNotes, renderCanvasNotes, loadColorKey, renderColorKey,
  } = initPanel(claudeAdapter);

  if (!conversationId) {
    showError('Please open a Claude.ai conversation to use Chat Tree Viewer.');
  }

  function getOrgId() {
    const m = document.cookie.match(/(?:^|;)\s*lastActiveOrg=([^;]+)/);
    return m ? m[1] : null;
  }

  function buildMapping(chatMessages) {
    const mapping = {};
    for (const msg of chatMessages) {
      mapping[msg.uuid] = {
        id: msg.uuid,
        parent: msg.parent_message_uuid || null,
        children: [],
        message: {
          id: msg.uuid,
          author: { role: msg.sender === 'human' ? 'user' : 'assistant' },
          content: { content_type: 'text', parts: [msg.text || ''] },
          metadata: { turn_exchange_id: msg.uuid },
        },
      };
    }
    for (const node of Object.values(mapping)) {
      if (node.parent && mapping[node.parent]) {
        mapping[node.parent].children.push(node.id);
      }
    }
    return mapping;
  }

  function scrollToTurn(nodeId) {
    const el = document.querySelector(`[data-message-uuid="${nodeId}"]`);
    if (!el) return;
    const container = document.querySelector('[data-autoscroll-container="true"]');
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    container.scrollTo({ top: container.scrollTop + (eRect.top - cRect.top) - 60, behavior: 'smooth' });
  }

  function showError(msg) {
    document.getElementById('cttv-error').textContent = msg;
  }

  async function fetchConversation(orgId, convId) {
    try {
      const r = await fetch(`/api/organizations/${orgId}/chat_conversations/${convId}`, { credentials: 'include' });
      if (!r.ok) return null;
      if (!(r.headers.get('content-type') || '').includes('json')) return null;
      return r.json();
    } catch { return null; }
  }

  function watchForStreamingComplete(callback) {
    const container = document.querySelector('[data-autoscroll-container="true"]');
    if (!container) return null;
    const observer = new MutationObserver(() => {
      const streamingEls = container.querySelectorAll('[data-is-streaming]');
      const last = streamingEls[streamingEls.length - 1];
      if (last && last.getAttribute('data-is-streaming') === 'false') {
        if (observer._wasStreaming) {
          observer._wasStreaming = false;
          callback();
        }
      } else if (last && last.getAttribute('data-is-streaming') === 'true') {
        observer._wasStreaming = true;
      }
    });
    observer._wasStreaming = false;
    observer.observe(container, { subtree: true, attributes: true, attributeFilter: ['data-is-streaming'], childList: true });
    return observer;
  }

  async function loadConversation(convId) {
    showError('');
    document.getElementById('cttv-map').classList.add('cttv-loading');
    const orgId = getOrgId();
    if (!orgId) {
      document.getElementById('cttv-map').classList.remove('cttv-loading');
      showError('Could not determine org ID. Try reloading the page.');
      return;
    }
    const data = await fetchConversation(orgId, convId);
    document.getElementById('cttv-map').classList.remove('cttv-loading');
    if (!data) {
      showError('Could not load conversation. You may need to reload or log in again.');
      return;
    }
    const mapping = buildMapping(data.chat_messages);
    cttvConversationData = { mapping };
    loadConversationData(cttvConversationData, data.current_leaf_message_uuid || null);
    try {
      chrome.runtime.sendMessage({
        type: 'conversationReloaded',
        data: cttvConversationData,
        selectedId: data.current_leaf_message_uuid || null,
        conversationUrl: claudeAdapter.conversationUrl,
      }).catch(() => {});
    } catch (_) {}
    // Re-attach streaming observer so the next response triggers a reload
    if (streamingObserver) streamingObserver.disconnect();
    streamingObserver = watchForStreamingComplete(() => {
      if (conversationId) loadConversation(conversationId);
    });
  }

  navigation.addEventListener('navigate', (e) => {
    const url = new URL(e.destination.url);
    if (url.protocol !== 'https:') return;
    const m = url.pathname.match(/\/chat\/([a-f0-9-]+)/);

    if (!m) {
      conversationId = null;
      panel.classList.add('hidden');
      panel.style.width = '';
      setPageSquish(false);
      return;
    }

    if (m[1] === conversationId) return;

    const panelWasOpen = !panel.classList.contains('hidden');
    try {
      chrome.runtime.sendMessage({ type: 'isPopoutOpen' }, ({ open: popoutOpen } = {}) => {
        conversationId = m[1];
        claudeAdapter.conversationUrl = url.href;
        setConversationId(conversationId);
        panel.dataset.conversationId = conversationId;
        cttvConversationData = null;
        showError('');
        if (!panelWasOpen && !popoutOpen) return;
        if (!popoutOpen) {
          panel.classList.remove('hidden');
          setPageSquish(true);
        }
        loadAnnotations(() => {
          loadCanvasNotes(() => {
            loadColorKey(() => {
              renderColorKey();
              renderCanvasNotes();
              loadConversation(conversationId);
            });
          });
        });
      });
    } catch (_) {}
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'navigateTo' && msg.nodeId) {
      selectNode(msg.nodeId, false);
      scrollToTurn(msg.nodeId);
    } else if (msg.type === 'reopenPanel') {
      panel.classList.remove('hidden');
      setPageSquish(true);
      if (conversationId) loadAnnotations(() => loadConversation(conversationId));
    } else if (msg.type === 'annotationsUpdated') {
      loadAnnotations(() => refreshAllNodes());
    } else if (msg.type === 'prefsUpdated') {
      applyPrefs(msg.prefs);
    }
  });

})();
