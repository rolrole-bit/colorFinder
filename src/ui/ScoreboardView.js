/**
 * ScoreboardView - 최종 스코어보드 (랭킹 표시)
 * 
 * 담당: 최종 점수 애니메이션 + 게임/플레이어 랭킹 표시
 * 공유 로직은 ShareManager.js, 한줄평은 ScoreComment.js로 분리
 */

import { getState, resetGame, setDifficulty, getDifficultyName, getDifficultyMultiplier } from '../core/GameState.js';
import { getGameRankings, getPlayerRankings, getTotalPlayers } from '../core/Ranking.js';
import { toRGBString, rgbToHex } from '../utils/ColorUtils.js';
import { escapeHTML, clearSession } from '../utils/AntiCheat.js';
import { playBonusBounceSound, playScoreImpactSound } from '../utils/SoundUtils.js';
import { getContrastYIQ, animateValue } from './AnimationUtils.js';
import { getScoreComment } from '../utils/ScoreComment.js';
import { bindShareEvents } from './ShareManager.js';

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
  const [gameRanks, playerRanks, totalPlayers] = await Promise.all([getGameRankings(), getPlayerRankings(), getTotalPlayers()]);

  // [SECURITY] XSS 방어
  let gameRanksHTML = gameRanks.map((r, i) => `
    <li class="rank-item" style="border-color: currentColor;">
      <span class="rank-num">${i + 1}</span>
      <span class="rank-name">${escapeHTML(r.game)}</span>
      <span class="rank-score">${(r.score || r.topScore || 0).toLocaleString()}</span>
    </li>
  `).join('');

  if (gameRanks.length === 0) gameRanksHTML = '<li class="rank-item">기록이 없습니다.</li>';

  // 본인이 TOP5에 있는지 확인
  const myName = state.playerName;
  const myScore = state.score;
  const myInTop5 = playerRanks.some(r => r.playerName === myName && r.score === myScore);
  
  let playerRanksHTML = playerRanks.map((r, i) => {
    const isMe = (r.playerName === myName && r.score === myScore);
    const meStyle = isMe 
      ? 'background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; font-size: 1.1em; font-weight: 800; padding: 0.5rem 0.3rem;' 
      : '';
    return `
    <li class="rank-item" style="border-color: currentColor; ${meStyle}">
      <span class="rank-num">${i + 1}</span>
      <span class="rank-name">${escapeHTML(r.playerName)} [${escapeHTML(r.originGame)}]</span>
      <span class="rank-score">${r.score.toLocaleString()}</span>
    </li>
  `;}).join('');
  
  // TOP5 밖이면 본인 등수를 최상단에 추가
  if (!myInTop5 && playerRanks.length > 0) {
    // 모든 top5보다 낮으면 전체 등수 중 마지막 부근
    let myRank = totalPlayers || playerRanks.length + 1;
    for (let i = 0; i < playerRanks.length; i++) {
      if (myScore >= playerRanks[i].score) { myRank = i + 1; break; }
    }
    const myRankHTML = `
    <li class="rank-item" style="border-color: currentColor; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; font-size: 1.1em; font-weight: 800; padding: 0.5rem 0.3rem;">
      <span class="rank-num">${myRank}</span>
      <span class="rank-name">${escapeHTML(myName)} [${escapeHTML(state.originGame)}]</span>
      <span class="rank-score">${myScore.toLocaleString()}</span>
    </li>
    <li class="rank-item" style="border-color: currentColor; padding: 0.2rem 0; opacity: 0.3; font-size: 0.7em; text-align: center; letter-spacing: 3px;">⋯</li>`;
    playerRanksHTML = myRankHTML + playerRanksHTML;
  }

  if (playerRanks.length === 0) playerRanksHTML = '<li class="rank-item">기록이 없습니다.</li>';

  const targetRGB = toRGBString(state.targetColor);
  const userRGB = toRGBString(state.userColor);
  
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
      <div style="display: flex; flex-direction: row; gap: 1rem; flex-wrap: wrap; justify-content: center; font-size: 1.1rem; font-weight: 400; letter-spacing: 1px; margin-top: 1rem; color: #fff;">
        ${state.roundResults.map((r, i) => `<div>ROUND ${i + 1} <span class="animated-gradient-text" style="font-weight:800; font-size: 1.2em; display: inline-block;">${r.score.toLocaleString()}</span></div>`).join('')}
      </div>
    `;
  }

  const comment = getScoreComment(state.score);
  const playerNameSafe = escapeHTML(state.playerName);

  container.innerHTML = `
    <div class="split-screen-result" id="score-panel">
      <!-- 50:50 분할 배경 -->
      <div class="split-screen-half" style="background: ${targetGradient};"></div>
      <div class="split-screen-half" style="background: ${userGradient};"></div>
      
      <!-- 매거진 오버레이 -->
      <div class="magazine-overlay">

        <!-- 중앙 영역: 플레이어 이름 + 최종 스코어 + 한줄평 -->
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 4rem; margin-top: 2rem;">

          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <!-- 플레이어 이름 -->
            <div style="font-size: clamp(1rem, 3vw, 1.4rem); font-weight: 300; color: #fff; letter-spacing: 2px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); margin-bottom: 0.5rem;">
              <span style="font-weight: 700;">${playerNameSafe}</span>님의 점수는
            </div>
            
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
            
            <!-- 한줄평 -->
            <div id="score-comment" style="margin-top: 1.5rem; font-size: clamp(0.85rem, 2.5vw, 1.1rem); font-weight: 400; color: #fff; letter-spacing: 1px; text-align: center; max-width: 500px; line-height: 1.6; opacity: 0; transition: opacity 1s ease 0.5s; font-style: italic;">
              ${comment}
            </div>
          </div>
        </div>
        
        <div class="magazine-scoreboard">
          <div class="scoreboard-grid" style="margin-top: 0; padding-bottom: 5rem;">
            <div class="score-card" style="background: none; border: none; border-top: 1px solid currentColor; padding: 1.5rem 0 0 0; color: ${leftContrast};">
              <h3 style="color: inherit;">플레이어 랭킹</h3>
              <ul class="rank-list" style="color: inherit;">
                ${playerRanksHTML}
              </ul>
            </div>
            
            <div class="score-card" style="background: none; border: none; border-top: 1px solid currentColor; padding: 1.5rem 0 0 0; color: ${rightContrast};">
              <h3 style="color: inherit;">게임별 랭킹</h3>
              <ul class="rank-list" style="color: inherit;">
                ${gameRanksHTML}
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <div style="position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); width: calc(100% - 4rem); max-width: 1000px; z-index: 3000; text-align: center; display: flex; gap: 1rem;">
        <button class="magazine-start-btn" id="retry-btn" style="flex: 1; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; gap:0.5rem;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>다시 하기</button>
        <button class="magazine-start-btn" id="share-btn" style="flex: 1; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; box-shadow: 0 10px 30px rgba(118,75,162,0.5); display:flex; align-items:center; justify-content:center; gap:0.5rem;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>공유하기</button>
      </div>
    </div>
    
    <!-- 공유 모달 -->
    <div id="share-modal" style="display:none; position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.7); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); justify-content:center; align-items:center;">
      <div style="background:#1a1a2e; border-radius:16px; padding:2rem; max-width:360px; width:90%; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="font-size:1.3rem; font-weight:700; color:#fff; margin-bottom:0.5rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>공유하기</div>
        <div id="share-toast" style="font-size:0.85rem; color:#aaa; margin-bottom:1rem;">SNS를 선택하거나 URL을 복사하세요</div>
        
        <!-- 공유 URL -->
        <div style="display:flex; gap:0.5rem; margin-bottom:1.2rem;">
          <input id="share-url-input" type="text" readonly style="flex:1; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid #333; background:#111; color:#ccc; font-size:0.8rem; outline:none;">
          <button id="copy-url-btn" style="padding:0.6rem 1rem; border:none; border-radius:8px; background:#667eea; color:#fff; font-size:0.8rem; cursor:pointer; white-space:nowrap;">URL 복사</button>
        </div>
        
        <div style="display:flex; justify-content:center; gap:1.5rem; margin-bottom:1.5rem;">
          <a id="share-twitter" href="#" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;gap:0.4rem;text-decoration:none;color:#1DA1F2;">
            <div style="width:52px;height:52px;border-radius:14px;background:#1DA1F2;display:flex;align-items:center;justify-content:center;">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </div>
            <span style="font-size:0.75rem;">Twitter</span>
          </a>
          <a id="share-facebook" href="#" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;gap:0.4rem;text-decoration:none;color:#1877F2;">
            <div style="width:52px;height:52px;border-radius:14px;background:#1877F2;display:flex;align-items:center;justify-content:center;">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </div>
            <span style="font-size:0.75rem;">Facebook</span>
          </a>
          <a id="share-instagram" href="#" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;gap:0.4rem;text-decoration:none;color:#E4405F;">
            <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);display:flex;align-items:center;justify-content:center;">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </div>
            <span style="font-size:0.75rem;">Instagram</span>
          </a>
        </div>
        <button id="share-close-btn" style="width:100%;padding:0.8rem;border:none;border-radius:10px;background:#333;color:#fff;font-size:1rem;cursor:pointer;transition:background 0.2s;">닫기</button>
      </div>
    </div>
  `;

  // 한줄평 페이드 인
  requestAnimationFrame(() => {
    const commentEl = document.getElementById('score-comment');
    if (commentEl) commentEl.style.opacity = '1';
  });

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

  // 공유 이벤트 바인딩 (ShareManager.js)
  bindShareEvents(state, getScoreComment);
}
