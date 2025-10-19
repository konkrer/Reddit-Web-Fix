'use strict';

// Transition settings for sidebar flow
const SIDEBAR_EXPAND_DURATION = 500; // ms
const SIDEBAR_COLLAPSE_DURATION = 650; // ms
const SIDEBAR_EXPAND_CURVE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const SIDEBAR_COLLAPSE_CURVE = 'cubic-bezier(0.4, 0, 0.4, 1.3)';

// Background Transition timings for when flow is enabled
const BG_FLOW_DELAY = 0; // ms
const BG_FLOW_DURATION = 200; // ms
const IMG_FLOW_DELAY = 0; // ms
const IMG_FLOW_DURATION = 300; // ms
const IMG_FLOW_OPACITY_COEF = 1.25; // opacity duration coefficient for images
const IMG_FLOW_OPACITY_DELAY_OFFSET = 50; // ms to offset opacity transition from background transition

// Class to manage page appearance customizations, like background
export default class Appearance {
  constructor(coordinator) {
    this.coordinator = coordinator;
    this.settings = null;
    this.imageDataUrl = null;
    this.initialLoad = true;
    this.loadSettings();

    // Listen for background settings changes and update background
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.backgroundSettings) {
        this.coordinator.log('Background settings changed, reloading.');
        this.settings = changes.backgroundSettings.newValue.common;
        if (this.settings.imageFileName) {
          this.imageDataUrl = changes.backgroundSettings.newValue.imageDataUrl;
        } else {
          this.imageDataUrl = null;
        }
        this.applyBackground();
      }
    });
  }

  // Load settings from chrome.storage.local
  async loadSettings() {
    let settings;
    try {
      settings = await browser.storage.local.get('backgroundSettings');
    } catch (err) {
      console.error('Appearance.js: browser-storage access fail', err);
    }
    if (settings?.backgroundSettings) {
      this.settings = settings.backgroundSettings.common;
      this.imageDataUrl = settings.backgroundSettings.imageDataUrl;
      this.coordinator.log('Background settings loaded:', this.settings);
      this.applyBackground();
    }
  }

  // Clear the background called externally
  clearBackground = () => {
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) {
      this.coordinator.log('Grid container not found.');
      return;
    }
    const bgUnderlay = this.getChildUnderlay(gridContainer);
    if (!bgUnderlay) {
      this.coordinator.log('bg-underlay not found in DOM.');
      return;
    }
    this._clearBackground(bgUnderlay);
  };

  // Apply the background style to the target element, called externally
  applyBackground = () => {
    if (!this.settings) {
      return;
    }
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) {
      this.coordinator.log('Grid container not found.');
      return;
    }
    const bgUnderlay = this.addChildUnderlay(gridContainer);

    this._setGridContainerTransition(gridContainer);
    this._setBgUnderlayTransition(bgUnderlay);
    this._applyBackground(gridContainer, bgUnderlay);
  };

  // Set transition delays and curves for the grid container
  _setGridContainerTransition = gridContainer => {
    if (this.settings.sidebarFlow) {
      this._applyGridContainerTransition(gridContainer);
    } else {
      this._removeGridContainerTransition(gridContainer);
    }
  };

  // Apply grid transition settings (controls sidebar open/close animation)
  _applyGridContainerTransition = gridContainer => {
    gridContainer.style.setProperty(
      '--expand-duration',
      SIDEBAR_EXPAND_DURATION + 'ms'
    );
    gridContainer.style.setProperty(
      '--collapse-duration',
      SIDEBAR_COLLAPSE_DURATION + 'ms'
    );
    gridContainer.style.setProperty('--expand-curve', SIDEBAR_EXPAND_CURVE);
    gridContainer.style.setProperty('--collapse-curve', SIDEBAR_COLLAPSE_CURVE);
  };

  // Remove grid transition settings
  _removeGridContainerTransition = gridContainer => {
    gridContainer.style.removeProperty('--expand-duration');
    gridContainer.style.removeProperty('--collapse-duration');
    gridContainer.style.removeProperty('--expand-curve');
    gridContainer.style.removeProperty('--collapse-curve');
  };

  _getImageFlowCondition = () => {
    return this.settings.type === 'image' && this.settings.imageFlow;
  };

  // Combined flow condition.
  _getFlowCondition = () => {
    return this._getImageFlowCondition();
  };

  _getColorFadeCondition = () => {
    return this.settings.type === 'color' && this.settings.colorFade;
  };
  _getGradientFadeCondition = () => {
    return (
      this.settings.type === 'gradient' &&
      ((this.settings.gradientType === 'linear' &&
        this.settings.gradientFadeL) ||
        (this.settings.gradientType === 'radial' &&
          this.settings.gradientFadeR))
    );
  };
  _getImageFadeCondition = () => {
    return this.settings.type === 'image' && this.settings.imageFade;
  };

  _getFadeCondition = () => {
    const colorFade = this._getColorFadeCondition();
    const gradientFade = this._getGradientFadeCondition();
    const imageFade = this._getImageFadeCondition();
    return imageFade || colorFade || gradientFade;
  };

  // Set the background transition on or off (controls image resizing and fade-in on new page load)
  _setBgUnderlayTransition = bgUnderlay => {
    // should flow transitions be set on the bg underlay?
    if (this._getFlowCondition() || this._getFadeCondition()) {
      // if image flow, use image flow timings
      if (this._getImageFlowCondition()) {
        var delay = IMG_FLOW_DELAY;
        var duration = IMG_FLOW_DURATION;
        var opacityDuration = duration * IMG_FLOW_OPACITY_COEF;
        var opacityDelay = delay + IMG_FLOW_OPACITY_DELAY_OFFSET;
      } else {
        var delay = BG_FLOW_DELAY;
        var duration = BG_FLOW_DURATION;
        var opacityDuration = duration;
        var opacityDelay = delay;
      }
      const opacityTransitionStr = `opacity ${opacityDuration}ms ease-in ${opacityDelay}ms`;
      const bgTransitionStr = `background ${duration}ms ease-out ${delay}ms`;

      if (this.initialLoad || !this._getFlowCondition()) {
        // initial load or no flow, so only opacity transition
        bgUnderlay.style.willChange = 'opacity';
        this._addTransitionProperties(bgUnderlay, opacityTransitionStr);
      } else if (!this._getFadeCondition()) {
        // no fade, so only background transition
        bgUnderlay.style.willChange = 'background';
        this._addTransitionProperties(bgUnderlay, bgTransitionStr);
      } else {
        // fade and flow, so opacity and background transitions
        bgUnderlay.style.willChange = 'opacity, background';
        this._addTransitionProperties(
          bgUnderlay,
          opacityTransitionStr,
          bgTransitionStr
        );
      }
    } else {
      // no flow, so no transitions
      bgUnderlay.style.willChange = 'none';
      bgUnderlay.style.transition = 'none';
    }
    this.initialLoad = false;
  };

  // Helper to add multiple transition properties
  _addTransitionProperties(element, ...args) {
    // Force reflow to ensure transitions are seen
    window.getComputedStyle(element).transition;
    element.style.transition = args.join(', ');
  }

  // Apply the background based on settings
  _applyBackground = (gridContainer, bgUnderlay) => {
    gridContainer.style.background = 'none';
    gridContainer.style.position = 'relative';

    // Apply the background
    switch (this.settings.type) {
      case 'none':
        this._clearBackground(bgUnderlay);
        gridContainer.style.background = 'revert-layer';
        gridContainer.style.position = 'revert-layer';
        break;
      case 'color':
        this._applyColorBackground(bgUnderlay);
        break;
      case 'gradient':
        this._applyGradientBackground(bgUnderlay);
        break;
      case 'image':
        this._applyImageBackground(bgUnderlay);
        break;
    }
  };

  // Clear the background and reset the transition
  _clearBackground = targetEl => {
    targetEl.style.background = 'none';
    targetEl.style.transition = 'none';
    targetEl.style.willChange = 'none';
  };

  // Apply the color background to the target element
  _applyColorBackground = bgUnderlay => {
    bgUnderlay.style.background = this.settings.color;
    bgUnderlay.style.opacity = '1';
  };

  // Apply the gradient background to the target element
  _applyGradientBackground = bgUnderlay => {
    if (
      (this.settings.gradientType == 'linear' &&
        this.settings.gradientScrollL) ||
      (this.settings.gradientType == 'radial' && this.settings.gradientScrollR)
    ) {
      bgUnderlay.style.position = 'absolute';
    } else {
      bgUnderlay.style.position = 'fixed';
    }
    const gradientCss = this._createGradientCss();
    const dimmerOverlay = this._createDimmerGradient(
      this.settings.gradientType === 'linear'
        ? this.settings.gradientDimmerL
        : this.settings.gradientDimmerR
    );
    bgUnderlay.style.background = `${dimmerOverlay}, ${gradientCss}`;
    bgUnderlay.style.opacity = '1';
  };

  // Apply the image background to the target element
  _applyImageBackground = bgUnderlay => {
    if (this.settings.imageScroll) {
      bgUnderlay.style.position = 'absolute';
    } else {
      bgUnderlay.style.position = 'fixed';
    }
    const dimmerOverlay = this._createDimmerGradient(this.settings.imageDimmer);
    const imageUrl = this._createImageUrlString();
    bgUnderlay.style.background = '';
    bgUnderlay.style.backgroundSize = this.settings.imageSize;
    bgUnderlay.style.backgroundRepeat = 'repeat';
    bgUnderlay.style.backgroundPosition = this.settings.imageScroll
      ? 'top'
      : 'center';
    bgUnderlay.style.backgroundImage = `${dimmerOverlay}, ${imageUrl}`;
    bgUnderlay.style.opacity = '1';
  };

  // Create the dimmer gradient
  _createDimmerGradient = (dimmerValue = 0) => {
    const alpha = dimmerValue / 100; // Convert 0-100 to 0-1
    return `linear-gradient(rgba(0, 0, 0, ${alpha}), rgba(0, 0, 0, ${alpha}))`;
  };

  // Create the gradient css
  _createGradientCss = () => {
    const gradientType = this.settings.gradientType;
    if (gradientType === 'linear') {
      const color1 = this.settings.gradientColor1L;
      const color2 = this.settings.gradientColor2L;
      const color3 = this.settings.gradientColor3L;
      const dist1 = this.settings.gradientDist1L;
      const dist2 = this.settings.gradientDist2L;
      const angle = this.settings.gradientAngle;
      return `linear-gradient(${angle}deg, ${color1}, ${dist1}%, ${color2}, ${dist2}%, ${color3})`;
    } else {
      const color1 = this.settings.gradientColor1R;
      const color2 = this.settings.gradientColor2R;
      const color3 = this.settings.gradientColor3R;
      const dist1 = this.settings.gradientDist1R;
      const dist2 = this.settings.gradientDist2R;
      return `radial-gradient(${color1}, ${dist1}%, ${color2}, ${dist2}%, ${color3})`;
    }
  };

  // Create the image url
  _createImageUrlString() {
    let imageUrlString = '';
    if (this.settings.imageFileName) {
      imageUrlString = `url(${this.imageDataUrl})`;
    } else if (this.settings.imageUrl) {
      imageUrlString = `url(${this.settings.imageUrl})`;
    }
    return imageUrlString;
  }

  // Add the child underlay to the node descendants if not present
  addChildUnderlay(node) {
    if (node.firstChild?.id === 'bg-underlay') {
      return node.firstChild;
    }
    if (node.querySelector('#bg-underlay')) {
      console.warn('bg-underlay misplaced in DOM');
    }
    const child = document.createElement('div');
    child.setAttribute('id', 'bg-underlay');
    child.setAttribute(
      'style',
      'position: fixed; top: 56; left: 0; width: 100%; height: 100%; z-index: -1; opacity: 0;'
    );
    node.prepend(child);
    return child;
  }

  // Get the child underlay from the node descendants
  getChildUnderlay(node) {
    return node.querySelector('#bg-underlay');
  }

  // Remove the child underlay from the node descendants
  removeChildUnderlay(node) {
    const children = node.querySelectorAll('#bg-underlay');
    if (children) {
      children.forEach(child => child.remove());
    }
  }
}
