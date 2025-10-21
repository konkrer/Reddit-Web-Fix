'use strict';

export default class DragScroll {
  constructor() {
    const isFirefox =
      typeof InstallTrigger !== 'undefined' ||
      navigator.userAgent.includes('Firefox');

    this.scrollIntervals = [17, 10, 6, 4, 4, 4, 4];
    this.distanceCoef = [1, 1, 1, 1.5, 2.5, 3.5, 5];
    this.scrollDistance = isFirefox ? 4 : 1;
    this.scrollControlTierWidth = 20; // pixels per scroll control tier
    this.scrollBehavior = 'instant';
    this.scrollTimer = null;
    this.dragEvent = null;
    this.gridContainer = null;
    this.scrollLevel = 0;
    this.dragScroll = true;

    // check browser local storage for drag scroll setting and add drag listener
    this.loadSettings();

    // Listen for background settings changes and update background
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.backgroundSettings) {
        this.dragScroll = changes.backgroundSettings.newValue.common.dragScroll;
        if (this.dragScroll) {
          this.addDragListener();
        } else {
          this.removeDragListener();
        }
      }
    });
  }

  // Load settings from chrome.storage.local
  async loadSettings() {
    let settings;
    try {
      settings = await browser.storage.local.get('backgroundSettings');
    } catch (err) {
      console.error('DragScroll.js: browser-storage access fail', err);
    }
    if (settings?.backgroundSettings) {
      this.dragScroll = settings.backgroundSettings.common.dragScroll ?? true;
    }
    this.addDragListener();
  }

  addDragListener() {
    this.gridContainer = document.querySelector('.grid-container');
    if (!this.gridContainer) return;
    if (!this.dragScroll) return;
    this.gridContainer.addEventListener('mousedown', this.handleDragStart);
  }

  handleDragStart = event => {
    // make sure mouse button one is pressed
    if (event.button !== 0) return;
    if (
      event.target.classList.contains('grid-container') ||
      event.target.classList.contains('subgrid-container') ||
      event.target.classList.contains('main-container')
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.dragEvent = event;
      this.gridContainer.addEventListener('mousemove', this.handleDragMove);
      this.gridContainer.addEventListener('mouseup', this.handleDragEnd);
    }
  };

  handleDragMove = event => {
    event.preventDefault();
    event.stopPropagation();
    if (!this.dragEvent) return;

    const dragDistance = event.clientY - this.dragEvent.clientY;
    if (
      dragDistance < this.scrollControlTierWidth &&
      dragDistance > -this.scrollControlTierWidth
    ) {
      this.scrollLevel = 0;
      clearInterval(this.scrollTimer);
      this.scrollTimer = null;
      return;
    }
    // if mouse dragged more than 50px up or down, scroll the grid container up or down
    if (dragDistance > 0) {
      if (dragDistance > this.scrollControlTierWidth * 7) {
        if (this.scrollLevel === 7) return;
        this.scrollDown(7);
        this.scrollLevel = 7;
        console.log('scroll down 7');
      } else if (dragDistance > this.scrollControlTierWidth * 6) {
        if (this.scrollLevel === 6) return;
        this.scrollDown(6);
        this.scrollLevel = 6;
        console.log('scroll down 6');
      } else if (dragDistance > this.scrollControlTierWidth * 5) {
        if (this.scrollLevel === 5) return;
        this.scrollDown(5);
        this.scrollLevel = 5;
        console.log('scroll down 5');
      } else if (dragDistance > this.scrollControlTierWidth * 4) {
        if (this.scrollLevel === 4) return;
        this.scrollDown(4);
        this.scrollLevel = 4;
        console.log('scroll down 4');
      } else if (dragDistance > this.scrollControlTierWidth * 3) {
        if (this.scrollLevel === 3) return;
        this.scrollDown(3);
        this.scrollLevel = 3;
        console.log('scroll down 3');
      } else if (dragDistance > this.scrollControlTierWidth * 2) {
        if (this.scrollLevel === 2) return;
        this.scrollDown(2);
        this.scrollLevel = 2;
        console.log('scroll down 2');
      } else if (dragDistance > this.scrollControlTierWidth) {
        if (this.scrollLevel === 1) return;
        this.scrollDown(1);
        this.scrollLevel = 1;
        console.log('scroll down 1');
      }
    } else if (dragDistance < 0) {
      if (dragDistance < -this.scrollControlTierWidth * 7) {
        if (this.scrollLevel === -7) return;
        this.scrollUp(7);
        this.scrollLevel = -7;
        console.log('scroll up 7');
      } else if (dragDistance < -this.scrollControlTierWidth * 6) {
        if (this.scrollLevel === -6) return;
        this.scrollUp(6);
        this.scrollLevel = -6;
        console.log('scroll up 6');
      } else if (dragDistance < -this.scrollControlTierWidth * 5) {
        if (this.scrollLevel === -5) return;
        this.scrollUp(5);
        this.scrollLevel = -5;
      } else if (dragDistance < -this.scrollControlTierWidth * 4) {
        if (this.scrollLevel === -4) return;
        this.scrollUp(4);
        this.scrollLevel = -4;
      } else if (dragDistance < -this.scrollControlTierWidth * 3) {
        if (this.scrollLevel === -3) return;
        this.scrollUp(3);
        this.scrollLevel = -3;
      } else if (dragDistance < -this.scrollControlTierWidth * 2) {
        if (this.scrollLevel === -2) return;
        this.scrollUp(2);
        this.scrollLevel = -2;
      } else if (dragDistance < -this.scrollControlTierWidth) {
        if (this.scrollLevel === -1) return;
        this.scrollUp(1);
        this.scrollLevel = -1;
      }
    }
  };

  scrollUp = level => {
    if (window.pageYOffset === 0) return;
    if (this.scrollTimer) clearInterval(this.scrollTimer);

    const distCoef = this.distanceCoef[level - 1];

    const scrollUpCallback = () => {
      window.scrollTo({
        top: Math.max(window.pageYOffset - this.scrollDistance * distCoef, 0),
        behavior: this.scrollBehavior,
      });
    };
    this.scrollTimer = setInterval(
      scrollUpCallback,
      this.scrollIntervals[level - 1]
    );
  };

  scrollDown = level => {
    if (window.pageYOffset === document.body.scrollHeight) return;
    if (this.scrollTimer) clearInterval(this.scrollTimer);

    const distCoef = this.distanceCoef[level - 1];

    const scrollDownCallback = () => {
      window.scrollTo({
        top: Math.min(
          window.pageYOffset + this.scrollDistance * distCoef,
          document.body.scrollHeight
        ),
        behavior: this.scrollBehavior,
      });
    };
    this.scrollTimer = setInterval(
      scrollDownCallback,
      this.scrollIntervals[level - 1]
    );
  };

  handleDragEnd = event => {
    event.preventDefault();
    event.stopPropagation();
    clearInterval(this.scrollTimer);
    this.gridContainer.removeEventListener('mousemove', this.handleDragMove);
    this.gridContainer.removeEventListener('mouseup', this.handleDragEnd);
    this.scrollTimer = null;
    this.dragEvent = null;
    this.scrollLevel = 0;
  };

  removeDragListener() {
    if (!this.gridContainer) return;
    this.gridContainer.removeEventListener('mousedown', this.handleDragStart);
    this.gridContainer = null;
  }
}
