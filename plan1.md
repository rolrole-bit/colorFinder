# DYE MASTER 조작 가이드 화살표 구현 계획 (plan1.md)

## 1. 작업 목적
처음 게임에 진입한 사용자가 HSL 슬라이더를 위아래로 드래그하여 조작할 수 있다는 점을 직관적으로 이해할 수 있도록, 1라운드(ROUND 1) 시작 시 슬라이더 중앙에 양방향 점선 SVG 화살표를 띄워 가이드를 제공합니다. 사용자가 조작을 개시하는 즉시 이 화살표는 부드럽게 스르륵 사라지도록 구현합니다.

## 2. 핵심 기능
- **가이드 화살표 표시**: `ROUND 1`일 때 세 슬라이더(Hue, Saturation, Lightness)의 수직 중심선 위치에 양방향 점선 및 화살표 촉을 표현한 SVG 요소를 띄웁니다.
- **인터랙션 연동 페이드아웃**: 사용자가 드래그 또는 터치(`pointerdown`) 입력을 시작하면 `tutorial-overlay` 요소를 0.8초에 걸쳐 부드럽게 페이드아웃(`opacity = 0`) 시킨 후 DOM에서 완전히 삭제합니다.

## 3. 입력과 출력
- **입력**: 게임 라운드 시작 상태 (`currentRound === 1`), 사용자 슬라이더 `pointerdown` 이벤트.
- **출력**: 3개의 수직 안내 화살표 렌더링 및 조작 감지 시 페이드아웃 소멸.

## 4. 파일 구조
- [GameView.js](file:///e:/AI/DYE_MASTER/colorFinder/src/ui/GameView.js): 1라운드 판정 및 튜토리얼 마크업 추가, `fadeTutorial()` 연동.

## 5. 핵심 모듈
- **Tutorial Overlay**: CSS Absolute 포지셔닝을 사용하여 3개의 슬라이더 영역 중앙에 SVG 화살표들을 겹쳐 띄움.
- **Tutorial Fader**: `pointerdown` 이벤트 발생 시 호출되어 CSS Transition(`opacity`) 효과를 주고 소멸 후 DOM에서 노드를 삭제함.

## 6. 실행 흐름
1. `transitionToGuess`에서 `state.currentRound === 1`인지 판별.
2. 참일 경우, `tutorialHTML` 마크업을 생성하여 `#game-box` 내부에 추가 렌더링.
3. 플레이어가 조작을 위해 `TapeSlider` 터치 영역을 누르는 순간 `onDown` 메서드가 트리거됨.
4. `onDown` 내부에서 `fadeTutorial()`이 실행됨.
5. 화살표 오버레이의 `opacity`가 0으로 전환되며 `transitionend` 이벤트 수신 후 DOM에서 삭제됨.

## 7. 에러 처리
- 오버레이가 이미 삭제되었거나 존재하지 않는 라운드(ROUND 2, 3)에서는 `fadeTutorial()` 호출 시 안전하게 바이패스 처리.
- 터치 영역 드래그 도중 중복 이벤트 발생으로 인한 페이드 중복 처리를 방지하기 위해 단 한 번만 페이드아웃되도록 안전 장치 적용.

## 8. 테스트 전략
- ROUND 1 진입 시, 3단 슬라이더 위로 양방향 점선 화살표가 예쁘게 오버랩되는지 확인.
- 임의의 슬라이더를 클릭하거나 드래그하는 순간 화살표가 부드럽게 페이드아웃 되며 완전히 사라지는지 확인.
- ROUND 2, ROUND 3에 진입할 때는 해당 화살표가 나타나지 않는지 검증.

## 9. 완료 기준
- ROUND 1에서 가이드용 양방향 SVG 화살표 3개가 잘 나타남.
- 조작 시작 시 0.8초 동안 자연스럽게 페이드아웃 및 DOM 완전 삭제 확인.
