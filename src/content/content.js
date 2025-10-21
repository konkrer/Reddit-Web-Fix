'use strict';

// Content script to manage vote state syncing on www.reddit.com

// List of URL path prefixes where the extension should be inactive
const BLOCKED_PREFIXES = ['/settings', '/drafts', '/premium', '/reddit-pro'];

// placeholders for imports and instances
let VoteSync, MainObserver, HrefObserver, Appearance, DragScroll; // class imports
let CO; // instances
let VERBOSE = false;

// Coordinator Class to manage the overall functionality for the Reddit Web Fix extension
class RedditFixCoordinator {
  constructor(verbose) {
    this.hrefObserver = new HrefObserver(this);
    this.voteSync = null;
    this.mainObserver = null;
    this.dragScroll = null;
    this.verbose = verbose;
    this.guardedStart();
  }

  // Check if the current path is blocked
  isBlockedPath() {
    return BLOCKED_PREFIXES.some(p => location.pathname.startsWith(p));
  }

  // Start the extension based on the current path
  guardedStart() {
    if (this.isBlockedPath()) {
      this.startHrefPoller(500);
    } else {
      this.startup();
    }
  }

  // Start the extension
  startup() {
    this.appearance = new Appearance(this);
    this.voteSync = new VoteSync(this);
    this.mainObserver = new MainObserver(this);
    this.dragScroll = new DragScroll();
    this.mainObserver.startMainObserver();
  }

  // Clean up the extension
  cleanUp() {
    if (this.mainObserver) this.mainObserver.stopMainObserver();
    if (this.hrefObserver) this.hrefObserver.stopHrefPoller();
    if (this.voteSync) this.voteSync.removeHandlersFromPosts();
    if (this.dragScroll) this.dragScroll.removeDragListener();
    this.log('Reddit Web Fix: shut down.');
  }

  // Proxy methods that other classes need
  testForPageChange(addDelay = 0) {
    this.voteSync?.testForPageChange(addDelay);
  }
  addSyncPost(post) {
    this.voteSync?.addSyncPost(post);
  }
  startMainObserver() {
    this.mainObserver?.startMainObserver();
  }
  stopMainObserver() {
    this.mainObserver?.stopMainObserver();
  }
  startHrefPoller() {
    this.hrefObserver?.startHrefPoller();
  }
  applyBackground() {
    setTimeout(() => {
      this.appearance?.applyBackground();
    }, 0);
  }
  clearBackground() {
    this.appearance?.clearBackground();
  }
  addDragScroll() {
    this.dragScroll?.addDragListener();
  }
  removeDragScroll() {
    this.dragScroll?.removeDragListener();
  }

  log(message, data = '') {
    if (this.verbose) {
      console.debug(message, data);
    }
  }
}

function handlePortMessage(msg) {
  if (msg.type === 'SET_VERBOSE') {
    VERBOSE = msg.value;
    if (CO) {
      CO.verbose = msg.value;
      console.debug('Verbose mode updated:', msg.value);
    } else {
      console.debug(
        'Verbose mode set, but VoteSync not initialized yet:',
        msg.value
      );
    }
  } else if (msg.type === 'CLEANUP') {
    CO.cleanUp();
  }
}

function handlePortDisconnect(initPort) {
  setTimeout(() => {
    if (!chrome.runtime?.id) {
      CO.cleanUp();
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
      CO.cleanUp();
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
    if (CO) {
      CO.verbose = debug;
    }
  } catch (err) {
    console.error('Failed to load polyfill or storage module:', err);
  }
})();

async function loadModules() {
  const voteSyncProm = import(chrome.runtime.getURL('src/content/VoteSync.js'));
  const observerProm = import(
    chrome.runtime.getURL('src/content/observers.js')
  );
  const appearanceProm = import(
    chrome.runtime.getURL('src/content/Appearance.js')
  );
  const dragScrollProm = import(
    chrome.runtime.getURL('src/content/DragScroll.js')
  );
  const [observerMod, voteSyncMod, appearanceMod, dragScrollMod] =
    await Promise.all([
      observerProm,
      voteSyncProm,
      appearanceProm,
      dragScrollProm,
    ]);
  if (voteSyncMod && observerMod && appearanceMod) {
    VoteSync = voteSyncMod.default;
    ({ MainObserver, HrefObserver } = observerMod);
    Appearance = appearanceMod.default;
    DragScroll = dragScrollMod.default;
  } else {
    throw new Error('Failed to load modules.');
  }
}

// Load and initialization of business logic.
(async function loadAndInit() {
  // Dynamically import modules
  try {
    await loadModules();

    // Initial startup.
    CO = new RedditFixCoordinator(VERBOSE);

    console.log('Reddit Web Fix: activated.');
  } catch (err) {
    console.error('Failed to Initialize Reddit Web Fix:', err);
  }
})();
