'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // --- Element Cache ---
  const bgType = document.getElementById('bg-type');
  const colorSettings = document.getElementById('color-settings');
  const gradientSettings = document.getElementById('gradient-settings');
  const imageSettings = document.getElementById('image-settings');
  const saveButton = document.getElementById('save-settings');

  // Color settings
  const bgColor = document.getElementById('bg-color');

  // Gradient settings
  const gradientType = document.getElementsByName('gradient-type');
  const gradientColor1 = document.getElementById('gradient-color-1');
  const gradientColor2 = document.getElementById('gradient-color-2');
  const gradientAngle = document.getElementById('gradient-angle');

  // Image settings
  const clearImageUrlBtn = document.querySelector('button[type="reset"]');
  const bgImageUrl = document.getElementById('bg-image-url');
  const bgImageFile = document.getElementById('bg-image-file');
  const bgImageSize = document.getElementById('bg-image-size');

  // --- Functions ---

  function showHidePanels() {
    colorSettings.style.display = 'none';
    gradientSettings.style.display = 'none';
    imageSettings.style.display = 'none';

    switch (bgType.value) {
      case 'color':
        colorSettings.style.display = 'flex';
        break;
      case 'gradient':
        gradientSettings.style.display = 'flex';
        showHideGradientControls();
        break;
      case 'image':
        imageSettings.style.display = 'flex';
        break;
      default:
        break;
    }
    console.log('showHidePanels', bgType.value);
  }

  function getGradientType() {
    for (let btn of gradientType) {
      if (btn.checked) return btn.value;
    }
  }

  function setGradientType(type) {
    for (let btn of gradientType) {
      if (btn.value === type) btn.checked = true;
    }
  }

  function showHideGradientControls() {
    const currGradientType = getGradientType();
    if (currGradientType === 'linear') {
      gradientAngle.disabled = false;
    } else {
      gradientAngle.disabled = true;
    }
  }

  function loadSettings(data) {
    if (!data.backgroundSettings) return;

    const settings = data.backgroundSettings;
    bgType.value = settings.type || 'none';

    // Color
    bgColor.value = settings.color || '#2c1111';

    // Gradient
    setGradientType(settings.gradientType || 'linear');
    gradientColor1.value = settings.gradientColor1 || '#2d0101';
    gradientColor2.value = settings.gradientColor2 || '#212245';
    gradientAngle.value = settings.gradientAngle || '90';

    // Image
    bgImageUrl.value = settings.imageUrl || '';
    bgImageSize.value = settings.imageSize || 'auto';

    showHidePanels();
  }

  function saveSettings() {
    const settings = {
      type: bgType.value,
      // Color
      color: bgColor.value,
      // Gradient
      gradientType: getGradientType(),
      gradientColor1: gradientColor1.value,
      gradientColor2: gradientColor2.value,
      gradientAngle: gradientAngle.value,
      // Image
      imageUrl: bgImageUrl.value,
      imageSize: bgImageSize.value,

      imageDataUrl: null,
    };

    const file = bgImageFile.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        settings.imageDataUrl = e.target.result;
        chrome.storage.local.set({ backgroundSettings: settings }, () => {
          console.log('Background settings saved with local image.');
          //   window.close();
        });
      };
      reader.readAsDataURL(file);
    } else {
      chrome.storage.local.set({ backgroundSettings: settings }, () => {
        console.log('Background settings saved.');
        // window.close();
      });
    }
  }

  function clearImageUrl() {
    bgImageUrl.value = '';
  }

  // --- Event Listeners ---
  bgType.addEventListener('change', showHidePanels);
  gradientSettings.addEventListener('change', showHideGradientControls);
  saveButton.addEventListener('click', saveSettings);
  clearImageUrlBtn.addEventListener('click', clearImageUrl);

  // --- Initialization ---
  chrome.storage.local.get('backgroundSettings', loadSettings);
});
