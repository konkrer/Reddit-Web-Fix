'use strict';

/**
 * Class to manage a Least Recently Used (LRU) history of image URLs with visual markers
 * @class HistoryLRU
 */
export default class HistoryLRU {
  /**
   * Initialize the LRU history manager
   * @param {number} [maxSize=8] - Maximum number of items to store in history
   */
  constructor(maxSize = 8) {
    this.maxSize = maxSize;
    this.history = [];
    this.markers = ['🟧', '🟦', '🟨', '🟩', '🟥', '🟪', '🟫', '⬜'];
    this.markerPool = new Array(this.markers.length)
      .fill(false)
      .map((_, index) => index)
      .reverse();
    this.urlToMarker = {};

    chrome.storage?.local.get('historyLRU', result => {
      this.history = result.historyLRU?.history || [];
      this.urlToMarker = result.historyLRU?.urlToMarker || {};
      // Remove markers from pool that are already in use
      Object.values(this.urlToMarker).forEach(idx => {
        this.markerPool.splice(this.markerPool.indexOf(idx), 1);
      });
    });
  }

  /**
   * Get the visual marker (emoji) for a given URL
   * @param {string} url - URL to get marker for
   * @returns {string} Emoji marker for the URL
   */
  getMarker(url) {
    return this.markers[this.urlToMarker[url]];
  }

  /**
   * Add an item to the history cache (most recent first)
   * @param {string} item - URL to add to history
   */
  add(item) {
    // Remove item if it already exists
    if (this.history.includes(item)) {
      this.history.splice(this.history.indexOf(item), 1);
    }

    // Add item to history
    this.history.unshift(item);

    // Remove oldest item if history is at max size
    const removed = this.history.splice(this.maxSize, 1);
    if (removed[0]) {
      // Return marker to pool
      this.markerPool.unshift(this.urlToMarker[removed[0]]);
      delete this.urlToMarker[removed[0]];
    }

    // Add marker to item if it doesn't have one
    if (this.urlToMarker[item] === undefined) {
      // Remove marker from pool
      this.urlToMarker[item] = this.markerPool.pop();
    }
    // Save to chrome.storage.local
    this.save();

    console.log('History LRU updated:', this.history);
  }

  /**
   * Get the complete history array
   * @returns {string[]} Array of URLs in history (most recent first)
   */
  getHistory() {
    return this.history;
  }

  /**
   * Remove an item from the history cache
   * @param {string} item - URL to remove from history
   */
  remove(item) {
    this.history.splice(this.history.indexOf(item), 1);
    this.markerPool.unshift(this.urlToMarker[item]);
    delete this.urlToMarker[item];
    this.save();
  }

  /**
   * Save history and marker mappings to chrome.storage.local
   */
  save() {
    chrome.storage.local.set({
      historyLRU: { history: this.history, urlToMarker: this.urlToMarker },
    });
  }

  /**
   * Clear all history and reset marker pool
   */
  clear() {
    // Clear history
    this.history = [];
    // Clear urlToMarker
    this.urlToMarker = {};
    // Return markers to pool
    this.markerPool = new Array(this.markers.length)
      .fill(false)
      .map((_, index) => index)
      .reverse();
    // Save to chrome.storage.local
    chrome.storage.local.set({ historyLRU: { history: [], urlToMarker: {} } });
    console.log('History LRU cleared:', this.history);
  }

  /**
   * Get the current size of the history cache
   * @returns {number} Number of items in history
   */
  size() {
    return this.history.length;
  }
}
