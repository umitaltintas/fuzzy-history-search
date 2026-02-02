export const CACHE_DAYS = 90;
export const MAX_CACHE = 6000;
export const MAX_RESULTS = 6;
export const UI_MAX_RESULTS = 40;
export const POPUP_WIDTH = 760;
export const POPUP_HEIGHT = 560;
export const VISIT_WEIGHT = 4;
export const MAX_VISIT_BONUS = 24;
export const HOST_EXACT_BONUS = 20;
export const HOST_PREFIX_BONUS = 10;
export const HOST_MATCH_BONUS = 6;
export const ACTIVE_MATCH_BONUS = 15;
export const INPUT_DEBOUNCE_MS = 30;

export const SCORE_MATCH = 16;
export const SCORE_GAP_START = -3;
export const BONUS_BOUNDARY = 10;
export const BONUS_CAMEL = 8;
export const BONUS_DIGIT_TRANSITION = 6;
export const BONUS_CONSECUTIVE = 12;
export const BONUS_FIRST_CHAR = 10;

export const URL_BOUNDARIES = ["/", ".", "?", "#", "&", "=", " ", "-", "_", "~", "+", "%"];
export const TITLE_BOUNDARIES = [" ", "-", "_", ":", "|", "/", "(", ")", "[", "]"];
export const URL_BOUNDARY_SET = new Set(URL_BOUNDARIES);
export const TITLE_BOUNDARY_SET = new Set(TITLE_BOUNDARIES);

export const DP_MAX = 1024;
