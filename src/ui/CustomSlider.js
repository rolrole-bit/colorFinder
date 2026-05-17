/**
 * 이 클래스는 마우스 및 터치 이벤트를 처리하여 
 * DOM 엘리먼트 기반의 커스텀 수직 슬라이더를 구현합니다.
 * 
 * @param {HTMLElement} element - 슬라이더의 래퍼(Wrapper) 엘리먼트
 * @param {Object} options - { min, max, value, onChange } 설정 객체
 */
export class CustomVerticalSlider {
  constructor(element, options = {}) {
    this.element = element;
    this.min = options.min || 0;
    this.max = options.max || 100;
    this.value = options.value || 0;
    this.onChange = options.onChange || (() => {});

    // DOM 구성요소
    this.bgElement = this.element.querySelector('.slider-bg');
    this.thumbElement = this.element.querySelector('.slider-thumb');
    this.touchArea = this.element.querySelector('.slider-touch-area');

    this.isDragging = false;

    this.initEvents();
    this.updateThumbPosition();
  }

  /**
   * 포인터 이벤트(마우스, 터치 모두 호환) 초기화
   */
  initEvents() {
    // touch-action: none 은 CSS에서 설정하여 스크롤을 방지해야 함
    
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

  /**
   * Y좌표를 기반으로 현재 값을 계산하고 UI 및 콜백을 업데이트합니다.
   * @param {PointerEvent} e 
   */
  handlePointerMove(e) {
    const rect = this.touchArea.getBoundingClientRect();
    let y = e.clientY - rect.top;
    
    // 범위 제한 (Clamp)
    if (y < 0) y = 0;
    if (y > rect.height) y = rect.height;

    // 수직 슬라이더이므로 상단이 max, 하단이 min 혹은 그 반대일 수 있습니다.
    // 기존 디자인(아래가 min, 위가 max)을 따른다고 가정:
    const ratio = y / rect.height; // 0 (top) to 1 (bottom)
    
    // CSS 렌더링에 맞춰 값 계산: 상단이 max, 하단이 min
    this.value = this.max - (ratio * (this.max - this.min));

    // 정수형 반올림
    this.value = Math.round(this.value);

    this.updateThumbPosition(ratio);
    this.onChange(this.value);
  }

  /**
   * 값에 기반하여 썸(Thumb)의 위치를 조정합니다.
   */
  updateThumbPosition(ratio = null) {
    if (ratio === null) {
      ratio = 1 - ((this.value - this.min) / (this.max - this.min));
    }
    const percent = ratio * 100;
    this.thumbElement.style.top = `${percent}%`;
  }

  /**
   * 외부에서 값을 강제로 설정할 때 사용합니다.
   */
  setValue(val) {
    if (val < this.min) val = this.min;
    if (val > this.max) val = this.max;
    this.value = val;
    this.updateThumbPosition();
  }
}
