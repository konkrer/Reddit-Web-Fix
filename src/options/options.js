'use strict';

// Options page script to manage debug setting

let getDebug, setDebug;

const storage = chrome.runtime.getURL('src/utils/storage.js');
import(storage).then(mod => {
  getDebug = mod.getGetDebug(browser);
  setDebug = mod.getSetDebug(browser);

  // get debug setting and sync set checkbox state
  (async () => {
    const debug = await getDebug();
    document.getElementById('debugToggle').checked = debug;
  })();
});

// Send verbose setting to content script
async function updateVerboseSetting(value) {
  try {
    await chrome.runtime.sendMessage({
      type: 'SET_VERBOSE',
      value: value,
    });
  } catch (err) {
    console.debug('Could not send message', err);
  }
}

// Listen for checkbox changes
document.getElementById('debugToggle').addEventListener('change', async e => {
  if (setDebug) await setDebug(e.target.checked);
  await updateVerboseSetting(e.target.checked);
});
