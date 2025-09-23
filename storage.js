// Retrieve the debug setting from browser storage
export function getGetDebug(browser) {
  return async function getDebug() {
    const result = await browser.storage.local.get('debug');
    return result.debug ?? false;
  };
}

export function getSetDebug(browser) {
  return async function setDebug(value) {
    await browser.storage.local.set({ debug: value });
    console.log('Debug setting saved:', value);
  };
}
