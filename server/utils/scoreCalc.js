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
 * 두 RGB 색상 간의 정확도 점수 계산 (CIE76 ΔE* 기반)
 * 인간 시각 인지와 일치하는 색차 공식 사용
 * @param {{r: number, g: number, b: number}} target
 * @param {{r: number, g: number, b: number}} user
 * @returns {number} 0 ~ 1000
 */
export function calculateScore(target, user) {
  const lab1 = rgbToLab(target.r, target.g, target.b);
  const lab2 = rgbToLab(user.r, user.g, user.b);

  // CIE76 색차 (ΔE*)
  const deltaE = Math.sqrt(
    Math.pow(lab1.L - lab2.L, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );

  // ΔE=0 → 1000점, ΔE≥100 → 0점
  // ΔE<2.3은 인간이 거의 구별 못하는 수준 (≈950점+)
  const maxDelta = 100;
  const accuracy = Math.max(0, (maxDelta - deltaE) / maxDelta);
  const baseScore = Math.pow(accuracy, 2.5) * 1000;

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
