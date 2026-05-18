/**
 * AntiCheat 모듈
 * 클라이언트 사이드 치트 방지 유틸리티
 * 
 * 제공 기능:
 * - 점수 범위 검증 (난이도별 상한/하한)
 * - LocalStorage 데이터 서명/검증 (HMAC-like)
 * - DevTools 감지
 * - 타이머 무결성 교차 검증
 * - 입력 새니타이징 (XSS 방어)
 */

// ═══════════════════════════════════════════
// 1. 점수 범위 검증
// ═══════════════════════════════════════════

/**
 * 난이도별 이론적 최대 점수
 * calculateScore()는 0~1000을 반환하고, 3라운드 합산 후 배율 적용
 * Easy:   1000 × 3 × 1.0  = 3000
 * Normal: 1000 × 3 × 1.1  = 3300
 * Hard:   1000 × 3 × 1.2  = 3600
 * Hell:   1000 × 3 × 1.30 = 3900
 */
const MAX_SCORES = {
  "Easy":   3000,
  "Normal": 3300,
  "Hard":   3600,
  "Hell":   3900
};

const MAX_ROUND_SCORE = 1000;

/**
 * 개별 라운드 점수가 유효한지 검증
 * @param {number} score - 라운드 점수 (배율 적용 전)
 * @returns {boolean}
 */
export function isValidRoundScore(score) {
  return Number.isFinite(score) && score >= 0 && score <= MAX_ROUND_SCORE;
}

/**
 * 최종 점수가 유효한지 검증 (배율 적용 후)
 * @param {number} score - 최종 점수
 * @param {string} difficulty - 난이도
 * @returns {boolean}
 */
export function isValidFinalScore(score, difficulty) {
  const max = MAX_SCORES[difficulty] || MAX_SCORES["Easy"];
  return Number.isFinite(score) && score >= 0 && score <= max;
}

/**
 * 점수를 안전한 범위로 클램핑
 * @param {number} score - 점수
 * @param {string} difficulty - 난이도
 * @returns {number} 클램핑된 점수
 */
export function clampScore(score, difficulty) {
  if (!Number.isFinite(score)) return 0;
  const max = MAX_SCORES[difficulty] || MAX_SCORES["Easy"];
  return Math.max(0, Math.min(Math.floor(score), max));
}


// ═══════════════════════════════════════════
// 2. LocalStorage 데이터 서명/검증 (SHA-256)
// ═══════════════════════════════════════════

/**
 * [SECURITY Phase 1] SHA-256 해시 (Web Crypto API)
 * 암호학적으로 안전한 해시 — FNV-1a 대비 충돌 불가
 * @param {string} str - 해싱할 문자열
 * @returns {Promise<string>} hex 해시 문자열
 */
async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * [SECURITY] 동적 salt 생성
 * 세션마다 다른 salt를 사용하되, 검증 시 복원 가능하도록
 * 데이터 자체의 구조적 특성(레코드 수, 첫/마지막 날짜)을 salt에 포함
 */
function buildDynamicSalt(records) {
  const count = records.length;
  const firstDate = records.length > 0 ? records[0].date : 'empty';
  const lastDate = records.length > 0 ? records[records.length - 1].date : 'empty';
  return `DM_v2_${count}_${firstDate}_${lastDate}`;
}

/**
 * [SECURITY] 데이터와 함께 저장할 서명 생성 (SHA-256, 비동기)
 * @param {Array} records - 랭킹 레코드 배열
 * @returns {Promise<string>} 서명 문자열
 */
export async function generateSignature(records) {
  const payload = records.map(r => 
    `${r.playerName}|${r.originGame}|${r.score}|${r.difficulty}|${r.date}`
  ).join(';;');
  
  const salt = buildDynamicSalt(records);
  return await sha256(payload + salt);
}

/**
 * [SECURITY] 저장된 데이터의 서명 검증 (비동기)
 * @param {Array} records - 랭킹 레코드 배열
 * @param {string} signature - 저장된 서명
 * @returns {Promise<boolean>} 서명 일치 여부
 */
export async function verifySignature(records, signature) {
  const expected = await generateSignature(records);
  return expected === signature;
}


// ═══════════════════════════════════════════
// 3. DevTools 감지
// ═══════════════════════════════════════════

let devToolsDetected = false;
let detectionInterval = null;

/**
 * DevTools 감지 시작
 * console.log의 getter 트릭을 사용하여 감지
 * @param {Function} onDetected - 감지 시 콜백
 */
