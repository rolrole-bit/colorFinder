# DYE MASTER 배포 버전 종합 테스트 및 진단 리포트

본 리포트는 배포된 버전(`http://10.28.42.23:9090/`) 및 서버/클라이언트 소스 코드를 종합적으로 진단하여, 서비스 운영 시 장애를 유발할 수 있는 잠재적 문제점(성능 병목, 보안 취약점, 사용성 버그 등)과 구체적인 해결책을 정리한 문서입니다.

---

## 📌 요약 (Executive Summary)

| 분류 | 취약점 및 문제점 | 위험도 | 해결 방안 |
| :--- | :--- | :---: | :--- |
| **성능** | 배포본에서도 브라우저 캐시를 무력화하는 헤더 강제 설정 | **High** | `NODE_ENV === 'production'` 일 때 long-term 캐싱 헤더 적용 |
| **성능** | 외부 CDN(`jsdelivr`) 폰트 의존으로 인한 접속 지연 | **Medium** | 웹 폰트 로컬 서빙 방식으로 변경 및 복사 |
| **성능** | 동기식 JSON 파일 I/O로 인한 Node.js 이벤트 루프 블로킹 | **High** | 메모리 캐싱 및 비동기 쓰기 구조 도입 |
| **보안** | 리버스 프록시 배포 시 전체 사용자 동시 차단 위험 | **Critical** | `.env`에 `TRUST_PROXY=true` 적용 가이드 및 연동 점검 |
| **보안** | 공유 페이지(`/share`)의 Rate Limit 누락 및 자원 고갈 위험 | **Medium** | 공유 라우트에도 Rate Limit 미들웨어 적용 |
| **보안** | 세션 만료 시간(1시간)이 너무 길어 메모리 고갈 가능성 | **Medium** | 정리 주기 단축 (5분) 및 세션 만료 기준 미세조정 |
| **UX** | 모바일 브라우저에서 결과 화면 스크롤이 부드럽지 않은 현상 | **Low** | `-webkit-overflow-scrolling` 속성 및 터치 영역 간섭 개선 |
| **관리** | 미사용 종속성(`canvas-confetti`) 잔존 | **Low** | `package.json`에서 미사용 라이브러리 제거 |

---

## 1. 성능 및 네트워크 병목 요인 (Performance & Latency)

### 1.1. 배포 환경 내 브라우저 캐시 강제 무력화 헤더
- **원인 분석**:
  `server/index.js` 내 정적 파일 서빙 미들웨어(`express.static`)가 다음과 같이 설정되어 배포 버전에서도 브라우저 캐싱을 차단합니다.
  ```javascript
  if (/\.(js|css)$/i.test(filePath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  ```
- **발생 가능한 문제**:
  외부 사용자가 접속 시 RTT(왕복 지연 시간)가 높은 환경에서는 매 요청마다 JS, CSS 파일을 새로 내려받아야 합니다. 이로 인해 페이지 진입 시 로딩 스피너 단계가 길어지는 속도 저하 현상이 뚜렷하게 관찰됩니다. 빌드 단계에서 이미 캐시버스터(`?v=YYYYMMDD`)를 적용하도록 구현되어 있으므로, 캐싱을 막을 필요가 전혀 없는 상태입니다.
- **해결 방안**:
  `NODE_ENV === 'production'`인 배포 상태일 때는 JS/CSS에 대해 최장 1년의 강력한 캐싱 헤더를 지정하도록 처리합니다.
  ```javascript
  if (process.env.NODE_ENV === 'production' && /\.(js|css)$/i.test(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  ```

### 1.2. 외부 CDN 웹 폰트 의존으로 인한 접속 지연
- **원인 분석**:
  `src/index.css` 및 `share.js` 내에 외부 웹 폰트 리소스(`https://fastly.jsdelivr.net`)가 지정되어 있습니다.
- **발생 가능한 문제**:
  보안상 외부 인터넷 망이 통제된 내부 인트라넷 환경에서 접속하거나 CDN 서비스 자체에 딜레이가 발생할 경우, 폰트 파일 다운로드가 완료될 때까지 화면의 글자가 보이지 않거나(FOIT) 기본 폰트로 로딩되었다가 뒤늦게 서체가 적용되어 깜빡이는 현상(FOUT)이 발생합니다.
