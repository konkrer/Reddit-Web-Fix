/**
 * Storage utility functions for managing debug settings
 * @file storage.js
 */

/**
 * Create a function to retrieve the debug setting from browser storage
 * @param {Object} browser - Browser API object
 * @returns {Function} Async function that returns the debug setting
 */
export function getGetDebug(browser) {
  /**
   * Get debug setting from storage
   * @async
   * @returns {Promise<boolean>} Debug setting value
   */
  return async function getDebug() {
    const result = await browser.storage.local.get('debug');
    return result.debug ?? false;
  };
}

/**
 * Create a function to set the debug setting in browser storage
 * @param {Object} browser - Browser API object
 * @returns {Function} Async function that sets the debug setting
 */
export function getSetDebug(browser) {
  /**
   * Set debug setting in storage
   * @async
   * @param {boolean} value - Debug setting value
   * @returns {Promise<void>}
   */
  return async function setDebug(value) {
    await browser.storage.local.set({ debug: value });
    console.debug('Debug setting saved:', value);
  };
}
