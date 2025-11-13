'use strict';

// Content script to manage vote state syncing on www.reddit.com

// List of URL path prefixes where the extension should be inactive
const BLOCKED_PREFIXES = ['/settings', '/drafts', '/premium', '/reddit-pro'];

// placeholders for imports and instances
let VoteSync, MainObserver, HrefObserver, Appearance, AutoScroll; // class imports
let CO; // instances
let VERBOSE = false;

/**
 * Coordinator class to manage the overall functionality for the Reddit Web Fix extension
 * @class RedditFixCoordinator
 */
class RedditFixCoordinator {
  /**
   * Initialize the coordinator with all extension modules
   * @param {boolean} verbose - Enable verbose logging
   */
  constructor(verbose) {
    this.hrefObserver = new HrefObserver(this);
    this.voteSync = null;
    this.mainObserver = null;
    this.autoScroll = null;
    this.verbose = verbose;
    this.guardedStart();
  }

  /**
   * Check if the current URL path is in the blocked list
   * @returns {boolean} True if current path should be blocked
   */
  isBlockedPath() {
    return BLOCKED_PREFIXES.some(p => location.pathname.startsWith(p));
  }

  /**
   * Start the extension based on the current path (blocked or active)
   */
  guardedStart() {
    if (this.isBlockedPath()) {
      this.startHrefPoller(500);
    } else {
      this.startup();
    }
  }

  /**
   * Initialize and start all extension modules
   */
  startup() {
    this.appearance = new Appearance(this);
    this.voteSync = new VoteSync(this);
    this.mainObserver = new MainObserver(this);
    this.autoScroll = new AutoScroll(this);
    this.mainObserver.startMainObserver();
  }

  /**
   * Clean up and shut down all extension modules
   */
  cleanUp() {
    if (this.mainObserver) this.mainObserver.stopMainObserver();
    if (this.hrefObserver) this.hrefObserver.stopHrefPoller();
    if (this.voteSync) this.voteSync.removeHandlersFromPosts();
    if (this.autoScroll) this.autoScroll.removeDragListener();
    this.log('Reddit Web Fix: shut down.');
  }

  /**
   * Test if current page is a Reddit detail/comments page
   * @returns {boolean} True if on a detail/comments page
   */
  testForDetailPage() {
    return /^https?:\/\/(www\.)?reddit.com\/r\/.+\/comments\/.+/.test(
      window.location.href
    );
  }

  /**
   * Test if current page is a Reddit search page
   * @returns {boolean} True if on a search page
   */
  testForSearchPage() {
    return /^https?:\/\/(www\.)?reddit.com\/search\/.+/.test(
      window.location.href
    );
  }

  // Proxy methods that other classes need
  /**
   * Test if page has changed and update vote sync state
   * @param {number} [addDelay=0] - Additional delay in milliseconds
   */
  testForPageChange(addDelay = 0) {
    return this.voteSync?.testForPageChange(addDelay);
  }

  /**
   * Add a post element to vote sync tracking
   * @param {HTMLElement} post - Post element to sync
   */
  addSyncPost(post) {
    this.voteSync?.addSyncPost(post);
  }

  /**
   * Start the main DOM mutation observer
   */
  startMainObserver() {
    this.mainObserver?.startMainObserver();
  }

  /**
   * Stop the main DOM mutation observer
   */
  stopMainObserver() {
    this.mainObserver?.stopMainObserver();
  }

  /**
   * Start the URL change polling observer
   */
  startHrefPoller() {
    this.hrefObserver?.startHrefPoller();
  }

  /**
   * Apply background styling to the page
   */
  applyBackground() {
    setTimeout(() => {
      this.appearance?.applyBackground();
    }, 0);
  }

  /**
   * Remove background styling from the page
   */
  clearBackground() {
    this.appearance?.clearBackground();
  }

  /**
   * Enable drag scroll functionality
   */
  addAutoScroll() {
    // ideal shorter delay to allow for proper page detection
    setTimeout(() => {
      this.autoScroll?.addAutoScrollListener();
    }, 100);
    // fallback longer delay to allow for proper page detection
    setTimeout(() => {
      this.autoScroll?.addAutoScrollListener();
    }, 500);
  }

  /**
   * Disable drag scroll functionality
   */
  removeAutoScroll() {
    this.autoScroll?.removeAutoScrollListeners();
  }

  /**
   * Log message if verbose mode is enabled
   * @param {string} message - Message to log
   * @param {*} [data=''] - Optional data to log
   */
  log(message, data = '') {
    if (this.verbose) {
      console.debug(message, data);
    }
  }
}

/**
 * Handle messages received from background script via port
 * @param {Object} msg - Message object
 * @param {string} msg.type - Message type
 * @param {*} [msg.value] - Message value
 */
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

/**
 * Handle port disconnection (extension reload or uninstall)
 * @param {Function} initPort - Function to reinitialize the port
 */
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

/**
 * Dynamically import all required extension modules
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If modules fail to load
 */
async function loadModules() {
  const voteSyncProm = import(chrome.runtime.getURL('src/content/VoteSync.js'));
  const observerProm = import(
    chrome.runtime.getURL('src/content/observers.js')
  );
  const appearanceProm = import(
    chrome.runtime.getURL('src/content/Appearance.js')
  );
  const autoScrollProm = import(
    chrome.runtime.getURL('src/content/AutoScroll.js')
  );
  const [observerMod, voteSyncMod, appearanceMod, autoScrollMod] =
    await Promise.all([
      observerProm,
      voteSyncProm,
      appearanceProm,
      autoScrollProm,
    ]);
  if (voteSyncMod && observerMod && appearanceMod && autoScrollMod) {
    VoteSync = voteSyncMod.default;
    ({ MainObserver, HrefObserver } = observerMod);
    Appearance = appearanceMod.default;
    AutoScroll = autoScrollMod.default;
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
