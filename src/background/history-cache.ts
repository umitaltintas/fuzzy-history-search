import { CACHE_DAYS, MAX_CACHE, MAX_RESULTS } from "../shared/constants";
import type { HistoryEntry } from "../shared/types";
import { escapeXml, extractHost, computeVisitBonus } from "../shared/utils";
import { ext, callApi } from "../shared/browser-api";

export let historyCache: HistoryEntry[] = [];
export let recentTop: HistoryEntry[] = [];
export const historyMap = new Map<string, HistoryEntry>();
export let popupWindowId: number | null = null;
export let openerWindowId: number | null = null;

export function setPopupWindowId(id: number | null): void {
  popupWindowId = id;
}

export function setOpenerWindowId(id: number | null): void {
  openerWindowId = id;
}

export function normalizeEntry(
  item: { url?: string; title?: string; visitCount?: number; lastVisitTime?: number },
  fallback?: HistoryEntry,
): HistoryEntry {
  const url = item.url || fallback?.url || "";
  const title = item.title || fallback?.title || "";
  const urlNoProtocol = url.replace(/^https?:\/\//, "");
  const host = extractHost(urlNoProtocol);
  const hostLower = host.toLowerCase();
  const hostLowerNoWww = hostLower.startsWith("www.") ? hostLower.slice(4) : hostLower;
  const visitCount = Number.isFinite(item.visitCount)
    ? item.visitCount!
    : fallback?.visitCount || 1;
  const displayTitle = title || url;
  const escapedTitle = escapeXml(displayTitle);
  const escapedUrl = escapeXml(url);
  return {
    url,
    title,
    titleLower: title.toLowerCase(),
    urlNoProtocol,
    urlLower: urlNoProtocol.toLowerCase(),
    hostLower,
    hostLowerNoWww,
    visitCount,
    visitBonus: computeVisitBonus(visitCount),
    lastVisitTime: Number.isFinite(item.lastVisitTime)
      ? item.lastVisitTime!
      : fallback?.lastVisitTime || 0,
    description: `${escapedTitle} — <url>${escapedUrl}</url>`,
  };
}

export function rebuildRecentTop(): void {
  recentTop = historyCache
    .slice()
    .sort((a, b) => b.lastVisitTime - a.lastVisitTime)
    .slice(0, MAX_RESULTS);
}

export function getRecentEntries(limit: number): HistoryEntry[] {
  if (limit <= MAX_RESULTS) {
    return recentTop.slice(0, limit);
  }
  return historyCache
    .slice()
    .sort((a, b) => b.lastVisitTime - a.lastVisitTime)
    .slice(0, limit);
}

export function touchRecent(entry: HistoryEntry): void {
  if (!entry) return;
  const next: HistoryEntry[] = [entry];
  for (let i = 0; i < recentTop.length && next.length < MAX_RESULTS; i++) {
    const current = recentTop[i];
    if (current.url !== entry.url) {
      next.push(current);
    }
  }
  recentTop = next;
}

export function pruneOldestEntry(): void {
  if (historyCache.length <= MAX_CACHE) return;
  let oldestIndex = 0;
  let oldestTime = historyCache.length ? historyCache[0].lastVisitTime || 0 : 0;
  for (let i = 1; i < historyCache.length; i++) {
    const time = historyCache[i].lastVisitTime || 0;
    if (time < oldestTime) {
      oldestTime = time;
      oldestIndex = i;
    }
  }
  const [removed] = historyCache.splice(oldestIndex, 1);
  if (removed) {
    historyMap.delete(removed.url);
  }
}

export async function loadHistory(): Promise<void> {
  const ninetyDaysAgo = Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000;
  const results = await callApi<chrome.history.HistoryItem[]>(ext?.history, "search", {
    text: "",
    startTime: ninetyDaysAgo,
    maxResults: 5000,
  });

  historyCache = [];
  historyMap.clear();

  for (const item of results) {
    const entry = normalizeEntry(item);
    historyCache.push(entry);
    historyMap.set(entry.url, entry);
  }

  rebuildRecentTop();
}

export function getActiveTabEntry(windowId?: number | null): Promise<HistoryEntry | null> {
  return (async () => {
    try {
      const query = Number.isFinite(windowId)
        ? { active: true as const, windowId: windowId as number }
        : { active: true as const, currentWindow: true as const };
      const tabs = await callApi<chrome.tabs.Tab[]>(ext?.tabs, "query", query);
      const tab = tabs && tabs[0];
      if (!tab || !tab.url) return null;
      const fallback = historyMap.get(tab.url);
      const entry = normalizeEntry({ url: tab.url, title: tab.title || "" }, fallback);
      entry.isActive = true;
      return entry;
    } catch {
      return null;
    }
  })();
}

export function handleVisited(item: chrome.history.HistoryItem): void {
  const existing = historyMap.get(item.url!);
  const entry = normalizeEntry(item, existing);
  const visitTime = Number.isFinite(item.lastVisitTime) ? item.lastVisitTime! : Date.now();

  if (existing && !Number.isFinite(item.visitCount)) {
    entry.visitCount = existing.visitCount + 1;
    entry.visitBonus = computeVisitBonus(entry.visitCount);
  }

  if (existing) {
    existing.title = entry.title;
    existing.titleLower = entry.titleLower;
    existing.urlNoProtocol = entry.urlNoProtocol;
    existing.urlLower = entry.urlLower;
    existing.hostLower = entry.hostLower;
    existing.hostLowerNoWww = entry.hostLowerNoWww;
    existing.visitCount = entry.visitCount;
    existing.visitBonus = entry.visitBonus;
    existing.lastVisitTime = visitTime;
    existing.description = entry.description;
    touchRecent(existing);
    return;
  }

  entry.lastVisitTime = visitTime;
  historyCache.push(entry);
  historyMap.set(entry.url, entry);
  pruneOldestEntry();
  touchRecent(entry);
}
