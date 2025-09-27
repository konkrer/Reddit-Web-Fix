'use strict';

// Class to manage and observe DOM changes for vote button syncing
export class PostObserver {
  constructor(voteSync) {
    this.voteSync = voteSync;
    this.observer = null;
  }

  // Observe DOM changes to detect new posts loaded dynamically
  // and add event handlers to them and sync their state.
  // Also test for page changes.
  startMainObserver() {
    if (this.observer) return;
    this.observer = new MutationObserver(mutationsList => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          this.voteSync.testForPageChange();
          mutation.addedNodes.forEach(node => {
            if (
              node.nodeType === Node.ELEMENT_NODE &&
              (node.tagName.toLowerCase() === 'article' ||
                node.tagName.toLowerCase() === 'faceplate-batch')
            ) {
              const sp = node.querySelectorAll?.('shreddit-post');
              sp?.forEach(p => {
                setTimeout(() => {
                  this.voteSync.addHandlersToShredditPosts([p]);
                  if (this.voteSync.sessionStorage[p.id])
                    this.voteSync.syncLikes(p.id);
                }, 0);
              });
              if (this.voteSync.verbose)
                console.debug('New article/ faceplate-batch processed.');
            }
          });
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
  startHrefPoller(interval = 500) {
    if (this.pollerId) return;
    let lastHref = location.href;
    this.pollerId = setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        // only restart DOM work once we've left a blocked path
        if (!this.isBlockedPath()) {
          this.stopHrefPoller();
          // small delay to let the new page render
          setTimeout(() => {
            if (VS) {
              this.VS.testForPageChange(1000);
              this.PO.startMainObserver();
            } else this.startup(this);
          }, 100);
        }
      }
    }, interval);
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
