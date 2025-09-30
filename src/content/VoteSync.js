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

/* ---------------------------------------------------------------- */
/* Reddit elements / element markers for finding relevant elements. */

// The reddit named html element with post data that is a shadow host.
const REDDIT_POST_HOST = 'shreddit-post';

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

  addCopySync = () => {
    this.addHandlersToPosts();
    this.btnStateRestored = {};
    this.syncLikes();
    if (this.verbose)
      console.debug('Added handlers, Copied State, Synced Button State');
  };

  getPosts() {
    const posts = document.querySelectorAll(REDDIT_POST_HOST);
    return posts;
  }

  getButtonSpan(post) {
    return post.shadowRoot?.querySelector(REDDIT_BTN_CONTAINER);
  }

  addHandlersToPosts(postsIn) {
    const posts = postsIn || this.getPosts();
    posts.forEach(post => {
      this.copyPostVoteState(post);
      post.addEventListener('click', this.handleVotes);
    });
  }

  removeHandlersFromPosts() {
    const posts = this.getPosts();
    posts.forEach(post => {
      post.removeEventListener('click', this.handleVotes);
    });
  }

  copyPostVoteState(post) {
    const btnSpan = this.getButtonSpan(post);
    if (!btnSpan) return;
    if (!this.detail && post.hasAttribute('post-seen')) {
      return;
    }
    const count = this.getCountFromUI(post);
    if (isNaN(count)) return;

    // if upvote state seen record state
    if (btnSpan.classList.contains(UPVOTE_INDICATOR_CLASS)) {
      this.sessionStorage[post.id] = {
        vote: voteRecord[BTN_UPVOTE_INDICATOR],
        count,
      };
      this.stateCopied.add(post.id);
    } else if (
      // if downvote state seen record state
      btnSpan.classList.contains(DOWNVOTE_INDICATOR_CLASS)
    ) {
      this.sessionStorage[post.id] = {
        vote: voteRecord[BTN_DOWNVOTE_INDICATOR],
        count,
      };
      this.stateCopied.add(post.id);
    } else if (
      // if on detail page record clear state
      this.detail
    ) {
      this.sessionStorage[post.id] = {
        vote: voteRecord[CLEAR_VOTE_INDICATOR],
        count,
      };
      this.stateCopied.add(post.id);
    }
    post.setAttribute('post-seen', 'true');
  }

  findVoteClickEventInSD(e) {
    // Find out if we have a vote click event looking in Shadow DOM.
    // Check clicked element and three elements above
    // for being a vote button having vote indicator attribute.
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
    /* Function to handle vote button clicks and update state as appropriate.
    Also trigger ignored click animation as needed. */

    // If not vote button clicked return.
    const targetId = e.target.id;
    if (!targetId || e.target.tagName.toLowerCase() !== REDDIT_POST_HOST)
      return;
    const [voteClick, voteType, btnElem] = this.findVoteClickEventInSD(e);
    if (!voteClick) return;

    // Get button restored state.
    const btnRestoredState = this.btnStateRestored[targetId];
    delete this.btnStateRestored[targetId];

    // Get previous vote state and current vote count.
    const prevVoteState = this.sessionStorage[targetId]?.vote;
    let currCount =
      this.sessionStorage[targetId]?.count || this.getCountFromUI(e.target);
    if (isNaN(currCount)) return;

    // --- Clear vote handler ---
    const handleClearVote = () => {
      this.sessionStorage[targetId] = {
        vote: voteRecord[CLEAR_VOTE_INDICATOR],
        count: this.calcCount(CLEAR_VOTE_INDICATOR, prevVoteState, currCount),
      };
      if (btnRestoredState === undefined) {
        this.watchForVoteNotCleared(e.target, prevVoteState, currCount);
      }
    };

    // --- Set vote handler ---
    const handleSetVote = voteType => {
      // set vote record in state storage
      this.sessionStorage[targetId] = {
        vote: voteRecord[voteType],
        count: this.calcCount(voteType, prevVoteState, currCount),
      };
      // if going from restored down to up, or from restored up to down
      if (
        (voteType === BTN_UPVOTE_INDICATOR &&
          btnRestoredState === voteRecord[BTN_DOWNVOTE_INDICATOR]) ||
        (voteType === BTN_DOWNVOTE_INDICATOR &&
          btnRestoredState === voteRecord[BTN_UPVOTE_INDICATOR])
      ) {
        // force UI reset to show proper vote state, remove contraindicating svg arrows.
        const syncFn =
          voteType === BTN_UPVOTE_INDICATOR
            ? syncUpvoteAppearance
            : syncDownvoteAppearance;
        syncFn.call(this, this.getButtonSpan(e.target));
      }
    };

    // --- Ignore click handler ---
    const handleIgnoreClick = () => {
      this.setCountInUI(e.target);
      if (clickIgnoredAnimation) clickIgnoredAnimation(btnElem);
    };

    // --- Main Logic ---
    // Handle vote click based on vote type,
    // button restored state, and previous state.
    if (
      // if voting the same way that the button was restored to
      btnRestoredState == voteRecord[voteType] ||
      btnRestoredState == makeRestoredClearRecord(voteType)
    ) {
      handleIgnoreClick();
      return;
    }
    // if verbose is set true - log click event to console for debugging.
    if (this.verbose)
      console.debug(
        voteType === BTN_UPVOTE_INDICATOR ? 'up click' : 'down click:',
        targetId
      );

    // if voting the same way already voted - clear vote
    if (prevVoteState === voteRecord[voteType]) {
      handleClearVote();
    } else {
      // standard vote
      handleSetVote(voteType);
    }
    this.setCountInUI(e.target);
  };

  watchForVoteNotCleared(post, initialState, currCount) {
    // Watch for case when action that should clear vote does not clear the UI state.
    // If so we need to reset vote state to original voteType and count and show sync animation.
    setTimeout(() => {
      const btnSpan = this.getButtonSpan(post);
      if (!btnSpan) return;
      const currUIState = this.getVoteStateFromUI(btnSpan);
      // if state is still upvote or downvote after clicking upvote/downvote to clear vote
      if (voteRecord[currUIState] === initialState) {
        if (this.verbose)
          console.debug('Upvote not cleared, syncing state.', post.id);
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
    // calculate new count based on previous state and vote action
    // if prevVoteState undefined return current count
    if (prevVoteState === undefined) return +count;

    // if upvote clicked
    if (voteType === BTN_UPVOTE_INDICATOR) {
      if (prevVoteState == voteRecord[CLEAR_VOTE_INDICATOR]) return +count + 1;
      else if (prevVoteState === voteRecord[BTN_DOWNVOTE_INDICATOR])
        return +count + 2;
      // if downvote clicked
    } else if (voteType === BTN_DOWNVOTE_INDICATOR) {
      if (prevVoteState == voteRecord[CLEAR_VOTE_INDICATOR]) return +count - 1;
      else if (prevVoteState == voteRecord[BTN_UPVOTE_INDICATOR])
        return +count - 2;
      // if clear vote clicked
    } else if (voteType === CLEAR_VOTE_INDICATOR) {
      if (prevVoteState === voteRecord[BTN_UPVOTE_INDICATOR]) return +count - 1;
      else if (prevVoteState === voteRecord[BTN_DOWNVOTE_INDICATOR])
        return +count + 1;
    }
  }

  syncLikes(key) {
    // sync UI state with stored state
    // if detail page do not sync
    if (this.detail) return;

    const updateAppearance = k => {
      const post = document.getElementById(k);
      if (post === null || this.stateCopied.has(k)) {
        this.stateCopied.delete(k);
        return;
      }

      const dir = this.sessionStorage[k].vote;
      const btnSpan = this.getButtonSpan(post);
      const initState = this.getVoteStateFromUI(btnSpan);
      if (!btnSpan || dir === undefined || initState === undefined) return;

      if (
        // if syncing upvote and the initial state was not upvote
        dir === voteRecord[BTN_UPVOTE_INDICATOR] &&
        !(initState === BTN_UPVOTE_INDICATOR)
      ) {
        syncUpvoteAppearance(btnSpan);
        this.btnStateRestored[k] = dir;
      } else if (
        // if syncing downvote and the initial state was not downvote
        dir === voteRecord[BTN_DOWNVOTE_INDICATOR] &&
        !(initState === BTN_DOWNVOTE_INDICATOR)
      ) {
        syncDownvoteAppearance(btnSpan);
        this.btnStateRestored[k] = dir;
      } else if (
        // if syncing clear and the initial state was not clear
        dir === voteRecord[CLEAR_VOTE_INDICATOR] &&
        !(initState === CLEAR_VOTE_INDICATOR)
      ) {
        syncClearAppearance(btnSpan);
        this.btnStateRestored[k] = makeRestoredClearRecord(initState);
      }
      this.setCountInUI(post);
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
  if (!btnSpan || SPN_CLS_UP === undefined) return;
  const [buttonUp, buttonDn, pathUp, pathDn] = getButtonsSvgPaths(btnSpan);

  btnSpan.classList.remove(...SPN_CLS_DWN.split(' '));
  btnSpan.classList.add(...SPN_CLS_UP.split(' '));
  buttonUp.classList.remove(...BTN_CLS_STD.split(' '));
  buttonUp.classList.add(...BTN_CLS_UD.split(' '));
  buttonUp.setAttribute('aria-pressed', 'true');
  buttonDn.classList.remove(...BTN_CLS_UD.split(' '));
  buttonDn.classList.add(...BTN_CLS_STD.split(' '));
  buttonDn.setAttribute('aria-pressed', 'false');
  pathDn.setAttribute('d', SVG_DWN_HOLLOW_PATH);
  pathUp.setAttribute('d', SVG_UP_FILLED_PATH);
}

function syncDownvoteAppearance(btnSpan) {
  if (!btnSpan || SPN_CLS_UP === undefined) return;
  const [buttonUp, buttonDn, pathUp, pathDn] = getButtonsSvgPaths(btnSpan);

  btnSpan.classList.remove(...SPN_CLS_UP.split(' '));
  btnSpan.classList.add(...SPN_CLS_DWN.split(' '));
  buttonUp.classList.remove(...BTN_CLS_UD.split(' '));
  buttonUp.classList.add(...BTN_CLS_STD.split(' '));
  buttonUp.setAttribute('aria-pressed', 'false');
  buttonDn.classList.remove(...BTN_CLS_STD.split(' '));
  buttonDn.classList.add(...BTN_CLS_UD.split(' '));
  buttonDn.setAttribute('aria-pressed', 'true');
  pathDn.setAttribute('d', SVG_DWN_FILLED_PATH);
  pathUp.setAttribute('d', SVG_UP_HOLLOW_PATH);
}

function syncClearAppearance(btnSpan) {
  if (!btnSpan || SPN_CLS_UP === undefined) return;
  const [buttonUp, buttonDn, pathUp, pathDn] = getButtonsSvgPaths(btnSpan);

  btnSpan.classList.remove(...SPN_CLS_DWN.split(' '));
  btnSpan.classList.remove(...SPN_CLS_UP.split(' '));
  buttonUp.classList.remove(...BTN_CLS_UD.split(' '));
  buttonUp.classList.add(...BTN_CLS_STD.split(' '));
  buttonUp.setAttribute('aria-pressed', 'false');
  buttonDn.classList.remove(...BTN_CLS_UD.split(' '));
  buttonDn.classList.add(...BTN_CLS_STD.split(' '));
  buttonDn.setAttribute('aria-pressed', 'false');
  pathDn.setAttribute('d', SVG_DWN_HOLLOW_PATH);
  pathUp.setAttribute('d', SVG_UP_HOLLOW_PATH);
}
