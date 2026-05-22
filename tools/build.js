/**
 * DYE MASTER 배포 빌드 스크립트
 * 
 * 기능:
 *   1. dist/ 폴더 생성 및 필요한 파일 복사
 *   2. EntryView.js에서 DEV START 버튼 코드 제거
 *   3. index.html 캐시버스팅 타임스탬프 갱신
 *   4. .env 배포용 생성
 *   5. data/rankings.json 빈 배열로 초기화
 *   6. zip 압축 파일 생성
 * 
 * 실행: node tools/build.js
 */

import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// 버전 정보
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const version = pkg.version || '1.0.0';
const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

console.log(`\n  ╔══════════════════════════════════════╗`);
console.log(`  ║  🎨 DYE MASTER Build v${version}         ║`);
console.log(`  ╚══════════════════════════════════════╝\n`);

// ═══════════════════════════════════════════
// 1. dist/ 폴더 초기화
// ═══════════════════════════════════════════

console.log('[1/6] dist/ 폴더 초기화...');
if (existsSync(DIST)) {
  rmSync(DIST, { recursive: true, force: true });
}
mkdirSync(DIST, { recursive: true });

// ═══════════════════════════════════════════
// 2. 파일 복사
// ═══════════════════════════════════════════

console.log('[2/6] 파일 복사...');

const copyTargets = [
  'src',
  'server',
  'deploy',
  'index.html',
  'package.json',
  'package-lock.json',
  'start.bat',
  'INSTALL_GUIDE.md',
  'DEPLOY_GUIDE.md',
  '.env.example',
  'launcher.hta',
  'render.yaml',
  'Dockerfile',
  '.dockerignore'
];

for (const target of copyTargets) {
  const src = join(ROOT, target);
  const dest = join(DIST, target);
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
    console.log(`  ✓ ${target}`);
  } else {
    console.log(`  ⚠ ${target} (없음, 스킵)`);
  }
}

// 배포에 불필요한 파일/폴더 제거
const removeFromDist = [
  'src/test',
  'src/report-tabs.js',
  'server/data'   // 서버 내부 data 폴더 제거 (프로젝트 루트 data/ 사용)
];
for (const target of removeFromDist) {
  const p = join(DIST, target);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log(`  ✗ ${target} (배포 불필요, 제거)`);
  }
}

// data 폴더 생성 (빈 rankings.json)
mkdirSync(join(DIST, 'data'), { recursive: true });
writeFileSync(join(DIST, 'data', 'rankings.json'), '[]', 'utf-8');
console.log('  ✓ data/rankings.json (초기화)');

// install.bat 복사 (루트에 배치)
const installSrc = join(ROOT, 'tools', 'install.bat');
if (existsSync(installSrc)) {
  cpSync(installSrc, join(DIST, 'install.bat'));
  console.log('  ✓ install.bat (원클릭 설치)');
}

// ═══════════════════════════════════════════
// 3. EntryView.js에서 DEV START 버튼 제거
// ═══════════════════════════════════════════

console.log('[3/6] DEV START 버튼 제거...');
const entryViewPath = join(DIST, 'src', 'ui', 'EntryView.js');
let entryContent = readFileSync(entryViewPath, 'utf-8');

// DEV 버튼 블록 제거 (주석 시작부터 container.appendChild(devBtn); 까지)
const devBtnStart = entryContent.indexOf('// 개발자용 퀵 스타트 버튼');
const devBtnEnd = entryContent.indexOf('container.appendChild(devBtn);');
if (devBtnStart !== -1 && devBtnEnd !== -1) {
  const endOfLine = entryContent.indexOf('\n', devBtnEnd);
  entryContent = entryContent.substring(0, devBtnStart) + entryContent.substring(endOfLine + 1);
  writeFileSync(entryViewPath, entryContent, 'utf-8');
  console.log('  ✓ DEV START 버튼 코드 제거 완료');
} else {
  console.log('  ⚠ DEV START 버튼을 찾을 수 없음 (이미 제거됨?)');
}

// ═══════════════════════════════════════════
// 4. index.html 캐시버스팅 갱신
// ═══════════════════════════════════════════

