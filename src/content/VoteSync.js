'use strict';

// placeholders for imported modules and constants
const addHandlersDelay = 0;
let btnClsUD, btnClsStd, spnClsUp, spnClsDwn;
let svgUpFilledPathD, svgDwnFillPathD, svgUpHollowPathD, svgDwnHollowPathD;
let clickIgnoredAnimation;

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
  constructor(verbose = true) {
    this.verbose = verbose;
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
      if (isBlockedPath()) {
        if (this.verbose) console.debug('Blocked page.');
        stopMainObserver();
        startHrefPoller();
        return;
      }
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
    // function to handle vote button clicks and update state as appropriate
    // also trigger ignored click animation if needed
    const targetId = e.target.id;
    if (!targetId || e.target.tagName.toLowerCase() !== 'shreddit-post') return;
    const [voteClick, voteType, btnElem] = this.findVoteClickEventInSD(e);
    if (!voteClick) return;

    const btnRestoredState = this.btnStateRestored[targetId];
    delete this.btnStateRestored[targetId];

    const prevVoteState = this.sessionStorage[targetId]?.vote;
    let currCount =
      this.sessionStorage[targetId]?.count || this.getCountFromUI(e.target);

    const handleClearVote = () => {
      this.sessionStorage[targetId] = {
        vote: 'Clear',
        count: this.calcCount('Clear', prevVoteState, currCount),
      };
      if (btnRestoredState === undefined) {
        this.watchForVoteNotCleared(e.target, prevVoteState, currCount);
      }
    };

    const handleSetVote = vote => {
      this.sessionStorage[targetId] = {
        vote,
        count: this.calcCount(voteType, prevVoteState, currCount),
      };
      if (
        (vote === 'U' && prevVoteState === 'D' && btnRestoredState === 'D') ||
        (vote === 'D' && prevVoteState === 'U' && btnRestoredState === 'U')
      ) {
        const syncFn =
          vote === 'U'
            ? this.syncUpvoteAppearance
            : this.syncDownvoteAppearance;
        syncFn.call(this, this.getButtonSpan(e.target));
      }
    };

    const handleIgnoredClick = () => {
      this.setCountInUI(e.target);
      if (clickIgnoredAnimation) clickIgnoredAnimation(btnElem);
    };

    if (voteType === 'upvote') {
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
    } else if (voteType === 'downvote') {
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
      if (btnSpan === null) return;
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
    return btnSpan.classList.contains('bg-action-upvote')
      ? 'U'
      : btnSpan.classList.contains('bg-action-downvote')
      ? 'D'
      : 'Clear';
  }

  getCountFromUI(sp) {
    return +sp.shadowRoot?.querySelector('faceplate-number')?.getAttribute('number');
  }

  setCountInUI = sp => {
    sp.shadowRoot?.querySelector('faceplate-number')
      .setAttribute('number', this.sessionStorage[sp.id].count.toString());
  };

  calcCount(voteType, prevVoteState, count) {
    // calculate new count based on previous state and vote action
    // if prevVoteState undefined return current count
    if (prevVoteState === undefined) return +count;

    // if upvote clicked
    if (voteType === 'upvote') {
      // if previous state was clear, increment by 1
      // if previous state was downvote, increment by 2
      if (prevVoteState == 'Clear') return +count + 1;
      else if (prevVoteState === 'D') return +count + 2;
      // if downvote clicked
    } else if (voteType === 'downvote') {
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
    return sp.shadowRoot?.querySelector('[data-post-click-location="vote"]');
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
      if (btnSpan === null || dir === undefined || initState === undefined)
        return;

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
    if (btnSpan === null ||spnClsUp === undefined) return;
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
    if (btnSpan === null || spnClsUp === undefined) return;
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
    if (btnSpan === null || spnClsUp === undefined) return;
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
