'use strict';

/**
 * Service Worker script to manage communication between options and content scripts
 * @file serviceWorker.js
 */

/**
 * Map of tab IDs to their corresponding ports
 * @type {Map<number, chrome.runtime.Port>}
 */
const portsByTab = new Map();

/**
 * Listen for connections from content scripts and manage port lifecycle
 */
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

/**
 * Listen for messages from options pages and route them appropriately
 */
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

/**
 * Handle SET_VERBOSE message by sending to specific tab or broadcasting
 * @param {Object} msg - Message object
 * @param {number} [msg.tabId] - Optional tab ID to target specific tab
 */
function handleSetVerbose(msg) {
  if (typeof msg.tabId === 'number') {
    sendToTab(msg.tabId, msg);
  } else {
    broadcast(msg);
  }
}

/**
 * Send message to a specific tab via its port
 * @param {number} tabId - Tab ID to send message to
 * @param {Object} message - Message object to send
 * @returns {boolean} True if message was sent successfully
 */
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

/**
 * Broadcast message to all connected tabs
 * @param {Object} message - Message object to broadcast
 */
function broadcast(message) {
  for (const [tabId, port] of portsByTab.entries()) {
    try {
      port.postMessage(message);
    } catch (e) {
      portsByTab.delete(tabId);
    }
  }
}
