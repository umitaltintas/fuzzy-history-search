// ============================================================
// Fuzzy History Search - Background Script
// ============================================================

// --- History Cache ---

let historyCache = [];

async function loadHistory() {
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const results = await browser.history.search({
    text: "",
    startTime: ninetyDaysAgo,
    maxResults: 5000,
  });
  historyCache = results.map((item) => ({
    url: item.url,
    title: item.title || "",
    visitCount: item.visitCount || 1,
    lastVisitTime: item.lastVisitTime || 0,
  }));
}

loadHistory();

browser.history.onVisited.addListener((item) => {
  const idx = historyCache.findIndex((h) => h.url === item.url);
  const entry = {
    url: item.url,
    title: item.title || "",
    visitCount: item.visitCount || 1,
    lastVisitTime: item.lastVisitTime || Date.now(),
  };
  if (idx !== -1) {
    historyCache[idx] = entry;
  } else {
    historyCache.unshift(entry);
    if (historyCache.length > 6000) {
      historyCache.pop();
    }
  }
});

// --- Fuzzy Scorer (adapted from Zen Browser #calculateFuzzyScore) ---

const URL_BOUNDARIES = ["/", ".", "?", "#", "&", "=", " ", "-", "_"];
const TITLE_BOUNDARIES = [" ", "-", "_"];

function calculateFuzzyScore(target, query, boundaries) {
  if (!target || !query) return 0;

  const targetLower = target.toLowerCase();
  const queryLower = query.toLowerCase();
  const targetLen = target.length;
  const queryLen = query.length;

  if (queryLen > targetLen) return 0;
  if (queryLen === 0) return 0;

  // Exact match
  if (targetLower === queryLower) return 200;

  // Exact prefix
  if (targetLower.startsWith(queryLower)) return 100 + queryLen;

  let score = 0;
  let queryIndex = 0;
  let lastMatchIndex = -1;
  let consecutiveMatches = 0;

  for (let targetIndex = 0; targetIndex < targetLen; targetIndex++) {
    if (
      queryIndex < queryLen &&
      targetLower[targetIndex] === queryLower[queryIndex]
    ) {
      let bonus = 10;

      // Word boundary bonus
      if (
        targetIndex === 0 ||
        boundaries.includes(targetLower[targetIndex - 1])
      ) {
        bonus += 15;
      }

      // Consecutive match bonus
      if (lastMatchIndex === targetIndex - 1) {
        consecutiveMatches++;
        bonus += 20 * consecutiveMatches;
      } else {
        consecutiveMatches = 0;
      }

      // Distance penalty
      if (lastMatchIndex !== -1) {
        const distance = targetIndex - lastMatchIndex;
        bonus -= Math.min(distance - 1, 10);
      }

      score += bonus;
      lastMatchIndex = targetIndex;
      queryIndex++;
    }
  }

  return queryIndex === queryLen ? score : 0;
}

function scoreEntry(entry, query) {
  // Strip protocol for URL scoring
  const urlForScoring = entry.url.replace(/^https?:\/\//, "");

  const titleScore = calculateFuzzyScore(
    entry.title,
    query,
    TITLE_BOUNDARIES,
  );
  const urlScore = calculateFuzzyScore(
    urlForScoring,
    query,
    URL_BOUNDARIES,
  );
  let score = Math.max(titleScore, urlScore);

  if (score === 0) return 0;

  // Visit count bonus (log2 scale, max 15)
  score += Math.min(Math.log2(entry.visitCount + 1) * 3, 15);

  // Recency bonus
  const age = Date.now() - entry.lastVisitTime;
  const ONE_HOUR = 3600000;
  const ONE_DAY = 86400000;
  const ONE_WEEK = 604800000;

  if (age < ONE_HOUR) {
    score += 10;
  } else if (age < ONE_DAY) {
    score += 5;
  } else if (age < ONE_WEEK) {
    score += 2;
  }

  return score;
}

// --- XML Escape ---

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// --- Omnibox Handlers ---

browser.omnibox.setDefaultSuggestion({
  description: "Fuzzy History Search: yazarak arama yapin",
});

browser.omnibox.onInputChanged.addListener((text, suggest) => {
  const query = text.trim();

  if (!query) {
    // Show most recent visits when query is empty
    const recent = historyCache
      .slice()
      .sort((a, b) => b.lastVisitTime - a.lastVisitTime)
      .slice(0, 6);

    suggest(
      recent.map((entry) => ({
        content: entry.url,
        description: `${escapeXml(entry.title || entry.url)} — <url>${escapeXml(entry.url)}</url>`,
      })),
    );
    return;
  }

  const scored = [];
  for (const entry of historyCache) {
    const score = scoreEntry(entry, query);
    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 6);

  suggest(
    top.map(({ entry }) => ({
      content: entry.url,
      description: `${escapeXml(entry.title || entry.url)} — <url>${escapeXml(entry.url)}</url>`,
    })),
  );
});

browser.omnibox.onInputEntered.addListener((url, disposition) => {
  // If user typed something that's not a URL, fall back to first result
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    const query = url.trim();
    if (query) {
      const scored = [];
      for (const entry of historyCache) {
        const score = scoreEntry(entry, query);
        if (score > 0) {
          scored.push({ entry, score });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      if (scored.length > 0) {
        url = scored[0].entry.url;
      } else {
        return;
      }
    } else {
      return;
    }
  }

  switch (disposition) {
    case "currentTab":
      browser.tabs.update({ url });
      break;
    case "newForegroundTab":
      browser.tabs.create({ url });
      break;
    case "newBackgroundTab":
      browser.tabs.create({ url, active: false });
      break;
  }
});
