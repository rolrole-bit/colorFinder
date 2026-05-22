/**
 * PM2 프로세스 매니저 설정
 * 
 * 사용법:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup    (부팅 시 자동 시작)
 */
module.exports = {
  apps: [{
    name: 'dye-master',
    script: 'server/index.js',
    cwd: '/opt/dye-master',
    
    // 환경변수
    env: {
      NODE_ENV: 'production',
      PORT: 8080,
      CORS_ORIGINS: '*',
      TRUST_PROXY: 'true',
      MAX_SESSIONS: 1000,
      MAX_RANKINGS: 1000
    },

    // 프로세스 관리
    instances: 1,            // 단일 인스턴스 (JSON DB 동시 쓰기 방지)
    autorestart: true,       // 크래시 시 자동 재시작
    max_restarts: 10,        // 최대 재시작 횟수
    restart_delay: 3000,     // 재시작 간격 (ms)
    watch: false,            // 파일 변경 감시 비활성화

    // 로그
    error_file: '/var/log/dye-master/error.log',
    out_file: '/var/log/dye-master/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // 메모리 제한 (초과 시 자동 재시작)
    max_memory_restart: '256M',

    // Node.js 옵션
    node_args: '--max-old-space-size=256'
  }]
};
