/**
 * GameView - 게임 플레이 화면 (기억하기 → 추측 → 제출)
 * 
 * 담당: 타겟 색상 기억 → HSL 슬라이더 조작 → 서버 점수 제출
 */

import { getRandomColor, calculateScore, toRGBString, hslToRgb, rgbToHsl, rgbToHex } from '../utils/ColorUtils.js';
import { getState, setTargetColor, setUserColor, setScore, setPhase, getDifficultyTime, addRoundResult } from '../core/GameState.js';
import { submitRound } from '../core/ServerAPI.js';
import { CustomVerticalSlider } from './CustomSlider.js';
import { playGoSound, playSubmitSound } from '../utils/SoundUtils.js';
import {
  isValidRoundScore,
  resetBehavior,
  logPointerMove,
  logSliderChange,
  analyzeBehavior
} from '../utils/AntiCheat.js';
import { getContrastYIQ } from './AnimationUtils.js';

/**
 * 게임 플레이 화면 렌더링
 * @param {HTMLElement} container - 렌더링 대상
 * @param {object} nav - 네비게이션 콜백
 * @param {function} nav.toResultView - 결과 화면으로 전환
 * @param {function} nav.getServerSessionId - 서버 세션 ID 조회
 * @param {function} nav.getServerNextTargetColor - 서버 타겟 색상 조회
 * @param {function} nav.setServerNextTargetColor - 서버 타겟 색상 설정
 */
