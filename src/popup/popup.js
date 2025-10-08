'use strict';

import HistoryLRU from './HistoryLRU.js';

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
const bgGradientDimmer = document.getElementById('bg-gradient-dimmer');
const bgGradientDimmerValue = document.getElementById(
  'bg-gradient-dimmer-value'
);
const bgGradientScroll = document.getElementById('bg-gradient-scroll');
// Image settings
const clearImageUrlBtn = document.querySelector('button[type="reset"]');
const historyBtn = document.querySelector('#history-btn');
const bgImageUrl = document.getElementById('bg-image-url');
const bgImageFile = document.getElementById('bg-image-file');
const bgImageFileName = document.getElementById('image-file-name');
const bgImageSize = document.getElementById('bg-image-size');
const bgImageScroll = document.getElementById('bg-image-scroll');
const bgImageFlow = document.getElementById('bg-image-flow');
const bgDimmer = document.getElementById('bg-dimmer');
const bgDimmerValue = document.getElementById('bg-dimmer-value');

// History LRU
const historyLRU = new HistoryLRU();

// --- Functions ---

// Update blank panel message based on background type
function blankPanelMessageUpdate() {
  if (bgType.value === 'none') {
    blankSettings.firstElementChild.textContent = 'Ahhh — very zen.';
  } else {
    blankSettings.firstElementChild.textContent = 'Maybe less is more…?';
  }
}

// Get gradient type from gradient type buttons
function getGradientType() {
  for (let btn of gradientType) {
    if (btn.checked) return btn.value;
  }
}

// Set gradient type button checked based on type
function setGradientType(type) {
  for (let btn of gradientType) {
    if (btn.value === type) btn.checked = true;
  }
}

// Show/hide gradient controls based on gradient type
function showHideGradientControls() {
  const currGradientType = getGradientType();
  if (currGradientType === 'linear') {
    gradientAngle.disabled = false;
  } else {
    gradientAngle.disabled = true;
  }
}

// Load settings from chrome.storage.local
function loadSettings(data) {
  const settings = data.backgroundSettings;
  if (!settings) return;

  setValuesToElements(settings);
  showHidePanels(true);
}

// Set values to elements based on settings
function setValuesToElements(settings) {
  bgType.value = settings.common.type || 'none';
  bgColor.value = settings.common.color || '#2c1111';
  setGradientType(settings.common.gradientType || 'linear');
  gradientColor1.value = settings.common.gradientColor1 || '#2d0101';
  gradientColor2.value = settings.common.gradientColor2 || '#212245';
  gradientAngle.value = settings.common.gradientAngle || '90';
  bgGradientDimmer.value = settings.common.gradientDimmer ?? '0';
  bgGradientDimmerValue.textContent = settings.common.gradientDimmer ?? '0';
  bgGradientScroll.checked = settings.common.gradientScroll ?? true;
  bgImageUrl.value = settings.common.imageUrl || '';
  bgImageSize.value = settings.common.imageSize || 'auto';
  bgImageScroll.checked = settings.common.imageScroll ?? true;
  bgImageFlow.checked = settings.common.imageFlow ?? true;
  bgDimmer.value = settings.common.imageDimmer ?? '34';
  bgDimmerValue.textContent = settings.common.imageDimmer ?? '34';

  setImageFileName(settings.common.imageFileName);
}

// Set image file name based on settings
function setImageFileName(fileName) {
  if (fileName) {
    bgImageFileName.textContent = fileName;
    bgImageFileName.style.display = 'inline';
  } else {
    bgImageFileName.textContent = '';
    bgImageFileName.style.display = 'none';
  }
}

// Upload image file and common settings to chrome.storage.local
function uploadImageFile(file, settings) {
  const reader = new FileReader();
  reader.onload = e => {
    const imageDataUrl = e.target.result;
    settings.imageFileName = file.name;
    settings.imageUrl = '';
    chrome.storage.local.set(
      {
        backgroundSettings: { common: settings, imageDataUrl: imageDataUrl },
      },
      () => {
        console.log('Background settings saved with local image.');
      }
    );
    bgImageFileName.textContent = file.name;
    bgImageFileName.style.display = 'inline';
    bgImageUrl.value = '';
    bgImageFile.value = '';
  };
  reader.readAsDataURL(file);
}

