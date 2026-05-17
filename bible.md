# ColorFinder 매거진 UI 성경 (Bible)

## 1. 작업 목적
기존의 브라우저 기본 엘리먼트(`<input type="range">`)에 `transform: rotate(-90deg)`를 적용하여 만든 수직 슬라이더는 브라우저(특히 WebKit) 렌더링 엔진의 독자적인 정렬 버그와 마진 계산 오류를 일으켰습니다. 
이에 따라 "화면 폭에 100% 반응형으로 피팅되고, 라인 오차가 0에 수렴하는 완벽한 중앙 정렬"이라는 디자인 목표를 달성하기 위해, 기존 코드를 전면 폐기하고 순수 DOM과 Pointer Events 기반의 **커스텀 수직 슬라이더 시스템**을 바닥부터 새로 구축했습니다.

## 2. 구조 설명
새로운 구조는 3개의 핵심 계층으로 완전히 분리되어 작동합니다.

1. **상태 및 렌더링 (UIManager.js)**
   - 각 슬라이더 영역에 3개의 레이어(`bg`, `thumb`, `touch-area`)를 가진 순수 DOM 구조를 생성합니다.
   - 값 변경 이벤트 발생 시 배경색, 헥스코드, 게임 전역 상태(`setUserColor`)를 실시간으로 동기화합니다.
2. **동작 및 이벤트 (CustomSlider.js)**
   - 마우스와 모바일 터치를 완벽히 호환하는 Pointer Events(`pointerdown`, `pointermove`, `pointerup`)를 사용해 드래그 인터랙션을 처리합니다.
   - 드래그 중인 포인터의 Y축 좌표를 감지하여 0~100% 비율로 환산하고, CSS `top` 속성을 직접 업데이트합니다.
3. **시각적 정렬 (index.css)**
   - CSS 컨테이너 쿼리나 편법(Margin 오프셋 등)을 모두 제거하고, 부모 컨테이너 기준 `width: 100%`, `top: X%`, `transform: translateY(-50%)` 라는 절대적이고 수학적인 중앙 정렬 규칙만 사용합니다.

## 3. 주요 설계 결정 이유
- **Pointer Events API 채택**: `touchstart`/`touchmove`와 `mousedown`/`mousemove`를 분리해서 처리하던 과거 방식 대신, 단일 API로 통일하여 코드 복잡도를 극단적으로 낮추고 멀티터치 충돌을 방지했습니다.
- **레이어 분리 디자인**: 배경(`slider-bg`), 표시선(`slider-thumb`), 이벤트 감지영역(`slider-touch-area`)을 Z-index로 분리하여 렌더링 병목을 줄이고 확장성을 확보했습니다.
- **transform: translateY(-50%) 사용**: 라인(2px) 두께 자체 때문에 발생하는 상하 오프셋마저도 없애기 위해, `top: 50%`가 주어졌을 때 라인의 시각적 중심이 정확히 50%에 오도록 수학적 보정을 걸었습니다.

## 4. 사용 방법
`CustomVerticalSlider` 인스턴스는 다음과 같이 초기화됩니다:
```javascript
import { CustomVerticalSlider } from './CustomSlider.js';

const slider = new CustomVerticalSlider(wrapperElement, {
  min: 0,
  max: 100,
  value: 50,
  onChange: (newValue) => {
    // 값이 바뀔 때마다 실행될 로직
  }
});
```

## 5. 테스트 방법
1. **데스크탑**: 마우스를 이용해 각 슬라이더 라인을 클릭하거나 드래그해 봅니다. 라인이 컨테이너 좌우를 100% 꽉 채우는지, 마우스 커서를 벗어나 위아래로 움직일 때 부드럽게 한계점(0/100)에서 멈추는지 확인합니다.
2. **모바일**: 손가락으로 드래그할 때 브라우저 스크롤이 발생하지 않는지(`touch-action: none` 적용 확인), 여러 슬라이더를 동시에 조작할 때 간섭이 없는지 확인합니다.
