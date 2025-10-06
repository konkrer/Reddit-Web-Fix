# Reddit Web Fix

![Extension Icon](icons/icon128.png)


Small browser extension that improves Reddit's post-vote UI by preserving up/down highlights and updating the displayed vote count consistently while you browse. Also enables you to customize the page background to a different color, color gradient, or to an image.

## Features

- Preserve upvote/downvote highlights across navigation
- Keep displayed vote counts in sync with local interactions
- No network calls, uses zero data. Simply uses information already seen for better user experience
- Customize Reddit background to add your own style
- Works with Chrome, Edge, and Firefox
- Lightweight modern extension (Manifest V3)
- Options page to enable verbose/debug logging

## Quick install (developer)

### Load Unpacked
1. Run `buildZip.sh` (see below) to create the proper manifest.json file for each browser type, or manually copy manifest-both.json and rename to manifest.json and remove "scripts" field from 
background section for Chrome/Edge or leave as is for Firefox.
2. Open Chrome / Edge: chrome(edge)://extensions/ — Firefox: about:debugging#/runtime/this-firefox
3. Enable "Developer mode" (Chrome/Edge).
4. Chrome/Edge: Click "Load unpacked" and select the repository folder —
   Firefox: Click "Load Temporary Add-on" and select the manifest.json file.
5. Visit https://www.reddit.com and verify the extension is active (check the console for "Reddit Web Fix: activated.").

### Load Zipped
1. Run `buildZip.sh` (see below) to create the proper zip file for target browser type.
2. Open Chrome / Edge: chrome(edge)://extensions/ — Firefox: about:debugging#/runtime/this-firefox
3. Enable "Developer mode" (Chrome/Edge).
4. Chrome/Edge — Drag zip file onto extension page — Firefox: Click "Load Temporary Add-on" and select the zip file.
5. Visit https://www.reddit.com and verify the extension is active (check the console for "Reddit Web Fix: activated.").

## Use
- After installing vote syncing happens automatically.
- For reddit page background customization pin the extension to the browser toolbar and click the extension icon.
## Files of interest

- manifest-both.json — extension manifest - make changes here (MV3)
- manifest.json — last browser specific manifest created (Firefox needs "scripting" field in manifest)
- content.js — main content script
- VoteSync.js — VoteSync class, holds state and logic for post vote and count syncing
- observers.js — Mutation observer class to keep track of posts and page changes
- constants.js — UI class names and SVG path constants
- browser-polyfill.min.js — web extension polyfill
- options.html / options.js — options page for debug setting
- serviceWorker.js — background communication for extension option updating
- storage.js — browser-storage access factory functions
- privacy.html — privacy page
- animation.js — animation function for sync animation
- buildZip.sh — simple zip file build script
- icons/\* — extension icons used in manifest

## Development notes

- Default verbose/debug is disabled; enable via the Options page to get more console output when fixing for UI changes.
- Changes to the manifest currently should made to manifest-both.json, then use buildZip.sh script which creates tailored
  manifest.json files for Chrome/Edge or Firefox when zipping up the extension. manifest-both.json to be removed
  when Firefox manifest V3 no longer requires "scripts" field in the "background" section.

## buildZip.sh usage

Build script `buildZip.sh` packages all file necessary into a zip file. Use `chrome` argument for Chrome or Edge browsers and `Firefox` for Firefox. 

`./buildZip.sh chrome` or `./buildZip.sh firefox` from root directory.

## License & contact

License: MIT
