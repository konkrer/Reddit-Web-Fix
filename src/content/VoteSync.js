'use strict';

// placeholders for imported modules and constants
let btnClsUD, btnClsStd, spnClsUp, spnClsDwn;
let svgUpFilledPathD, svgDwnFillPathD, svgUpHollowPathD, svgDwnHollowPathD;
let clickIgnoredAnimation;

// VoteSync settings
const ADD_HANDLERS_DELAY = 0;
// The reddit named html element with post data that is a shadow host.
const REDDIT_POST_HOST = 'shreddit-post';
// The reddit named html element with the changeable post count as an attribute.
const REDDIT_COUNT_EL = 'faceplate-number';
// The html element that holds the vote buttons identifiable by attribute.
const REDDIT_BTN_CONTAINER = '[data-post-click-location="vote"]';
// These classes present on REDDIT_BTN_CONTAINER indicate vote state.
const UPVOTE_INDICATOR_CLASS = 'bg-action-upvote';
const DOWNVOTE_INDICATOR_CLASS = 'bg-action-downvote';
// Upvote and downvote button indicator attributes.
const BTN_UPVOTE_INDICATOR = 'upvote';
const BTN_DOWNVOTE_INDICATOR = 'downvote';

// Dynamic import of constants and animation modules
(() => {
  const constantsURL = chrome.runtime.getURL('src/content/constants.js');
  import(constantsURL)
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
    .catch(err => {
      console.error('Could not load constants module', err);
    });

  const clickAnimURL = chrome.runtime.getURL('src/content/animation.js');
  import(clickAnimURL)
    .then(mod => {
      clickIgnoredAnimation = mod.clickIgnoredAnimation;
    })
    .catch(err => {
      console.error('Could not load animation module', err);
    });
})();

// VoteSync class to handle vote state tracking and syncing
export default class VoteSync {
  constructor(verbose = true, isBlockedPath, HO) {
    this.verbose = verbose;
    this.isBlockedPath = isBlockedPath;
    this.HO = HO; // Href Observer
    this.PO = undefined; // Post Observer
    this.sessionStorage = {};
    this.stateCopied = new Set();
    this.btnStateRestored = {};
    this.currentPage = undefined;
    this.detail = undefined;

    this.testForPageChange(1000);
    if (this.verbose) console.debug('VoteSync initialized.');
  }

  addCopySync = () => {
    this.addHandlersToShredditPosts();
    this.btnStateRestored = {};
    this.syncLikes();
    if (this.verbose)
      console.debug('Added handlers, Copied State, Synced Button State');
  };

  testForPageChange(delay) {
    if (this.currentPage !== window.location.href) {
      if (this.verbose) console.debug('Page change detected.');
      this.currentPage = window.location.href;
      if (this.isBlockedPath()) {
        if (this.verbose) console.debug('Blocked page.');
        this.PO.stopMainObserver();
        this.HO.startHrefPoller();
        return;
      }
      this.testForDetailPage();
      this.stateCopied.clear();
      setTimeout(this.addCopySync, delay || ADD_HANDLERS_DELAY);
    }
  }

  getShredditPosts() {
    const sPosts = document.querySelectorAll(REDDIT_POST_HOST);
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
    if (!btnSpan) return;
    if (!this.detail && sp.hasAttribute('post-seen')) {
      return;
    }
    const count = this.getCountFromUI(sp);
    if (isNaN(count)) return;
    // if classes present for up/down condition set state
    if (btnSpan.classList.contains(UPVOTE_INDICATOR_CLASS)) {
      this.sessionStorage[sp.id] = { vote: 'U', count };
      this.stateCopied.add(sp.id);
    } else if (btnSpan.classList.contains(DOWNVOTE_INDICATOR_CLASS)) {
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
      if (pathElem.hasAttribute(BTN_UPVOTE_INDICATOR))
        return [true, BTN_UPVOTE_INDICATOR, pathElem];
      else if (pathElem.hasAttribute(BTN_DOWNVOTE_INDICATOR))
        return [true, BTN_DOWNVOTE_INDICATOR, pathElem];
    }
    return [false, null, null];
  }

