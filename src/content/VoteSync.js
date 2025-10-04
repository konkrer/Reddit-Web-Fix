'use strict';

// placeholders for imported constants and modules.
let BTN_CLS_UD,
  BTN_CLS_STD,
  SPN_CLS_UP,
  SPN_CLS_DWN,
  SVG_UP_FILLED_PATH,
  SVG_DWN_FILLED_PATH,
  SVG_UP_HOLLOW_PATH,
  SVG_DWN_HOLLOW_PATH,
  clickIgnoredAnimation;

// VoteSync settings
const ADD_HANDLERS_DELAY = 0;
const CLEAR_BACKGROUND_DELAY = 0;

/* ---------------------------------------------------------------- */
/* Reddit elements / element markers for finding relevant elements. */

// The reddit named html element with post data that is a shadow host.
const REDDIT_POST_HOST = 'shreddit-post'; // Update here and in observers.js.

// The reddit named html element with the changeable post count as an attribute.
const REDDIT_COUNT_EL = 'faceplate-number';

// The html element that holds the vote buttons identifiable by attribute.
const REDDIT_BTN_CONTAINER = '[data-post-click-location="vote"]';

// These classes present on REDDIT_BTN_CONTAINER indicate vote state.
const UPVOTE_INDICATOR_CLASS = 'bg-action-upvote';
const DOWNVOTE_INDICATOR_CLASS = 'bg-action-downvote';

// Upvote and downvote button indicator attributes (attributes found on buttons).
const BTN_UPVOTE_INDICATOR = 'upvote';
const BTN_DOWNVOTE_INDICATOR = 'downvote';

// Clear (no vote) indicator. (not derived from Reddit elements)
const CLEAR_VOTE_INDICATOR = 'clear';

/* ---------------------------------------------------------------- */
/* Vote Record Keeping */

// Vote record for vote state storage.
const voteRecord = {
  [BTN_UPVOTE_INDICATOR]: 'U',
  [BTN_DOWNVOTE_INDICATOR]: 'D',
  [CLEAR_VOTE_INDICATOR]: 'Clear',
};
// Make vote cleared record for button-restored-state value.
const makeRestoredClearRecord = voteType =>
  `${voteRecord[CLEAR_VOTE_INDICATOR]}: ${voteRecord[voteType]}`;

const countAdjustments = {
  [BTN_UPVOTE_INDICATOR]: {
    [voteRecord[CLEAR_VOTE_INDICATOR]]: 1,
    [voteRecord[BTN_DOWNVOTE_INDICATOR]]: 2,
  },
  [BTN_DOWNVOTE_INDICATOR]: {
    [voteRecord[CLEAR_VOTE_INDICATOR]]: -1,
    [voteRecord[BTN_UPVOTE_INDICATOR]]: -2,
  },
  [CLEAR_VOTE_INDICATOR]: {
    [voteRecord[BTN_UPVOTE_INDICATOR]]: -1,
    [voteRecord[BTN_DOWNVOTE_INDICATOR]]: 1,
  },
};

/* -----------------------------------------------------------*/

// Dynamic import of constants and animation modules
(async () => {
  const constModProm = import(
    chrome.runtime.getURL('src/content/constants.js')
  );
  const animationModProm = import(
    chrome.runtime.getURL('src/content/animation.js')
  );
  const [constMod, animationMod] = await Promise.all([
    constModProm,
    animationModProm,
  ]);
  const mods = constMod && animationMod;
  if (mods) {
    BTN_CLS_UD = constMod.BTN_CLS_UD;
    BTN_CLS_STD = constMod.BTN_CLS_STD;
    SPN_CLS_UP = constMod.SPN_CLS_UP;
    SPN_CLS_DWN = constMod.SPN_CLS_DWN;
    SVG_UP_FILLED_PATH = constMod.SVG_UP_FILLED_PATH;
    SVG_DWN_FILLED_PATH = constMod.SVG_DWN_FILLED_PATH;
    SVG_UP_HOLLOW_PATH = constMod.SVG_UP_HOLLOW_PATH;
    SVG_DWN_HOLLOW_PATH = constMod.SVG_DWN_HOLLOW_PATH;
    ({ clickIgnoredAnimation } = animationMod);
  } else {
    throw new Error('Failed to load constants.js or animation.js modules');
  }
})();

/* -----------------------------------------------------------*/