console.log('[4/6] 캐시버스팅 타임스탬프 갱신...');
const indexPath = join(DIST, 'index.html');
let indexContent = readFileSync(indexPath, 'utf-8');
const cacheBuster = `v=${dateStr}`;
indexContent = indexContent.replace(/\?v=[^"']*/g, `?${cacheBuster}`);
writeFileSync(indexPath, indexContent, 'utf-8');
console.log(`  ✓ 캐시버스터: ?${cacheBuster}`);

// ═══════════════════════════════════════════
// 5. .env 배포용 생성
// ═══════════════════════════════════════════

console.log('[5/6] 배포용 .env 생성...');
const envContent = `PORT=8080
NODE_ENV=production
CORS_ORIGINS=http://localhost:8080
RATE_LIMIT_SESSION=5
RATE_LIMIT_ROUND=20
RATE_LIMIT_RANKING=30
MAX_SESSIONS=1000
MAX_RANKINGS=1000
TRUST_PROXY=false
`;
writeFileSync(join(DIST, '.env'), envContent, 'utf-8');
console.log('  ✓ .env (production 기본값)');

// ═══════════════════════════════════════════
// 6. 고객용 README.md 생성
// ═══════════════════════════════════════════

console.log('[6/7] README.md 생성...');
const readmeContent = `# 🎨 DYE MASTER v${version}

색상 매칭 게임 — 당신의 색감을 증명하세요!

## 빠른 시작 (Quick Start)

### 방법 1. 원클릭 설치 (권장)
\`install.bat\` 파일을 더블클릭하면 자동으로 설치 및 실행됩니다.

### 방법 2. 수동 설치
\`\`\`
1. Node.js LTS를 설치합니다 (https://nodejs.org)
2. 이 폴더에서 CMD를 열고 실행합니다:
   npm install --production
3. 서버를 시작합니다:
   start.bat 더블클릭  또는  node server/index.js
4. 브라우저에서 접속합니다:
   http://localhost:8080
\`\`\`

## 상세 설치 가이드
INSTALL_GUIDE.md 파일을 참조하세요.

## 주요 기능
- 🎮 색상 매칭 게임 (4단계 난이도: Easy / Normal / Hard / Hell)
- 🏆 서버 기반 실시간 랭킹 시스템
- 🛡️ 안티치트 + 서버 점수 검증
- 📱 모바일 반응형 UI
- 🔗 점수 공유 (OG 메타 태그)

## 파일 구조
\`\`\`
DYE_MASTER/
├── install.bat        ← 원클릭 설치 스크립트
├── start.bat          ← 서버 시작 스크립트
├── launcher.hta       ← GUI 런처 (더블클릭)
├── index.html         ← 메인 페이지
├── .env               ← 환경 설정 (포트, CORS 등)
├── .env.example       ← 환경 설정 예시
├── INSTALL_GUIDE.md   ← 상세 설치/운영 가이드
├── src/               ← 프론트엔드 소스
├── server/            ← 백엔드 서버
└── data/              ← 랭킹 데이터
\`\`\`

## 기술 스택
- **Frontend**: Vanilla JS (ES Modules), CSS3
- **Backend**: Node.js + Express
- **Database**: JSON 파일 기반 (별도 DB 불필요)
- **Security**: Helmet.js, Rate Limiting, Anti-Cheat

## 시스템 요구 사항
- Windows 10 이상
- Node.js v18+ (LTS 권장)
- 포트 8080 (변경 가능)

---
DYE MASTER v${version} | Build ${dateStr}
`;
writeFileSync(join(DIST, 'README.md'), readmeContent, 'utf-8');
console.log('  ✓ README.md (고객용)');

// ═══════════════════════════════════════════
// 7. ZIP 압축 (README.md 포함)
// ═══════════════════════════════════════════

console.log('[7/7] ZIP 압축...');
const zipName = `DYE_MASTER_v${version}_${dateStr}.zip`;
const zipPath = join(ROOT, zipName);

try {
  // 기존 zip 파일이 있으면 삭제
  if (existsSync(zipPath)) {
    rmSync(zipPath, { force: true });
  }
  
  // .NET ZipFile 클래스 직접 사용 (Compress-Archive보다 훨씬 빠름)
  const psCmd = `
    Add-Type -Assembly 'System.IO.Compression.FileSystem';
    [System.IO.Compression.ZipFile]::CreateFromDirectory('${DIST.replace(/\\/g, '\\\\')}', '${zipPath.replace(/\\/g, '\\\\')}', [System.IO.Compression.CompressionLevel]::Optimal, $false)
  `.replace(/\n/g, ' ');
  
  execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'pipe', timeout: 30000 });
  console.log(`  ✓ ${zipName} 생성 완료`);
} catch (err) {
  console.error('  ✗ ZIP 압축 실패:', err.message);
  console.log('  → dist/ 폴더를 수동으로 압축해 주세요.');
}

// ═══════════════════════════════════════════
// 완료
// ═══════════════════════════════════════════

console.log(`
  ╔══════════════════════════════════════╗
  ║  ✅ 빌드 완료!                       ║
  ║                                      ║
  ║  📁 dist/        → 배포 폴더         ║
  ║  📦 ${zipName.padEnd(24)}→ 납품 파일  ║
  ║                                      ║
  ║  배포 방법:                           ║
  ║  1. dist/ 폴더에서 npm install       ║
  ║  2. node server/index.js             ║
  ║  또는 start.bat / install.bat 실행    ║
  ╚══════════════════════════════════════╝
`);
