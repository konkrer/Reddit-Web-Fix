'use strict';

/**
 * Options page script to manage debug setting
 * @file options.js
 */

/**
 * Function to set debug value in storage
 * @type {Function}
 */
let setDebug;

// Initialize debug setting from storage, set checkbox state,
// and initialize setDebug function.
(async () => {
  const storage = chrome.runtime.getURL('src/utils/storage.js');
  const storageMod = await import(storage);

  const getDebug = storageMod.getGetDebug(browser);
  setDebug = storageMod.getSetDebug(browser);

  // get debug setting and sync set checkbox state
  const debug = await getDebug();
  document.getElementById('debugToggle').checked = debug;
})();

/**
 * Listen for checkbox changes and update debug setting and verbose mode
 * @param {Event} e - Change event
 * @returns {Promise<void>}
 */
document.getElementById('debugToggle').addEventListener('change', async e => {
  if (setDebug) await setDebug(e.target.checked);
  await updateVerboseSetting(e.target.checked);
});

/**
 * Send verbose setting to content scripts via background worker
 * @async
 * @param {boolean} value - Verbose mode enabled state
 * @returns {Promise<void>}
 */
async function updateVerboseSetting(value) {
  const msg = {
    type: 'SET_VERBOSE',
    value: value,
  };
  try {
    chrome.runtime.sendMessage(msg, res => {
      if (!res.ok) console.debug('SET_VERBOSE failed', res.error);
    });
  } catch (err) {
    console.debug('Could not send message', err);
  }
}
