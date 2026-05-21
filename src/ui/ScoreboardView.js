/**
 * ScoreboardView - 최종 스코어보드 (랭킹 표시)
 * 
 * 담당: 최종 점수 애니메이션 + 게임/플레이어 랭킹 표시
 * 공유 로직은 ShareManager.js, 한줄평은 ScoreComment.js로 분리
 */

import { getState, resetGame, setDifficulty, getDifficultyName, getDifficultyMultiplier } from '../core/GameState.js';
import { getGameRankings, getPlayerRankings, getTotalPlayers } from '../core/Ranking.js';
import { toRGBString, rgbToHex, getAverageColor, getButtonContrastStyle } from '../utils/ColorUtils.js';
import { escapeHTML, clearSession } from '../utils/AntiCheat.js';
import { playBonusBounceSound, playScoreImpactSound } from '../utils/SoundUtils.js';
import { getContrastYIQ, animateValue } from './AnimationUtils.js';
import { getScoreComment } from '../utils/ScoreComment.js';
import { bindShareEvents } from './ShareManager.js';
import { fireCenterConfetti, fireSideConfetti } from '../utils/ConfettiUtils.js';

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
    <li class="rank-item" style="border-color: rgba(255,255,255,0.15);">
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
      ? 'background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; font-size: 1.1em; font-weight: 800; padding: 0.5rem 0.5rem; margin: 0.2rem -0.5rem;' 
      : '';
    return `
    <li class="rank-item" style="border-color: rgba(255,255,255,0.15); ${meStyle}">
      <span class="rank-num">${i + 1}</span>
      <span class="rank-name">${escapeHTML(r.playerName)} <span style="opacity:0.6; font-size:0.85em;">[${escapeHTML(r.originGame)}]</span></span>
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
    <li class="rank-item" style="border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; font-size: 1.1em; font-weight: 800; padding: 0.5rem 0.5rem; margin: 0.2rem -0.5rem;">
      <span class="rank-num">${myRank}</span>
      <span class="rank-name">${escapeHTML(myName)} <span style="opacity:0.6; font-size:0.85em;">[${escapeHTML(state.originGame)}]</span></span>
      <span class="rank-score">${myScore.toLocaleString()}</span>
    </li>
    <li class="rank-item" style="border-color: rgba(255,255,255,0.15); padding: 0.2rem 0; opacity: 0.3; font-size: 0.7em; text-align: center; letter-spacing: 3px;">⋯</li>`;
    playerRanksHTML = myRankHTML + playerRanksHTML;
  }

  if (playerRanks.length === 0) playerRanksHTML = '<li class="rank-item">기록이 없습니다.</li>';

  const targetRGB = toRGBString(state.targetColor);
  const userRGB = toRGBString(state.userColor);
  
  // ═══ 라운드별 색상 배열 준비 (그라디언트 보간용) ═══
  const leftColors = (state.roundResults && state.roundResults.length > 0)
    ? state.roundResults.map(r => r.targetColor || state.targetColor)
    : [state.targetColor];
  const rightColors = (state.roundResults && state.roundResults.length > 0)
    ? state.roundResults.map(r => r.userColor || state.userColor)
    : [state.userColor];

  /**
   * 스크롤 비율(0~1)에 따라 그라디언트 상의 보간된 색상을 반환
   * @param {Array<{r,g,b}>} colors - 라운드별 색상 배열
   * @param {number} t - 스크롤 비율 (0=상단, 1=하단)
   * @returns {{r:number, g:number, b:number}}
   */
  function interpolateGradient(colors, t) {
    if (colors.length === 1) return colors[0];
    const pos = t * (colors.length - 1);
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const c1 = colors[Math.min(idx, colors.length - 1)];
    const c2 = colors[Math.min(idx + 1, colors.length - 1)];
    return {
      r: Math.round(c1.r + (c2.r - c1.r) * frac),
      g: Math.round(c1.g + (c2.g - c1.g) * frac),
      b: Math.round(c1.b + (c2.b - c1.b) * frac)
    };
  }

  // 버튼 위치(화면 하단 약 95% 지점)의 실제 보간된 색상을 사용해 버튼 대비색 지정
  const btnLeftColor = interpolateGradient(leftColors, 0.95);
  const btnRightColor = interpolateGradient(rightColors, 0.95);
  const avgBg = getAverageColor(btnLeftColor, btnRightColor);
  const btnStyle = getButtonContrastStyle(avgBg);

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
      <div style="display: flex; flex-direction: column; gap: 0.2rem; font-size: 1.1rem; font-weight: 400; letter-spacing: -0.5px; color: rgba(255,255,255,0.8); text-align: left; line-height: 1.4;">
        ${state.roundResults.map((r, i) => `<div>ROUND ${i + 1} : <span style="font-weight:800; color:#fff;">${r.score.toLocaleString()}</span>${i < state.roundResults.length - 1 ? ',' : ''}</div>`).join('')}
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
      
      <!-- 통합 블러 덮개 (경계선 문제 해결용) -->
      <div style="position: absolute; inset: -10%; backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); pointer-events: none; z-index: 1;"></div>
      
      <!-- 매거진 오버레이 -->
      <div class="magazine-overlay" style="z-index: 2;">
        <div class="magazine-content">

          <!-- 상단 패널 (이름, 점수, 세부사항) -->
          <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 2.5rem 2rem; width: 100%; box-sizing: border-box; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); margin-bottom: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
            <div class="scoreboard-grid" style="align-items: flex-end; width: 100%; margin: 0; text-align: left;">
              <!-- 좌측 컬럼 -->
              <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start;">
                <div style="font-size: clamp(1rem, 3vw, 1.4rem); font-weight: 300; color: rgba(255,255,255,0.7); letter-spacing: -0.5px; margin-bottom: 0.5rem; text-align: left;">
                  <span style="font-weight: 700; border-bottom: 2px dotted currentColor; padding-bottom: 2px; color: #fff;">${playerNameSafe}</span> 님의 점수는
                </div>
                
                <div class="magazine-score" style="margin-top: 0; font-size: clamp(5rem, 18vw, 10rem); text-align: left; letter-spacing: -0.04em;">
                  <div style="line-height: 1; color: #fff;">
                    <span class="animated-score" data-target="${state.score}">0</span>
                  </div>
                </div>
              </div>

              <!-- 우측 컬럼 -->
              <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding-bottom: 1.5rem;">
                ${breakdownHTML}
                
                <div id="bonus-text" style="font-size: 1rem; font-weight: 700; opacity: 0; letter-spacing: -0.5px; white-space: nowrap; display: block; margin-top: 1rem; color: rgba(255,255,255,0.85); transition: opacity 0.8s ease; text-align: left;">
                  ${getDifficultyName(state.difficulty)} BONUS X ${Number(appliedMultiplier.toFixed(2))}
                </div>
                
                <!-- 한줄평 -->
                <div id="score-comment" style="margin-top: 1.5rem; font-size: clamp(0.9rem, 2vw, 1.1rem); font-weight: 400; color: rgba(255,255,255,0.7); letter-spacing: -0.5px; text-align: left; max-width: 400px; line-height: 1.6; word-break: keep-all; opacity: 0; transition: opacity 1s ease 0.5s;">
                  "${comment}"
                </div>
              </div>
            </div>
          </div>
          
          <!-- 하단 패널 (랭킹) -->
          <div class="magazine-scoreboard" style="background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 2rem; width: 100%; box-sizing: border-box; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); box-shadow: 0 10px 30px rgba(0,0,0,0.15); padding-bottom: 2rem;">
            <div class="scoreboard-grid" style="margin-top: 0;">
              <div class="score-card" style="background: none; border: none; padding: 0; color: #fff;">
                <h3 style="color: rgba(255,255,255,0.6); font-size: 1.3rem; margin-bottom: 1.5rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.2);">플레이어 랭킹</h3>
                <ul class="rank-list" style="color: #fff;">
                  ${playerRanksHTML}
                </ul>
              </div>
              
              <div class="score-card" style="background: none; border: none; padding: 0; color: #fff;">
                <h3 style="color: rgba(255,255,255,0.6); font-size: 1.3rem; margin-bottom: 1.5rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.2);">게임별 랭킹</h3>
                <ul class="rank-list" style="color: #fff;">
                  ${gameRanksHTML}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div style="position: fixed; bottom: 2rem; left: 0; right: 0; margin: 0 auto; width: calc(100% - 4rem); max-width: 800px; z-index: 3000; text-align: center; display: flex; gap: 1rem;">
        <button class="magazine-start-btn" id="retry-btn" style="flex: 1; display:flex; align-items:center; justify-content:center; --btn-color: ${btnStyle.textColor}; --btn-border: ${btnStyle.borderColor}; --btn-bg: ${btnStyle.glassBg}; --btn-hover-bg: ${btnStyle.hoverBg};">
          <span style="display:flex; align-items:center; gap:0.5rem; color: inherit;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>다시 하기
          </span>
        </button>
        <button class="magazine-start-btn" id="share-btn" style="flex: 1; display:flex; align-items:center; justify-content:center; --btn-color: ${btnStyle.textColor}; --btn-border: ${btnStyle.borderColor}; --btn-bg: ${btnStyle.glassBg}; --btn-hover-bg: ${btnStyle.hoverBg};">
          <span style="display:flex; align-items:center; gap:0.5rem; color: inherit;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>공유하기
          </span>
        </button>
      </div>
    </div>
    
    <!-- 공유 카드 미리보기 모달 -->
    <div id="share-modal" style="display:none; position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.6); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); justify-content:center; align-items:center;">
      <div style="position:relative; max-width:380px; width:90%; animation: shareCardPop 0.3s ease-out;">
        <!-- 공유 카드 미리보기 -->
        <div id="share-card-preview" style="text-align:center; padding:2.5rem 2rem 2rem; border:1px solid rgba(255,255,255,0.15); border-radius:24px; box-shadow:0 20px 60px rgba(0,0,0,0.3); position:relative; overflow:hidden;">
          <div id="share-card-bg" style="position:absolute; inset:0; background:linear-gradient(135deg, ${targetRGB}, ${userRGB}); filter:blur(30px) saturate(150%); transform:scale(1.3); z-index:0;"></div>
          <div style="position:absolute; inset:0; background:rgba(0,0,0,0.25); z-index:1;"></div>
          <div style="position:relative; z-index:2;">
            <div style="font-size:.8rem; color:rgba(255,255,255,0.5); letter-spacing:3px; margin-bottom:.4rem; text-transform:uppercase;">DYE MASTER</div>
            <div id="share-card-name" style="font-size:1.15rem; font-weight:600; margin-bottom:.2rem; color:rgba(255,255,255,0.85);"></div>
            <div id="share-card-score" style="font-size:4.5rem; font-weight:900; line-height:1; color:#fff; text-shadow:0 4px 20px rgba(0,0,0,0.3); margin:.3rem 0 .8rem;"></div>
            <div id="share-card-comment" style="font-size:.85rem; color:rgba(255,255,255,0.65); font-style:italic; margin-bottom:1rem; line-height:1.6;"></div>
          </div>
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

  // 동적 대비색 업데이트 로직 제거됨 (배경 다크 패널 + 밝은 텍스트 고정)

  // 점수 애니메이션
  const animatedScoreFinal = container.querySelector('.animated-score');
  if (animatedScoreFinal) {
    const finalTarget = parseInt(animatedScoreFinal.getAttribute('data-target'));
    const baseTotal = state.roundResults.reduce((acc, r) => acc + r.score, 0);
    
    // 점수가 2000 이상이면 올라가는 동안 사이드 폭죽 터뜨리기
    let sideConfettiInterval = null;
    if (finalTarget >= 2000) {
      sideConfettiInterval = setInterval(() => {
        fireSideConfetti();
      }, 300);
    }

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
          animateValue(animatedScoreFinal, baseTotal, finalTarget, 1000, true, true).then(() => {
            // 최종 애니메이션 완료 후
            if (sideConfettiInterval) clearInterval(sideConfettiInterval);
            if (finalTarget >= 2000) fireCenterConfetti();
          });
        }, 800);
      });
    } else {
      animateValue(animatedScoreFinal, 0, finalTarget, 1200, true, true).then(() => {
        // 최종 애니메이션 완료 후
        if (sideConfettiInterval) clearInterval(sideConfettiInterval);
        if (finalTarget >= 2000) fireCenterConfetti();
      });
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
