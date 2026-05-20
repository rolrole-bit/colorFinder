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
    let currentS = Math.max(15, Math.min(85, tS + sOffset * sDir));
    
    const lOffset = 20 + Math.floor(Math.random() * 35);
    const lDir = Math.random() > 0.5 ? 1 : -1;
    let currentL = Math.max(15, Math.min(85, tL + lOffset * lDir));
    
    const initHsl = `hsl(${currentH}, ${currentS}%, ${currentL}%)`;
    
    container.innerHTML = `
      <div id="round-text" style="position: absolute; top: 1.2vh; left: 5vw; font-family: 'Paperlogy', sans-serif; font-size: 0.85rem; color: #fff; backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); padding: 0.3rem 0.6rem; border-radius: 4px; font-weight: 800; letter-spacing: 1px; z-index: 100;">
        ROUND ${state.currentRound} / ${state.maxRounds}
      </div>
      <div class="animated-gradient-bg"></div>
      <div id="game-box" class="game-box-container" style="grid-template-columns: 1fr;">
        <div id="guess-bg" class="split-bg" style="background-color: ${initHsl};"></div>
        <!-- 블러 오버레이 추가 -->
        <div style="position: absolute; inset: 0; backdrop-filter: blur(80px); background: rgba(255,255,255,0.05); z-index: 5;"></div>
        
        <div style="position: absolute; top: 2rem; right: 2rem; display: flex; gap: 1rem; z-index: 20;">
          <div id="hex-display" style="font-family: 'Paperlogy', sans-serif; font-size: 2rem; font-weight: 300; letter-spacing: 3px; padding: 0.5rem 1rem; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            #000000
          </div>
        </div>
        
        <div id="svg-sliders-container" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 10; pointer-events: none;">
          <svg id="sliders-svg" width="100%" height="100%" style="pointer-events: auto; touch-action: none;">
            <defs>
              <filter id="track-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="80" />
              </filter>
              <!-- Top to Bottom Gradients -->
              <linearGradient id="grad-h" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ff0000" />
                <stop offset="17%" stop-color="#ff00ff" />
                <stop offset="33%" stop-color="#0000ff" />
                <stop offset="50%" stop-color="#00ffff" />
                <stop offset="67%" stop-color="#00ff00" />
                <stop offset="83%" stop-color="#ffff00" />
                <stop offset="100%" stop-color="#ff0000" />
              </linearGradient>
              <linearGradient id="grad-s" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ff0000" id="sat-stop-1" />
                <stop offset="100%" stop-color="#808080" id="sat-stop-0" />
              </linearGradient>
              <linearGradient id="grad-l" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="50%" stop-color="#ff0000" id="light-stop-mid" />
                <stop offset="100%" stop-color="#000000" />
              </linearGradient>
            </defs>

            <!-- Scrollable Tapes -->
            <g id="tapes-group" filter="url(#track-blur)" opacity="0.9">
              <g id="tape-h">
                <rect x="0" y="-1500" width="33.34%" height="1500" fill="url(#grad-h)" />
                <rect x="0" y="0" width="33.34%" height="1500" fill="url(#grad-h)" />
                <rect x="0" y="1500" width="33.34%" height="1500" fill="url(#grad-h)" />
              </g>
              <g id="tape-s">
                <rect x="33.33%" y="-3000" width="33.34%" height="3000" id="sat-fill-top" />
                <rect x="33.33%" y="0" width="33.34%" height="1500" fill="url(#grad-s)" />
                <rect x="33.33%" y="1500" width="33.34%" height="3000" fill="#808080" />
              </g>
              <g id="tape-l">
                <rect x="66.66%" y="-3000" width="33.34%" height="3000" fill="#ffffff" />
                <rect x="66.66%" y="0" width="33.34%" height="1500" fill="url(#grad-l)" />
                <rect x="66.66%" y="1500" width="33.34%" height="3000" fill="#000000" />
              </g>
            </g>

            <!-- Center Picking Line -->
            <line id="center-line" x1="0" y1="50%" x2="100%" y2="50%" stroke="#fff" stroke-width="8" style="pointer-events: none;" />

            <!-- Invisible Touch Areas -->
            <rect id="touch-h" x="0%" y="0" width="33.33%" height="100%" fill="transparent" style="cursor: grab;" />
            <rect id="touch-s" x="33.33%" y="0" width="33.34%" height="100%" fill="transparent" style="cursor: grab;" />
            <rect id="touch-l" x="66.66%" y="0" width="33.34%" height="100%" fill="transparent" style="cursor: grab;" />
          </svg>
        </div>
        
        <button id="submit-btn" class="submit-minimal-btn">DONE</button>
      </div>
    `;

    const guessBg = document.getElementById('guess-bg');
    const submitBtn = document.getElementById('submit-btn');
    const hexDisplay = document.getElementById('hex-display');
    
    // SVG Paths Initialization
    const svgContainer = document.getElementById('svg-sliders-container');
    
    let currentDisplayedRGB = hslToRgb(currentH, currentS, currentL);
    let hexAnimFrame = null;
    let isGuessing = true;

    let isMixing = true;
    let shuffleFrameId = null;

    function stopShuffle() {
      if (isMixing) {
        isMixing = false;
        if (shuffleFrameId) {
          cancelAnimationFrame(shuffleFrameId);
          shuffleFrameId = null;
        }
      }
    }

    class TapeSlider {
      constructor({ min, max, value, tapeGroup, touchArea, onChange }) {
        this.min = min;
        this.max = max;
        this.value = value;
        this.tapeGroup = tapeGroup;
        this.touchArea = touchArea;
        this.onChange = onChange;
        this.trackLen = 1500;
        this.svgContainer = document.getElementById('svg-sliders-container');
        this.isDragging = false;
        this.lastY = 0;
        this.updateTransform();
        this.touchArea.addEventListener('pointerdown', this.onDown.bind(this));
        window.addEventListener('pointermove', this.onMove.bind(this), {passive: false});
        window.addEventListener('pointerup', this.onUp.bind(this));
      }
      updateTransform() {
        let v = (this.value - this.min) / (this.max - this.min);
        const cy = this.svgContainer.clientHeight / 2;
        const ty = cy - (1 - v) * this.trackLen;
        this.tapeGroup.setAttribute('transform', `translate(0, ${ty})`);
      }
      onDown(e) {
        stopShuffle();
        this.isDragging = true;
        this.lastY = e.clientY;
        this.touchArea.setPointerCapture(e.pointerId);
      }
      onMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        const dy = e.clientY - this.lastY;
        this.lastY = e.clientY;
        let dv = dy / this.trackLen;
        let v = (this.value - this.min) / (this.max - this.min);
        v += dv;
        if (this.max === 360) {
          v = v - Math.floor(v);
        } else {
          v = Math.max(0, Math.min(1, v));
        }
        this.value = this.min + v * (this.max - this.min);
        this.updateTransform();
        if (this.onChange) this.onChange(this.value);
      }
      onUp(e) {
        if (this.isDragging) {
          this.isDragging = false;
          this.touchArea.releasePointerCapture(e.pointerId);
        }
      }
    }

    const updateColor = () => {
      const targetRGB = hslToRgb(currentH, currentS, currentL);
      setUserColor(targetRGB.r, targetRGB.g, targetRGB.b);
      
      const outerBg = document.querySelector('.animated-gradient-bg');
      if (outerBg) outerBg.style.animation = 'none';
      
      if (hexDisplay) {
        const startRGB = { ...currentDisplayedRGB };
        const startTime = performance.now();
        const duration = 250;
        
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
          
          hexDisplay.style.color = contrastBg;
          hexDisplay.style.backgroundColor = rgbStr;
          
          if (submitBtn) {
            submitBtn.style.color = contrastBg;
            submitBtn.style.backgroundColor = rgbStr;
          }
          
          guessBg.style.backgroundColor = rgbStr;
          if (outerBg) outerBg.style.background = rgbStr;
          
          const centerLine = document.getElementById('center-line');
          if (centerLine) centerLine.setAttribute('stroke', rgbStr);
          
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
          hexDisplay.style.color = contrastBg;
          hexDisplay.style.backgroundColor = rgbStr;
        }
        if (submitBtn) {
          submitBtn.style.color = contrastBg;
          submitBtn.style.backgroundColor = rgbStr;
        }
        
        const centerLine = document.getElementById('center-line');
        if (centerLine) centerLine.setAttribute('stroke', rgbStr);
      }
      
      const satFillTop = document.getElementById('sat-fill-top');
      if (satFillTop) satFillTop.setAttribute('fill', `hsl(${currentH}, 100%, 50%)`);
      const satStop0 = document.getElementById('sat-stop-0');
      const satStop1 = document.getElementById('sat-stop-1');
      if (satStop0) satStop0.setAttribute('stop-color', `hsl(${currentH}, 0%, 50%)`);
      if (satStop1) satStop1.setAttribute('stop-color', `hsl(${currentH}, 100%, 50%)`);
      
      const lightStopMid = document.getElementById('light-stop-mid');
      if (lightStopMid) lightStopMid.setAttribute('stop-color', `hsl(${currentH}, ${currentS}%, 50%)`);
    };

    const hueSlider = new TapeSlider({
      min: 0, max: 360, value: currentH,
      tapeGroup: document.getElementById('tape-h'),
      touchArea: document.getElementById('touch-h'),
      onChange: (val) => { currentH = val; updateColor(); logSliderChange(); }
    });
    
    const satSlider = new TapeSlider({
      min: 0, max: 100, value: currentS,
      tapeGroup: document.getElementById('tape-s'),
      touchArea: document.getElementById('touch-s'),
      onChange: (val) => { currentS = val; updateColor(); logSliderChange(); }
    });
    
    const lightSlider = new TapeSlider({
      min: 0, max: 100, value: currentL,
      tapeGroup: document.getElementById('tape-l'),
      touchArea: document.getElementById('touch-l'),
      onChange: (val) => { currentL = val; updateColor(); logSliderChange(); }
    });

    document.addEventListener('pointermove', logPointerMove);
    updateColor();

    const shuffleDuration = 500;
    const shuffleStartTime = performance.now();

    function doShuffle(now) {
      const elapsed = now - shuffleStartTime;
      if (elapsed >= shuffleDuration || !isMixing) {
        stopShuffle();
        return;
      }

      hueSlider.value = Math.floor(Math.random() * 360);
      satSlider.value = Math.floor(Math.random() * 100);
      lightSlider.value = Math.floor(Math.random() * 100);

      currentH = hueSlider.value;
      currentS = satSlider.value;
      currentL = lightSlider.value;

      hueSlider.updateTransform();
      satSlider.updateTransform();
      lightSlider.updateTransform();

      updateColor();

      shuffleFrameId = requestAnimationFrame(doShuffle);
    }

    shuffleFrameId = requestAnimationFrame(doShuffle);

    submitBtn.addEventListener('click', async () => {
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      
      playSubmitSound();
      isGuessing = false;
      document.removeEventListener('pointermove', logPointerMove);
      const behavior = analyzeBehavior();
      
      // 페이드 아웃 즉시 시작
      const panel = document.querySelector('.vertical-sliders-container');
      const btn = document.getElementById('submit-btn');
      if (panel) panel.classList.add('fade-out');
      if (btn) btn.classList.add('fade-out');
      
      // API 호출과 페이드를 동시 실행
      const state = getState();
      const sessionId = nav.getServerSessionId();
      
      const apiPromise = (async () => {
        let roundScore = 0;
        if (sessionId) {
          try {
            const result = await submitRound(sessionId, state.userColor);
            roundScore = result.score;
            if (result.nextTargetColor) nav.setServerNextTargetColor(result.nextTargetColor);
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
        return roundScore;
      })();
      
      const fadePromise = new Promise(resolve => setTimeout(resolve, 300));
      
      const [roundScore] = await Promise.all([apiPromise, fadePromise]);
      
      addRoundResult(roundScore, state.targetColor, state.userColor);
      setScore(roundScore);
      nav.toResultView();
    });
  }
}
