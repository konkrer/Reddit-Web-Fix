'use strict';

// Class to manage page appearance customizations, like background.
export default class Appearance {
  constructor(verbose = false) {
    this.verbose = verbose;
    this.settings = null;
    this.loadSettings();

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.backgroundSettings) {
        this.log('Background settings changed, reloading.');
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
      this.log('Background settings loaded:', this.settings);
      this.applyBackground();
    } else {
      this.log('No background settings found.');
    }
  }

  // Apply the background style to the grid container.
  applyBackground() {
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) {
      this.log('Grid container not found.');
      return;
    }

    if (!this.settings) {
        gridContainer.style.background = ''
        return;
    }

    switch (this.settings.type) {
      case 'none':
        gridContainer.style.background = '';
        break;
      case 'color':
        gridContainer.style.background = this.settings.color;
        break;
      case 'gradient':
        let gradientCss = '';
        if (this.settings.gradientType === 'linear') {
            gradientCss = `linear-gradient(${this.settings.gradientAngle}deg, ${this.settings.gradientColor1}, ${this.settings.gradientColor2})`;
        } else { // radial
            gradientCss = `radial-gradient(${this.settings.gradientColor1}, ${this.settings.gradientColor2})`;
        }
        gridContainer.style.background = gradientCss;
        break;
      case 'image':
        let imageUrl = '';
        if (this.settings.imageDataUrl) {
          imageUrl = `url(${this.settings.imageDataUrl})`;
        } else if (this.settings.imageUrl) {
          imageUrl = `url(${this.settings.imageUrl})`;
        }
        gridContainer.style.background = imageUrl;
        gridContainer.style.backgroundSize = this.settings.imageSize;
        gridContainer.style.backgroundRepeat = 'repeat';
        gridContainer.style.backgroundPosition = 'top';
        break;
    }
  }

  log(message) {
    if (this.verbose) {
      console.debug(message);
    }
  }
}
