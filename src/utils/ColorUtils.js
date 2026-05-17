/**
 * ColorUtils
 * 색상 생성 및 색상 간 유사도 측정 (정확도 계산)을 담당하는 유틸리티
 */

/**
 * 랜덤한 RGB 색상을 생성하여 반환합니다.
 * @returns {{r: number, g: number, b: number}}
 */
export function getRandomColor() {
  return {
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256),
  };
}

/**
 * 두 RGB 색상 간의 정확도를 기반으로 점수를 계산합니다.
 * 공식: accuracy² × 1000 (난이도 배율 적용 전 기본 점수)
 * 
 * @param {{r: number, g: number, b: number}} target - 목표 색상
 * @param {{r: number, g: number, b: number}} user - 유저가 선택한 색상
 * @returns {number} 0 ~ 1000 (정수)
 * 
 * 내부 동작:
 *   1. RGB 각 채널 차이의 절대값 합산 (deltaE: 0~765)
 *   2. 정확도 비율 계산 (accuracy: 0.0~1.0)
 *   3. 제곱하여 고정밀 매칭에 큰 보상 부여
 *   4. 1000을 곱해 최종 기본 점수 산출
 */
export function calculateScore(target, user) {
  const rDiff = Math.abs(target.r - user.r);
  const gDiff = Math.abs(target.g - user.g);
  const bDiff = Math.abs(target.b - user.b);
  
  const totalDiff = rDiff + gDiff + bDiff;
  const maxDiff = 255 * 3; // 765
  
  const accuracy = (maxDiff - totalDiff) / maxDiff; // 0.0 ~ 1.0
  const baseScore = Math.pow(accuracy, 2) * 1000;
  
  return Math.floor(Math.max(0, Math.min(1000, baseScore)));
}

/**
 * Returns #000 or #fff depending on the luminance of the given RGB color.
 */
export function getContrastColor(r, g, b) {
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

/**
 * RGB 객체를 CSS rgb() 문자열로 변환합니다.
 * @param {{r: number, g: number, b: number}} color 
 * @returns {string} css color string
 */
export function toRGBString(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/**
 * RGB 값을 HEX 코드로 변환합니다.
 */
export function rgbToHex(r, g, b) {
  return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

/**
 * HSL 값을 RGB로 변환합니다.
 * @param {number} h 색상 (0-360)
 * @param {number} s 채도 (0-100)
 * @param {number} l 명도 (0-100)
 * @returns {{r: number, g: number, b: number}}
 */
export function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4))
  };
}

/**
 * RGB 값을 HSL로 변환합니다.
 * @param {number} r (0-255)
 * @param {number} g (0-255)
 * @param {number} b (0-255)
 * @returns {{h: number, s: number, l: number}}
 */
export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
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
