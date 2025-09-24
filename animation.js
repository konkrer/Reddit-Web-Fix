'use strict';

// Creates and runs a brief animation on the given button element

export function clickIgnoredAnimation(btnElem) {
  if (!btnElem) return;
  if (btnElem.querySelector('img[data-sync-anim]')) return;

  const transformDelay = 250;
  const holdMs = 300;

  const animImg = document.createElement('img');
  animImg.setAttribute('data-sync-anim', '1');
  animImg.src = chrome.runtime.getURL('icons/goldenSyncIcon_custom.png');
  Object.assign(animImg.style, {
    width: '30px',
    height: '30px',
    position: 'absolute',
    left: '50%',
    top: '50%',
    transformOrigin: 'center center',
    transform: 'translate(-50%, -50%) scale(0.25) rotate(0deg)',
    opacity: '0.2',
    pointerEvents: 'none',
    zIndex: '2147483647',
    transition: 'none',
    willChange: 'transform, opacity',
    userSelect: 'none',
    MozUserSelect: 'none',
    border: '2px solid limegreen',
    borderRadius: '50%',
    borderStyle: 'outset',
    backgroundColor: 'rgba(0,0,0,0.75)',
  });

  btnElem.appendChild(animImg);

  // Force reflow to register initial styles
  animImg.offsetHeight;

  // Phase 1: Fade in and scale up
  animImg.style.transition = `transform ${
    transformDelay - 50
  }ms ease-in, opacity ${transformDelay - 50}ms ease-in`;
  animImg.style.transform = 'translate(-50%, -50%) scale(1) rotate(10deg) ';
  animImg.style.opacity = '1';

  // Phase 2: Rotate further while holding
  setTimeout(() => {
    animImg.style.transition = `transform ${holdMs}ms linear, opacity ${holdMs}ms linear`;
    animImg.style.transform = 'translate(-50%, -50%) scale(1) rotate(100deg)';
  }, transformDelay - 50);

  // Phase 3: Shrink and rotate out
  setTimeout(() => {
    animImg.style.transition = `transform ${transformDelay}ms ease-out, opacity ${transformDelay}ms ease-out`;
    animImg.style.transform = 'translate(-50%, -50%) scale(0.8) rotate(300deg)';
    animImg.style.opacity = '0.2';
  }, transformDelay - 50 + holdMs);

  // cleanup
  const cleanup = () => {
    if (animImg.parentNode) animImg.remove();
  };
  const totalDuration = transformDelay * 2 - 50 + holdMs;
  setTimeout(cleanup, totalDuration + 100);
}
