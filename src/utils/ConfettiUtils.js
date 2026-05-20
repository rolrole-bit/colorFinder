import confetti from 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.mjs';

/**
 * 양옆에서 폭죽이 터지는 효과 (라운드 결과용)
 */
export function fireSideConfetti() {
  const duration = 2500;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 7,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
    });
    confetti({
      particleCount: 7,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

/**
 * 중앙에서 크게 터지는 폭죽 효과 (최종 스코어보드용)
 */
export function fireCenterConfetti() {
  const duration = 3000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 10,
      spread: 120,
      startVelocity: 45,
      origin: { y: 0.5, x: 0.5 },
      colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}
