# Plan 2: UI 변경 사항

## 변경 포인트

### 1. 엔트리 화면 (난이도 선택)
- 난이도 라벨에 배율 표시 추가
  - `쉬움 (5초) ×1.0`
  - `보통 (3초) ×1.2`  
  - `어려움 (1초) ×1.5`

### 2. 추측(Guess) 화면
- ❌ 타이머 디스플레이 완전 제거
- ✅ HEX 코드 디스플레이는 유지
- ✅ 제출 버튼 텍스트 `SEND` → `결정`으로 변경 및 한글화 완성

### 3. 라운드 결과(Interim) 화면
- `95.3%` → `953점` 형식으로 변경
- `(12.3s)` 시간 표시 제거
- 난이도 배율 배지 표시 (예: `×1.2`)

### 4. 최종 결과(Scoreboard) 화면
- 라운드별 점수를 `점` 단위로 표시
- 최종 합산 점수 표시 (평균 아님)
- 시간 관련 표시 완전 제거
- 랭킹 리스트의 `%` → `점` 변경
- ✅ `ROUND` 텍스트 크기 축소(`0.85rem`) 및 상단 여백(`top: 1.2vh; left: 5vw;`) 배치로 메인 카드 UI 침범 제거
- ✅ `ROUND` 텍스트 서체도 `Paperlogy ExtraBold (800)` 굵은 서체로 변경

### 5. 애니메이션
- animateValue 함수를 정수 점수에 맞게 조정 (소수점 제거)

## 모듈 연동
- UIManager → ColorUtils.calculateScore() 호출
- UIManager → GameState.DIFFICULTY_MULTIPLIER 참조
- UIManager → Ranking.saveRecord() (difficulty 포함)
