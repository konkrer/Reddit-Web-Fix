'use strict';

const SEEN_BUT_NOT_TRACKED_LIMIT = 8000; // ~80KB, handles heavy browsing
const SESSION_STORAGE_LIMIT = 5000; // ~250KB, handles heavy usage

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
    // Light-weight tracking of seen but not vote state tracked posts.
    // For clear vote state syncing across pages to provide better UX.
    this.seenButNotTracked = new Set();
    this.currentPage = undefined;
    this.detail = undefined;

    this.testForPageChange(1000); // initialize with 1 second delay to allow for page to load
    this.coordinator.log('VoteSync initialized.');
  }

  testForPageChange(addDelay = 0) {
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
    }, 0);
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
    // We want to copy clear vote state on detail page, but
    // on other pages don't copy clear vote and return if
    // post not yet in seenButNotTracked and post has no vote state stored*
    // (*to prevent adding to seenButNotTracked again after it is cleared and vote state copied)
    if (
      !voteState ||
      (voteState === CLEAR_VOTE_INDICATOR &&
        !this.detail &&
        !this.seenButNotTracked.has(post.id) &&
        !this.sessionStorage[post.id])
    ) {
      this.addPostToSeenButNotTracked(post);
      return;
    } else {
      // remove post from seenButNotTracked in case it is present
      this.seenButNotTracked.delete(post.id);
    }
    // copy vote state to session storage and note it was copied for sync
    this.addToSessionStorage(post.id, { vote: voteRecord[voteState], count });
    this.stateCopied.add(post.id);
  }

  /* -----------------------------------------------------------*/
  /* Handle Vote State Changes and sub-methods */

  // Handle vote state changes
  handleVotes = e => {
    const post = e.target;
    const targetId = post.id;
    if (!targetId || post.tagName.toLowerCase() !== REDDIT_POST_HOST) {
      return;
    }
    const [voteClick, voteType, btnElem] = this._findVoteButtonClickEvent(e);
    if (!voteClick) {
      return;
    }

    // get btn restored state
    const btnRestoredState = this.btnStateRestored[targetId];
    delete this.btnStateRestored[targetId];

    // get recorded vote state and curr count
    const recVoteState = this.sessionStorage[targetId]?.vote;
    const currCount =
      this.sessionStorage[targetId]?.count ?? this.getCountFromUI(post);
    if (isNaN(currCount)) {
      return;
    }

    this._handleVoteLogic(
      post,
      voteType,
      recVoteState,
      currCount,
      btnRestoredState,
      btnElem
    );
    this.setCountInUI(post);
  };

  // Find if event was a vote button click event
  _findVoteButtonClickEvent(e) {
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

  // Find if path element is a vote button
  _findVoteButton(pathElem) {
    // if element does not have hasAttribute method, return false
    if (!pathElem?.hasAttribute) return false;
    return (
      this._findUpvoteButton(pathElem) || this._findDownvoteButton(pathElem)
    );
  }

  // Find if path element is an upvote button
  _findUpvoteButton(pathElem) {
    if (pathElem.hasAttribute(BTN_UPVOTE_INDICATOR)) {
      return [true, BTN_UPVOTE_INDICATOR, pathElem];
    }
    return false;
  }

  // Find if path element is a downvote button
  _findDownvoteButton(pathElem) {
    if (pathElem.hasAttribute(BTN_DOWNVOTE_INDICATOR)) {
      return [true, BTN_DOWNVOTE_INDICATOR, pathElem];
    }
    return false;
  }

  // Handle click that should be ignored
  _handleIgnoreClick(post, btnElem) {
    // Set count in UI and show sync animation
    this.setCountInUI(post);
    if (clickIgnoredAnimation) {
      clickIgnoredAnimation(btnElem);
    }
  }

  // Handle click that should clear vote
  _handleClearVote(post, recVoteState, currCount, btnRestoredState) {
    // Set vote state to clear and count to calculated count
    // if btnRestoredState is undefined, watch for vote not cleared
    this.addToSessionStorage(post.id, {
      vote: voteRecord[CLEAR_VOTE_INDICATOR],
      count: this.calcCount(CLEAR_VOTE_INDICATOR, recVoteState, currCount),
    });
    if (btnRestoredState === undefined) {
      this._watchForVoteNotCleared(post, recVoteState, currCount);
    }
  }

  // Handle click that should set vote
  _handleSetVote(post, voteType, recVoteState, currCount, btnRestoredState) {
    // Set vote state to voteType and count to calculated count
    // if btnRestoredState is restored up to down or down to up, sync vote appearance
    this.addToSessionStorage(post.id, {
      vote: voteRecord[voteType],
      count: this.calcCount(voteType, recVoteState, currCount),
    });

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

  // Handle vote logic for ignoring click, clearing vote, or setting vote
  _handleVoteLogic(
    post,
    voteType,
    recVoteState,
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

    // if recorded vote state was the same as the current vote type, handle clear vote
    if (recVoteState === voteRecord[voteType]) {
      this._handleClearVote(post, recVoteState, currCount, btnRestoredState);
    } else {
      // if recorded vote state was not the same as the current vote type, handle set vote
      this._handleSetVote(
        post,
        voteType,
        recVoteState,
        currCount,
        btnRestoredState
      );
    }
  }

  // Watch for case when action that should clear vote does not clear the UI state.
  _watchForVoteNotCleared(post, prevVoteState, prevCount) {
    const btnSpan = this.getButtonSpan(post);
    if (!btnSpan) return;
    const currUIState = this.getVoteStateFromUI(btnSpan);
    // if UI state is still previous vote state after clicking upvote/downvote to clear vote,
    // reset recorded vote state to previous vote state, set count in UI and show sync animation
    if (voteRecord[currUIState] === prevVoteState) {
      this.coordinator.log('Vote not cleared, syncing state.', post.id);
      this.addToSessionStorage(post.id, {
        vote: prevVoteState,
        count: prevCount,
      });
      clickIgnoredAnimation(btnSpan);
      this.setCountInUI(post);
    }
  }

  // Calculate count based on vote type, recorded vote state, and current count
  calcCount(voteType, recVoteState, count) {
    if (recVoteState === undefined) {
      return +count;
    }
    const adjustment = countAdjustments[voteType]?.[recVoteState] ?? 0;
    return +count + adjustment;
  }

  /* -----------------------------------------------------------*/
  /* Sync Vote State */

  // Sync UI vote state with recorded vote state
  syncLikes(postId = undefined) {
    if (postId) this._updateAppearance(postId);
    else Object.keys(this.sessionStorage).forEach(this._updateAppearance);
  }

  // Update appearance of vote state to recorded vote state for a post
  _updateAppearance = postId => {
    const post = document.getElementById(postId);
    if (post === null || this.stateCopied.has(postId)) {
      this.stateCopied.delete(postId);
      return;
    }

    const recVoteState = this.sessionStorage[postId].vote; // recorded vote state
    const btnSpan = this.getButtonSpan(post);
    const UiState = this.getVoteStateFromUI(btnSpan); // UI vote state
    if (!btnSpan || recVoteState === undefined || UiState === undefined) return;

    this._syncLogic(recVoteState, UiState, postId, btnSpan);
    this.setCountInUI(post);
  };

  // Sync logic for updating vote appearance to recorded vote state
  _syncLogic = (recVoteState, UiState, postId, btnSpan) => {
    const expectedIndicator =
      recVoteState === voteRecord[BTN_UPVOTE_INDICATOR]
        ? BTN_UPVOTE_INDICATOR
        : recVoteState === voteRecord[BTN_DOWNVOTE_INDICATOR]
        ? BTN_DOWNVOTE_INDICATOR
        : CLEAR_VOTE_INDICATOR;
    if (
      // if the UI vote state is not the same as the expectedIndicator,
      // update vote appearance and record button restored state
      UiState !== expectedIndicator
    ) {
      syncVoteAppearance(btnSpan, expectedIndicator);
      // make a button restored state record for clear vote or other vote types
      if (expectedIndicator === CLEAR_VOTE_INDICATOR)
        this.btnStateRestored[postId] = makeRestoredClearRecord(UiState);
      else this.btnStateRestored[postId] = recVoteState;
    }
  };

  /* -----------------------------------------------------------*/
  /* Utility Methods */

  // Get all reddit posts
  getPosts() {
    const posts = document.querySelectorAll(REDDIT_POST_HOST);
    return posts;
  }

  // Get button span which contains vote buttons
  getButtonSpan(post) {
    return post?.shadowRoot?.querySelector(REDDIT_BTN_CONTAINER);
  }

  // Get vote state from UI
  getVoteStateFromUI(btnSpan) {
    return btnSpan.classList.contains(UPVOTE_INDICATOR_CLASS)
      ? BTN_UPVOTE_INDICATOR
      : btnSpan.classList.contains(DOWNVOTE_INDICATOR_CLASS)
      ? BTN_DOWNVOTE_INDICATOR
      : CLEAR_VOTE_INDICATOR;
  }

  // Get count from UI
  getCountFromUI(post) {
    return +post.shadowRoot
      ?.querySelector(REDDIT_COUNT_EL)
      ?.getAttribute('number');
  }

  // Set count in UI
  setCountInUI = post => {
    post.shadowRoot
      ?.querySelector(REDDIT_COUNT_EL)
      .setAttribute('number', this.sessionStorage[post.id].count.toString());
  };

  // Add post to seenButNotTracked with size management
  addPostToSeenButNotTracked(post) {
    // Check size limit before adding and evict oldest entries if needed
    if (this.seenButNotTracked.size >= SEEN_BUT_NOT_TRACKED_LIMIT) {
      this._evictSeenButNotTracked();
    }
    this.seenButNotTracked.add(post.id);
  }

  // Evict oldest seenButNotTracked entries
  _evictSeenButNotTracked() {
    // Evict oldest 40% of entries
    const removeCount = Math.floor(this.seenButNotTracked.size * 0.4);
    const keysToRemove = Array.from(this.seenButNotTracked).slice(
      0,
      removeCount
    );
    keysToRemove.forEach(key => {
      this.seenButNotTracked.delete(key);
    });
    this.coordinator.log(
      `⚠️ Evicted ${removeCount} old seenButNotTracked entries (limit: ${SEEN_BUT_NOT_TRACKED_LIMIT})`
    );
  }

  // Add to Session Storage with size management
  addToSessionStorage(postId, voteData) {
    // Check if we need to evict oldest entries if needed
    const keys = Object.keys(this.sessionStorage);
    if (keys.length >= SESSION_STORAGE_LIMIT) {
      this._evictOldSessionData(keys);
    }
    this.sessionStorage[postId] = voteData;
  }

  // Evict old session data
  _evictOldSessionData(keys) {
    // Evict oldest 40% of entries
    const removeCount = Math.floor(keys.length * 0.4);
    const keysToRemove = keys.slice(0, removeCount);

    keysToRemove.forEach(key => {
      delete this.sessionStorage[key];
    });

    this.coordinator.log(
      `⚠️ Evicted ${removeCount} old session entries (limit: ${SESSION_STORAGE_LIMIT})`
    );
  }

  // Check if post previously marked as seen
  _getPostSeen(post) {
    return post.hasAttribute('post-seen');
  }

  // Set post-seen attribute
  _setPostSeen(post) {
    post.setAttribute('post-seen', 'true');
  }

  // Test for detail page being current page
  testForDetailPage() {
    this.detail = /^https?:\/\/(www\.)?reddit.com\/r\/.+\/comments\/.+/.test(
      window.location.href
    );
  }
} /* End of VoteSync class */

/* -----------------------------------------------------------*/
/* UI VOTE STATE MANIPULATION FUNCTIONS */

// Get buttons and svg paths
function getButtonsSvgPaths(btnSpan) {
  const buttonUp = btnSpan.querySelector(`[${BTN_UPVOTE_INDICATOR}]`);
  const buttonDn = btnSpan.querySelector(`[${BTN_DOWNVOTE_INDICATOR}]`);
  const pathUp = buttonUp.querySelector('path');
  const pathDn = buttonDn.querySelector('path');

  return [buttonUp, buttonDn, pathUp, pathDn];
}

// Sync vote appearance
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