// VoteSync class to handle vote state tracking and syncing
export default class VoteSync {
  constructor(coordinator) {
    this.coordinator = coordinator;
    this.sessionStorage = {};
    this.stateCopied = new Set();
    this.btnStateRestored = {};
    this.currentPage = undefined;
    this.detail = undefined;

    this.testForPageChange(1000);
    this.coordinator.log('VoteSync initialized.');
  }

  testForPageChange(addDelay = ADD_HANDLERS_DELAY) {
    // return true if page change detected to allowed page, false otherwise
    if (this.currentPage !== window.location.href) {
      this.coordinator.log('Page change detected.');
      return this._newPageDetected(addDelay);
    }
    return false;
  }

  _newPageDetected(addDelay) {
    // test for blocked page and allowed page
    this.currentPage = window.location.href;
    if (this.coordinator.isBlockedPath()) {
      this._newBlockedPageDetected();
      return false;
    }
    this._newAllowedPageDetected(addDelay);
    return true;
  }

  _newBlockedPageDetected() {
    // stop main observer and start href poller
    this.coordinator.log('Blocked page.');
    this.coordinator.stopMainObserver();
    this.coordinator.startHrefPoller();
    setTimeout(() => {
      this.coordinator.clearBackground();
    }, CLEAR_BACKGROUND_DELAY);
  }

  _newAllowedPageDetected(addDelay) {
    // test for detail page and clear state copied set
    // add copy sync with delay
    this.testForDetailPage();
    this.stateCopied.clear();
    setTimeout(this.addCopySync, addDelay);
  }

  addCopySync = () => {
    // add handlers to posts and sync button state
    this.addHandlersToPosts();
    this.btnStateRestored = {};
    this.syncLikes();
    this.coordinator.log('Added handlers, Copied State, Synced Button State');
  };

  addSyncPost = post => {
    // add handlers to post and sync vote state
    this.addHandlersToPosts([post]);
    if (this.sessionStorage[post.id]) {
      this.syncLikes(post.id);
    }
  };

  getPosts() {
    // get all posts
    const posts = document.querySelectorAll(REDDIT_POST_HOST);
    return posts;
  }

  getButtonSpan(post) {
    // get button span
    return post?.shadowRoot?.querySelector(REDDIT_BTN_CONTAINER);
  }

  addHandlersToPosts(postsIn) {
    // add handlers to posts
    const posts = postsIn || this.getPosts();
    posts.forEach(post => {
      this.copyPostVoteState(post);
      post.addEventListener('click', this.handleVotes);
    });
  }

  removeHandlersFromPosts() {
    // remove handlers from posts
    const posts = this.getPosts();
    posts.forEach(post => {
      post.removeEventListener('click', this.handleVotes);
    });
  }

  copyPostVoteState(post) {
    // copy post vote state
    const btnSpan = this.getButtonSpan(post);
    if (!btnSpan || this._getPostSeen(post)) {
      return;
    }

    this._copyVoteState(post, btnSpan);
    this._setPostSeen(post);
  }

  _copyVoteState(post, btnSpan) {
    // copy vote state to session storage
    const count = this.getCountFromUI(post);
    if (isNaN(count)) return;

    const voteState = this.getVoteStateFromUI(btnSpan);
    // only copy clear vote state on detail page
    // so return if not detail page and vote state is clear
    if (!voteState || (voteState === CLEAR_VOTE_INDICATOR && !this.detail))
      return;
    this.sessionStorage[post.id] = { vote: voteRecord[voteState], count };
    this.stateCopied.add(post.id);
  }

  _getPostSeen(post) {
    // check if post seen
    return post.hasAttribute('post-seen');
  }

  _setPostSeen(post) {
    // set post seen attribute
    post.setAttribute('post-seen', 'true');
  }

  findVoteButtonClickEvent(e) {
    // find if event was a vote button click event
    // Check clicked element and three elements above
    // for being a vote button having vote indicator attribute.
    // Return [found bool, voteType, button element]
    let foundClick = [false, null, null];
    const path = e.composedPath();
    for (let i = 0; i < 4 && i < path.length; i++) {
      foundClick = this._findVoteButton(path[i]) || foundClick;
    }
    return foundClick;
  }

  _findVoteButton(pathElem) {
    // find vote button
    if (!pathElem?.hasAttribute) return false;
    return (
      this._findUpvoteButton(pathElem) || this._findDownvoteButton(pathElem)
    );
  }

  _findUpvoteButton(pathElem) {
    // find upvote button
    if (pathElem.hasAttribute(BTN_UPVOTE_INDICATOR)) {
      return [true, BTN_UPVOTE_INDICATOR, pathElem];
    }
    return false;
  }

