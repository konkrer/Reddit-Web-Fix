'use strict';

// Class to manage a Least Recently Used (LRU) history of items with markers

export default class HistoryLRU {
  constructor(maxSize = 8) {
    this.maxSize = maxSize;
    this.history = [];
    this.markers = ['🟧', '🟦', '🟨', '🟩', '🟥', '🟪', '🟫', '⬜'];
    this.markerPool = new Array(this.markers.length)
      .fill(false)
      .map((_, index) => index)
      .reverse();
    this.urlToMarker = {};

    chrome.storage.local.get('historyLRU', result => {
      this.history = result.historyLRU?.history || [];
      this.urlToMarker = result.historyLRU?.urlToMarker || {};
      // Remove markers from pool that are already in use
      Object.values(this.urlToMarker).forEach(idx => {
        this.markerPool.splice(this.markerPool.indexOf(idx), 1);
      });
    });
  }

  // Return marker for a given URL
  getMarker(url) {
    return this.markers[this.urlToMarker[url]];
  }

  // Add an item to the history cache
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
    chrome.storage.local.set({
      historyLRU: {
        history: this.history,
        urlToMarker: this.urlToMarker,
      },
    });

    console.log('History LRU updated:', this.history);
  }

  // Get the history cache
  getHistory() {
    return this.history;
  }

  // Clear the history cache
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

  // Get the current size of the history cache
  size() {
    return this.history.length;
  }
}
