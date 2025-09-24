'use strict';

let VS;
const addHandlersDelay = 0;
let verbose = false;
// placeholders for constants imported from constants.js
let btnClsUD, btnClsStd, spnClsUp, spnClsDwn;
let svgUpFilledPathD, svgDwnFillPathD, svgUpHollowPathD, svgDwnHollowPathD;
let clickIgnoredAnimation;

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
        verbose = msg.value;
        if (VS) VS.verbose = msg.value;
        console.log('Verbose mode updated:', msg.value);
      }
    });

    port.onDisconnect.addListener(() => {
      port = null;
      // Attempt to reconnect
      setTimeout(initPort, 1000);
    });
  }
  initPort();

  // dynamically import constants module for manifest v3 content script
  const constsURL = chrome.runtime.getURL('constants.js');
  import(constsURL)
    .then(mod => {
      btnClsUD = mod.btnClsUD;
      btnClsStd = mod.btnClsStd;
      spnClsUp = mod.spnClsUp;
      spnClsDwn = mod.spnClsDwn;
      svgUpFilledPathD = mod.svgUpFilledPathD;
      svgDwnFillPathD = mod.svgDwnFillPathD;
      svgUpHollowPathD = mod.svgUpHollowPathD;
      svgDwnHollowPathD = mod.svgDwnHollowPathD;
    })
    .catch(err => console.error('Failed to load constants module:', err));

  const animURL = chrome.runtime.getURL('animation.js');
  import(animURL)
    .then(mod => {
      clickIgnoredAnimation = mod.clickIgnoredAnimation;
    })
    .catch(err => console.error('Failed to load animation module:', err));
})();

// Load the browser polyfill for async compatibility
const polyfillURL = chrome.runtime.getURL('browser-polyfill.min.js');
import(polyfillURL)
  .then(() => {
    // dynamically import storage module to get getGetDebug function
    const storage = chrome.runtime.getURL('storage.js');
    import(storage)
      .then(mod => {
        const getDebug = mod.getGetDebug(browser);
        (async () => {
          // get debug setting from storage and set local variable verbose
          const debug = await getDebug();
          verbose = debug;
          if (VS) VS.verbose = debug;
        })();
      })
      .catch(err => console.error('Failed to load storage module:', err));
  })
  .catch(err => {
    console.error('Failed to load browser polyfill:', err);
  });

// Main class to handle vote state tracking and syncing
class VoteSync {
  constructor(verbose = true) {
    this.verbose = verbose;
    this.sessionStorage = {};
    this.stateCopied = new Set();
    this.btnStateRestored = {};
    this.currentPage = undefined;
    this.detail = undefined;
    this.testForPageChange(1000);
  }

  addCopySync = () => {
    this.addHandlersToShredditPosts();
    this.btnStateRestored = {};
    this.syncLikes();
    if (this.verbose)
      console.log('Added handlers, Copied State, Synced Button State');
  };

  testForPageChange(delay) {
    if (this.currentPage !== window.location.href) {
      if (this.verbose) console.log('Page change detected.');
      this.currentPage = window.location.href;
      this.testForDetailPage();
      this.stateCopied.clear();
      setTimeout(this.addCopySync, delay || addHandlersDelay);
    }
  }

  getShredditPosts() {
    const sPosts = document.querySelectorAll('shreddit-post');
    return sPosts;
  }

  addHandlersToShredditPosts(sp) {
    const sPosts = sp || this.getShredditPosts();
    sPosts.forEach(sp => {
      this.copyPostVoteState(sp);
      sp.addEventListener('click', this.handleVotes);
    });
  }

  copyPostVoteState(sp) {
    const btnSpan = this.getButtonSpan(sp);
    if (btnSpan === null) return;
    if (!this.detail && sp.hasAttribute('post-seen')) {
      return;
    }
    const count = this.getCountFromUI(sp);
    // if classes present for up/down condition set state
    if (btnSpan.classList.contains('bg-action-upvote')) {
      this.sessionStorage[sp.id] = { vote: 'U', count };
      this.stateCopied.add(sp.id);
    } else if (btnSpan.classList.contains('bg-action-downvote')) {
      this.sessionStorage[sp.id] = { vote: 'D', count };
      this.stateCopied.add(sp.id);
    } else if (this.detail) {
      // copy clear state on detail page
      this.sessionStorage[sp.id] = { vote: 'Clear', count };
      this.stateCopied.add(sp.id);
    }
    sp.setAttribute('post-seen', 'true');
  }

  removeHandlersShredditPosts() {
    const sPosts = this.getShredditPosts();
    sPosts.forEach(sp => {
      sp.removeEventListener('click', this.handleVotes);
    });
  }

