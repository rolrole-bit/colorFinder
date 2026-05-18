/**
 * 서버사이드 점수 계산 모듈
 * ColorUtils.js의 calculateScore를 서버로 이식
 * 
 * 클라이언트에서는 점수를 계산하지 않고, 서버가 직접 계산하여 변조를 원천 차단
 */

const DIFFICULTY_MULTIPLIER = {
  "Easy": 1.0,
  "Normal": 1.1,
  "Hard": 1.2
};

const DIFFICULTY_TIME = {
  "Easy": 5000,
  "Normal": 2000,
  "Hard": 500
};

/**
 * RGB → HSV 변환
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {{h: number, s: number, b: number}}
 */
function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  let s = (max === 0 ? 0 : d / max);
  let v = max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    b: Math.round(v * 100)
  };
}

/**
 * 두 RGB 색상 간의 정확도 점수 계산 (HSV Cone 기반)
 * @param {{r: number, g: number, b: number}} target
 * @param {{r: number, g: number, b: number}} user
 * @returns {number} 0 ~ 1000
 */
export function calculateScore(target, user) {
  const tHsv = rgbToHsv(target.r, target.g, target.b);
  const uHsv = rgbToHsv(user.r, user.g, user.b);

  const h1 = tHsv.h / 360.0;
  const s1 = tHsv.s / 100.0;
  const v1 = tHsv.b / 100.0;

  const h2 = uHsv.h / 360.0;
  const s2 = uHsv.s / 100.0;
  const v2 = uHsv.b / 100.0;

  const x1 = s1 * v1 * Math.cos(h1 * 2 * Math.PI);
  const y1 = s1 * v1 * Math.sin(h1 * 2 * Math.PI);
  const z1 = v1;

  const x2 = s2 * v2 * Math.cos(h2 * 2 * Math.PI);
  const y2 = s2 * v2 * Math.sin(h2 * 2 * Math.PI);
  const z2 = v2;

  const dx = x1 - x2;
  const dy = y1 - y2;
  const dz = z1 - z2;

  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const maxDist = 2.0;

  const accuracy = Math.max(0, (maxDist - dist) / maxDist);
  const baseScore = Math.pow(accuracy, 4) * 1000;

  return Math.floor(Math.max(0, Math.min(1000, baseScore)));
}

/**
 * 난이도 배율 반환
 * @param {string} difficulty
 * @returns {number}
 */
export function getDifficultyMultiplier(difficulty) {
  if (difficulty === "Hell") {
    return parseFloat((Math.random() * 0.05 + 1.25).toFixed(2));
  }
  return DIFFICULTY_MULTIPLIER[difficulty] || 1.0;
}

/**
 * 난이도별 기억 시간(ms) 반환
 * @param {string} difficulty
 * @returns {number}
 */
export function getDifficultyTime(difficulty) {
  if (difficulty === "Hell") {
    return Math.floor(Math.random() * 100) + 200;
  }
  return DIFFICULTY_TIME[difficulty] || 2000;
}

/**
 * 랜덤 RGB 색상 생성
 * @returns {{r: number, g: number, b: number}}
 */
export function getRandomColor() {
  return {
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256)
  };
}
