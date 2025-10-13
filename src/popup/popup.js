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

// Gradient settings - Common
const gradientType = document.getElementsByName('gradient-type');
const gradientAngle = document.getElementById('gradient-angle');
const gradientAngleR = document.getElementById('gradient-angle-R'); // dummy copy
const linearGradientControls = document.getElementById(
  'linear-gradient-controls'
);
const radialGradientControls = document.getElementById(
  'radial-gradient-controls'
);

// Gradient settings - Linear
const bgGradientDimmerL = document.getElementById('bg-gradient-dimmerL');
const bgGradientDimmerValueL = document.getElementById(
  'bg-gradient-dimmer-valueL'
);
const gradientDist1L = document.getElementById('gradient-dist-1L');
const gradientDist2L = document.getElementById('gradient-dis-2L');
const bgGradientScrollL = document.getElementById('bg-gradient-scrollL');

// Gradient settings - Radial
const bgGradientDimmerR = document.getElementById('bg-gradient-dimmerR');
const bgGradientDimmerValueR = document.getElementById(
  'bg-gradient-dimmer-valueR'
);
const gradientDist1R = document.getElementById('gradient-dist-1R');
const gradientDist2R = document.getElementById('gradient-dis-2R');
const bgGradientScrollR = document.getElementById('bg-gradient-scrollR');

// Image settings
const clearImageUrlBtn = document.querySelector('button[type="reset"]');
const historyBtn = document.querySelector('#history-btn');
const bgImageUrl = document.getElementById('bg-image-url');
const bgImageFile = document.getElementById('bg-image-file');
const bgImageFileName = document.getElementById('image-file-name');
const enableFileUploadBtn = document.getElementById('enable-file-upload-btn');
const bgImageSize = document.getElementById('bg-image-size');
const bgImageScroll = document.getElementById('bg-image-scroll');
const bgImageFlow = document.getElementById('bg-image-flow');
const bgDimmer = document.getElementById('bg-dimmer');
const bgDimmerValue = document.getElementById('bg-dimmer-value');

// --- Functions ---

// Update blank panel message based on background type
function blankPanelMessageUpdate() {
  if (bgType.value === 'none') {
    blankSettingsMessage.textContent = 'Ahhh — very zen.';
  } else {
    blankSettingsMessage.textContent = 'Maybe less is more…?';
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
    linearGradientControls.style.display = 'block';
    radialGradientControls.style.display = 'none';
  } else {
    linearGradientControls.style.display = 'none';
    radialGradientControls.style.display = 'block';
  }
}

// Load settings from chrome.storage.local
function loadSettings(data) {
  const settings = data.backgroundSettings;
  if (settings) setValuesToElements(settings);
  showHideGradientControls();
  showHidePanels(true);
}

// Set values to elements based on settings
function setValuesToElements(settings) {
  bgType.value = settings.common.type || 'none';
  ColorPickerModal.updateColorButton(
    'bg-color',
    settings.common.color || '#2c1111ff'
  );
  setGradientType(settings.common.gradientType || 'linear');

  // Linear gradient settings
  ColorPickerModal.updateColorButton(
    'gradient-color-1L',
    settings.common.gradientColor1L || '#1E003BFF'
  );
  ColorPickerModal.updateColorButton(
    'gradient-color-2L',
    settings.common.gradientColor2L || '#00F5FFFF'
  );
  ColorPickerModal.updateColorButton(
    'gradient-color-3L',
    settings.common.gradientColor3L || '#024851ff'
  );
  bgGradientDimmerL.value = settings.common.gradientDimmerL ?? '67';
  bgGradientDimmerValueL.textContent = settings.common.gradientDimmerL ?? '67';
  gradientAngle.value = settings.common.gradientAngle || '107';
  gradientDist1L.value = settings.common.gradientDist1L ?? '42';
  gradientDist2L.value = settings.common.gradientDist2L ?? '48';
  bgGradientScrollL.checked = settings.common.gradientScrollL ?? false;

  // Radial gradient settings
  ColorPickerModal.updateColorButton(
    'gradient-color-1R',
    settings.common.gradientColor1R || '#540000FF'
  );
  ColorPickerModal.updateColorButton(
    'gradient-color-2R',
    settings.common.gradientColor2R || '#212246ff'
  );
  ColorPickerModal.updateColorButton(
    'gradient-color-3R',
    settings.common.gradientColor3R || '#540000FF'
  );
  bgGradientDimmerR.value = settings.common.gradientDimmerR ?? '57';
  bgGradientDimmerValueR.textContent = settings.common.gradientDimmerR ?? '57';
  gradientAngleR.value = settings.common.gradientAngle || '107';
  gradientDist1R.value = settings.common.gradientDist1R ?? '22';
  gradientDist2R.value = settings.common.gradientDist2R ?? '96';
  bgGradientScrollR.checked = settings.common.gradientScrollR ?? false;

  // Image settings
  bgImageUrl.value = settings.common.imageUrl || '';
  bgImageSize.value = settings.common.imageSize || 'auto';
  bgImageScroll.checked = settings.common.imageScroll ?? true;
  bgImageFlow.checked = settings.common.imageFlow ?? true;
  bgDimmer.value = settings.common.imageDimmer ?? '66';
  bgDimmerValue.textContent = settings.common.imageDimmer ?? '66';

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
    setImageFileName(file.name);
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
  blankPanelMessageUpdate();
}