- **해결 방안**:
  배포 빌드(`tools/build.js`) 실행 시 폰트 파일(`.woff2`)도 함께 패키징하고, CSS 및 템플릿에서도 외부 CDN 대신 로컬 서버 경로에서 폰트를 직접 서빙하도록 로컬화 작업을 병행합니다.

### 1.3. 랭킹 데이터 동기식 파일 I/O로 인한 서버 블로킹
- **원인 분석**:
  `server/db.js`의 `loadRankings()` 및 `persistRankings()`는 요청이 들어올 때마다 물리 디스크에 동기 방식으로 읽기/쓰기를 수행합니다.
  ```javascript
  const data = readFileSync(RANKINGS_FILE, 'utf-8');
  writeFileSync(RANKINGS_FILE, JSON.stringify(rankings, null, 2), 'utf-8');
  ```
- **발생 가능한 문제**:
  동기 파일 쓰기가 실행되는 동안 Node.js의 싱글 스레드 이벤트 루프는 다른 사용자의 요청(색상 선택, 페이지 이동 등)을 받지 못하고 멈춥니다(Blocked). 10~20명이 동시에 게임을 완료하고 점수를 등록하면 서버 응답속도(Latency)가 수 초 이상 지연되거나, 디스크 I/O 속도가 느린 서버 환경에서 서비스 자체가 일시 마비되는 치명적인 성능 저하로 이어집니다.
- **해결 방안**:
  1. 서버 시작 시점에 `loadRankings()`를 1회만 호출하여 랭킹 목록을 메모리에 올려둡니다.
  2. 조회 요청은 I/O 없이 메모리 캐시를 즉시 반환하도록 최적화합니다.
  3. 쓰기 작업 발생 시 비동기 함수 `fs.promises.writeFile`로 백그라운드 저장 처리를 하거나 지연 영속화(Debouncing) 기법을 사용합니다.

---

## 2. 보안 및 장애 방지 취약점 (Security & Hardening)

### 2.1. 리버스 프록시(Nginx / Synology) 환경에서 Rate Limit 오동작 리스크
- **원인 분석**:
  서버 내 Rate Limiter(`server/utils/security.js`)는 `req.ip` 값을 기반으로 차단 조치를 수행합니다.
  ```javascript
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  ```
  그러나 `.env` 내 `TRUST_PROXY=false` 설정이 디폴트로 되어 있으며, 많은 배포 환경에서 Synology 웹스테이션이나 Nginx 등 리버스 프록시 뒤에 Node.js 앱을 배치합니다.
- **발생 가능한 문제**:
  `TRUST_PROXY`가 비활성화되어 리버스 프록시가 작동하면, 외부에서 접속하는 모든 사용자의 `req.ip`가 리버스 프록시의 로컬 IP(예: `127.0.0.1`)로 단일화됩니다. 이 상태에서 누군가 1명이 5회 이상 API를 호출하면, **서버에 접속한 모든 사용자가 동일한 IP로 식별되어 429 Too Many Requests 오류와 함께 일제히 서비스 차단을 당하는 대참사**가 발생합니다.
- **해결 방안**:
  배포 안내서에 프록시 서버 연동을 위한 `.env` 내 `TRUST_PROXY=true` 전환을 필수로 명시하고, 신뢰 가능한 프록시 설정이 정상 동작하는지 테스트 템플릿에 명문화해야 합니다.

### 2.2. 공유 API 라우트의 Rate Limit 정책 누락
- **원인 분석**:
  `server/index.js` 상에서 API 라우트들은 모두 `rateLimit` 미들웨어가 통제하고 있으나, `/share` 라우트는 아무런 무제한 호출 방어책이 설정되어 있지 않습니다.
  ```javascript
  app.use('/share', shareRoutes); // ⚠️ Rate limit 없음
  ```
- **발생 가능한 문제**:
  `/share`로 들어오는 모든 요청은 내부적으로 `getAllPlayerRankings()`를 실행하며, 이는 동기식 JSON 읽기와 파싱 연산을 발생시킵니다. 악성 봇이나 스크랩 크롤러가 `/share?score=...`로 무한 리퀘스트를 날리는 방식으로 공격할 시 CPU 자원 고갈과 디스크 과부하를 아주 손쉽게 유발할 수 있습니다.
- **해결 방안**:
  공유 페이지에 대해서도 최소한의 보호 조치(예: IP당 분당 60회 이내 호출 제한)를 적용하는 미들웨어를 추가합니다.

