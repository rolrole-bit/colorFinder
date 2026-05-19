/**
 * 이 클래스는 마우스 및 터치 이벤트를 처리하여 
 * DOM 엘리먼트 기반의 커스텀 수직 슬라이더를 구현합니다.
 * 
 * @param {HTMLElement} element - 슬라이더의 래퍼(Wrapper) 엘리먼트
 * @param {Object} options - { min, max, value, onChange } 설정 객체
 */
export class CustomVerticalSlider {
  constructor(options = {}) {
    this.min = options.min || 0;
    this.max = options.max || 100;
    this.value = options.value || 0;
    this.onChange = options.onChange || (() => {});
    
    // SVG Elements
    this.pathElement = options.pathElement;
    this.thumbGroup = options.thumbGroup; // The <g> containing the thumb circle and text
    this.touchArea = options.touchArea; // Invisible wider path for touch area
    
    this.isDragging = false;
    this.totalLength = this.pathElement.getTotalLength();
    
    // Path goes from bottom (length 0) to top (length totalLength) 
    // or vice versa depending on how it's drawn.
    // Our path is drawn from bottom (max value) to top (min value).
    // Let's verify direction later. Assume ratio 0 = bottom, ratio 1 = top.

    this.initEvents();
    this.updateThumbPosition();
  }

  initEvents() {
    this.touchArea.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.touchArea.setPointerCapture(e.pointerId);
      this.handlePointerMove(e);
    });

    this.touchArea.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      this.handlePointerMove(e);
    });

    this.touchArea.addEventListener('pointerup', (e) => {
      this.isDragging = false;
      this.touchArea.releasePointerCapture(e.pointerId);
    });

    this.touchArea.addEventListener('pointercancel', (e) => {
      this.isDragging = false;
      this.touchArea.releasePointerCapture(e.pointerId);
    });
  }

  handlePointerMove(e) {
    // Get cursor Y position relative to viewport
    const y = e.clientY;
    
    // Binary search the path to find the closest Y point
    // Since our S-curve is monotonically changing in Y, this works perfectly.
    let minL = 0;
    let maxL = this.totalLength;
    let currentL = this.totalLength / 2;
    
    // Path: M bottomX bottomY C ... topX topY
    // length 0 = bottomY (higher value visually on screen)
    // length totalLength = topY (lower value visually on screen)
    // So pt.y decreases as length increases.
    for (let i = 0; i < 15; i++) {
      const pt = this.pathElement.getPointAtLength(currentL);
      if (pt.y < y) {
        // Point is too high (Y is too small). We need to go towards bottom (smaller length).
        maxL = currentL;
      } else {
        // Point is too low (Y is too large). We need to go towards top (larger length).
        minL = currentL;
      }
      currentL = (minL + maxL) / 2;
    }

    // Clamp length
    currentL = Math.max(0, Math.min(this.totalLength, currentL));
    
    const ratio = currentL / this.totalLength; 
    // 0 = bottom, 1 = top
    // Value: top = max, bottom = min. So ratio 1 = max, ratio 0 = min
    this.value = this.min + (ratio * (this.max - this.min));
    
    const newValue = Math.round(this.value);

    if (newValue !== this.lastValue) {
      import('../utils/SoundUtils.js').then(module => {
        module.playSliderTickSound();
      });
      this.lastValue = newValue;
    }
    
    this.value = newValue;
    this.updateThumbPosition(currentL);
    this.onChange(this.value);
  }

  updateThumbPosition(length = null) {
    if (length === null) {
      const ratio = (this.value - this.min) / (this.max - this.min);
      length = ratio * this.totalLength;
    }
    
    const pt = this.pathElement.getPointAtLength(length);
    this.thumbGroup.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
  }

  setValue(val) {
    if (val < this.min) val = this.min;
    if (val > this.max) val = this.max;
    this.value = val;
    this.updateThumbPosition();
  }
}
