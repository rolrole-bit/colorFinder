import { MMO_GAMES } from '../utils/Constants.js';
import { getRandomColor, calculateAccuracy, toRGBString, hslToRgb, rgbToHex, getContrastColor } from '../utils/ColorUtils.js';
import { getState, setPlayerInfo, setTargetColor, setUserColor, setScore, resetGame, setDifficulty, setPhase, DIFFICULTY_TIME, setTimeTaken, addRoundResult, nextRound } from '../core/GameState.js';
import { saveRecord, getGameRankings, getPlayerRankings } from '../core/Ranking.js';
import { CustomVerticalSlider } from './CustomSlider.js';

// Helper to calculate best contrast (Black or White) based on background luminance
const getContrastYIQ = (r, g, b) => {
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#FFFFFF';
};

const scrambleTypingEffect = (element, text, duration = 1000) => {
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

export function initUI() {
  const app = document.getElementById('app');
  renderEntryView(app);
}

function renderEntryView(container) {
  const gameRanks = getGameRankings();
  const playerRanks = getPlayerRankings();

  let gameRanksHTML = gameRanks.map((r, i) => `
    <li class="rank-item" style="color: #fff; border-color: rgba(255,255,255,0.2);">
      <span class="rank-num" style="color: #fff;">${i + 1}</span>
      <span class="rank-name">${r.game}</span>
      <span class="rank-score" style="color: #fff;">${r.score}%</span>
    </li>
  `).join('');

  if (gameRanks.length === 0) gameRanksHTML = '<li class="rank-item" style="color: #fff;">기록이 없습니다.</li>';

  let playerRanksHTML = playerRanks.map((r, i) => `
    <li class="rank-item" style="color: #fff; border-color: rgba(255,255,255,0.2);">
      <span class="rank-num" style="color: #fff;">${i + 1}</span>
      <span class="rank-name">[${r.originGame}] ${r.playerName}</span>
      <span class="rank-score" style="color: #fff;">${r.score}%</span>
    </li>
  `).join('');

  if (playerRanks.length === 0) playerRanksHTML = '<li class="rank-item" style="color: #fff;">기록이 없습니다.</li>';

  container.innerHTML = `
    <div class="animated-gradient-bg" id="entry-bg" style="position: fixed;"></div>
    
      <div class="magazine-entry" id="entry-panel" style="min-height: 100vh;">
        <h1 class="magazine-title">DYE<br/>MASTER</h1>
        
        <div class="entry-form">
          <div class="form-group dropdown-container" style="position: relative;">
            <span class="diff-label">어느게임 출신이세요?</span>
            <input type="text" id="origin-game" class="minimal-input" placeholder="게임을 검색하거나 선택하세요" autocomplete="off" />
            <div class="dropdown-list hidden" id="game-dropdown" style="width: 100%;"></div>
          </div>
          <div class="form-group">
            <span class="diff-label">당신의 이름은?</span>
            <input type="text" id="player-name" class="minimal-input" placeholder="닉네임을 입력하세요" autocomplete="off" />
          </div>
          <div class="form-group difficulty-group">
            <span class="diff-label">난이도 (기억 시간)</span>
            <div class="radio-group clean" style="mix-blend-mode: difference; color: #fff;">
              <label><input type="radio" name="difficulty" value="Easy"> 쉬움 (5초)</label>
              <label><input type="radio" name="difficulty" value="Normal" checked> 보통 (3초)</label>
              <label><input type="radio" name="difficulty" value="Hard"> 어려움 (1초)</label>
            </div>
          </div>
          <button class="btn magazine-start-btn" id="start-btn" disabled>START</button>
        </div>
      </div>
  `;

  const playerNameInput = document.getElementById('player-name');
  const originGameInput = document.getElementById('origin-game');
  const gameDropdown = document.getElementById('game-dropdown');
  const startBtn = document.getElementById('start-btn');

  const validate = () => {
    startBtn.disabled = !(playerNameInput.value.trim() !== "" && originGameInput.value.trim() !== "");
  };

  playerNameInput.addEventListener('input', validate);
  
  originGameInput.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    gameDropdown.innerHTML = '';
    
    if (val === '') {
      gameDropdown.classList.add('hidden');
      validate();
      return;
    }

    const filtered = MMO_GAMES.filter(g => g.toLowerCase().includes(val));
    
    filtered.push("기타 (직접 입력)");

    filtered.forEach(g => {
      const div = document.createElement('div');
      div.className = 'dropdown-item';
      div.textContent = g;
      div.addEventListener('click', () => {
        if (g === "기타 (직접 입력)") {
          originGameInput.value = "";
          originGameInput.placeholder = "출신 게임을 직접 입력하세요";
          originGameInput.focus();
        } else {
          originGameInput.value = g;
        }
        gameDropdown.classList.add('hidden');
        validate();
      });
      gameDropdown.appendChild(div);
    });

    gameDropdown.classList.remove('hidden');
    validate();
  });

  originGameInput.addEventListener('focus', () => {
    if (originGameInput.value.trim() === '') {
      gameDropdown.innerHTML = '';
      const list = [...MMO_GAMES, "기타 (직접 입력)"];
      list.forEach(g => {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.textContent = g;
        div.addEventListener('click', () => {
          if (g === "기타 (직접 입력)") {
            originGameInput.value = "";
            originGameInput.placeholder = "출신 게임을 직접 입력하세요";
            originGameInput.focus();
          } else {
            originGameInput.value = g;
          }
          gameDropdown.classList.add('hidden');
          validate();
        });
        gameDropdown.appendChild(div);
      });
      gameDropdown.classList.remove('hidden');
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-container')) {
      gameDropdown.classList.add('hidden');
    }
  });

  startBtn.addEventListener('click', () => {
    const selectedDifficulty = document.querySelector('input[name="difficulty"]:checked').value;
    setPlayerInfo(playerNameInput.value.trim(), originGameInput.value.trim());
    setDifficulty(selectedDifficulty);
    
    const panel = document.getElementById('entry-panel');
    panel.classList.add('fade-out');
    
    setTimeout(() => {
      container.innerHTML = `
        <div class="animated-gradient-bg"></div>
        <div id="intro-text" style="width: 100vw; height: 100vh; display: flex; justify-content: center; align-items: center; color: #000; font-family: 'Paperlogy', sans-serif; font-weight: 800; font-size: clamp(3rem, 10vh, 10vw); line-height: 0.9; letter-spacing: -0.02em; text-align: center; margin-top: -10vh;">
        </div>
      `;
      
      const introText = document.getElementById('intro-text');
      if (introText) {
        scrambleTypingEffect(introText, '준비하시고', 1000);
      }
      
      setTimeout(() => {
        if (introText) {
          scrambleTypingEffect(introText, '선수 입장!', 1000);
        }
        
        setTimeout(() => {
          renderGameView(container);
        }, 2000);
      }, 2000);
    }, 400);
  });
}