//  --- Event Handlers --- //
// Show/hide panels based on background type selection
function showHidePanels(initial = false) {
  blankSettings.style.display = 'none';
  blankSettings.firstElementChild.style.opacity = '0';
  colorSettings.style.display = 'none';
  colorSettings.firstElementChild.style.opacity = '0';
  gradientSettings.style.display = 'none';
  gradientSettings.firstElementChild.style.opacity = '0';
  imageSettings.style.display = 'none';
  imageSettings.firstElementChild.style.opacity = '0';

  switch (bgType.value) {
    case 'none':
      blankSettings.style.display = 'block';
      blankSettingsMessage.textContent = initial
        ? "C'mon do something…"
        : 'Maybe less is more…?';
      setTimeout(() => {
        blankSettings.firstElementChild.style.opacity = '1';
      }, 0);
      break;
    case 'color':
      colorSettings.style.display = 'flex';
      setTimeout(() => {
        colorSettings.firstElementChild.style.opacity = '1';
      }, 0);
      break;
    case 'gradient':
      gradientSettings.style.display = 'flex';
      if (!initial) {
        showHideGradientControls();
      }
      setTimeout(() => {
        gradientSettings.firstElementChild.style.opacity = '1';
      }, 0);
      break;
    case 'image':
      imageSettings.style.display = 'flex';
      setTimeout(() => {
        imageSettings.firstElementChild.style.opacity = '1';
      }, 0);
      break;
    default:
      blankSettings.style.display = 'block';
      setTimeout(() => {
        blankSettings.firstElementChild.style.opacity = '1';
      }, 0);
      break;
  }
  console.log('showHidePanels', bgType.value);
}

// Save settings to chrome.storage.local
function saveSettings() {
  const settings = {
    type: bgType.value,
    // Color
    color: ColorPickerModal.getColorFromButton('bg-color'),
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
    // Gradient - Radial
    gradientColor1R: ColorPickerModal.getColorFromButton('gradient-color-1R'),
    gradientColor2R: ColorPickerModal.getColorFromButton('gradient-color-2R'),
    gradientColor3R: ColorPickerModal.getColorFromButton('gradient-color-3R'),
    gradientDimmerR: bgGradientDimmerR.value,
    gradientDist1R: gradientDist1R.value,
    gradientDist2R: gradientDist2R.value,
    gradientScrollR: bgGradientScrollR.checked,
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
  gradientAngleR.value = gradientAngle.value;
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

// Update gradient dimmer value on wheel event - Linear
function wheelGradientDimmerUpdateL(e) {
  wheelUpdateDimmerValue(e, bgGradientDimmerL, bgGradientDimmerValueL);
}

// Update gradient dimmer value on wheel event - Radial
function wheelGradientDimmerUpdateR(e) {
  wheelUpdateDimmerValue(e, bgGradientDimmerR, bgGradientDimmerValueR);
}

// Update image dimmer value on input event
function inputUpdateDimmerValue() {
  bgDimmerValue.textContent = bgDimmer.value;
}
// Update gradient dimmer value on input event - Linear
function inputUpdateGradientDimmerValueL() {
  bgGradientDimmerValueL.textContent = bgGradientDimmerL.value;
}
// Update gradient dimmer value on input event - Radial
function inputUpdateGradientDimmerValueR() {
  bgGradientDimmerValueR.textContent = bgGradientDimmerR.value;
}

// Show history popup
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
  btn.append(url.slice(0, 43) + '…');
  li.appendChild(btn);
  li.appendChild(deleteBtn);

  btn.addEventListener('click', () => (bgImageUrl.value = url));
  deleteBtn.addEventListener('click', () => historyLRU.remove(url));

  historyList.appendChild(li);
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

// Check if Firefox for file input alternative UI
const isFirefox =
  typeof InstallTrigger !== 'undefined' ||
  navigator.userAgent.includes('Firefox');

// Check if we're in a reopened window (via URL parameter)
const urlParams = new URLSearchParams(window.location.search);
const isReopenedWindow = urlParams.get('fileupload') === 'true';

if (isFirefox) {
  if (isReopenedWindow) {
    // In reopened window: hide button
    enableFileUploadBtn.classList.add('d-none');
  } else {
    // In normal popup: show button, hide file input
    enableFileUploadBtn.classList.remove('d-none');
    bgImageFile.classList.add('d-none');
  }

  // Add click handler to enable button
  enableFileUploadBtn.addEventListener('click', e => {
    const popupUrl = chrome.runtime.getURL(
      'src/popup/popup.html?fileupload=true'
    );

    // Calculate position near the click event
    const windowWidth = 350;
    const windowHeight = 525;

    // Get click position relative to screen
    const clickX = e.screenX;
    const clickY = e.screenY;

    // Offset the window slightly to the right and down from the click
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

    chrome.windows.create(
      {
        url: popupUrl,
        type: 'popup',
        width: windowWidth,
        height: windowHeight,
        left: Math.round(left),
        top: Math.round(top),
        focused: true,
      },
      () => {
        // Optionally close the original popup
        // window.close();
      }
    );
  });
}

if (!chrome.storage?.local) showHidePanels(true); // dev only raw html load
