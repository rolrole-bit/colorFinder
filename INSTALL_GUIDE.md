# 🎨 DYE MASTER 설치 및 운영 가이드

## 시스템 요구 사항

| 항목 | 최소 사양 |
|------|----------|
| OS | Windows 10 이상 / Windows Server 2016 이상 |
| Node.js | v18.0.0 이상 (LTS 권장) |
| 메모리 | 512MB 이상 |
| 포트 | 8080 (기본값, `.env`에서 변경 가능) |

---

## 1단계: Node.js 설치

### 방법 A — 공식 설치 파일 (권장)

1. https://nodejs.org 접속
2. **LTS (Long Term Support)** 버전 다운로드
3. 설치 파일 실행 → 모든 옵션 기본값으로 진행
4. 설치 완료 후 CMD에서 확인:
   ```
   node --version
   ```
   `v18.x.x` 이상이면 정상

### 방법 B — 이미 Node.js가 설치된 경우

CMD에서 버전 확인만 하면 됩니다:
```
node --version
```

---

## 2단계: DYE MASTER 설치

### 2-1. 압축 해제

배포 ZIP 파일을 원하는 위치에 압축 해제합니다.

```
예시: C:\DYE_MASTER\
```

### 2-2. 의존성 설치

CMD에서 압축 해제한 폴더로 이동 후 실행:

```
cd C:\DYE_MASTER
npm install --production
```

> ⚠️ 인터넷 연결이 필요합니다. 설치에 약 30초 소요됩니다.

### 2-3. 환경 설정 (.env)

압축 해제 시 `.env` 파일이 기본 설정으로 포함되어 있습니다.
필요에 따라 아래 항목을 수정하세요:

```env
PORT=8080                    # 서비스 포트 (기본: 8080)
NODE_ENV=production          # 변경하지 마세요
CORS_ORIGINS=http://localhost:8080   # 접속 허용 주소 (쉼표 구분)
RATE_LIMIT_SESSION=5         # 세션 생성 제한 (분당)
RATE_LIMIT_ROUND=20          # 라운드 제출 제한 (분당)
RATE_LIMIT_RANKING=30        # 랭킹 조회 제한 (분당)
MAX_SESSIONS=1000            # 동시 세션 상한
MAX_RANKINGS=1000            # 랭킹 기록 상한
TRUST_PROXY=false            # 리버스 프록시 사용 시 true로 변경
```

#### 주요 설정 안내

**PORT**: 다른 서비스와 충돌 시 변경합니다.

**CORS_ORIGINS**: 외부에서 접속할 주소를 추가합니다.
```env
# 예시: 내부 IP + 도메인
CORS_ORIGINS=http://localhost:8080,http://192.168.1.100:8080,http://game.company.com:8080
```

**TRUST_PROXY**: Nginx, Apache 등 리버스 프록시 뒤에서 운용할 경우 `true`로 설정합니다.
이 설정이 없으면 Rate Limit이 프록시 IP 1개에 집중되어 전체 사용자가 차단될 수 있습니다.

---

## 3단계: 서버 시작

### 방법 A — start.bat 더블클릭 (가장 간편)

폴더 내 `start.bat` 파일을 더블클릭하면 서버가 시작됩니다.

### 방법 B — CMD에서 직접 실행

```
cd C:\DYE_MASTER
node server/index.js
```

### 시작 확인

서버가 정상 시작되면 아래 메시지가 표시됩니다:

```
  ╔══════════════════════════════════════════════╗
  ║   🎨 DYE MASTER Server v3.0 (Production)    ║
  ║   http://localhost:8080                      ║
  ╚══════════════════════════════════════════════╝
```

브라우저에서 `http://localhost:8080` 접속하여 정상 동작을 확인합니다.

---

## 4단계: 외부 접속 허용

### 같은 네트워크 (LAN) 내 접속

1. CMD에서 서버 PC의 IP 확인:
   ```
   ipconfig
   ```
2. IPv4 주소 확인 (예: `192.168.1.100`)
3. `.env`의 `CORS_ORIGINS`에 해당 IP 추가:
   ```env
   CORS_ORIGINS=http://localhost:8080,http://192.168.1.100:8080
   ```
4. 서버 재시작
5. 다른 PC/모바일에서 `http://192.168.1.100:8080` 접속

### Windows 방화벽 설정

외부 접속이 안 될 경우 방화벽에서 포트를 열어야 합니다:

1. **Windows 검색** → `Windows Defender 방화벽` → **고급 설정**
2. **인바운드 규칙** → **새 규칙**
3. **포트** 선택 → **TCP**, 특정 로컬 포트: `8080`
4. **연결 허용** → **다음** → 이름: `DYE MASTER` → **마침**

---

## 서버 자동 시작 (선택사항)

### Windows 서비스로 등록 (PC 부팅 시 자동 실행)

1. 관리자 CMD에서 NSSM 설치:
   ```
   # winget으로 설치 (Windows 11 / Server 2022)
   winget install nssm
   
   # 또는 https://nssm.cc 에서 직접 다운로드
   ```

2. 서비스 등록:
   ```
   nssm install DyeMaster "C:\Program Files\nodejs\node.exe" "C:\DYE_MASTER\server\index.js"
   nssm set DyeMaster AppDirectory "C:\DYE_MASTER"
   nssm set DyeMaster Description "DYE MASTER Color Game Server"
   nssm start DyeMaster
   ```

3. 서비스 관리:
   ```
   nssm start DyeMaster    # 시작
   nssm stop DyeMaster     # 중지
   nssm restart DyeMaster  # 재시작
   nssm remove DyeMaster   # 삭제
   ```

### 작업 스케줄러 방식 (간편)

1. **Windows 검색** → `작업 스케줄러`
2. **기본 작업 만들기** → 이름: `DYE MASTER`
3. 트리거: **컴퓨터 시작 시**
4. 동작: **프로그램 시작**
   - 프로그램: `C:\Program Files\nodejs\node.exe`
   - 인수: `server/index.js`
   - 시작 위치: `C:\DYE_MASTER`
5. **마침**

---

## 데이터 관리

### 랭킹 데이터

- 위치: `data/rankings.json`
- 서버 실행 중에도 안전하게 백업 가능 (파일 복사)
- 초기화: 파일 내용을 `[]`로 변경 후 서버 재시작

### 랭킹 백업

```
copy data\rankings.json data\rankings_backup_%date:~0,4%%date:~5,2%%date:~8,2%.json
```

---

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| `EADDRINUSE` 에러 | 포트가 이미 사용 중 | `.env`에서 PORT 변경 또는 기존 프로세스 종료 |
| 외부에서 접속 불가 | 방화벽 차단 | 위 방화벽 설정 참조 |
| `MODULE_NOT_FOUND` | npm install 미실행 | `npm install --production` 실행 |
| 랭킹이 초기화됨 | 서버 재시작 시 data/ 폴더 없음 | data/ 폴더 자동 생성됨, rankings.json 백업 권장 |
| Rate Limit 전체 차단 | 리버스 프록시 환경 | `.env`에서 `TRUST_PROXY=true` 설정 |

---

## 기술 지원

- 버전: DYE MASTER v3.0.0
- 엔진: Node.js + Express
- 데이터: JSON 파일 기반 (DB 불필요)
