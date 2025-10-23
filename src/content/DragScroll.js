'use strict';

const DEFAULT_ACTIVE_TIERS = 3; // less tiers (slower speeds) for feed pages with virtual scroll
const DEFAULT_TIER_WIDTH = 50; // pixels per scroll control tier for feed pages
const DETAIL_PAGE_TIER_WIDTH = 20; // pixels per scroll control tier
const DEAD_ZONE_WIDTH = 100;

export default class DragScroll {
  constructor() {
    this.dragScroll = true;
    this.detailPage = false;
    this.scrollWasActivated = false;
    this.scrollControlTierWidth = DEFAULT_TIER_WIDTH; // pixels per scroll control tier
    this.initDeadZoneWidth = 16;
    this.posDeadZoneWidth = this.initDeadZoneWidth / 2;
    this.negDeadZoneWidth = this.initDeadZoneWidth / 2;
    this.velocities = [60, 200, 300, 500, 800, 1200, 1700, 2500];
    this.activeTiers = DEFAULT_ACTIVE_TIERS;
    this.scrollBehavior = 'instant';
    this.scrollTimer = null;
    this.lastScrollTime = null;
    this.dragEvent = null;
    this.gridContainer = null;
    this.scrollLevel = 0;
    this.scrollVelocity = 0; // pixels per second
    this.targetVelocity = 0; // Target velocity we're interpolating towards
    this.velocityLerpSpeed = 0.05 // How fast to interpolate (0-1, higher = faster transition)

    // check browser local storage for drag scroll setting and add drag listener
    this.loadSettings();

    // Listen for background settings changes and update background
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.backgroundSettings) {
        this.dragScroll = changes.backgroundSettings.newValue.common.dragScroll;
        if (this.dragScroll === true) {
          this.addDragListener();
        } else {
          this.removeDragListener();
        }
      }
    });
  }

  // Load settings from chrome.storage.local
  async loadSettings() {
    let settings;
    try {
      settings = await browser.storage.local.get('backgroundSettings');
    } catch (err) {
      console.error('DragScroll.js: browser-storage access fail', err);
    }
    if (settings?.backgroundSettings) {
      this.dragScroll = settings.backgroundSettings.common.dragScroll ?? true;
    }
    if (this.dragScroll === true) {
      this.addDragListener();
    } else {
      this.removeDragListener();
    }
  }

  addDragListener() {
    this.gridContainer = document.querySelector('.grid-container');
    if (!this.gridContainer) return;
    if (!this.dragScroll) return;

    this.detailPage = this.testForDetailPage();
    this.scrollControlTierWidth = this.detailPage
      ? DETAIL_PAGE_TIER_WIDTH
      : DEFAULT_TIER_WIDTH;
    this.activeTiers = this.detailPage
      ? this.velocities.length
      : DEFAULT_ACTIVE_TIERS;

    this.gridContainer.addEventListener('dblclick', this.handleDragStart);
    this.gridContainer.addEventListener('mousedown', this.handleDragStart);
  }

  handleDragStart = event => {
    // make sure mouse button one is pressed
    if (event.button !== 0 || this.dragEvent) return;
    if (
      event.target.classList.contains('grid-container') ||
      event.target.classList.contains('subgrid-container') ||
      event.target.classList.contains('main-container')
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.dragEvent = event;
      this.gridContainer.addEventListener('mousemove', this.handleDragMove);
      this.gridContainer.addEventListener('mouseup', this.handleDragEnd);
      document.addEventListener('keydown', this.handleDragEnd);
      this.gridContainer.style.cursor = 'row-resize';
    }
  };

  handleDragMove = event => {
    event.preventDefault();
    event.stopPropagation();
    if (!this.dragEvent) return;

    const dragDistance = event.clientY - this.dragEvent.clientY;
    const sign = Math.sign(dragDistance);

    const deadZoneEnd =
      sign === 1 ? this.posDeadZoneWidth : this.negDeadZoneWidth;
    // if the drag distance is in the auto-scroll deadzone, stop the auto-scroll
    if (Math.abs(dragDistance) < deadZoneEnd) {
      this.scrollLevel = 0;
      this.targetVelocity = 0;
      return;
    }
    // make opposite dead zone wider while mouse is in the original scroll direction
    if (!this.scrollWasActivated) {
      if (sign === 1) this.negDeadZoneWidth = DEAD_ZONE_WIDTH - this.posDeadZoneWidth ;
      else this.posDeadZoneWidth = DEAD_ZONE_WIDTH - this.negDeadZoneWidth;
      this.scrollWasActivated = true;
    }
    // set auto-scroll state based on the drag distance
    this.setScrollState(dragDistance);
  };

  // set the auto-scroll level based on the drag distance
  setScrollState = dragDistance => {
    const sign = Math.sign(dragDistance);
    const fn = sign === 1 ? this.scrollDown : this.scrollUp;
    const icons = sign === 1 ? DOWN_ICONS : UP_ICONS;
    const defaultCursor = sign === 1 ? 's-resize' : 'n-resize';

    // iterate over the scroll tiers in reverse order to see if any lower bound is passed
    // with early exit from loop once the highest tier's lower bound is passed
    const deadZoneEnd =
      sign === 1 ? this.posDeadZoneWidth : this.negDeadZoneWidth;
    const tierAdjustment = this.scrollControlTierWidth - deadZoneEnd;

    for (let i = this.activeTiers; i > 0; i--) {
      const tierLowerBound = this.scrollControlTierWidth * i - tierAdjustment;
      if (Math.abs(dragDistance) >= tierLowerBound) {
        // if the lower bound is passed, set the scroll level to the current tier
        const newScrollLevel = sign * i;
        if (this.scrollLevel === newScrollLevel) return;
        this.scrollLevel = newScrollLevel;

        // only set cursor up or down icon coming from stop or opposite direction
        if (this.scrollVelocity === 0) {
          this.gridContainer.style.cursor = `url(${
            icons[i - 1]
          }), ${defaultCursor}`;
          setTimeout(() => fn(i), 0); // delay auto-scroll for cursor update to avoid jank
        } else {
          fn(i);
        }
        return;
      }
    }
  };

  scrollUp = level => {
    if (window.pageYOffset === 0) return;
    const targetVelocity = -this.velocities[level - 1];
    this.startScroll(targetVelocity);
  };

  scrollDown = level => {
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    if (window.pageYOffset >= maxScroll) return;
    const targetVelocity = this.velocities[level - 1];
    this.startScroll(targetVelocity);
  };

  // Unified scroll method
  startScroll = targetVelocity => {
    // Update target velocity
    this.targetVelocity = targetVelocity;

    // If already scrolling, just update the target and let interpolation handle it
    if (this.scrollTimer) return;

    // Starting fresh - only initialize if we're at rest
    if (this.scrollVelocity === 0) {
      this.scrollVelocity = targetVelocity * 0.1;
    }
    this.lastScrollTime = performance.now();

    const scrollCallback = currentTime => {
      if (!this.lastScrollTime) this.lastScrollTime = currentTime;

      const deltaTime = currentTime - this.lastScrollTime;
      this.lastScrollTime = currentTime;

      // Smoothly interpolate current velocity towards target velocity
      this.scrollVelocity +=
        (this.targetVelocity - this.scrollVelocity) * this.velocityLerpSpeed;

      if (this.targetVelocity === 0 && Math.abs(this.scrollVelocity) < 55) {
        // Fully stopped - clean up
        this.scrollTimer = null;
        this.scrollVelocity = 0;
        this.lastScrollTime = null;
        this.gridContainer.style.cursor = this.dragEvent
          ? 'row-resize'
          : 'auto';
        return;
      }

      // Calculate distance based on current interpolated velocity
      const distance = (this.scrollVelocity * deltaTime) / 1000;
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      const newPosition = Math.max(
        0,
        Math.min(window.pageYOffset + distance, maxScroll)
      );

      // Check if we should continue scrolling
      const atTop = newPosition <= 0 && this.targetVelocity < 0;
      const atBottom = newPosition >= maxScroll && this.targetVelocity > 0;

      if (!atTop && !atBottom) {
        window.scrollTo({
          top: newPosition,
          behavior: this.scrollBehavior,
        });
        this.scrollTimer = requestAnimationFrame(scrollCallback);
      } else {
        // Reached boundary
        window.scrollTo({ top: newPosition, behavior: this.scrollBehavior });
        this.scrollTimer = null;
        this.scrollVelocity = 0;
        this.targetVelocity = 0;
        this.lastScrollTime = null;
      }
    };

    this.scrollTimer = requestAnimationFrame(scrollCallback);
  };

  handleDragEnd = event => {
    event.preventDefault();
    event.stopPropagation();
    this.dragEndCancel();
  };

  dragEndCancel = () => {
    this.gridContainer.removeEventListener('mousemove', this.handleDragMove);
    this.gridContainer.removeEventListener('mouseup', this.handleDragEnd);
    document.removeEventListener('keydown', this.handleDragEnd);

    this.resetDeadZone();

    this.dragEvent = null;
    this.scrollLevel = 0;
    this.targetVelocity = 0;

    if (!this.scrollTimer) {
      this.gridContainer.style.cursor = 'auto';
    }
  };

  removeDragListener() {
    if (!this.gridContainer) return;
    this.gridContainer.removeEventListener('dblclick', this.handleDragStart);
    this.gridContainer.removeEventListener('mousedown', this.handleDragStart);
    this.gridContainer = null;
  }

  resetDeadZone() {
    this.posDeadZoneWidth = this.initDeadZoneWidth / 2;
    this.negDeadZoneWidth = this.initDeadZoneWidth / 2;
    this.scrollWasActivated = false;
  }

  // Test for detail page being current page
  testForDetailPage() {
    return /^https?:\/\/(www\.)?reddit.com\/r\/.+\/comments\/.+/.test(
      window.location.href
    );
  }
}

