/**
 * 공유 페이지 라우트
 * GET /share - 점수 공유 랜딩 페이지 렌더링
 * 
 * server/index.js에서 분리됨
 */

import { Router } from 'express';
import { getAllPlayerRankings } from '../db.js';

const router = Router();

/**
 * 다중 라운드 색상 문자열 파싱
 * @param {string} str - "r,g,b|r,g,b|r,g,b" 형식
 * @returns {string[]} rgb() 문자열 배열
 */
function parseColors(str) {
  if (!str) return [];
  return str.split('|').map(s => {
    const p = s.split(',').map(Number);
    return (p.length === 3 && p.every(n => !isNaN(n))) ? `rgb(${p[0]},${p[1]},${p[2]})` : null;
  }).filter(Boolean);
}

/**
 * 안전한 문자열 이스케이프
 */
function esc(str, maxLen = 20) {
  return (str || '').substring(0, maxLen).replace(/[<>"'&]/g, '');
}

router.get('/', (req, res) => {
  const score = parseInt(req.query.score) || 0;
  const name = esc(req.query.name || '플레이어', 20);
  const comment = esc(req.query.comment, 100);
  const gameUrl = `${req.protocol}://${req.get('host')}/`;

  // 전체 랭킹에서 본인 등수 + 앞뒤 2명 계산
  const allRanks = getAllPlayerRankings();
  const totalPlayers = allRanks.length;
  
  let myIdx = allRanks.findIndex(r => r.playerName === name && r.score === score);
  if (myIdx === -1) {
    myIdx = allRanks.findIndex(r => score >= r.score);
    if (myIdx === -1) myIdx = allRanks.length;
  }
  const myRank = myIdx + 1;
  
  const startIdx = Math.max(0, myIdx - 2);
  const endIdx = Math.min(allRanks.length, myIdx + 3);
  
  let boardHTML = '';
  for (let i = startIdx; i < endIdx; i++) {
    const r = allRanks[i];
    if (!r) continue;
    const isMe = (i === myIdx);
    boardHTML += `<div class="rb ${isMe ? 'rb-me' : ''}"><span class="rb-n">${i + 1}</span><span class="rb-nm">${esc(r.playerName, 12)}</span><span class="rb-s">${r.score.toLocaleString()}</span></div>`;
  }
  if (myIdx >= allRanks.length) {
    boardHTML += `<div class="rb rb-me"><span class="rb-n">${myRank}</span><span class="rb-nm">${esc(name, 12)}</span><span class="rb-s">${score.toLocaleString()}</span></div>`;
  }

  // 색상 배경
  const tcArr = parseColors(req.query.tc);
  const ucArr = parseColors(req.query.uc);
  const leftBg = tcArr.length > 1 ? `linear-gradient(to bottom, ${tcArr.join(', ')})` : (tcArr[0] || 'rgb(102,126,234)');
  const rightBg = ucArr.length > 1 ? `linear-gradient(to bottom, ${ucArr.join(', ')})` : (ucArr[0] || 'rgb(118,75,162)');

  const title = `🎨 ${name}님의 DYE MASTER 점수: ${score.toLocaleString()}점`;
  const desc = comment || `색감 테스트에서 ${score.toLocaleString()}점을 획득했습니다! 나의 색감을 증명해 보세요.`;

  res.send(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${gameUrl}">
<meta property="og:site_name" content="DYE MASTER">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<style>
@font-face{font-family:'Paperlogy';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-3Light.woff2') format('woff2');font-weight:300;font-display:swap}
@font-face{font-family:'Paperlogy';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-4Regular.woff2') format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:'Paperlogy';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-7Bold.woff2') format('woff2');font-weight:700;font-display:swap}
@font-face{font-family:'Paperlogy';src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-8ExtraBold.woff2') format('woff2');font-weight:800;font-display:swap}
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Paperlogy',sans-serif;color:#fff;overflow:hidden;position:relative}
.bg{position:fixed;inset:0;z-index:0;display:flex}
.bg-half{flex:1}
.bg-left{background:${leftBg}}
.bg-right{background:${rightBg}}
.bg-blur{position:fixed;inset:0;z-index:1;backdrop-filter:blur(50px);-webkit-backdrop-filter:blur(50px);background:rgba(0,0,0,0.25)}
.card{position:relative;z-index:2;text-align:center;padding:2.5rem 2rem 2rem;max-width:380px;width:90%;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:24px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.label{font-size:.8rem;color:rgba(255,255,255,0.5);letter-spacing:3px;margin-bottom:.4rem;text-transform:uppercase}
.name{font-size:1.15rem;font-weight:600;margin-bottom:.2rem;color:rgba(255,255,255,0.85)}
.score{font-size:4.5rem;font-weight:900;line-height:1;color:#fff;text-shadow:0 4px 20px rgba(0,0,0,0.3);margin:.3rem 0 .8rem}
.comment{font-size:.85rem;color:rgba(255,255,255,0.65);font-style:italic;margin-bottom:1.8rem;line-height:1.6}
.btn{display:inline-block;padding:.9rem 2.5rem;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);color:#fff;text-decoration:none;border-radius:50px;font-size:1rem;font-weight:700;letter-spacing:1px;transition:all .2s;backdrop-filter:blur(10px)}
.btn:hover{background:rgba(255,255,255,0.25);transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,0.3)}
.board{margin-top:1.5rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.1);text-align:left}
.board-title{font-size:.7rem;color:rgba(255,255,255,0.4);letter-spacing:2px;text-align:center;margin-bottom:.5rem;text-transform:uppercase}
.rb{display:flex;align-items:center;padding:.4rem .6rem;border-radius:8px;font-size:.8rem;color:rgba(255,255,255,0.55);margin-bottom:2px}
.rb-me{background:rgba(255,255,255,0.12);color:#fff;font-size:.95rem;font-weight:700;padding:.5rem .6rem;border:1px solid rgba(255,255,255,0.15)}
.rb-n{width:1.8rem;font-weight:800;font-size:.9rem;color:rgba(255,255,255,0.5)}
.rb-me .rb-n{color:#fff}
.rb-nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rb-s{font-weight:700;min-width:3rem;text-align:right}
</style>
</head>
<body>
<div class="bg"><div class="bg-half bg-left"></div><div class="bg-half bg-right"></div></div>
<div class="bg-blur"></div>
<div class="card">
  <div class="label">DYE MASTER</div>
  <div class="name">${name}님의 점수</div>
  <div class="score">${score.toLocaleString()}</div>
  <div class="comment">${desc}</div>
  <a href="${gameUrl}" class="btn">나도 도전하기</a>
  <div class="board">
    <div class="board-title">🏆 전체 ${totalPlayers}명 중 ${myRank}위</div>
    ${boardHTML}
  </div>
</div>
</body>
</html>`);
});

export default router;
