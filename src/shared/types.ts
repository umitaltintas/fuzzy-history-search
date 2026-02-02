export interface HistoryEntry {
  url: string;
  title: string;
  titleLower: string;
  urlNoProtocol: string;
  urlLower: string;
  hostLower: string;
  hostLowerNoWww: string;
  visitCount: number;
  visitBonus: number;
  lastVisitTime: number;
  description: string;
  isActive?: boolean;
}

export interface SearchResult {
  url: string;
  title: string;
  visitCount: number;
  lastVisitTime: number;
  isActive: boolean;
}

export interface ScoredEntry {
  entry: HistoryEntry;
  score: number;
}