// Color Direction Icons

// down green icon
const SCROLL_DOWN_ICON_GREEN =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAKeSURBVFhH7dRLSFRRHMfx7/+O7yxNoyBMe8jMOGUUtIik0tI2tSoiiB47Kyps2yawVdAmpKAH0aIQdBNliDOOSIvMZZt8UIsIN0JBoFY64/m3yDuPc3Umy3bz2Z3zO/fOjzPnXMjJyXH1hSoYDJXa0yuuP1hJV1WxO3QSQZ4eIGZeEt2xITG30iKBjcALykpq3KlkASP5iDRh4gMMhA6hSCL7V4rQFzwGMgzSgPp8bpQs4BLZjtHn9AeuM3gwz46XbbCmiGjdbRzpRGSTHXsL/LYGlXZikx28qkts17KF/VuIFT8GvYaw2o7JUAAcyUPkEgX0EA2F7DiraN1+xIkgchokseW2pQu4hHqMeUM4eJ7e2kI79gjvXEUkcBHlFSK1dmzLXgBApByR+/jyHzK0N3GFPIaqipG5JyAdwBo7XkyygKMxFJOWphKKcDjH9LdeIoF6O6YvsI/p0iFETiKSb8dJGqNoft4dJQvo7CCYp4nxUkQaEYkS8Z9FERSHcLAVn/Qgsste7qF6F2Y/uUPvXY8GL2OkHaHSjtLpDMgtoBz0KkiBvSKN6gToDY6MP0md9hboPumj7F094nQhjt+O0yhm4Q1ZzpJ5T9w5xfDoKO3pf7O3gKs/VI2aDuAoIn/3QVKNA10IbbSMfbVjMhZg4Urp3BUcbiJZtthDZxBpo6Ssk33DP+zUteQHAoBnkzG2fXnL5nUfgN0gFfYSD0WBcaCV5rFuqidi9pJUmXcg1UAggHGeAXvsKJ2GwWmlZeSznSwmy+FJcXh8HJPfiPIA5acdo0xhuMPaVcf/9MdZ1g64emsLySs4gZhHICULs98xeoaCDT00vY5bT2S0/AKusL8Bce4BUzjxCzR/HLGX/H/hrevpC2U/mDk5ORn8AmKQtUAztQkrAAAAAElFTkSuQmCC';
// up green icon
const SCROLL_UP_ICON_GREEN =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAKraVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49J++7vycgaWQ9J1c1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCc/Pg0KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyI+PHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj48cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0idXVpZDpmYWY1YmRkNS1iYTNkLTExZGEtYWQzMS1kMzNkNzUxODJmMWIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+PHhtcDpDcmVhdG9yVG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Q3JlYXRvclRvb2w+PHhtcDpjcmVhdG9ydG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Y3JlYXRvcnRvb2w+PC9yZGY6RGVzY3JpcHRpb24+PHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9InV1aWQ6ZmFmNWJkZDUtYmEzZC0xMWRhLWFkMzEtZDMzZDc1MTgyZjFiIiB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+PHRpZmY6T3JpZW50YXRpb24+MTwvdGlmZjpPcmllbnRhdGlvbj48L3JkZjpEZXNjcmlwdGlvbj48L3JkZjpSREY+PC94OnhtcG1ldGE+DQo8P3hwYWNrZXQgZW5kPSd3Jz8+d1SxtAAAAqdJREFUWEft1U9I02Ecx/H393HzXx5CoyCif4TZggg6JHoIUTczPXRJEEMiCg9hdOjQJW91KCghKKQOZgQiHYICTWlJJB08RKPpRAqrSxKR/fHP/vy+HcSpz+Y2qVt7nfb7fr7Pni/Pnm2QlZX1N/o9xQzs3myX18PYhYwN7fFgnMdI7jMGSivtOFNiF9LyH3ER/tKIkQdA4WJRZ1Fzhmj4EfWTC/aSVNZ3AqOHCglPX0Oke3lzACkEvYfL3cnAgQ0rl6ST+QkMeraD0wXisyPLKMZpoToUsoNkcuxCAkWoLDsG9IAcRtIOvRXlKK2bptn1NcgwajeslPrNRsoLmJ1pRrUTZF1Hi2oYh8tI7i18b3/b8ZK1BxgsK0HpBJoQcdlxRlSjwFPEtFMb/GjHJB2gA0P5vn24nF4w++3Y4qCApLnM6kygThMzBwOc6IutjBIXVu5tJUf702+uYeAGQgfomkcMgJhSxDVEcaAtIYq/8u/IJ5J/BTEXVnUkpd9wuIR3/C6gDJa2IOY6SPpfRXW6kch5at/PsPoE8nYicm5Fa3Kqb4hpI77xLgQHQfFO9KBag+oLuz2ROYnkVcWf4vX5nBwQd/zZphpBtY+iXxXUhUbsGG8oQNHGehzuo8zbcZxgcJb3SbwDyf0AbUdzT1Hxec4O4ypezxGLnEW1DdXvdpxM+gFUJxEa8IbupPo+x9VPLuAb78aYSpSAHdtSDKAxVB+ijpeasZd2mlZNMEiYRlRv42jUjpckH0D5CXIT99xpfBMf7DhjDWNTuLe0I9qx+DEmShxA9ROONlMzdpGqqbUvU6aqhqPUhq5i5Diq7+x4eQCJxUBfgZZTN/4ESf0nsi6CUh18jnFVo+rHaMRugd5tBQyWldjlf87vKaLfU2yXs7L+X38AWnvmC74v/dcAAAAASUVORK5CYII=';

