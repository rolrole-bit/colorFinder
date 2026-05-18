/**
 * AntiCheat 모듈 v2.1 (리팩토링 후)
 * 클라이언트 사이드 치트 방지 유틸리티
 * 
 * 활성 기능:
 * - 점수 범위 검증 (난이도별 상한/하한)
 * - DevTools 감지
 * - 게임 세션 무결성
 * - 입력 새니타이징 (XSS 방어)
 * - 행동 패턴 분석 (봇 탐지)
 * 
 * 제거된 기능 (서버 전환으로 불필요):
 * - LocalStorage 서명/검증 → 서버 DB로 전환
 * - 색상 난독화/Canvas 렌더링 → 서버가 타겟 관리
 * - 타이머 가드 → 서버가 타이밍 검증
 */

// ═══════════════════════════════════════════
// 1. 점수 범위 검증
// ═══════════════════════════════════════════

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
// 2. DevTools 감지
// ═══════════════════════════════════════════

let devToolsDetected = false;
let detectionInterval = null;

/**
 * DevTools 감지 시작
 * @param {Function} onDetected - 감지 시 콜백
 */
export function startDevToolsDetection(onDetected) {
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


// ═══════════════════════════════════════════
// 3. 입력 새니타이징 (XSS 방어)
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


// ═══════════════════════════════════════════
// 4. 게임 세션 무결성
// ═══════════════════════════════════════════

let sessionToken = null;
let sessionStartTime = 0;

/**
 * 암호학적으로 안전한 세션 토큰 생성
 */
export function startSession() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  sessionToken = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('') + '_' + Date.now().toString(36);
  sessionStartTime = Date.now();
  return sessionToken;
}

/**
 * 세션이 유효한지 검증 (최소 게임 시간 체크)
 * @returns {boolean}
 */
export function isSessionValid() {
  if (!sessionToken) return false;
  const elapsed = Date.now() - sessionStartTime;
  return elapsed >= 5000;
}

export function clearSession() {
  sessionToken = null;
  sessionStartTime = 0;
}


// ═══════════════════════════════════════════
// 5. 행동 패턴 분석 (봇 탐지)
// ═══════════════════════════════════════════

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
  
  if (timeSpent < 800) {
    return { isHuman: false, reason: 'too_fast' };
  }
  
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