// Upload common settings to chrome.storage.local and pass image data url if needed
function uploadCommonSettings(settings) {
  const setSettings = dataUrl =>
    chrome.storage.local.set(
      { backgroundSettings: { common: settings, imageDataUrl: dataUrl } },
      () => console.log('Background settings saved.')
    );

  // If image url is set, clear the image file name
  if (settings.imageUrl && settings.type === 'image') {
    settings.imageFileName = '';
    bgImageFileName.textContent = '';
    bgImageFileName.style.display = 'none';
    // Use history LRU class object to store the image url
    historyLRU.add(settings.imageUrl);
  }
  // If image file name is not set, set the image data url to null
  if (!settings.imageFileName) {
    blankPanelMessageUpdate();
    setSettings(null);
  } else {
    // If image file name is set, get the image data url from the background settings
    chrome.storage.local.get('backgroundSettings', data => {
      const settings = data.backgroundSettings;
      if (!settings) return;
      setSettings(settings.imageDataUrl);
    });
  }
}

//  --- Event Handlers --- //
// Show/hide panels based on background type selection
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

// Save settings to chrome.storage.local
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
    gradientDimmer: bgGradientDimmer.value,
    gradientScroll: bgGradientScroll.checked,
    // Image
    imageUrl: bgImageUrl.value,
    imageSize: bgImageSize.value,
    imageScroll: bgImageScroll.checked,
    imageFlow: bgImageFlow.checked,
    imageDimmer: bgDimmer.value,
    imageFileName: bgImageFileName.textContent,
  };

  const file = bgImageFile.files[0];
  if (file) {
    uploadImageFile(file, settings);
  } else {
    uploadCommonSettings(settings);
  }
}

// Clear image URL input
function clearImageUrlInput() {
  bgImageUrl.value = '';
}

// Update dimmer value on wheel event
function wheelUpdateDimmerValue(e, dimmerEl, dimmerValueDisplay) {
  e.preventDefault();
  if (e.deltaY < 0) {
    dimmerEl.valueAsNumber += 2;
  } else {
    dimmerEl.valueAsNumber -= 2;
  }
  dimmerValueDisplay.textContent = dimmerEl.value;
}

// Update image dimmer value on wheel event
function wheelImageDimmerUpdate(e) {
  wheelUpdateDimmerValue(e, bgDimmer, bgDimmerValue);
}

// Update gradient dimmer value on wheel event
function wheelGradientDimmerUpdate(e) {
  wheelUpdateDimmerValue(e, bgGradientDimmer, bgGradientDimmerValue);
}

// Update image dimmer value on input event
function inputUpdateDimmerValue() {
  bgDimmerValue.textContent = bgDimmer.value;
}
// Update gradient dimmer value on input event
function inputUpdateGradientDimmerValue() {
  bgGradientDimmerValue.textContent = bgGradientDimmer.value;
}

// Show history popup
function showHistory(e) {
  e.stopPropagation();
  const historyPopup = document.querySelector('#history-popup');
  const historyList = document.querySelector('#history-list');

  // populate history popup with historyLRU
  historyList.innerHTML = '';
  historyLRU.getHistory().forEach(url => createHistoryItem(url, historyList));
  historyPopup.style.display = 'block';
}

// Hide history popup
function hideHistory() {
  const historyPopup = document.querySelector('#history-popup');
  historyPopup.style.display = 'none';
}

// Create a history item
function createHistoryItem(url, historyList) {
  const li = document.createElement('div');
  const iconSpan = document.createElement('span');
  const btn = document.createElement('button');
  const deleteBtn = document.createElement('button');

  iconSpan.classList.add('mr-5');
  iconSpan.textContent = historyLRU.getMarker(url);
  btn.classList.add('btn-sm');
  deleteBtn.classList.add('btn-sm', 'deleteBtn');
  deleteBtn.textContent = '❌';

  btn.appendChild(iconSpan);
  btn.append(url.slice(0, 45) + '…');
  li.appendChild(btn);
  li.appendChild(deleteBtn);

  btn.addEventListener('click', () => (bgImageUrl.value = url));
  deleteBtn.addEventListener('click', () => historyLRU.remove(url));

  historyList.appendChild(li);
}

// --- Event Listeners ---
bgType.addEventListener('change', () => showHidePanels(false));
gradientSettings.addEventListener('change', showHideGradientControls);
saveButton.addEventListener('click', saveSettings);
clearImageUrlBtn.addEventListener('click', clearImageUrlInput);
bgGradientDimmer.addEventListener('wheel', wheelGradientDimmerUpdate);
bgGradientDimmer.addEventListener('input', inputUpdateGradientDimmerValue);
bgDimmer.addEventListener('wheel', wheelImageDimmerUpdate);
bgDimmer.addEventListener('input', inputUpdateDimmerValue);
historyBtn.addEventListener('click', showHistory);
document.querySelector('body').addEventListener('click', hideHistory);

// --- Initialization ---
chrome.storage.local.get('backgroundSettings', loadSettings);
