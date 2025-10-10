'use strict';

/**
 * Color Picker Modal Module
 * Handles all color picker modal functionality including conversions and UI interactions
 */

// Modal elements (initialized on module load)
const colorModal = document.getElementById('color-picker-modal');
const modalColorPicker = document.getElementById('modal-color-picker');
const hexInput = document.getElementById('hex-input');
const applyColorBtn = document.getElementById('apply-color-btn');
const modalSaveApplyBtn = document.getElementById('modal-save-apply-btn');
const closeModalBtn = document.getElementById('close-color-modal');

// State
let currentColorTarget = null;
let onColorApplied = null; // Callback for when color is applied
let onSaveAndApply = null; // Callback for when save and apply is clicked

// --- Color Conversion Functions ---

/**
 * Convert hex color to RGBA object (supports both 6-char and 8-char hex)
 * @param {string} hex - Hex color string (e.g., "#ff5733" or "#ff5733ff")
 * @returns {object} RGBA object {r, g, b, a}
 */
function hexToRgba(hex) {
  // Remove # if present
  hex = hex.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Parse alpha if present (8-char hex), otherwise default to 1
  let a = 1;
  if (hex.length === 8) {
    a = parseInt(hex.substring(6, 8), 16) / 255;
    // Round to 2 decimal places
    a = Math.round(a * 100) / 100;
  }

  return { r, g, b, a };
}

/**
 * Convert a single color channel to hex
 * @param {number} value - Color channel value (0-255)
 * @returns {string} 2-character hex string
 */
function colorChannelToHex(value) {
  return Math.round(value || 0)
    .toString(16)
    .padStart(2, '0');
}

/**
 * Convert alpha value (0-1) to hex
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} 2-character hex string
 */
function alphaToHex(alpha) {
  const alphaValue = alpha !== undefined ? alpha : 1;
  return Math.round(alphaValue * 255)
    .toString(16)
    .padStart(2, '0');
}

/**
 * Convert RGBA object to hex string
 * @param {object} rgba - RGBA object {r, g, b, a}
 * @returns {string} 8-character hex string (e.g., "#ff5733ff")
 */
function rgbaObjectToHexString(rgba) {
  const r = colorChannelToHex(rgba.r);
  const g = colorChannelToHex(rgba.g);
  const b = colorChannelToHex(rgba.b);
  const a = alphaToHex(rgba.a);
  
  return `#${r}${g}${b}${a}`;
}

/**
 * Convert RGBA object to hex (always includes alpha as 8-char hex)
 * @param {object|string} rgba - RGBA object or string
 * @returns {string} 8-character hex string (e.g., "#ff5733ff")
 */
function rgbaToHex(rgba) {
  if (typeof rgba === 'string') {
    return rgba;
  }
  
  if (rgba && typeof rgba === 'object') {
    return rgbaObjectToHexString(rgba);
  }
  
  return '#000000ff';
}

// --- Color Button Management ---

/**
 * Get color value from a color picker button
 * @param {string} targetId - The data-target attribute value of the button
 * @returns {string} Hex color string
 */
function getColorFromButton(targetId) {
  const btn = document.querySelector(`[data-target="${targetId}"]`);
  if (!btn) return '#000000ff';
  const preview = btn.querySelector('.color-preview');
  return preview ? preview.getAttribute('data-color') : '#000000ff';
}

/**
 * Update color button display with new color
 * @param {string} targetId - The data-target attribute value of the button
 * @param {string} color - Hex color string (6 or 8 characters)
 */
function updateColorButton(targetId, color) {
  const btn = document.querySelector(`[data-target="${targetId}"]`);
  if (!btn) return;

  // Ensure color has alpha channel (add 'ff' if 6-char hex)
  if (color.length === 7 && color.startsWith('#')) {
    color = color + 'ff';
  }

  const preview = btn.querySelector('.color-preview');

  if (preview) {
    preview.style.backgroundColor = color;
    preview.setAttribute('data-color', color);
  }
}

// --- Modal Control Functions ---

/**
 * Open color picker modal
 * @param {string} targetId - The data-target attribute value of the button
 * @param {string} currentColor - Current hex color string
 */
function openColorModal(targetId, currentColor) {
  currentColorTarget = targetId;
  colorModal.classList.add('active');

  // Convert hex to rgba object and set as JSON attribute
  const rgbaColor = hexToRgba(currentColor);
  const colorJson = JSON.stringify(rgbaColor);

  // Set color after modal is visible to ensure proper initialization
  modalColorPicker.setAttribute('color', colorJson);
  modalColorPicker.color = rgbaColor;
  hexInput.value = currentColor.toUpperCase();
}

