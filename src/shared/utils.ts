import { VISIT_WEIGHT, MAX_VISIT_BONUS } from "./constants";

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function extractHost(urlNoProtocol: string): string {
  if (!urlNoProtocol) return "";
  const end = urlNoProtocol.search(/[/?#]/);
  return end === -1 ? urlNoProtocol : urlNoProtocol.slice(0, end);
}

export function computeVisitBonus(visitCount: number): number {
  return Math.min(Math.log2(visitCount + 1) * VISIT_WEIGHT, MAX_VISIT_BONUS);
}
