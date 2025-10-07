'use strict';

// Class to manage page appearance customizations, like background
export default class Appearance {
  constructor(coordinator) {
    this.coordinator = coordinator;
    this.settings = null;
    this.imageDataUrl = null;
    this.loadSettings();

    // Listen for background settings changes
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
    const settings = await browser.storage.local.get('backgroundSettings');
    if (settings.backgroundSettings) {
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
    this._clearBackground(gridContainer);
  };

  // Clear the background and reset the transition
  _clearBackground = targetEl => {
    targetEl.style.background = 'none';
    targetEl.style.transition = 'revert-layer';
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
    const bgOverlay = this.addChildOverlay(gridContainer);

    gridContainer.style.transition = this.settings.imageFlow
      ? '0.8s cubic-bezier(0.18, 0.89, 0.39, 1)'
      : 'revert-layer';

    switch (this.settings.type) {
      case 'none':
        this._clearBackground(gridContainer);
        this._clearBackground(bgOverlay);
        break;
      case 'color':
        this._applyColorBackground(gridContainer, bgOverlay);
        break;
      case 'gradient':
        this._applyGradientBackground(gridContainer, bgOverlay);
        break;
      case 'image':
        this._applyImageBackground(gridContainer, bgOverlay);
        break;
    }
  };

  // Apply the color background to the target element
  _applyColorBackground = (gridContainer, bgOverlay) => {
    gridContainer.style.background = 'none';
    bgOverlay.style.background = this.settings.color;
  };

  // Apply the gradient background to the target element
  _applyGradientBackground = (gridContainer, bgOverlay) => {
    if (this.settings.gradientScroll) {
      this._clearBackground(bgOverlay);
      var target = gridContainer;
    } else {
      gridContainer.style.background = 'none';
      var target = bgOverlay;
    }
    const gradientCss = this._createGradientCss();
    const dimmerOverlay = this._createDimmerGradient(
      this.settings.gradientDimmer
    );
    target.style.background = `${dimmerOverlay}, ${gradientCss}`;
  };

  // Apply the image background to the target element
  _applyImageBackground = (gridContainer, bgOverlay) => {
    if (this.settings.imageScroll) {
      this._clearBackground(bgOverlay);
      var target = gridContainer;
    } else {
      gridContainer.style.background = 'none';
      var target = bgOverlay;
    }
    const dimmerOverlay = this._createDimmerGradient(this.settings.imageDimmer);
    const imageUrl = this._createImageUrl();
    target.style.background = '';
    target.style.backgroundSize = this.settings.imageSize;
    target.style.backgroundRepeat = 'repeat';
    target.style.backgroundPosition = this.settings.imageScroll
      ? 'top'
      : 'center';
    target.style.backgroundImage = `${dimmerOverlay}, ${imageUrl}`;
  };

  // Create the dimmer gradient
  _createDimmerGradient = (dimmerValue = 0) => {
    const alpha = dimmerValue / 100; // Convert 0-100 to 0-1
    return `linear-gradient(rgba(0, 0, 0, ${alpha}), rgba(0, 0, 0, ${alpha}))`;
  };

  // Create the gradient css
  _createGradientCss = () => {
    if (this.settings.gradientType === 'linear') {
      return `linear-gradient(${this.settings.gradientAngle}deg, ${this.settings.gradientColor1}, ${this.settings.gradientColor2})`;
    } else {
      return `radial-gradient(${this.settings.gradientColor1}, ${this.settings.gradientColor2})`;
    }
  };

  // Create the image url
  _createImageUrl() {
    let imageUrl = '';
    if (this.settings.imageFileName) {
      imageUrl = `url(${this.imageDataUrl})`;
    } else if (this.settings.imageUrl) {
      imageUrl = `url(${this.settings.imageUrl})`;
    }
    return imageUrl;
  }

  // Add the child overlay to the node
  addChildOverlay(node) {
    if (node.firstChild?.id === 'bg-overlay') {
      return node.firstChild;
    }
    if (node.querySelector('#bg-overlay')) {
      console.warn('bg-overlay misplaced in DOM');
    }
    const child = document.createElement('div');
    child.setAttribute('id', 'bg-overlay');
    child.setAttribute(
      'style',
      'position: fixed; top: 56; left: 0; width: 100%; height: 100%; z-index: -1;'
    );
    node.prepend(child);
    return child;
  }

  // Remove the child overlay from the node
  removeChildOverlay(node) {
    const children = node.querySelectorAll('#bg-overlay');
    if (children) {
      children.forEach(child => child.remove());
    }
  }
}
