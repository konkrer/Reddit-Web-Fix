'use strict';

// Service Worker script to manage communication between options and content scripts

// Maintain a map: tabId -> Port
const portsByTab = new Map();

// Listen for connection from content script
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'content') return;

  // sender.tab may be undefined for extension pages; for content scripts it's present
  const tabId = port.sender?.tab?.id;
  if (tabId == null) {
    return;
  }
  // Save port by tabId
  portsByTab.set(tabId, port);

  // Clean up when the content page navigates/closes or SW reloads
  port.onDisconnect.addListener(() => {
    if (portsByTab.get(tabId) === port) {
      portsByTab.delete(tabId);
    }
  });
});

// Send message to a particular tab
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

// Send message to all ports (all tabs running extension)
function broadcast(message) {
  for (const [tabId, port] of portsByTab.entries()) {
    try {
      port.postMessage(message);
    } catch (e) {
      portsByTab.delete(tabId);
    }
  }
}

function handleSetVerbose(msg) {
  if (typeof msg.tabId === 'number') {
    sendToTab(msg.tabId, msg);
  } else {
    broadcast(msg);
  }
}

// Listen for messages from options pages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'SET_VERBOSE') {
    try {
      handleSetVerbose(msg);
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({ ok: false, error: err });
    }
  }
});
