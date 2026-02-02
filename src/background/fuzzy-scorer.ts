import {
  SCORE_MATCH,
  SCORE_GAP_START,
  BONUS_BOUNDARY,
  BONUS_CAMEL,
  BONUS_DIGIT_TRANSITION,
  BONUS_CONSECUTIVE,
  BONUS_FIRST_CHAR,
  DP_MAX,
} from "../shared/constants";

// Pre-allocated DP buffers (avoids GC pressure during scoring)
const _dpPrevMatch = new Float64Array(DP_MAX);
const _dpCurrMatch = new Float64Array(DP_MAX);
const _dpPrevBest = new Float64Array(DP_MAX);
const _dpCurrBest = new Float64Array(DP_MAX);
const _dpPrevConsec = new Uint8Array(DP_MAX);
const _dpCurrConsec = new Uint8Array(DP_MAX);
const _dpBonuses = new Int8Array(DP_MAX);

export function charBonus(
  targetOrig: string,
  targetLower: string,
  idx: number,
  boundarySet: Set<string>,
): number {
  if (idx === 0) return BONUS_FIRST_CHAR;
  const prev = targetLower[idx - 1];
  if (boundarySet.has(prev)) return BONUS_BOUNDARY;
  const prevOrig = targetOrig[idx - 1];
  const currOrig = targetOrig[idx];
  if (prevOrig >= "a" && prevOrig <= "z" && currOrig >= "A" && currOrig <= "Z") {
    return BONUS_CAMEL;
  }
  const prevIsDigit = prev >= "0" && prev <= "9";
  const currIsDigit = targetLower[idx] >= "0" && targetLower[idx] <= "9";
  if (prevIsDigit !== currIsDigit) return BONUS_DIGIT_TRANSITION;
  return 0;
}

export function greedyScore(
  targetOrig: string,
  targetLower: string,
  queryLower: string,
  boundarySet: Set<string>,
): number {
  const tLen = targetLower.length;
  const qLen = queryLower.length;
  let score = 0;
  let qi = 0;
  let lastIdx = -1;

  for (let ti = 0; ti < tLen && qi < qLen; ti++) {
    if (targetLower[ti] === queryLower[qi]) {
      let bonus = SCORE_MATCH + charBonus(targetOrig, targetLower, ti, boundarySet);
      if (lastIdx === ti - 1) {
        bonus += BONUS_CONSECUTIVE;
      } else if (lastIdx !== -1) {
        bonus += SCORE_GAP_START;
      }
      score += bonus;
      lastIdx = ti;
      qi++;
    }
  }
  return qi === qLen ? score : 0;
}

export function calculateFuzzyScore(
  targetOrig: string,
  targetLower: string,
  queryLower: string,
  boundarySet: Set<string>,
): number {
  if (!targetLower || !queryLower) return 0;
  const tLen = targetLower.length;
  const qLen = queryLower.length;
  if (qLen > tLen || qLen === 0) return 0;

  // Fast path: exact match
  if (targetLower === queryLower) return 300;

  // Fast path: exact prefix
  if (targetLower.startsWith(queryLower)) {
    let score = 200 + qLen;
    for (let i = 0; i < qLen; i++) {
      score += charBonus(targetOrig, targetLower, i, boundarySet);
    }
    return score;
  }

  // Fast path: substring (prefer boundary-aligned occurrence)
  const subIdx = targetLower.indexOf(queryLower);
  if (subIdx !== -1) {
    let bestIdx = subIdx;
    let bestBonus = charBonus(targetOrig, targetLower, subIdx, boundarySet);
    let nextIdx = subIdx;
    let checks = 0;
    while (bestBonus < BONUS_BOUNDARY && checks < 3) {
      nextIdx = targetLower.indexOf(queryLower, nextIdx + 1);
      if (nextIdx === -1) break;
      const b = charBonus(targetOrig, targetLower, nextIdx, boundarySet);
      if (b > bestBonus) {
        bestBonus = b;
        bestIdx = nextIdx;
      }
      checks++;
    }
    let score = 100 + qLen + bestBonus;
    score += (qLen - 1) * BONUS_CONSECUTIVE;
    score -= Math.min(Math.floor(bestIdx / 3), 12);
    return score;
  }

  // Forward pass: verify all query chars can be matched in order
  let qi = 0;
  for (let ti = 0; ti < tLen; ti++) {
    if (targetLower[ti] === queryLower[qi]) qi++;
    if (qi === qLen) break;
  }
  if (qi !== qLen) return 0;

  // Fallback to greedy for extremely long targets
  if (tLen > DP_MAX) {
    return greedyScore(targetOrig, targetLower, queryLower, boundarySet);
  }

  // Precompute position bonuses
  for (let j = 0; j < tLen; j++) {
    _dpBonuses[j] = charBonus(targetOrig, targetLower, j, boundarySet);
  }

  // DP scoring for optimal fuzzy alignment
  //
  // prevMatch[j] = best score when query[i-1] is matched at target[j]
  // prevBest[j]  = max(prevMatch[0..j]) = best score for query[0..i-1] ending at or before j
  // prevConsec[j] = consecutive match count ending at (i-1, j)

  let prevMatch = _dpPrevMatch;
  let currMatch = _dpCurrMatch;
  let prevBest = _dpPrevBest;
  let currBest = _dpCurrBest;
  let prevConsec = _dpPrevConsec;
  let currConsec = _dpCurrConsec;

  // First query character (i = 0)
  let runMax = 0;
  for (let j = 0; j < tLen; j++) {
    prevMatch[j] = 0;
    if (targetLower[j] === queryLower[0]) {
      prevMatch[j] = SCORE_MATCH + _dpBonuses[j];
    }
    if (prevMatch[j] > runMax) runMax = prevMatch[j];
    prevBest[j] = runMax;
    prevConsec[j] = prevMatch[j] > 0 ? 1 : 0;
  }

  // Subsequent query characters (i = 1..qLen-1)
  for (let i = 1; i < qLen; i++) {
    runMax = 0;
    for (let j = 0; j < tLen; j++) {
      currMatch[j] = 0;
      currConsec[j] = 0;
      if (j < i) {
        currBest[j] = 0;
        continue;
      }

      if (targetLower[j] !== queryLower[i]) {
        currBest[j] = runMax;
        continue;
      }

      let score = 0;
      let consec = 0;

      // Option A: consecutive with previous query char matched at j-1
      if (j > 0 && prevMatch[j - 1] > 0) {
        const cBonus = BONUS_CONSECUTIVE > _dpBonuses[j] ? BONUS_CONSECUTIVE : _dpBonuses[j];
        const cScore = prevMatch[j - 1] + SCORE_MATCH + cBonus;
        if (cScore > score) {
          score = cScore;
          consec = prevConsec[j - 1] + 1;
        }
      }

      // Option B: non-consecutive (gap from best previous match before j)
      const prevBestVal = j > 0 ? prevBest[j - 1] : 0;
      if (prevBestVal > 0) {
        const gScore = prevBestVal + SCORE_MATCH + _dpBonuses[j] + SCORE_GAP_START;
        if (gScore > score) {
          score = gScore;
          consec = 1;
        }
      }

      currMatch[j] = score;
      currConsec[j] = consec;
      if (score > runMax) runMax = score;
      currBest[j] = runMax;
    }

    // Swap rows
    const tM = prevMatch;
    prevMatch = currMatch;
    currMatch = tM;
    const tB = prevBest;
    prevBest = currBest;
    currBest = tB;
    const tC = prevConsec;
    prevConsec = currConsec;
    currConsec = tC;
  }

  return prevBest[tLen - 1];
}
