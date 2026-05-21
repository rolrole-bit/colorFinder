# 작업 요약
명도 대비 계산 공식을 HSL 색상 공간 기반의 지능형 보색 대비 공식(`getHSLContrastColor`)으로 재설계 및 전격 교체했습니다.
배경색이 중간 명도("L의 붉은 영역")에 걸칠 때 반전색도 중간 명도에 머물러 글자가 묻히는 문제를 해결하기 위해, 중간 명도 영역 진입 시 명도를 강제로 밝은 영역(85%) 또는 어두운 영역(15%)으로 밀어내는 임계치 클램프 필터를 구현했습니다.

## 변경 세부 내용
1. **[NEW] HSL 대비 계산 함수**
   - [ColorUtils.js](file:///e:/AI/DYE_MASTER/colorFinder/src/utils/ColorUtils.js#L76-L121) 파일 내에 `getHSLContrastColor(r, g, b)` 유틸리티를 새로 구현했습니다.
   - H(Hue)는 180도 회전(보색)합니다.
   - S(Saturation)는 반전하되, 가독성 확보를 위해 최소 채도 30%를 보정합니다.
   - L(Lightness)은 반전하되 중간 명도 영역(30%~70%)에 들어갈 시 `L <= 50`일 때는 15%로, `L > 50`일 때는 85%로 강제 밀어냅니다.

2. **[MODIFY] 각 뷰 적용**
   - [GameView.js](file:///e:/AI/DYE_MASTER/colorFinder/src/ui/GameView.js)
   - [ResultView.js](file:///e:/AI/DYE_MASTER/colorFinder/src/ui/ResultView.js)
   - [ScoreboardView.js](file:///e:/AI/DYE_MASTER/colorFinder/src/ui/ScoreboardView.js)
   - 위 뷰들에서 기존의 검정/흰색 단순 분기 함수(`getContrastYIQ`) 호출을 전량 제거하고 새롭게 설계된 `getHSLContrastColor`를 적용했습니다.

---

# 직접 튜닝하시는 방법 (컨트라스트 공식 위치 안내)

텍스트의 명도 대비 감도나 밀어내는 강도를 원하시는 대로 직접 수정하고 싶다면 아래 파일을 열어 주시면 됩니다.

### 수정할 파일 및 함수 위치:
- **경로**: [src/utils/ColorUtils.js](file:///e:/AI/DYE_MASTER/colorFinder/src/utils/ColorUtils.js#L76-L121)
- **함수명**: `getHSLContrastColor(r, g, b)`

### 수정 포인트 코드 (L 밀어내기 부분):
```javascript
  // 1. 중간 명도(붉은 영역) 기준 범위 설정
  const redZoneStart = 30; // 이 값보다 높고
  const redZoneEnd = 70;   // 이 값보다 낮은 영역을 붉은 영역(중간 명도)으로 지정합니다.
  
  // 2. 붉은 영역 진입 시 밀어내는 명도(Lightness) 수치 설정
  if (lContrast >= redZoneStart && lContrast <= redZoneEnd) {
    if (lContrast <= 50) {
      lContrast = 15; // 어두운 텍스트가 필요할 때 15% 명도로 확 밀어내어 가독성 확보
    } else {
      lContrast = 85; // 밝은 텍스트가 필요할 때 85% 명도로 확 밀어내어 가독성 확보
    }
  }
```

이 부분의 `redZoneStart`, `redZoneEnd`를 바꾸어 감도 범위를 조절하거나, `15`와 `85` 값을 조절하여(예: 10% / 90% 등) 더 극단적이거나 혹은 더 부드러운 명도 대비를 직접 튜닝하실 수 있습니다.
