'use strict';
// --- Element Cache ---
const bgType = document.getElementById('bg-type');
const blankSettings = document.getElementById('blank-settings');
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
const bgImageFileName = document.getElementById('image-file-name');
const bgImageSize = document.getElementById('bg-image-size');
const bgDimmer = document.getElementById('bg-dimmer');

// --- Functions ---

function showHidePanels(initial = false) {
  blankSettings.style.display = 'none';
  colorSettings.style.display = 'none';
  gradientSettings.style.display = 'none';
  imageSettings.style.display = 'none';

  switch (bgType.value) {
    case 'none':
      blankSettings.style.display = 'block';
      blankSettings.firstElementChild.textContent = initial
        ? "C'mon do something…"
        : 'Maybe less is more…?';
      break;
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
      blankSettings.style.display = 'block';
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
  const settings = data.backgroundSettings;
  if (!settings) return;

  setValuesToElements(settings);
  showHidePanels(true);
}

function setValuesToElements(settings) {
  bgType.value = settings.type || 'none';
  bgColor.value = settings.color || '#2c1111';
  setGradientType(settings.gradientType || 'linear');
  gradientColor1.value = settings.gradientColor1 || '#2d0101';
  gradientColor2.value = settings.gradientColor2 || '#212245';
  gradientAngle.value = settings.gradientAngle || '90';
  bgImageUrl.value = settings.imageUrl || '';
  bgImageFileName.textContent = settings.imageFileName || '';
  bgImageSize.value = settings.imageSize || 'auto';
  bgDimmer.value = settings.dimmer || '0';
}

function saveSettings() {
  checkBgCleared();
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
    dimmer: bgDimmer.value,

    imageDataUrl: null,
  };

  const file = bgImageFile.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      settings.imageDataUrl = e.target.result;
      settings.imageFileName = file.name;
      chrome.storage.local.set({ backgroundSettings: settings }, () => {
        console.log('Background settings saved with local image.');
        //   window.close();
      });
    };
    reader.readAsDataURL(file);
  } else {
    settings.imageFileName = '';
    bgImageFileName.textContent = '';
    chrome.storage.local.set({ backgroundSettings: settings }, () => {
      console.log('Background settings saved.');
      // window.close();
    });
  }
}

function checkBgCleared() {
  if (bgType.value === 'none') {
    blankSettings.firstElementChild.textContent = 'Ahhh — very zen.';
  } else {
    blankSettings.firstElementChild.textContent = 'Maybe less is more…?';
  }
}

function clearImageUrl() {
  bgImageUrl.value = '';
}

// --- Event Listeners ---
bgType.addEventListener('change', () => showHidePanels(false));
gradientSettings.addEventListener('change', showHideGradientControls);
saveButton.addEventListener('click', saveSettings);
clearImageUrlBtn.addEventListener('click', clearImageUrl);

// --- Initialization ---
chrome.storage.local.get('backgroundSettings', loadSettings);
