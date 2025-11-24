export const STORAGE_PREFIX = 'keto14-rick-';

export const KEYS = {
  NAME: `${STORAGE_PREFIX}name`,
  THEME: `${STORAGE_PREFIX}theme`,
  START_DATE: `${STORAGE_PREFIX}start-date`,
  PLAN_WEEKS: `${STORAGE_PREFIX}plan-weeks`,
  DAILY_VIEW: `${STORAGE_PREFIX}daily-view`,
  PRIMARY_COLOR: `${STORAGE_PREFIX}primary-color`,
  HEIGHT: `${STORAGE_PREFIX}height-cm`,
  START_WEIGHT: `${STORAGE_PREFIX}start-weight`,
  AGE: `${STORAGE_PREFIX}age`,
  LANG: `${STORAGE_PREFIX}lang`,
  LIKE_FOODS: `${STORAGE_PREFIX}like-foods`,
  DISLIKE_FOODS: `${STORAGE_PREFIX}dislike-foods`,
  API_USER: `${STORAGE_PREFIX}api-user`,
  API_PASS: `${STORAGE_PREFIX}api-pass`,
  GENDER: `${STORAGE_PREFIX}gender`,
  WORKOUT_INTENSITY: `${STORAGE_PREFIX}workout-intensity`,
  WATER_GOAL: `${STORAGE_PREFIX}water-goal`,
  SELECTED_DAY: `${STORAGE_PREFIX}sel-day`,
  SELECTED_WEEK: `${STORAGE_PREFIX}sel-week`
};

export const DYNAMIC_KEYS = {
  AI_DAY: `${STORAGE_PREFIX}ai-day-`,
  AI_WORKOUT: `${STORAGE_PREFIX}ai-workout-`,
  AI_WEEK: `${STORAGE_PREFIX}ai-week-`,
  AI_REVIEW: `${STORAGE_PREFIX}ai-review-`,
  CAL: `${STORAGE_PREFIX}cal-`,
  CHEAT: `${STORAGE_PREFIX}cheat-`,
  PROGRESS: `${STORAGE_PREFIX}prog-`,
  WATER: `${STORAGE_PREFIX}water-`,
  DONE: `${STORAGE_PREFIX}done-`,
  BADGE: `${STORAGE_PREFIX}badge-`,
  AI_SHOPPING: `${STORAGE_PREFIX}ai-shopping-`
};

export default {
  STORAGE_PREFIX,
  KEYS,
  DYNAMIC_KEYS
};