  _findDownvoteButton(pathElem) {
    // find downvote button
    if (pathElem.hasAttribute(BTN_DOWNVOTE_INDICATOR)) {
      return [true, BTN_DOWNVOTE_INDICATOR, pathElem];
    }
    return false;
  }

  _handleIgnoreClick(post, btnElem) {
    // set count in ui and animate click ignored
    this.setCountInUI(post);
    if (clickIgnoredAnimation) {
      clickIgnoredAnimation(btnElem);
    }
  }

  _handleClearVote(post, prevVoteState, currCount, btnRestoredState) {
    // set vote state to clear and count to calculated count
    // if btnRestoredState is undefined, watch for vote not cleared
    this.sessionStorage[post.id] = {
      vote: voteRecord[CLEAR_VOTE_INDICATOR],
      count: this.calcCount(CLEAR_VOTE_INDICATOR, prevVoteState, currCount),
    };
    if (btnRestoredState === undefined) {
      this._watchForVoteNotCleared(post, prevVoteState, currCount);
    }
  }

  _handleSetVote(post, voteType, prevVoteState, currCount, btnRestoredState) {
    // set vote state to voteType and count to calculated count
    // if btnRestoredState is restored up to down or down to up, sync vote appearance
    this.sessionStorage[post.id] = {
      vote: voteRecord[voteType],
      count: this.calcCount(voteType, prevVoteState, currCount),
    };

    const isRestoredUpToDown =
      voteType === BTN_DOWNVOTE_INDICATOR &&
      btnRestoredState === voteRecord[BTN_UPVOTE_INDICATOR];
    const isRestoredDownToUp =
      voteType === BTN_UPVOTE_INDICATOR &&
      btnRestoredState === voteRecord[BTN_DOWNVOTE_INDICATOR];

    if (isRestoredUpToDown || isRestoredDownToUp) {
      syncVoteAppearance(this.getButtonSpan(post), voteType);
    }
  }

  handleVotes = e => {
    // handle votes
    const post = e.target;
    const targetId = post.id;
    if (!targetId || post.tagName.toLowerCase() !== REDDIT_POST_HOST) {
      return;
    }

    const [voteClick, voteType, btnElem] = this.findVoteButtonClickEvent(e);
    if (!voteClick) {
      return;
    }

    // get btn restored state
    const btnRestoredState = this.btnStateRestored[targetId];
    delete this.btnStateRestored[targetId];

    // get prev vote state and curr count
    const prevVoteState = this.sessionStorage[targetId]?.vote;
    const currCount =
      this.sessionStorage[targetId]?.count ?? this.getCountFromUI(post);
    if (isNaN(currCount)) {
      return;
    }

    this._handleVoteLogic(
      post,
      voteType,
      prevVoteState,
      currCount,
      btnRestoredState,
      btnElem
    );
    this.setCountInUI(post);
  };

  _handleVoteLogic(
    post,
    voteType,
    prevVoteState,
    currCount,
    btnRestoredState,
    btnElem
  ) {
    if (
      // if btnRestoredState is the same as the current vote type or
      // the clear vote type restored from the current vote type, handle ignore click
      btnRestoredState === voteRecord[voteType] ||
      btnRestoredState === makeRestoredClearRecord(voteType)
    ) {
      this._handleIgnoreClick(post, btnElem);
      return;
    }

    // if click not ignored, log vote type and post id
    this.coordinator.log(`${voteType} click:`, post.id);

    if (prevVoteState === voteRecord[voteType]) {
      // if previous vote state was the same as the current vote type, handle clear vote
      this._handleClearVote(post, prevVoteState, currCount, btnRestoredState);
    } else {
      // if previous vote state was not the same as the current vote type, handle set vote
      this._handleSetVote(
        post,
        voteType,
        prevVoteState,
        currCount,
        btnRestoredState
      );
    }
  }

  _watchForVoteNotCleared(post, initialState, currCount) {
    // Watch for case when action that should clear vote does not clear the UI state.
    // If so we need to reset vote state to original voteType and count and show sync animation.
    setTimeout(() => {
      const btnSpan = this.getButtonSpan(post);
      if (!btnSpan) return;
      const currUIState = this.getVoteStateFromUI(btnSpan);
      // if state is still upvote or downvote after clicking upvote/downvote to clear vote
      if (voteRecord[currUIState] === initialState) {
        this.coordinator.log('Upvote not cleared, syncing state.', post.id);
        // reset vote state and count to match UI and show sync animation
        this.sessionStorage[post.id] = {
          vote: initialState,
          count: currCount,
        };
        clickIgnoredAnimation(btnSpan);
        this.setCountInUI(post);
      }
    }, ADD_HANDLERS_DELAY);
  }

