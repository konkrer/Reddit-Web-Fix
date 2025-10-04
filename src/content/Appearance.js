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
        this._applyBackground();
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

  // Apply background twice in case first one is to early to find target element.
  applyBackground = () => {
    this._applyBackground();
    // setTimeout(this._applyBackground, 500);
  };

  // Apply the background style to the grid container.
  _applyBackground = () => {
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) {
      this.coordinator.log('Grid container not found.');
      return;
    }

    if (!this.settings) {
      gridContainer.style.background = '';
      return;
    }

    switch (this.settings.type) {
      case 'none':
        gridContainer.style.background = '';
        gridContainer.style.willChange = '';
        gridContainer.style.transform = '';
        break;
      case 'color':
        gridContainer.style.background = this.settings.color;
        gridContainer.style.willChange = '';
        gridContainer.style.transform = '';
        break;
      case 'gradient':
        let gradientCss = '';
        if (this.settings.gradientType === 'linear') {
          gradientCss = `linear-gradient(${this.settings.gradientAngle}deg, ${this.settings.gradientColor1}, ${this.settings.gradientColor2})`;
        } else {
          // radial
          gradientCss = `radial-gradient(${this.settings.gradientColor1}, ${this.settings.gradientColor2})`;
        }
        gridContainer.style.background = gradientCss;
        gridContainer.style.willChange = '';
        gridContainer.style.transform = '';
        break;
      case 'image':
        let imageUrl = '';
        if (this.settings.imageDataUrl) {
          imageUrl = `url(${this.settings.imageDataUrl})`;
        } else if (this.settings.imageUrl) {
          imageUrl = `url(${this.settings.imageUrl})`;
        }

        // Apply dimmer overlay if dimmer value is set
        const dimmerValue = this.settings.dimmer || 0;
        const alpha = dimmerValue / 100; // Convert 0-100 to 0-1
        const dimmerOverlay = `linear-gradient(rgba(0, 0, 0, ${alpha}), rgba(0, 0, 0, ${alpha}))`;

        gridContainer.style.background = `${dimmerOverlay}, ${imageUrl}`;
        gridContainer.style.backgroundSize = this.settings.imageSize;
        gridContainer.style.backgroundRepeat = 'repeat';
        gridContainer.style.backgroundPosition = 'top';

        // Force hardware acceleration to prevent rendering shifts during scroll
        gridContainer.style.willChange = 'transform';
        gridContainer.style.transform = 'translateZ(0)';
        break;
    }
  };
}
