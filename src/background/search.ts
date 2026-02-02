import { MAX_RESULTS, ACTIVE_MATCH_BONUS } from "../shared/constants";
import type { HistoryEntry, SearchResult, ScoredEntry } from "../shared/types";
import { scoreEntry } from "./entry-scorer";
import {
  historyCache,
  getRecentEntries,
  getActiveTabEntry,
} from "./history-cache";

export function formatResultEntry(entry: HistoryEntry): SearchResult {
  return {
    url: entry.url,
    title: entry.title,
    visitCount: entry.visitCount,
    lastVisitTime: entry.lastVisitTime,
    isActive: Boolean(entry.isActive),
  };
}

export function getQueryTokens(queryLower: string): string[] {
  const tokens = queryLower.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    tokens.sort((a, b) => b.length - a.length);
  }
  return tokens;
}

function isBetterCandidate(score: number, entry: HistoryEntry, other: ScoredEntry): boolean {
  if (score !== other.score) return score > other.score;
  if (entry.visitCount !== other.entry.visitCount) {
    return entry.visitCount > other.entry.visitCount;
  }
  return entry.lastVisitTime > other.entry.lastVisitTime;
}

export function compareCandidates(a: ScoredEntry, b: ScoredEntry): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.entry.visitCount !== b.entry.visitCount) {
    return b.entry.visitCount - a.entry.visitCount;
  }
  return b.entry.lastVisitTime - a.entry.lastVisitTime;
}

export function getTopEntries(
  tokens: string[],
  limit: number,
  candidates: HistoryEntry[] | null,
): { top: ScoredEntry[]; matched: HistoryEntry[] } {
  const top: ScoredEntry[] = [];
  const matched: HistoryEntry[] = [];
  const now = Date.now();
  const list = candidates || historyCache;

  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const score = scoreEntry(entry, tokens, now);
    if (score <= 0) continue;

    matched.push(entry);

    if (top.length >= limit && !isBetterCandidate(score, entry, top[top.length - 1])) {
      continue;
    }

    let insertAt = top.length;
    while (insertAt > 0 && isBetterCandidate(score, entry, top[insertAt - 1])) {
      insertAt--;
    }
    top.splice(insertAt, 0, { entry, score });
    if (top.length > limit) {
      top.pop();
    }
  }

  return { top, matched };
}

export function mergeActiveResult(
  top: ScoredEntry[],
  activeEntry: HistoryEntry | null,
  tokens: string[],
  limit: number = MAX_RESULTS,
): ScoredEntry[] {
  if (!activeEntry) return top;
  const now = Date.now();
  let activeScore = scoreEntry(activeEntry, tokens, now);
  if (activeScore <= 0) return top;
  activeScore += ACTIVE_MATCH_BONUS;

  const filtered = top.filter((item) => item.entry.url !== activeEntry.url);
  const activeItem: ScoredEntry = {
    entry: activeEntry,
    score: activeScore,
  };
  const merged = filtered.concat(activeItem);
  merged.sort(compareCandidates);

  if (merged.length <= limit) {
    return merged;
  }

  const activeIndex = merged.findIndex((item) => item.entry.url === activeEntry.url);
  if (activeIndex < limit) {
    return merged.slice(0, limit);
  }

  const trimmed = merged
    .filter((item) => item.entry.url !== activeEntry.url)
    .slice(0, limit - 1);
  trimmed.push(activeItem);
  trimmed.sort(compareCandidates);
  return trimmed;
}

export function buildRecentList(
  activeEntry: HistoryEntry | null,
  limit: number = MAX_RESULTS,
): HistoryEntry[] {
  const recentEntries = getRecentEntries(limit);
  if (!activeEntry) return recentEntries.slice();
  const list: HistoryEntry[] = [activeEntry];
  for (let i = 0; i < recentEntries.length && list.length < limit; i++) {
    const entry = recentEntries[i];
    if (entry.url !== activeEntry.url) {
      list.push(entry);
    }
  }
  return list;
}

export async function getSearchResults(
  query: string,
  limit: number,
  sourceWindowId: number | null,
): Promise<SearchResult[]> {
  const queryLower = (query || "").trim().toLowerCase();
  const activeEntry = await getActiveTabEntry(sourceWindowId);

  if (!queryLower) {
    const recent = buildRecentList(activeEntry, limit);
    return recent.map(formatResultEntry);
  }

  const tokens = getQueryTokens(queryLower);
  const { top } = getTopEntries(tokens, limit, null);
  const merged = mergeActiveResult(top, activeEntry, tokens, limit);
  return merged.map((item) => formatResultEntry(item.entry));
}