/**
 * Close color picker modal
 */
function closeColorModal() {
  colorModal.classList.remove('active');
  currentColorTarget = null;
  // Reset button text when closing modal
  applyColorBtn.textContent = 'Pick';
}

/**
 * Apply selected color and close modal
 */
function applyColor() {
  if (!currentColorTarget) return;

  const newColor = modalColorPicker.color;
  const hexColor = typeof newColor === 'string' ? newColor : rgbaToHex(newColor);
  
  updateColorButton(currentColorTarget, hexColor);
  
  // Call callback if provided
  if (onColorApplied) {
    onColorApplied(currentColorTarget, hexColor);
  }
  
  closeColorModal();
}

// --- Event Listeners Setup ---

/**
 * Handle color picker button click
 * @param {Event} e - Click event
 */
function handleColorPickerButtonClick(e) {
  e.preventDefault();
  e.stopPropagation();
  const btn = e.currentTarget;
  const targetId = btn.getAttribute('data-target');
  const currentColor = getColorFromButton(targetId);
  openColorModal(targetId, currentColor);
}

/**
 * Handle modal background click (close when clicking outside)
 * @param {Event} e - Click event
 */
function handleModalBackgroundClick(e) {
  if (e.target === colorModal) {
    closeColorModal();
  }
}

/**
 * Handle color picker color change event
 * @param {CustomEvent} e - Color changed event
 */
function handleColorPickerChange(e) {
  const colorValue = e.detail.value;
  // Handle both hex string and rgba object formats
  const hexValue = typeof colorValue === 'string' ? colorValue : rgbaToHex(colorValue);
  hexInput.value = hexValue.toUpperCase();
  
  // Reset "Pick" button text when color changes
  if (applyColorBtn.textContent === 'Close') {
    applyColorBtn.textContent = 'Pick';
  }
}

/**
 * Handle hex input change
 */
function handleHexInputChange() {
  const hex = hexInput.value.trim();
  // Accept both 6-char (#RRGGBB) and 8-char (#RRGGBBAA) hex
  if (/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(hex)) {
    const rgbaColor = hexToRgba(hex);
    const colorJson = JSON.stringify(rgbaColor);
    modalColorPicker.setAttribute('color', colorJson);
    modalColorPicker.color = rgbaColor;
  }
}

/**
 * Handle hex input keypress (Enter to apply)
 * @param {KeyboardEvent} e - Keypress event
 */
function handleHexInputKeypress(e) {
  if (e.key === 'Enter') {
    applyColor();
  }
}

/**
 * Attach event listeners to color picker buttons
 */
function attachColorPickerButtonListeners() {
  document.querySelectorAll('.color-picker-btn').forEach(btn => {
    btn.addEventListener('click', handleColorPickerButtonClick);
  });
}

/**
 * Handle save and apply button click
 */
function handleSaveAndApply() {
  if (!currentColorTarget) return;

  // Update the color button with the current selection
  const newColor = modalColorPicker.color;
  const hexColor = typeof newColor === 'string' ? newColor : rgbaToHex(newColor);
  updateColorButton(currentColorTarget, hexColor);
  
  // Call the save and apply callback if provided
  if (onSaveAndApply) {
    onSaveAndApply();
  }
  
  // Change "Pick" button text to "Close"
  applyColorBtn.textContent = 'Close';
}

/**
 * Attach event listeners to modal controls
 */
function attachModalEventListeners() {
  closeModalBtn.addEventListener('click', closeColorModal);
  applyColorBtn.addEventListener('click', applyColor);
  modalSaveApplyBtn.addEventListener('click', handleSaveAndApply);
  colorModal.addEventListener('click', handleModalBackgroundClick);
}

/**
 * Attach event listeners to color picker and hex input
 */
function attachColorInputListeners() {
  modalColorPicker.addEventListener('color-changed', handleColorPickerChange);
  hexInput.addEventListener('input', handleHexInputChange);
  hexInput.addEventListener('keypress', handleHexInputKeypress);
}

/**
 * Initialize color picker modal and attach all event listeners
 * @param {Function} callback - Optional callback function called when color is applied
 * @param {Function} saveCallback - Optional callback function called when save and apply is clicked
 */
function initColorPickerModal(callback, saveCallback) {
  onColorApplied = callback;
  onSaveAndApply = saveCallback;
  
  attachColorPickerButtonListeners();
  attachModalEventListeners();
  attachColorInputListeners();
}

// --- Public API ---
export default {
  init: initColorPickerModal,
  getColorFromButton,
  updateColorButton,
  hexToRgba,
  rgbaToHex,
};