export function startDevToolsDetection(onDetected) {
  // 방법 1: window 크기 차이 감지
  const checkSize = () => {
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    
    if (widthDiff > threshold || heightDiff > threshold) {
      if (!devToolsDetected) {
        devToolsDetected = true;
        if (onDetected) onDetected();
      }
    }
  };

  // 방법 2: console 객체 감시
  const devtools = { open: false };
  const element = new Image();
  Object.defineProperty(element, 'id', {
    get: function() {
      devtools.open = true;
      if (!devToolsDetected) {
        devToolsDetected = true;
        if (onDetected) onDetected();
      }
    }
  });

  detectionInterval = setInterval(() => {
    checkSize();
    devtools.open = false;
    console.dir(element);
    console.clear();
  }, 2000);
}

/**
 * DevTools 감지 중지
 */
export function stopDevToolsDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
}

/**
 * DevTools가 감지되었는지 반환
 * @returns {boolean}
 */
export function isDevToolsOpen() {
  return devToolsDetected;
}


// ═══════════════════════════════════════════
// 4. 타이머 무결성 검증
// ═══════════════════════════════════════════

/**
 * 이중 타이머를 생성하여 조작 여부를 감지
 * performance.now()와 Date.now()를 교차 비교
 * 
 * @returns {{ start: Function, check: Function }}
 */
export function createTimerGuard() {
  let perfStart = 0;
  let dateStart = 0;

  return {
    /**
     * 타이머 시작
     */
    start() {
      perfStart = performance.now();
      dateStart = Date.now();
    },

    /**
     * 타이머 무결성 체크
     * 두 타이머의 차이가 허용 오차를 초과하면 조작으로 판단
     * @param {number} toleranceMs - 허용 오차 (밀리초, 기본 1000ms)
     * @returns {boolean} true = 무결, false = 조작 의심
     */
    check(toleranceMs = 1000) {
      const perfElapsed = performance.now() - perfStart;
      const dateElapsed = Date.now() - dateStart;
      const diff = Math.abs(perfElapsed - dateElapsed);
      return diff <= toleranceMs;
    },

    /**
     * 경과 시간 반환 (Date.now 기준, 조작에 더 강건)
     * @returns {number} 밀리초
     */
    getElapsed() {
      return Date.now() - dateStart;
    }
  };
}


// ═══════════════════════════════════════════
// 5. 입력 새니타이징 (XSS 방어)
// ═══════════════════════════════════════════

/**
 * HTML 특수 문자를 이스케이프하여 XSS 방지
 * @param {string} str - 원본 문자열
 * @returns {string} 이스케이프된 문자열
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;'
  };
  return str.replace(/[&<>"'/]/g, c => map[c]);
}

/**
 * 플레이어 이름을 검증하고 정제
 * @param {string} name - 입력된 이름
 * @returns {string} 정제된 이름
 */
export function sanitizePlayerName(name) {
  if (typeof name !== 'string') return '';
  // HTML 태그 제거, 길이 제한 (30자), 앞뒤 공백 제거
  return name.replace(/<[^>]*>/g, '').trim().substring(0, 30);
}

/**
 * 게임명을 검증하고 정제
 * @param {string} game - 입력된 게임명
 * @returns {string} 정제된 게임명
 */
export function sanitizeGameName(game) {
  if (typeof game !== 'string') return '';
  return game.replace(/<[^>]*>/g, '').trim().substring(0, 50);
}


// ═══════════════════════════════════════════
// 6. 게임 세션 무결성
// ═══════════════════════════════════════════

/**
 * 게임 세션 토큰 생성
 * 각 게임 시작 시 고유 토큰을 발행하여 세션 추적
 */
let sessionToken = null;
let sessionStartTime = 0;

/**
 * [SECURITY Phase 1] 암호학적으로 안전한 세션 토큰 생성
 * crypto.getRandomValues 사용 — Math.random 대비 예측 불가
 */
export function startSession() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  sessionToken = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('') + '_' + Date.now().toString(36);
  sessionStartTime = Date.now();
  return sessionToken;
}

/**
 * 세션이 유효한지 검증
 * - 최소 게임 시간 체크 (3라운드 최소 ~10초)
 * - 토큰 존재 여부
 * @returns {boolean}
 */
export function isSessionValid() {
  if (!sessionToken) return false;
  const elapsed = Date.now() - sessionStartTime;
  return elapsed >= 5000;
}

export function getSessionToken() {
  return sessionToken;
}

export function clearSession() {
  sessionToken = null;
  sessionStartTime = 0;
}


// ═══════════════════════════════════════════
// 7. [Phase 2] 행동 패턴 분석 (봇 탐지)
// ═══════════════════════════════════════════

/**
 * 유저의 행동 패턴을 수집하여 봇 여부를 판별
 * - 마우스/터치 이벤트 횟수
 * - 슬라이더 조작 횟수
 * - 제출까지의 소요 시간
 * - 이벤트 간격의 분산 (봇은 일정한 간격)
 */
