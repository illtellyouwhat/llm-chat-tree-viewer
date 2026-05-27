let popoutWindowId = null;

function reopenPanel() {
  chrome.tabs.query({ url: 'https://chatgpt.com/*' }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: 'reopenPanel' }, () => void chrome.runtime.lastError);
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'isPopoutOpen') {
    sendResponse({ open: popoutWindowId !== null });
    return;
  }
  if (msg.type === 'detach') {
    chrome.windows.create({
      url: chrome.runtime.getURL('panel.html'),
      type: 'popup',
      width: 500,
      height: 800
    }, (win) => {
      popoutWindowId = win.id;
    });
  } else if (msg.type === 'popoutClosing') {
    // Popout X button clicked — close it and reopen the injected panel
    if (popoutWindowId !== null) {
      chrome.windows.remove(popoutWindowId);
      popoutWindowId = null;
    }
    reopenPanel();
  } else if (msg.type === 'closePopout') {
    // Navigation-driven close — just close the window, don't reopen the injected panel
    if (popoutWindowId !== null) {
      chrome.windows.remove(popoutWindowId);
      popoutWindowId = null;
    }
  }
});

// Clean up if user closes popout via OS window controls (no reopenPanel here)
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popoutWindowId) popoutWindowId = null;
});

chrome.action.onClicked.addListener((tab) => {
  if (popoutWindowId !== null) {
    // Close popout and reopen injected panel
    chrome.windows.remove(popoutWindowId);
    popoutWindowId = null;
    reopenPanel();
    return;
  }

  if (tab.url?.includes('claude.ai')) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['panel-core.js', 'claude-content.js']
    }).catch(() => {});
  } else {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["bridge.js"],
      world: "MAIN"
    }).then(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["panel-core.js", "content.js"]
      }).catch(() => {});
    }).catch(() => {});
  }
  chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ["panel.css"]
  }).catch(() => {});
});
