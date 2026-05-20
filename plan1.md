# DYE MASTER 회전 다이얼(Rotary Knob) UI 도입 계획 (1)

## 작업 목적
- 기존의 수직 테이프 슬라이더 UI가 다소 투박하고 거추장스럽다는 피드백을 수용하여, 물리 다이얼 조작 느낌을 주는 세련되고 직관적인 **3구 회전 다이얼(Rotary Knob)** UI로 개편.
- 사용자가 직관적으로 다이얼을 휠 돌리듯 돌려가며 H(Hue), S(Saturation), B(Brightness/Lightness) 값을 튜닝하도록 하여 게임성 및 조작 재미 극대화.

## 핵심 기능
- **3구 회전 다이얼 배치**: 화면 중앙부에 가로로 나란히 H, S, B 다이얼 3개 배치.
- **물리 회전 조작 연동**: 
  - 각 다이얼 중심점 `(cx, cy)` 대비 사용자의 마우스/터치 드래그 위치 `(x, y)`의 각도 `theta`를 `Math.atan2`로 실시간 연동.
  - 마우스/터치 이동 방향에 맞춰 다이얼의 인디케이터나 휠 판넬 자체를 CSS `transform: rotate(...)`로 부드럽게 회전시킴.
- **다이얼별 테마형 그라데이션 휠**:
  - **H 다이얼**: 다이얼 테두리나 내부에 360도 색상 휠(`conic-gradient`)을 배치하고, 다이얼 회전 시 휠 자체가 회전하며 6시 방향의 고정 인디케이터(▲)가 색상을 선택하는 화려한 연출.
  - **S 다이얼**: 채도 0% ~ 100%를 회전각 0~360도에 매핑. 단색 휠 및 회전 인디케이터 침(needle) 배치.
  - **B 다이얼**: 밝기 0% ~ 100%를 회전각 0~360도에 매핑. 검정-흰색 그라데이션 또는 단색 휠에 지시침 배치.
- **수치 시각화**: 각 다이얼 하단에 현재 값(H: `180°`, S: `75%`, B: `50%`)을 디지털 인디케이터 형태로 실시간 피드백 표시.
- **햅틱 틱 사운드**: 각도 변경에 따라 `playSliderTickSound()` 연동.

## 입력과 출력
- **입력**: 다이얼 영역 터치 다운(`pointerdown`) 후 드래그(`pointermove`) 시의 클라이언트 마우스/터치 좌표 `(clientX, clientY)`.
- **출력**: 
  - 각 다이얼의 CSS 회전 각도값 (`deg`).
  - H, S, L 상태값 업데이트 및 이에 따른 실시간 배경색 (`guess-bg`) 반응.

## 파일 구조
- [GameView.js](file:///e:/AI/DYE_MASTER/colorFinder/src/ui/GameView.js): 기존 SVG 슬라이더 제거 및 3구 다이얼 HTML/SVG 및 `DialKnob` 컨트롤러 로직 추가.
- [index.css](file:///e:/AI/DYE_MASTER/colorFinder/src/index.css): 다이얼의 원형 스타일, conic-gradient 애니메이션, 바늘(needle) 및 지시기 디자인 추가.

## 핵심 모듈 및 수학적 공식
- **각도 계산 공식**:
  - 다이얼 바운딩 박스 중심: `cx = rect.left + rect.width / 2`, `cy = rect.top + rect.height / 2`
  - 현재 포인터 각도: `angleRad = Math.atan2(clientY - cy, clientX - cx)`
  - 라디안 -> 디그리 변환: `angleDeg = angleRad * (180 / Math.PI)`
  - 회전 방향 및 오프셋 보정 (6시 방향의 삼각 지시계를 0도 기준점으로 잡을 경우의 각도 매핑).

## 에러 처리
- 터치 무브 시 스크롤 등 브라우저 기본 동작 방지(`e.preventDefault()`).
- 화면 밖으로 드래그가 나가더라도 `window` 단에서 pointermove 및 pointerup을 트래킹하여 조작이 부드럽게 유지되도록 보장.

## 테스트 전략
- 각 다이얼을 360도 회전시켰을 때 H(0~360), S(0~100), B(0~100) 값이 정해진 범위 내에서 오차 없이 부드럽게 변환되는지 테스트.
- DONE 버튼을 눌렀을 때 최종 조합된 RGB 색상이 서버로 정확히 전달되는지 체크.
