/**
 * AnimationUtils - 공통 애니메이션 유틸리티
 * scrambleTypingEffect, animateValue, getContrastYIQ
 */

import { getContrastBlendColor } from '../utils/ColorUtils.js';
import { playScoreTickSound } from '../utils/SoundUtils.js';

/**
 * 배경 색상에 따른 HSL 기반 명도반전 컨트라스트 블렌딩 색상 반환
 * → 내부적으로 ColorUtils.getContrastBlendColor() 호출
 * → 튜닝은 ColorUtils.js 의 getContrastBlendColor 함수 내부 상수 조절
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} CSS hex color string
 */
export const getContrastYIQ = (r, g, b) => {
  return getContrastBlendColor(r, g, b);
};

/**
 * 스크램블 타이핑 효과
 * 랜덤 문자가 순차적으로 실제 텍스트로 치환되는 연출
 * @param {HTMLElement} element - 대상 엘리먼트
 * @param {string} text - 최종 표시할 텍스트
 * @param {number} duration - 애니메이션 지속 시간 (ms)
 */
export const scrambleTypingEffect = (element, text, duration = 1000) => {
  const chars = '가나다라마바사아자차카타파하ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
  const steps = 20;
  const stepTime = duration / steps;
  let currentStep = 0;
  
  const interval = setInterval(() => {
    let scrambled = '';
    const progress = currentStep / steps;
    
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ' ') {
        scrambled += ' ';
        continue;
      }
      if (progress > i / text.length) {
        scrambled += text[i];
      } else {
        scrambled += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    
    if (element) element.innerHTML = scrambled;
    currentStep++;
    
    if (currentStep > steps) {
      clearInterval(interval);
      if (element) element.innerHTML = text;
    }
  }, stepTime);
};

/**
 * 숫자 카운팅 애니메이션 (ease-out)
 * @param {HTMLElement} element - 대상 엘리먼트
 * @param {number} start - 시작 값
 * @param {number} end - 목표 값
 * @param {number} duration - 지속 시간 (ms)
 * @param {boolean} isInteger - 정수 표시 여부
 * @param {boolean} playSound - 틱 사운드 재생 여부
 * @returns {Promise} 애니메이션 완료 시 resolve
 */
export const animateValue = (element, start, end, duration, isInteger = false, playSound = false) => {
  return new Promise(resolve => {
    let startTimestamp = null;
    let lastTick = 0;
    const maxBlur = 3; // 각 레이어의 최대 블러 강도 (너무 크면 가독성이 떨어지므로 3px 권장)
    const maxOffset = 10; // 수직 슬라이딩 최대 오프셋 (px)
    
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress * (2 - progress); // ease-out quad
      const current = start + (end - start) * easeProgress;
      
      if (isInteger && progress < 1) {
        const currentVal = Math.floor(current);
        const nextVal = Math.min(Math.floor(end), currentVal + 1);
        const frac = current - currentVal;

        // 두 숫자의 포맷팅된 문자열
        const prevText = currentVal.toLocaleString();
        const nextText = nextVal.toLocaleString();

        // 진행 속도(감속도)에 비례한 블러 및 오프셋 강도
        const speedFactor = 1 - progress; // 후반부로 갈수록 블러와 오프셋 최소화
        
        const prevOpacity = 1 - frac;
        const nextOpacity = frac;
        
        const prevBlur = frac * maxBlur * speedFactor;
        const nextBlur = (1 - frac) * maxBlur * speedFactor;
        
        const prevTranslateY = -frac * maxOffset * speedFactor;
        const nextTranslateY = (1 - frac) * maxOffset * speedFactor;

        element.innerHTML = `
          <span style="position: relative; display: inline-block; vertical-align: top; width: 100%; height: 1.1em; overflow: visible;">
            <!-- 이전 숫자 레이어 (위로 슬라이드 아웃 + 페이드 아웃 + 블러) -->
            <span style="position: absolute; left: 0; top: 0; width: 100%; text-align: inherit; opacity: ${prevOpacity}; filter: blur(${prevBlur.toFixed(2)}px); transform: translateY(${prevTranslateY.toFixed(2)}px); transition: none; display: inline-block;">${prevText}</span>
            <!-- 너비 확보용 히든 레이어 -->
            <span style="visibility: hidden; display: inline-block; line-height: 1.1;">${nextText}</span>
            <!-- 다음 숫자 레이어 (아래에서 슬라이드 인 + 페이드 인 + 데블러) -->
            <span style="position: absolute; left: 0; top: 0; width: 100%; text-align: inherit; opacity: ${nextOpacity}; filter: blur(${nextBlur.toFixed(2)}px); transform: translateY(${nextTranslateY.toFixed(2)}px); transition: none; display: inline-block;">${nextText}</span>
          </span>
        `;
      } else {
        // 소수점이거나 애니메이션이 완전히 끝났을 때
        element.innerHTML = isInteger ? Math.floor(current).toLocaleString() : current.toFixed(1);
        if (element) {
          element.style.filter = 'none';
        }
      }
      
      if (playSound && timestamp - lastTick > 40) {
        playScoreTickSound(progress);
        lastTick = timestamp;
      }
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        element.innerHTML = isInteger ? Math.floor(end).toLocaleString() : end.toFixed(1);
        if (element) {
          element.style.filter = 'none';
        }
        resolve();
      }
    };
    window.requestAnimationFrame(step);
  });
};
