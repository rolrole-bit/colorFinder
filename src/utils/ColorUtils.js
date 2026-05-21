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
 * ═══════════════════════════════════════════════════════════════
 *  HSL 기반 명도반전 컨트라스트 블렌딩 (Contrast Blend Color)
 * ═══════════════════════════════════════════════════════════════
 * 
 *  배경색 RGB → HSL 변환 후:
 *    H (색상) : +180° 보색 반전
 *    S (채도) : 100 - S 반전
 *    L (명도) : 100 - L 반전, 단 데드존(붉은 영역)에 진입하면
 *               가장 가까운 바깥으로 밀어냄
 * 
 *  ┌─────────────────────── L 축 (0~100) ───────────────────────┐
 *  │  ██████████  ░░░░░░░░░░░░░░░░░░░░░░░░░░░  ██████████████  │
 *  │  안전(어둡)   ▲ DEAD_ZONE_LOW  DEAD_ZONE_HIGH ▲  안전(밝음)  │
 *  │              └── 이 구간에 L이 들어오면 밖으로 밀어냄 ──┘       │
 *  └────────────────────────────────────────────────────────────┘
 * 
 * ★ 튜닝 가이드 (직접 수정할 수 있는 파라미터들):
 *   - DEAD_ZONE_LOW  : 데드존 하한 (기본 25). 높이면 더 많은 중간톤을 밀어냄
 *   - DEAD_ZONE_HIGH : 데드존 상한 (기본 75). 낮추면 더 많은 중간톤을 밀어냄
 *   - PUSH_MARGIN    : 데드존 바깥으로 밀어내는 추가 여유값 (기본 10)
 *   - MIN_SATURATION : 결과 채도 최소값 (기본 20). 높이면 더 선명한 색상
 * 
 * @param {number} r - 배경 Red (0-255)
 * @param {number} g - 배경 Green (0-255)
 * @param {number} b - 배경 Blue (0-255)
 * @returns {string} CSS hex color string (예: '#FF00AA')
 */
export function getContrastBlendColor(r, g, b) {
  // ═══ ★ 여기서 수치를 직접 조절하세요 ★ ═══
  const LIGHT_THRESHOLD = 15;  // 밝은 배경 → 텍스트 명도 상한 (0에 가까울수록 어두움)
  const DARK_THRESHOLD  = 90;  // 어두운 배경 → 텍스트 명도 하한 (100에 가까울수록 밝음)
  const MIN_SATURATION  = 10;  // 결과 색상의 최소 채도 (0~100)
  // ═══════════════════════════════════════════

  const bg = rgbToHsl(r, g, b);

  // H: 보색 반전 (+180도)
  const newH = (bg.h + 180) % 360;

  // S: 반전 + 최소 채도 보장
  const newS = Math.max(MIN_SATURATION, 100 - bg.s);

  // 배경의 실제 시각적 밝기(Perceived Luminance) 계산
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  const isDark = yiq < 140;

  // L: 배경 밝기에 따라 강제 방향 결정
  let newL;
  if (isDark) {
    newL = DARK_THRESHOLD;   // 어두운 배경 → 밝은 글자 (반전)
  } else {
    newL = LIGHT_THRESHOLD;  // 밝은 배경 → 어두운 글자 (반전)
  }

  // 최종 클램프 (0~100)
  newL = Math.max(0, Math.min(100, newL));

  const result = hslToRgb(newH, newS, newL);
  return rgbToHex(result.r, result.g, result.b);
}

/**
 * Returns #000 or #fff depending on the luminance of the given RGB color.
 * (레거시 호환용 — 새로운 코드에서는 getContrastBlendColor 사용 권장)
 */
export function getContrastColor(r, g, b) {
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

/**
 * 두 RGB 색상의 평균색을 구합니다.
 * @param {{r,g,b}} c1
 * @param {{r,g,b}} c2
 * @returns {{r: number, g: number, b: number}}
 */
export function getAverageColor(c1, c2) {
  return {
    r: Math.round((c1.r + c2.r) / 2),
    g: Math.round((c1.g + c2.g) / 2),
    b: Math.round((c1.b + c2.b) / 2)
  };
}

/**
 * 배경 RGB에 따른 버튼 스타일 반환 (텍스트, 테두리, 유리 배경)
 * backdrop-filter 위에서는 mix-blend-mode가 작동하지 않으므로
 * JS에서 직접 계산하여 인라인 스타일로 적용
 * 
 * @param {{r,g,b}} bgColor - 버튼 뒤쪽의 평균 배경색
 * @returns {{textColor: string, borderColor: string, glassBg: string}}
 */
export function getButtonContrastStyle(bgColor) {
  const yiq = ((bgColor.r * 299) + (bgColor.g * 587) + (bgColor.b * 114)) / 1000;
  const isDark = yiq < 140;

  return {
    textColor: isDark ? '#ffffff' : '#000000',
    borderColor: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.35)',
    glassBg: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
    hoverBg: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)'
  };
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
