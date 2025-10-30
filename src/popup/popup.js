'use strict';

import HistoryLRU from './HistoryLRU.js';
import ColorPickerModal from './colorPickerModal.js';

// --- Element Cache ---
// Background type selector / Save button
const bgType = document.getElementById('bg-type');
const saveButton = document.getElementById('save-settings');

// Settings panels
const blankSettings = document.getElementById('blank-settings');
const colorSettings = document.getElementById('color-settings');
const gradientSettings = document.getElementById('gradient-settings');
const imageSettings = document.getElementById('image-settings');

// Blank settings message
const blankSettingsMessage = document.getElementById('blank-settings-message');

// Color settings
const bgColorFade = document.getElementById('bg-color-fade');

// Gradient settings - Common
const gradientType = document.getElementsByName('gradient-type');
const linearGradientControls = document.getElementById(
  'linear-gradient-controls'
);
const radialGradientControls = document.getElementById(
  'radial-gradient-controls'
);

// Gradient settings - Linear
const gradientAngle = document.getElementById('gradient-angle');
const bgGradientDimmerL = document.getElementById('bg-gradient-dimmerL');
const bgGradientDimmerValueL = document.getElementById(
  'bg-gradient-dimmer-valueL'
);
const gradientDist1L = document.getElementById('gradient-dist-1L');
const gradientDist2L = document.getElementById('gradient-dis-2L');
const bgGradientScrollL = document.getElementById('bg-gradient-scroll-L');
const bgGradientFadeL = document.getElementById('bg-gradient-fade-L');
// Gradient settings - Radial
const gradientAngleR = document.getElementById('gradient-angle-R'); // dummy copy
const bgGradientDimmerR = document.getElementById('bg-gradient-dimmerR');
const bgGradientDimmerValueR = document.getElementById(
  'bg-gradient-dimmer-valueR'
);
const gradientDist1R = document.getElementById('gradient-dist-1R');
const gradientDist2R = document.getElementById('gradient-dis-2R');
const bgGradientScrollR = document.getElementById('bg-gradient-scroll-R');
const bgGradientFadeR = document.getElementById('bg-gradient-fade-R');
// Image settings
const clearImageUrlBtn = document.querySelector('button[type="reset"]');
const historyBtn = document.querySelector('#history-btn');
const bgImageUrl = document.getElementById('bg-image-url');
const bgImageFile = document.getElementById('bg-image-file');
const bgImageFileName = document.getElementById('image-file-name');
const enableFileUploadBtn = document.getElementById('enable-file-upload-btn');
const bgImageSize = document.getElementById('bg-image-size');
const bgImageScroll = document.getElementById('bg-image-scroll');
const bgImageFade = document.getElementById('bg-image-fade');
const bgImageFlow = document.getElementById('bg-image-flow');
const bgDimmer = document.getElementById('bg-dimmer');
const bgDimmerValue = document.getElementById('bg-dimmer-value');
// Common
const sidebarFlow = document.getElementById('sidebar-flow');
const autoScroll = document.getElementById('drag-scroll');

// --- Misc Functions ---

/**
 * Update blank panel message based on user action
 * @param {Object} [options] - Options object
 * @param {boolean} [options.initial=false] - Whether this is initial load
 * @param {boolean} [options.save=false] - Whether settings were just saved
 */
function blankPanelMessageUpdate({ initial = false, save = false } = {}) {
  if (bgType.value !== 'none') return;

  switch (save) {
    case false:
      if (initial) {
        blankSettingsMessage.textContent = "C'mon do something…";
      } else {
        blankSettingsMessage.textContent = 'Maybe less is more…?';
      }
      break;
    case true:
      blankSettingsMessage.textContent = 'Ahhh — very zen.';
      break;
  }
}

//  --- Event Handler Functions and Helpers --- //

// --- Gradient Type Functions --- //
/**
 * Get currently selected gradient type from radio buttons
 * @returns {string|undefined} Gradient type value ('linear' or 'radial')
 */
function getGradientType() {
  for (let btn of gradientType) {
    if (btn.checked) return btn.value;
  }
}

/**
 * Set gradient type radio button to checked state
 * @param {string} type - Gradient type ('linear' or 'radial')
 */
function setGradientType(type) {
  for (let btn of gradientType) {
    if (btn.value === type) btn.checked = true;
  }
}

/**
 * Show or hide gradient controls based on selected gradient type
 */
