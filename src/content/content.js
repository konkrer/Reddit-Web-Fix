'use strict';

// Content script to manage vote state syncing on www.reddit.com

// List of URL path prefixes where the extension should be inactive
const BLOCKED_PREFIXES = ['/settings', '/drafts', '/premium', '/reddit-pro'];
function isBlockedPath() {
  return BLOCKED_PREFIXES.some(p => location.pathname.startsWith(p));
}

// placeholders for imported modules and constants
let VoteSync;
let VS;
let VERBOSE = false;

// set up communication port
(() => {
  let port;
  // Initialize connection to background script
  function initPort() {
    if (port) return;
    port = chrome.runtime.connect({ name: 'content' });

    // Let background know which tab we are (sender.tab.id is also available there)
    port.postMessage({ type: 'hello' });

    port.onMessage.addListener(msg => {
      if (msg.type === 'SET_VERBOSE') {
        VERBOSE = msg.value;
        if (VS) VS.verbose = msg.value;
        console.debug('Verbose mode updated:', msg.value);
      }
    });

    port.onDisconnect.addListener(() => {
      port = null;
      // Attempt to reconnect
      setTimeout(initPort, 1000);
    });
  }
  initPort();
})();

// Load the browser polyfill for async compatibility
const polyfillURL = chrome.runtime.getURL('src/polyfill/browser-polyfill.min.js');
import(polyfillURL)
  .then(() => {
    // dynamically import storage module to get getGetDebug function
    const storage = chrome.runtime.getURL('src/utils/storage.js');
    import(storage)
      .then(mod => {
        const getDebug = mod.getGetDebug(browser);
        (async () => {
          // get debug setting from storage and set local variable verbose
          const debug = await getDebug();
          VERBOSE = debug;
          if (VS) VS.verbose = debug;
        })();
      })
      .catch(err => console.error('Failed to load storage module:', err));
  })
  .catch(err => {
    console.error('Failed to load browser polyfill:', err);
  });

// Observe DOM changes to detect new posts loaded dynamically
// and add event handlers to them and sync their state.
// Also test for page changes.
let mainObserver = null;
function startMainObserver() {
  if (mainObserver) return;
  mainObserver = new MutationObserver(mutationsList => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        VS.testForPageChange();
        mutation.addedNodes.forEach(node => {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node.tagName.toLowerCase() === 'article' ||
              node.tagName.toLowerCase() === 'faceplate-batch')
          ) {
            const sp = node.querySelectorAll?.('shreddit-post');
            sp?.forEach(p => {
              setTimeout(() => {
                VS.addHandlersToShredditPosts([p]);
                if (VS.sessionStorage[p.id]) VS.syncLikes(p.id);
              }, 0);
            });
            if (VS.verbose)
              console.debug('New article/ faceplate-batch processed.');
          }
        });
      }
    }
  });
  try {
    mainObserver.observe(document.body, { childList: true, subtree: true });
    if (VERBOSE) console.debug('Reddit Web Fix: main observer started.');
  } catch (e) {
    console.error('Reddit Web Fix: failed to start observer', e);
  }
}

function stopMainObserver() { 
  if (!mainObserver) return;
  try {
    mainObserver.disconnect();
  } catch (e) {
    /* ignore */
  }
  mainObserver = null;
  if (VERBOSE) console.debug('Reddit Web Fix: main observer stopped.');
}

let pollerId = null;
function startHrefPoller(interval = 500) {
  if (pollerId) return;
  let lastHref = location.href;
  pollerId = setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      // only restart DOM work once we've left a blocked path
      if (!isBlockedPath()) {
        stopHrefPoller();
        // small delay to let the new page render
        setTimeout(() => {
          if (VS) VS.testForPageChange(100);
          else VS = new VoteSync();
          startMainObserver();
        }, 100);
      }
    }
  }, interval);
  if (VERBOSE) console.debug('Reddit Web Fix: href poller started.');
}

function stopHrefPoller() {
  if (!pollerId) return;
  clearInterval(pollerId);
  pollerId = null;
  if (VERBOSE) console.debug('Reddit Web Fix: href poller stopped.');
}

(async function loadAndInit() {
  try {
    const voteSyncURL = chrome.runtime.getURL('src/content/VoteSync.js');
    const mod = await import(voteSyncURL);
    if (mod) {
      VoteSync = mod.default;
    } else {
      throw new Error('Failed to load VoteSync module');
    }

    // Initial startup
    if (isBlockedPath()) {
      startHrefPoller(500);
    } else {
      // normal operation
      VS = new VoteSync(VERBOSE);
      startMainObserver();
    }
    console.log('Reddit Web Fix: activated.');
  } catch (err) {
    console.error('Failed to Initialize Reddit Web Fix:', err);
  }
})();
