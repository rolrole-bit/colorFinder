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
 * RGB 값을 HSB(HSV)로 변환합니다.
 * @param {number} r (0-255)
 * @param {number} g (0-255)
 * @param {number} b (0-255)
 * @returns {{h: number, s: number, b: number}} h: 0-360, s: 0-100, b: 0-100
 */
export function rgbToHsv(r, g, b) {
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
 * 두 RGB 색상 간의 정확도를 HSB(HSV) 원뿔(Cone) 공간에서의 거리를 기반으로 점수를 계산합니다.
 * 인간의 시각적 인지에 훨씬 가까운 유사도 점수를 산출합니다.
 * 
 * @param {{r: number, g: number, b: number}} target - 목표 색상
 * @param {{r: number, g: number, b: number}} user - 유저가 선택한 색상
 * @returns {number} 0 ~ 1000 (정수)
 */
export function calculateScore(target, user) {
  const tHsv = rgbToHsv(target.r, target.g, target.b);
  const uHsv = rgbToHsv(user.r, user.g, user.b);
  
  // Normalize values to 0.0 ~ 1.0
  const h1 = tHsv.h / 360.0;
  const s1 = tHsv.s / 100.0;
  const v1 = tHsv.b / 100.0;
  
  const h2 = uHsv.h / 360.0;
  const s2 = uHsv.s / 100.0;
  const v2 = uHsv.b / 100.0;
  
  // Convert polar HSV coordinates to Cartesian coordinates in the HSV Cone
  // This inherently handles the fact that hue doesn't matter when saturation is 0,
  // and neither hue nor saturation matter when brightness is 0.
  const x1 = s1 * v1 * Math.cos(h1 * 2 * Math.PI);
  const y1 = s1 * v1 * Math.sin(h1 * 2 * Math.PI);
  const z1 = v1;
  
  const x2 = s2 * v2 * Math.cos(h2 * 2 * Math.PI);
  const y2 = s2 * v2 * Math.sin(h2 * 2 * Math.PI);
  const z2 = v2;
  
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dz = z1 - z2;
  
  // Calculate Euclidean distance
  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
  // Maximum possible distance in this cone is 2.0 (e.g., Red (1,0,1) to Cyan (-1,0,1))
  const maxDist = 2.0; 
  
  const accuracy = Math.max(0, (maxDist - dist) / maxDist); // 0.0 ~ 1.0
  
  // Apply a power curve to heavily penalize far colors and reward close matches
  // Power of 4 gives a very satisfying, realistic human-perception curve
  const baseScore = Math.pow(accuracy, 4) * 1000;
  
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
