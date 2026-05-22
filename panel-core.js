// PARITY RULE: The inline panel (content.js) and the popout (panel-standalone.js) are the SAME map
// in two different windows. Any change to appearance, behavior, prefs, or data loading MUST work
// identically in both. Never make a change that causes them to diverge. Both use this file for all
// shared logic; boot() in each adapter must follow the same sequencing: load prefs first (single
// storage read), then setConversationId, then loadAnnotations, then load/render conversation data.
//
// Shared panel logic for both the injected panel (content.js) and the popout (panel-standalone.js).
// Usage: const panel = initPanel(adapter);
// adapter = {
//   onNodeClick(nodeId),       -- called on normal (non-shift) node click
//   onAnnotationsSaved(),      -- called after annotations written to storage
//   onPrefsSaved(prefs),       -- called after prefs written to storage; notify the other panel
//   boot(api),                 -- called at end of initPanel; api = { loadConversationData,
//                                  loadAnnotations, applyPrefs, setConversationId, selectNode }
// }
// Returns: { selectNode, loadConversationData, loadAnnotations, getMapping, getNodes, getTree, getSelectedId, refreshAllNodes }

function initPanel(adapter) {
  const NODE_W = 220;
  const NODE_H = 60;
  const NODE_GAP = 20;
  const SATELLITE_W = NODE_W;
  const SATELLITE_GAP = 20;
  const NODE_STRIDE_X = NODE_W + SATELLITE_GAP + SATELLITE_W + NODE_GAP;
  const NODE_STRIDE_Y = NODE_H + NODE_GAP;

  const ICON_SVGS = {
    file: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M720-330q0 104-73 177T470-80q-104 0-177-73t-73-177v-370q0-75 52.5-127.5T400-880q75 0 127.5 52.5T580-700v350q0 46-32 78t-78 32q-46 0-78-32t-32-78v-370h80v370q0 13 8.5 21.5T470-320q13 0 21.5-8.5T500-350v-350q-1-42-29.5-71T400-800q-42 0-71 29t-29 71v370q-1 71 49 120.5T470-160q70 0 119-49.5T640-330v-390h80v390Z"/></svg>',
    image: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M240-280h480L570-480 450-320l-90-120-120 160ZM120-120v-720h720v720H120Zm80-80h560v-560H200v560Zm0 0v-560 560Z"/></svg>',
    code: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M240-280 40-480l200-200 56 56-143 144 143 144-56 56Zm178 132-76-24 200-640 76 24-200 640Zm302-132-56-56 143-144-143-144 56-56 200 200-200 200Z"/></svg>'
  };

  let conversationId = null;
  let cttvNodes = {};
  let cttvTree = null;
  let cttvMapping = null;
  let cttvAnnotations = {};
  let cttvCanvasNotes = [];
  let cttvColorKey = {};
  let cttvMenuNodeId = null;
  let cttvSelectedId = null;
  let cttvSelectionSet = new Set();
  let cttvSelectionAnchor = null;
  let cttvPrefs = {};

  function applyPrefs(newPrefs) {
    if (newPrefs) cttvPrefs = newPrefs;
    const isHex = v => typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v);
    const userColor = isHex(cttvPrefs.userColor) ? cttvPrefs.userColor : '#99cc99';
    const assistantColor = isHex(cttvPrefs.assistantColor) ? cttvPrefs.assistantColor : '#9999cc';
    const hexLuminance = hex => {
      const h = hex.replace('#', '');
      const r = parseInt(h.slice(0,2), 16) / 255;
      const g = parseInt(h.slice(2,4), 16) / 255;
      const b = parseInt(h.slice(4,6), 16) / 255;
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    const iconColor = c => hexLuminance(c) > 0.5 ? '#111' : '#ddd';
    let styleEl = document.getElementById('cttv-prefs-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'cttv-prefs-style';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `.cttv-node-user { background: ${userColor}; color: #111; }
.cttv-node-assistant { background: ${assistantColor}; color: #111; }
.cttv-node-user .cttv-node-icons { color: ${iconColor(userColor)}; }
.cttv-node-assistant .cttv-node-icons { color: ${iconColor(assistantColor)}; }`;
    const userOnlyEl = document.getElementById('cttv-user-only');
    if (userOnlyEl) userOnlyEl.checked = !!cttvPrefs.userOnly;
    if (cttvTree) renderMap(cttvTree);
  }

  function savePrefs() {
    chrome.storage.local.set({ 'cttv-prefs': cttvPrefs });
    adapter.onPrefsSaved(cttvPrefs);
  }

  function saveAnnotations() {
    const clean = {};
    for (const [id, ann] of Object.entries(cttvAnnotations)) {
      if (ann.star || ann.color || ann.notes || ann.unimportant || ann.notesPreview === false) clean[id] = ann;
    }
    chrome.storage.local.set({ [`cttv-ann-${conversationId}`]: clean });
    cttvAnnotations = clean;
    // Callers that need to notify other contexts (e.g. standalone popout notifying
    // the ChatGPT tab) should do so in their adapter.onAnnotationsSaved() implementation.
    adapter.onAnnotationsSaved();
  }

  function loadAnnotations(cb) {
    chrome.storage.local.get([`cttv-ann-${conversationId}`], result => {
      cttvAnnotations = result[`cttv-ann-${conversationId}`] || {};
      cb();
    });
  }

  function saveCanvasNotes() {
    chrome.storage.local.set({
      [`cttv-canvas-${conversationId}`]: { stickyNotes: cttvCanvasNotes }
    });
    adapter.onAnnotationsSaved();
  }

  function loadCanvasNotes(cb) {
    chrome.storage.local.get([`cttv-canvas-${conversationId}`], result => {
      const data = result[`cttv-canvas-${conversationId}`] || {};
      cttvCanvasNotes = data.stickyNotes || [];
      cb();
    });
  }

  function renderMarkdownLinks(text) {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) => {
      const safeUrl = url.replace(/"/g, '%22');
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#88ccff">${label}</a>`;
    });
  }

  function isCTTVDrag(e) {
    return e.dataTransfer.types.includes('application/cttv-link') ||
           e.dataTransfer.types.includes('application/cttv-text');
  }

  function getDragContent(e) {
    if (e.dataTransfer.types.includes('application/cttv-link'))
      return e.dataTransfer.getData('application/cttv-link') || e.dataTransfer.getData('text/plain') || null;
    if (e.dataTransfer.types.includes('application/cttv-text'))
      return e.dataTransfer.getData('application/cttv-text') || null;
    return null;
  }

  function renderCanvasNotes() {
    document.querySelectorAll('.cttv-sticky-note').forEach(el => el.remove());
    const body = document.getElementById('cttv-body');
    for (const note of cttvCanvasNotes) {
      body.appendChild(createStickyNoteEl(note));
    }
  }

  function createStickyNoteEl(note) {
    const el = document.createElement('div');
    el.className = 'cttv-sticky-note';
    el.dataset.noteId = note.id;
    el.style.left = note.x + 'px';
    el.style.top = note.y + 'px';
    if (note.width) el.style.width = note.width + 'px';
    if (note.height) el.style.height = note.height + 'px';

    const handle = document.createElement('div');
    handle.className = 'cttv-sticky-note-handle';

    const del = document.createElement('button');
    del.className = 'cttv-sticky-delete';
    del.textContent = '✕';
    del.title = 'Delete note';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      cttvCanvasNotes = cttvCanvasNotes.filter(n => n.id !== note.id);
      el.remove();
      saveCanvasNotes();
    });
    handle.appendChild(del);

    const ta = document.createElement('textarea');
    ta.className = 'cttv-sticky-note-ta';
    ta.rows = 4;
    ta.value = note.text || '';
    ta.addEventListener('input', () => {
      const n = cttvCanvasNotes.find(n => n.id === note.id);
      if (n) {
        n.text = ta.value;
        saveCanvasNotes();
      }
    });

    el.appendChild(handle);
    el.appendChild(ta);

    let dragging = false, dragOffX = 0, dragOffY = 0;
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      const body = document.getElementById('cttv-body');
      const br = body.getBoundingClientRect();
      dragOffX = e.clientX - br.left + body.scrollLeft - note.x;
      dragOffY = e.clientY - br.top + body.scrollTop - note.y;
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const body = document.getElementById('cttv-body');
      const br = body.getBoundingClientRect();
      note.x = e.clientX - br.left + body.scrollLeft - dragOffX;
      note.y = e.clientY - br.top + body.scrollTop - dragOffY;
      el.style.left = note.x + 'px';
      el.style.top = note.y + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = '';

      // Check if center of dragged note lands inside another sticky note or satellite note
      const cx = note.x + el.offsetWidth / 2;
      const cy = note.y + el.offsetHeight / 2;

      for (const other of cttvCanvasNotes) {
        if (other.id === note.id) continue;
        const otherEl = document.querySelector(`.cttv-sticky-note[data-note-id="${other.id}"]`);
        if (!otherEl) continue;
        if (cx >= other.x && cx <= other.x + otherEl.offsetWidth &&
            cy >= other.y && cy <= other.y + otherEl.offsetHeight) {
          other.text = other.text ? other.text + '\n\n' + note.text : note.text;
          const targetTa = otherEl.querySelector('.cttv-sticky-note-ta');
          if (targetTa) targetTa.value = other.text;
          cttvCanvasNotes = cttvCanvasNotes.filter(n => n.id !== note.id);
          el.remove();
          saveCanvasNotes();
          return;
        }
      }

      const body = document.getElementById('cttv-body');
      const bodyBr = body.getBoundingClientRect();
      for (const sat of document.querySelectorAll('.cttv-satellite-note')) {
        const br = sat.getBoundingClientRect();
        const satX = br.left - bodyBr.left + body.scrollLeft;
        const satY = br.top - bodyBr.top + body.scrollTop;
        if (cx >= satX && cx <= satX + br.width && cy >= satY && cy <= satY + br.height) {
          const nodeId = sat.dataset.satelliteFor;
          if (nodeId) {
            if (!cttvAnnotations[nodeId]) cttvAnnotations[nodeId] = {};
            const ann = cttvAnnotations[nodeId];
            ann.notes = ann.notes ? ann.notes + '\n\n' + note.text : note.text;
            cttvCanvasNotes = cttvCanvasNotes.filter(n => n.id !== note.id);
            el.remove();
            refreshNode(nodeId);
            saveAnnotations();
            saveCanvasNotes();
            return;
          }
        }
      }

      saveCanvasNotes();
    });
    el.addEventListener('mouseup', () => {
      const n = cttvCanvasNotes.find(n => n.id === note.id);
      if (n) {
        n.width = el.offsetWidth;
        n.height = el.offsetHeight;
        saveCanvasNotes();
      }
    });

    el.addEventListener('dragover', (e) => {
      if (isCTTVDrag(e)) { e.preventDefault(); e.stopPropagation(); }
    });
    el.addEventListener('drop', (e) => {
      if (!isCTTVDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const content = getDragContent(e);
      if (!content) return;
      const n = cttvCanvasNotes.find(n => n.id === note.id);
      if (n) {
        n.text = n.text ? n.text + '\n\n' + content : content;
        const ta = el.querySelector('.cttv-sticky-note-ta');
        if (ta) ta.value = n.text;
        saveCanvasNotes();
      }
    });

    return el;
  }

  function createNoteFromDrag(text) {
    if (!conversationId) return;
    const body = document.getElementById('cttv-body');
    if (!body) return;
    const note = {
      id: Date.now().toString(),
      x: body.scrollLeft + 40,
      y: body.scrollTop + 40,
      text: text,
      width: 200
    };
    cttvCanvasNotes.push(note);
    body.appendChild(createStickyNoteEl(note));
    saveCanvasNotes();
  }

  function saveColorKey() {
    chrome.storage.local.set({ 'cttv-colorkey': cttvColorKey });
  }

  function loadColorKey(cb) {
    chrome.storage.local.get(['cttv-colorkey'], result => {
      cttvColorKey = result['cttv-colorkey'] || {};
      cb();
    });
  }

  const CTTV_COLORS = ['#e55', '#e93', '#9c9', '#69f', '#c6f'];

  function renderColorKey() {
    const existing = document.querySelector('.cttv-colorkey');
    if (!cttvColorKey._visible) {
      existing?.remove();
      document.getElementById('cttv-toggle-colorkey')?.classList.remove('active');
      return;
    }
    if (existing) return;

    const body = document.getElementById('cttv-body');
    const el = document.createElement('div');
    el.className = 'cttv-colorkey';
    el.style.left = (cttvColorKey._x ?? 20) + 'px';
    el.style.top = (cttvColorKey._y ?? 20) + 'px';

    const handle = document.createElement('div');
    handle.className = 'cttv-colorkey-handle';
    handle.textContent = 'COLOR KEY';
    el.appendChild(handle);

    for (const color of CTTV_COLORS) {
      const row = document.createElement('div');
      row.className = 'cttv-colorkey-row';

      const swatch = document.createElement('div');
      swatch.className = 'cttv-colorkey-swatch';
      swatch.style.background = color;

      const input = document.createElement('input');
      input.className = 'cttv-colorkey-input';
      input.type = 'text';
      input.value = cttvColorKey[color] || '';
      input.placeholder = 'Add label...';
      input.addEventListener('input', () => {
        cttvColorKey[color] = input.value;
        saveColorKey();
      });

      row.appendChild(swatch);
      row.appendChild(input);
      el.appendChild(row);
    }

    let dragging = false, dragOffX = 0, dragOffY = 0;
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      const br = body.getBoundingClientRect();
      dragOffX = e.clientX - br.left + body.scrollLeft - (cttvColorKey._x ?? 20);
      dragOffY = e.clientY - br.top + body.scrollTop - (cttvColorKey._y ?? 20);
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const br = body.getBoundingClientRect();
      cttvColorKey._x = e.clientX - br.left + body.scrollLeft - dragOffX;
      cttvColorKey._y = e.clientY - br.top + body.scrollTop - dragOffY;
      el.style.left = cttvColorKey._x + 'px';
      el.style.top = cttvColorKey._y + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        document.body.style.userSelect = '';
        saveColorKey();
      }
    });

    body.appendChild(el);
    document.getElementById('cttv-toggle-colorkey')?.classList.add('active');
  }

  function parseTree(data) {
    const mapping = data.mapping;
    let rootId = null;
    for (const [id, node] of Object.entries(mapping)) {
      if (!node.parent || !mapping[node.parent]) { rootId = id; break; }
    }

    function buildNode(id) {
      const raw = mapping[id];
      if (!raw) return null;
      const msg = raw.message;
      const role = msg?.author?.role;
      if (!role || role === 'system' || role === 'tool') {
        return (raw.children || []).map(buildNode).filter(Boolean).flat();
      }
      if (role === 'assistant') {
        const chainTexts = [];
        let chainId = id;
        let chainCurId = id;
        let chainRaw = raw;
        let hasImage = false, hasCode = false, hasFile = false;
        while (true) {
          const nodeRole = chainRaw.message?.author?.role;
          const ct = chainRaw.message?.content?.content_type;
          const chainParts = chainRaw.message?.content?.parts || [];
          if (nodeRole === 'assistant' || nodeRole === 'tool') {
            const chainText = chainParts.filter(p => typeof p === 'string').join('');
            if (chainText && nodeRole === 'assistant') chainTexts.push(chainText);
            if (ct === 'multimodal_text' || chainParts.some(p => p?.content_type === 'image_asset_pointer')) hasImage = true;
            if (chainText && /sandbox:\/mnt\/data/.test(chainText)) hasFile = true;
            if (nodeRole === 'assistant') chainId = chainCurId;
          }
          const kids = chainRaw.children || [];
          if (kids.length !== 1) break;
          const nextId = kids[0];
          const nextRaw = mapping[nextId];
          const nextRole = nextRaw?.message?.author?.role;
          if (nextRole !== 'assistant' && nextRole !== 'tool') break;
          chainCurId = nextId;
          chainRaw = nextRaw;
        }
        const combinedText = chainTexts.join('\n');
        if (/```/.test(combinedText)) hasCode = true;
        const terminalKids = (chainRaw.children || []).map(buildNode).filter(Boolean).flat();
        if (!combinedText && !hasImage && !hasFile && !terminalKids.length) return [];
        if (!combinedText && !hasImage && !hasFile) return terminalKids;
        const icons = [hasImage && 'image', hasCode && 'code', hasFile && 'file'].filter(Boolean);
        const displayText = combinedText || (hasImage ? '(image)' : '(file)');
        return [{ id: chainId, eid: raw.message?.metadata?.turn_exchange_id, role, text: displayText, icons, children: terminalKids }];
      }
      const parts = msg?.content?.parts || [];
      const text = parts.filter(p => typeof p === 'string').join('');
      if (!text) return (raw.children || []).map(buildNode).filter(Boolean).flat();
      const hasFile = !!(msg?.metadata?.attachments?.length);
      const hasImage = parts.some(p => p?.content_type === 'image_asset_pointer');
      const hasCode = /```/.test(text);
      const icons = [hasImage && 'image', hasCode && 'code', hasFile && 'file'].filter(Boolean);
      return [{ id, eid: msg?.metadata?.turn_exchange_id, role, text, icons, children: (raw.children || []).map(buildNode).filter(Boolean).flat() }];
    }

    const roots = [buildNode(rootId)].flat().filter(Boolean);
    if (roots.length === 0) return null;
    // Always wrap in a synthetic START root so the map consistently shows "START" at the top
    // with a line leading to the first turn, whether or not that turn is branched.
    return { id: '__root__', role: 'root', text: 'START', icons: [], children: roots };
  }

  function layoutTree(node) {
    function countLeaves(n) {
      if (!n.children || n.children.length === 0) return 1;
      return n.children.reduce((sum, c) => sum + countLeaves(c), 0);
    }
    function assign(n, depth, leftCol) {
      const leaves = countLeaves(n);
      n.col = leftCol + (leaves - 1) / 2;
      n.depth = depth;
      let col = leftCol;
      for (const child of (n.children || [])) {
        assign(child, depth + 1, col);
        col += countLeaves(child);
      }
    }
    assign(node, 0, 0);
    return node;
  }

  function flattenTree(node, acc = []) {
    acc.push(node);
    for (const child of (node.children || [])) flattenTree(child, acc);
    return acc;
  }

  // Build a display tree with assistant nodes collapsed out.
  // Each assistant node is replaced by its children, re-parented to the assistant's parent.
  // The real tree is unchanged; this is only used for layout/rendering.
  function collapseAssistants(node) {
    const collapsedChildren = (node.children || []).flatMap(child => {
      if (child.role === 'assistant') return child.children.flatMap(gc => [collapseAssistants(gc)]);
      return [collapseAssistants(child)];
    });
    return { ...node, children: collapsedChildren };
  }

  function createSatelliteEl(nodeId, nx, ny, noteText) {
    const sat = document.createElement('div');
    sat.className = 'cttv-satellite-note';
    sat.dataset.satelliteFor = nodeId;
    sat.style.cssText = `position:absolute;left:${nx + NODE_W + SATELLITE_GAP}px;top:${ny}px;width:${SATELLITE_W}px;min-height:${NODE_H}px;max-height:${NODE_H}px;z-index:1;justify-content:flex-start;`;

    const del = document.createElement('button');
    del.className = 'cttv-sticky-delete';
    del.textContent = '×';
    del.title = 'Delete note';
    del.style.cssText = 'align-self:flex-end;margin:2px 4px 0 0;';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      sat.remove();
      document.getElementById('cttv-map')?.querySelector(`[data-satellite-edge-for="${nodeId}"]`)?.remove();
      if (cttvAnnotations[nodeId]) delete cttvAnnotations[nodeId].notes;
      saveAnnotations();
    });
    sat.appendChild(del);

    const textDiv = document.createElement('div');
    textDiv.className = 'cttv-satellite-text';
    textDiv.innerHTML = renderMarkdownLinks(noteText);
    sat.appendChild(textDiv);

    sat.addEventListener('mouseenter', () => {
      sat.style.maxHeight = '260px';
      sat.style.zIndex = '10';
      textDiv.classList.add('cttv-satellite-text-expanded');
    });
    sat.addEventListener('mouseleave', () => {
      sat.style.maxHeight = NODE_H + 'px';
      sat.style.zIndex = '1';
      textDiv.classList.remove('cttv-satellite-text-expanded');
    });
    sat.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') return;
      e.stopPropagation();
      openNotesDialog(nodeId);
    });

    sat.addEventListener('dragover', (e) => {
      if (isCTTVDrag(e)) { e.preventDefault(); e.stopPropagation(); }
    });
    sat.addEventListener('drop', (e) => {
      if (!isCTTVDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      const content = getDragContent(e);
      if (!content) return;
      if (!cttvAnnotations[nodeId]) cttvAnnotations[nodeId] = {};
      const ann = cttvAnnotations[nodeId];
      ann.notes = ann.notes ? ann.notes + '\n\n' + content : content;
      refreshNode(nodeId);
      saveAnnotations();
    });

    return sat;
  }

  function openNotesDialog(nodeId) {
    const dialog = document.getElementById('cttv-notes-dialog');
    dialog.dataset.nodeId = nodeId;
    document.getElementById('cttv-notes-ta').value = cttvAnnotations[nodeId]?.notes || '';
    document.getElementById('cttv-notes-preview-toggle').checked = cttvAnnotations[nodeId]?.notesPreview !== false;
    const hasNotes = (cttvAnnotations[nodeId]?.notes || '').trim().length > 0;
    document.getElementById('cttv-notes-preview-label').style.display = hasNotes ? '' : 'none';
    dialog.classList.remove('hidden');
    document.getElementById('cttv-notes-ta').focus();
  }

  function renderMap(tree) {
    const displayTree = cttvPrefs.userOnly ? collapseAssistants(tree) : tree;
    layoutTree(displayTree);
    const nodes = flattenTree(displayTree);

    const maxCol = Math.max(...nodes.map(n => n.col));
    const maxDepth = Math.max(...nodes.map(n => n.depth));
    const PADDING = 20;
    const totalW = (maxCol + 1) * NODE_STRIDE_X + PADDING * 2;
    const totalH = (maxDepth + 1) * NODE_STRIDE_Y + PADDING * 2;

    function nodeX(n) { return PADDING + n.col * NODE_STRIDE_X; }
    function nodeY(n) { return PADDING + n.depth * NODE_STRIDE_Y; }
    function nodeCX(n) { return nodeX(n) + NODE_W / 2; }

    const edgePaths = [];
    for (const node of nodes) {
      for (const child of (node.children || [])) {
        const x1 = nodeCX(node), y1 = nodeY(node) + NODE_H / 2;
        const x2 = nodeCX(child), y2 = nodeY(child) + NODE_H / 2;
        const midY = (y1 + y2) / 2;
        const r = 6;
        let d;
        if (x1 === x2) {
          d = `M${x1},${y1} L${x2},${y2}`;
        } else {
          const goRight = x2 > x1;
          d = `M${x1},${y1} L${x1},${midY - r} Q${x1},${midY} ${x1 + (goRight ? r : -r)},${midY} L${x2 + (goRight ? -r : r)},${midY} Q${x2},${midY} ${x2},${midY + r} L${x2},${y2}`;
        }
        edgePaths.push(`<path d="${d}" stroke="#888" stroke-width="1.5" fill="none"/>`);
      }
    }

    for (const n of nodes) {
      if (n.role === 'root') continue;
      const ann = cttvAnnotations[n.id] || {};
      if (!ann.notes) continue;
      const x1 = nodeX(n) + NODE_W;
      const y1 = nodeY(n) + NODE_H / 2;
      edgePaths.push(`<path data-satellite-edge-for="${n.id}" d="M${x1},${y1} L${x1 + SATELLITE_GAP},${y1}" stroke="#88ccff" stroke-width="1.5" fill="none"/>`);
    }

    const map = document.getElementById('cttv-map');
    map.innerHTML = '';
    map.style.width = totalW + 'px';
    map.style.height = totalH + 'px';


    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('width', totalW);
    svgEl.setAttribute('height', totalH);
    svgEl.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:0;';
    svgEl.innerHTML = edgePaths.join('');
    map.appendChild(svgEl);

    cttvNodes = {};
    for (const n of flattenTree(tree)) cttvNodes[n.id] = n;
    cttvTree = tree;
    cttvSelectionSet = new Set();
    cttvSelectionAnchor = null;

    for (const n of nodes) {
      if (n.role === 'root') {
        const label = document.createElement('div');
        label.className = 'cttv-start-label';
        label.textContent = 'START';
        label.style.cssText = `position:absolute;left:${nodeX(n)}px;top:${nodeY(n)}px;width:${NODE_W}px;height:${NODE_H}px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;letter-spacing:1px;opacity:0.5;pointer-events:none;`;
        map.appendChild(label);
        continue;
      }
      const outer = document.createElement('div');
      outer.className = `cttv-node-outer cttv-node-outer-${n.role}`;
      outer.dataset.id = n.id;
      outer.style.cssText = `position:absolute;left:${nodeX(n)}px;top:${nodeY(n)}px;width:${NODE_W}px;min-height:${NODE_H}px;max-height:${NODE_H}px;border-radius:12px;box-sizing:border-box;z-index:1;overflow:hidden;`;

      const inner = document.createElement('div');
      inner.className = `cttv-node cttv-node-${n.role}`;

      const ann = cttvAnnotations[n.id] || {};
      let textDiv = null;
      if (ann.unimportant) {
        inner.style.cssText = 'width:40px;height:40px;border-radius:50%;box-sizing:border-box;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);';
      } else {
        inner.style.cssText = 'width:100%;min-height:100%;height:auto;border-radius:10px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:5px;';
        if (ann.color) inner.style.border = `3px solid ${ann.color}`;
        if (ann.star) {
          const starEl = document.createElement('div');
          starEl.className = 'cttv-node-star';
          starEl.textContent = '⭐';
          inner.appendChild(starEl);
        }
        if (n.icons?.length) {
          const iconRow = document.createElement('div');
          iconRow.className = 'cttv-node-icons';
          iconRow.style.cssText = 'display:flex;gap:3px;align-items:center;pointer-events:none;';
          for (const icon of n.icons) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:17px;height:17px;opacity:0.9;flex-shrink:0;';
            wrap.innerHTML = ICON_SVGS[icon];
            wrap.querySelector('svg').style.cssText = 'width:100%;height:100%;fill:currentColor;';
            iconRow.appendChild(wrap);
          }
          inner.appendChild(iconRow);
        }
        textDiv = document.createElement('div');
        textDiv.className = 'cttv-node-text';
        textDiv.textContent = n.text || '(empty)';
        inner.appendChild(textDiv);
      }

      outer.appendChild(inner);
      map.appendChild(outer);
      if (ann.notes) {
        map.appendChild(createSatelliteEl(n.id, nodeX(n), nodeY(n), ann.notes));
      }

      outer.addEventListener('click', (e) => {
        if (e.shiftKey) {
          e.preventDefault();
          if (!cttvSelectionAnchor) {
            cttvSelectionAnchor = n.id;
            cttvSelectionSet = new Set([n.id]);
            applyMultiSelection();
          } else {
            setRangeSelection(cttvSelectionAnchor, n.id);
          }
          return;
        }
        clearMultiSelection();
        selectNode(n.id, false);
        adapter.onNodeClick(n.id);
      });
      outer.addEventListener('mouseenter', () => {
        if (!textDiv) return;
        outer.style.maxHeight = '260px';
        outer.style.zIndex = '10';
        textDiv.classList.add('cttv-node-text-expanded');
      });
      outer.addEventListener('mouseleave', () => {
        if (!textDiv) return;
        outer.style.maxHeight = NODE_H + 'px';
        outer.style.zIndex = '1';
        textDiv.classList.remove('cttv-node-text-expanded');
      });
      outer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (cttvSelectionSet.size > 1 && cttvSelectionSet.has(n.id)) {
          showMenu(n.id, e.clientX, e.clientY, true);
        } else {
          clearMultiSelection();
          showMenu(n.id, e.clientX, e.clientY, false);
        }
      });
    }
  }

  function showMenu(nodeId, x, y, bulk = false) {
    cttvMenuNodeId = nodeId;
    const ann = cttvAnnotations[nodeId] || {};
    const menu = document.getElementById('cttv-menu');
    menu.querySelector('[data-action="star"]').textContent = ann.star ? '⭐ Unstar' : '⭐ Star';
    menu.querySelector('[data-action="unimportant"]').textContent = ann.unimportant ? '👁 Unmark unimportant' : '👁 Mark unimportant';
    menu.querySelector('[data-action="notes"]').style.display = bulk ? 'none' : '';
    menu.classList.remove('hidden');
    const panel = document.getElementById('cttv-panel');
    const pr = panel.getBoundingClientRect();
    menu.style.left = Math.min(x, pr.right - 190) + 'px';
    menu.style.top = Math.min(y, pr.bottom - 160) + 'px';
  }

  function hideMenu() {
    document.getElementById('cttv-menu').classList.add('hidden');
    cttvMenuNodeId = null;
  }

  function refreshNode(nodeId) {
    const outer = document.querySelector(`.cttv-node-outer[data-id="${nodeId}"]`);
    if (!outer) return;
    const ann = cttvAnnotations[nodeId] || {};
    const inner = outer.querySelector('.cttv-node');
    inner.style.border = '';
    outer.querySelector('.cttv-node-star')?.remove();
    const icons = inner?.querySelector('.cttv-node-icons');
    if (ann.unimportant) {
      inner.style.cssText = 'width:40px;height:40px;border-radius:50%;box-sizing:border-box;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);';
      if (icons) icons.style.display = 'none';
    } else {
      inner.style.cssText = 'width:100%;min-height:100%;height:auto;border-radius:10px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:5px;';
      if (icons) icons.style.display = 'flex';
      if (ann.color) inner.style.border = `3px solid ${ann.color}`;
      if (ann.star) {
        const starEl = document.createElement('div');
        starEl.className = 'cttv-node-star';
        starEl.textContent = '⭐';
        inner.insertBefore(starEl, inner.firstChild);
      }
    }
    const map = document.getElementById('cttv-map');
    const svgEl = map?.querySelector('svg');
    const existingSat = map?.querySelector(`.cttv-satellite-note[data-satellite-for="${nodeId}"]`);
    const existingEdge = svgEl?.querySelector(`[data-satellite-edge-for="${nodeId}"]`);

    if (ann.notes) {
      if (existingSat) {
        const td = existingSat.querySelector('.cttv-satellite-text');
        if (td) td.innerHTML = renderMarkdownLinks(ann.notes);
      } else {
        const nx = parseInt(outer.style.left);
        const ny = parseInt(outer.style.top);
        map.appendChild(createSatelliteEl(nodeId, nx, ny, ann.notes));
        if (svgEl) {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.dataset.satelliteEdgeFor = nodeId;
          path.setAttribute('d', `M${nx + NODE_W},${ny + NODE_H / 2} L${nx + NODE_W + SATELLITE_GAP},${ny + NODE_H / 2}`);
          path.setAttribute('stroke', '#88ccff');
          path.setAttribute('stroke-width', '1.5');
          path.setAttribute('fill', 'none');
          svgEl.appendChild(path);
        }
      }
    } else {
      existingSat?.remove();
      existingEdge?.remove();
    }
  }

  function refreshAllNodes() {
    for (const id of Object.keys(cttvNodes)) refreshNode(id);
  }

  function selectNode(nodeId, scrollIntoView) {
    clearMultiSelection();
    cttvSelectedId = nodeId;
    document.querySelectorAll('.cttv-node-outer').forEach(el => el.classList.remove('cttv-selected'));
    if (!nodeId) return;
    // In userOnly mode, assistant nodes have no DOM element — highlight the parent user node instead.
    let displayId = nodeId;
    if (cttvPrefs.userOnly && cttvNodes[nodeId]?.role === 'assistant') {
      const parentId = cttvMapping?.[nodeId]?.parent;
      if (parentId && cttvNodes[parentId]) displayId = parentId;
    }
    const el = document.querySelector(`.cttv-node-outer[data-id="${displayId}"]`);
    if (el) {
      el.classList.add('cttv-selected');
      if (scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function clearMultiSelection() {
    cttvSelectionSet = new Set();
    cttvSelectionAnchor = null;
    document.querySelectorAll('.cttv-selection-highlight').forEach(el => el.remove());
  }

  function applyMultiSelection() {
    document.querySelectorAll('.cttv-selection-highlight').forEach(el => el.remove());
    if (cttvSelectionSet.size === 0) return;
    const map = document.getElementById('cttv-map');
    for (const id of cttvSelectionSet) {
      const el = document.querySelector(`.cttv-node-outer[data-id="${id}"]`);
      if (!el) continue;
      const hl = document.createElement('div');
      hl.className = 'cttv-selection-highlight';
      hl.style.cssText = `position:absolute;left:${el.style.left};top:${el.style.top};width:${NODE_W}px;height:${NODE_H}px;`;
      map.insertBefore(hl, map.firstChild);
    }
  }

  function getNodeOrder() {
    if (!cttvTree) return [];
    return flattenTree(cttvTree).map(n => n.id);
  }

  function setRangeSelection(anchorId, extendId) {
    const order = getNodeOrder();
    const ai = order.indexOf(anchorId);
    const ei = order.indexOf(extendId);
    if (ai === -1 || ei === -1) return;
    const lo = Math.min(ai, ei), hi = Math.max(ai, ei);
    cttvSelectionSet = new Set(order.slice(lo, hi + 1));
    applyMultiSelection();
  }

  function showError(msg) {
    const el = document.getElementById('cttv-error');
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  function loadConversationData(data, selectedId) {
    showError('');
    document.getElementById('cttv-map').classList.add('cttv-loading');
    cttvMapping = data.mapping;
    const tree = parseTree(data);
    if (!tree) {
      showError('Could not parse conversation structure.');
      document.getElementById('cttv-map').classList.remove('cttv-loading');
      return;
    }
    renderMap(tree);
    document.getElementById('cttv-map').classList.remove('cttv-loading');
    if (selectedId && cttvNodes[selectedId]) selectNode(selectedId, true);
  }

  // --- Event wiring ---

  document.addEventListener('click', (e) => {
    if (!document.getElementById('cttv-menu')?.contains(e.target)) hideMenu();
    if (!e.target.closest('.cttv-node-outer') && !document.getElementById('cttv-menu')?.contains(e.target)) {
      clearMultiSelection();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideMenu();
      clearMultiSelection();
    }
  });

  document.getElementById('cttv-menu').addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    const color = e.target.dataset.color;
    const id = cttvMenuNodeId;
    if (!id) return;
    const targets = cttvSelectionSet.size > 1 ? [...cttvSelectionSet] : [id];
    if (action === 'star') {
      const newVal = !cttvAnnotations[id]?.star;
      for (const tid of targets) {
        cttvAnnotations[tid] = { ...cttvAnnotations[tid], star: newVal };
        refreshNode(tid);
      }
      saveAnnotations();
      hideMenu();
    } else if (action === 'notes') {
      openNotesDialog(id);
      hideMenu();
    } else if (action === 'unimportant') {
      const newVal = !cttvAnnotations[id]?.unimportant;
      for (const tid of targets) {
        cttvAnnotations[tid] = { ...cttvAnnotations[tid], unimportant: newVal };
        refreshNode(tid);
      }
      saveAnnotations();
      hideMenu();
    } else if (color !== undefined) {
      for (const tid of targets) {
        if (color) {
          cttvAnnotations[tid] = { ...cttvAnnotations[tid], color };
        } else {
          const { color: _, ...rest } = cttvAnnotations[tid] || {};
          cttvAnnotations[tid] = rest;
        }
        refreshNode(tid);
      }
      saveAnnotations();
      hideMenu();
    }
  });

  document.getElementById('cttv-notes-save').addEventListener('click', () => {
    const id = document.getElementById('cttv-notes-dialog').dataset.nodeId;
    if (id) {
      const notes = document.getElementById('cttv-notes-ta').value.trim();
      cttvAnnotations[id] = { ...cttvAnnotations[id], notes: notes || undefined };
      if (!notes) delete cttvAnnotations[id].notes;
      saveAnnotations();
      refreshNode(id);
    }
    document.getElementById('cttv-notes-dialog').classList.add('hidden');
  });

  document.getElementById('cttv-notes-cancel').addEventListener('click', () => {
    document.getElementById('cttv-notes-dialog').classList.add('hidden');
  });

  document.getElementById('cttv-notes-ta').addEventListener('input', () => {
    const hasNotes = document.getElementById('cttv-notes-ta').value.trim().length > 0;
    document.getElementById('cttv-notes-preview-label').style.display = hasNotes ? '' : 'none';
  });

  document.getElementById('cttv-notes-ta').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('cttv-notes-dialog').classList.add('hidden');
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      document.getElementById('cttv-notes-save').click();
    }
  });

  document.getElementById('cttv-notes-preview-toggle').addEventListener('change', (e) => {
    const id = document.getElementById('cttv-notes-dialog').dataset.nodeId;
    if (id) {
      cttvAnnotations[id] = { ...cttvAnnotations[id], notesPreview: e.target.checked };
      saveAnnotations();
    }
  });

  document.getElementById('cttv-add-note').addEventListener('click', () => {
    const body = document.getElementById('cttv-body');
    const note = {
      id: Date.now().toString(),
      x: body.scrollLeft + 20,
      y: body.scrollTop + 20,
      text: '',
      width: 180
    };
    cttvCanvasNotes.push(note);
    body.appendChild(createStickyNoteEl(note));
    saveCanvasNotes();
  });

  document.getElementById('cttv-toggle-colorkey').addEventListener('click', () => {
    cttvColorKey._visible = !cttvColorKey._visible;
    saveColorKey();
    renderColorKey();
  });

  document.getElementById('cttv-settings').addEventListener('click', () => {
    document.getElementById('cttv-settings-dialog').classList.toggle('hidden');
    const s = document.getElementById('cttv-settings-status');
    s.textContent = '';
    delete s.dataset.error;
    document.getElementById('cttv-color-user').value = cttvPrefs.userColor || '#99cc99';
    document.getElementById('cttv-color-assistant').value = cttvPrefs.assistantColor || '#9999cc';
    document.getElementById('cttv-user-only').checked = !!cttvPrefs.userOnly;
  });

  document.getElementById('cttv-color-user').addEventListener('input', (e) => {
    cttvPrefs.userColor = e.target.value;
    applyPrefs();
    savePrefs();
  });

  document.getElementById('cttv-color-assistant').addEventListener('input', (e) => {
    cttvPrefs.assistantColor = e.target.value;
    applyPrefs();
    savePrefs();
  });

  document.getElementById('cttv-colors-reset').addEventListener('click', () => {
    delete cttvPrefs.userColor;
    delete cttvPrefs.assistantColor;
    applyPrefs();
    savePrefs();
    document.getElementById('cttv-color-user').value = '#99cc99';
    document.getElementById('cttv-color-assistant').value = '#9999cc';
  });

  document.getElementById('cttv-user-only').addEventListener('change', (e) => {
    cttvPrefs.userOnly = e.target.checked;
    applyPrefs();
    savePrefs();
  });

  document.getElementById('cttv-settings-close').addEventListener('click', () => {
    document.getElementById('cttv-settings-dialog').classList.add('hidden');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('cttv-settings-dialog').classList.contains('hidden')) {
      document.getElementById('cttv-settings-dialog').classList.add('hidden');
    }
  });

  document.getElementById('cttv-export-btn').addEventListener('click', () => {
    chrome.storage.local.get(null, (all) => {
      const ann = {};
      for (const [k, v] of Object.entries(all)) {
        if (k.startsWith('cttv-ann-')) ann[k] = v;
      }
      if (Object.keys(ann).length === 0) {
        const s = document.getElementById('cttv-settings-status');
        s.textContent = 'Nothing to export.';
        s.dataset.error = '';
        return;
      }
      const out = {};
      for (const [k, v] of Object.entries(ann)) {
        const convId = k.replace('cttv-ann-', '');
        out[k] = { _url: `https://chatgpt.com/c/${convId}`, ...v };
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cttv-annotations.json';
      a.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
      document.body.appendChild(a);
      a.dispatchEvent(new MouseEvent('click', { bubbles: false }));
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      document.getElementById('cttv-settings-status').textContent = `Exported ${Object.keys(ann).length} conversation(s).`;
    });
  });

  document.getElementById('cttv-import-btn').addEventListener('click', async () => {
    let fileHandle;
    try {
      [fileHandle] = await window.showOpenFilePicker({ types: [{ accept: { 'application/json': ['.json'] } }] });
    } catch { return; }
    const file = await fileHandle.getFile();
    const text = await file.text();
    try {
      const imported = JSON.parse(text);
      const toSave = {};
      let count = 0;
      for (const [k, v] of Object.entries(imported)) {
        if (k.startsWith('cttv-ann-') && typeof v === 'object') {
          const { _url, ...rest } = v;
          toSave[k] = rest;
          count++;
        }
      }
      chrome.storage.local.set(toSave, () => {
        const currentKey = `cttv-ann-${conversationId}`;
        if (toSave[currentKey]) {
          cttvAnnotations = toSave[currentKey];
          refreshAllNodes();
        }
        document.getElementById('cttv-settings-status').textContent = `Imported ${count} conversation(s).`;
      });
    } catch {
      const s = document.getElementById('cttv-settings-status');
      s.textContent = 'Error: invalid file.';
      s.dataset.error = '';
    }
  });

  document.getElementById('cttv-export-md-btn').addEventListener('click', () => {
    if (!cttvTree) {
      const s = document.getElementById('cttv-settings-status');
      s.textContent = 'No conversation loaded.';
      s.dataset.error = '';
      return;
    }

    chrome.storage.local.get(['cttv-colorkey'], result => {
      const colorKey = result['cttv-colorkey'] || {};

      const COLOR_NAMES = {
        '#e55': 'Red',
        '#e93': 'Orange',
        '#9c9': 'Green',
        '#69f': 'Blue',
        '#c6f': 'Purple',
      };

      function colorLabel(hex) {
        return colorKey[hex] || COLOR_NAMES[hex] || hex;
      }

      function truncate(text, max) {
        if (!text || text.length <= max) return text || '';
        const cut = text.lastIndexOf(' ', max);
        return text.slice(0, cut > 0 ? cut : max) + '...';
      }

      const annotated = [];
      function walk(node) {
        if (node.role !== 'root') {
          const ann = cttvAnnotations[node.id] || {};
          if (ann.star || ann.color || ann.notes) {
            annotated.push({ node, ann });
          }
        }
        for (const child of (node.children || [])) walk(child);
      }
      walk(cttvTree);

      if (annotated.length === 0) {
        const s = document.getElementById('cttv-settings-status');
        s.textContent = 'Nothing to export — annotate some turns first.';
        s.dataset.error = '';
        return;
      }

      const convUrl = conversationId
        ? `https://chatgpt.com/c/${conversationId}`
        : '(unknown)';
      const dateStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

      const lines = [
        '# Chat Tree Export',
        `**Conversation:** ${convUrl}`,
        `**Exported:** ${dateStr}`,
        '',
        '---',
        '',
      ];

      for (const { node, ann } of annotated) {
        const roleLabel = node.role === 'user' ? 'User' : 'Assistant';
        const starPrefix = ann.star ? '★ ' : '';
        lines.push(`## ${starPrefix}Turn — ${roleLabel}`);
        if (ann.notes) lines.push(`**Notes:** ${ann.notes}`);
        if (ann.color) lines.push(`**Color:** ${colorLabel(ann.color)}`);
        lines.push('');
        lines.push(`> ${truncate(node.text, 300).replace(/\n/g, '\n> ')}`);
        lines.push('');
        lines.push('---');
        lines.push('');
      }

      const markdown = lines.join('\n');
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cttv-export-${conversationId || 'unknown'}.md`;
      a.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
      document.body.appendChild(a);
      a.dispatchEvent(new MouseEvent('click', { bubbles: false }));
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      document.getElementById('cttv-settings-status').textContent =
        `Exported ${annotated.length} annotated turn(s).`;
    });
  });

  document.getElementById('cttv-export-canvas-btn').addEventListener('click', () => {
    const s = document.getElementById('cttv-settings-status');
    if (!cttvTree) {
      s.textContent = 'No conversation loaded.';
      s.dataset.error = '';
      return;
    }

    const OBSIDIAN_COLOR = {
      '#e55': '1',
      '#e93': '2',
      '#9c9': '4',
      '#69f': '5',
      '#c6f': '6',
    };

    const STRIDE_X = 500;
    const STRIDE_Y = 200;
    const NODE_W = 250;
    const NODE_H = 100;
    const SAT_GAP = 30;
    const SAT_W = 200;
    const SAT_H = 100;

    function obsidianColor(ann) {
      if (ann?.color && OBSIDIAN_COLOR[ann.color]) return OBSIDIAN_COLOR[ann.color];
      if (ann?.star) return '3';
      return '';
    }

    const treeCopy = JSON.parse(JSON.stringify(cttvTree));
    layoutTree(treeCopy);
    const allNodes = flattenTree(treeCopy);

    const canvasNodes = [];
    const canvasEdges = [];

    for (const n of allNodes) {
      const ann = cttvAnnotations[n.id] || {};
      const x = n.col * STRIDE_X;
      const y = n.depth * STRIDE_Y;

      let nodeText = n.role === 'root' ? 'START' : n.text;
      if (ann.star) nodeText = '⭐ ' + nodeText;

      if (ann.unimportant) {
        canvasNodes.push({
          id: n.id, type: 'text', text: nodeText,
          x: Math.round(x), y: Math.round(y),
          width: 60, height: 30,
          color: obsidianColor(ann),
        });
      } else {
        canvasNodes.push({
          id: n.id, type: 'text', text: nodeText,
          x: Math.round(x), y: Math.round(y),
          width: NODE_W, height: NODE_H,
          color: obsidianColor(ann),
        });
      }

      if (ann.notes) {
        const satId = `sat-${n.id}`;
        canvasNodes.push({
          id: satId,
          type: 'text',
          text: `📝 ${ann.notes}`,
          x: Math.round(x + NODE_W + SAT_GAP),
          y: Math.round(y),
          width: SAT_W,
          height: Math.max(SAT_H, Math.min(400, Math.ceil(ann.notes.length / 33) * 22 + 24)),
          color: '5',
        });
        canvasEdges.push({
          id: `sat-edge-${n.id}`,
          fromNode: n.id,
          fromSide: 'right',
          toNode: satId,
          toSide: 'left',
          color: '',
        });
      }

      for (const child of (n.children || [])) {
        canvasEdges.push({
          id: `edge-${n.id}-${child.id}`,
          fromNode: n.id,
          fromSide: 'bottom',
          toNode: child.id,
          toSide: 'top',
          color: '',
        });
      }
    }

    if (cttvCanvasNotes.length > 0) {
      const MAP_PADDING = 20;
      cttvCanvasNotes.forEach((note) => {
        if (!note.text?.trim()) return;
        canvasNodes.push({
          id: `sticky-${note.id}`,
          type: 'text',
          text: note.text,
          x: Math.round((note.x - MAP_PADDING) * (STRIDE_X / NODE_STRIDE_X)),
          y: Math.round((note.y - MAP_PADDING) * (STRIDE_Y / NODE_STRIDE_Y)),
          width: note.width || 250,
          height: note.height || 150,
          color: '3',
        });
      });
    }

    const colorKeyEntries = Object.entries(cttvColorKey).filter(([k, label]) => k !== '_visible' && typeof label === 'string' && label.trim());
    if (colorKeyEntries.length > 0) {
      const keyX = -230;
      const keyNodeX = keyX + 10;
      const groupH = colorKeyEntries.length * 70 + 70;
      canvasNodes.push({
        id: 'colorkey-group',
        type: 'group',
        label: '🎨 Color Key',
        x: keyX,
        y: -10,
        width: 180,
        height: groupH,
        color: '',
      });
      canvasNodes.push({
        id: 'colorkey-header',
        type: 'text',
        text: '🎨 Color Key',
        x: keyNodeX,
        y: 0,
        width: 160,
        height: 50,
        color: '',
      });
      colorKeyEntries.forEach(([hex, label], i) => {
        canvasNodes.push({
          id: `colorkey-${hex.replace('#', '')}`,
          type: 'text',
          text: label,
          x: keyNodeX,
          y: 70 + i * 70,
          width: 160,
          height: 50,
          color: OBSIDIAN_COLOR[hex] || '',
        });
      });
    }

    const canvasJson = JSON.stringify({ nodes: canvasNodes, edges: canvasEdges }, null, 2);
    const blob = new Blob([canvasJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cttv-canvas-${conversationId || 'unknown'}.canvas`;
    a.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: false }));
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    s.textContent = `Exported ${canvasNodes.length} node(s) as Obsidian Canvas.`;
    delete s.dataset.error;
  });

  // Text/link drop on empty panel space → new sticky note
  const cttvBody = document.getElementById('cttv-body');
  cttvBody.addEventListener('dragover', (e) => {
    if (isCTTVDrag(e)) e.preventDefault();
  });
  cttvBody.addEventListener('drop', (e) => {
    if (!isCTTVDrag(e)) return;
    e.preventDefault();
    const content = getDragContent(e);
    if (content) createNoteFromDrag(content);
  });

  // Boot — adapter initialises prefs, conversation data, etc.
  adapter.boot({
    loadConversationData,
    loadAnnotations,
    applyPrefs,
    setConversationId(id) { conversationId = id; },
    selectNode,
    loadCanvasNotes,
    renderCanvasNotes,
    loadColorKey,
    renderColorKey,
  });

  return {
    selectNode,
    loadConversationData,
    loadAnnotations,
    applyPrefs,
    setConversationId(id) { conversationId = id; },
    getMapping: () => cttvMapping,
    getNodes: () => cttvNodes,
    getTree: () => cttvTree,
    getSelectedId: () => cttvSelectedId,
    refreshAllNodes,
    loadCanvasNotes,
    renderCanvasNotes,
    loadColorKey,
    renderColorKey,
    createNoteFromDrag,
  };
}
