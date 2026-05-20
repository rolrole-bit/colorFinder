/**
 * CSS 글래스모피즘 하네스 (Glassmorphism Safety Harness)
 * 
 * backdrop-filter: blur()를 깨뜨리는 CSS/인라인 스타일 안티패턴을
 * 정적 분석으로 사전에 감지하여, 배포 전 문제를 방지한다.
 * 
 * 검출 대상 안티패턴:
 *   1. transform + backdrop-filter 동시 사용 (blur 무력화)
 *   2. 부모의 mix-blend-mode가 자식의 backdrop-filter를 격리
 *   3. 인라인 스타일의 과도한 불투명 배경 (blur 은폐)
 *   4. flex 레이아웃 수직 센터링 균형 검증
 *   5. will-change: transform 등 GPU 레이어 분리 속성 검출
 * 
 * 실행: node src/test/css-harness.js
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

// ─── 설정 ────────────────────────────────────────────────
const CSS_FILES = ['src/index.css'];
const JS_DIRS = ['src/ui'];
const INLINE_OPACITY_THRESHOLD = 0.4; // 인라인 bg rgba alpha 최대 허용치

// ─── 결과 집계 ───────────────────────────────────────────
let totalWarnings = 0;
let totalErrors = 0;
const results = [];

function error(file, line, rule, msg) {
  totalErrors++;
  results.push({ level: 'ERROR', file, line, rule, msg });
}

function warn(file, line, rule, msg) {
  totalWarnings++;
  results.push({ level: 'WARN', file, line, rule, msg });
}

// ═══════════════════════════════════════════════════════════
// RULE 1: CSS 파일에서 transform + backdrop-filter 충돌 검출
// ═══════════════════════════════════════════════════════════
/**
 * 같은 CSS 셀렉터 블록 안에 transform과 backdrop-filter가
 * 동시에 존재하면 Chromium에서 blur가 깨진다.
 * transform: translateZ(0), transform: translate(-50%), 등 모두 해당.
 */
