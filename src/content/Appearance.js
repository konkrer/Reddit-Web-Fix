'use strict';

// Class to manage page appearance customizations, like background.
export default class Appearance {
  constructor(coordinator) {
    this.coordinator = coordinator;
    this.settings = null;
    // this.imageDataUrl = null;
    this.loadSettings();

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.backgroundSettings) {
        this.coordinator.log('Background settings changed, reloading.');
        this.settings = changes.backgroundSettings.newValue.common;
        if (this.settings.imageFileName) {
          this.imageDataUrl =
            changes.backgroundSettings.newValue.imageDataUrl;
        } else {
          this.imageDataUrl = null;
        }
        this.applyBackground();
      }
    });
  }

  // Load settings from chrome.storage.local.
  async loadSettings() {
    const settings = await browser.storage.local.get('backgroundSettings');
    if (settings.backgroundSettings) {
      this.settings = settings.backgroundSettings.common;
      this.imageDataUrl = settings.backgroundSettings.imageDataUrl;
      this.coordinator.log('Background settings loaded:', this.settings);
      this.applyBackground();
    }
  }

  clearBackground = () => {
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) {
      this.coordinator.log('Grid container not found.');
      return;
    }
    this._clearBackground(gridContainer);
  };

  _clearBackground = gridContainer => {
    gridContainer.style.background = '';
    gridContainer.style.willChange = '';
    gridContainer.style.transform = '';
  };

  _applyColorBackground = gridContainer => {
    gridContainer.style.background = this.settings.color;
    gridContainer.style.willChange = '';
    gridContainer.style.transform = '';
  };

  _applyGradientBackground = (gridContainer, gradientCss) => {
    gridContainer.style.background = gradientCss;
    gridContainer.style.willChange = '';
    gridContainer.style.transform = '';
  };

  _applyImageBackground = (gridContainer, dimmerOverlay, imageUrl) => {
    gridContainer.style.background = '';
    gridContainer.style.backgroundSize = this.settings.imageSize;
    gridContainer.style.backgroundRepeat = 'repeat';
    gridContainer.style.backgroundPosition = 'top';
    gridContainer.style.backgroundImage = `${dimmerOverlay}, ${imageUrl}`;
    // Force hardware acceleration to prevent rendering shifts during scroll
    gridContainer.style.willChange = 'transform';
    gridContainer.style.transform = 'translateZ(0)';
  };

  _createDimmerGradient = () => {
    const dimmerValue = this.settings.dimmer || 0;
    const alpha = dimmerValue / 100; // Convert 0-100 to 0-1
    return `linear-gradient(rgba(0, 0, 0, ${alpha}), rgba(0, 0, 0, ${alpha}))`;
  };

  _createGradientCss = () => {
    if (this.settings.gradientType === 'linear') {
      return `linear-gradient(${this.settings.gradientAngle}deg, ${this.settings.gradientColor1}, ${this.settings.gradientColor2})`;
    } else {
      return `radial-gradient(${this.settings.gradientColor1}, ${this.settings.gradientColor2})`;
    }
  };

  _createImageUrl() {
    let imageUrl = '';
    if (this.settings.imageFileName) {
      imageUrl = `url(${this.imageDataUrl})`;
    } else if (this.settings.imageUrl) {
      imageUrl = `url(${this.settings.imageUrl})`;
    }
    return imageUrl;
  }

  // Apply the background style to the grid container.
  applyBackground = () => {
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) {
      this.coordinator.log('Grid container not found.');
      return;
    }

    if (!this.settings) {
      this._clearBackground(gridContainer);
      return;
    }

    switch (this.settings.type) {
      case 'none':
        this._clearBackground(gridContainer);
        break;
      case 'color':
        this._applyColorBackground(gridContainer);
        break;
      case 'gradient':
        const gradientCss = this._createGradientCss();
        this._applyGradientBackground(gridContainer, gradientCss);
        break;
      case 'image':
        const imageUrl = this._createImageUrl();
        const dimmerOverlay = this._createDimmerGradient();
        this._applyImageBackground(gridContainer, dimmerOverlay, imageUrl);
        break;
    }
  };
}
