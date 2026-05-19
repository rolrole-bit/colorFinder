/**
 * ScoreComment - 점수 기반 한줄평 생성 모듈
 * 
 * 담당: 최종 점수에 따라 10단계 평가 텍스트 반환
 * ScoreboardView에서 분리됨
 */

/**
 * 점수 기반 한줄평 (10단계, 심사위원 평가 톤)
 * @param {number} score - 최종 점수
 * @returns {string} 평가 텍스트
 */
export function getScoreComment(score) {
  if (score >= 2700) return "색감의 끝에 도달한 자. 당신은 전설입니다.";
  if (score >= 2400) return "압도적 정밀도. 프로페셔널 수준의 색채 감각입니다.";
  if (score >= 2100) return "탁월합니다. 색의 미세한 결까지 읽어내고 있습니다.";
  if (score >= 1800) return "상당한 실력입니다. 대부분의 색을 정확히 포착하고 있습니다.";
  if (score >= 1500) return "평균 이상의 색감. 훈련하면 더 높은 곳에 갈 수 있습니다.";
  if (score >= 1200) return "색의 방향은 잡고 있습니다. 채도와 명도에 더 집중해 보세요.";
  if (score >= 900)  return "기본기는 있습니다. 미세한 차이를 구별하는 연습이 필요합니다.";
  if (score >= 600)  return "색의 윤곽이 보이기 시작했습니다. 조금 더 집중해 보세요.";
  if (score >= 300)  return "아직 색과 친해지는 중입니다. 다시 도전해 보세요.";
  return "색감 훈련이 필요합니다. 포기하지 마세요, 누구나 처음은 있으니까요.";
}