// down lime icon
const SCROLL_DOWN_ICON_LIME =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABVElEQVR4nO2WQSsEcRjGf2+kjVLk4EJJuTjJQa5ucpFSTr7AHhx9ABdfgbiIk6OTk5uDlHJxIZGLkkhkD+vRzs5mMTv7zuzMbX71nmb+z++Zaf79BwoKChqIAYSRNzVHzRVxYRnZUfTFzOT9yA4DV4sCQnaHmMlBPoXsuu6ILyBkn4i1DOWryN5/8tsXUDj7iL4OxCVkO/9z/QWE7AoxmUI+gewyOjNZASF7Q6wkkC8ie2mdl7yAwtlC9MSIu5Ftts9JX0DIzhFjEetHkJ36MqILlJDtOks8Ieab1s4he3SuPYj/sEUZWcURVEW2EU7VcX8lyHYhppHdOp/IMw+IWZ+8gRhCdpyB/AQxTAcHx7rzFf+dr/qOoCudvBmxgOw5gfwVsUSmiFFkZw75BWI8W/nvrbodI99D9JI7Ck63j9xOzwTn+w2y+1z+H1yIwWAKCgpIzzdgjva+erLuIgAAAABJRU5ErkJggg==';
// up lime icon
const SCROLL_UP_ICON_LIME =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAKraVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49J++7vycgaWQ9J1c1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCc/Pg0KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyI+PHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj48cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0idXVpZDpmYWY1YmRkNS1iYTNkLTExZGEtYWQzMS1kMzNkNzUxODJmMWIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+PHhtcDpDcmVhdG9yVG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Q3JlYXRvclRvb2w+PHhtcDpjcmVhdG9ydG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Y3JlYXRvcnRvb2w+PC9yZGY6RGVzY3JpcHRpb24+PHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9InV1aWQ6ZmFmNWJkZDUtYmEzZC0xMWRhLWFkMzEtZDMzZDc1MTgyZjFiIiB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+PHRpZmY6T3JpZW50YXRpb24+MTwvdGlmZjpPcmllbnRhdGlvbj48L3JkZjpEZXNjcmlwdGlvbj48L3JkZjpSREY+PC94OnhtcG1ldGE+DQo8P3hwYWNrZXQgZW5kPSd3Jz8+d1SxtAAAAYZJREFUWEftlj0rxWEYxn83i5jIYKHkC3jL22CwySKlTL7AGYw+gIWvcOosShkMBovJpkgZpCSSl0VJJHKG4zI4ctzu4zgvLP6/upbnuu/rfnqe/j1/SEhIqAbRgmjxy3+DGER2gewU0ePt30XMIXtGpryeELO+rPaIRmTLBYO90ogG31YbRBey/WCo1y6iw7dXh5hCdh8MK6ZbxISPKR9Rj2wR2UswpJRyiHmE+difIdqQbQXB5WoT0erjv0cMI7sKwirVGaLPj4kRKWTZIMQrh2whr1zge2URKT/uA9GEbCVojHSNGCvoHUd2E9RFysSfqpgOiiNtI9p9O6IT2V5QH4jp97a6zyklWQKNYlx6A+MMNAKkvfUzvj+BO8SkbymKmEH2EORUdAIHoAGMdW8UxVgFDQFH3vKU2kAmP/zYGyUxDkH9wIq3Yj5fwWNNX7cvr+fHFRQWvW/g5Ffe97f/h3O/AX8Fa6BejH23Xj3GDqgb2PDWG6K58oejDIQhmv1yQsL/5RX6tKfep77dqAAAAABJRU5ErkJggg==';

