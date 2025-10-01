#!/bin/bash

OUTPUT_DIR="./dist"
mkdir -p "$OUTPUT_DIR"

# Create a zip file of the extension, excluding unnecessary files
# Usage: ./buildZip.sh target_build
# Example: ./buildZip.sh chrome, ./buildZip.sh firefox
TARGET_BUILD=$1
if [ -z "$TARGET_BUILD" ]; then
  echo "Usage: $0 target_build (e.g., chrome or firefox)"
  exit 1
fi


# if TARGET_BUILD is "chrome" or "firefox", set the output filename accordingly
if [ "$TARGET_BUILD" == "chrome" ]; then
  OUTPUT_FILE="reddit-web-fix-chrome.zip"
elif [ "$TARGET_BUILD" == "firefox" ]; then
  OUTPUT_FILE="reddit-web-fix-firefox.zip"
else
  echo "Unknown target build: $TARGET_BUILD"
  exit 1
fi

OUTPUT_PATH="$OUTPUT_DIR/$OUTPUT_FILE"


if [ "$TARGET_BUILD" == "chrome" ]; then
  # remove the "scripts" field from manifest-both.json,
  # remove the trailing comma from "service-worker" field line and save as manifest.json
  cat manifest-both.json | sed '/"scripts": \[/d' | sed 's/serviceWorker.js",/serviceWorker.js"/'\
    > manifest.json
elif [ "$TARGET_BUILD" == "firefox" ]; then
  # if TARGET_BUILD is "firefox", copy manifest-both.json to manifest.json as is
  cp manifest-both.json manifest.json
fi

zip -r "$OUTPUT_PATH" . -i "src/*" -i "icons/*" -i "manifest.json"