### 2.3. 세션 정리(Cleanup) 주기 지연으로 인한 서비스 거부(DoS) 취약점
- **원인 분석**:
  서버 세션의 누적 메모리를 제어하는 `cleanupSessions()`는 `setInterval`을 통해 **1시간 주기**로만 자동 수행됩니다.
  ```javascript
  setInterval(() => {
    try { cleanupSessions(); } catch (e) { ... }
  }, 60 * 60 * 1000); // 1시간 주기
  ```
- **발생 가능한 문제**:
  만약 순간적인 동시 접속자가 몰리거나 봇이 세션 생성을 고의로 반복 실행하여 `MAX_SESSIONS (1000개)` 한도에 도달하면, 세션 정리 루틴이 실행될 때까지 모든 신규 플레이어는 `503 Server is busy` 에러를 반환받으며 게임을 개시할 수 없게 됩니다.
- **해결 방안**:
  주기적 정리 인터벌을 `5분` 정도로 크게 단축하여 세션 라이프사이클을 기민하게 확보하고, 미완료 세션 소멸 기준 시간도 30분에서 10~15분으로 현실성 있게 변경합니다.

---

## 3. UI/UX 및 웹 표준성 이슈 (User Experience & Standard)

### 3.1. 모바일 환경의 관성 스크롤 미지원 및 터치 영역 간섭
- **원인 분석**:
  최종 결과 화면을 감싸는 `.split-screen-result` 컴포넌트는 화면 고정(`position: fixed;`) 상태에서 내부 스크롤(`overflow-y: auto;`)을 발생시킵니다.
- **발생 가능한 문제**:
  1. iOS Safari를 비롯한 일부 모바일 웹 브라우저에서 가상 고정 영역 내부 스크롤 시 관성 효과가 작동하지 않아 조작감이 극히 뻑뻑하거나 멈추는 불쾌한 느낌을 줍니다.
  2. 하단에 고정된 두 개의 버튼("다시 하기", "공유 하기") 영역이 넓은 범위를 점유하고 있어(`z-index: 3000`), 사용자가 모바일에서 위아래로 스크롤하려고 하단부를 터치하고 끌어당길 때 이벤트가 씹히거나 동작하지 않는 레이아웃 간섭이 관찰됩니다.
- **해결 방안**:
  - CSS에 모바일 스무스 스크롤을 보장하는 `-webkit-overflow-scrolling: touch;` 속성을 선언합니다.
  - 하단 버튼 영역의 레이아웃 영역(`height` 및 `padding`)이 불필요하게 랭킹 리스트 터치 감지 영역을 침범하지 않도록 `pointer-events` 속성을 미세조정하거나 배치 구조를 가다듬습니다.

---

## 4. 빌드 및 환경 설정 관리 (Dependency & Configuration)

### 4.1. 사용하지 않는 외부 라이브러리(`canvas-confetti`) 의존성 잔존
- **원인 분석**:
  `package.json`의 종속성 항목에 `"canvas-confetti": "^1.9.3"` 라이브러리가 포함되어 있으나, 실제 점수 연출은 `src/utils/ConfettiUtils.js`에서 직접 바닐라 HTML5 캔버스 드로잉 방식으로 커스텀 구현되어 있어 외부 패키지를 한 번도 참조하지 않습니다.
- **발생 가능한 문제**:
  패키지를 설치하고 빌드하는 대상을 납품할 때 쓰이지도 않는 라이브러리로 인해 다운로드 리소스 및 저장공간(node_modules)을 낭비하고, 불필요한 서드파티 모듈 보안 취약점 감사(npm audit) 목록에 올라가게 됩니다.
- **해결 방안**:
  `package.json`에서 `"canvas-confetti"` 라인을 완전히 제거하고 배포 버전을 정화합니다.

---

## 💡 최종 제안 및 조치 방향

본 진단 내용을 바탕으로 배포 시스템의 완성도를 끌어올리기 위해 아래 3가지 개선 사항을 **우선 조치할 것을 적극 권장**합니다.

1. **배포 환경 캐시 정책 적용**: `server/index.js` 내 static 서빙 부분에 `NODE_ENV === 'production'` 일 때의 `Cache-Control`을 추가 설계.
2. **동기식 I/O 메모리 멤캐싱화**: `db.js` 내 rankings 조회/저장 흐름을 메모리 스택 기반의 비동기 방식으로 수정.
3. **공유 라우트 보안 적용**: `/share` 엔드포인트에 `rateLimit` 미들웨어 삽입.
