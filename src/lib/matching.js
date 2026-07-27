// 키워드 기반 질문 매칭 로직
// qaList: [{ id, question, answer, keywords: [string], subject }]

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[?!.,~^ㅋㅎㅠㅜ\s]+/g, "")
    .trim();
}

// 두 문자열 사이의 자모 단위 부분일치 점수 (간단 버전: 포함관계 + 공통 부분 길이)
function overlapScore(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }
  return 0;
}

/**
 * 학생 질문에 가장 잘 맞는 Q&A 항목을 찾는다.
 * @param {string} query 학생이 입력한 질문
 * @param {Array} qaList 등록된 Q&A 목록
 * @param {number} threshold 매칭 최소 점수 (기본 0.34)
 * @returns {{ item: object|null, score: number }}
 */
export function matchQuestion(query, qaList, threshold = 0.34) {
  const nq = normalize(query);
  if (!nq || !qaList || qaList.length === 0) {
    return { item: null, score: 0 };
  }

  let best = null;
  let bestScore = 0;

  for (const item of qaList) {
    const keywords = item.keywords || [];
    let kwHits = 0;
    for (const kw of keywords) {
      const nkw = normalize(kw);
      if (!nkw) continue;
      if (nq.includes(nkw)) kwHits += 1;
    }
    const kwScore = keywords.length > 0 ? kwHits / keywords.length : 0;

    const qScore = overlapScore(nq, normalize(item.question));

    // 키워드가 하나라도 정확히 매칭되면 가중치를 높게 준다
    const hasExactKwHit = kwHits > 0;
    const combined = hasExactKwHit
      ? Math.max(kwScore, 0.5) + qScore * 0.2
      : qScore;

    if (combined > bestScore) {
      bestScore = combined;
      best = item;
    }
  }

  if (bestScore >= threshold) {
    return { item: best, score: bestScore };
  }
  return { item: null, score: bestScore };
}

// 질문 텍스트에서 관리자가 키워드를 쉽게 뽑을 수 있도록 후보 제안 (아주 단순한 버전)
export function suggestKeywords(question) {
  const cleaned = (question || "").replace(/[?!.,]/g, "");
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
  return [...new Set(words)].slice(0, 6);
}
