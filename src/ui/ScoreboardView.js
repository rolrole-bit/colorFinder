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
    <li class="rank-item" style="border-color: currentColor; background: rgba(255,255,255,0.35); backdrop-filter: blur(16px) saturate(120%); -webkit-backdrop-filter: blur(16px) saturate(120%); border: 1px solid rgba(255,255,255,0.6); border-radius: 8px; font-size: 1.1em; font-weight: 800; padding: 0.5rem 0.3rem; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
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
      <div style="display: flex; flex-direction: row; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-start; font-size: 1.1rem; font-weight: 400; letter-spacing: -0.5px; margin-top: 1rem; color: ${leftContrast}; text-align: left;">
        ${state.roundResults.map((r, i) => `<div>ROUND ${i + 1} : <span style="font-weight:800; font-size: 1.2em; display: inline-block;">${r.score.toLocaleString()}</span>${i < state.roundResults.length - 1 ? ',' : ''}</div>`).join('')}
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
        <div class="magazine-content">

          <!-- 중앙 영역: 플레이어 이름 + 최종 스코어 + 한줄평 -->
          <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; margin-bottom: 4rem; margin-top: 2rem; width: 100%; box-sizing: border-box; text-align: left;">

            <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; width: 100%;">
              <!-- 플레이어 이름 -->
              <div style="font-size: clamp(1rem, 3vw, 1.4rem); font-weight: 300; color: ${leftContrast}; letter-spacing: -0.5px; margin-bottom: 0.5rem; text-align: left;">
                <span style="font-weight: 700;">${playerNameSafe}</span>님의 점수는
              </div>
              
              <div style="display: flex; flex-direction: column; text-align: left; align-items: flex-start;">
                <div class="magazine-score" style="margin-top: 0; font-size: clamp(5rem, 18vw, 10rem); text-align: left; letter-spacing: -0.04em;">
                  <div style="line-height: 1; color: ${leftContrast};">
                    <span class="animated-score" data-target="${state.score}">0</span>
                  </div>
                </div>
              </div>
              ${breakdownHTML}
              
              <div id="bonus-text" style="font-size: 1.4rem; font-weight: 700; opacity: 0; letter-spacing: -0.5px; white-space: nowrap; display: block; margin-top: 1rem; color: ${leftContrast}; transition: opacity 0.8s ease; text-align: left;">
                ${getDifficultyName(state.difficulty)} BONUS X ${Number(appliedMultiplier.toFixed(2))}
              </div>
              
              <!-- 한줄평 -->
              <div id="score-comment" style="margin-top: 1.5rem; font-size: clamp(0.85rem, 2.5vw, 1.1rem); font-weight: 400; color: ${leftContrast}; letter-spacing: -0.5px; text-align: left; max-width: 500px; line-height: 1.6; word-break: keep-all; opacity: 0; transition: opacity 1s ease 0.5s; font-style: italic;">
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
      </div>
      
      <div style="position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); width: calc(100% - 4rem); max-width: 800px; z-index: 3000; text-align: center; display: flex; gap: 1rem;">
        <button class="magazine-start-btn" id="retry-btn" style="flex: 1; background: rgba(255,255,255,0.6) !important; backdrop-filter: blur(20px) saturate(140%); -webkit-backdrop-filter: blur(20px) saturate(140%); border: 1px solid rgba(255,255,255,0.4) !important; color: #000000 !important; box-shadow: 0 8px 32px rgba(0,0,0,0.1) !important; display:flex; align-items:center; justify-content:center; gap:0.5rem;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>다시 하기</button>
        <button class="magazine-start-btn" id="share-btn" style="flex: 1; background: rgba(255,255,255,0.6) !important; backdrop-filter: blur(20px) saturate(140%); -webkit-backdrop-filter: blur(20px) saturate(140%); border: 1px solid rgba(255,255,255,0.4) !important; color: #000000 !important; box-shadow: 0 8px 32px rgba(0,0,0,0.1) !important; display:flex; align-items:center; justify-content:center; gap:0.5rem;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>공유하기</button>
      </div>
    </div>
    
    <!-- 공유 카드 미리보기 모달 -->
    <div id="share-modal" style="display:none; position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.6); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); justify-content:center; align-items:center;">
      <div style="position:relative; max-width:380px; width:90%; animation: shareCardPop 0.3s ease-out;">
        <!-- 공유 카드 미리보기 -->
        <div id="share-card-preview" style="text-align:center; padding:2.5rem 2rem 2rem; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:24px; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <div style="font-size:.8rem; color:rgba(255,255,255,0.5); letter-spacing:3px; margin-bottom:.4rem; text-transform:uppercase;">DYE MASTER</div>
          <div id="share-card-name" style="font-size:1.15rem; font-weight:600; margin-bottom:.2rem; color:rgba(255,255,255,0.85);"></div>
          <div id="share-card-score" style="font-size:4.5rem; font-weight:900; line-height:1; color:#fff; text-shadow:0 4px 20px rgba(0,0,0,0.3); margin:.3rem 0 .8rem;"></div>
          <div id="share-card-comment" style="font-size:.85rem; color:rgba(255,255,255,0.65); font-style:italic; margin-bottom:1rem; line-height:1.6;"></div>
        </div>
        
        <!-- URL 복사 영역 -->
        <div style="margin-top:1rem; display:flex; gap:0.5rem;">
          <input id="share-url-input" type="text" readonly style="flex:1; padding:0.75rem 1rem; border-radius:12px; border:1px solid rgba(255,255,255,0.15); background:rgba(0,0,0,0.3); color:rgba(255,255,255,0.8); font-size:0.8rem; outline:none; font-family:'Paperlogy',sans-serif; backdrop-filter:blur(10px);">
          <button id="copy-url-btn" style="padding:0.75rem 1.2rem; border:none; border-radius:12px; background:linear-gradient(135deg, #667eea, #764ba2); color:#fff; font-size:0.85rem; font-weight:700; cursor:pointer; white-space:nowrap; font-family:'Paperlogy',sans-serif; letter-spacing:0.5px; transition:all 0.2s; box-shadow:0 4px 15px rgba(118,75,162,0.4);">URL 복사</button>
        </div>
        
        <!-- 닫기 -->
        <button id="share-close-btn" style="width:100%; margin-top:0.8rem; padding:0.8rem; border:none; border-radius:12px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.6); font-size:0.9rem; cursor:pointer; font-family:'Paperlogy',sans-serif; transition:all 0.2s;">닫기</button>
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
