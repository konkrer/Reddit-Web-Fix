'use strict';

// Content script to manage vote state syncing on www.reddit.com

// placeholders for imports and instances
let VoteSync, PostObserver, HrefObserver; // class imports
let VS, PO, HO; // instances 
let VERBOSE = false;

// List of URL path prefixes where the extension should be inactive
const BLOCKED_PREFIXES = ['/settings', '/drafts', '/premium', '/reddit-pro'];
function isBlockedPath() {
  return BLOCKED_PREFIXES.some(p => location.pathname.startsWith(p));
}

// Cleanup function for extension unloading.
function cleanup() {
  if (PO) PO.stopMainObserver();
  if (HO) HO.stopHrefPoller();
  if (VS) VS.removeHandlersFromPosts();
  console.log('Reddit Web Fix: shut down.');
}

// set up communication port
(() => {
  let PORT;
  // Initialize connection to background script
  function initPort() {
    if (PORT) return;
    try {
      PORT = chrome.runtime.connect({ name: 'content' });

      // Let background know which tab we are (sender.tab.id is also available there)
      PORT.postMessage({ type: 'hello' });

      // Parse messages over PORT
      PORT.onMessage.addListener(msg => {
        if (msg.type === 'SET_VERBOSE') {
          VERBOSE = msg.value;
          if (VS) {
            VS.verbose = msg.value;
            console.debug('Verbose mode updated:', msg.value);
          } else {
            console.debug(
              'Verbose mode set, but VoteSync not initialized yet:',
              msg.value
            );
          }
        } else if (msg.type === 'CLEANUP') {
          cleanup();
        }
      });

      PORT.onDisconnect.addListener(() => {
        PORT = null;
        setTimeout(() => {
          // if no runtime context cleanup
          if (!chrome.runtime?.id) cleanup();
          // otherwise attempt to reconnect
          else initPort();
        }, 1000);
      });
    } catch (err) {
      console.debug('Port setup failed:', err.message);
      cleanup();
    }
  }
  initPort();
})();

// Load the browser polyfill for async compatibility
const polyfillURL = chrome.runtime.getURL(
  'src/polyfill/browser-polyfill.min.js'
);
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

// Function to initialize VoteSync, PostObserver, share methods,
// and start observing DOM changes.
function startup(HO) {
  VS = new VoteSync(VERBOSE, isBlockedPath, HO);
  PO = new PostObserver(VS);
  VS.PO = PO;
  HO.PO = PO;
  HO.VS = VS;
  PO.startMainObserver();
}

// Initial load and initialization
(async function loadAndInit() {
  // Dynamically import VoteSync and Observer modules
  try {
    const voteSyncProm = import(
      chrome.runtime.getURL('src/content/VoteSync.js')
    );
    const observerProm = import(
      chrome.runtime.getURL('src/content/observers.js')
    );
    const [observerMod, voteSyncMod] = await Promise.all([
      observerProm,
      voteSyncProm,
    ]);
    const mod = voteSyncMod && observerMod;
    if (mod) {
      VoteSync = voteSyncMod.default;
      ({ PostObserver, HrefObserver } = observerMod);
    } else {
      throw new Error('Failed to load VoteSync or PostObserver modules');
    }

    // Initial startup
    HO = new HrefObserver(isBlockedPath, VERBOSE, startup);

    if (isBlockedPath()) {
      HO.startHrefPoller(500);
    } else {
      // normal operation
      startup(HO);
    }
    console.log('Reddit Web Fix: activated.');
  } catch (err) {
    console.error('Failed to Initialize Reddit Web Fix:', err);
  }
})();
