'use strict';

// Reddit elements of interest.
// The reddit-named html element with post data that is a shadow host.
const REDDIT_MUTATION_OBSERVER_SELECTOR = 'shreddit-app';
const REDDIT_POST_HOST = 'shreddit-post'; // Shadow host element for posts. Update here and in VoteSync.js if changed.
// The reddit elements that may get dynamically added to page and are watched and handled.
const REDDIT_DYN_ADD_1 = 'article'; // element name for post parent
const REDDIT_DYN_ADD_2 = 'faceplate-batch'; // alternate element name for post parent
const REDDIT_DYN_ADD_3 = 'grid-container'; // class name for grid parent for customizations
const REDDIT_DYN_ADD_4 = 'search-dynamic-id-cache-controller'; // element name for grid parent on search page

/**
 * Class to manage and observe DOM changes for vote syncing and customizations.
 * @class MainObserver
 */
export class MainObserver {
  /**
   * Initialize the main DOM mutation observer
   * @param {Object} coordinator - RedditFixCoordinator instance
   */
  constructor(coordinator) {
    this.coordinator = coordinator;
    this.observer = null;
  }

  /**
   * Start observing DOM changes to detect dynamically loaded posts
   * and test for page changes
   */
  startMainObserver() {
    if (this.observer) return;
    this.observer = new MutationObserver(this._processMutationList);
    try {
      this.observer.observe(
        document.querySelector(REDDIT_MUTATION_OBSERVER_SELECTOR),
        { childList: true, subtree: true }
      );
      this.coordinator.log('Reddit Web Fix: main observer started.');
    } catch (e) {
      console.error('Reddit Web Fix: failed to start observer', e);
    }
  }

  /**
   * Stop observing DOM changes and disconnect the observer
   */
  stopMainObserver() {
    if (!this.observer) return;
    try {
      this.observer.disconnect();
    } catch (e) {
      /* ignore */
    }
    this.observer = null;
    this.coordinator.log('Reddit Web Fix: main observer stopped.');
  }

  /**
   * Process mutation list from MutationObserver
   * @param {MutationRecord[]} mutationList - List of mutations
   * @private
   */
  _processMutationList = mutationList => {
    if (this.coordinator.testForPageChange()) this.coordinator.addAutoScroll();
    for (const mutation of mutationList) {
      if (mutation.type === 'childList') {
        this._processNodes(mutation.addedNodes);
      }
    }
  };

  /**
   * Process a list of added nodes
   * @param {NodeList} nodes - List of nodes to process
   * @private
   */
  _processNodes(nodes) {
    for (let node of nodes) {
      if (this._postParentFilter(node)) {
        this._processPostParentNode(node);
      } else if (this._gridParentFilter(node)) {
        this._processGridParentNode(node);
      }
    }
  }

  /**
   * Filter to identify post parent elements
   * @param {Node} node - DOM node to check
   * @returns {boolean} True if node is a post parent
   * @private
   */
  _postParentFilter(node) {
    return (
      node.nodeType === Node.ELEMENT_NODE &&
      (node.tagName.toLowerCase() === REDDIT_DYN_ADD_1 ||
        node.tagName.toLowerCase() === REDDIT_DYN_ADD_2)
    );
  }
  /**
   * Process a node that contains Reddit post elements
   * @param {Node} node - DOM node containing posts
   * @private
   */
  _processPostParentNode(node) {
    const posts = node.querySelectorAll?.(REDDIT_POST_HOST);
    posts?.forEach(p => setTimeout(() => this.coordinator.addSyncPost(p), 0));
    this.coordinator.log('New post containing element processed.');
  }

  /**
   * Filter to identify grid parent elements
   * @param {Node} node - DOM node to check
   * @returns {boolean} True if node is a grid parent
   * @private
   */
  _gridParentFilter(node) {
    return (
      node.nodeType === Node.ELEMENT_NODE &&
      (node.classList.contains(REDDIT_DYN_ADD_3) ||
        node.tagName.toLowerCase() === REDDIT_DYN_ADD_4)
    );
  }

  /**
   * Process grid container node and apply background/drag scroll
   * @param {Node} node - Grid container DOM node
   * @private
   */
  _processGridParentNode(node) {
    if (!this.coordinator.isBlockedPath()) {
      this.coordinator.applyBackground();
      this.coordinator.log('Grid container processed.');
    }
  }
}

/**
 * Class to monitor URL changes in single-page application navigation
 * while mutation observer is paused (e.g., on blocked paths) and restart
 * DOM work when navigating back to unblocked paths
 * @class HrefObserver
 */
export class HrefObserver {
  /**
   * Initialize the URL change polling observer
   * @param {Object} coordinator - RedditFixCoordinator instance
   */
  constructor(coordinator) {
    this.coordinator = coordinator;
    this.pollerId = null;
  }

  /**
   * Start polling for URL changes
   * @param {number} [interval=500] - Polling interval in milliseconds
   */
  startHrefPoller(interval = 500) {
    if (this.pollerId) return;
    let lastHref = location.href;
    this.pollerId = setInterval(
      () => (lastHref = this._handleHrefChange(lastHref)),
      interval
    );
    this.coordinator.log('Reddit Web Fix: href poller started.');
  }

  /**
   * Stop polling for URL changes
   */
  stopHrefPoller() {
    if (!this.pollerId) return;
    clearInterval(this.pollerId);
    this.pollerId = null;
    this.coordinator.log('Reddit Web Fix: href poller stopped.');
  }

  /**
   * Handle URL changes and restart extension if navigating to unblocked path
   * @param {string} lastHref - Last known URL
   * @returns {string} Current or updated URL
   * @private
   */
  _handleHrefChange(lastHref) {
    // if the href has not changed, return the last href
    if (location.href === lastHref) {
      return lastHref;
    }

    // update the last href
    lastHref = location.href;
    // if the path is blocked, return the last href
    if (this.coordinator.isBlockedPath()) {
      return lastHref;
    }

    this.stopHrefPoller();
    // wait a bit to let the page load completely
    setTimeout(() => {
      if (this.coordinator.voteSync) {
        this.coordinator.testForPageChange(1000);
        this.coordinator.startMainObserver();
        this.coordinator.applyBackground();
        this.coordinator.addAutoScroll();
      } else {
        // loaded on blocked page, now we must start the extension
        this.coordinator.startup(this);
      }
    }, 100);

    return lastHref;
  }
}
