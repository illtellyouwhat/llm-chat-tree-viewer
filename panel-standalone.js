// Detached window entry point. DOM is provided by panel.html.
// Shared logic lives in panel-core.js (loaded first via panel.html).
//
// PARITY RULE: This popout and the inline panel (content.js) are the SAME map in two windows.
// They must always look and behave identically. See panel-core.js for the full rule.
// boot() here must follow the same sequencing as content.js: prefs first, then conversation data.
// Any message-driven update (conversationReloaded, etc.) must produce the same result as the
// equivalent inline reload would.

document.getElementById('cttv-close').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'popoutClosing' });
});

const { loadConversationData, applyPrefs } = initPanel({
  onNodeClick(nodeId) {
    chrome.tabs.query({ url: 'https://chatgpt.com/*' }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'navigateTo', nodeId });
    });
  },

  onAnnotationsSaved() {
    chrome.tabs.query({ url: 'https://chatgpt.com/*' }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'annotationsUpdated' });
    });
  },

  onPrefsSaved(prefs) {
    chrome.tabs.query({ url: 'https://chatgpt.com/*' }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'prefsUpdated', prefs });
    });
  },

  boot({ loadConversationData, loadAnnotations, applyPrefs, setConversationId, loadCanvasNotes, renderCanvasNotes }) {
    chrome.storage.local.get(['cttv-handoff', 'cttv-prefs'], (result) => {
      applyPrefs(result['cttv-prefs'] || {});
      const handoff = result['cttv-handoff'];
      if (!handoff?.conversationId || !handoff?.data) {
        document.getElementById('cttv-error').textContent = 'No conversation loaded. Open Chat Tree from a ChatGPT tab first.';
        document.getElementById('cttv-error').style.display = 'block';
        return;
      }
      setConversationId(handoff.conversationId);
      loadAnnotations(() => {
        loadCanvasNotes(() => {
          renderCanvasNotes();
          loadConversationData(handoff.data, handoff.selectedId || null);
        });
      });
    });
  },
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'conversationReloaded') {
    loadConversationData(msg.data, msg.selectedId);
  } else if (msg.type === 'prefsUpdated') {
    applyPrefs(msg.prefs);
  } else if (msg.type === 'closePanel') {
    chrome.runtime.sendMessage({ type: 'closePopout' });
  }
});
