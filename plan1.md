# 작업 목적
- DYE MASTER의 텍스트 대비색(명도 대비) 계산 공식을 단순 흑백(YIQ 기반 검정/흰색) 또는 단순 반전에서 HSL 공간의 지능형 보색 대비 공식으로 개선합니다.
- 배경색이 중간 명도(회색 영역 또는 사용자가 지정한 "L의 붉은 영역")에 위치하여 글씨 명도가 겹쳐 가독성이 떨어지는 현상을 방지합니다.
- H, S는 보색(반전)을 취하되, L(명도)이 중간 영역(30%~70%)에 들어갈 경우 이 영역 밖(어두운 영역 15% 이하 또는 밝은 영역 85% 이상)으로 밀어내어 가독성을 극대화합니다.

# 핵심 기능
- `getHSLContrastColor(r, g, b)` 함수 구현
  - RGB를 HSL로 변환
  - H(Hue)는 180도 회전하여 보색 계산
  - S(Saturation)는 반전 또는 가독성을 보완한 반전 계산
  - L(Lightness)은 기본 반전(`100 - L`)을 취하되, 중간 명도 영역(30% ~ 70%)에 위치하면 `L <= 50`일 때는 더 낮게(예: 15%), `L > 50`일 때는 더 높게(예: 85%) 강제로 밀어내어 명도 가독성을 확보
  - 변환된 HSL 값을 CSS `hsl()` 포맷 문자열로 변환하여 반환
- 스코어보드(`ScoreboardView.js`), 결과화면(`ResultView.js`), 게임화면(`GameView.js`) 등 대비색이 필요한 곳에 기존 YIQ 함수 대신 새 HSL 대비 함수 적용

# 입력과 출력
- 입력: RGB 색상 값 (r, g, b) 각각 0~255
- 출력: CSS hsl 색상 문자열 `hsl(H, S%, L%)`

# 파일 구조
수정 대상 파일:
- [ColorUtils.js](file:///e:/AI/DYE_MASTER/colorFinder/src/utils/ColorUtils.js): 신규 HSL 대비색 함수 `getHSLContrastColor` 정의
- [ResultView.js](file:///e:/AI/DYE_MASTER/colorFinder/src/ui/ResultView.js): 새 대비색 함수 적용
- [ScoreboardView.js](file:///e:/AI/DYE_MASTER/colorFinder/src/ui/ScoreboardView.js): 새 대비색 함수 적용
- [GameView.js](file:///e:/AI/DYE_MASTER/colorFinder/src/ui/GameView.js): 필요한 텍스트 대비색 영역에 적용

# 핵심 모듈
- `ColorUtils.js` 내의 HSL/RGB 변환 유틸리티 활용 및 명도 밀어내기 알고리즘 구현

# 실행 흐름
1. 각 뷰에서 배경색 결정
2. 해당 배경색의 R, G, B를 기반으로 `getHSLContrastColor(r, g, b)` 호출
3. 계산된 HSL 대비색 문자열을 스타일시트 또는 인라인 스타일의 `color` 값으로 설정
4. 브라우저가 보색 및 명도 밀어내기가 적용된 텍스트를 렌더링

# 에러 처리
- R, G, B 값이 유효하지 않거나 undefined인 경우 안전하게 기본 대비색(흰색 또는 검은색)을 반환하는 Fallback 로직 설계

# 테스트 전략
- 수동 테스트: 다양한 RGB 색상(파스텔톤, 중간 명도의 핑크/연두색, 아주 어두운 색, 아주 밝은 색)을 직접 선택하여 텍스트 가독성을 확인하고 명도 밀어내기 동작 여부 검증

# 완료 기준
- 중간 명도(예: 핑크, 연두색 등 L=50% 부근) 배경 위에서 텍스트 색상이 회색빛이 아닌, 채도가 살아있는 뚜렷한 대비색(명도가 85% 이상이거나 15% 이하인 보색)으로 표시되는 것 확인