// down chartreuse icon
const SCROLL_DOWN_ICON_CHARTREUSE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABfElEQVR4nO2WTytEURiHH5FEKbKwoaRsrGQhWzvZSCkrX8DC0gew8RWIpsRmNOcdQ2pWs7OQUjY2JLJREonMgp9uxp+4M84d9+7uU+/qnPs+v3M6p3MhJSWlwq7okGggYQJH4Po14MS0iZ3QwZjYE+1ObAWuagHkxEVejMQtz4shE6cVR/UA9j7h2Yn5GOWzTjx+6187gH3VRlG01SvOiBYnVn/2jRJAJk62xWBUuRMDThyH9YwaQCYecmLGV25i0sRdtX71BFCllrOiuZq4JJqcWPqrz38CyMThtugLWXWPiX2fHqEBMqLFxJpniBsnxj++zYkxE9ee8s2aBzsn5kyUPZq9mFis1IvH/HLQu9bZ+cTEsBPnnrvhs+orJ0aJQkF0mSjGIC9lRTf1PhwmFjy3+Kf4NbgRWdHIf8mJCSduI8jvnZgiTgqi18SBh/zIiX6SIPN+VVdqyNcLopWkyYtZE09JvZ5R3vczJy6T+H/wIis6g/KbnZKSQihv7KG2GrH+TtIAAAAASUVORK5CYII=';
// up chartreuse icon
const SCROLL_UP_ICON_CHARTREUSE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAKraVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49J++7vycgaWQ9J1c1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCc/Pg0KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyI+PHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj48cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0idXVpZDpmYWY1YmRkNS1iYTNkLTExZGEtYWQzMS1kMzNkNzUxODJmMWIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+PHhtcDpDcmVhdG9yVG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Q3JlYXRvclRvb2w+PHhtcDpjcmVhdG9ydG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Y3JlYXRvcnRvb2w+PC9yZGY6RGVzY3JpcHRpb24+PHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9InV1aWQ6ZmFmNWJkZDUtYmEzZC0xMWRhLWFkMzEtZDMzZDc1MTgyZjFiIiB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+PHRpZmY6T3JpZW50YXRpb24+MTwvdGlmZjpPcmllbnRhdGlvbj48L3JkZjpEZXNjcmlwdGlvbj48L3JkZjpSREY+PC94OnhtcG1ldGE+DQo8P3hwYWNrZXQgZW5kPSd3Jz8+d1SxtAAAAhlJREFUWEft1b1rE3EYwPHvc4kKddDWRRBB9B9QaesL4sskKra5axHqK4rgENBOIs7toJubVHRQRIlNCBIQHUQHFSlqQQQRRNFNHFow4ku4xyE9SZ/cXS6xm/eBDPl9j/wefpfkIJVK/YOC0lNQeux6Oxy7kFRZ2ZSF6UUwVVY22J5URwOUlDM+PBZYDaxVeFJWjtrrkhC7EOeu0lWDywJHbJtzZQZOHxd+2BAl8QAlZR0wKbDeNmMqA8MDwicbwiS6BSXFA14m2BygrwbTRWWfDWFiT6CgZLIwDpyVFteG8IHzObgogtoYiPzQgrIyC7cEdtrWpgcZODQgfLWBqAFKyhbgjsAq2zqh8FFg2BVe2Nb0HSgqeYFHCTb3gbG5l29jI4E1wNOikg9pdfeVpVWYEDg4/5JQX3wYGRIeUj+xPQI3gBX2whDXZiAf/FT/nkAV9ibc/BnQG2wO4An3HOiD5iMOcWIZ7A/eNN2COAoXlsN2V/hs26Dw4TdsBSZsi5N0gFnA9YRzu4SajYEDwi9XOOXDCPDN9jAtB1B4rdDvCmXbogwJtx3YDLy1zYodQOHqLPR7wjvbWhkU3nRBL3DTtkahAyh8FzjmCSfbebBYu4WqKxxWGFX4aTsRA7x3YFtOuG5DpzzhkgM7lOYH1LwBFCaXwMac8KpxfSHkhOeL6w+zim0AVJRu1fC/5oWkilSUbrueSv2//gByG4ZcniZgxQAAAABJRU5ErkJggg==';

