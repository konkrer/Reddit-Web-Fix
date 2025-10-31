# Reddit Web Fix

![Extension Icon](icons/icon128.png)


Browser extension that improves Reddit's post-vote UI by preserving up/down highlights and updating the displayed vote count consistently while you browse. Also allows you to customize the page background and offers an auto-scroll feature for an alternate way to browse page content.

## Features

- Preserve upvote/downvote highlights across navigation
- Keep displayed vote counts in sync with local interactions
- Customize Reddit background to add your own style
- Auto-scroll feature creates a new way to browse content
- Works with Chrome, Edge, and Firefox
- Lightweight modern extension (Manifest V3)
- Options page to enable debug logging

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
### Basic
- After installing vote syncing happens automatically.
- For page customizations and auto-scroll pin the extension to the browser toolbar and click the extension icon to reveal the controls.

### Auto-Scroll Use
#### EZ-mode: 
1. Double click the up or down arrow buttons to enable auto-scroll in that direction.
2. Press up or down arrow buttons to increase or decrease through the scroll levels available on page.
3. Press left or right arrow buttons or the spacebar to pause auto-scroll.
4. Press any other key or a mouse button to exit auto-scroll mode.

#### Drag-scroll mode:
1. Press the main mouse button down and drag up or down to scroll in that direction.
2. Release the mouse button to end drag scroll.
3. Different levels of auto-scroll are enabled depending on how far you drag. 
- NOTE: On feed pages drag scroll stops more slowly. This allows a short drag and release to scroll a decent amount of content without the user having to hold down the mouse button for too long.


#### Double-click mode:
1. Double click the main mouse button to enable auto-scroll.
2. Different levels of auto-scroll are enabled depending on how far you move the mouse from the point you double clicked.
3. Press any mouse button or key (besides arrow keys, spacebar) to exit auto-scroll.

#### All Modes:
- Up/down arrows or scroll wheel can be used to change the auto-scroll level.
- Spacebar or left/right arrow pause/unpause auto-scroll.
- Moving mouse pointer to click origin (if applicable) or setting auto-scroll level to zero by arrow keys or scroll wheel stops the auto-scroll.
- Different number of levels of auto-scroll are available on different pages. Feed pages have 3 levels available while others have 8 levels available.

## Files of interest

- manifest-both.json — extension manifest - make changes here (MV3)
- VoteSync.js — VoteSync class, holds state and logic for post vote and count syncing
- Appearance.js — Appearance class, for appearance customizations.
- AutoScroll.js — AutoScroll class, for auto-scroll feature.
- observers.js — Mutation observer class to keep track of posts and page changes
- content.js — main content script
- buildZip.sh — simple zip file build script

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