  getVoteStateFromUI(btnSpan) {
    return btnSpan.classList.contains(UPVOTE_INDICATOR_CLASS)
      ? BTN_UPVOTE_INDICATOR
      : btnSpan.classList.contains(DOWNVOTE_INDICATOR_CLASS)
      ? BTN_DOWNVOTE_INDICATOR
      : CLEAR_VOTE_INDICATOR;
  }

  getCountFromUI(post) {
    return +post.shadowRoot
      ?.querySelector(REDDIT_COUNT_EL)
      ?.getAttribute('number');
  }

  setCountInUI = post => {
    post.shadowRoot
      ?.querySelector(REDDIT_COUNT_EL)
      .setAttribute('number', this.sessionStorage[post.id].count.toString());
  };

  calcCount(voteType, prevVoteState, count) {
    if (prevVoteState === undefined) {
      return +count;
    }
    const adjustment = countAdjustments[voteType]?.[prevVoteState] ?? 0;
    return +count + adjustment;
  }

  syncLikes(key) {
    // sync UI state with stored state

    if (key) setTimeout(() => this._updateAppearance(key), ADD_HANDLERS_DELAY);
    else Object.keys(this.sessionStorage).forEach(this._updateAppearance);
  }

  _updateAppearance = k => {
    const post = document.getElementById(k);
    if (post === null || this.stateCopied.has(k)) {
      this.stateCopied.delete(k);
      return;
    }

    const dir = this.sessionStorage[k].vote;
    const btnSpan = this.getButtonSpan(post);
    const initState = this.getVoteStateFromUI(btnSpan);
    if (!btnSpan || dir === undefined || initState === undefined) return;

    this._syncLogic(dir, initState, k, btnSpan);
    this.setCountInUI(post);
  };

  _syncLogic = (dir, initState, k, btnSpan) => {
    const indicator =
      dir === voteRecord[BTN_UPVOTE_INDICATOR]
        ? BTN_UPVOTE_INDICATOR
        : dir === voteRecord[BTN_DOWNVOTE_INDICATOR]
        ? BTN_DOWNVOTE_INDICATOR
        : CLEAR_VOTE_INDICATOR;
    if (
      // if syncing and the initial state was not the same as the indicator
      !(initState === indicator)
    ) {
      syncVoteAppearance(btnSpan, indicator);
      if (indicator === CLEAR_VOTE_INDICATOR)
        this.btnStateRestored[k] = makeRestoredClearRecord(initState);
      else this.btnStateRestored[k] = dir;
    }
  };

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

function syncVoteAppearance(btnSpan, voteState) {
  if (!btnSpan || SPN_CLS_UP === undefined) return;
  const [buttonUp, buttonDn, pathUp, pathDn] = getButtonsSvgPaths(btnSpan);

  // Reset to clear state first
  btnSpan.classList.remove(...SPN_CLS_DWN.split(' '), ...SPN_CLS_UP.split(' '));
  buttonUp.classList.remove(...BTN_CLS_UD.split(' '));
  buttonUp.classList.add(...BTN_CLS_STD.split(' '));
  buttonDn.classList.remove(...BTN_CLS_UD.split(' '));
  buttonDn.classList.add(...BTN_CLS_STD.split(' '));
  buttonUp.setAttribute('aria-pressed', 'false');
  buttonDn.setAttribute('aria-pressed', 'false');
  pathDn.setAttribute('d', SVG_DWN_HOLLOW_PATH);
  pathUp.setAttribute('d', SVG_UP_HOLLOW_PATH);

  if (voteState === 'upvote') {
    btnSpan.classList.add(...SPN_CLS_UP.split(' '));
    buttonUp.classList.remove(...BTN_CLS_STD.split(' '));
    buttonUp.classList.add(...BTN_CLS_UD.split(' '));
    buttonUp.setAttribute('aria-pressed', 'true');
    pathUp.setAttribute('d', SVG_UP_FILLED_PATH);
  } else if (voteState === 'downvote') {
    btnSpan.classList.add(...SPN_CLS_DWN.split(' '));
    buttonDn.classList.remove(...BTN_CLS_STD.split(' '));
    buttonDn.classList.add(...BTN_CLS_UD.split(' '));
    buttonDn.setAttribute('aria-pressed', 'true');
    pathDn.setAttribute('d', SVG_DWN_FILLED_PATH);
  }
}
