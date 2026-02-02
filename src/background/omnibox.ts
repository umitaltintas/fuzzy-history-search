import { MAX_RESULTS, INPUT_DEBOUNCE_MS } from "../shared/constants";
import type { HistoryEntry, ScoredEntry } from "../shared/types";
import { ext } from "../shared/browser-api";
import { getActiveTabEntry } from "./history-cache";
import { getQueryTokens, getTopEntries, mergeActiveResult, buildRecentList } from "./search";

ext!.omnibox.setDefaultSuggestion({
  description: "Fuzzy History Search: type to search",
});

let lastQueryLower = "";
let lastTopEntries: HistoryEntry[] = [];
let lastCandidates: HistoryEntry[] | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let pendingRequestId = 0;

function buildSuggestions(
  entries: HistoryEntry[],
): chrome.omnibox.SuggestResult[] {
  return entries.map((entry) => ({
    content: entry.url,
    description: entry.isActive ? `Active: ${entry.description}` : entry.description,
  }));
}

export function setupOmnibox(): void {
  ext!.omnibox.onInputChanged.addListener(
    (text: string, suggest: (suggestions: chrome.omnibox.SuggestResult[]) => void) => {
      const query = text.trim();
      const queryLower = query.toLowerCase();
      const requestId = ++pendingRequestId;

      if (pendingTimer) {
        clearTimeout(pendingTimer);
      }

      pendingTimer = setTimeout(() => {
        if (requestId !== pendingRequestId) return;

        const activeEntryPromise = getActiveTabEntry();

        if (!queryLower) {
          activeEntryPromise.then((activeEntry) => {
            if (requestId !== pendingRequestId) return;
            lastQueryLower = "";
            lastCandidates = null;
            const recent = buildRecentList(activeEntry);
            lastTopEntries = recent;
            suggest(buildSuggestions(recent));
          });
          return;
        }

        const tokens = getQueryTokens(queryLower);
        const candidates =
          lastCandidates && lastQueryLower && queryLower.startsWith(lastQueryLower)
            ? lastCandidates
            : null;
        const { top, matched } = getTopEntries(tokens, MAX_RESULTS, candidates);

        activeEntryPromise.then((activeEntry) => {
          if (requestId !== pendingRequestId) return;
          const merged = mergeActiveResult(top, activeEntry, tokens);
          lastQueryLower = queryLower;
          lastCandidates = matched;
          lastTopEntries = merged.map((item: ScoredEntry) => item.entry);
          suggest(buildSuggestions(lastTopEntries));
        });
      }, INPUT_DEBOUNCE_MS);
    },
  );

  ext!.omnibox.onInputEntered.addListener((url: string, disposition: string) => {
    let resolvedUrl = url;
    if (!resolvedUrl.startsWith("http://") && !resolvedUrl.startsWith("https://")) {
      const query = resolvedUrl.trim();
      if (!query) return;

      const queryLower = query.toLowerCase();
      if (queryLower === lastQueryLower && lastTopEntries.length > 0) {
        resolvedUrl = lastTopEntries[0].url;
      } else {
        const tokens = getQueryTokens(queryLower);
        const { top } = getTopEntries(tokens, 1, null);
        if (top.length === 0) return;
        resolvedUrl = top[0].entry.url;
      }
    }

    switch (disposition) {
      case "currentTab":
        ext!.tabs.update({ url: resolvedUrl });
        break;
      case "newForegroundTab":
        ext!.tabs.create({ url: resolvedUrl });
        break;
      case "newBackgroundTab":
        ext!.tabs.create({ url: resolvedUrl, active: false });
        break;
    }
  });
}