function showHideGradientControls() {
  const currGradientType = getGradientType();
  if (currGradientType === 'linear') {
    linearGradientControls.style.display = 'block';
    radialGradientControls.style.display = 'none';
  } else {
    linearGradientControls.style.display = 'none';
    radialGradientControls.style.display = 'block';
  }
}

// --- Load Settings From Storage Functions --- //

/**
 * Set UI element values from settings object
 * @param {Object} settings - Settings object containing all configuration
 */
function setValuesToElements(settings) {
  bgType.value = settings.common.type || 'none';
  bgColorFade.checked = settings.common.colorFade ?? true;
  setGradientType(settings.common.gradientType || 'linear');
  // Linear gradient settings
  bgGradientDimmerL.value = settings.common.gradientDimmerL ?? '67';
  bgGradientDimmerValueL.textContent = settings.common.gradientDimmerL ?? '67';
  gradientAngle.value = settings.common.gradientAngle || '107';
  gradientDist1L.value = settings.common.gradientDist1L ?? '42';
  gradientDist2L.value = settings.common.gradientDist2L ?? '48';
  bgGradientScrollL.checked = settings.common.gradientScrollL ?? false;
  bgGradientFadeL.checked = settings.common.gradientFadeL ?? true;
  // Radial gradient settings
  bgGradientDimmerR.value = settings.common.gradientDimmerR ?? '32';
  bgGradientDimmerValueR.textContent = settings.common.gradientDimmerR ?? '32';
  gradientAngleR.value = settings.common.gradientAngle || '107';
  gradientDist1R.value = settings.common.gradientDist1R ?? '22';
  gradientDist2R.value = settings.common.gradientDist2R ?? '94';
  bgGradientScrollR.checked = settings.common.gradientScrollR ?? false;
  bgGradientFadeR.checked = settings.common.gradientFadeR ?? true;
  // Image settings
  bgImageUrl.value = settings.common.imageUrl || '';
  bgImageSize.value = settings.common.imageSize || 'auto';
  bgImageScroll.checked = settings.common.imageScroll ?? true;
  bgImageFade.checked = settings.common.imageFade ?? true;
  bgImageFlow.checked = settings.common.imageFlow ?? true;
  bgDimmer.value = settings.common.imageDimmer ?? '66';
  bgDimmerValue.textContent = settings.common.imageDimmer ?? '66';
  setImageFileName(settings.common.imageFileName);
  // Common
  sidebarFlow.checked = settings.common.sidebarFlow ?? true;
  autoScroll.checked = settings.common.autoScroll ?? true;
  // Set color picker values
  setColorPickerValues(settings);

  // Remove no-transition class after a brief delay (toggle switches)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll('.slider').forEach(slider => {
        slider.classList.remove('no-transition');
      });
    });
  });
}

/**
 * Get default color value from CSS custom property
 * @param {string} name - CSS variable name (e.g., '--solid-bg-default')
 * @returns {string} Color value from CSS variable
 */
function getDefaultCssColor(name) {
  return document.documentElement.style.getPropertyValue(name);
}

/**
 * Set color picker button values from settings or default CSS variables
 * @param {Object} settings - Settings object containing color values
 */
function setColorPickerValues(settings) {
  ColorPickerModal.updateColorButton(
    'bg-color',
    settings.common.color || getDefaultCssColor('--solid-bg-default')
  );
  ColorPickerModal.updateColorButton(
    'gradient-color-1L',
    settings.common.gradientColor1L ||
      getDefaultCssColor('--linear-bg-default-1')
  );
  ColorPickerModal.updateColorButton(
    'gradient-color-2L',
    settings.common.gradientColor2L ||
      getDefaultCssColor('--linear-bg-default-2')
  );
  ColorPickerModal.updateColorButton(
    'gradient-color-3L',
    settings.common.gradientColor3L ||
      getDefaultCssColor('--linear-bg-default-3')
  );
  ColorPickerModal.updateColorButton(
    'gradient-color-1R',
    settings.common.gradientColor1R ||
      getDefaultCssColor('--radial-bg-default-1')
  );
  ColorPickerModal.updateColorButton(
    'gradient-color-2R',
    settings.common.gradientColor2R ||
      getDefaultCssColor('--radial-bg-default-2')
  );
  ColorPickerModal.updateColorButton(
    'gradient-color-3R',
    settings.common.gradientColor3R ||
      getDefaultCssColor('--radial-bg-default-3')
  );
}

