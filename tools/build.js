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
  'index.html',
  'package.json',
  'package-lock.json',
  'start.bat',
  'INSTALL_GUIDE.md'
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
  'src/report-tabs.js'
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
// 6. ZIP 압축
// ═══════════════════════════════════════════

console.log('[6/6] ZIP 압축...');
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
  ║  또는 start.bat 실행                  ║
  ╚══════════════════════════════════════╝
`);