  findVoteClickEventInSD(e) {
    // check clicked element and three elements above allowing for Shadow DOM
    for (let i = 0; i < 4; i++) {
      const pathElem = e.composedPath()[i];
      if (pathElem === undefined || pathElem.hasAttribute === undefined)
        continue;
      if (pathElem.hasAttribute('upvote')) return [true, 'upvote', pathElem];
      else if (pathElem.hasAttribute('downvote'))
        return [true, 'downvote', pathElem];
    }
    return [false, null, null];
  }

  handleVotes = e => {
    const targetId = e.target.id;
    if (!targetId || e.target.tagName.toLowerCase() !== 'shreddit-post') return;
    const [voteClick, voteType, btnElem] = this.findVoteClickEventInSD(e);
    if (voteClick === false) return;

    const btnRestoredState = this.btnStateRestored[targetId];
    delete this.btnStateRestored[targetId];

    const prevVoteState = this.sessionStorage[targetId]?.vote;
    let currCount =
      this.sessionStorage[targetId]?.count || this.getCountFromUI(e.target);

    // if upvote button clicked
    if (voteType === 'upvote') {
      // if button was restored to upvote or restored to clear
      // from upvote ignore click - UI is catching up to state currently showing
      if (btnRestoredState == 'U' || btnRestoredState == 'Clear: U') {
        this.setCountInUI(e.target);
        if (clickIgnoredAnimation) clickIgnoredAnimation(btnElem);
        return;
      }
      if (this.verbose) console.log('up click', targetId);

      if (prevVoteState === 'U') {
        this.sessionStorage[targetId] = {
          vote: 'Clear',
          count: this.calcCount('Clear', prevVoteState, currCount),
        };
      } else {
        this.sessionStorage[targetId] = {
          vote: 'U',
          count: this.calcCount(voteType, prevVoteState, currCount),
        };
        // if going from down to up and down was restored need to remove solid down arrow
        if (prevVoteState === 'D' && btnRestoredState === 'D') {
          this.syncUpvoteAppearance(this.getButtonSpan(e.target));
        }
      }
    } else if (voteType === 'downvote') {
      // if button was restored to downvote or restored to clear
      // from downvote ignore click - UI is catching up to state currently showing
      if (btnRestoredState == 'D' || btnRestoredState == 'Clear: D') {
        this.setCountInUI(e.target);
        if (clickIgnoredAnimation) clickIgnoredAnimation(btnElem);
        return;
      }
      if (this.verbose) console.log('down click', targetId);

      if (prevVoteState === 'D') {
        this.sessionStorage[targetId] = {
          vote: 'Clear',
          count: this.calcCount('Clear', prevVoteState, currCount),
        };
      } else {
        this.sessionStorage[targetId] = {
          vote: 'D',
          count: this.calcCount(voteType, prevVoteState, currCount),
        };
        // if going from up to down and up was restored need to remove solid up arrow
        if (prevVoteState === 'U' && btnRestoredState === 'U') {
          this.syncDownvoteAppearance(this.getButtonSpan(e.target));
        }
      }
    }
    this.setCountInUI(e.target);
  };

  getCountFromUI(sp) {
    return sp.shadowRoot
      .querySelector('faceplate-number')
      .getAttribute('number');
  }

  setCountInUI = sp => {
    sp.shadowRoot
      .querySelector('faceplate-number')
      .setAttribute('number', this.sessionStorage[sp.id].count.toString());
  };

  calcCount(voteType, prevVoteState, count) {
    if (prevVoteState === undefined) return count;
    if (voteType === 'upvote') {
      if (prevVoteState == 'Clear') return +count + 1;
      else if (prevVoteState === 'D') return +count + 2;
    } else if (voteType === 'downvote') {
      if (prevVoteState == 'Clear') return +count - 1;
      else if (prevVoteState == 'U') return +count - 2;
    } else if (voteType === 'Clear') {
      if (prevVoteState === 'U') return +count - 1;
      else if (prevVoteState === 'D') return +count + 1;
    }
  }

  getButtonSpan(sp) {
    return sp.shadowRoot.querySelector('[data-post-click-location="vote"]');
  }

