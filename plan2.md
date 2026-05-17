# 커스텀 수직 슬라이더 UI/UX 설계 계획

## 1. 개요
사용자가 요구한 "좌우 값을 100%로 계산해서 채우고, 라인을 완벽하게 중앙 정렬시키는" UI 목표를 달성하기 위해 커스텀 DOM 기반의 레이아웃을 구성합니다. 

## 2. 모듈 연동 방식 및 DOM 구조
기존 구조: `<div class="v-slider-wrapper"><input type="range" class="v-slider"></div>`
변경 구조:
```html
<div class="custom-v-slider-wrapper" id="hue-wrapper">
  <!-- 백그라운드 색상 표시 영역 -->
  <div class="slider-bg"></div>
  <!-- 100% 폭을 가지는 1.5px 두께의 라인 썸(Thumb) -->
  <div class="slider-thumb"></div>
  <!-- 이벤트 캡처 영역 -->
  <div class="slider-touch-area"></div>
</div>
```

## 3. 사용자 인터랙션 흐름
1. **터치/클릭 (PointerDown)**: 사용자가 `slider-touch-area`의 임의 영역을 클릭하면, 라인(`slider-thumb`)이 즉시 해당 Y 위치로 이동(Jump)합니다.
2. **드래그 (PointerMove)**: 마우스나 손가락을 상하로 움직이면 라인이 즉각적으로 따라 움직입니다. 상하 한계점(0% ~ 100%)을 넘지 않도록 제한(Clamp)됩니다.
3. **해제 (PointerUp)**: 드래그가 종료되며 최종 값을 게임 로직에 전달합니다.

## 4. UI 핏팅(Fitting) 및 정렬 전략
- **너비 100% 보장**: 부모 컨테이너에 `flex: 1`을 적용하여 화면 공간을 균등하게 차지합니다. 슬라이더 라인(`slider-thumb`)은 `width: 100%`를 가지므로 어떠한 상황에서도 좌우 빈틈 없이 꽉 차게 렌더링됩니다.
- **수직 오차율 0% 보장**: 라인의 수직 위치는 `top: 50%` 와 같은 퍼센트 단위로 조정되며, 자체 두께에 의한 오차를 없애기 위해 `transform: translateY(-50%)`를 적용합니다. 이를 통해 라인의 실제 중앙점이 정확한 픽셀 값을 대변하게 됩니다.
- **포커스 아웃라인 제거**: 네이티브 Input 요소가 아니기 때문에 브라우저 기본 포커스 링이나 렌더링 엔진별(WebKit, Gecko) 파편화 문제가 근본적으로 발생하지 않습니다.
