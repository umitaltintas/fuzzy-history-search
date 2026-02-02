import {
  HOST_EXACT_BONUS,
  HOST_PREFIX_BONUS,
  HOST_MATCH_BONUS,
  TITLE_BOUNDARY_SET,
  URL_BOUNDARY_SET,
} from "../shared/constants";
import type { HistoryEntry } from "../shared/types";
import { calculateFuzzyScore } from "./fuzzy-scorer";

export function scoreEntry(entry: HistoryEntry, tokens: string[], now: number): number {
  if (!tokens.length) return 0;

  let totalScore = 0;
  let allTitle = true;
  let allUrl = true;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const titleScore = calculateFuzzyScore(
      entry.title,
      entry.titleLower,
      token,
      TITLE_BOUNDARY_SET,
    );
    const urlScore = calculateFuzzyScore(
      entry.urlNoProtocol,
      entry.urlLower,
      token,
      URL_BOUNDARY_SET,
    );

    if (titleScore === 0 && urlScore === 0) return 0;

    if (titleScore === 0) allTitle = false;
    if (urlScore === 0) allUrl = false;

    totalScore += titleScore > urlScore ? titleScore : urlScore;

    const hostKey = entry.hostLowerNoWww || entry.hostLower;
    if (hostKey) {
      if (hostKey === token) {
        totalScore += HOST_EXACT_BONUS;
      } else if (hostKey.startsWith(token)) {
        totalScore += HOST_PREFIX_BONUS;
      } else if (hostKey.includes(token)) {
        totalScore += HOST_MATCH_BONUS;
      }
    }
  }

  if (totalScore === 0) return 0;

  // Multi-token consistency: bonus when all tokens match in same field
  if (tokens.length > 1 && (allTitle || allUrl)) {
    totalScore += 8;
  }

  // Visit count bonus (log2 scale)
  totalScore += entry.visitBonus;

  // Continuous recency decay (logarithmic, smoother than step function)
  const ageHours = (now - entry.lastVisitTime) / 3600000;
  totalScore += Math.max(0, 14 - 1.8 * Math.log2(ageHours + 1));

  return totalScore;
}
