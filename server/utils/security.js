/**
 * 서버 보안 미들웨어 모듈
 * Rate Limiting, 보안 헤더, 입력 새니타이징 통합
 */

// ═══════════════════════════════════════════
// Rate Limiter (IP 기반, 외부 의존성 없음)
// ═══════════════════════════════════════════

const rateLimitStore = new Map();

/**
 * IP 기반 Rate Limiter 팩토리
 * @param {number} maxRequests - 윈도우 내 최대 요청 수
 * @param {number} windowMs - 시간 윈도우 (ms)
 * @param {string} prefix - 저장소 구분 접두사
 */
export function rateLimit(maxRequests, windowMs, prefix = 'default') {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `${prefix}:${ip}`;
    const now = Date.now();
    
    let record = rateLimitStore.get(key);
    if (!record || now - record.windowStart > windowMs) {
      record = { windowStart: now, count: 0 };
    }
    
    record.count++;
    rateLimitStore.set(key, record);
    
    // 헤더 설정
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - record.count)));
    
    if (record.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfterMs: windowMs - (now - record.windowStart)
      });
    }
    
    next();
  };
}

// Rate limit 저장소 주기적 정리 (5분마다)
setInterval(() => {
  const now = Date.now();
  const expiry = 5 * 60 * 1000;
  for (const [key, record] of rateLimitStore) {
    if (now - record.windowStart > expiry) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════
// 보안 헤더 → Helmet.js로 이관 (v3.0)
// 이전: 수동 6종 → 현재: Helmet 15종+ 자동 적용
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// server/ 디렉토리 접근 차단
// ═══════════════════════════════════════════

export function blockServerDirectory(req, res, next) {
  const blocked = ['/server/', '/data/', '/node_modules/', '/.git/', '/.env'];
  const url = req.url.toLowerCase();
  
  if (blocked.some(path => url.startsWith(path))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // package.json, .gitignore 등 루트 설정 파일 차단
  const blockedFiles = ['/package.json', '/package-lock.json', '/.gitignore', '/.env'];
  if (blockedFiles.includes(url)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  next();
}

// ═══════════════════════════════════════════
// 입력 새니타이징 유틸리티
// ═══════════════════════════════════════════

/**
 * HTML 태그 완전 제거 + 특수문자 이스케이프
 */
export function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>'"&]/g, '')       // HTML 특수문자 제거
    .replace(/[\x00-\x1f]/g, '')   // 제어 문자 제거
    .replace(/[\u200b-\u200f\u2028-\u202f\ufeff]/g, '') // 유니코드 제어 문자
    .trim();
}

/**
 * 플레이어 이름 새니타이징 (최대 20자)
 */
export function sanitizePlayerName(name) {
  return sanitizeInput(name).substring(0, 20);
}

/**
 * 게임 이름 새니타이징 (최대 30자)
 */
export function sanitizeGameName(name) {
  return sanitizeInput(name).substring(0, 30);
}