function renderGameView(container) {
  const targetColor = getRandomColor();
  setTargetColor(targetColor);
  
  setPhase("MEMORIZE");
  const rgbString = toRGBString(targetColor);
  
  const targetRGB = hslToRgb(targetColor.h, targetColor.s, targetColor.l);
  const contrastYIQ = getContrastYIQ(targetRGB.r, targetRGB.g, targetRGB.b);
  
  const state = getState();
  
  container.innerHTML = `
    <div style="position: absolute; top: 2rem; left: 2.5rem; font-size: 1.5rem; color: #fff; background-color: rgba(0,0,0,0.5); padding: 0.5rem 1rem; border-radius: 8px; font-weight: 300; letter-spacing: 2px; z-index: 100;">
      ROUND ${state.currentRound} / ${state.maxRounds}
    </div>
    <div class="full-screen-color" id="memorize-screen" style="background-color: ${rgbString}; display: flex; justify-content: center; align-items: center;">
      <div class="memorize-hint" style="color: ${contrastYIQ}">
        <span id="timer-text-display"></span>초동안<br/>이 컬러를 기억하세요
      </div>
    </div>
  `;
  
  const displayTime = DIFFICULTY_TIME[state.difficulty];
  let remaining = displayTime;
  const timerTextEl = document.getElementById('timer-text-display');
  const initialText = (remaining / 1000).toFixed(1);
  timerTextEl.textContent = initialText;

  const timerInterval = setInterval(() => {
    remaining -= 100;
    if (remaining <= 0) {
      clearInterval(timerInterval);
      transitionToGuess();
    } else {
      const timeText = (remaining / 1000).toFixed(1);
      timerTextEl.textContent = timeText;
    }
  }, 100);

  function transitionToGuess() {
    setPhase("GUESS");
    const state = getState();
    const targetHsl = `hsl(${state.targetColor.h}, ${state.targetColor.s}%, ${state.targetColor.l}%)`;
    
    container.innerHTML = `
      <div class="animated-gradient-bg"></div>
      <div id="game-box" class="game-box-container">
        <div id="target-bg" class="split-bg" style="background-color: ${targetHsl};"></div>
        <div id="guess-bg" class="split-bg" style="background-color: hsl(180, 50%, 50%);"></div>
        
        <div style="position: absolute; top: 1.5rem; left: 0; right: 0; padding: 0 clamp(1rem, 5vw, 2.5rem); display: flex; justify-content: space-between; align-items: flex-start; z-index: 100; pointer-events: none;">
          <div style="font-size: clamp(1rem, 3vw, 1.5rem); color: #fff; background-color: rgba(0,0,0,0.5); padding: 0.5rem 1rem; border-radius: 8px; font-weight: 300; letter-spacing: 2px;">
            ROUND ${state.currentRound} / ${state.maxRounds}
          </div>
          
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
            <div id="timer-display" style="background-color: rgba(0,0,0,0.5); font-family: 'Paperlogy', sans-serif; font-size: clamp(1.2rem, 4vw, 2rem); font-weight: 300; letter-spacing: 3px; padding: 0.5rem 1rem; border-radius: 8px; color: #fff;">
              0.0s
            </div>
            <div id="hex-display" style="background-color: rgba(0,0,0,0.5); font-family: 'Paperlogy', sans-serif; font-size: clamp(1.2rem, 4vw, 2rem); font-weight: 300; letter-spacing: 3px; padding: 0.5rem 1rem; border-radius: 8px; color: #fff;">
              #000000
            </div>
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
        
        <button id="submit-btn" class="submit-minimal-btn">SEND</button>
      </div>
    `;

    const guessBg = document.getElementById('guess-bg');
    const submitBtn = document.getElementById('submit-btn');
    const hueWrapper = document.getElementById('hue-wrapper');
    const satWrapper = document.getElementById('sat-wrapper');
    const lightWrapper = document.getElementById('l-wrapper');
    const hexDisplay = document.getElementById('hex-display');
    const timerDisplay = document.getElementById('timer-display');
    
    let currentDisplayedRGB = hslToRgb(180, 50, 50);
    let hexAnimFrame = null;
    
    let currentH = 180;
    let currentS = 50;
    let currentL = 50;
    
    const guessStartTime = performance.now();
    let isGuessing = true;
    
    const updateGameTimer = () => {
      if (!isGuessing) return;
      const now = performance.now();
      const elapsed = (now - guessStartTime) / 1000;
      if (timerDisplay) {
        timerDisplay.textContent = elapsed.toFixed(1) + 's';
      }
      requestAnimationFrame(updateGameTimer);
    };
    requestAnimationFrame(updateGameTimer);

    const updateColor = () => {
      const targetRGB = hslToRgb(currentH, currentS, currentL);
      setUserColor(targetRGB.r, targetRGB.g, targetRGB.b);
      
      const outerBg = document.querySelector('.animated-gradient-bg');
      if (outerBg) {
        outerBg.style.animation = 'none';
      }
      
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
          
          const rgbString = `rgb(${currentDisplayedRGB.r}, ${currentDisplayedRGB.g}, ${currentDisplayedRGB.b})`;
          const contrastBg = getContrastYIQ(currentDisplayedRGB.r, currentDisplayedRGB.g, currentDisplayedRGB.b);
          
          hexDisplay.style.color = rgbString;
          hexDisplay.style.backgroundColor = contrastBg;
          
          if (timerDisplay) {
            timerDisplay.style.color = rgbString;
            timerDisplay.style.backgroundColor = contrastBg;
          }
          
          if (submitBtn) {
            submitBtn.style.color = rgbString;
            submitBtn.style.backgroundColor = contrastBg;
          }
          
          guessBg.style.backgroundColor = rgbString;
          if (outerBg) {
            outerBg.style.background = rgbString;
          }
          
          if (progress < 1) {
            hexAnimFrame = requestAnimationFrame(animate);
          }
        };
        hexAnimFrame = requestAnimationFrame(animate);
      } else {
        const rgbString = `rgb(${targetRGB.r}, ${targetRGB.g}, ${targetRGB.b})`;
        const contrastBg = getContrastYIQ(targetRGB.r, targetRGB.g, targetRGB.b);
        
        guessBg.style.backgroundColor = rgbString;
        if (outerBg) {
          outerBg.style.background = rgbString;
        }
        if (hexDisplay) {
          hexDisplay.style.color = rgbString;
          hexDisplay.style.backgroundColor = contrastBg;
        }
        if (timerDisplay) {
          timerDisplay.style.color = rgbString;
          timerDisplay.style.backgroundColor = contrastBg;
        }
        if (submitBtn) {
          submitBtn.style.color = rgbString;
          submitBtn.style.backgroundColor = contrastBg;
        }
      }
      
      const direction = window.innerWidth <= 768 ? 'to right' : 'to top';
      satWrapper.style.background = `linear-gradient(${direction}, hsl(${currentH}, 0%, 50%) 0%, hsl(${currentH}, 100%, 50%) 100%)`;
      lightWrapper.style.background = `linear-gradient(${direction}, #000 0%, hsl(${currentH}, ${currentS}%, 50%) 50%, #fff 100%)`;
    };

    // Initialize custom sliders
    const hueSlider = new CustomVerticalSlider(hueWrapper, {
      min: 0, max: 360, value: 180,
      onChange: (val) => { currentH = val; updateColor(); }
    });
    
    const satSlider = new CustomVerticalSlider(satWrapper, {
      min: 0, max: 100, value: 50,
      onChange: (val) => { currentS = val; updateColor(); }
    });
    
    const lightSlider = new CustomVerticalSlider(lightWrapper, {
      min: 0, max: 100, value: 50,
      onChange: (val) => { currentL = val; updateColor(); }
    });

    // trigger initial color sync
    updateColor();

    submitBtn.addEventListener('click', () => {
      isGuessing = false;
      const elapsedSec = (performance.now() - guessStartTime) / 1000;
      setTimeTaken(elapsedSec);
      
      const state = getState();
      const accuracy = calculateAccuracy(state.targetColor, state.userColor, elapsedSec);
      
      addRoundResult(accuracy, elapsedSec);
      setScore(accuracy);
      
      const panel = document.querySelector('.vertical-sliders-container');
      const btn = document.getElementById('submit-btn');
      if (panel) panel.classList.add('fade-out');
      if (btn) btn.classList.add('fade-out');
      
      setTimeout(() => {
        renderInterimResultView(container);
      }, 400);
    });
  }
}