  syncLikes(key) {
    if (this.detail) return;

    const updateAppearance = k => {
      const sp = document.getElementById(k);
      if (sp === null || this.stateCopied.has(k)) {
        this.stateCopied.delete(k);
        return;
      }

      const dir = this.sessionStorage[k].vote;
      const btnSpan = this.getButtonSpan(sp);
      const initState = btnSpan.classList.contains('bg-action-upvote')
        ? 'U'
        : btnSpan.classList.contains('bg-action-downvote')
        ? 'D'
        : 'Clear';

      if (dir === 'U' && !(initState === 'U')) {
        this.syncUpvoteAppearance(btnSpan);
        this.btnStateRestored[k] = dir;
      } else if (dir === 'D' && !(initState === 'D')) {
        this.syncDownvoteAppearance(btnSpan);
        this.btnStateRestored[k] = dir;
      } else if (dir === 'Clear' && !(initState === 'Clear')) {
        this.syncClearAppearance(btnSpan);
        this.btnStateRestored[k] = `Clear: ${initState}`;
      }
      this.setCountInUI(sp);
    };

    if (key) setTimeout(() => updateAppearance(key), addHandlersDelay);
    else Object.keys(this.sessionStorage).forEach(updateAppearance);
  }

  getButtonsSvgPaths(btnSpan) {
    const buttonUp = btnSpan.querySelector('[upvote]');
    const buttonDn = btnSpan.querySelector('[downvote]');
    const pathUp = buttonUp.querySelector('path');
    const pathDn = buttonDn.querySelector('path');

    return [buttonUp, buttonDn, pathUp, pathDn];
  }

  syncUpvoteAppearance(btnSpan) {
    if (spnClsDwn === undefined) return;
    const [buttonUp, buttonDn, pathUp, pathDn] =
      this.getButtonsSvgPaths(btnSpan);

    btnSpan.classList.remove(...spnClsDwn.split(' '));
    btnSpan.classList.add(...spnClsUp.split(' '));
    buttonUp.classList.remove(...btnClsStd.split(' '));
    buttonUp.classList.add(...btnClsUD.split(' '));
    buttonUp.setAttribute('aria-pressed', 'true');
    buttonDn.classList.remove(...btnClsUD.split(' '));
    buttonDn.classList.add(...btnClsStd.split(' '));
    buttonDn.setAttribute('aria-pressed', 'false');
    pathDn.setAttribute('d', svgDwnHollowPathD);
    pathUp.setAttribute('d', svgUpFilledPathD);
  }

  syncDownvoteAppearance(btnSpan) {
    if (spnClsDwn === undefined) return;
    const [buttonUp, buttonDn, pathUp, pathDn] =
      this.getButtonsSvgPaths(btnSpan);

    btnSpan.classList.remove(...spnClsUp.split(' '));
    btnSpan.classList.add(...spnClsDwn.split(' '));
    buttonUp.classList.remove(...btnClsUD.split(' '));
    buttonUp.classList.add(...btnClsStd.split(' '));
    buttonUp.setAttribute('aria-pressed', 'false');
    buttonDn.classList.remove(...btnClsStd.split(' '));
    buttonDn.classList.add(...btnClsUD.split(' '));
    buttonDn.setAttribute('aria-pressed', 'true');
    pathDn.setAttribute('d', svgDwnFillPathD);
    pathUp.setAttribute('d', svgUpHollowPathD);
  }

  syncClearAppearance(btnSpan) {
    if (spnClsDwn === undefined) return;
    const [buttonUp, buttonDn, pathUp, pathDn] =
      this.getButtonsSvgPaths(btnSpan);

    btnSpan.classList.remove(...spnClsDwn.split(' '));
    btnSpan.classList.remove(...spnClsUp.split(' '));
    buttonUp.classList.remove(...btnClsUD.split(' '));
    buttonUp.classList.add(...btnClsStd.split(' '));
    buttonUp.setAttribute('aria-pressed', 'false');
    buttonDn.classList.remove(...btnClsUD.split(' '));
    buttonDn.classList.add(...btnClsStd.split(' '));
    buttonDn.setAttribute('aria-pressed', 'false');
    pathDn.setAttribute('d', svgDwnHollowPathD);
    pathUp.setAttribute('d', svgUpHollowPathD);
  }

  testForDetailPage() {
    this.detail = /^https?:\/\/(www\.)?reddit.com\/r\/.+\/comments\/.+/.test(
      window.location.href
    );
  }
}

VS = new VoteSync(verbose);

// Observe DOM changes to detect new posts loaded dynamically
// and add event handlers to them and sync their state.
// Also test for page changes.
const observer = new MutationObserver(mutationsList => {
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
            }, addHandlersDelay);
          });
          if (VS.verbose)
            console.log('New article/ faceplate-batch processed.');
        }
      });
    }
  }
});

// Start observing the document body for added nodes
observer.observe(document.body, {
  childList: true,
  // Watch entire DOM tree, not just direct children
  subtree: true,
});
console.log('VoteSync activated.');
