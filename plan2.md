# Plan 2: 보안 감사 - UI / UX 방어

## UI 필요 여부
기존 UI를 변경하지 않고, 보안 로직을 투명하게 삽입합니다.
단, 다음의 UI 관련 보안 수정이 필요합니다:

## 사용자 흐름 (변경 없음)
1. 엔트리 → 닉네임/게임 입력 → 난이도 선택 → START
2. 기억 단계 (MEMORIZE) → 추측 단계 (GUESS) → 결과 → 반복
3. 3라운드 후 최종 결과 + 랭킹

## UI 보안 수정 포인트

### 1. XSS 방어 (innerHTML → textContent)
- 랭킹 리스트 렌더링 시 `innerHTML` 대신 `textContent` 또는 DOM API 사용
- 닉네임/게임명에 HTML 태그 삽입 공격 차단

### 2. 타겟 색상 DOM 노출 최소화
- MEMORIZE 단계의 배경색을 CSS 변수/Canvas로 대체 검토
- 현실적으로 완전 차단은 불가 → DevTools 감지와 병행

### 3. DevTools 감지 시 UI 피드백
- 감지 시 경고 배너 노출 또는 조용히 플래그 설정
- 정상 플레이에 방해하지 않도록 주의

## Core 모듈과의 연동 방식
- UIManager → AntiCheat.sanitizeHTML() 호출하여 출력 정제
- UIManager → AntiCheat.validateScore() 호출하여 점수 검증
- UIManager → AntiCheat.checkTimerIntegrity() 호출하여 타이머 체크

## 상태 처리
- 안티치트 플래그는 모듈 스코프 변수로 관리
- 치트 감지 시 상태: `{ cheatingDetected: true, reason: string }`
- 치트 감지 상태에서 점수는 0으로 강제

## 에러 표시
- 치트 감지 시 사용자에게 노출하지 않음 (Silent Fail)
- 단, 점수가 0으로 기록되므로 간접적으로 인지 가능

## 검증 방법
- 브라우저 DevTools 콘솔에서 공격 시도 → 방어 확인
- 일반 플레이 3라운드 → 정상 점수 기록 확인
- XSS 페이로드 입력 → 스크립트 실행되지 않음 확인

## 확장 가능성
- Phase 2에서 서버 사이드 랭킹 도입 시 UI에 "온라인 랭킹" 탭 추가
- CAPTCHA 또는 인간 검증 UI 추가 가능
- 리플레이 시스템 도입하여 상위 점수 검증 가능
