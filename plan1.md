# Plan 1: 점수 시스템 리팩토링 (Core / Logic)

## 기능 목록
1. 시간 관련 로직 완전 제거 (timeTaken, 시간 패널티)
2. 점수 산정 공식 변경: accuracy² × 1000 × 난이도배율
3. 난이도 배율 상수 추가 (Easy ×1.0, Normal ×1.2, Hard ×1.5)
4. 3라운드 합산 방식으로 최종 점수 계산
5. Ranking 모듈에 난이도 정보 포함

## 변경 파일
- `src/utils/ColorUtils.js`: calculateAccuracy → calculateScore
- `src/core/GameState.js`: timeTaken 제거, DIFFICULTY_MULTIPLIER 추가
- `src/core/Ranking.js`: difficulty 포함 저장
- `src/ui/UIManager.js`: 타이머 UI 제거, 점수 표시 변경

## 점수 공식
```
deltaE = |Rdiff| + |Gdiff| + |Bdiff|
accuracy = (765 - deltaE) / 765
baseScore = accuracy² × 1000
roundScore = floor(baseScore × multiplier)
finalScore = sum(roundScores)
```

## 난이도 배율
| 난이도 | 배율 | 라운드 만점 | 총점 만점 |
|--------|------|-----------|----------|
| Easy   | ×1.0 | 1,000     | 3,000    |
| Normal | ×1.2 | 1,200     | 3,600    |
| Hard   | ×1.5 | 1,500     | 4,500    |

## 테스트 전략
- calculateScore 단위 테스트 (정확 일치, 완전 불일치, 중간값)
- 난이도 배율 적용 검증
- 3라운드 합산 검증