function checkTransformBackdropConflict(filePath, content) {
  const lines = content.split('\n');
  let currentSelector = '';
  let selectorStartLine = 0;
  let braceDepth = 0;
  let blockHasTransform = false;
  let blockHasBackdrop = false;
  let transformLine = 0;
  let backdropLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 주석 무시
    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) continue;

    // 셀렉터 시작 감지
    if (trimmed.includes('{') && braceDepth === 0) {
      currentSelector = trimmed.replace('{', '').trim();
      selectorStartLine = i + 1;
      blockHasTransform = false;
      blockHasBackdrop = false;
    }

    if (trimmed.includes('{')) braceDepth++;
    if (trimmed.includes('}')) braceDepth--;

    // 속성 감지
    if (/transform\s*:/.test(trimmed) && !/transform\s*:\s*none/.test(trimmed)) {
      blockHasTransform = true;
      transformLine = i + 1;
    }
    if (/backdrop-filter\s*:/.test(trimmed) && !trimmed.startsWith('-webkit-')) {
      blockHasBackdrop = true;
      backdropLine = i + 1;
    }

    // 블록 종료 시 검사
    if (braceDepth === 0 && (blockHasTransform || blockHasBackdrop)) {
      if (blockHasTransform && blockHasBackdrop) {
        error(filePath, transformLine,
          'TRANSFORM_BACKDROP_CONFLICT',
          `셀렉터 "${currentSelector}" (L${selectorStartLine})에 transform(L${transformLine})과 backdrop-filter(L${backdropLine})가 동시 존재. blur 무력화 위험!`
        );
      }
      blockHasTransform = false;
      blockHasBackdrop = false;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// RULE 2: mix-blend-mode가 backdrop-filter 자식에게 미치는 영향
// ═══════════════════════════════════════════════════════════
/**
 * mix-blend-mode: difference 등이 적용된 셀렉터의 자식 요소에
 * backdrop-filter가 있으면, 부모의 블렌드 모드가 자식의 blur를 격리시킨다.
 * CSS만으로는 부모-자식 관계를 완벽히 추적할 수 없으므로,
 * mix-blend-mode가 normal이 아닌 값을 가진 셀렉터를 경고한다.
 */
function checkMixBlendModeRisk(filePath, content) {
  const lines = content.split('\n');
  let currentSelector = '';
  let selectorStartLine = 0;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) continue;

    if (trimmed.includes('{') && braceDepth === 0) {
      currentSelector = trimmed.replace('{', '').trim();
      selectorStartLine = i + 1;
    }

    if (trimmed.includes('{')) braceDepth++;
    if (trimmed.includes('}')) braceDepth--;

    // mix-blend-mode: normal 이외의 값 감지
    const blendMatch = trimmed.match(/mix-blend-mode\s*:\s*([^;!]+)/);
    if (blendMatch) {
      const value = blendMatch[1].trim();
      if (value !== 'normal') {
        warn(filePath, i + 1,
          'MIX_BLEND_MODE_RISK',
          `셀렉터 "${currentSelector}" (L${selectorStartLine})에 mix-blend-mode: ${value} 감지. 자식 요소의 backdrop-filter를 격리시킬 수 있음.`
        );
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// RULE 3: will-change / contain 등 GPU 레이어 강제 분리 속성
// ═══════════════════════════════════════════════════════════
function checkGPULayerIsolation(filePath, content) {
  const lines = content.split('\n');
  let currentSelector = '';
  let selectorStartLine = 0;
  let braceDepth = 0;
  let blockHasBackdrop = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('//')) continue;

    if (trimmed.includes('{') && braceDepth === 0) {
      currentSelector = trimmed.replace('{', '').trim();
      selectorStartLine = i + 1;
      blockHasBackdrop = false;
    }

    if (trimmed.includes('{')) braceDepth++;
    if (trimmed.includes('}')) braceDepth--;

    if (/backdrop-filter\s*:/.test(trimmed)) blockHasBackdrop = true;

    // will-change: transform 감지
    if (/will-change\s*:.*transform/.test(trimmed) && blockHasBackdrop) {
      error(filePath, i + 1,
        'WILL_CHANGE_CONFLICT',
        `셀렉터 "${currentSelector}"에 will-change:transform + backdrop-filter 동시 사용. blur 깨짐 위험!`
      );
    }

    // backface-visibility: hidden 감지 (GPU 레이어 생성)
    if (/backface-visibility\s*:\s*hidden/.test(trimmed) && blockHasBackdrop) {
      warn(filePath, i + 1,
        'BACKFACE_VISIBILITY_RISK',
        `셀렉터 "${currentSelector}"에 backface-visibility:hidden + backdrop-filter 사용. 일부 브라우저에서 blur 깨짐 가능.`
      );
    }

    if (braceDepth === 0) blockHasBackdrop = false;
  }
}

// ═══════════════════════════════════════════════════════════
// RULE 4: JS 인라인 스타일에서 transform + backdrop-filter 충돌
// ═══════════════════════════════════════════════════════════
/**
 * JS 파일의 인라인 style="..." 속성 안에서
 * transform과 backdrop-filter가 동시에 존재하는 패턴을 감지한다.
 */
function checkInlineTransformConflict(filePath, content) {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // style="..." 블록 추출
    const styleMatches = line.matchAll(/style="([^"]+)"/g);
    for (const match of styleMatches) {
      const styleStr = match[1];
      const hasTransform = /transform\s*:/.test(styleStr) && !/transform\s*:\s*none/.test(styleStr);
      const hasBackdrop = /backdrop-filter\s*:/.test(styleStr);

      if (hasTransform && hasBackdrop) {
        error(filePath, i + 1,
          'INLINE_TRANSFORM_BACKDROP',
          `인라인 스타일에 transform + backdrop-filter 동시 사용 감지. blur 무력화!`
        );
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// RULE 5: JS 인라인 스타일의 과도한 배경 불투명도
// ═══════════════════════════════════════════════════════════
/**
 * backdrop-filter가 있는 요소의 배경 rgba alpha가
 * INLINE_OPACITY_THRESHOLD를 초과하면 blur 효과가 시각적으로 은폐된다.
 */
function checkInlineOpacity(filePath, content) {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const styleMatches = line.matchAll(/style="([^"]+)"/g);
    for (const match of styleMatches) {
      const styleStr = match[1];
      const hasBackdrop = /backdrop-filter\s*:/.test(styleStr);

      if (hasBackdrop) {
        // rgba(R,G,B, alpha) 추출
        const rgbaMatch = styleStr.match(/background\s*:\s*rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
        if (rgbaMatch) {
          const alpha = parseFloat(rgbaMatch[1]);
          if (alpha > INLINE_OPACITY_THRESHOLD) {
            warn(filePath, i + 1,
              'INLINE_HIGH_OPACITY',
              `인라인 backdrop-filter 요소의 배경 alpha=${alpha} (>${INLINE_OPACITY_THRESHOLD}). blur가 흰색 페인트처럼 보일 수 있음.`
            );
          }
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// RULE 6: 부모 컨테이너의 transform이 자식 blur를 격리하는 패턴
// ═══════════════════════════════════════════════════════════
/**
 * position: fixed + transform: translateX(-50%) 같은 중앙 정렬 패턴은
 * 자식의 backdrop-filter를 격리시킨다.
 * left:0; right:0; margin: 0 auto;로 대체해야 한다.
 */
function checkFixedTransformPattern(filePath, content) {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const styleMatches = line.matchAll(/style="([^"]+)"/g);
    for (const match of styleMatches) {
      const styleStr = match[1];
      const hasFixed = /position\s*:\s*fixed/.test(styleStr);
      const hasTransform = /transform\s*:/.test(styleStr) && !/transform\s*:\s*none/.test(styleStr);

      if (hasFixed && hasTransform) {
        error(filePath, i + 1,
          'FIXED_TRANSFORM_PATTERN',
          `position:fixed + transform 조합 감지. 자식의 backdrop-filter를 격리시킴! left:0; right:0; margin:0 auto;로 대체할 것.`
        );
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// RULE 7: flex space-between 레이아웃 센터링 균형 검증
// ═══════════════════════════════════════════════════════════
/**
 * magazine-overlay 등 주요 레이아웃 컨테이너에서
 * justify-content: space-between을 사용하면서 자식이 2개 이하인 경우,
 * 수직 센터링이 깨질 위험이 있다.
 * margin-top: auto / margin-bottom: auto 짝이 맞는지 확인한다.
 */
function checkFlexCenteringBalance(filePath, content) {
  const lines = content.split('\n');

  // magazine-overlay 클래스가 있는 요소 이후의 직계 자식 div 수 세기
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/class="magazine-overlay"/.test(line)) {
      // 이후 닫힘 태그까지 margin-top: auto와 margin-bottom: auto 짝 확인
      let marginTopAuto = 0;
      let marginBottomAuto = 0;
      let depth = 0;

      for (let j = i; j < lines.length && j < i + 50; j++) {
        const l = lines[j];
        if (/<div/.test(l)) depth++;
        if (/<\/div>/.test(l)) depth--;
        if (depth <= 0 && j > i) break;

        if (/margin-bottom\s*:\s*auto/.test(l)) marginBottomAuto++;
        if (/margin-top\s*:\s*auto/.test(l)) marginTopAuto++;
      }

      if (marginTopAuto > 0 && marginBottomAuto === 0) {
        warn(filePath, i + 1,
          'FLEX_CENTERING_IMBALANCE',
          `magazine-overlay 안에 margin-top:auto가 ${marginTopAuto}개 있지만 margin-bottom:auto가 없음. 수직 센터링이 깨질 수 있음.`
        );
      }
      if (marginBottomAuto > 0 && marginTopAuto === 0) {
        warn(filePath, i + 1,
          'FLEX_CENTERING_IMBALANCE',
          `magazine-overlay 안에 margin-bottom:auto가 ${marginBottomAuto}개 있지만 margin-top:auto가 없음. 수직 센터링이 깨질 수 있음.`
        );
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// 파일 수집 & 실행
// ═══════════════════════════════════════════════════════════
function collectFiles(dir, extensions) {
  const result = [];
  const fullDir = join(PROJECT_ROOT, dir);
  try {
    const entries = readdirSync(fullDir);
    for (const entry of entries) {
      const fullPath = join(fullDir, entry);
      const stat = statSync(fullPath);
      if (stat.isFile() && extensions.includes(extname(entry))) {
        result.push(fullPath);
      }
    }
  } catch (e) {
    console.error(`  ⚠ 디렉토리 읽기 실패: ${dir}`);
  }
  return result;
}

function run() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     🔍 CSS Glassmorphism Safety Harness v1.0               ║');
  console.log('║     backdrop-filter 안티패턴 정적 분석기                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // CSS 파일 분석
  console.log('── CSS 파일 분석 ─────────────────────────────────────────────');
  for (const cssFile of CSS_FILES) {
    const fullPath = join(PROJECT_ROOT, cssFile);
    const relPath = cssFile;
    try {
      const content = readFileSync(fullPath, 'utf-8');
      console.log(`  📄 ${relPath}`);
      checkTransformBackdropConflict(relPath, content);
      checkMixBlendModeRisk(relPath, content);
      checkGPULayerIsolation(relPath, content);
    } catch (e) {
      console.error(`  ⚠ 파일 읽기 실패: ${relPath}`);
    }
  }

  // JS 파일 분석 (인라인 스타일)
  console.log('');
  console.log('── JS 인라인 스타일 분석 ─────────────────────────────────────');
  for (const jsDir of JS_DIRS) {
    const files = collectFiles(jsDir, ['.js']);
    for (const file of files) {
      const relPath = relative(PROJECT_ROOT, file).replace(/\\/g, '/');
      try {
        const content = readFileSync(file, 'utf-8');
        console.log(`  📄 ${relPath}`);
        checkInlineTransformConflict(relPath, content);
        checkInlineOpacity(relPath, content);
        checkFixedTransformPattern(relPath, content);
        checkFlexCenteringBalance(relPath, content);
      } catch (e) {
        console.error(`  ⚠ 파일 읽기 실패: ${relPath}`);
      }
    }
  }

  // 결과 출력
  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  결과 요약');
  console.log('══════════════════════════════════════════════════════════════');

  if (results.length === 0) {
    console.log('');
    console.log('  ✅ 모든 검사 통과! 안티패턴이 감지되지 않았습니다.');
    console.log('');
  } else {
    console.log('');

    // 에러 먼저, 경고 다음
    const errors = results.filter(r => r.level === 'ERROR');
    const warnings = results.filter(r => r.level === 'WARN');

    if (errors.length > 0) {
      console.log(`  ❌ 에러 (${errors.length}건) — 반드시 수정 필요:`);
      for (const r of errors) {
        console.log(`     [${r.rule}] ${r.file}:${r.line}`);
        console.log(`       → ${r.msg}`);
      }
      console.log('');
    }

    if (warnings.length > 0) {
      console.log(`  ⚠️  경고 (${warnings.length}건) — 검토 권장:`);
      for (const r of warnings) {
        console.log(`     [${r.rule}] ${r.file}:${r.line}`);
        console.log(`       → ${r.msg}`);
      }
      console.log('');
    }
  }

  console.log(`  총 에러: ${totalErrors}  |  총 경고: ${totalWarnings}`);
  console.log('══════════════════════════════════════════════════════════════');
  console.log('');

  // 에러가 있으면 exit code 1
  if (totalErrors > 0) {
    process.exit(1);
  }
}

run();
