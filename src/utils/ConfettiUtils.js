/**
 * ConfettiUtils - 순수 Canvas 기반 폭죽 이펙트
 * 외부 라이브러리 의존 없음 (CDN/NPM 불필요)
 *
 * fireSideConfetti()   → 양 옆에서 터지는 효과 (라운드 800점+)
 * fireCenterConfetti() → 화면 중앙에서 터지는 효과 (총합 2000점+)
 */

const COLORS = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'];

/**
 * 전용 오버레이 캔버스를 생성하거나 기존 것을 반환
 * @returns {HTMLCanvasElement}
 */
function getCanvas() {
  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
    document.body.appendChild(canvas);
  }
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  return canvas;
}

/**
 * 파티클 하나 생성
 * @param {number} x - 시작 x (0~1 비율)
 * @param {number} y - 시작 y (0~1 비율)
 * @param {number} angle - 발사 각도 (도)
 * @param {number} velocity - 초기 속도
 */
function createParticle(x, y, angle, velocity) {
  const rad = angle * Math.PI / 180;
  return {
    x: x * window.innerWidth,
    y: y * window.innerHeight,
    vx: Math.cos(rad) * velocity * (0.7 + Math.random() * 0.6),
    vy: Math.sin(rad) * velocity * (0.7 + Math.random() * 0.6),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 4 + Math.random() * 4,
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 10,
    gravity: 0.12 + Math.random() * 0.08,
    drag: 0.97 + Math.random() * 0.02,
    opacity: 1,
    decay: 0.008 + Math.random() * 0.008,
    shape: Math.random() > 0.5 ? 'rect' : 'circle'
  };
}

/**
 * 파티클 배열을 캔버스에 애니메이션
 * @param {Array} particles
 */
function animateParticles(particles) {
  const canvas = getCanvas();
  const ctx = canvas.getContext('2d');
  let running = true;

  function frame() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let alive = 0;
    for (const p of particles) {
      if (p.opacity <= 0) continue;
      alive++;

      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.opacity -= p.decay;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (alive > 0) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  requestAnimationFrame(frame);
}

/**
 * 양옆에서 폭죽이 터지는 효과 (라운드 결과용, 800점 이상)
 */
export function fireSideConfetti() {
  const particles = [];
  const waves = 5;
  let wave = 0;

  function burst() {
    if (wave >= waves) return;
    for (let i = 0; i < 25; i++) {
      // 왼쪽에서
      particles.push(createParticle(0, 0.5 + (Math.random() - 0.5) * 0.4, -60 + Math.random() * 30, 8 + Math.random() * 6));
      // 오른쪽에서
      particles.push(createParticle(1, 0.5 + (Math.random() - 0.5) * 0.4, 210 + Math.random() * 30, 8 + Math.random() * 6));
    }
    wave++;
    if (wave < waves) setTimeout(burst, 300);
  }

  burst();
  animateParticles(particles);
}

/**
 * 중앙에서 크게 터지는 폭죽 효과 (최종 스코어보드용, 2000점 이상)
 */
export function fireCenterConfetti() {
  const particles = [];
  const waves = 6;
  let wave = 0;

  function burst() {
    if (wave >= waves) return;
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * 360;
      particles.push(createParticle(0.5, 0.45, angle, 6 + Math.random() * 8));
    }
    wave++;
    if (wave < waves) setTimeout(burst, 350);
  }

  burst();
  animateParticles(particles);
}