export function renderGameView(container, nav) {
  // [Phase 2] 서버에서 받은 타겟 색상 사용, 폴백: 클라이언트 생성
  const targetColor = nav.getServerNextTargetColor() || getRandomColor();
  nav.setServerNextTargetColor(null);
  setTargetColor(targetColor);
  
  setPhase("MEMORIZE");
  const rgbString = toRGBString(targetColor);
  const contrastYIQ = getContrastYIQ(targetColor.r, targetColor.g, targetColor.b);
  const state = getState();
  
  container.innerHTML = `
    <div style="position: absolute; top: 1.2vh; left: 5vw; font-family: 'Paperlogy', sans-serif; font-size: 0.85rem; color: ${contrastYIQ}; backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); padding: 0.3rem 0.6rem; border-radius: 4px; font-weight: 800; letter-spacing: 1px; z-index: 100;">
      ROUND ${state.currentRound} / ${state.maxRounds}
    </div>
    <div class="full-screen-color" id="memorize-screen" style="background-color: ${rgbString}; display: flex; justify-content: center; align-items: center;">
      <div class="memorize-hint" style="color: ${contrastYIQ}">
        <span id="timer-text-display"></span>초동안<br/>이 컬러를 기억하세요
      </div>
    </div>
  `;
  
  playGoSound();
  
  const displayTime = getDifficultyTime(state.difficulty);
  const startTime = performance.now();
  const timerTextEl = document.getElementById('timer-text-display');
  timerTextEl.textContent = (displayTime / 1000).toFixed(1);

  const timerInterval = setInterval(() => {
    const elapsed = performance.now() - startTime;
    const remaining = Math.max(0, displayTime - elapsed);
    
    if (remaining <= 0) {
      clearInterval(timerInterval);
      transitionToGuess();
    } else {
      const timeText = (Math.ceil(remaining / 100) / 10).toFixed(1);
      timerTextEl.textContent = timeText;
    }
  }, 30);

  function transitionToGuess() {
    setPhase("GUESS");
    const state = getState();
    resetBehavior();
    
    const targetHslObj = rgbToHsl(state.targetColor.r, state.targetColor.g, state.targetColor.b);
    const tH = targetHslObj.h;
    const tS = targetHslObj.s;
    const tL = targetHslObj.l;
    
    const hueOffset = 60 + Math.floor(Math.random() * 240);
    let currentH = (tH + hueOffset) % 360;
    
    const sOffset = 20 + Math.floor(Math.random() * 35);
    const sDir = Math.random() > 0.5 ? 1 : -1;
    let currentS = Math.max(0, Math.min(100, tS + sOffset * sDir));
    
    const lOffset = 20 + Math.floor(Math.random() * 35);
    const lDir = Math.random() > 0.5 ? 1 : -1;
    let currentL = Math.max(0, Math.min(100, tL + lOffset * lDir));
    
    const initHsl = `hsl(${currentH}, ${currentS}%, ${currentL}%)`;
    
    container.innerHTML = `
      <div id="round-text" style="position: absolute; top: 1.2vh; left: 5vw; font-family: 'Paperlogy', sans-serif; font-size: 0.85rem; color: #fff; backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); padding: 0.3rem 0.6rem; border-radius: 4px; font-weight: 800; letter-spacing: 1px; z-index: 100;">
        ROUND ${state.currentRound} / ${state.maxRounds}
      </div>
      <div class="animated-gradient-bg"></div>
      <div id="game-box" class="game-box-container" style="grid-template-columns: 1fr;">
        <div id="guess-bg" class="split-bg" style="background-color: ${initHsl};"></div>
        
        <div style="position: absolute; top: 2rem; right: 2rem; display: flex; gap: 1rem; z-index: 10;">
          <div id="hex-display" style="font-family: 'Paperlogy', sans-serif; font-size: 2rem; font-weight: 300; letter-spacing: 3px; padding: 0.5rem 1rem; border-radius: 8px;">
            #000000
          </div>
        </div>
        
        <div class="vertical-sliders-container">
          <div class="custom-v-slider-wrapper" id="hue-wrapper">
            <div class="slider-bg" id="hue-bg"></div>
            <div class="slider-thumb" id="hue-thumb"></div>
            <div class="slider-touch-area"></div>
          </div>
          <div class="custom-v-slider-wrapper" id="sat-wrapper">
            <div class="slider-bg" id="sat-bg"></div>
            <div class="slider-thumb" id="sat-thumb"></div>
            <div class="slider-touch-area"></div>
          </div>
          <div class="custom-v-slider-wrapper" id="l-wrapper">
            <div class="slider-bg" id="l-bg"></div>
            <div class="slider-thumb" id="l-thumb"></div>
            <div class="slider-touch-area"></div>
          </div>
        </div>
        
        <button id="submit-btn" class="submit-minimal-btn">결정</button>
      </div>
    `;

    const guessBg = document.getElementById('guess-bg');
    const submitBtn = document.getElementById('submit-btn');
    const hueWrapper = document.getElementById('hue-wrapper');
    const satWrapper = document.getElementById('sat-wrapper');
    const lightWrapper = document.getElementById('l-wrapper');
    const hexDisplay = document.getElementById('hex-display');
    
    let currentDisplayedRGB = hslToRgb(currentH, currentS, currentL);
    let hexAnimFrame = null;
    let isGuessing = true;

    const updateColor = () => {
      const targetRGB = hslToRgb(currentH, currentS, currentL);
      setUserColor(targetRGB.r, targetRGB.g, targetRGB.b);
      
      const outerBg = document.querySelector('.animated-gradient-bg');
      if (outerBg) outerBg.style.animation = 'none';
      
      if (hexDisplay) {
        const startRGB = { ...currentDisplayedRGB };
        const startTime = performance.now();
        const duration = 1000;
        
        if (hexAnimFrame) cancelAnimationFrame(hexAnimFrame);
        
        const animate = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 3);
          
          currentDisplayedRGB.r = Math.round(startRGB.r + (targetRGB.r - startRGB.r) * easeOut);
          currentDisplayedRGB.g = Math.round(startRGB.g + (targetRGB.g - startRGB.g) * easeOut);
          currentDisplayedRGB.b = Math.round(startRGB.b + (targetRGB.b - startRGB.b) * easeOut);
          
          hexDisplay.textContent = rgbToHex(currentDisplayedRGB.r, currentDisplayedRGB.g, currentDisplayedRGB.b);
          
          const rgbStr = `rgb(${currentDisplayedRGB.r}, ${currentDisplayedRGB.g}, ${currentDisplayedRGB.b})`;
          const contrastBg = getContrastYIQ(currentDisplayedRGB.r, currentDisplayedRGB.g, currentDisplayedRGB.b);
          
          hexDisplay.style.color = rgbStr;
          hexDisplay.style.backgroundColor = contrastBg;
          
          if (submitBtn) {
            submitBtn.style.color = rgbStr;
            submitBtn.style.backgroundColor = contrastBg;
          }
          
          guessBg.style.backgroundColor = rgbStr;
          if (outerBg) outerBg.style.background = rgbStr;
          
          const roundText = document.getElementById('round-text');
          if (roundText) roundText.style.color = contrastBg;
          
          if (progress < 1) hexAnimFrame = requestAnimationFrame(animate);
        };
        hexAnimFrame = requestAnimationFrame(animate);
      } else {
        const rgbStr = `rgb(${targetRGB.r}, ${targetRGB.g}, ${targetRGB.b})`;
        const contrastBg = getContrastYIQ(targetRGB.r, targetRGB.g, targetRGB.b);
        
        guessBg.style.backgroundColor = rgbStr;
        if (outerBg) outerBg.style.background = rgbStr;
        if (hexDisplay) {
          hexDisplay.style.color = rgbStr;
          hexDisplay.style.backgroundColor = contrastBg;
        }
        if (submitBtn) {
          submitBtn.style.color = rgbStr;
          submitBtn.style.backgroundColor = contrastBg;
        }
      }
      
      satWrapper.style.background = `linear-gradient(to top, hsl(${currentH}, 0%, 50%) 0%, hsl(${currentH}, 100%, 50%) 100%)`;
      lightWrapper.style.background = `linear-gradient(to top, #000 0%, hsl(${currentH}, ${currentS}%, 50%) 50%, #fff 100%)`;
    };

    const hueSlider = new CustomVerticalSlider(hueWrapper, {
      min: 0, max: 360, value: currentH,
      onChange: (val) => { currentH = val; updateColor(); logSliderChange(); }
    });
    
    const satSlider = new CustomVerticalSlider(satWrapper, {
      min: 0, max: 100, value: currentS,
      onChange: (val) => { currentS = val; updateColor(); logSliderChange(); }
    });
    
    const lightSlider = new CustomVerticalSlider(lightWrapper, {
      min: 0, max: 100, value: currentL,
      onChange: (val) => { currentL = val; updateColor(); logSliderChange(); }
    });

    document.addEventListener('pointermove', logPointerMove);
    updateColor();

    submitBtn.addEventListener('click', async () => {
      playSubmitSound();
      isGuessing = false;
      document.removeEventListener('pointermove', logPointerMove);
      const behavior = analyzeBehavior();
      
      const state = getState();
      let roundScore = 0;
      const sessionId = nav.getServerSessionId();
      
      if (sessionId) {
        try {
          const result = await submitRound(sessionId, state.userColor);
          roundScore = result.score;
          
          if (result.nextTargetColor) {
            nav.setServerNextTargetColor(result.nextTargetColor);
          }
          
          if (result.isLastRound) {
            state._serverFinalScore = result.finalScore;
            state._serverMultiplier = result.multiplier;
          }
        } catch (err) {
          console.error('[Server] 라운드 제출 실패:', err);
          roundScore = Math.floor(calculateScore(state.targetColor, state.userColor));
        }
      } else {
        roundScore = Math.floor(calculateScore(state.targetColor, state.userColor));
      }
      
      if (!isValidRoundScore(roundScore)) roundScore = 0;
      if (!behavior.isHuman) roundScore = 0;
      
      addRoundResult(roundScore, state.targetColor, state.userColor);
      setScore(roundScore);
      
      const panel = document.querySelector('.vertical-sliders-container');
      const btn = document.getElementById('submit-btn');
      if (panel) panel.classList.add('fade-out');
      if (btn) btn.classList.add('fade-out');
      
      setTimeout(() => {
        nav.toResultView();
      }, 400);
    });
  }
}
