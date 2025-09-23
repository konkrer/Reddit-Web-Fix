// Maintain a map: tabId -> Port
const portsByTab = new Map();

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'content') return;

  // sender.tab may be undefined for extension pages; for content scripts it's present
  const tabId = port.sender?.tab?.id;
  if (tabId == null) {
    return;
  }

  portsByTab.set(tabId, port);

  port.onDisconnect.addListener(() => {
    // Clean up when the content page navigates/closes or SW reloads
    if (portsByTab.get(tabId) === port) {
      portsByTab.delete(tabId);
    }
  });
});

function sendToTab(tabId, message) {
  const port = portsByTab.get(tabId);
  if (port) {
    try {
      port.postMessage(message);
      return true;
    } catch (e) {
      // If it throws, drop the port
      portsByTab.delete(tabId);
    }
  }
  return false;
}

function broadcast(message) {
  for (const [tabId, port] of portsByTab.entries()) {
    try {
      port.postMessage(message);
    } catch (e) {
      portsByTab.delete(tabId);
    }
  }
}

// Listen for messages from options pages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'SET_VERBOSE') {
    if (typeof msg.tabId === 'number') {
      sendToTab(msg.tabId, msg);
    } else {
      broadcast(msg);
    }
    sendResponse({ ok: true });
  }
});