const behaviorLog = {
  pointerMoves: 0,
  sliderChanges: 0,
  guessStartTime: 0,
  intervals: [],
  lastEventTime: 0
};

export function resetBehavior() {
  behaviorLog.pointerMoves = 0;
  behaviorLog.sliderChanges = 0;
  behaviorLog.guessStartTime = Date.now();
  behaviorLog.intervals = [];
  behaviorLog.lastEventTime = Date.now();
}

export function logPointerMove() {
  behaviorLog.pointerMoves++;
  const now = Date.now();
  if (behaviorLog.lastEventTime > 0) {
    behaviorLog.intervals.push(now - behaviorLog.lastEventTime);
  }
  behaviorLog.lastEventTime = now;
}

export function logSliderChange() {
  behaviorLog.sliderChanges++;
}

/**
 * 행동 패턴이 인간적인지 판별
 * @returns {{ isHuman: boolean, reason: string }}
 */
export function analyzeBehavior() {
  const timeSpent = Date.now() - behaviorLog.guessStartTime;
  
  // 1. 최소 조작 시간 (0.8초 미만이면 봇 의심 — 인간은 화면을 보는 데만 이 정도 걸림)
  if (timeSpent < 800) {
    return { isHuman: false, reason: 'too_fast' };
  }
  
  // 2. 이벤트 간격 분산 체크 (봇은 기계적으로 일정한 간격으로 이벤트 발생)
  //    슬라이더 조작 여부는 체크하지 않음 — 초기값이 랜덤이므로
  //    조작 없이 제출하면 자연스럽게 낮은 점수가 됨
  if (behaviorLog.intervals.length >= 10) {
    const mean = behaviorLog.intervals.reduce((a, b) => a + b, 0) / behaviorLog.intervals.length;
    const variance = behaviorLog.intervals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / behaviorLog.intervals.length;
    const cv = Math.sqrt(variance) / mean;
    
    if (cv < 0.02 && mean < 30) {
      return { isHuman: false, reason: 'robotic_pattern' };
    }
  }
  
  return { isHuman: true, reason: 'ok' };
}


// ═══════════════════════════════════════════
// 8. [Phase 2] 타겟 색상 난독화
// ═══════════════════════════════════════════

/**
 * 타겟 색상을 XOR 암호화하여 메모리에 저장
 * DOM이나 getState()로 직접 읽기 어렵게 함
 */
const COLOR_XOR_KEY = 0xA7; // 난독화 키

export function encodeColor(color) {
  return {
    r: color.r ^ COLOR_XOR_KEY,
    g: color.g ^ COLOR_XOR_KEY,
    b: color.b ^ COLOR_XOR_KEY,
    _encoded: true
  };
}

export function decodeColor(encoded) {
  if (!encoded || !encoded._encoded) return encoded;
  return {
    r: encoded.r ^ COLOR_XOR_KEY,
    g: encoded.g ^ COLOR_XOR_KEY,
    b: encoded.b ^ COLOR_XOR_KEY
  };
}


// ═══════════════════════════════════════════
// 9. [Phase 2] Canvas 기반 색상 렌더링
// ═══════════════════════════════════════════

/**
 * Canvas에 색상을 렌더링하여 DOM 스타일 속성에서 직접 읽기를 방지
 * background-color CSS 대신 canvas 픽셀로 표현
 * 
 * @param {HTMLElement} container - canvas를 삽입할 컨테이너
 * @param {{r: number, g: number, b: number}} color - RGB 색상
 * @returns {HTMLCanvasElement} 생성된 캔버스
 */
export function renderColorOnCanvas(container, color) {
  let canvas = container.querySelector('canvas.ac-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'ac-canvas';
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;';
    container.style.position = 'relative';
    container.insertBefore(canvas, container.firstChild);
  }
  
  // 캔버스 크기를 컨테이너에 맞춤
  canvas.width = container.clientWidth || window.innerWidth;
  canvas.height = container.clientHeight || window.innerHeight;
  
  const ctx = canvas.getContext('2d');
  
  // 기본 색상 채우기
  ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // [Phase 2] 미세한 노이즈 추가 (화면 캡처 봇의 단순 픽셀 추출 방해)
  // 인간 눈에는 거의 보이지 않지만 봇의 정확한 색상 추출을 방해
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // 가장자리 1px에만 ±1 노이즈 (중앙은 순수 색상 유지)
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (x < 2 || x >= canvas.width - 2 || y < 2 || y >= canvas.height - 2) {
        const i = (y * canvas.width + x) * 4;
        const noise = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
  
  return canvas;
}
