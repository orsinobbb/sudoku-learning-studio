export const PROGRESS_KEY = 'sudoku-learning-progress';
export const SESSION_KEY = 'sudoku-learning-session';

const ARRAY_FIELDS = ['completedLessons', 'completedDrills', 'completedPuzzles'];

function safeParse(value) {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}

export function readProgress(storage = localStorage) {
  const raw = safeParse(storage.getItem(PROGRESS_KEY)) || {};
  return {
    solvedCount: Number(raw.solvedCount || 0),
    completedLessons: Array.isArray(raw.completedLessons) ? raw.completedLessons : [],
    completedDrills: Array.isArray(raw.completedDrills) ? raw.completedDrills : [],
    completedPuzzles: Array.isArray(raw.completedPuzzles) ? raw.completedPuzzles : [],
    activities: Array.isArray(raw.activities) ? raw.activities.slice(0, 60) : [],
    totalActivities: Number(raw.totalActivities || raw.activities?.length || 0),
    hintsUsed: Number(raw.hintsUsed || 0),
    analysesRun: Number(raw.analysesRun || 0),
    lessonResults: raw.lessonResults && typeof raw.lessonResults === 'object' ? raw.lessonResults : {},
    levelQualifications: raw.levelQualifications && typeof raw.levelQualifications === 'object' ? raw.levelQualifications : {},
    challengeBestTimes: raw.challengeBestTimes && typeof raw.challengeBestTimes === 'object' ? raw.challengeBestTimes : {},
    puzzleReviews: Array.isArray(raw.puzzleReviews) ? raw.puzzleReviews.slice(0, 30) : [],
    techniqueUsage: raw.techniqueUsage && typeof raw.techniqueUsage === 'object' ? raw.techniqueUsage : {}
  };
}

export function writeProgress(progress, storage = localStorage) {
  storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 8, ...progress, updatedAt: new Date().toISOString() }));
}

function uniqueList(...lists) {
  return [...new Set(lists.flat().filter((value) => typeof value === 'string' && value))];
}

function eventKey(item = {}) {
  return [item.id, item.type, item.detail, item.at, item.completedAt].filter(Boolean).join('|');
}

function mergeEventLists(local = [], remote = [], limit = 60) {
  const found = new Map();
  [...local, ...remote].forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const key = eventKey(item) || JSON.stringify(item);
    if (!found.has(key)) found.set(key, item);
  });
  return [...found.values()]
    .sort((a, b) => String(b.at || b.completedAt || '').localeCompare(String(a.at || a.completedAt || '')))
    .slice(0, limit);
}

function mergeCounters(local = {}, remote = {}) {
  const merged = { ...remote, ...local };
  for (const key of new Set([...Object.keys(remote || {}), ...Object.keys(local || {})])) {
    const left = local?.[key];
    const right = remote?.[key];
    if (typeof left === 'number' || typeof right === 'number') merged[key] = Math.max(Number(left || 0), Number(right || 0));
    else if (typeof left === 'boolean' || typeof right === 'boolean') merged[key] = Boolean(left || right);
    else if (Array.isArray(left) || Array.isArray(right)) merged[key] = uniqueList(left || [], right || []);
  }
  return merged;
}

function mergeRecordMap(local = {}, remote = {}) {
  const merged = {};
  for (const key of new Set([...Object.keys(remote || {}), ...Object.keys(local || {})])) {
    const left = local?.[key];
    const right = remote?.[key];
    merged[key] = left && right && typeof left === 'object' && typeof right === 'object'
      ? mergeCounters(left, right)
      : left ?? right;
  }
  return merged;
}

function mergeBestTimes(local = {}, remote = {}) {
  const merged = {};
  for (const key of new Set([...Object.keys(remote || {}), ...Object.keys(local || {})])) {
    const values = [Number(local?.[key] || 0), Number(remote?.[key] || 0)].filter((value) => value > 0);
    if (values.length) merged[key] = Math.min(...values);
  }
  return merged;
}

function mergeQualifications(local = {}, remote = {}) {
  const merged = mergeRecordMap(local, remote);
  for (const key of Object.keys(merged)) {
    const left = local?.[key] || {};
    const right = remote?.[key] || {};
    const best = [Number(left.bestSeconds || 0), Number(right.bestSeconds || 0)].filter((value) => value > 0);
    merged[key] = {
      ...merged[key],
      qualified: Boolean(left.qualified || right.qualified),
      ...(best.length ? { bestSeconds: Math.min(...best) } : {})
    };
  }
  return merged;
}

export function mergeProgress(localProgress = {}, remoteProgress = {}) {
  const local = readProgress({ getItem: () => JSON.stringify(localProgress) });
  const remote = readProgress({ getItem: () => JSON.stringify(remoteProgress) });
  const merged = {
    solvedCount: Math.max(local.solvedCount, remote.solvedCount),
    activities: mergeEventLists(local.activities, remote.activities, 60),
    totalActivities: Math.max(local.totalActivities, remote.totalActivities),
    hintsUsed: Math.max(local.hintsUsed, remote.hintsUsed),
    analysesRun: Math.max(local.analysesRun, remote.analysesRun),
    lessonResults: mergeRecordMap(local.lessonResults, remote.lessonResults),
    levelQualifications: mergeQualifications(local.levelQualifications, remote.levelQualifications),
    challengeBestTimes: mergeBestTimes(local.challengeBestTimes, remote.challengeBestTimes),
    puzzleReviews: mergeEventLists(local.puzzleReviews, remote.puzzleReviews, 30),
    techniqueUsage: mergeRecordMap(local.techniqueUsage, remote.techniqueUsage)
  };
  ARRAY_FIELDS.forEach((field) => { merged[field] = uniqueList(local[field], remote[field]); });
  merged.totalActivities = Math.max(merged.totalActivities, merged.activities.length);
  return merged;
}

export function readSession(storage = localStorage) {
  const raw = safeParse(storage.getItem(SESSION_KEY));
  if (!raw || raw.version !== 1 || !Array.isArray(raw.grid) || raw.grid.length !== 81) return null;
  if (!raw.record || !Array.isArray(raw.record.puzzle) || !Array.isArray(raw.record.solution)) return null;
  return raw;
}

export function writeSession(session, storage = localStorage) {
  storage.setItem(SESSION_KEY, JSON.stringify({ version: 1, ...session, updatedAt: new Date().toISOString() }));
}

export function clearSession(storage = localStorage) {
  storage.removeItem(SESSION_KEY);
}
