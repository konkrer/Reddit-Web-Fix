# Reddit Web Fix

Small browser extension that improves Reddit's post-vote UI by keeping up/down highlights and updating the displayed vote count consistently while you browse.

## Features

- Preserve upvote/downvote highlights across navigation
- Keep displayed vote counts in sync with local interactions
- Lightweight modern extension (Manifest V3)
- Options page to enable verbose/debug logging

## Quick install (developer)

1. Open Chrome / Edge: chrome://extensions/ — Firefox: about:debugging#/runtime/this-firefox
2. Enable "Developer mode" (Chrome/Edge) or click "Load Temporary Add-on" (Firefox).
3. Click "Load unpacked" and select the repository folder for Chrome/Edge,
   or for Firefox click "Load Temporary Add-on" and select the manifest.json file.
4. Visit https://www.reddit.com and verify the extension is active (check the console for "VoteSync activated.").

## Files of interest

- manifest-both.json — extension manifest - make changes here (MV3)
- manifest.json — last browser specific manifest created (Firefox needs "scripting" field in manifest)
- content.js — main content script (VoteSync class)
- constants.js — UI class names and SVG path constants
- browser-polyfill.min.js — web extension polyfill
- options.html / options.js — options page for debug setting
- icons/\* — extension icons used in manifest
- serviceWorker.js — background communication for extension option updating.
- buildZip.sh — simple zip file build script.
- storage.js — browser-storage access factory functions.
- privacy.html — privacy page
- animation.js — animation function for sync animation.

## Development notes

- Default verbose/debug is disabled; enable via the Options page to get more console output when fixing for UI changes.
- Changes to the manifest currently should made to manifest-both.json, then use buildZip.sh script which creates tailored
  manifest.json files for Chrome/Edge or Firefox when zipping up the extension. manifest-both.json to be removed
  when Firefox manifest V3 no longer requires "scripts" field.

## buildZip.sh usage

`./buildZip.sh chrome` or `./buildZip.sh firefox` from root directory.

## License & contact

License: MIT
