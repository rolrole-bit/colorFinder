# DYE MASTER 회전 다이얼(Rotary Knob) UI 도입 계획 (2)

## UI 필요 여부
- **매우 필요함**: 기존의 세로형 슬라이더 UI를 걷어내고, 3개의 다이얼(H, S, B)과 고정 삼각형(▲) 지시침, 그리고 조작된 수치를 보여주는 모던한 원형 다이얼 UI 세트를 렌더링해야 함.

## 사용자 흐름
1. GUESS 페이즈 진입 시, 화면 중앙에 원형 다이얼 3개가 가로로 나란히 나타남.
   - 좌측: **H** (색상 휠 다이얼)
   - 중앙: **S** (채도 휠 다이얼)
   - 우측: **B** (명도/밝기 휠 다이얼)
2. 사용자가 다이얼 중 하나를 마우스 클릭/터치한 채로 원을 그리듯 드래그함.
3. 드래그하는 회전 궤적에 맞춰 다이얼 내부의 지시바늘(needle) 또는 색상 그라데이션이 물리 다이얼처럼 돌아가고, 하단의 수치가 바뀜.
4. 배경색(`guess-bg`)은 실시간으로 연동되어 변환되며, 좌우 여백을 통해 블러가 없는 깨끗한 단색 배경을 지속해서 확인.
5. 세련되게 맞춰진 색상을 확인한 후 하단의 'DONE'을 눌러 완료.

## 화면 또는 명령 흐름
- **다이얼 패널 레이아웃**:
  - `slider-panel-wrapper` 내부에 기존 SVG 대신 다이얼 전용 컨테이너 `.dials-container` 배치.
  - `.dials-container`는 flexbox 형태로 가로 정렬을 하며, 모바일 환경에서는 뷰포트 크기에 맞춰 적절히 둥글게 스케일 다운되거나 세로 정렬/축소 정렬되도록 CSS 설정.
- **다이얼 마크업**:
  ```html
  <div class="dial-wrapper" id="dial-h-wrapper">
    <div class="dial" id="dial-h">
      <div class="dial-center-label">H</div>
      <div class="dial-needle"></div>
    </div>
    <div class="dial-indicator-arrow">▲</div>
    <div class="dial-value" id="dial-h-value">0°</div>
  </div>
  ```

## core 모듈과의 연동 방식
- 다이얼 각도 `0 ~ 360`도를 바탕으로 `H`(0~360), `S`(0~100), `L`(0~100)을 매핑:
  - `currentH` = `angleDeg`
  - `currentS` = `(angleDeg / 360) * 100`
  - `currentL` = `(angleDeg / 360) * 100` (B를 HSL의 L에 매핑하여 구현의 안전성 극대화)
- 실시간으로 갱신되는 `H, S, L`을 통해 `updateColor()`를 호출하여 `setUserColor(r, g, b)` 및 배경색 연동.

## 상태 처리
- 각 다이얼 인스턴스는 내부적으로 `currentAngle`을 보관.
- 드래그 시작 시점의 각도 오프셋을 계산하여 다이얼을 잡고 돌릴 때 갑자기 툭 튀는 현상(Angle jump)을 예방하는 델타 보정 로직 구현:
  - `pointerdown` 시 중심점 대비 터치 각도 `startAngle`을 계산하고, 현재 다이얼의 누적 각도 `currentAngle`과의 차이(`angleOffset`)를 기록.
  - `pointermove` 시 `currentAngle = calculateAngle() - angleOffset`을 적용하여 잡은 지점부터 부드럽게 돌아가도록 함.

## 검증 방법
- 3개의 다이얼이 각각 독립적으로 정상 동작하는지 테스트.
- 다이얼을 360도 끝까지 돌렸을 때 값이 최댓값(360 또는 100)에 도달하고 다시 0으로 순환하는 경계선 처리 검증.
- 햅틱 사운드가 지나치게 연속적으로 나서 시끄럽지 않도록 값이 1단위로 명확히 바뀔 때만 `playSliderTickSound()`가 작동하도록 스로틀링 검증.