function renderInterimResultView(container) {
  const state = getState();
  const targetRGB = toRGBString(state.targetColor);
  const userRGB = toRGBString(state.userColor);
  const targetHex = rgbToHex(state.targetColor.r, state.targetColor.g, state.targetColor.b);
  const userHex = rgbToHex(state.userColor.r, state.userColor.g, state.userColor.b);
  
  const leftContrast = getContrastYIQ(state.targetColor.r, state.targetColor.g, state.targetColor.b);
  const rightContrast = getContrastYIQ(state.userColor.r, state.userColor.g, state.userColor.b);

  container.innerHTML = `
    <div class="split-screen-result" id="interim-panel">
      <!-- 50:50 분할 배경 -->
      <div class="split-screen-half" style="background-color: ${targetRGB};"></div>
      <div class="split-screen-half" style="background-color: ${userRGB};"></div>
      
      <!-- 매거진 오버레이 -->
      <div class="magazine-overlay">
        
        <!-- 상단 라운드 표시 (좌측 고정) -->
        <div style="display: flex; justify-content: flex-start; width: 100%; flex-shrink: 0; margin-bottom: auto;">
          <div style="font-size: clamp(1rem, 2vw, 1.5rem); color: #fff; background-color: rgba(0,0,0,0.5); padding: 0.5rem 1rem; border-radius: 8px; font-weight: 300; letter-spacing: 2px;">
            ROUND ${state.currentRound} / ${state.maxRounds}
          </div>
        </div>
        
        <!-- 중앙 영역: 헥스코드 + 스코어 -->
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="display: flex; gap: 4rem; margin-bottom: 1rem;">
            <div style="font-size: clamp(1rem, 3vw, 1.5rem); color: ${targetRGB}; background-color: ${leftContrast}; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 300; letter-spacing: 3px;">
              ${targetHex}
            </div>
            <div style="font-size: clamp(1rem, 3vw, 1.5rem); color: ${userRGB}; background-color: ${rightContrast}; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 300; letter-spacing: 3px;">
              ${userHex}
            </div>
          </div>
          
          <div class="magazine-score" style="background: linear-gradient(to right, ${leftContrast} 50%, ${rightContrast} 50%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            ${state.score}%
            <div style="font-size: 0.25em; font-weight: 300; opacity: 0.8; letter-spacing: 1px; margin-top: 0.5rem;">
              (${state.timeTaken.toFixed(1)}s)
            </div>
          </div>
        </div>
        
        <div style="margin-top: auto; text-align: center; width: 100%; max-width: 400px; z-index: 100; pointer-events: auto;">
          <button class="magazine-start-btn" id="next-round-btn" style="width: 100%;">${state.currentRound < state.maxRounds ? '다음 라운드' : '최종 결과'}</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('next-round-btn').addEventListener('click', () => {
    const panel = document.getElementById('interim-panel');
    panel.style.opacity = '0';
    panel.style.transition = 'opacity 0.4s ease';
    setTimeout(() => {
      if (state.currentRound < state.maxRounds) {
        nextRound();
        renderGameView(container);
      } else {
        let totalScore = 0;
        let totalTime = 0;
        state.roundResults.forEach(r => {
          totalScore += r.score;
          totalTime += r.timeTaken;
        });
        const avgScore = totalScore / state.maxRounds;
        const avgTime = totalTime / state.maxRounds;
        
        setScore(Math.round(avgScore * 10) / 10);
        setTimeTaken(Math.round(avgTime * 10) / 10);
        
        saveRecord(state.playerName, state.originGame, state.score);
        renderScoreBoardView(container);
      }
    }, 400);
  });
}

function renderScoreBoardView(container) {
  const state = getState();
  const gameRanks = getGameRankings();
  const playerRanks = getPlayerRankings();

  let gameRanksHTML = gameRanks.map((r, i) => `
    <li class="rank-item" style="color: #fff; border-color: rgba(255,255,255,0.2);">
      <span class="rank-num" style="color: #fff;">${i + 1}</span>
      <span class="rank-name">${r.game}</span>
      <span class="rank-score" style="color: #fff;">${r.score}%</span>
    </li>
  `).join('');

  if (gameRanks.length === 0) gameRanksHTML = '<li class="rank-item" style="color: #fff;">기록이 없습니다.</li>';

  let playerRanksHTML = playerRanks.map((r, i) => `
    <li class="rank-item" style="color: #fff; border-color: rgba(255,255,255,0.2);">
      <span class="rank-num" style="color: #fff;">${i + 1}</span>
      <span class="rank-name">[${r.originGame}] ${r.playerName}</span>
      <span class="rank-score" style="color: #fff;">${r.score}%</span>
    </li>
  `).join('');

  if (playerRanks.length === 0) playerRanksHTML = '<li class="rank-item" style="color: #fff;">기록이 없습니다.</li>';

  const targetRGB = toRGBString(state.targetColor);
  const userRGB = toRGBString(state.userColor);
  const targetHex = rgbToHex(state.targetColor.r, state.targetColor.g, state.targetColor.b);
  const userHex = rgbToHex(state.userColor.r, state.userColor.g, state.userColor.b);
  
  const leftContrast = getContrastYIQ(state.targetColor.r, state.targetColor.g, state.targetColor.b);
  const rightContrast = getContrastYIQ(state.userColor.r, state.userColor.g, state.userColor.b);

  let breakdownHTML = '';
  if (state.roundResults && state.roundResults.length > 0) {
    breakdownHTML = `
      <div style="display: flex; width: 100vw; max-width: 1200px; align-items: center; margin-top: 2rem; margin-bottom: 3rem;">
        
        <!-- Left: Round breakdown -->
        <div style="flex: 1; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 1rem; font-family: 'Paperlogy', sans-serif; font-size: clamp(1.2rem, 3vw, 2.2rem); font-weight: 300; letter-spacing: 2px; padding-right: clamp(1.5rem, 5vw, 4rem); color: ${leftContrast}; border-right: 2px solid ${leftContrast}40;">
          ${state.roundResults.map((r, i) => `
            <div>
              ${i + 1}라운드 <span style="font-weight: 800; margin-left: 1rem;">${r.score}%</span>
            </div>
          `).join('')}
        </div>

        <!-- Right: Big Average Score -->
        <div style="flex: 1; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding-left: clamp(1.5rem, 5vw, 4rem); color: ${rightContrast};">
          <div style="font-family: 'Paperlogy', sans-serif; font-size: clamp(1.2rem, 2.5vw, 2rem); font-weight: 800; letter-spacing: 4px; margin-bottom: -1rem; margin-left: 0.5rem;">
            평균
          </div>
          <div class="magazine-score" style="margin: 0; font-size: clamp(5rem, 15vw, 15rem); color: inherit; text-align: left; background: none; -webkit-text-fill-color: initial;">
            ${state.score}%
            <div style="font-size: 0.2em; font-weight: 300; opacity: 0.8; letter-spacing: 2px; margin-top: -1rem; text-align: left; margin-left: 1rem;">
              (${state.timeTaken.toFixed(1)}s)
            </div>
          </div>
        </div>

      </div>
    `;
  }

  container.innerHTML = `
    <div class="split-screen-result" id="score-panel">
      <!-- 50:50 분할 배경 -->
      <div class="split-screen-half" style="background-color: ${targetRGB};"></div>
      <div class="split-screen-half" style="background-color: ${userRGB};"></div>
      
      <!-- 매거진 오버레이 -->
      <div class="magazine-overlay" style="align-items: center;">
        
        <!-- 상단 라운드 표시 (좌측 고정) -->
        <div style="display: flex; justify-content: flex-start; width: 100%; flex-shrink: 0;">
          <div style="font-size: clamp(1rem, 2vw, 1.5rem); color: #fff; background-color: rgba(0,0,0,0.5); padding: 0.5rem 1rem; border-radius: 8px; font-weight: 300; letter-spacing: 2px;">
            ROUND ${state.currentRound} / ${state.maxRounds}
          </div>
        </div>

        <!-- 중앙 영역: 헥스코드 + 스코어 -->
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
          <div style="display: flex; justify-content: center; width: 100%; gap: 4rem; margin-bottom: 2rem;">
            <!-- Left Hex -->
            <div style="flex: 1; display: flex; justify-content: flex-end;">
              <div style="font-size: clamp(1rem, 3vw, 1.5rem); color: ${targetRGB}; background-color: ${leftContrast}; padding: 0.5rem 1.5rem; border-radius: 8px; font-weight: 800; letter-spacing: 3px;">
                ${targetHex}
              </div>
            </div>
            <!-- Right Hex -->
            <div style="flex: 1; display: flex; justify-content: flex-start;">
              <div style="font-size: clamp(1rem, 3vw, 1.5rem); color: ${userRGB}; background-color: ${rightContrast}; padding: 0.5rem 1.5rem; border-radius: 8px; font-weight: 800; letter-spacing: 3px;">
                ${userHex}
              </div>
            </div>
          </div>
          
          ${breakdownHTML}
        </div>
        
        <div class="magazine-scoreboard">
          <div class="scoreboard-grid" style="margin-top: 0;">
            <div class="score-card" style="background: none; border: none; padding: 0;">
              <h3>게임별 랭킹</h3>
              <ul class="rank-list">
                ${gameRanksHTML}
              </ul>
            </div>
            
            <div class="score-card" style="background: none; border: none; padding: 0;">
              <h3>플레이어 랭킹</h3>
              <ul class="rank-list">
                ${playerRanksHTML}
              </ul>
            </div>
          </div>
          <div style="margin-top: 3rem; text-align: center;">
            <button class="magazine-start-btn" id="retry-btn" style="width: 100%; margin-top: 2rem;">다시 하기</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('retry-btn').addEventListener('click', () => {
    resetGame();
    const panel = document.getElementById('score-panel');
    panel.style.opacity = '0';
    panel.style.transition = 'opacity 0.4s ease';
    setTimeout(() => {
      renderEntryView(container);
    }, 400);
  });
}
