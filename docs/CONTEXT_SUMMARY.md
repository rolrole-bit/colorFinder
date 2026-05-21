# DYE MASTER - Session Context Summary
마지막 업데이트: 2026-05-21

## 1. 프로젝트 목적 및 현재 상태
- **목적**: 사용자가 제시된 타겟 색상(RGB)을 보고, RGB 슬라이더(다이얼)를 조작하여 최대한 비슷한 색상을 만들어내는 게임.
- **현재 상태**: 프로덕션 배포 상태(Node.js 서버 + Vanilla JS 클라이언트). 
- **주요 뷰(UI)**: `EntryView.js`(시작), `GameView.js`(인게임), `ResultView.js`(라운드 결과), `ScoreboardView.js`(최종 랭킹 및 요약).

## 2. 최근 주요 변경 사항 (UI/UX 폴리싱)
1. **스코어 카운팅 모션 블러**: 
   - `AnimationUtils.js`의 `animateValue` 진행도에 비례해 `filter: blur()` 값을 실시간 적용하여, 숫자가 올라갈 때 역동적인 모션 블러 효과 추가.
2. **배경 블러 경계선 문제 해결 (`ResultView`, `ScoreboardView`)**: 
   - 좌/우 50:50 배경의 개별 블러를 제거하고, 화면 전체를 덮는 통합 블러 오버레이 레이어(`backdrop-filter: blur(40px)`)를 추가하여 경계선의 어색함 해결.
3. **파티클(폭죽) 타이밍 수정**: 
   - 점수 카운팅 애니메이션 진행 중에는 양옆에서 연속적으로 폭죽(`fireSideConfetti`)이 터지고, 점수 카운팅이 완전히 끝나는 시점에 가운데서 크게 폭죽(`fireCenterConfetti`)이 터지도록 분리.
4. **동적 버튼 대비(Contrast) 로직 고도화**:
   - `ColorUtils.js`의 `getContrastBlendColor`를 단순 HSL `l` 값이 아닌 시각적 밝기(`YIQ`) 기반으로 개편.
   - 버튼(`magazine-start-btn`)의 CSS를 하드코딩된 `!important`에서 CSS 변수(`--btn-color`, `--btn-bg` 등)로 분리.
   - 배경의 실제 보간된 위치 색상(`interpolateGradient`)을 파악해, 밝은 배경에서는 어두운 버튼/글자로, 어두운 배경에서는 밝은 버튼/글자로 자동 전환되도록 동적 렌더링 완벽 구현.
5. **EntryView (START 화면)**:
   - 배경 텍스트(DYE MASTER)의 초기 채도가 너무 형광 녹색으로 튀는 현상 방지를 위해 `contrast(1000%) saturate(300%)` 필터를 `contrast(200%) saturate(120%)`로 완화.

## 3. 핵심 아키텍처 규칙 (AntiGravity Compact Engineering Rule)
- **모듈 분리**: `core`(비즈니스/상태), `ui`(렌더링), `utils`(유틸), `server`(백엔드)로 엄격히 분리.
- **UI 렌더링**: 컴포넌트 프레임워크(React 등) 없이 Vanilla JS 템플릿 리터럴로 `innerHTML`을 주입하는 방식.
- **스타일링**: Tailwind 없이 순수 CSS(`index.css`)로 구현하며, 모던 웹 트렌드(Glassmorphism, Vibrant Gradients, Micro-animations) 적극 사용. `mix-blend-mode`와 `backdrop-filter` 등의 고급 시각 효과 사용 시 충돌에 주의할 것.
- **안티치트**: 브라우저 개발자 도구 오픈 감지, 비정상적인 시간/점수 조작 감지 및 차단 로직 적용됨 (`AntiCheat.js`).

## 4. 다음 세션(Next Session) 작업 가이드
- 기능을 추가하거나 UI를 수정할 때 이 문서(`docs/CONTEXT_SUMMARY.md`)를 먼저 읽고 기존의 컨벤션과 충돌하지 않도록 주의할 것.
- 특히 CSS 렌더링(예: `backdrop-filter` 위에 `mix-blend-mode`를 얹으면 깨지는 버그 등)과 관련된 이슈가 많았으므로, 색상 반전이나 투명도 관련 UI 요소 작업 시에는 기존 `ColorUtils`의 YIQ 계산 로직을 최우선으로 활용할 것.
