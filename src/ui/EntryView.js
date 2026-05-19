/**
 * EntryView - 엔트리 화면 (플레이어 입력, 게임 선택, 난이도)
 * 
 * 담당: 게임 시작 전 사용자 입력 수집 + 서버 세션 생성
 */

import { MMO_GAMES } from '../utils/Constants.js';
import { getState, setPlayerInfo, setDifficulty, getDifficultyTime, getDifficultyMultiplier, getDifficultyName } from '../core/GameState.js';
import { getGameRankings } from '../core/Ranking.js';
import { startSession as startServerSession } from '../core/ServerAPI.js';
import { initAudio, playReadySound } from '../utils/SoundUtils.js';
import { startSession, startDevToolsDetection } from '../utils/AntiCheat.js';
import { scrambleTypingEffect } from './AnimationUtils.js';

/**
 * 엔트리 화면 렌더링
 * @param {HTMLElement} container - 렌더링 대상
 * @param {object} nav - 네비게이션 콜백
 * @param {function} nav.toGameView - 게임 화면으로 전환
 * @param {function} nav.setServerSession - 서버 세션 상태 설정
 */
export function renderEntryView(container, nav) {
  container.innerHTML = `
    <div class="animated-gradient-bg" id="entry-bg"></div>
    <div class="magazine-entry" id="entry-panel">
      <h1 class="magazine-title">DYE<br/>MASTER</h1>
      
      <div class="entry-form">
        <div class="form-group dropdown-container" style="position: relative;">
          <span class="diff-label">1. 어느게임 출신이세요?</span>
          <div style="position: relative;">
            <input type="text" id="origin-game" class="minimal-input" placeholder=" " autocomplete="off" />
            <div class="custom-placeholder">
              게임을 검색하거나 선택하세요<span class="blink-cursor">I</span>
            </div>
          </div>
          <div class="dropdown-list hidden" id="game-dropdown" style="width: 100%;"></div>
        </div>
        <div class="form-group">
          <span class="diff-label">2. 당신의 이름은?</span>
          <div style="position: relative;">
            <input type="text" id="player-name" class="minimal-input" placeholder=" " autocomplete="off" />
            <div class="custom-placeholder">
              닉네임을 입력하세요
            </div>
          </div>
        </div>
        <div class="form-group difficulty-group">
          <span class="diff-label">3. 난이도 (기억 시간 / 점수 배율)</span>
          <div class="radio-group clean">
            <label><input type="radio" name="difficulty" value="Easy"> ${getDifficultyName("Easy")} (${getDifficultyTime("Easy") / 1000}초) &times;${getDifficultyMultiplier("Easy").toFixed(1)}</label>
            <label><input type="radio" name="difficulty" value="Normal" checked> ${getDifficultyName("Normal")} (${getDifficultyTime("Normal") / 1000}초) &times;${getDifficultyMultiplier("Normal").toFixed(1)}</label>
            <label><input type="radio" name="difficulty" value="Hard"> ${getDifficultyName("Hard")} (${getDifficultyTime("Hard") / 1000}초) &times;${getDifficultyMultiplier("Hard").toFixed(1)}</label>
            ${localStorage.getItem('hell_unlocked') === 'true' ? `<label style="color: #ff4444; font-weight: 800; text-shadow: 0 0 5px rgba(255,0,0,0.5);"><input type="radio" name="difficulty" value="Hell"> ${getDifficultyName("Hell")} (0.2~0.3초) &times;1.25~1.30</label>` : ''}
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
  
  const renderDropdownList = async (filterVal = '') => {
    gameDropdown.innerHTML = '';
    const ranks = await getGameRankings();
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

  startBtn.addEventListener('click', async () => {
    const selectedDifficulty = document.querySelector('input[name="difficulty"]:checked').value;
    setPlayerInfo(playerNameInput.value.trim(), originGameInput.value.trim());
    setDifficulty(selectedDifficulty);
    initAudio();
    startSession();
    startDevToolsDetection();
    
    // [Phase 2] 서버 세션 시작
    try {
      const serverSession = await startServerSession(
        playerNameInput.value.trim(),
        originGameInput.value.trim(),
        selectedDifficulty
      );
      nav.setServerSession(serverSession.sessionId, serverSession.targetColor);
    } catch (err) {
      console.error('[Server] 세션 시작 실패:', err);
      nav.setServerSession(null, null);
    }
    
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
        playReadySound();
      }
      
      setTimeout(() => {
        if (introText) {
          scrambleTypingEffect(introText, '선수 입장!', 1000);
          playReadySound();
        }
        
        setTimeout(() => {
          nav.toGameView();
        }, 2000);
      }, 2000);
    }, 400);
  });
}