// down yellow icon
const SCROLL_DOWN_ICON_YELLOW =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAKraVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49J++7vycgaWQ9J1c1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCc/Pg0KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyI+PHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj48cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0idXVpZDpmYWY1YmRkNS1iYTNkLTExZGEtYWQzMS1kMzNkNzUxODJmMWIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+PHhtcDpDcmVhdG9yVG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Q3JlYXRvclRvb2w+PHhtcDpjcmVhdG9ydG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Y3JlYXRvcnRvb2w+PC9yZGY6RGVzY3JpcHRpb24+PHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9InV1aWQ6ZmFmNWJkZDUtYmEzZC0xMWRhLWFkMzEtZDMzZDc1MTgyZjFiIiB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+PHRpZmY6T3JpZW50YXRpb24+MTwvdGlmZjpPcmllbnRhdGlvbj48L3JkZjpEZXNjcmlwdGlvbj48L3JkZjpSREY+PC94OnhtcG1ldGE+DQo8P3hwYWNrZXQgZW5kPSd3Jz8+d1SxtAAAAg9JREFUWEftlTtrVFEUhb8TH5kYUUlAwSIiCIohYK3Y2GqhRUAEFRFE8AcI4k8QBQsJNlpobyFiZeOjsREJiGgVK0ELQybO3efO2haO42TP4NyRW84Hq9lrvzj3Hg6MGTOmg8SMO9tjvG4kZrXCVIzjmdMyXkjsiV5dqMleZV55i0PRw0sWPeMylpU54U6KOf+LO0mZUzJWPOMqmI853QU6S/yQccOdzTFvVNxpKHNLxmq3/7AFOklZmXtaZ1/MrYrEfrV4LKMMvYcv0HMa7yUOx/xhyDgu41PsFxeY2FjWT0osUPJaBRclJqMfkZiWcRV4mhIHoh8ZugC/l9hFYomS+9KAK9RBYiqVPADupsSO6A/i7wJOdkcb3B5SopESFyh5JrEQfRlHafOGxGJKbIn+Hxxy2ko7xnFnpxsP4/fqk+EyvqrgvDvJnQk3rsj43pc7QCq47U4jzu8i45qMb7EwSpk1tbjZuWJF9KNkfFHJpTivD3c2ecERGR9jkygZbRntGI9SZlkF8+7V/jkAfJ05GU9k5NiwqmRkGY8kZmP/SnSu1PUqRxwlY00Fl/91ayrhzoRKzirzOQ4ZJBmS8UGZk3W+J6jFQZW8jQOjZDx3Zy7W14LEtAqWZPwcMHhVBXfc2RbrakViUgXnVNDsGd5U5kwdr2dlZBxT5p0yL9Ua/bGqBYndEjMxPmbMmFH4BU+ij4yXeKRBAAAAAElFTkSuQmCC';
// up yellow icon
const SCROLL_UP_ICON_YELLOW =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAKraVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49J++7vycgaWQ9J1c1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCc/Pg0KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyI+PHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj48cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0idXVpZDpmYWY1YmRkNS1iYTNkLTExZGEtYWQzMS1kMzNkNzUxODJmMWIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+PHhtcDpDcmVhdG9yVG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Q3JlYXRvclRvb2w+PHhtcDpjcmVhdG9ydG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Y3JlYXRvcnRvb2w+PC9yZGY6RGVzY3JpcHRpb24+PHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9InV1aWQ6ZmFmNWJkZDUtYmEzZC0xMWRhLWFkMzEtZDMzZDc1MTgyZjFiIiB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+PHRpZmY6T3JpZW50YXRpb24+MTwvdGlmZjpPcmllbnRhdGlvbj48L3JkZjpEZXNjcmlwdGlvbj48L3JkZjpSREY+PC94OnhtcG1ldGE+DQo8P3hwYWNrZXQgZW5kPSd3Jz8+d1SxtAAAAhxJREFUWEftlc2LjWEYxn/nnWMYlKIoC1vTTMp6ZGNh4aNYKCmLSU1K2Sr5E8SSpSQbG0srFiMbC0IkVqwUxWTMee/nzHXZnHPoPsOZGcPG+dW1ub+up/vpeV8YMmTIHyCxVWJ7jv8T1GJChVkVnirYl/N/DZumCscVzLtgF6yaedWcklif69cUm42quapgrmveO0SwoJrrEpty35pgs0vBvWycpTaP1WJ37l81Ng0VDit4pUDZcCmp8FZtTtpUed6KkBhTzRkFX7PJICmoFVxY9ZVIbFNwS0HJw5crBUXBXX9jV57/S2wq1Uyq8CIPzFKwqGAxx7MUvHbNXpuR7NeH2kwreJ+HZCmoVbisFpdUBl+Rgo8KzmW/HjYbVHMlNy4lBZ8czNhUNg3VnFbwwdFf26fghs2W7I/NuArR15DNC08UTOV+iT0KHuT6rM6VHev29Z6Jg5EGrOtNTNgUzB1GmKpGeZTzVcVzmhyyuWnTyvkujQYVjR8+y3qnNnPAeTeZrioWcr5LVbFAkxnMWZvPOf9bVDOZ19VZ2RsF+3P9ICQmFDzL81yw25zo1v1yAzaLXuQ2TQ5Wo8zm/CCqipe0OWq4ZtHO+T5+3oCCORUu22zIdSvFpqngooIvS22gR/cACt6pcMSmkWtWS+d/ckDR+bgtdQC3GFfhoebZmXNrhcQOBfd/foY/ku8Yk9iW42uNzWaJrTk+ZMj/y3fFj7B4qd2urwAAAABJRU5ErkJggg==';

