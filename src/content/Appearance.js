'use strict';

// Class to manage page appearance customizations, like background
export default class Appearance {
  constructor(coordinator) {
    this.coordinator = coordinator;
    this.settings = null;
    this.imageDataUrl = null;
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
    this._applyBackground(gridContainer, bgUnderlay);
  };

  // Set the transition for the grid container
  _setGridContainerTransition = gridContainer => {
    if (this.settings.imageFlow) {
      const bgTransition =
        'background 0.8s cubic-bezier(0.18, 0.89, 0.39, 1) 300ms';
      const gridTransition =
        'grid-template-columns 0.8s cubic-bezier(0.18, 0.89, 0.39, 1)';
      gridContainer.willChange = 'grid-template-columns, background';
      gridContainer.style.transition = `${gridTransition}, ${bgTransition}`;
    } else {
      gridContainer.willChange = 'revert-layer';
      gridContainer.style.transition = 'revert-layer';
    }
  };

  _applyBackground = (gridContainer, bgUnderlay) => {
    // Apply the background
    switch (this.settings.type) {
      case 'none':
        this._clearBackground(gridContainer);
        this._clearBackground(bgUnderlay);
        break;
      case 'color':
        this._applyColorBackground(gridContainer, bgUnderlay);
        break;
      case 'gradient':
        this._applyGradientBackground(gridContainer, bgUnderlay);
        break;
      case 'image':
        this._applyImageBackground(gridContainer, bgUnderlay);
        break;
    }
  };

  // Clear the background and reset the transition
  _clearBackground = targetEl => {
    targetEl.style.background = 'none';
    targetEl.style.transition = 'revert-layer';
  };

  // Apply the color background to the target element
  _applyColorBackground = (gridContainer, bgUnderlay) => {
    gridContainer.style.background = 'none';
    bgUnderlay.style.background = this.settings.color;
  };

  // Apply the gradient background to the target element
  _applyGradientBackground = (gridContainer, bgUnderlay) => {
    if (this.settings.gradientScroll) {
      this._clearBackground(bgUnderlay);
      var target = gridContainer;
    } else {
      gridContainer.style.background = 'none';
      var target = bgUnderlay;
    }
    const gradientCss = this._createGradientCss();
    const dimmerUnderlay = this._createDimmerGradient(
      this.settings.gradientDimmer
    );
    target.style.background = `${dimmerUnderlay}, ${gradientCss}`;
  };

  // Apply the image background to the target element
  _applyImageBackground = (gridContainer, bgUnderlay) => {
    if (this.settings.imageScroll) {
      this._clearBackground(bgUnderlay);
      var target = gridContainer;
    } else {
      gridContainer.style.background = 'none';
      var target = bgUnderlay;
    }
    const dimmerUnderlay = this._createDimmerGradient(
      this.settings.imageDimmer
    );
    const imageUrl = this._createImageUrl();
    target.style.background = '';
    target.style.backgroundSize = this.settings.imageSize;
    target.style.backgroundRepeat = 'repeat';
    target.style.backgroundPosition = this.settings.imageScroll
      ? 'top'
      : 'center';
    target.style.backgroundImage = `${dimmerUnderlay}, ${imageUrl}`;
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

  // Add the child underlay to the node
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
      'position: fixed; top: 56; left: 0; width: 100%; height: 100%; z-index: -1;'
    );
    node.prepend(child);
    return child;
  }

  // Remove the child underlay from the node
  removeChildUnderlay(node) {
    const children = node.querySelectorAll('#bg-underlay');
    if (children) {
      children.forEach(child => child.remove());
    }
  }
}
