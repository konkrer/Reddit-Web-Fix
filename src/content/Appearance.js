'use strict';

// Class to manage page appearance customizations, like background.
export default class Appearance {
  constructor(coordinator) {
    this.coordinator = coordinator;
    this.settings = null;
    this.loadSettings();

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.backgroundSettings) {
        this.coordinator.log('Background settings changed, reloading.');
        this.settings = changes.backgroundSettings.newValue;
        this.applyBackground();
      }
    });
  }

  // Load settings from chrome.storage.local.
  async loadSettings() {
    const data = await browser.storage.local.get('backgroundSettings');
    if (data.backgroundSettings) {
      this.settings = data.backgroundSettings;
      this.coordinator.log('Background settings loaded:', this.settings);
      this.applyBackground();
      // additional call applyBackground with timeout??
    } else {
      this.coordinator.log('No background settings found.');
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

  _clearBackground = (gridContainer) => {
    gridContainer.style.background = '';
    gridContainer.style.willChange = '';
    gridContainer.style.transform = '';
  };

  _applyColorBackground = (gridContainer) => {
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
    gridContainer.style.background = `${dimmerOverlay}, ${imageUrl}`;
    gridContainer.style.backgroundSize = this.settings.imageSize;
    gridContainer.style.backgroundRepeat = 'repeat';
    gridContainer.style.backgroundPosition = 'top';
    // Force hardware acceleration to prevent rendering shifts during scroll
    gridContainer.style.willChange = 'transform';
    gridContainer.style.transform = 'translateZ(0)';
  };

  _calculateDimmerGradient = () => {
    const dimmerValue = this.settings.dimmer || 0;
    const alpha = dimmerValue / 100; // Convert 0-100 to 0-1
    return `linear-gradient(rgba(0, 0, 0, ${alpha}), rgba(0, 0, 0, ${alpha}))`;
  };

  _calculateGradientCss = () => {
    if (this.settings.gradientType === 'linear') {
      return `linear-gradient(${this.settings.gradientAngle}deg, ${this.settings.gradientColor1}, ${this.settings.gradientColor2})`;
    } else {
      return `radial-gradient(${this.settings.gradientColor1}, ${this.settings.gradientColor2})`;
    }
  };

  _calculateImageUrl = () => {
    let imageUrl = '';
    if (this.settings.imageDataUrl) {
      imageUrl = `url(${this.settings.imageDataUrl})`;
    } else if (this.settings.imageUrl) {
      imageUrl = `url(${this.settings.imageUrl})`;
    }
    return imageUrl;
  };

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
        const gradientCss = this._calculateGradientCss();
        this._applyGradientBackground(gridContainer, gradientCss);
        break;
      case 'image':
        const imageUrl = this._calculateImageUrl();
        const dimmerOverlay = this._calculateDimmerGradient();
        this._applyImageBackground(gridContainer, dimmerOverlay, imageUrl);
        break;
    }
  };
}
