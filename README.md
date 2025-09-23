# Reddit Web Fix

Small browser extension that improves Reddit's post-vote UI by keeping up/down highlights and updating the displayed vote count consistently while you browse.

## Features
- Preserve upvote/downvote highlights across navigation
- Keep displayed vote counts in sync with local interactions
- Lightweight content-script-only extension (Manifest V3)
- Options page to enable verbose/debug logging

## Quick install (developer)
1. Open Chrome / Edge: chrome://extensions/  — Firefox: about:debugging#/runtime/this-firefox  
2. Enable "Developer mode" (Chrome/Edge) or click "Load Temporary Add-on" (Firefox).  
3. Click "Load unpacked" and select the repository folder.  
4. Visit https://www.reddit.com and verify the extension is active (check the console for "VoteSync activated.").

## Files of interest
- manifest.json — extension manifest (MV3)
- content.js — main content script (VoteSync class)
- constants.js — UI class names and SVG path constants (dynamically imported)
- browser-polyfill.min.js — web extension polyfill (dynamically imported)
- options.html / options.js — options page for debug setting
- privacy.html — privacy page
- icons/* — extension icons used in manifest

## Development notes
- Default verbose/debug is disabled; enable via the Options page to get more console output.

## License & contact
License: MIT  