const SCROLL_DOWN_ICON_GOLD =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAKqSURBVFhH7dRPaFxVHMXx77nJ+5NMLbWFFgQVURSUgAtXrQ1NxZWuFBXEP7uqaKkLN91UIi4ENxIsVEW6aClkJRoJprVOJmh06Ualu1LcCkJRO2+Se1ykbzK900wcrbv5rN695ze8w33vDYyMjFwXV9ntJjvS/VstXmBPnGeiXof6Qu182iH/In7f2NedvsXi+Yk7yIrPtTe/u97rFkBkQjO01y7GVnHYRt3sP7JRbOZPkq//IHHA0WN1tlngOomHMJ+5VR53k/E0H5ablF4p3kc6J+nONO8rwEaJncizDvlcvFh2j2tYsVXc45B/CrwpcVuas1UBAMG40GuMx4W4kj+Y5tuJy+VB8Hmh5wXdI09tWaAmNIX5LrbKl+MiRZqn4o80YrN4FeKXQveleWrbAmyU2AU+RaP4OK5ufkKpuMqEfi9OI+Yk7Uzzm9ksEOjYxBvSHoJS8BKdfDEuZ1NpHlvlfqpiFfGMRJbmNUNHQev1erPAZNWUOdNdb0HoEOjruJK9aCOb4OXiCPaCxMPpfB/zIVSX62Xftx5bxevYs5L2pFkvwx+g98C7gKOCPJ3pZftXgk6E6fbp3v2+AjZjLGdTDsyLcH+a97KJCLTNu2TzE+vxOa10ftHsjY+5r0DNF8q7PO45Ak+If/eHZFjDnqdTHQuP81uaM6gAQFyiQZa/QdA70uAjTm08Io6Rtc+F/fyV5rWBBQD8NsGPZc9ivSt0b5qnbAxcIvotzVSLEk5nem1boBa/zR9gjbOSHkmzXraXNBaO6OC1K2l2MwNfnl7h0eoS7dsP2f7I5lqa21y14wfaUT31T2/OMCdQi4sUTGZPQ/hEYpKNm/8JfkGuFjTDWvqbQYYuUIvflAcIPgm+SuCVMF39nM787+JSY2/8it3p/sjIyDD+BhhA6ILCoUz1AAAAAElFTkSuQmCC';

const SCROLL_UP_ICON_GOLD =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAKraVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49J++7vycgaWQ9J1c1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCc/Pg0KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyI+PHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj48cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0idXVpZDpmYWY1YmRkNS1iYTNkLTExZGEtYWQzMS1kMzNkNzUxODJmMWIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+PHhtcDpDcmVhdG9yVG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Q3JlYXRvclRvb2w+PHhtcDpjcmVhdG9ydG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Y3JlYXRvcnRvb2w+PC9yZGY6RGVzY3JpcHRpb24+PHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9InV1aWQ6ZmFmNWJkZDUtYmEzZC0xMWRhLWFkMzEtZDMzZDc1MTgyZjFiIiB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+PHRpZmY6T3JpZW50YXRpb24+MTwvdGlmZjpPcmllbnRhdGlvbj48L3JkZjpEZXNjcmlwdGlvbj48L3JkZjpSREY+PC94OnhtcG1ldGE+DQo8P3hwYWNrZXQgZW5kPSd3Jz8+d1SxtAAAAqlJREFUWEftlDFo3GUchp/3S+5/aaogLbSbOAnaxaGDpJLLkdpAaganSqkUEaWDpDg4uJhNhxY0UFCKDrGlEKRDoYXGSlISzNRBCAqKIOou2tL0/v+7+94O9WLy5XJ30W7eM939nt9338vLx0GfPn3+A/Em++LC3gPpfDeEdNArcTl7nqHsGuXG13Fx6Ejqe0XpoBteYtDKpkCXJYYBbNYhvsV6/WqYJE/PdGJXDfgOw1bpHGiudTnAo8/hC4az2bhwcO/WU53puQGvDD3tZrwoaSJ1m7F9h0FOhZeKH1PXjq4N2CguZsfd9ALoWOpTJB2myY24XHrNM91/v2MDcZU91MsngVnBrqq1KYj+gHpxIUxwP/UtdgwQb7GfUjaLdEIwmPpeMDSI3FBD03q59lvqaRfAMwSPlp5jIMxLHEr9ZgwRg9S5ahN/UuQEY/U1ieZmt+2gx8unGdDNHi4vgI+RZszOFQOI8Kylb7xcPrPd/Y2XGLLKH0q8u3VlOzZ/CN6nkn8O2CulU0Sdl9T9XzEyx5P5WR3mL7Y2kD2DeGfTaltsvkOa0lh+USJKOIzWL4GPGt9O91MsXmc9q7a+bwRw9ICgtLGZYFPHfEWWj4RKbTX1Yay+RqmYNHxpqKW+hUQg/nPPtjfQDtt3MdN+Kn8jjPAg9S3CCA+4n78NOmP8Z+rb0TWA8c8QXgnV/LPwQufHBhAmyUOlNoc4YryW+pQdAxiaxldAx8JYbSX13QijxQ80wpTxp4ZG6lu0DWBzD/hEsXgzVPJfUt8rYbz2q2IxjTVjczf1tAtg+3fskxrN31N158fUK6rSUKX2EeJVm+9TvxFAQU2bbykGXgzV4rqEt67+eyQcKvki5cFx4yVMPd0hzrMn3mJ/On/ceIkn4ir70nmfPv9fHgJBvf6NIQvWPQAAAABJRU5ErkJggg==';

