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
 * RGB → CIE XYZ → CIE Lab 변환
 * sRGB 감마 보정 포함, D65 기준 백색점
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {{L: number, a: number, b: number}}
 */
function rgbToLab(r, g, b) {
  // sRGB → Linear RGB
  let rl = r / 255, gl = g / 255, bl = b / 255;
  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;

  // Linear RGB → XYZ (D65)
  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.00000;
  let z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;

  // XYZ → Lab
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

/**
 * RGB → HSL 변환
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {{h: number, s: number, l: number}} h: 0-360, s: 0-100, l: 0-100
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
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
    l: Math.round(l * 100)
  };
}

/**
 * 두 RGB 색상 간의 정확도를 HSL 가중치 기반으로 점수를 계산합니다.
 * 
 * 가중치: 색상(H) 60%, 채도(S) 20%, 명도(L) 20%
 *   - H(색상): 원형 거리 사용 (0~360°, 최대 차이 180°)
 *   - S(채도): 절대 차이 (0~100)
 *   - L(명도): 절대 차이 (0~100)
 *   - score = round(1000 × (1 - (0.6×hDiff + 0.2×sDiff + 0.2×lDiff)))
 *   - 완전 일치 → 1000점, 최대 차이 → 0점
 * 
 * @param {{r: number, g: number, b: number}} target - 목표 색상
 * @param {{r: number, g: number, b: number}} user - 유저가 선택한 색상
 * @returns {number} 0 ~ 1000 (정수)
 */
export function calculateScore(target, user) {
  const tHsl = rgbToHsl(target.r, target.g, target.b);
  const uHsl = rgbToHsl(user.r, user.g, user.b);

  // H: 원형 거리 (0~180 → 0~1 정규화)
  let hDiff = Math.abs(tHsl.h - uHsl.h);
  if (hDiff > 180) hDiff = 360 - hDiff;
  const hNorm = hDiff / 180;

  // S: 절대 차이 (0~100 → 0~1 정규화)
  const sNorm = Math.abs(tHsl.s - uHsl.s) / 100;

  // L: 절대 차이 (0~100 → 0~1 정규화)
  const lNorm = Math.abs(tHsl.l - uHsl.l) / 100;

  // 가중 합산: H 60%, S 20%, L 20%
  const weightedDiff = 0.6 * hNorm + 0.2 * sNorm + 0.2 * lNorm;

  const score = Math.round(1000 * (1 - weightedDiff));
  return Math.max(0, Math.min(1000, score));
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
 * HSL → RGB 변환
 * @param {number} h 0~1
 * @param {number} s 0~1
 * @param {number} l 0~1
 * @returns {{r: number, g: number, b: number}}
 */
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l; // 무채색
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * 랜덤 RGB 색상 생성 (전체 컬러 범위 무작위)
 * @returns {{r: number, g: number, b: number}}
 */
export function getRandomColor() {
  return {
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256)
  };
}
