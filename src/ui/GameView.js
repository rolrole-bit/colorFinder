/**
 * GameView - 게임 플레이 화면 (기억하기 → 추측 → 제출)
 * 
 * 담당: 타겟 색상 기억 → HSL 슬라이더 조작 → 서버 점수 제출
 */

import { getRandomColor, calculateScore, toRGBString, hslToRgb, rgbToHsl, rgbToHex } from '../utils/ColorUtils.js';
import { getState, setTargetColor, setUserColor, setScore, setPhase, getDifficultyTime, addRoundResult } from '../core/GameState.js';
import { submitRound } from '../core/ServerAPI.js';
import { CustomVerticalSlider } from './CustomSlider.js';
import { playGoSound, playSubmitSound, playSliderTickSound } from '../utils/SoundUtils.js';
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

    const isFirstRound = state.currentRound === 1;
    const getTutSvg = (idx) => isFirstRound ? `
      <svg id="tut-svg-${idx}" class="tutorial-svg-item" viewBox="0 0 160 160" fill="none" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(0deg); width: 130%; height: 130%; pointer-events: none; z-index: 10; opacity: 0;">
        <path d="M 80 15 A 65 65 0 0 1 145 80" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 8"/>
        <path d="M 132 70 L 145 80 L 158 70" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 80 145 A 65 65 0 0 1 15 80" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 8"/>
        <path d="M 2 90 L 15 80 L 28 90" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    ` : '';

    const targetHslObj = rgbToHsl(state.targetColor.r, state.targetColor.g, state.targetColor.b);
    const tH = targetHslObj.h;
    const tS = targetHslObj.s;
    const tL = targetHslObj.l;
    
    const hueOffset = 60 + Math.floor(Math.random() * 240);
    const endH = (tH + hueOffset) % 360;
    
    const sOffset = 20 + Math.floor(Math.random() * 35);
    const sDir = Math.random() > 0.5 ? 1 : -1;
    const endS = Math.max(15, Math.min(85, tS + sOffset * sDir));
    
    const lOffset = 20 + Math.floor(Math.random() * 35);
    const lDir = Math.random() > 0.5 ? 1 : -1;
    const endL = Math.max(15, Math.min(85, tL + lOffset * lDir));

    let currentH = tH;
    let currentS = tS;
    let currentL = tL;
    
    const initHsl = `hsl(${currentH}, ${currentS}%, ${currentL}%)`;
    
    container.innerHTML = `
      <div id="round-text" style="position: absolute; top: 1.2vh; left: 5vw; font-family: 'Paperlogy', sans-serif; font-size: 0.85rem; color: #fff; backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); padding: 0.3rem 0.6rem; border-radius: 4px; font-weight: 800; letter-spacing: 1px; z-index: 100;">
        ROUND ${state.currentRound} / ${state.maxRounds}
      </div>
      <div class="animated-gradient-bg"></div>
      <div id="game-box" class="game-box-container" style="grid-template-columns: 1fr;">
        <div id="guess-bg" class="split-bg" style="background-color: ${initHsl};"></div>
        
        <!-- 중앙 다이얼 제어 패널 (가로 폭 50%, 모바일 대응) -->
        <div class="slider-panel-wrapper">
          <!-- 블러 오버레이 추가 -->
          <div class="slider-panel-blur"></div>
          
          <div class="dials-container">
            <!-- H 다이얼 (색상) -->
            <div class="dial-wrapper" id="dial-h-wrapper">
              <div style="position: relative; width: 100%; display: flex; justify-content: center;">
                <div class="dial-knob" id="dial-h">
                  <div class="dial-wheel" id="dial-wheel-h"></div>
                </div>
                ${getTutSvg(0)}
              </div>
              <div class="dial-indicator-arrow">▲</div>
              <div class="dial-value" id="dial-h-value"></div>
            </div>
            
            <!-- S 다이얼 (채도) -->
            <div class="dial-wrapper" id="dial-s-wrapper">
              <div style="position: relative; width: 100%; display: flex; justify-content: center;">
                <div class="dial-knob" id="dial-s">
                  <div class="dial-wheel" id="dial-wheel-s"></div>
                </div>
                ${getTutSvg(1)}
              </div>
              <div class="dial-indicator-arrow">▲</div>
              <div class="dial-value" id="dial-s-value"></div>
            </div>
            
            <!-- B 다이얼 (명도) -->
            <div class="dial-wrapper" id="dial-b-wrapper">
              <div style="position: relative; width: 100%; display: flex; justify-content: center;">
                <div class="dial-knob" id="dial-b">
                  <div class="dial-wheel" id="dial-wheel-b"></div>
                </div>
                ${getTutSvg(2)}
              </div>
              <div class="dial-indicator-arrow">▲</div>
              <div class="dial-value" id="dial-b-value"></div>
            </div>
          </div>
        </div>
        
        <button id="submit-btn" class="submit-minimal-btn">
          <span class="btn-main-text">DYE IT</span>
          <span class="btn-sub-text" id="submit-btn-sub">#000000</span>
        </button>
      </div>
    `;

    const guessBg = document.getElementById('guess-bg');
    const submitBtn = document.getElementById('submit-btn');
    
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

    let tutorialSequenceId = null;
    let tutorialActive = isFirstRound;

    function fadeTutorial() {
      if (!tutorialActive) return;
      tutorialActive = false;
      if (tutorialSequenceId) clearTimeout(tutorialSequenceId);
      for (let i = 0; i < 3; i++) {
        const svg = document.getElementById(`tut-svg-${i}`);
        if (svg) {
          svg.style.transition = 'opacity 0.3s';
          svg.style.opacity = '0';
        }
      }
    }

    if (isFirstRound) {
      let currentTut = 0;
      const nextTutStep = () => {
        if (!tutorialActive) return;
        
        for (let i = 0; i < 3; i++) {
          const svg = document.getElementById(`tut-svg-${i}`);
          if (svg) {
            svg.style.transition = 'none';
            svg.style.opacity = '0';
            svg.style.transform = 'translate(-50%, -50%) rotate(0deg)';
          }
        }
        
        const activeSvg = document.getElementById(`tut-svg-${currentTut}`);
        if (activeSvg) {
          activeSvg.style.opacity = '1';
          void activeSvg.offsetWidth; // force reflow
          activeSvg.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease 0.9s';
          activeSvg.style.transform = 'translate(-50%, -50%) rotate(360deg)';
          activeSvg.style.opacity = '0';
        }
        
        currentTut = (currentTut + 1) % 3;
        tutorialSequenceId = setTimeout(nextTutStep, 1400);
      };
      tutorialSequenceId = setTimeout(nextTutStep, 300);
      
      const dialsContainer = document.querySelector('.dials-container');
      if (dialsContainer) {
        dialsContainer.addEventListener('pointerdown', fadeTutorial, { capture: true, once: true });
      }
    }

    // 회전 다이얼 제어 클래스
    class RotaryDial {
      constructor({ wrapperEl, min, max, value, type, onChange }) {
        this.wrapperEl = wrapperEl;
        this.dialKnob = wrapperEl.querySelector('.dial-knob');
        this.valueDisplay = wrapperEl.querySelector('.dial-value');
        this.min = min;
        this.max = max;
        this.type = type;
        this.onChange = onChange;
        
        this.isDragging = false;
        this.centerX = 0;
        this.centerY = 0;
        this.lastPointerAngle = 0;
        
        this.rotation = - ((value - min) / (max - min) * 360);
        this.lastTickedValue = Math.round(value);
        
        this.updateTransform();
        this.dialKnob.addEventListener('pointerdown', this.onDown.bind(this));
        window.addEventListener('pointermove', this.onMove.bind(this), { passive: false });
        window.addEventListener('pointerup', this.onUp.bind(this));
      }
      
      getPointerAngle(clientX, clientY) {
        const dx = clientX - this.centerX;
        const dy = clientY - this.centerY;
        const rad = Math.atan2(dy, dx);
        const deg = rad * (180 / Math.PI);
        return (deg % 360 + 360) % 360;
      }
      
      updateTransform() {
        this.dialKnob.style.transform = `rotate(${this.rotation}deg)`;
        
        let pct;
        if (this.type !== 'H') {
          pct = -this.rotation / 360;
        } else {
          pct = ((-this.rotation % 360) + 360) % 360 / 360;
        }
        let val = this.min + pct * (this.max - this.min);
        
        const rounded = Math.round(val);
        // 텍스트 대신 동그란 색상으로 표시하기 위해 텍스트 업데이트 로직 제거
      }
      
      onDown(e) {
        fadeTutorial();
        stopShuffle();
        this.isDragging = true;
        this.dialKnob.setPointerCapture(e.pointerId);
        
        const rect = this.dialKnob.getBoundingClientRect();
        this.centerX = rect.left + rect.width / 2;
        this.centerY = rect.top + rect.height / 2;
        
        this.lastPointerAngle = this.getPointerAngle(e.clientX, e.clientY);
      }
      
      onMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        
        const pointerAngle = this.getPointerAngle(e.clientX, e.clientY);
        let delta = pointerAngle - this.lastPointerAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        
        this.rotation += delta;
        if (this.type !== 'H') {
          if (this.rotation > 0) this.rotation = 0;
          if (this.rotation < -360) this.rotation = -360;
        }
        this.lastPointerAngle = pointerAngle;
        
        let pct;
        if (this.type !== 'H') {
          pct = -this.rotation / 360;
        } else {
          pct = ((-this.rotation % 360) + 360) % 360 / 360;
        }
        let val = this.min + pct * (this.max - this.min);
        
        this.updateTransform();
        
        const roundedVal = Math.round(val);
        if (roundedVal !== this.lastTickedValue) {
          playSliderTickSound();
          this.lastTickedValue = roundedVal;
        }
        
        if (this.onChange) this.onChange(val);
      }
      
      onUp(e) {
        if (this.isDragging) {
          this.isDragging = false;
          this.dialKnob.releasePointerCapture(e.pointerId);
        }
      }
      
      setValue(val) {
        let valClamp = Math.max(this.min, Math.min(this.max, val));
        this.rotation = - ((valClamp - this.min) / (this.max - this.min) * 360);
        this.updateTransform();
      }
    }

    const updateColor = () => {
      const targetRGB = hslToRgb(currentH, currentS, currentL);
      setUserColor(targetRGB.r, targetRGB.g, targetRGB.b);
      
      const outerBg = document.querySelector('.animated-gradient-bg');
      if (outerBg) outerBg.style.animation = 'none';

      // 배경 및 그래픽 요소 즉각 업데이트
      const immediateRgbStr = `rgb(${targetRGB.r}, ${targetRGB.g}, ${targetRGB.b})`;
      const immediateContrast = getContrastYIQ(targetRGB.r, targetRGB.g, targetRGB.b);

      if (guessBg) guessBg.style.backgroundColor = immediateRgbStr;
      if (outerBg) outerBg.style.background = immediateRgbStr;
      
      const roundText = document.getElementById('round-text');
      if (roundText) roundText.style.color = immediateContrast;

      if (submitBtn) {
        // 컬러 코드 및 버튼 색상 0.5초(500ms) 서서히 롤링 연출
        const startRGB = { ...currentDisplayedRGB };
        const startTime = performance.now();
        const duration = 500; // 사용자 요구사항: 0.5초
        
        if (hexAnimFrame) cancelAnimationFrame(hexAnimFrame);
        
        const animate = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 3);
          
          currentDisplayedRGB.r = Math.round(startRGB.r + (targetRGB.r - startRGB.r) * easeOut);
          currentDisplayedRGB.g = Math.round(startRGB.g + (targetRGB.g - startRGB.g) * easeOut);
          currentDisplayedRGB.b = Math.round(startRGB.b + (targetRGB.b - startRGB.b) * easeOut);
          
          const subTextEl = submitBtn.querySelector('#submit-btn-sub');
          if (subTextEl) {
            subTextEl.textContent = rgbToHex(currentDisplayedRGB.r, currentDisplayedRGB.g, currentDisplayedRGB.b);
          }
          
          // 애니메이션 중에도 실시간 콘트라스트 보정 알고리즘 (0.5초 동안 매 프레임 보간된 컬러로 계산)
          const curInvertedR = 255 - currentDisplayedRGB.r;
          const curInvertedG = 255 - currentDisplayedRGB.g;
          const curInvertedB = 255 - currentDisplayedRGB.b;
          
          const curTextYiq = ((currentDisplayedRGB.r * 299) + (currentDisplayedRGB.g * 587) + (currentDisplayedRGB.b * 114)) / 1000;
          let curBgR, curBgG, curBgB;
          if (curTextYiq >= 128) {
            const factor = 0.35;
            curBgR = Math.round(curInvertedR * factor);
            curBgG = Math.round(curInvertedG * factor);
            curBgB = Math.round(curInvertedB * factor);
          } else {
            curBgR = Math.round(curInvertedR + (255 - curInvertedR) * 0.65);
            curBgG = Math.round(curInvertedG + (255 - curInvertedG) * 0.65);
            curBgB = Math.round(curInvertedB + (255 - curInvertedB) * 0.65);
          }
          
          submitBtn.style.backgroundColor = `rgb(${curBgR}, ${curBgG}, ${curBgB})`;
          submitBtn.style.color = `rgb(${currentDisplayedRGB.r}, ${currentDisplayedRGB.g}, ${currentDisplayedRGB.b})`;
          
          if (progress < 1) hexAnimFrame = requestAnimationFrame(animate);
        };
        hexAnimFrame = requestAnimationFrame(animate);
      }
      
      // 채도(S) 및 명도(B) 다이얼의 휠 그라데이션 동적 업데이트
      const sWheel = document.getElementById('dial-wheel-s');
      if (sWheel) {
        sWheel.style.background = `conic-gradient(from 180deg, hsl(${currentH}, 0%, 50%) 0%, hsl(${currentH}, 100%, 50%) 100%)`;
      }

      const bWheel = document.getElementById('dial-wheel-b');
      if (bWheel) {
        bWheel.style.background = `conic-gradient(from 180deg, #000000 0%, hsl(${currentH}, ${currentS}%, 50%) 50%, #ffffff 100%)`;
      }

      // 하단 다이얼 수치 뱃지를 컬러 서클로 표현 (소수점으로 인한 CSS 파싱 오류 방지를 위해 반올림)
      const hVal = document.getElementById('dial-h-value');
      if (hVal) hVal.style.background = `hsl(${Math.round(currentH)}, 100%, 50%)`;

      const sVal = document.getElementById('dial-s-value');
      if (sVal) sVal.style.background = `hsl(${Math.round(currentH)}, ${Math.round(currentS)}%, 50%)`;

      const bVal = document.getElementById('dial-b-value');
      if (bVal) bVal.style.background = `hsl(${Math.round(currentH)}, ${Math.round(currentS)}%, ${Math.round(currentL)}%)`;
    };

    const hueDial = new RotaryDial({
      wrapperEl: document.getElementById('dial-h-wrapper'),
      min: 0, max: 360, value: currentH, type: 'H',
      onChange: (val) => { currentH = val; updateColor(); logSliderChange(); }
    });
    
    const satDial = new RotaryDial({
      wrapperEl: document.getElementById('dial-s-wrapper'),
      min: 0, max: 100, value: currentS, type: 'S',
      onChange: (val) => { currentS = val; updateColor(); logSliderChange(); }
    });

    const lightDial = new RotaryDial({
      wrapperEl: document.getElementById('dial-b-wrapper'),
      min: 0, max: 100, value: currentL, type: 'B',
      onChange: (val) => { currentL = val; updateColor(); logSliderChange(); }
    });

    document.addEventListener('pointermove', logPointerMove);
    updateColor();

    const shuffleDuration = 1500;
    const shuffleStartTime = performance.now();

    function doShuffle(now) {
      const elapsed = now - shuffleStartTime;
      const progress = Math.min(elapsed / shuffleDuration, 1);

      if (progress >= 1 || !isMixing) {
        currentH = endH;
        currentS = endS;
        currentL = endL;

        hueDial.setValue(endH);
        satDial.setValue(endS);
        lightDial.setValue(endL);
        updateColor();

        stopShuffle();
        return;
      }

      // 힌트용 부드러운 순차 단방향 감속(Ease-Out) 애니메이션
      const calcEaseOut = (p, start, end) => {
        if (p <= start) return 0;
        if (p >= end) return 1;
        const normalized = (p - start) / (end - start);
        return 1 - Math.pow(1 - normalized, 3);
      };

      const progressH = calcEaseOut(progress, 0.0, 0.6);
      const progressS = calcEaseOut(progress, 0.2, 0.8);
      const progressL = calcEaseOut(progress, 0.4, 1.0);

      const hVal = tH + hueOffset * progressH;
      const sVal = tS + (endS - tS) * progressS;
      const lVal = tL + (endL - tL) * progressL;

      currentH = (Math.round(hVal) + 360) % 360;
      currentS = Math.round(sVal);
      currentL = Math.round(lVal);

      hueDial.setValue(currentH);
      satDial.setValue(currentS);
      lightDial.setValue(currentL);

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
      const panel = document.querySelector('.slider-panel-wrapper');
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
