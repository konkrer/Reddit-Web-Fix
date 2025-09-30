'use strict';

// Options page script to manage debug setting

let setDebug;

(async () => {
  const storage = chrome.runtime.getURL('src/utils/storage.js');
  const storageMod = await import(storage);

  const getDebug = storageMod.getGetDebug(browser);
  setDebug = storageMod.getSetDebug(browser);

  // get debug setting and sync set checkbox state
  const debug = await getDebug();
  document.getElementById('debugToggle').checked = debug;
})();

// Send verbose setting to content script
async function updateVerboseSetting(value) {
  const msg = {
    type: 'SET_VERBOSE',
    value: value,
  };
  try {
    await chrome.runtime.sendMessage(msg, res => {
      if (!res.ok) console.debug('SET_VERBOSE failed', res.error);
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
