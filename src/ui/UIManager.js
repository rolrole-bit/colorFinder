import { MMO_GAMES } from '../utils/Constants.js';
import { getRandomColor, calculateScore, toRGBString, hslToRgb, rgbToHex, getContrastColor } from '../utils/ColorUtils.js';
import { getState, setPlayerInfo, setTargetColor, setUserColor, setScore, resetGame, setDifficulty, setPhase, DIFFICULTY_TIME, DIFFICULTY_MULTIPLIER, addRoundResult, nextRound } from '../core/GameState.js';
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

const animateValue = (element, start, end, duration, isInteger = false) => {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const easeProgress = progress * (2 - progress); // ease-out quad
    const current = start + (end - start) * easeProgress;
    element.innerHTML = isInteger ? Math.floor(current).toLocaleString() : current.toFixed(1);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.innerHTML = isInteger ? Math.floor(end).toLocaleString() : end.toFixed(1);
    }
  };
  window.requestAnimationFrame(step);
};

export function initUI() {
  const app = document.getElementById('app');
  renderEntryView(app);
}

function renderEntryView(container) {
  container.innerHTML = `
    <div class="animated-gradient-bg" id="entry-bg"></div>
    <div class="magazine-entry" id="entry-panel">
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
          <span class="diff-label">난이도 (기억 시간 / 점수 배율)</span>
          <div class="radio-group clean">
            <label><input type="radio" name="difficulty" value="Easy"> 쉬움 (5초) ×1.0</label>
            <label><input type="radio" name="difficulty" value="Normal" checked> 보통 (2초) ×1.2</label>
            <label><input type="radio" name="difficulty" value="Hard"> 어려움 (0.5초) ×1.5</label>
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
  
  const renderDropdownList = (filterVal = '') => {
    gameDropdown.innerHTML = '';
    const ranks = getGameRankings();
    const rankMap = {};
    ranks.forEach(r => { 
      rankMap[r.game] = { rank: r.rank, trend: r.trend, isNew: r.isNew }; 
    });

    let list = MMO_GAMES.map(g => {
      const data = rankMap[g];
      return {
        name: g,
        rank: data ? data.rank : Infinity,
        trend: data ? data.trend : 0,
        isNew: data ? data.isNew : false,
        label: g
      };
    });

    if (filterVal) {
      list = list.filter(item => item.name.toLowerCase().includes(filterVal));
    }

    // Sort by rank ascending
    list.sort((a, b) => a.rank - b.rank);
    
    list.push({ name: "기타 (직접 입력)", label: "기타 (직접 입력)", rank: Infinity });

    list.forEach(item => {
      const div = document.createElement('div');
      div.className = 'dropdown-item';
      if (item.rank !== Infinity) {
        let trendStr = '';
        if (item.isNew) trendStr = ' (NEW)';
        else if (item.trend > 0) trendStr = ` (🔺${item.trend})`;
        else if (item.trend < 0) trendStr = ` (🔻${Math.abs(item.trend)})`;
        else trendStr = ' (-)';

        const rankPrefix = item.rank === 1 ? '현재 ' : '';
        div.innerHTML = `${item.name} <span style="font-weight: 600; opacity: 0.7; font-size: 0.9em; margin-left: 0.3rem;">[${rankPrefix}${item.rank}위${trendStr}]</span>`;
      } else {
        div.textContent = item.label;
      }
      
      div.addEventListener('click', () => {
        if (item.name === "기타 (직접 입력)") {
          originGameInput.value = "";
          originGameInput.placeholder = "출신 게임을 직접 입력하세요";
          originGameInput.focus();
        } else {
          originGameInput.value = item.name;
        }
        gameDropdown.classList.add('hidden');
        validate();
      });
      gameDropdown.appendChild(div);
    });
  };

  originGameInput.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    if (val === '') {
      gameDropdown.classList.add('hidden');
      validate();
      return;
    }
    renderDropdownList(val);
    gameDropdown.classList.remove('hidden');
    validate();
  });

  originGameInput.addEventListener('focus', () => {
    if (originGameInput.value.trim() === '') {
      renderDropdownList('');
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
  
  const contrastYIQ = getContrastYIQ(targetColor.r, targetColor.g, targetColor.b);
  
  const state = getState();
  
  container.innerHTML = `
    <div style="position: absolute; top: 1.2vh; left: 5vw; font-family: 'Paperlogy', sans-serif; font-size: 0.85rem; color: #fff; background-color: rgba(0,0,0,0.5); padding: 0.3rem 0.6rem; border-radius: 4px; font-weight: 800; letter-spacing: 1px; z-index: 100;">
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
      <div style="position: absolute; top: 1.2vh; left: 5vw; font-family: 'Paperlogy', sans-serif; font-size: 0.85rem; color: #fff; background-color: rgba(0,0,0,0.5); padding: 0.3rem 0.6rem; border-radius: 4px; font-weight: 800; letter-spacing: 1px; z-index: 100;">
        ROUND ${state.currentRound} / ${state.maxRounds}
      </div>
      <div class="animated-gradient-bg"></div>
      <div id="game-box" class="game-box-container">
        <div id="target-bg" class="split-bg" style="background-color: ${targetHsl};"></div>
        <div id="guess-bg" class="split-bg" style="background-color: hsl(180, 50%, 50%);"></div>
        
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
    
    let currentDisplayedRGB = hslToRgb(180, 50, 50);
    let hexAnimFrame = null;
    
    let currentH = 180;
    let currentS = 50;
    let currentL = 50;
    
    let isGuessing = true;

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

        if (submitBtn) {
          submitBtn.style.color = rgbString;
          submitBtn.style.backgroundColor = contrastBg;
        }
      }
      
      satWrapper.style.background = `linear-gradient(to top, hsl(${currentH}, 0%, 50%) 0%, hsl(${currentH}, 100%, 50%) 100%)`;
      lightWrapper.style.background = `linear-gradient(to top, #000 0%, hsl(${currentH}, ${currentS}%, 50%) 50%, #fff 100%)`;
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
      
      const state = getState();
      const baseScore = calculateScore(state.targetColor, state.userColor);
      const multiplier = DIFFICULTY_MULTIPLIER[state.difficulty];
      const roundScore = Math.floor(baseScore * multiplier);
      
      addRoundResult(roundScore, state.targetColor, state.userColor);
      setScore(roundScore);
      
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
        <div style="display: flex; justify-content: flex-start; width: 100%; flex-shrink: 0; margin-bottom: auto; padding-left: 2vw;">
          <div style="font-family: 'Paperlogy', sans-serif; font-size: 0.85rem; color: #fff; background-color: rgba(0,0,0,0.5); padding: 0.3rem 0.6rem; border-radius: 4px; font-weight: 800; letter-spacing: 1px;">
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
            <span class="animated-score" data-target="${state.score}">0</span>
            <div style="font-size: 0.25em; font-weight: 300; opacity: 0.8; letter-spacing: 1px; margin-top: 0.5rem;">
              ×${DIFFICULTY_MULTIPLIER[state.difficulty]}
            </div>
          </div>
        </div>
        
        <div style="margin-top: auto; text-align: center; width: 100%; max-width: 400px; z-index: 100; pointer-events: auto;">
          <button class="magazine-start-btn" id="next-round-btn" style="width: 100%;">${state.currentRound < state.maxRounds ? '다음 라운드' : '최종 결과'}</button>
        </div>
      </div>
    </div>
  `;

  const animatedScore = container.querySelector('.animated-score');
  if (animatedScore) {
    const target = parseInt(animatedScore.getAttribute('data-target'));
    animateValue(animatedScore, 0, target, 1200, true);
  }

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
        state.roundResults.forEach(r => {
          totalScore += r.score;
        });
        
        setScore(totalScore);
        
        saveRecord(state.playerName, state.originGame, state.score, state.difficulty);
        renderScoreBoardView(container);
      }
    }, 400);
  });
}

function renderScoreBoardView(container) {
  const state = getState();
  const gameRanks = getGameRankings();
  const playerRanks = getPlayerRankings();

  // 대비색 계산을 먼저 수행 (랭킹 HTML에서 참조하므로)
  const leftContrast = getContrastYIQ(state.targetColor.r, state.targetColor.g, state.targetColor.b);
  const rightContrast = getContrastYIQ(state.userColor.r, state.userColor.g, state.userColor.b);

  const avgR = Math.round((state.targetColor.r + state.userColor.r) / 2);
  const avgG = Math.round((state.targetColor.g + state.userColor.g) / 2);
  const avgB = Math.round((state.targetColor.b + state.userColor.b) / 2);
  const boardContrast = getContrastYIQ(avgR, avgG, avgB);
  const boardBorderColor = boardContrast === '#000000' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';

  let gameRanksHTML = gameRanks.map((r, i) => `
    <li class="rank-item" style="color: ${boardContrast}; border-color: ${boardBorderColor};">
      <span class="rank-num" style="color: ${boardContrast};">${i + 1}</span>
      <span class="rank-name">${r.game}</span>
      <span class="rank-score" style="color: ${boardContrast};">${r.score.toLocaleString()}</span>
    </li>
  `).join('');

  if (gameRanks.length === 0) gameRanksHTML = `<li class="rank-item" style="color: ${boardContrast};">기록이 없습니다.</li>`;

  let playerRanksHTML = playerRanks.map((r, i) => `
    <li class="rank-item" style="color: ${boardContrast}; border-color: ${boardBorderColor};">
      <span class="rank-num" style="color: ${boardContrast};">${i + 1}</span>
      <span class="rank-name">${r.playerName} [${r.originGame}]</span>
      <span class="rank-score" style="color: ${boardContrast};">${r.score.toLocaleString()}</span>
    </li>
  `).join('');

  if (playerRanks.length === 0) playerRanksHTML = `<li class="rank-item" style="color: ${boardContrast};">기록이 없습니다.</li>`;

  const targetRGB = toRGBString(state.targetColor);
  const userRGB = toRGBString(state.userColor);

  let targetGradient = targetRGB;
  let userGradient = userRGB;
  if (state.roundResults && state.roundResults.length > 0) {
    // Collect all valid colors from history
    const tColors = state.roundResults.map(r => r.targetColor ? toRGBString(r.targetColor) : targetRGB).join(', ');
    const uColors = state.roundResults.map(r => r.userColor ? toRGBString(r.userColor) : userRGB).join(', ');
    targetGradient = `linear-gradient(to bottom, ${tColors})`;
    userGradient = `linear-gradient(to bottom, ${uColors})`;
  }

  let breakdownHTML = '';
  if (state.roundResults && state.roundResults.length > 0) {
    breakdownHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.5rem; text-align: left; font-size: clamp(1rem, 1.5vw, 1.3rem); font-weight: 300; color: ${leftContrast}; opacity: 0.9; letter-spacing: 1px;">
        ${state.roundResults.map((r, i) => `<div>${i + 1}라운드 &nbsp;&nbsp;<span style="font-weight:500;">${r.score.toLocaleString()}</span></div>`).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="split-screen-result" id="score-panel" style="overflow-y: auto;">
      <!-- 50:50 분할 배경 (고정) -->
      <div class="split-screen-half" style="background: ${targetGradient}; position: fixed; top: 0; left: 0; width: 50vw; height: 100vh;"></div>
      <div class="split-screen-half" style="background: ${userGradient}; position: fixed; top: 0; right: 0; width: 50vw; height: 100vh;"></div>
      
      <!-- 매거진 오버레이 -->
      <div class="magazine-overlay" style="position: relative; justify-content: flex-start; height: auto; min-height: 100vh; padding-top: 3rem; gap: 2rem;">
        


        <!-- 중앙 영역: 최종 스코어 (크게) + 라운드별 (작게 가로) -->
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 4rem; margin-top: 2rem;">

            <div style="display: flex; flex-direction: column; text-align: center;">
              <div class="magazine-score" style="background: linear-gradient(to right, ${leftContrast} 50%, ${rightContrast} 50%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-top: 0;">
                <span class="animated-score" data-target="${state.score}">0</span>
                <span style="font-size: 0.3em; font-weight: 300; opacity: 0.8; letter-spacing: 1px; white-space: nowrap; display: block; margin-top: -1rem;">
                  ${state.difficulty} ×${DIFFICULTY_MULTIPLIER[state.difficulty]}
                </span>
              </div>
            </div>

            ${state.roundResults && state.roundResults.length > 0 ? `
              <div style="display: flex; gap: clamp(1rem, 3vw, 2.5rem); margin-top: 1rem; font-size: clamp(0.85rem, 1.5vw, 1.1rem); font-weight: 300; color: ${leftContrast}; opacity: 0.85; letter-spacing: 1px;">
                ${state.roundResults.map((r, i) => `<span>${i + 1}R <span style="font-weight:600;">${r.score.toLocaleString()}</span></span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="magazine-scoreboard" style="background: transparent; border: none; backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px);">
          <div class="scoreboard-grid" style="margin-top: 0; padding-bottom: 5rem;">
            <div class="score-card" style="background: none; border: none; padding: 0;">
              <h3 style="color: ${boardContrast}; -webkit-text-fill-color: ${boardContrast}; border-bottom-color: ${boardBorderColor};">게임별 랭킹</h3>
              <ul class="rank-list">
                ${gameRanksHTML}
              </ul>
            </div>
            
            <div class="score-card" style="background: none; border: none; padding: 0;">
              <h3 style="color: ${boardContrast}; -webkit-text-fill-color: ${boardContrast}; border-bottom-color: ${boardBorderColor};">플레이어 랭킹</h3>
              <ul class="rank-list">
                ${playerRanksHTML}
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <div style="position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); width: calc(100% - 4rem); max-width: 1000px; z-index: 3000; text-align: center;">
        <button class="magazine-start-btn" id="retry-btn" style="width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">다시 하기</button>
      </div>
    </div>
  `;

  const animatedScoreFinal = container.querySelector('.animated-score');
  if (animatedScoreFinal) {
    const target = parseInt(animatedScoreFinal.getAttribute('data-target'));
    animateValue(animatedScoreFinal, 0, target, 1200, true);
  }

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
