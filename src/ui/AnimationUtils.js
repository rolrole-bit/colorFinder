/**
 * AnimationUtils - 공통 애니메이션 유틸리티
 * scrambleTypingEffect, animateValue, getContrastYIQ
 */

import { playScoreTickSound } from '../utils/SoundUtils.js';

/**
 * 배경 밝기에 따라 검정/흰색 대비색 반환
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} '#000000' 또는 '#FFFFFF'
 */
export const getContrastYIQ = (r, g, b) => {
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#FFFFFF';
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
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress * (2 - progress); // ease-out quad
      const current = start + (end - start) * easeProgress;
      element.innerHTML = isInteger ? Math.floor(current).toLocaleString() : current.toFixed(1);
      
      if (playSound && timestamp - lastTick > 40) {
        playScoreTickSound(progress);
        lastTick = timestamp;
      }
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        element.innerHTML = isInteger ? Math.floor(end).toLocaleString() : end.toFixed(1);
        resolve();
      }
    };
    window.requestAnimationFrame(step);
  });
};
