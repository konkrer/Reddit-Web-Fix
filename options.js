// Save the setting
async function setDebug(value) {
  await browser.storage.sync.set({ debug: value });
  console.log('Debug setting saved:', value);
}

// Send verbose setting to content script
async function updateVerboseSetting(value) {
  // Firefox's tabs.query rejects unknown properties like "frozen"
  const isFirefox = navigator.userAgent.includes('Firefox');

  const query = isFirefox
    ? { url: '*://www.reddit.com/*', discarded: false }
    : { url: '*://www.reddit.com/*', frozen: false };

  const tabs = await browser.tabs.query(query);

  for (const tab of tabs) {
    try {
      await browser.tabs.sendMessage(tab.id, {
        type: 'SET_VERBOSE',
        value: value,
      });
    } catch (err) {
      console.log(`Could not send message to tab ${tab.id}:`, err);
    }
  }
}

// Retrieve the debug setting from browser storage
async function getDebug() {
  const result = await browser.storage.sync.get('debug');
  return result.debug ?? false;
}

// get debug setting and sync set checkbox state
(async () => {
  const debug = await getDebug();
  document.getElementById('debugToggle').checked = debug;
})();

document.getElementById('debugToggle').addEventListener('change', async e => {
  await setDebug(e.target.checked);
  await updateVerboseSetting(e.target.checked);
});
