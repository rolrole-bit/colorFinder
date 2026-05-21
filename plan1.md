# 작업 목적
게임 진입 불가 버그(Syntax Error) 수정

# 핵심 기능
- `ScoreboardView.js` 내 중복 선언된 `btnLeftColor`, `btnRightColor` 변수 제거

# 입력과 출력
입력: 중복 선언으로 인해 모듈 로딩 시 런타임 에러 발생하여 게임 렌더링 불가
출력: 구문 오류(Syntax Error)가 해결되어 정상적으로 게임 엔트리 화면 진입

# 파일 구조
- `src/ui/ScoreboardView.js` 수정

# 핵심 모듈
- `ScoreboardView.js` 내부 `renderScoreBoardView`

# 실행 흐름
- 모듈 로딩 시 에러 없이 파일이 파싱되어 정상적으로 초기화 로직이 동작함

# 에러 처리
- N/A

# 테스트 전략
- 수정 후 브라우저 개발자 도구(Console)에서 Syntax Error가 사라졌는지 확인
- 초기 구동 시 "DYE MASTER" 로딩 후 게임 진입 화면이 나오는지 확인

# 완료 기준
- 중복 선언 변수 제거로 구문 에러 해결
