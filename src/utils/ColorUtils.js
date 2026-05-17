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
 * 유클리디안 거리를 활용하여 두 RGB 색상 간의 정확도를 계산하고, 소요 시간을 반영하여 최종 점수를 반환합니다.
 * @param {{r: number, g: number, b: number}} target 
 * @param {{r: number, g: number, b: number}} user 
 * @param {number} timeTaken - 사용자가 추론하는 데 걸린 시간(초)
 * @returns {number} 0 ~ 100
 */
export function calculateAccuracy(target, user, timeTaken = 0) {
  const rDiff = Math.abs(target.r - user.r);
  const gDiff = Math.abs(target.g - user.g);
  const bDiff = Math.abs(target.b - user.b);
  
  const totalDiff = rDiff + gDiff + bDiff;
  const maxDiff = 255 * 3;
  
  let accuracy = ((maxDiff - totalDiff) / maxDiff) * 100;
  
  // 시간 패널티 적용: 5초 초과 시 1초당 0.5점 차감 (최대 15점)
  if (timeTaken > 5) {
    const penalty = Math.min((timeTaken - 5) * 0.5, 15);
    accuracy -= penalty;
  }
  
  // 너무 낮은 점수는 보정 (마이너스 방지)
  accuracy = Math.max(0, Math.min(100, accuracy));
  
  return Number(accuracy.toFixed(1));
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
