'use strict';

// Reddit elements of interest.
// The reddit-named html element with post data that is a shadow host.
const REDDIT_POST_HOST = 'shreddit-post'; // Update here and in VoteSync.js.
// The reddit elements that may get dynamically added to page and are watched and handled.
const REDDIT_DYN_ADD_1 = 'article'; // element name for post parent
const REDDIT_DYN_ADD_2 = 'faceplate-batch'; // alternate element name for post parent
const REDDIT_DYN_ADD_3 = 'grid-container'; // class name for grid parent for background
const REDDIT_DYN_ADD_4 = 'search-dynamic-id-cache-controller'; // element name for grid parent on search page

// Class to manage and observe DOM changes for vote button syncing
export class MainObserver {
  constructor(coordinator) {
    this.coordinator = coordinator;
    this.observer = null;
  }

  _processPostParentNode(node) {
    const posts = node.querySelectorAll?.(REDDIT_POST_HOST);
    posts?.forEach(p => setTimeout(() => this.coordinator.addSyncPost(p), 0));
    this.coordinator.log('New post containing element processed.');
  }

  // Apply the background to the grid container - which is its own "parent".
  _processGridParentNode(node) {
    this.coordinator.applyBackground();
    this.coordinator.addDragScroll();
    this.coordinator.log('Grid container processed.');
  }

  _postParentFilter(node) {
    return (
      node.nodeType === Node.ELEMENT_NODE &&
      (node.tagName.toLowerCase() === REDDIT_DYN_ADD_1 ||
        node.tagName.toLowerCase() === REDDIT_DYN_ADD_2)
    );
  }

  _gridParentFilter(node) {
    return (
      node.nodeType === Node.ELEMENT_NODE &&
      (node.classList.contains(REDDIT_DYN_ADD_3) ||
        node.tagName.toLowerCase() === REDDIT_DYN_ADD_4)
    );
  }

  _processNodes(nodes) {
    for (let node of nodes) {
      if (this._postParentFilter(node)) {
        this._processPostParentNode(node);
      } else if (this._gridParentFilter(node)) {
        this._processGridParentNode(node);
      }
    }
  }

  _processMutationList = mutationList => {
    this.coordinator.testForPageChange();
    for (const mutation of mutationList) {
      if (mutation.type === 'childList') {
        this._processNodes(mutation.addedNodes);
      }
    }
  };

  // Observe DOM changes to detect new posts loaded dynamically
  // and add event handlers to them and sync their state.
  // Also test for page changes.
  startMainObserver() {
    if (this.observer) return;
    this.observer = new MutationObserver(this._processMutationList);
    try {
      this.observer.observe(document.body, { childList: true, subtree: true });
      this.coordinator.log('Reddit Web Fix: main observer started.');
    } catch (e) {
      console.error('Reddit Web Fix: failed to start observer', e);
    }
  }

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
}

// Class to monitor URL changes in single-page application navigation while mutation
// observer is paused (e.g., on blocked paths) and restart DOM work when navigating
// back to unblocked paths.
export class HrefObserver {
  constructor(coordinator) {
    this.coordinator = coordinator;
    this.pollerId = null;
  }

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
    setTimeout(() => {
      if (this.coordinator.voteSync) {
        this.coordinator.testForPageChange(1000);
        this.coordinator.startMainObserver();
        this.coordinator.applyBackground();
      } else {
        this.coordinator.startup(this);
      }
    }, 100);

    return lastHref;
  }

  startHrefPoller(interval = 500) {
    if (this.pollerId) return;
    let lastHref = location.href;
    this.pollerId = setInterval(
      () => (lastHref = this._handleHrefChange(lastHref)),
      interval
    );
    this.coordinator.log('Reddit Web Fix: href poller started.');
  }

  stopHrefPoller() {
    if (!this.pollerId) return;
    clearInterval(this.pollerId);
    this.pollerId = null;
    this.coordinator.log('Reddit Web Fix: href poller stopped.');
  }
}
