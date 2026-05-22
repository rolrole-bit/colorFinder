# Plan 1: Antigravity IDE 업데이트 오류 해결 계획

## 1. 작업 목적
Antigravity IDE 업데이트 도중 발생한 `CreateProcess 실패 (코드 2: 지정된 파일을 찾을 수 없습니다)` 에러 및 업데이트 프로세스 실패 문제를 해결하여 IDE를 정상 구동 가능한 상태로 복구한다.

## 2. 핵심 기능
- **프로세스 진단**: Antigravity IDE와 관련된 실행 중인 프로세스를 감지하고 종료하여 파일 잠금 문제를 방지한다.
- **파일 복구**: `_` 임시 디렉토리에 격리되어 있는 Antigravity IDE 실행 파일 및 종속성 라이브러리들을 원래 설치 경로(`C:\Users\j.rhee\AppData\Local\Programs\Antigravity IDE`)로 안전하게 이동/복원한다.
- **실행 확인**: 복구된 `Antigravity IDE.exe`를 구동하여 정상 동작 여부를 확인한다.

## 3. 입력과 출력
- **입력**: 
  - 사용자 환경의 프로세스 상태 정보
  - `C:\Users\j.rhee\AppData\Local\Programs\Antigravity IDE\_` 경로의 파일 목록
- **출력**: 
  - 원래 설치 경로로 복구 완료된 파일 구조
  - 프로세스 종료 및 파일 이동 처리 결과 로그

## 4. 파일 구조
이 작업은 코딩 프로젝트가 아닌 시스템 복구 작업이므로, 복구 스크립트는 임시로 작성하여 실행하거나 명령어로 직접 수행한다.
- 임시 복구 스크립트: `e:\AI\DYE_MASTER\colorFinder\tools\restore_ide.ps1` (필요 시 작성)

## 5. 핵심 모듈
- **프로세스 확인 및 종료 모듈**: PowerShell `Get-Process` 및 `Stop-Process` 명령어 사용.
- **파일 이동 모듈**: PowerShell `Move-Item` 또는 `Robocopy` 사용.

## 6. 실행 흐름
1. 실행 중인 `Antigravity` 프로세스 검사.
2. 실행 중인 프로세스가 있다면 안전하게 종료.
3. `C:\Users\j.rhee\AppData\Local\Programs\Antigravity IDE\_` 내부의 모든 파일 및 폴더를 상위 폴더로 이동.
4. 이동 완료 후 빈 `_` 디렉토리 삭제.
5. 복구된 `Antigravity IDE.exe` 실행 테스트.

## 7. 에러 처리
- **파일 잠김 에러**: 프로세스가 종료되지 않아 파일 이동이 실패할 경우, 프로세스 강제 종료(`-Force`)를 재시도하거나 사용자에게 재부팅 후 실행을 안내한다.
- **권한 부족 에러**: 이동 권한이 부족한 경우 관리자 권한으로의 승격 또는 안내 메시지를 출력한다.

## 8. 테스트 전략
- 복원 후 `C:\Users\j.rhee\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe` 파일이 존재하는지 검증한다.
- 프로세스를 실행하여 에러 없이 구동되는지 확인한다.

## 9. 완료 기준
- `Antigravity IDE.exe`가 원래 설치 경로에 존재함.
- IDE가 실행되었을 때 "지정된 파일을 찾을 수 없습니다" 에러가 발생하지 않고 정상 실행됨.