// down orange icon
const SCROLL_DOWN_ICON_ORANGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAJzSURBVFhH7dTNi41hHMbx73UPZhgzppmiFBJRNGVhZSJsWRFKXnZeYhoaCyzmOWfGlJoUE+UlWdDU2IiRIrIi/wAaK8lWFsxQM+f3szieOY97Xo7jZXc+q3Pf1306V7/7eQ5UVVX9ZAnNnjA/3v/X7DQtdpK56TqkHwSbHB5YL4smTv9jlrCYWu6rkWXp3kQBArMV2MIYzyxhqzuayP6SO7KE7YhXCrR5DTVpVirwk8RaAvc8xxlPmBXnlfKEOs/RhxiQWBLnkwpQvI5GAnkP9FtPaVyVsh6Wu7hJ4IREQ5wzXQGKJWYJjlJgyHpZE+flWJ6NGE8k9orSyGPTFkhJtDLOC8tx0C5RG+cx66PeEo4ADwUr4zxWtgDFaTQhrvKZ69lXKGYXmKtRbiH6BY1xPpVSATHmYL+kGYI6iQMs4JF10xrnlrCBr7wEdknMjvOUw5gKFNJ1qcAcngtuT6ynIbEZ56nl2O+OPCF4wiECQ4J18fkpXAbep4tJ77rlOIbIC1riLMthBOM8gSagXTAnPpPl8BGnK+S4ld2fVMDvUsM7Wr3AoGBVnGelV6Yyz5I7rwnsUYG3yv96zZMKpDxhqYt+xDbxZ39IDuMYg9TSEc7yKc6ZqQCAdVJPA8cR3eVGHHNnBOiggYHQybc4T81YgOIkgsNuxDmJFXEec8eBYcQpdfFIwuMzWWULpKyb1Rh3JNbHWZY7j+UcUp4PcTaVGR+erNDFMPVsduOaw/c4d+eLi4tydvzuj1PJBFLWTi3N7CRwQzCP4sM2CuyTMaQ84/F3ZlJxgZTlacO5gviCcTjkeROf+e8sYaElNMf7VVVVlfgBrZ238LKEAH8AAAAASUVORK5CYII=';
// up orange icon
const SCROLL_UP_ICON_ORANGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAKraVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49J++7vycgaWQ9J1c1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCc/Pg0KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyI+PHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj48cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0idXVpZDpmYWY1YmRkNS1iYTNkLTExZGEtYWQzMS1kMzNkNzUxODJmMWIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+PHhtcDpDcmVhdG9yVG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Q3JlYXRvclRvb2w+PHhtcDpjcmVhdG9ydG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Y3JlYXRvcnRvb2w+PC9yZGY6RGVzY3JpcHRpb24+PHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9InV1aWQ6ZmFmNWJkZDUtYmEzZC0xMWRhLWFkMzEtZDMzZDc1MTgyZjFiIiB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+PHRpZmY6T3JpZW50YXRpb24+MTwvdGlmZjpPcmllbnRhdGlvbj48L3JkZjpEZXNjcmlwdGlvbj48L3JkZjpSREY+PC94OnhtcG1ldGE+DQo8P3hwYWNrZXQgZW5kPSd3Jz8+d1SxtAAAAnFJREFUWEftlM1LVFEYh5/3jFKamxRaRiuj+gciV1EUSC7aJIgREYWLUCQEo/TObVELFZOCQmphRVDRIiiIiAqiVi0CSSiKqPaSSpkfc34tprHxOB/Xatc8u/M+77nnd1/OvVChQoW/wEfU+4gNYX01uLCQFB+xFcc9jEc+pin0SbGwUA5FVMnRAtwwqAUQfMdzlEnuugvMhXtKsaoJKKJWKQYQY7nDyb5FLY6r1DPiB1i3fFdpEk9AERtljJqxN3T5SLzC0e76eRu6QpQNIGE6QzNiENhslmjPB8Rpg9sW40OfT8mH+SFqmKENGDFb3WgF84h+ZrjohvgW+hxFA/izNDDHCI5Wg6rQJ0GwiHhgotNiPoeeQgEU4ZRiC55bZmwLfT4iO14rc5kF7yxFK42M2wEy+W7FRhmHEA8THD4PDOOJRPERkw3YqAyPNUFHAZdFEWvlOGvQvbxlJYJJ85wErpBGimnHGDQS/RXHWEOX9TJFMIFNwPG8dUEEr/G0WMyoxXgz5NJcx9gt8SzsDxEcZJ6dufVSAKVIGVQvdQZILAB3qGOHi3kZetfPOFM0S1wT/Ah9DgOHfp+z4g4UQjCN6FQth90JZkOfww0zy3qOIToEX0NfiLIBBO+BfS7msuspfdkAXBdzLs0YVTRJjIc+pGgAQUbiJo49LuJ56MvhTjFBihbBJcFi6HMUDCAxg+e8iSOuj4+hT4rr45N5On99qtOhp1AAiS+INkvTY3Hxy5QUi1m0NOfw7Jd4E/qlAJYhI88LxHYXc98MLW/9c8yQi3lCNbvkeYpnIezBd1Pje2kI6/8aRdT5iPqwXqHC/8tP8i/W+koGtTcAAAAASUVORK5CYII=';