/**
 * Load settings from chrome.storage.local and populate UI
 * @param {Object} data - Data object from chrome.storage.local.get
 */
function loadSettings(data) {
  const settings = data.backgroundSettings;
  if (settings) setValuesToElements(settings);
  showHidePanels(true);
}

// --- Show/Hide Panels Functions ---  //
/**
 * Clear (hide) all settings panels
 */
function clearPanels() {
  blankSettings.style.display = 'none';
  blankSettings.firstElementChild.style.opacity = '0';
  colorSettings.style.display = 'none';
  colorSettings.firstElementChild.style.opacity = '0';
  gradientSettings.style.display = 'none';
  gradientSettings.firstElementChild.style.opacity = '0';
  imageSettings.style.display = 'none';
  imageSettings.firstElementChild.style.opacity = '0';
}

/**
 * Set opacity of panel inner element with delay for fade-in effect
 * @param {HTMLElement} element - Panel element
 */
function delayedOpacitySetPanelInner(element) {
  setTimeout(() => {
    element.firstElementChild.style.opacity = '1';
  }, 0);
}

/**
 * Show or hide settings panels based on background type selection
 * @param {boolean} [initial=false] - Whether this is initial load
 */
function showHidePanels(initial = false) {
  clearPanels();

  switch (bgType.value) {
    case 'none':
      blankPanelMessageUpdate({ initial });
      blankSettings.style.display = 'block';
      delayedOpacitySetPanelInner(blankSettings);
      break;
    case 'color':
      colorSettings.style.display = 'flex';
      delayedOpacitySetPanelInner(colorSettings);
      break;
    case 'gradient':
      showHideGradientControls();
      gradientSettings.style.display = 'flex';
      delayedOpacitySetPanelInner(gradientSettings);
      break;
    case 'image':
      imageSettings.style.display = 'flex';
      delayedOpacitySetPanelInner(imageSettings);
      break;
  }
}

// --- Save Settings Functions ---  //
/**
 * Set image file name display
 * @param {string} fileName - Image file name to display
 */
function setImageFileName(fileName) {
  if (fileName) {
    bgImageFileName.textContent = fileName;
    bgImageFileName.style.display = 'inline';
  } else {
    bgImageFileName.textContent = '';
    bgImageFileName.style.display = 'none';
  }
}

/**
 * Upload image file and settings to chrome.storage.local
 * @param {File} file - Image file object
 * @param {Object} settings - Settings object
 */
function uploadSettingsImageFile(file, settings) {
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
    setImageFileName(file.name);
    bgImageUrl.value = '';
    bgImageFile.value = '';
  };
  reader.readAsDataURL(file);
}

/**
 * Upload common settings to chrome.storage.local (handles image data URL if needed)
 * @param {Object} settings - Settings object
 */
function uploadSettingsCommon(settings) {
  const setSettings = dataUrl =>
    chrome.storage.local.set(
      { backgroundSettings: { common: settings, imageDataUrl: dataUrl } },
      () => console.log('Background settings saved.')
    );

  // If image background and image url is set, clear the image file name
  if (settings.type === 'image' && settings.imageUrl) {
    settings.imageFileName = '';
    setImageFileName('');
    // Use history LRU class object to store the image url
    historyLRU.add(settings.imageUrl);
  }
  // If image file name is not set, set the image data url to null
  if (!settings.imageFileName) {
    setSettings(null);
  } else {
    // If image file name is set, get the image data url from the background settings
    chrome.storage.local.get('backgroundSettings', data => {
      const settings = data.backgroundSettings;
      if (!settings) return;
      setSettings(settings.imageDataUrl);
    });
  }
  blankPanelMessageUpdate({ save: true });
}

/**
 * Create settings object from current UI input values
 * @returns {Object} Settings object with all configuration values
 */
