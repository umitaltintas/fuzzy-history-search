import { describe, it, expect } from "vitest";
import { calculateFuzzyScore, charBonus, greedyScore } from "../src/background/fuzzy-scorer";
import { URL_BOUNDARY_SET, TITLE_BOUNDARY_SET, BONUS_FIRST_CHAR, BONUS_BOUNDARY, BONUS_CAMEL, BONUS_DIGIT_TRANSITION } from "../src/shared/constants";

describe("charBonus", () => {
  it("returns BONUS_FIRST_CHAR for index 0", () => {
    expect(charBonus("hello", "hello", 0, TITLE_BOUNDARY_SET)).toBe(BONUS_FIRST_CHAR);
  });

  it("returns BONUS_BOUNDARY after a boundary character", () => {
    expect(charBonus("foo bar", "foo bar", 4, TITLE_BOUNDARY_SET)).toBe(BONUS_BOUNDARY);
  });

  it("returns BONUS_CAMEL for camelCase transition", () => {
    expect(charBonus("fooBar", "foobar", 3, TITLE_BOUNDARY_SET)).toBe(BONUS_CAMEL);
  });

  it("returns BONUS_DIGIT_TRANSITION for digit/letter boundary", () => {
    expect(charBonus("abc123", "abc123", 3, TITLE_BOUNDARY_SET)).toBe(BONUS_DIGIT_TRANSITION);
  });

  it("returns 0 for normal mid-word character", () => {
    expect(charBonus("hello", "hello", 2, TITLE_BOUNDARY_SET)).toBe(0);
  });
});

describe("calculateFuzzyScore", () => {
  it("returns 0 for empty query", () => {
    expect(calculateFuzzyScore("hello", "hello", "", TITLE_BOUNDARY_SET)).toBe(0);
  });

  it("returns 0 for empty target", () => {
    expect(calculateFuzzyScore("", "", "hello", TITLE_BOUNDARY_SET)).toBe(0);
  });

  it("returns 0 when query is longer than target", () => {
    expect(calculateFuzzyScore("hi", "hi", "hello", TITLE_BOUNDARY_SET)).toBe(0);
  });

  it("returns 300 for exact match", () => {
    expect(calculateFuzzyScore("hello", "hello", "hello", TITLE_BOUNDARY_SET)).toBe(300);
  });

  it("scores exact prefix higher than substring", () => {
    const prefix = calculateFuzzyScore("github.com/foo", "github.com/foo", "github", URL_BOUNDARY_SET);
    const sub = calculateFuzzyScore("api.github.com/foo", "api.github.com/foo", "github", URL_BOUNDARY_SET);
    expect(prefix).toBeGreaterThan(sub);
  });

  it("finds substring matches", () => {
    const score = calculateFuzzyScore("Hello World", "hello world", "world", TITLE_BOUNDARY_SET);
    expect(score).toBeGreaterThan(0);
  });

  it("returns 0 when no characters match", () => {
    expect(calculateFuzzyScore("hello", "hello", "xyz", TITLE_BOUNDARY_SET)).toBe(0);
  });

  it("handles fuzzy (non-contiguous) matches via DP", () => {
    const score = calculateFuzzyScore(
      "document_handler",
      "document_handler",
      "dh",
      TITLE_BOUNDARY_SET,
    );
    expect(score).toBeGreaterThan(0);
  });

  it("prefers boundary-aligned substring matches", () => {
    const boundary = calculateFuzzyScore(
      "foo/bar/baz",
      "foo/bar/baz",
      "bar",
      URL_BOUNDARY_SET,
    );
    const mid = calculateFuzzyScore(
      "foobarbaz",
      "foobarbaz",
      "bar",
      URL_BOUNDARY_SET,
    );
    expect(boundary).toBeGreaterThan(mid);
  });

  it("scores single character queries", () => {
    const score = calculateFuzzyScore("hello", "hello", "h", TITLE_BOUNDARY_SET);
    expect(score).toBeGreaterThan(0);
  });

  it("handles URL boundary set correctly", () => {
    const score = calculateFuzzyScore(
      "github.com/user/repo",
      "github.com/user/repo",
      "user",
      URL_BOUNDARY_SET,
    );
    expect(score).toBeGreaterThan(100);
  });
});

describe("greedyScore", () => {
  it("returns positive score for matching characters", () => {
    const score = greedyScore("hello world", "hello world", "hw", TITLE_BOUNDARY_SET);
    expect(score).toBeGreaterThan(0);
  });

  it("returns 0 when not all query chars are found", () => {
    const score = greedyScore("hello", "hello", "hxz", TITLE_BOUNDARY_SET);
    expect(score).toBe(0);
  });

  it("gives consecutive match bonus", () => {
    const consecutive = greedyScore("hello", "hello", "he", TITLE_BOUNDARY_SET);
    const nonConsecutive = greedyScore("h_e_llo", "h_e_llo", "he", TITLE_BOUNDARY_SET);
    expect(consecutive).toBeGreaterThan(nonConsecutive);
  });
});
