export const PROGRESS_KEY = 'sudoku-learning-progress';
export const SESSION_KEY = 'sudoku-learning-session';

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
  storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 7, ...progress, updatedAt: new Date().toISOString() }));
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