function makeSettingsObjectFromInputs() {
  return {
    type: bgType.value,
    // Color
    color: ColorPickerModal.getColorFromButton('bg-color'),
    colorFade: bgColorFade.checked,
    // Gradient - Common
    gradientType: getGradientType(),
    gradientAngle: gradientAngle.value,
    // Gradient - Linear
    gradientColor1L: ColorPickerModal.getColorFromButton('gradient-color-1L'),
    gradientColor2L: ColorPickerModal.getColorFromButton('gradient-color-2L'),
    gradientColor3L: ColorPickerModal.getColorFromButton('gradient-color-3L'),
    gradientDimmerL: bgGradientDimmerL.value,
    gradientDist1L: gradientDist1L.value,
    gradientDist2L: gradientDist2L.value,
    gradientScrollL: bgGradientScrollL.checked,
    gradientFadeL: bgGradientFadeL.checked,
    // Gradient - Radial
    gradientColor1R: ColorPickerModal.getColorFromButton('gradient-color-1R'),
    gradientColor2R: ColorPickerModal.getColorFromButton('gradient-color-2R'),
    gradientColor3R: ColorPickerModal.getColorFromButton('gradient-color-3R'),
    gradientDimmerR: bgGradientDimmerR.value,
    gradientDist1R: gradientDist1R.value,
    gradientDist2R: gradientDist2R.value,
    gradientScrollR: bgGradientScrollR.checked,
    gradientFadeR: bgGradientFadeR.checked,
    // Image
    imageUrl: bgImageUrl.value,
    imageSize: bgImageSize.value,
    imageScroll: bgImageScroll.checked,
    imageFade: bgImageFade.checked,
    imageFlow: bgImageFlow.checked,
    imageDimmer: bgDimmer.value,
    imageFileName: bgImageFileName.textContent,
    // Common
    sidebarFlow: sidebarFlow.checked,
    autoScroll: autoScroll.checked,
  };
}

/**
 * Save current settings to chrome.storage.local
 */
function saveSettings() {
  const settings = makeSettingsObjectFromInputs();

  const file = bgImageFile.files[0];
  if (file) {
    uploadSettingsImageFile(file, settings);
  } else {
    uploadSettingsCommon(settings);
  }
  // Set disabled, display only gradient-angle-R to match linear gradient angle
  gradientAngleR.value = gradientAngle.value;
}

// --- Dimmer Event Handlers ---  //
/**
 * Update dimmer value on mouse wheel event
 * @param {WheelEvent} e - Wheel event
 * @param {HTMLInputElement} dimmerEl - Dimmer input element
 * @param {HTMLElement} dimmerValueDisplay - Element to display dimmer value
 */
function wheelUpdateDimmerValue(e, dimmerEl, dimmerValueDisplay) {
  e.preventDefault();
  if (e.deltaY < 0) {
    dimmerEl.valueAsNumber += 2;
  } else {
    dimmerEl.valueAsNumber -= 2;
  }
  dimmerValueDisplay.textContent = dimmerEl.value;
}

/**
 * Update image dimmer value on wheel event
 * @param {WheelEvent} e - Wheel event
 */
function wheelImageDimmerUpdate(e) {
  wheelUpdateDimmerValue(e, bgDimmer, bgDimmerValue);
}

/**
 * Update linear gradient dimmer value on wheel event
 * @param {WheelEvent} e - Wheel event
 */
function wheelGradientDimmerUpdateL(e) {
  wheelUpdateDimmerValue(e, bgGradientDimmerL, bgGradientDimmerValueL);
}

/**
 * Update radial gradient dimmer value on wheel event
 * @param {WheelEvent} e - Wheel event
 */
function wheelGradientDimmerUpdateR(e) {
  wheelUpdateDimmerValue(e, bgGradientDimmerR, bgGradientDimmerValueR);
}

/**
 * Update image dimmer value display on input event
 */
function inputUpdateDimmerValue() {
  bgDimmerValue.textContent = bgDimmer.value;
}

/**
 * Update linear gradient dimmer value display on input event
 */
function inputUpdateGradientDimmerValueL() {
  bgGradientDimmerValueL.textContent = bgGradientDimmerL.value;
}

/**
 * Update radial gradient dimmer value display on input event
 */
function inputUpdateGradientDimmerValueR() {
  bgGradientDimmerValueR.textContent = bgGradientDimmerR.value;
}

// --- History Popup Functions --- //
/**
 * Show or toggle history popup with image URL history
 * @param {Event} e - Click event
 */
function showHistory(e) {
  e.stopPropagation();
  const historyPopup = document.querySelector('#history-popup');
  if (historyPopup.style.display === 'block') {
    historyPopup.style.display = 'none';
    return;
  }
  const historyList = document.querySelector('#history-list');

  // populate history popup with historyLRU
  historyList.innerHTML = '';
  historyLRU.getHistory().forEach(url => createHistoryItem(url, historyList));
  historyPopup.style.display = 'block';
}

/**
 * Hide history popup
 */
