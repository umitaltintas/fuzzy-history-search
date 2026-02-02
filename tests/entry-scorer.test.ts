import { describe, it, expect } from "vitest";
import { scoreEntry } from "../src/background/entry-scorer";
import type { HistoryEntry } from "../src/shared/types";
import { computeVisitBonus } from "../src/shared/utils";

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  const url = overrides.url || "https://example.com/page";
  const title = overrides.title || "Example Page";
  const urlNoProtocol = url.replace(/^https?:\/\//, "");
  return {
    url,
    title,
    titleLower: title.toLowerCase(),
    urlNoProtocol,
    urlLower: urlNoProtocol.toLowerCase(),
    hostLower: "example.com",
    hostLowerNoWww: "example.com",
    visitCount: 10,
    visitBonus: computeVisitBonus(10),
    lastVisitTime: Date.now() - 3600000, // 1 hour ago
    description: `${title} — <url>${url}</url>`,
    ...overrides,
  };
}

describe("scoreEntry", () => {
  it("returns 0 for empty tokens", () => {
    const entry = makeEntry();
    expect(scoreEntry(entry, [], Date.now())).toBe(0);
  });

  it("returns 0 when no token matches", () => {
    const entry = makeEntry();
    expect(scoreEntry(entry, ["zzzzzzz"], Date.now())).toBe(0);
  });

  it("returns positive score for matching token", () => {
    const entry = makeEntry({ title: "GitHub Dashboard" });
    const score = scoreEntry(entry, ["github"], Date.now());
    expect(score).toBeGreaterThan(0);
  });

  it("adds host exact bonus", () => {
    const now = Date.now();
    const withHost = makeEntry({
      url: "https://github.com/page",
      title: "Page on GitHub",
      hostLower: "github.com",
      hostLowerNoWww: "github.com",
    });
    const withoutHost = makeEntry({
      url: "https://other.com/github-page",
      title: "Page on GitHub",
      hostLower: "other.com",
      hostLowerNoWww: "other.com",
    });
    const scoreWith = scoreEntry(withHost, ["github"], now);
    const scoreWithout = scoreEntry(withoutHost, ["github"], now);
    // Both match "github" in title, but withHost gets host prefix bonus
    expect(scoreWith).toBeGreaterThan(scoreWithout);
  });

  it("adds host prefix bonus", () => {
    const entry = makeEntry({
      hostLower: "github.com",
      hostLowerNoWww: "github.com",
      title: "GitHub",
    });
    const score = scoreEntry(entry, ["github"], Date.now());
    expect(score).toBeGreaterThan(0);
  });

  it("includes visit bonus", () => {
    const highVisit = makeEntry({ visitCount: 100, visitBonus: computeVisitBonus(100) });
    const lowVisit = makeEntry({ visitCount: 1, visitBonus: computeVisitBonus(1) });
    const now = Date.now();
    const high = scoreEntry(highVisit, ["example"], now);
    const low = scoreEntry(lowVisit, ["example"], now);
    expect(high).toBeGreaterThan(low);
  });

  it("includes recency bonus", () => {
    const now = Date.now();
    const recent = makeEntry({ lastVisitTime: now - 60000 }); // 1 min ago
    const old = makeEntry({ lastVisitTime: now - 30 * 24 * 3600000 }); // 30 days ago
    const recentScore = scoreEntry(recent, ["example"], now);
    const oldScore = scoreEntry(old, ["example"], now);
    expect(recentScore).toBeGreaterThan(oldScore);
  });

  it("returns 0 if any token fails to match", () => {
    const entry = makeEntry({ title: "GitHub Dashboard" });
    const score = scoreEntry(entry, ["github", "zzzzzzz"], Date.now());
    expect(score).toBe(0);
  });

  it("gives multi-token consistency bonus", () => {
    const entry = makeEntry({ title: "GitHub Dashboard Settings" });
    const now = Date.now();
    // Both tokens match in title
    const score = scoreEntry(entry, ["github", "dashboard"], now);
    expect(score).toBeGreaterThan(0);
  });
});
