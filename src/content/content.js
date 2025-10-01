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

// Cleanup function for extension unloading.
function cleanup() {
  if (PO) PO.stopMainObserver();
  if (HO) HO.stopHrefPoller();
  if (VS) VS.removeHandlersFromPosts();
  console.log('Reddit Web Fix: shut down.');
}

function handlePortMessage(msg) {
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
}

function handlePortDisconnect(initPort) {
  setTimeout(() => {
    if (!chrome.runtime?.id) {
      cleanup();
    } else {
      initPort();
    }
  }, 1000);
}

// Set up for communication port to background script.
(async () => {
  let PORT;

  // Port setup function.
  function initPort() {
    if (PORT) return;
    try {
      PORT = chrome.runtime.connect({ name: 'content' });

      // Ping background script to convey this script's tab ID.
      PORT.postMessage({ type: 'hello' });

      // Parse incoming messages over PORT
      PORT.onMessage.addListener(handlePortMessage);

      // Declare what to do on port disconnect.
      PORT.onDisconnect.addListener(() => {
        PORT = null;
        handlePortDisconnect(initPort);
      });
    } catch (err) {
      console.debug('Port setup failed:', err.message);
      cleanup();
    }
  }
  // Initialize connection to background script.
  initPort();
})();

// Load the browser polyfill for browser API async compatibility
// and load debug setting from storage to verbose state.
(async () => {
  try {
    const polyfillURL = chrome.runtime.getURL(
      'src/polyfill/browser-polyfill.min.js'
    );
    await import(polyfillURL);

    const storageMod = await import(
      chrome.runtime.getURL('src/utils/storage.js')
    );
    const getDebug = storageMod.getGetDebug(browser);
    const debug = await getDebug();
    VERBOSE = debug;
    if (VS) {
      VS.verbose = debug;
    }
  } catch (err) {
    console.error('Failed to load polyfill or storage module:', err);
  }
})();

async function loadModules() {
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
  if (voteSyncMod && observerMod) {
    VoteSync = voteSyncMod.default;
    ({ PostObserver, HrefObserver } = observerMod);
  } else {
    throw new Error('Failed to load VoteSync or PostObserver modules');
  }
}

// Load and initialization of business logic.
(async function loadAndInit() {
  // Dynamically import VoteSync and Observer modules
  try {
    await loadModules();

    // Initial startup.
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