function hideHistory() {
  const historyPopup = document.querySelector('#history-popup');
  historyPopup.style.display = 'none';
}

/**
 * Create and append a history item to the history list
 * @param {string} url - Image URL
 * @param {HTMLElement} historyList - History list container element
 */
function createHistoryItem(url, historyList) {
  const li = document.createElement('div');
  const iconSpan = document.createElement('span');
  const btn = document.createElement('button');
  btn.type = 'button';
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';

  iconSpan.classList.add('mr-5');
  iconSpan.textContent = historyLRU.getMarker(url);
  btn.classList.add('btn-sm');
  deleteBtn.classList.add('btn-sm', 'deleteBtn');
  deleteBtn.textContent = '❌';

  btn.appendChild(iconSpan);
  btn.append(url.slice(0, 43) + '…');
  li.appendChild(btn);
  li.appendChild(deleteBtn);

  btn.addEventListener('click', () => (bgImageUrl.value = url));
  deleteBtn.addEventListener('click', () => historyLRU.remove(url));

  historyList.appendChild(li);
}

/**
 * Clear image URL input field
 */
function clearImageUrlInput() {
  bgImageUrl.value = '';
}

// --- Event Listeners ---
bgType.addEventListener('change', () => showHidePanels(false));
saveButton.addEventListener('click', saveSettings);
gradientType.forEach(radio => {
  radio.addEventListener('change', showHideGradientControls);
});
// Dimmers - Linear
bgGradientDimmerL.addEventListener('wheel', wheelGradientDimmerUpdateL);
bgGradientDimmerL.addEventListener('input', inputUpdateGradientDimmerValueL);
// Dimmers - Radial
bgGradientDimmerR.addEventListener('wheel', wheelGradientDimmerUpdateR);
bgGradientDimmerR.addEventListener('input', inputUpdateGradientDimmerValueR);
// Dimmers - Image
bgDimmer.addEventListener('wheel', wheelImageDimmerUpdate);
bgDimmer.addEventListener('input', inputUpdateDimmerValue);
// Image URL: History button / Clear button (clears text input)
historyBtn.addEventListener('click', showHistory);
document.querySelector('body').addEventListener('click', hideHistory);
clearImageUrlBtn.addEventListener('click', clearImageUrlInput);

// --- Initialization ---
const historyLRU = new HistoryLRU();
ColorPickerModal.init(null, saveSettings);
chrome.storage?.local.get('backgroundSettings', loadSettings);

// ---------------------------------------------- //
// --- Firefox file input alternative UI ---
// Detect Firefox
const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

// If Firefox show file input alternative UI or open new window for file upload
if (isFirefox) {
  // Check if we're in a reopened window (via URL parameter)
  const urlParams = new URLSearchParams(window.location.search);
  const isReopenedWindow = urlParams.get('fileupload') === 'true';

  if (isReopenedWindow) {
    // In reopened window: hide button
    enableFileUploadBtn.classList.add('d-none');
  } else {
    // In normal popup: show button, hide file input
    enableFileUploadBtn.classList.remove('d-none');
    bgImageFile.classList.add('d-none');
  }

  // Add click handler to enable file upload button
  enableFileUploadBtn.addEventListener('click', e => {
    const popupUrl = chrome.runtime.getURL(
      'src/popup/popup.html?fileupload=true'
    );

    // Size of popup window to be opened
    const windowWidth = 350;
    const windowHeight = 590;

    // Get click position relative to screen
    const clickX = e.screenX;
    const clickY = e.screenY;

    // Offset the window slightly so new window opens over where old popup wa
    const offsetX = -160;
    const offsetY = -220;

    let left = clickX + offsetX;
    let top = clickY + offsetY;

    // Ensure window doesn't go off-screen (if screen info is available)
    if (screen.availWidth && screen.availHeight) {
      // Keep window within screen bounds
      if (left + windowWidth > screen.availWidth) {
        left = screen.availWidth - windowWidth - 10;
      }
      if (top + windowHeight > screen.availHeight) {
        top = screen.availHeight - windowHeight - 10;
      }
      // Ensure minimum distance from screen edges
      left = Math.max(10, left);
      top = Math.max(10, top);
    }

    chrome.windows.create({
      url: popupUrl,
      type: 'popup',
      width: windowWidth,
      height: windowHeight,
      left: Math.round(left),
      top: Math.round(top),
      focused: true,
    });
  });
}

if (!chrome.storage?.local) showHidePanels(true); // dev only raw html load helper
