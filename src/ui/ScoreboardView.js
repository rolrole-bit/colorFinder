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
import { fireCenterConfetti } from '../utils/ConfettiUtils.js';

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

  // 초기 대비색 (상단 기준 = t:0)
  const initLeftColor = interpolateGradient(leftColors, 0);
  const initRightColor = interpolateGradient(rightColors, 0);
  const leftContrast = getContrastYIQ(initLeftColor.r, initLeftColor.g, initLeftColor.b);
  const rightContrast = getContrastYIQ(initRightColor.r, initRightColor.g, initRightColor.b);

  // 버튼 위치(화면 하단 약 95% 지점)의 실제 보간된 색상을 사용
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
      <div data-contrast-side="right" style="display: flex; flex-direction: column; gap: 0.2rem; font-size: 1.1rem; font-weight: 400; letter-spacing: -0.5px; color: ${rightContrast}; text-align: left; line-height: 1.4;">
        ${state.roundResults.map((r, i) => `<div>ROUND ${i + 1} : <span style="font-weight:800;">${r.score.toLocaleString()}</span>${i < state.roundResults.length - 1 ? ',' : ''}</div>`).join('')}
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

          <!-- 중앙 영역: 2컬럼 레이아웃 (좌측: 이름+점수 / 우측: 라운드별 점수 + 코멘트) -->
          <div class="scoreboard-grid" style="align-items: flex-end; margin-bottom: 4rem; margin-top: 2rem; width: 100%; box-sizing: border-box; text-align: left;">

            <!-- 좌측 컬럼 -->
            <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start;">
              <div data-contrast-side="left" style="font-size: clamp(1rem, 3vw, 1.4rem); font-weight: 300; color: ${leftContrast}; letter-spacing: -0.5px; margin-bottom: 0.5rem; text-align: left;">
                <span style="font-weight: 700; border-bottom: 2px dotted currentColor; padding-bottom: 2px;">${playerNameSafe}</span> 님의 점수는
              </div>
              
              <div class="magazine-score" style="margin-top: 0; font-size: clamp(5rem, 18vw, 10rem); text-align: left; letter-spacing: -0.04em;">
                <div data-contrast-side="left" style="line-height: 1; color: ${leftContrast};">
                  <span class="animated-score" data-target="${state.score}">0</span>
                </div>
              </div>
            </div>

            <!-- 우측 컬럼 -->
            <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding-bottom: 1.5rem;">
              ${breakdownHTML}
              
              <div id="bonus-text" data-contrast-side="right" style="font-size: 1rem; font-weight: 700; opacity: 0; letter-spacing: -0.5px; white-space: nowrap; display: block; margin-top: 1rem; color: ${rightContrast}; transition: opacity 0.8s ease; text-align: left;">
                ${getDifficultyName(state.difficulty)} BONUS X ${Number(appliedMultiplier.toFixed(2))}
              </div>
              
              <!-- 한줄평 -->
              <div id="score-comment" data-contrast-side="right" style="margin-top: 1.5rem; font-size: clamp(0.9rem, 2vw, 1.1rem); font-weight: 400; color: ${rightContrast}; letter-spacing: -0.5px; text-align: left; max-width: 400px; line-height: 1.6; word-break: keep-all; opacity: 0; transition: opacity 1s ease 0.5s;">
                "${comment}"
              </div>
            </div>
            
          </div>
          
          <div class="magazine-scoreboard">
            <div class="scoreboard-grid" style="margin-top: 0; padding-bottom: 5rem;">
              <div class="score-card" data-contrast-side="left" style="background: none; border: none; border-top: 1px solid currentColor; padding: 1.5rem 0 0 0; color: ${leftContrast};">
                <h3 style="color: inherit;">플레이어 랭킹</h3>
                <ul class="rank-list" style="color: inherit;">
                  ${playerRanksHTML}
                </ul>
              </div>
              
              <div class="score-card" data-contrast-side="right" style="background: none; border: none; border-top: 1px solid currentColor; padding: 1.5rem 0 0 0; color: ${rightContrast};">
                <h3 style="color: inherit;">게임별 랭킹</h3>
                <ul class="rank-list" style="color: inherit;">
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

  // ═══ 스크롤 기반 실시간 대비색 업데이트 ═══
  const overlay = container.querySelector('.magazine-overlay');
  if (overlay) {
    let rafId = null;
    const updateContrastColors = () => {
      const scrollTop = overlay.scrollTop;
      const scrollHeight = overlay.scrollHeight - overlay.clientHeight;
      const t = scrollHeight > 0 ? Math.min(1, Math.max(0, scrollTop / scrollHeight)) : 0;

      // 현재 스크롤 위치의 보간된 배경색 계산
      const currentLeft = interpolateGradient(leftColors, t);
      const currentRight = interpolateGradient(rightColors, t);
      const newLeftContrast = getContrastYIQ(currentLeft.r, currentLeft.g, currentLeft.b);
      const newRightContrast = getContrastYIQ(currentRight.r, currentRight.g, currentRight.b);

      // data-contrast-side 속성으로 마킹된 모든 요소의 색상 업데이트
      container.querySelectorAll('[data-contrast-side="left"]').forEach(el => {
        el.style.color = newLeftContrast;
      });
      container.querySelectorAll('[data-contrast-side="right"]').forEach(el => {
        el.style.color = newRightContrast;
      });
    };

    overlay.addEventListener('scroll', () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateContrastColors);
    }, { passive: true });

    // 초기 1회 실행 (렌더링 직후)
    requestAnimationFrame(updateContrastColors);
  }

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
