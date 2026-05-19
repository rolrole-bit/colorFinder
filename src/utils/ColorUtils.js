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
 * RGB → CIE Lab 변환 (sRGB 감마 보정, D65 백색점)
 * @param {number} r (0-255)
 * @param {number} g (0-255)
 * @param {number} b (0-255)
 * @returns {{L: number, a: number, b: number}}
 */
export function rgbToLab(r, g, b) {
  let rl = r / 255, gl = g / 255, bl = b / 255;
  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;

  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.00000;
  let z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;

  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
  return {
    L: 116 * f(y) - 16,
    a: 500 * (f(x) - f(y)),
    b: 200 * (f(y) - f(z))
  };
}

/**
 * 두 RGB 색상 간의 정확도를 CIE76 ΔE* 기반으로 점수를 계산합니다.
 * 인간의 시각적 인지와 일치하는 색차 공식을 사용합니다.
 * 
 * @param {{r: number, g: number, b: number}} target - 목표 색상
 * @param {{r: number, g: number, b: number}} user - 유저가 선택한 색상
 * @returns {number} 0 ~ 1000 (정수)
 */
export function calculateScore(target, user) {
  const lab1 = rgbToLab(target.r, target.g, target.b);
  const lab2 = rgbToLab(user.r, user.g, user.b);

  const deltaE = Math.sqrt(
    Math.pow(lab1.L - lab2.L, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );

  const maxDelta = 100;
  const accuracy = Math.max(0, (maxDelta - deltaE) / maxDelta);
  const baseScore = Math.pow(accuracy, 2.5) * 1000;

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
