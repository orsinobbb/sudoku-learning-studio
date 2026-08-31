export const REVIEW_INTERVAL_DAYS = Object.freeze([1, 3, 7, 21]);

const uniqueStrings = (value) => [...new Set(Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [])];

export function normalizeLessonResult(raw = {}) {
  const reviewStage = Math.max(0, Math.min(REVIEW_INTERVAL_DAYS.length, Number(raw.reviewStage || 0)));
  return {
    knowledgePassed: raw.knowledgePassed === true,
    passedQuestionIds: uniqueStrings(raw.passedQuestionIds),
    reasonPassedQuestionIds: uniqueStrings(raw.reasonPassedQuestionIds),
    discriminationPassedIds: uniqueStrings(raw.discriminationPassedIds),
    attempts: Math.max(0, Number(raw.attempts || 0)),
    reasonAttempts: Math.max(0, Number(raw.reasonAttempts || 0)),
    discriminationAttempts: Math.max(0, Number(raw.discriminationAttempts || 0)),
    firstTryCorrect: Math.max(0, Number(raw.firstTryCorrect || 0)),
    hintsUsed: Math.max(0, Number(raw.hintsUsed || 0)),
    errorCounts: raw.errorCounts && typeof raw.errorCounts === 'object' ? { ...raw.errorCounts } : {},
    reviewStage,
    lastReviewedAt: typeof raw.lastReviewedAt === 'string' ? raw.lastReviewedAt : null,
    nextReviewAt: typeof raw.nextReviewAt === 'string' ? raw.nextReviewAt : null,
    transferPassed: raw.transferPassed === true
  };
}

function addDays(iso, days) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function scheduleReview(result, { correct = true, now = new Date().toISOString() } = {}) {
  const normalized = normalizeLessonResult(result);
  normalized.reviewStage = correct ? Math.min(REVIEW_INTERVAL_DAYS.length, normalized.reviewStage + 1) : 0;
  normalized.lastReviewedAt = now;
  const interval = REVIEW_INTERVAL_DAYS[Math.max(0, normalized.reviewStage - 1)] || REVIEW_INTERVAL_DAYS[0];
  normalized.nextReviewAt = addDays(now, interval);
  return normalized;
}

export function isReviewDue(result, now = new Date().toISOString()) {
  const normalized = normalizeLessonResult(result);
  return Boolean(normalized.nextReviewAt && new Date(normalized.nextReviewAt).getTime() <= new Date(now).getTime());
}

export function recordDiagnostic(result, code) {
  const normalized = normalizeLessonResult(result);
  if (code) normalized.errorCounts[code] = Number(normalized.errorCounts[code] || 0) + 1;
  return normalized;
}

export function hintSupportFor(result, phase, questionIndex = 0) {
  if (phase === 'worked') return 3;
  if (phase === 'scaffold') {
    if (questionIndex <= 1) return 2;
    if (questionIndex === 2) return 1;
  }
  return 0;
}

export function computeSkillDimensions(result) {
  const normalized = normalizeLessonResult(result);
  const attempted = Math.max(1, normalized.attempts + normalized.reasonAttempts);
  const cleanRate = Math.max(0, 1 - normalized.hintsUsed / Math.max(1, normalized.reasonPassedQuestionIds.length));
  return Object.freeze({
    understanding: normalized.knowledgePassed ? 100 : 0,
    recognition: Math.min(100, Math.round((normalized.discriminationPassedIds.length / 4) * 100)),
    execution: Math.min(100, Math.round((normalized.reasonPassedQuestionIds.length / 6) * 100 * (0.75 + cleanRate * 0.25))),
    transfer: normalized.transferPassed ? 100 : 0,
    retention: Math.min(100, Math.round((normalized.reviewStage / REVIEW_INTERVAL_DAYS.length) * 100)),
    accuracy: Math.min(100, Math.round((normalized.reasonPassedQuestionIds.length / attempted) * 100))
  });
}

export function aggregateSkillDimensions(results = []) {
  if (!results.length) return computeSkillDimensions({});
  const totals = { understanding: 0, recognition: 0, execution: 0, transfer: 0, retention: 0, accuracy: 0 };
  results.map(computeSkillDimensions).forEach((dimensions) => Object.keys(totals).forEach((key) => { totals[key] += dimensions[key]; }));
  return Object.freeze(Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Math.round(value / results.length)])));
}

export function createPuzzleReview({ id, title, elapsed, hints = 0, stalls = 0, analysis, usedTechniques = [], completedAt = new Date().toISOString() }) {
  const techniques = Object.entries(analysis?.techniqueCounts || {}).filter(([, count]) => count > 0).map(([technique, count]) => ({ technique, count }));
  return Object.freeze({
    id,
    title,
    elapsed: Math.max(0, Number(elapsed || 0)),
    hints: Math.max(0, Number(hints || 0)),
    stalls: Math.max(0, Number(stalls || 0)),
    techniques: Object.freeze(techniques.map(Object.freeze)),
    usedTechniques: Object.freeze(uniqueStrings(usedTechniques)),
    logicalOnly: analysis?.logicalOnly === true,
    completedAt
  });
}
