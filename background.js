// ============================================================
// Fuzzy History Search - Background Script
// ============================================================

// --- History Cache ---

const isBrowserApi = typeof browser !== "undefined";
const ext = isBrowserApi
  ? browser
  : typeof chrome !== "undefined"
    ? chrome
    : null;

function callApi(namespace, method, ...args) {
  if (!namespace || !namespace[method]) {
    return Promise.reject(new Error(`Missing API: ${method}`));
  }
  if (isBrowserApi) {
    return namespace[method](...args);
  }
  return new Promise((resolve, reject) => {
    namespace[method](...args, (result) => {
      const err = ext?.runtime?.lastError;
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

const CACHE_DAYS = 90;
const MAX_CACHE = 6000;
const MAX_RESULTS = 6;
const UI_MAX_RESULTS = 40;
const POPUP_WIDTH = 760;
const POPUP_HEIGHT = 560;
const VISIT_WEIGHT = 4;
const MAX_VISIT_BONUS = 24;
const HOST_EXACT_BONUS = 20;
const HOST_PREFIX_BONUS = 10;
const HOST_MATCH_BONUS = 6;
const ACTIVE_MATCH_BONUS = 15;
const INPUT_DEBOUNCE_MS = 30;

let historyCache = [];
let recentTop = [];
const historyMap = new Map();
let popupWindowId = null;
let openerWindowId = null;

function computeVisitBonus(visitCount) {
  return Math.min(
    Math.log2(visitCount + 1) * VISIT_WEIGHT,
    MAX_VISIT_BONUS,
  );
}

function extractHost(urlNoProtocol) {
  if (!urlNoProtocol) return "";
  const end = urlNoProtocol.search(/[/?#]/);
  return end === -1 ? urlNoProtocol : urlNoProtocol.slice(0, end);
}

function normalizeEntry(item, fallback) {
  const url = item.url || fallback?.url || "";
  const title = item.title || fallback?.title || "";
  const urlNoProtocol = url.replace(/^https?:\/\//, "");
  const host = extractHost(urlNoProtocol);
  const hostLower = host.toLowerCase();
  const hostLowerNoWww = hostLower.startsWith("www.")
    ? hostLower.slice(4)
    : hostLower;
  const visitCount = Number.isFinite(item.visitCount)
    ? item.visitCount
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
      ? item.lastVisitTime
      : fallback?.lastVisitTime || 0,
    description: `${escapedTitle} — <url>${escapedUrl}</url>`,
  };
}

function rebuildRecentTop() {
  recentTop = historyCache
    .slice()
    .sort((a, b) => b.lastVisitTime - a.lastVisitTime)
    .slice(0, MAX_RESULTS);
}

function getRecentEntries(limit) {
  if (limit <= MAX_RESULTS) {
    return recentTop.slice(0, limit);
  }
  return historyCache
    .slice()
    .sort((a, b) => b.lastVisitTime - a.lastVisitTime)
    .slice(0, limit);
}

function touchRecent(entry) {
  if (!entry) return;
  const next = [entry];
  for (let i = 0; i < recentTop.length && next.length < MAX_RESULTS; i++) {
    const current = recentTop[i];
    if (current.url !== entry.url) {
      next.push(current);
    }
  }
  recentTop = next;
}

function pruneOldestEntry() {
  if (historyCache.length <= MAX_CACHE) return;
  let oldestIndex = 0;
  let oldestTime = historyCache.length
    ? historyCache[0].lastVisitTime || 0
    : 0;
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

async function loadHistory() {
  const ninetyDaysAgo =
    Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000;
  const results = await callApi(ext.history, "search", {
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

loadHistory().catch(() => {
  historyCache = [];
  recentTop = [];
  historyMap.clear();
});

async function getActiveTabEntry(windowId) {
  try {
    const query = Number.isFinite(windowId)
      ? { active: true, windowId }
      : { active: true, currentWindow: true };
    const tabs = await callApi(ext.tabs, "query", {
      ...query,
    });
    const tab = tabs && tabs[0];
    if (!tab || !tab.url) return null;
    const fallback = historyMap.get(tab.url);
    const entry = normalizeEntry(
      { url: tab.url, title: tab.title || "" },
      fallback,
    );
    entry.isActive = true;
    return entry;
  } catch {
    return null;
  }
}

async function openSearchWindow() {
  if (!ext) return;
  if (popupWindowId) {
    try {
      await callApi(ext.windows, "remove", popupWindowId);
    } catch {
      // Ignore if already closed.
    }
    popupWindowId = null;
  }

  let openerWindow;
  try {
    openerWindow = await callApi(ext.windows, "getLastFocused");
  } catch {
    try {
      openerWindow = await callApi(ext.windows, "getCurrent");
    } catch {
      openerWindow = null;
    }
  }

  openerWindowId = openerWindow?.id ?? null;
  const baseLeft = openerWindow?.left ?? 0;
  const baseTop = openerWindow?.top ?? 0;
  const baseWidth = openerWindow?.width ?? POPUP_WIDTH;
  const baseHeight = openerWindow?.height ?? POPUP_HEIGHT;
  const left = Math.round(
    baseLeft + (baseWidth - POPUP_WIDTH) / 2,
  );
  const top = Math.round(
    baseTop + (baseHeight - POPUP_HEIGHT) / 2,
  );
  const url =
    ext.runtime.getURL("ui/index.html") +
    (openerWindowId ? `?opener=${openerWindowId}` : "");

  try {
    const popup = await callApi(ext.windows, "create", {
      url,
      type: "popup",
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
      left,
      top,
      focused: true,
    });
    popupWindowId = popup?.id ?? null;
  } catch {
    popupWindowId = null;
  }
}

async function openSearchOverlay() {
  if (!ext?.tabs) return false;
  try {
    const tabs = await callApi(ext.tabs, "query", {
      active: true,
      currentWindow: true,
    });
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) return false;
    const tabUrl = tab.url || "";
    if (
      tabUrl.startsWith("about:") ||
      tabUrl.startsWith("moz-extension:") ||
      tabUrl.startsWith("chrome://") ||
      tabUrl.startsWith("chrome-extension:") ||
      tabUrl.startsWith("edge://") ||
      tabUrl.startsWith("view-source:")
    ) {
      return false;
    }

    if (ext.scripting && ext.scripting.executeScript) {
      await callApi(ext.scripting, "executeScript", {
        target: { tabId: tab.id },
        files: ["ui/overlay.js"],
      });
    } else {
      await callApi(ext.tabs, "executeScript", tab.id, {
        file: "ui/overlay.js",
      });
    }
    return true;
  } catch {
    return false;
  }
}

function formatResultEntry(entry) {
  return {
    url: entry.url,
    title: entry.title,
    visitCount: entry.visitCount,
    lastVisitTime: entry.lastVisitTime,
    isActive: Boolean(entry.isActive),
  };
}

async function getSearchResults(query, limit, sourceWindowId) {
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

async function openResult(url, disposition, sourceWindowId) {
  if (!ext || !url) return;
  let targetWindowId = Number.isFinite(sourceWindowId)
    ? sourceWindowId
    : openerWindowId;

  if (!Number.isFinite(targetWindowId)) {
    try {
      const fallbackWindow = await callApi(
        ext.windows,
        "getLastFocused",
      );
      targetWindowId = fallbackWindow?.id ?? null;
    } catch {
      targetWindowId = null;
    }
  }

  const windowQuery = Number.isFinite(targetWindowId)
    ? { windowId: targetWindowId }
    : { currentWindow: true };
  const createProps = Number.isFinite(targetWindowId)
    ? { windowId: targetWindowId }
    : {};

  try {
    if (disposition === "currentTab") {
      const tabs = await callApi(ext.tabs, "query", {
        active: true,
        ...windowQuery,
      });
      const activeTab = tabs && tabs[0];
      if (activeTab && activeTab.id != null) {
        await callApi(ext.tabs, "update", activeTab.id, { url });
      } else {
        await callApi(ext.tabs, "create", {
          ...createProps,
          url,
        });
      }
    } else if (disposition === "newBackgroundTab") {
      await callApi(ext.tabs, "create", {
        ...createProps,
        url,
        active: false,
      });
    } else {
      await callApi(ext.tabs, "create", {
        ...createProps,
        url,
        active: true,
      });
    }
  } finally {
    if (popupWindowId) {
      try {
        await callApi(ext.windows, "remove", popupWindowId);
      } catch {
        // Ignore if already closed.
      }
      popupWindowId = null;
    }
  }
}

ext.history.onVisited.addListener((item) => {
  const existing = historyMap.get(item.url);
  const entry = normalizeEntry(item, existing);
  const visitTime = Number.isFinite(item.lastVisitTime)
    ? item.lastVisitTime
    : Date.now();

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
});

// --- Fuzzy Scorer (fzf-style DP with fast paths) ---

const URL_BOUNDARIES = ["/", ".", "?", "#", "&", "=", " ", "-", "_", "~", "+", "%"];
const TITLE_BOUNDARIES = [" ", "-", "_", ":", "|", "/", "(", ")", "[", "]"];
const URL_BOUNDARY_SET = new Set(URL_BOUNDARIES);
const TITLE_BOUNDARY_SET = new Set(TITLE_BOUNDARIES);

const SCORE_MATCH = 16;
const SCORE_GAP_START = -3;
const BONUS_BOUNDARY = 10;
const BONUS_CAMEL = 8;
const BONUS_DIGIT_TRANSITION = 6;
const BONUS_CONSECUTIVE = 12;
const BONUS_FIRST_CHAR = 10;

// Pre-allocated DP buffers (avoids GC pressure during scoring)
const DP_MAX = 1024;
const _dpPrevMatch = new Float64Array(DP_MAX);
const _dpCurrMatch = new Float64Array(DP_MAX);
const _dpPrevBest = new Float64Array(DP_MAX);
const _dpCurrBest = new Float64Array(DP_MAX);
const _dpPrevConsec = new Uint8Array(DP_MAX);
const _dpCurrConsec = new Uint8Array(DP_MAX);
const _dpBonuses = new Int8Array(DP_MAX);

function charBonus(targetOrig, targetLower, idx, boundarySet) {
  if (idx === 0) return BONUS_FIRST_CHAR;
  const prev = targetLower[idx - 1];
  if (boundarySet.has(prev)) return BONUS_BOUNDARY;
  const prevOrig = targetOrig[idx - 1];
  const currOrig = targetOrig[idx];
  if (
    prevOrig >= "a" &&
    prevOrig <= "z" &&
    currOrig >= "A" &&
    currOrig <= "Z"
  ) {
    return BONUS_CAMEL;
  }
  const prevIsDigit = prev >= "0" && prev <= "9";
  const currIsDigit = targetLower[idx] >= "0" && targetLower[idx] <= "9";
  if (prevIsDigit !== currIsDigit) return BONUS_DIGIT_TRANSITION;
  return 0;
}

function calculateFuzzyScore(
  targetOrig,
  targetLower,
  queryLower,
  boundarySet,
) {
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
  let subIdx = targetLower.indexOf(queryLower);
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
        const cBonus =
          BONUS_CONSECUTIVE > _dpBonuses[j]
            ? BONUS_CONSECUTIVE
            : _dpBonuses[j];
        const cScore = prevMatch[j - 1] + SCORE_MATCH + cBonus;
        if (cScore > score) {
          score = cScore;
          consec = prevConsec[j - 1] + 1;
        }
      }

      // Option B: non-consecutive (gap from best previous match before j)
      const prevBestVal = j > 0 ? prevBest[j - 1] : 0;
      if (prevBestVal > 0) {
        const gScore =
          prevBestVal + SCORE_MATCH + _dpBonuses[j] + SCORE_GAP_START;
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

function greedyScore(targetOrig, targetLower, queryLower, boundarySet) {
  const tLen = targetLower.length;
  const qLen = queryLower.length;
  let score = 0;
  let qi = 0;
  let lastIdx = -1;

  for (let ti = 0; ti < tLen && qi < qLen; ti++) {
    if (targetLower[ti] === queryLower[qi]) {
      let bonus =
        SCORE_MATCH + charBonus(targetOrig, targetLower, ti, boundarySet);
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

function scoreEntry(entry, tokens, now) {
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

ext.omnibox.setDefaultSuggestion({
  description: "Fuzzy History Search: yazarak arama yapin",
});

let lastQueryLower = "";
let lastTopEntries = [];
let lastCandidates = null;
let pendingTimer = null;
let pendingRequestId = 0;

function getQueryTokens(queryLower) {
  const tokens = queryLower.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    tokens.sort((a, b) => b.length - a.length);
  }
  return tokens;
}

function isBetterCandidate(score, entry, other) {
  if (score !== other.score) return score > other.score;
  if (entry.visitCount !== other.entry.visitCount) {
    return entry.visitCount > other.entry.visitCount;
  }
  return entry.lastVisitTime > other.entry.lastVisitTime;
}

function compareCandidates(a, b) {
  if (a.score !== b.score) return b.score - a.score;
  if (a.entry.visitCount !== b.entry.visitCount) {
    return b.entry.visitCount - a.entry.visitCount;
  }
  return b.entry.lastVisitTime - a.entry.lastVisitTime;
}

function getTopEntries(tokens, limit, candidates) {
  const top = [];
  const matched = [];
  const now = Date.now();
  const list = candidates || historyCache;

  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const score = scoreEntry(entry, tokens, now);
    if (score <= 0) continue;

    matched.push(entry);

    if (
      top.length >= limit &&
      !isBetterCandidate(score, entry, top[top.length - 1])
    ) {
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

function mergeActiveResult(top, activeEntry, tokens, limit = MAX_RESULTS) {
  if (!activeEntry) return top;
  const now = Date.now();
  let activeScore = scoreEntry(activeEntry, tokens, now);
  if (activeScore <= 0) return top;
  activeScore += ACTIVE_MATCH_BONUS;

  const filtered = top.filter(
    (item) => item.entry.url !== activeEntry.url,
  );
  const activeItem = {
    entry: activeEntry,
    score: activeScore,
  };
  const merged = filtered.concat(activeItem);
  merged.sort(compareCandidates);

  if (merged.length <= limit) {
    return merged;
  }

  const activeIndex = merged.findIndex(
    (item) => item.entry.url === activeEntry.url,
  );
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

function buildRecentList(activeEntry, limit = MAX_RESULTS) {
  const recentEntries = getRecentEntries(limit);
  if (!activeEntry) return recentEntries.slice();
  const list = [activeEntry];
  for (let i = 0; i < recentEntries.length && list.length < limit; i++) {
    const entry = recentEntries[i];
    if (entry.url !== activeEntry.url) {
      list.push(entry);
    }
  }
  return list;
}

function buildSuggestions(entries) {
  return entries.map((entry) => ({
    content: entry.url,
    description: entry.isActive
      ? `Aktif: ${entry.description}`
      : entry.description,
  }));
}

ext.omnibox.onInputChanged.addListener((text, suggest) => {
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
      lastCandidates &&
      lastQueryLower &&
      queryLower.startsWith(lastQueryLower)
        ? lastCandidates
        : null;
    const { top, matched } = getTopEntries(
      tokens,
      MAX_RESULTS,
      candidates,
    );

    activeEntryPromise.then((activeEntry) => {
      if (requestId !== pendingRequestId) return;
      const merged = mergeActiveResult(top, activeEntry, tokens);
      lastQueryLower = queryLower;
      lastCandidates = matched;
      lastTopEntries = merged.map((item) => item.entry);
      suggest(buildSuggestions(lastTopEntries));
    });
  }, INPUT_DEBOUNCE_MS);
});

ext.omnibox.onInputEntered.addListener((url, disposition) => {
  // If user typed something that's not a URL, fall back to first result
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    const query = url.trim();
    if (!query) return;

    const queryLower = query.toLowerCase();
    if (queryLower === lastQueryLower && lastTopEntries.length > 0) {
      url = lastTopEntries[0].url;
    } else {
      const tokens = getQueryTokens(queryLower);
      const { top } = getTopEntries(tokens, 1, null);
      if (top.length === 0) return;
      url = top[0].entry.url;
    }
  }

  switch (disposition) {
    case "currentTab":
      ext.tabs.update({ url });
      break;
    case "newForegroundTab":
      ext.tabs.create({ url });
      break;
    case "newBackgroundTab":
      ext.tabs.create({ url, active: false });
      break;
  }
});

if (ext?.commands) {
  ext.commands.onCommand.addListener((command) => {
    if (command === "open-fuzzy-search") {
      openSearchOverlay().then((opened) => {
        if (!opened) {
          openSearchWindow();
        }
      });
    }
  });
}

if (ext?.windows) {
  ext.windows.onRemoved.addListener((windowId) => {
    if (windowId === popupWindowId) {
      popupWindowId = null;
    }
  });
}

if (ext?.runtime) {
  ext.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      if (!message || typeof message !== "object") {
        return false;
      }

      const sourceWindowId = Number.isFinite(message.openerWindowId)
        ? message.openerWindowId
        : sender?.tab?.windowId ?? null;

      if (message.type === "search") {
        const limit = Number.isFinite(message.limit)
          ? message.limit
          : UI_MAX_RESULTS;
        getSearchResults(message.query, limit, sourceWindowId)
          .then((results) => {
            sendResponse({ results });
          })
          .catch(() => {
            sendResponse({ results: [] });
          });
        return true;
      }

      if (message.type === "open") {
        openResult(
          message.url,
          message.disposition,
          sourceWindowId,
        )
          .then(() => {
            sendResponse({ ok: true });
          })
          .catch(() => {
            sendResponse({ ok: false });
          });
        return true;
      }

      if (message.type === "close") {
        if (popupWindowId) {
          callApi(ext.windows, "remove", popupWindowId).catch(() => {});
          popupWindowId = null;
        }
        sendResponse({ ok: true });
        return true;
      }

      return false;
    },
  );
}
