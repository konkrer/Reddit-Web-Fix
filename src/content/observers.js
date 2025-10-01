'use strict';


// Reddit elements of interest.
// The reddit named html element with post data that is a shadow host.
const REDDIT_POST_HOST = 'shreddit-post';  // Update here and in VoteSync.js.
// The reddit elements that may get dynamically added to page and contain the REDDIT_POST_HOST.
const REDDIT_DYN_ADD_1 = 'article';
const REDDIT_DYN_ADD_2 = 'faceplate-batch';

// Class to manage and observe DOM changes for vote button syncing
export class PostObserver {
  constructor(voteSync) {
    this.voteSync = voteSync;
    this.observer = null;
    this.appearance = null;
  }

  _processNode(node) {
    if (
      node.nodeType !== Node.ELEMENT_NODE ||
      (node.tagName.toLowerCase() !== REDDIT_DYN_ADD_1 &&
        node.tagName.toLowerCase() !== REDDIT_DYN_ADD_2)
    ) {
      return;
    }

    const posts = node.querySelectorAll?.(REDDIT_POST_HOST);
    posts?.forEach(p => {
      setTimeout(() => {
        this.voteSync.addHandlersToPosts([p]);
        if (this.voteSync.sessionStorage[p.id]) {
          this.voteSync.syncLikes(p.id);
        }
      }, 0);
    });

    if (this.voteSync.verbose) {
      console.debug('New post containing element processed.');
    }
  }

  // Observe DOM changes to detect new posts loaded dynamically
  // and add event handlers to them and sync their state.
  // Also test for page changes.
  startMainObserver() {
    if (this.observer) return;
    this.observer = new MutationObserver(mutationsList => {
      if (this.voteSync.testForPageChange()) {
        this.appearance?.applyBackground();
      }
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => this._processNode(node));
        }
      }
    });
    try {
      this.observer.observe(document.body, { childList: true, subtree: true });
      if (this.voteSync.verbose)
        console.debug('Reddit Web Fix: main observer started.');
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
    if (this.voteSync.verbose)
      console.debug('Reddit Web Fix: main observer stopped.');
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
    this.PO = undefined;
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
        this.PO.startMainObserver();
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
    if (this.VS?.verbose || this.verbose)
      console.debug('Reddit Web Fix: href poller started.');
  }

  stopHrefPoller() {
    if (!this.pollerId) return;
    clearInterval(this.pollerId);
    this.pollerId = null;
    if (this.VS?.verbose || this.verbose)
      console.debug('Reddit Web Fix: href poller stopped.');
  }
}
