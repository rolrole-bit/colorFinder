/**
 * ScoreboardView - 최종 스코어보드 (랭킹 표시)
 * 
 * 담당: 최종 점수 애니메이션 + 게임/플레이어 랭킹 표시 + 재시작/지옥 도전
 */

import { getState, resetGame, setDifficulty, getDifficultyName, getDifficultyMultiplier } from '../core/GameState.js';
import { getGameRankings, getPlayerRankings } from '../core/Ranking.js';
import { toRGBString, rgbToHex } from '../utils/ColorUtils.js';
import { escapeHTML, clearSession } from '../utils/AntiCheat.js';
import { playBonusBounceSound, playScoreImpactSound } from '../utils/SoundUtils.js';
import { getContrastYIQ, animateValue } from './AnimationUtils.js';

/**
 * 최종 스코어보드 화면 렌더링
 * @param {HTMLElement} container - 렌더링 대상
 * @param {number} appliedMultiplier - 적용된 난이도 배율
 * @param {object} nav - 네비게이션 콜백
 * @param {function} nav.toEntryView - 엔트리 화면으로 전환
 * @param {function} nav.toGameView - 게임 화면으로 전환 (지옥 도전)
 */
export async function renderScoreBoardView(container, appliedMultiplier = 1.0, nav) {
  const state = getState();
  const [gameRanks, playerRanks] = await Promise.all([getGameRankings(), getPlayerRankings()]);

  // [SECURITY] XSS 방어
  let gameRanksHTML = gameRanks.map((r, i) => `
    <li class="rank-item" style="border-color: currentColor;">
      <span class="rank-num">${i + 1}</span>
      <span class="rank-name">${escapeHTML(r.game)}</span>
      <span class="rank-score">${(r.score || r.topScore || 0).toLocaleString()}</span>
    </li>
  `).join('');

  if (gameRanks.length === 0) gameRanksHTML = '<li class="rank-item">기록이 없습니다.</li>';

  let playerRanksHTML = playerRanks.map((r, i) => `
    <li class="rank-item" style="border-color: currentColor;">
      <span class="rank-num">${i + 1}</span>
      <span class="rank-name">${escapeHTML(r.playerName)} [${escapeHTML(r.originGame)}]</span>
      <span class="rank-score">${r.score.toLocaleString()}</span>
    </li>
  `).join('');

  if (playerRanks.length === 0) playerRanksHTML = '<li class="rank-item">기록이 없습니다.</li>';

  const targetRGB = toRGBString(state.targetColor);
  const userRGB = toRGBString(state.userColor);
  const targetHex = rgbToHex(state.targetColor.r, state.targetColor.g, state.targetColor.b);
  const userHex = rgbToHex(state.userColor.r, state.userColor.g, state.userColor.b);
  
  const leftContrast = getContrastYIQ(state.targetColor.r, state.targetColor.g, state.targetColor.b);
  const rightContrast = getContrastYIQ(state.userColor.r, state.userColor.g, state.userColor.b);

  let targetGradient = targetRGB;
  let userGradient = userRGB;
  if (state.roundResults && state.roundResults.length > 0) {
    const tColors = state.roundResults.map(r => r.targetColor ? toRGBString(r.targetColor) : targetRGB).join(', ');
    const uColors = state.roundResults.map(r => r.userColor ? toRGBString(r.userColor) : userRGB).join(', ');
    targetGradient = `linear-gradient(to bottom, ${tColors})`;
    userGradient = `linear-gradient(to bottom, ${uColors})`;
  }

  let breakdownHTML = '';
  if (state.roundResults && state.roundResults.length > 0) {
    breakdownHTML = `
      <div style="display: flex; flex-direction: row; gap: 1rem; flex-wrap: wrap; justify-content: center; font-size: 1.1rem; font-weight: 400; letter-spacing: 1px; margin-top: 1rem; color: #fff; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
        ${state.roundResults.map((r, i) => `<div>${i + 1}라운드 <span class="animated-gradient-text" style="font-weight:800; font-size: 1.2em; display: inline-block;">${r.score.toLocaleString()}</span></div>`).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="split-screen-result" id="score-panel">
      <!-- 50:50 분할 배경 -->
      <div class="split-screen-half" style="background: ${targetGradient};"></div>
      <div class="split-screen-half" style="background: ${userGradient};"></div>
      
      <!-- 매거진 오버레이 -->
      <div class="magazine-overlay">

        <!-- 중앙 영역: 라운드 결과 + 최종 스코어 -->
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 4rem; margin-top: 2rem;">

          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div style="display: flex; flex-direction: column; text-align: center;">
              <div class="magazine-score" style="margin-top: 0; font-size: clamp(5rem, 18vw, 10rem);">
                <div class="animated-gradient-text" style="line-height: 1;">
                  <span class="animated-score" data-target="${state.score}">0</span>
                </div>
                <div id="bonus-text" style="font-size: 0.15em; font-weight: 300; opacity: 0; letter-spacing: 2px; white-space: nowrap; display: block; margin-top: 1.5rem; color: #fff; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); transition: opacity 0.8s ease;">
                  ${getDifficultyName(state.difficulty)} Bonus &times; ${appliedMultiplier.toFixed(2)}
                </div>
              </div>
            </div>
            ${breakdownHTML}
          </div>
        </div>
        
        <div class="magazine-scoreboard">
          <div class="scoreboard-grid" style="margin-top: 0; padding-bottom: 5rem;">
            <div class="score-card" style="background: none; border: none; border-top: 1px solid currentColor; padding: 1.5rem 0 0 0; color: ${leftContrast};">
              <h3 style="color: inherit;">게임별 랭킹</h3>
              <ul class="rank-list" style="color: inherit;">
                ${gameRanksHTML}
              </ul>
            </div>
            
            <div class="score-card" style="background: none; border: none; border-top: 1px solid currentColor; padding: 1.5rem 0 0 0; color: ${rightContrast};">
              <h3 style="color: inherit;">플레이어 랭킹</h3>
              <ul class="rank-list" style="color: inherit;">
                ${playerRanksHTML}
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <div style="position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); width: calc(100% - 4rem); max-width: 1000px; z-index: 3000; text-align: center; display: flex; gap: 1rem;">
        <button class="magazine-start-btn" id="retry-btn" style="flex: 1; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">다시 하기</button>
        ${state.difficulty === "Hard" && state.score >= 3000 ? `
          <button class="magazine-start-btn" id="hell-btn" style="flex: 1; background: #800000; color: #ffcccc; box-shadow: 0 10px 30px rgba(255,0,0,0.5);">지옥 난이도 도전</button>
        ` : ''}
      </div>
    </div>
  `;

  // 점수 애니메이션
  const animatedScoreFinal = container.querySelector('.animated-score');
  if (animatedScoreFinal) {
    const finalTarget = parseInt(animatedScoreFinal.getAttribute('data-target'));
    const baseTotal = state.roundResults.reduce((acc, r) => acc + r.score, 0);
    
    if (appliedMultiplier > 1.0) {
      animateValue(animatedScoreFinal, 0, baseTotal, 1200, true, true).then(() => {
        const bonusText = document.getElementById('bonus-text');
        if (bonusText) {
          bonusText.classList.add('anim-double-bounce');
          playBonusBounceSound();
        }
        setTimeout(() => {
          animatedScoreFinal.parentElement.classList.add('anim-score-impact');
          playScoreImpactSound();
          animateValue(animatedScoreFinal, baseTotal, finalTarget, 1000, true, true);
        }, 800);
      });
    } else {
      animateValue(animatedScoreFinal, 0, finalTarget, 1200, true, true);
    }
  }

  // 다시 하기
  document.getElementById('retry-btn').addEventListener('click', () => {
    resetGame();
    clearSession();
    const panel = document.getElementById('score-panel');
    panel.style.opacity = '0';
    panel.style.transition = 'opacity 0.4s ease';
    setTimeout(() => {
      nav.toEntryView();
    }, 400);
  });

  // 지옥 난이도 도전
  const hellBtn = document.getElementById('hell-btn');
  if (hellBtn) {
    hellBtn.addEventListener('click', () => {
      resetGame();
      setDifficulty("Hell");
      const panel = document.getElementById('score-panel');
      panel.style.opacity = '0';
      panel.style.transition = 'opacity 0.4s ease';
      setTimeout(() => {
        nav.toGameView();
      }, 400);
    });
  }
}
