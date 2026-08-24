const CELL_COUNT = 81;

function validColor(value) {
  return value === 1 || value === 2;
}

function normalizedNotes(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((digit) => Number.isInteger(digit) && digit >= 1 && digit <= 9))].sort();
}

function normalizedBaseline(raw) {
  if (!raw || !Array.isArray(raw.grid) || raw.grid.length !== CELL_COUNT || !Array.isArray(raw.notes) || raw.notes.length !== CELL_COUNT) return null;
  return {
    grid: raw.grid.map((value) => Number.isInteger(value) && value >= 0 && value <= 9 ? value : 0),
    notes: raw.notes.map(normalizedNotes)
  };
}

export function createTrialState(raw = null) {
  const marks = Array.isArray(raw?.marks) && raw.marks.length === CELL_COUNT
    ? raw.marks.map((value) => validColor(value) ? value : 0)
    : Array(CELL_COUNT).fill(0);
  const focus = validColor(raw?.focus) ? raw.focus : 1;
  return {
    active: validColor(raw?.active) ? raw.active : 0,
    focus,
    marks,
    baseline: normalizedBaseline(raw?.baseline)
  };
}

export function snapshotTrialState(trial) {
  return {
    active: validColor(trial?.active) ? trial.active : 0,
    focus: validColor(trial?.focus) ? trial.focus : 1,
    marks: Array.isArray(trial?.marks) ? [...trial.marks] : Array(CELL_COUNT).fill(0),
    baseline: trial?.baseline ? {
      grid: [...trial.baseline.grid],
      notes: trial.baseline.notes.map((values) => [...values])
    } : null
  };
}

export function startTrial(trial, color, grid, notes) {
  if (!validColor(color)) throw new RangeError('Trial color must be 1 or 2.');
  if (!trial.baseline) {
    trial.baseline = {
      grid: [...grid],
      notes: notes.map((values) => [...values])
    };
  }
  trial.active = color;
  trial.focus = color;
}

export function markTrialCell(trial, index) {
  if (!validColor(trial.active) || !Number.isInteger(index) || index < 0 || index >= CELL_COUNT) return false;
  trial.marks[index] = trial.active;
  return true;
}

export function pauseTrial(trial) {
  trial.active = 0;
  if (!trial.marks.some(Boolean)) trial.baseline = null;
}

export function confirmTrials(trial) {
  trial.active = 0;
  trial.marks.fill(0);
  trial.baseline = null;
}

export function clearTrials(trial, grid, notes) {
  if (trial.baseline) {
    grid.splice(0, CELL_COUNT, ...trial.baseline.grid);
    for (let index = 0; index < CELL_COUNT; index += 1) notes[index] = new Set(trial.baseline.notes[index]);
  }
  confirmTrials(trial);
}

export function trialCounts(trial) {
  return trial.marks.reduce((counts, color) => {
    if (validColor(color)) counts[color] += 1;
    return counts;
  }, { 1: 0, 2: 0 });
}

export function hasTrialChanges(trial) {
  return trial.marks.some(Boolean);
}
