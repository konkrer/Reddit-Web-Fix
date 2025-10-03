'use strict';

// Reddit elements of interest.
// The reddit named html element with post data that is a shadow host.
const REDDIT_POST_HOST = 'shreddit-post'; // Update here and in VoteSync.js.
// The reddit elements that may get dynamically added to page and contain the REDDIT_POST_HOST.
const REDDIT_DYN_ADD_1 = 'article'; // element name for post parent
const REDDIT_DYN_ADD_2 = 'faceplate-batch'; // element name for post parent
const REDDIT_DYN_ADD_3 = 'grid-container'; // class name for grid parent

// Class to manage and observe DOM changes for vote button syncing
export class MainObserver {
  constructor(voteSync) {
    this.voteSync = voteSync;
    this.observer = null;
    this.appearance = null;
  }

  _processPostParentNode(node) {
    const posts = node.querySelectorAll?.(REDDIT_POST_HOST);
    posts?.forEach(p => setTimeout(() => this.voteSync.addSyncPost(p), 0));
    this.log('New post containing element processed.');
  }

  _processGridParentNode(node) {
    this.appearance?.applyBackground();
    this.log('Grid container processed.');
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
      node.classList.contains(REDDIT_DYN_ADD_3)
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
    this.voteSync.testForPageChange();
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
      this.log('Reddit Web Fix: main observer started.');
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
    this.log('Reddit Web Fix: main observer stopped.');
  }

  log(message) {
    if (this.voteSync.verbose) {
      console.debug(message);
    }
  }
}

// Class to monitor URL changes in single-page application navigation while mutation
// observer is paused (e.g., on blocked paths) and restart DOM work when navigating
// back to unblocked paths.
export class HrefObserver {
  constructor(isBlockedPath, verbose, startup) {
    this.isBlockedPath = isBlockedPath;
    this.startup = startup;
    this.verbose = verbose;
    this.pollerId = null;
    this.VS = undefined;
    this.MO = undefined;
  }

  _handleHrefChange(lastHref) {
    if (location.href === lastHref) {
      return lastHref;
    }

    lastHref = location.href;
    if (this.isBlockedPath()) {
      return lastHref;
    }

    this.stopHrefPoller();
    setTimeout(() => {
      if (this.VS) {
        this.VS.testForPageChange(1000);
        this.MO.startMainObserver();
        this.MO.appearance?.applyBackground();
      } else {
        this.startup(this);
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
    this.log('Reddit Web Fix: href poller started.');
  }

  stopHrefPoller() {
    if (!this.pollerId) return;
    clearInterval(this.pollerId);
    this.pollerId = null;
    this.log('Reddit Web Fix: href poller stopped.');
  }

  log(message) {
    if (this.VS.verbose || this.verbose) {
      console.debug(message);
    }
  }
}
