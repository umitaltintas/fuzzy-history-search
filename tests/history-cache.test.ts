import { describe, it, expect } from "vitest";
import { normalizeEntry, pruneOldestEntry, rebuildRecentTop, historyCache, historyMap, recentTop } from "../src/background/history-cache";

describe("normalizeEntry", () => {
  it("normalizes a basic history item", () => {
    const entry = normalizeEntry({
      url: "https://www.example.com/path?q=1",
      title: "Example",
      visitCount: 5,
      lastVisitTime: 1000,
    });

    expect(entry.url).toBe("https://www.example.com/path?q=1");
    expect(entry.title).toBe("Example");
    expect(entry.titleLower).toBe("example");
    expect(entry.urlNoProtocol).toBe("www.example.com/path?q=1");
    expect(entry.urlLower).toBe("www.example.com/path?q=1");
    expect(entry.hostLower).toBe("www.example.com");
    expect(entry.hostLowerNoWww).toBe("example.com");
    expect(entry.visitCount).toBe(5);
    expect(entry.lastVisitTime).toBe(1000);
  });

  it("uses fallback values when item fields are missing", () => {
    const fallback = normalizeEntry({
      url: "https://example.com",
      title: "Fallback Title",
      visitCount: 10,
      lastVisitTime: 2000,
    });

    const entry = normalizeEntry({ url: "https://example.com" }, fallback);
    expect(entry.title).toBe("Fallback Title");
    expect(entry.visitCount).toBe(10);
    expect(entry.lastVisitTime).toBe(2000);
  });

  it("strips www. from host", () => {
    const entry = normalizeEntry({ url: "https://www.github.com/user" });
    expect(entry.hostLowerNoWww).toBe("github.com");
  });

  it("handles empty url", () => {
    const entry = normalizeEntry({});
    expect(entry.url).toBe("");
    expect(entry.hostLower).toBe("");
  });

  it("escapes XML in description", () => {
    const entry = normalizeEntry({
      url: "https://example.com",
      title: 'Test <script> & "quotes"',
    });
    expect(entry.description).toContain("&lt;script&gt;");
    expect(entry.description).toContain("&amp;");
    expect(entry.description).toContain("&quot;quotes&quot;");
  });

  it("computes visit bonus correctly", () => {
    const entry = normalizeEntry({ url: "https://x.com", visitCount: 1 });
    expect(entry.visitBonus).toBeGreaterThan(0);
    expect(entry.visitBonus).toBeLessThanOrEqual(24);
  });
});

describe("pruneOldestEntry", () => {
  it("removes the oldest entry when cache exceeds MAX_CACHE", () => {
    // Reset state
    historyCache.length = 0;
    historyMap.clear();

    // Fill cache beyond MAX_CACHE (we'll use a small set and manipulate)
    for (let i = 0; i < 6001; i++) {
      const entry = normalizeEntry({
        url: `https://example.com/${i}`,
        title: `Page ${i}`,
        lastVisitTime: i === 0 ? 1 : 1000 + i,
      });
      historyCache.push(entry);
      historyMap.set(entry.url, entry);
    }

    expect(historyCache.length).toBe(6001);
    pruneOldestEntry();
    expect(historyCache.length).toBe(6000);
    // Entry with lastVisitTime=1 (index 0) should be removed
    expect(historyMap.has("https://example.com/0")).toBe(false);

    // Cleanup
    historyCache.length = 0;
    historyMap.clear();
  });

  it("does nothing when cache is within limit", () => {
    historyCache.length = 0;
    historyMap.clear();

    for (let i = 0; i < 10; i++) {
      const entry = normalizeEntry({
        url: `https://example.com/${i}`,
        lastVisitTime: 1000 + i,
      });
      historyCache.push(entry);
      historyMap.set(entry.url, entry);
    }

    pruneOldestEntry();
    expect(historyCache.length).toBe(10);

    historyCache.length = 0;
    historyMap.clear();
  });
});

describe("rebuildRecentTop", () => {
  it("builds top entries sorted by lastVisitTime", () => {
    historyCache.length = 0;
    historyMap.clear();

    const times = [100, 500, 300, 200, 400, 600, 150, 350];
    for (let i = 0; i < times.length; i++) {
      const entry = normalizeEntry({
        url: `https://example.com/${i}`,
        title: `Page ${i}`,
        lastVisitTime: times[i],
      });
      historyCache.push(entry);
    }

    rebuildRecentTop();

    expect(recentTop.length).toBe(6); // MAX_RESULTS
    expect(recentTop[0].lastVisitTime).toBe(600);
    expect(recentTop[1].lastVisitTime).toBe(500);

    // Verify ordering
    for (let i = 1; i < recentTop.length; i++) {
      expect(recentTop[i - 1].lastVisitTime).toBeGreaterThanOrEqual(recentTop[i].lastVisitTime);
    }

    historyCache.length = 0;
    historyMap.clear();
  });
});