  handleVotes = e => {
    // function to handle vote button clicks and update state as appropriate
    // also trigger ignored click animation if needed
    const targetId = e.target.id;
    if (!targetId || e.target.tagName.toLowerCase() !== REDDIT_POST_HOST)
      return;
    const [voteClick, voteType, btnElem] = this.findVoteClickEventInSD(e);
    if (!voteClick) return;

    const btnRestoredState = this.btnStateRestored[targetId];
    delete this.btnStateRestored[targetId];

    const prevVoteState = this.sessionStorage[targetId]?.vote;
    let currCount =
      this.sessionStorage[targetId]?.count || this.getCountFromUI(e.target);
    if (isNaN(currCount)) return;

    // clear vote handler
    const handleClearVote = () => {
      this.sessionStorage[targetId] = {
        vote: 'Clear',
        count: this.calcCount('Clear', prevVoteState, currCount),
      };
      if (btnRestoredState === undefined) {
        this.watchForVoteNotCleared(e.target, prevVoteState, currCount);
      }
    };

    // set vote handler
    const handleSetVote = vote => {
      this.sessionStorage[targetId] = {
        vote,
        count: this.calcCount(voteType, prevVoteState, currCount),
      };
      if (
        // if going from restored down to up, or restored up to down
        (vote === 'U' && prevVoteState === 'D' && btnRestoredState === 'D') ||
        (vote === 'D' && prevVoteState === 'U' && btnRestoredState === 'U')
      ) {
        // force UI reset to show proper vote state, remove contraindicating svg arrows
        const syncFn =
          vote === 'U'
            ? syncUpvoteAppearance
            : syncDownvoteAppearance;
        syncFn.call(this, this.getButtonSpan(e.target));
      }
    };

    // ignored click handler
    const handleIgnoredClick = () => {
      this.setCountInUI(e.target);
      if (clickIgnoredAnimation) clickIgnoredAnimation(btnElem);
    };

    // logic to handle vote click based on type and previous state
    if (voteType === BTN_UPVOTE_INDICATOR) {
      if (btnRestoredState == 'U' || btnRestoredState == 'Clear: U') {
        handleIgnoredClick();
        return;
      }
      if (this.verbose) console.debug('up click', targetId);
      if (prevVoteState === 'U') {
        handleClearVote();
      } else {
        handleSetVote('U');
      }
    } else if (voteType === BTN_DOWNVOTE_INDICATOR) {
      if (btnRestoredState == 'D' || btnRestoredState == 'Clear: D') {
        handleIgnoredClick();
        return;
      }
      if (this.verbose) console.debug('down click', targetId);
      if (prevVoteState === 'D') {
        handleClearVote();
      } else {
        handleSetVote('D');
      }
    }
    this.setCountInUI(e.target);
  };

  watchForVoteNotCleared(sp, initialState, currCount) {
    // watch for case when action that should clear vote does not clear the UI state
    // need to reset vote state to original voteType and count and show sync animation
    setTimeout(() => {
      const btnSpan = this.getButtonSpan(sp);
      if (!btnSpan) return;
      const currUIState = this.getVoteStateFromUI(btnSpan);
      // if state is still upvote or downvote after clicking upvote/downvote to clear vote
      if (currUIState === initialState) {
        if (this.verbose)
          console.debug('Upvote not cleared, syncing state.', sp.id);
        // reset vote state and count to match UI and show sync animation
        this.sessionStorage[sp.id] = {
          vote: initialState,
          count: currCount,
        };
        clickIgnoredAnimation(btnSpan);
        this.setCountInUI(sp);
      }
    }, 0);
  }

  getVoteStateFromUI(btnSpan) {
    return btnSpan.classList.contains(UPVOTE_INDICATOR_CLASS)
      ? 'U'
      : btnSpan.classList.contains(DOWNVOTE_INDICATOR_CLASS)
      ? 'D'
      : 'Clear';
  }

  getCountFromUI(sp) {
    return +sp.shadowRoot
      ?.querySelector(REDDIT_COUNT_EL)
      ?.getAttribute('number');
  }

