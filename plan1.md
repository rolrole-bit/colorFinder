# Plan 1: 보안 감사 - Core / Logic 방어

## 작업 목적
DYE MASTER 게임의 클라이언트 사이드 로직에서 발견된 보안 취약점을 방어하는 코드 구현

## 핵심 기능
1. 점수 범위 검증 (난이도별 상한/하한)
2. LocalStorage 데이터 무결성 서명
3. GameState 방어적 복사
4. 타이머 무결성 교차 검증
5. 입력값 새니타이징

## 입력과 출력
- **입력**: 플레이어 점수, 닉네임, 게임명, 난이도, 라운드 결과
- **출력**: 검증된 데이터만 저장, 비정상 데이터 거부

## 파일 구조
```
/src
  /core
    GameState.js  ← 방어적 getter, setter 범위 검증
    Ranking.js    ← 점수 상한 검증, HMAC 서명
  /utils
    AntiCheat.js  ← [NEW] 안티치트 유틸리티 모음
```

## 핵심 모듈: AntiCheat.js

```js
/**
 * AntiCheat 모듈
 * - 점수 범위 검증
 * - LocalStorage 서명/검증
 * - DevTools 감지
 * - 타이머 무결성 체크
 */

// 난이도별 이론적 최대 점수
const MAX_SCORES = {
  Easy: 3000,    // 1000 × 3 × 1.0
  Normal: 3960,  // 1000 × 3 × 1.1 (올림)
  Hard: 3600,    // 1000 × 3 × 1.2
  Hell: 3900     // 1000 × 3 × 1.3 (최대 배율)
};

export function isValidScore(score, difficulty) {
  const max = MAX_SCORES[difficulty] || 3000;
  return Number.isFinite(score) && score >= 0 && score <= max;
}

export function isValidRoundScore(score) {
  return Number.isFinite(score) && score >= 0 && score <= 1000;
}
```

## 실행 흐름
1. 라운드 종료 → `calculateScore()` 호출
2. `isValidRoundScore()` 검증
3. 3라운드 종료 → 배율 적용
4. `isValidScore()` 최종 검증
5. `saveRecord()` → 서명 포함 저장
6. 로드 시 → 서명 검증 → 불일치 시 데이터 폐기

## 에러 처리
- 비정상 점수 → 조용히 무시 (공격자에게 힌트 제공 방지)
- 서명 불일치 → 랭킹 데이터 초기화
- 타이머 조작 감지 → 해당 라운드 점수 0처리

## 테스트 전략
- 정상 점수 범위 검증 (경계값 테스트)
- 비정상 점수 거부 테스트 (음수, NaN, Infinity, 초과값)
- 서명 위/변조 감지 테스트
- 타이머 조작 시나리오 테스트

## 완료 기준
- [ ] 콘솔에서 `setScore(99999)` 호출 시 랭킹에 반영되지 않음
- [ ] LocalStorage 직접 수정 시 서명 불일치로 거부됨
- [ ] `getState()` 반환값 변경이 실제 state에 영향 없음
- [ ] 정상 게임 플레이에는 영향 없음