// down red icon
const SCROLL_DOWN_ICON_RED =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAJjSURBVFhH7ZW7a1RBFIe/czf3nBtXJSRgQFARREUJWBvEB1hpoYUoAbUTRUVbGyFWgoUQLIIgKcSAlUhERHwUPhBs0oQ0Fhb+BUIIm03OsUg2XmcTN9Et94Mp5nwznB8z9zLQoUOHJRx6Azam9Xbj0OfQndYJ1VOu+s6r1f7UtQvv7t7qZh9DdW+jlpV8LiJHmZ9/62bHAqTk/osAcdWTLCx8ERiMiErDlQMAILAfeBZFcSugK/XrJaAIs3uIjIvIttQ3BWAxxGYihkN1xItiR+rXipvtDNVHwE2BTalntQAshugSkSu4T7jqvtS3woviEBGvRWRIYPnIU1YN0EBEBoBPXhQXHSz1KQ5VN7uM+wsR2ZX6lJYBWAzRQ8QoZg9X/IWWcOgWszFgREQ2p34lygHqAV6a/4FAIXAB1Zee5wOp96I4iNln4IxAnvoGAXURWWjMfweYm3sv8Hh5vgoicgSRN57n5wMkIAuzS0RMCBxI16/AA+bmvjcmTf+6m10lYlhE+lJXJmAGkbtE9ADXBTRdUyYifiByO6vVxsr1pgABFfJ8IOCpZNnu1JdpXJm0+JYCpnA/K/X6tCTX3LRRYEHq9UmpVI4HPA+YT9c0EMj+1jxgPiKeUKsdzur1qbQ5K51AGYcqqtcQudPqiFMCZoAb1GrjGcymfs0EZJ7n51z1W5hFq+Fm7mbTrnqine8JrrrHVb+mDdPhqq+iKLan+9uC9/dXXXXUzWabGpv99Dy/H7Ah3ddWHMzzfMjNZkrNZ1z1dDtezzXjRTHoZpOu+uFfHqu24NXqFofetN6hQ4f18AvHrO7RfhYp9gAAAABJRU5ErkJggg==';
// up red icon
const SCROLL_UP_ICON_RED =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAKraVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49J++7vycgaWQ9J1c1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCc/Pg0KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyI+PHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj48cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0idXVpZDpmYWY1YmRkNS1iYTNkLTExZGEtYWQzMS1kMzNkNzUxODJmMWIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+PHhtcDpDcmVhdG9yVG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Q3JlYXRvclRvb2w+PHhtcDpjcmVhdG9ydG9vbD5NaWNyb3NvZnQgV2luZG93cyBQaG90byBWaWV3ZXIgMTAuMC4yNjEwMC4xODgyPC94bXA6Y3JlYXRvcnRvb2w+PC9yZGY6RGVzY3JpcHRpb24+PHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9InV1aWQ6ZmFmNWJkZDUtYmEzZC0xMWRhLWFkMzEtZDMzZDc1MTgyZjFiIiB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+PHRpZmY6T3JpZW50YXRpb24+MTwvdGlmZjpPcmllbnRhdGlvbj48L3JkZjpEZXNjcmlwdGlvbj48L3JkZjpSREY+PC94OnhtcG1ldGE+DQo8P3hwYWNrZXQgZW5kPSd3Jz8+d1SxtAAAAlJJREFUWEftlD9rVFEQxc+95s68dQUhAQMWlv4LfoGks7DQCFpIJCBiE1LlA1joFxBDQDClWghiHUghWkRsLBRWFCRVOgtBAyHvvTVzLMyuy+Tt5o+rjfuDaebM3DPcN/cBAwYM+AMMGLZ6/ZjP/xNM5KyJrJjqe8uyCa//NQgMmchVU92gKqlKU92wlKYNUF/fVwgctpTmTXW9Zd4xxKaJLNroaN339QVm2QkTWfbGPkzkrYmc8v0HhkAwkUum+slUzRtWhYmsWkrXCUR/nif4RCcG1KA6DWAhAPu6WgIlyDsoywcR2PB6i64DGDACkQWEMBWAIa/vBQI/ACyFEOZCnq95HVUDEIhM6QxifBaAMa93QsDw65CeV02zzwGYQrPZCMBWp7ajkao3EcLyHsxLAPMI4S57XDEAhBhPMoQXVJ31WhsCmane9wtVFab6laozBCKBYCndMJEvvq5LPCJw1PuDIqdNtaxo8ObvLMvGfb+ldM5EXvl6H6a6RZErrb72JyB5KACpfaKDQBPAcxTFeMzzN16PzWYDZXmRwBMCuddbbO9L22fHDlRBch3AHIviVgQ2vd4iApsoihmEMEvym9er2HUAkquIcTIWxWKv99wiAkXM88cAJkg2vO7pOgCBLZJPEcKFmOcrXt+NWJYfEeNlkg+3/we9sZTGOhZl3VTvEch83X4hMGRZdttUv7eXUeSar2sPYCJrJjLJip/UQSEQTPW8qX7oOsD2M3xttdpxr/ULq9dHTeRl5zP8LQI1A0Z8vt8QOGLAsM8PGPD/8hOlu1g5hO+OSQAAAABJRU5ErkJggg==';

const DOWN_ICONS = [
  SCROLL_DOWN_ICON_GREEN,
  SCROLL_DOWN_ICON_LIME,
  SCROLL_DOWN_ICON_CHARTREUSE,
  SCROLL_DOWN_ICON_YELLOW,
  SCROLL_DOWN_ICON_GOLD,
  SCROLL_DOWN_ICON_ORANGE,
  SCROLL_DOWN_ICON_ORANGE,
  SCROLL_DOWN_ICON_RED,
];

const UP_ICONS = [
  SCROLL_UP_ICON_GREEN,
  SCROLL_UP_ICON_LIME,
  SCROLL_UP_ICON_CHARTREUSE,
  SCROLL_UP_ICON_YELLOW,
  SCROLL_UP_ICON_GOLD,
  SCROLL_UP_ICON_ORANGE,
  SCROLL_UP_ICON_ORANGE,
  SCROLL_UP_ICON_RED,
];