  setCountInUI = sp => {
    sp.shadowRoot
      ?.querySelector(REDDIT_COUNT_EL)
      .setAttribute('number', this.sessionStorage[sp.id].count.toString());
  };

  calcCount(voteType, prevVoteState, count) {
    // calculate new count based on previous state and vote action
    // if prevVoteState undefined return current count
    if (prevVoteState === undefined) return +count;

    // if upvote clicked
    if (voteType === BTN_UPVOTE_INDICATOR) {
      // if previous state was clear, increment by 1
      // if previous state was downvote, increment by 2
      if (prevVoteState == 'Clear') return +count + 1;
      else if (prevVoteState === 'D') return +count + 2;
      // if downvote clicked
    } else if (voteType === BTN_DOWNVOTE_INDICATOR) {
      // if previous state was clear, decrement by 1
      // if previous state was upvote, decrement by 2
      if (prevVoteState == 'Clear') return +count - 1;
      else if (prevVoteState == 'U') return +count - 2;
      // if clear vote clicked
    } else if (voteType === 'Clear') {
      // if previous state was upvote, decrement by 1
      // if previous state was downvote, increment by 1
      if (prevVoteState === 'U') return +count - 1;
      else if (prevVoteState === 'D') return +count + 1;
    }
  }

  getButtonSpan(sp) {
    return sp.shadowRoot?.querySelector(REDDIT_BTN_CONTAINER);
  }

  syncLikes(key) {
    // sync UI state with stored state
    // if detail page do not sync
    if (this.detail) return;

    const updateAppearance = k => {
      const sp = document.getElementById(k);
      if (sp === null || this.stateCopied.has(k)) {
        this.stateCopied.delete(k);
        return;
      }

      const dir = this.sessionStorage[k].vote;
      const btnSpan = this.getButtonSpan(sp);
      const initState = this.getVoteStateFromUI(btnSpan);
      if (!btnSpan || dir === undefined || initState === undefined) return;

      if (dir === 'U' && !(initState === 'U')) {
        syncUpvoteAppearance(btnSpan);
        this.btnStateRestored[k] = dir;
      } else if (dir === 'D' && !(initState === 'D')) {
        syncDownvoteAppearance(btnSpan);
        this.btnStateRestored[k] = dir;
      } else if (dir === 'Clear' && !(initState === 'Clear')) {
        syncClearAppearance(btnSpan);
        this.btnStateRestored[k] = `Clear: ${initState}`;
      }
      this.setCountInUI(sp);
    };

    if (key) setTimeout(() => updateAppearance(key), ADD_HANDLERS_DELAY);
    else Object.keys(this.sessionStorage).forEach(updateAppearance);
  }

  testForDetailPage() {
    this.detail = /^https?:\/\/(www\.)?reddit.com\/r\/.+\/comments\/.+/.test(
      window.location.href
    );
  }
}

// UI VOTE STATE MANIPULATION FUNCTIONS //

function getButtonsSvgPaths(btnSpan) {
  const buttonUp = btnSpan.querySelector(`[${BTN_UPVOTE_INDICATOR}]`);
  const buttonDn = btnSpan.querySelector(`[${BTN_DOWNVOTE_INDICATOR}]`);
  const pathUp = buttonUp.querySelector('path');
  const pathDn = buttonDn.querySelector('path');

  return [buttonUp, buttonDn, pathUp, pathDn];
}

function syncUpvoteAppearance(btnSpan) {
  if (!btnSpan || spnClsUp === undefined) return;
  const [buttonUp, buttonDn, pathUp, pathDn] = getButtonsSvgPaths(btnSpan);

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

function syncDownvoteAppearance(btnSpan) {
  if (!btnSpan || spnClsUp === undefined) return;
  const [buttonUp, buttonDn, pathUp, pathDn] = getButtonsSvgPaths(btnSpan);

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

function syncClearAppearance(btnSpan) {
  if (!btnSpan || spnClsUp === undefined) return;
  const [buttonUp, buttonDn, pathUp, pathDn] = getButtonsSvgPaths(btnSpan);

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
