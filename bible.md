# DYE MASTER Bible

## 작업 목적
색상 매칭 게임 "DYE MASTER" — Node.js/Express 서버사이드 랭킹 + 보안 강화 아키텍처.

## 프로젝트 구조
```
/src
  /core
    GameState.js    — 게임 상태 관리 (난이도, 점수, 라운드) [방어적 deep copy, 범위 검증]
    Ranking.js      — 서버 API 기반 랭킹 시스템 (캐싱 포함)
    ServerAPI.js    — 서버 통신 모듈 (세션, 라운드, 랭킹)
  /ui
    UIManager.js    — 뷰 라우터 (오케스트레이터, ~50줄)
    EntryView.js    — 엔트리 화면 (플레이어 입력, 게임 선택, 난이도)
    GameView.js     — 게임 플레이 화면 (기억 → 추측 → 제출)
    ResultView.js   — 중간 결과 화면 (라운드별 점수)
    ScoreboardView.js — 최종 스코어보드 (랭킹 표시)
    AnimationUtils.js — 공통 애니메이션 (scramble, animateValue, getContrastYIQ)
    CustomSlider.js — 포인터 이벤트 기반 수직 슬라이더
  /utils
    ColorUtils.js   — 색상 생성, 점수 계산, 색상 변환 유틸리티
    Constants.js    — MMO 게임 목록
    SoundUtils.js   — Web Audio API 기반 효과음
    AntiCheat.js    — 안티치트 (점수 검증, DevTools 감지, 봇 탐지, XSS 방어)

/server
  index.js          — Express 서버 진입점 v2.1 (Secured)
  db.js             — JSON 파일 기반 DB (세션 메모리 + 랭킹 파일)
  /routes
    session.js      — POST /api/session/start
    round.js        — POST /api/round/submit
    ranking.js      — GET /api/rankings
  /utils
    scoreCalc.js    — 서버 점수 계산 모듈
    security.js     — Rate Limiter, 보안 헤더, 입력 새니타이징
  /data
    rankings.json   — 랭킹 영속 저장소
```

## 실행 방법
```bash
# 서버 시작 (포트 8080)
node server/index.js
# 또는 start.bat 더블클릭

# PowerShell 정책 문제 시
cmd /c "node server/index.js"
```

## 주요 설계 결정

### 점수 공식: `accuracy² × 1000 × 난이도배율`
- **제곱 적용**: 90%+ 고정밀 매칭에 기하급수적 보상
- **1000점 기반**: 소수점 없이 깔끔한 정수 표현
- **합산 방식**: 3라운드 합산 → 일관된 실력 요구

### 난이도 배율
| 난이도 | 기억 시간 | 배율 | 3R 만점 |
|--------|----------|------|---------|
| Easy   | 5초      | ×1.0 | 3,000   |
| Normal | 2초      | ×1.1 | 3,300   |
| Hard   | 0.5초    | ×1.2 | 3,600   |
| Hell   | 0.3초    | ×1.3 | 3,900   |

### 서버 보안 (v2.1)
- **Rate Limiter**: 세션 5/분, 제출 20/분, 랭킹 30/분
- **보안 헤더**: CSP, X-Frame-Options, X-XSS-Protection 등 6종
- **디렉토리 차단**: /server/, /data/, /node_modules/ 접근 403
- **CORS 제한**: 로컬호스트만 허용
- **JSON 바디 100KB 제한**: DoS 방어
- **타이밍 검증**: 라운드 제출 최소 1초 간격
- **세션/랭킹 상한**: 각 1000개/1000건

### UI 아키텍처 (v2.1 리팩토링)
- **nav 패턴**: 순환 의존성 방지 — UIManager가 nav 객체를 생성하여 각 뷰에 주입
- **화면별 모듈**: 엔트리/게임/결과/스코어보드를 독립 파일로 분리
- **서버 폴백**: 서버 통신 실패 시 클라이언트 로컬 계산으로 자동 전환

### 안티치트 (클라이언트)
- **점수 범위 검증**: 난이도별 이론적 최대 점수 초과 거부
- **DevTools 감지**: 창 크기 + console 객체 이중 감시
- **봇 탐지**: 포인터 이벤트 간격 분산 분석
- **XSS 방어**: escapeHTML()으로 사용자 입력 정제
- **세션 관리**: crypto.getRandomValues 기반 토큰, 최소 플레이 시간 검증
