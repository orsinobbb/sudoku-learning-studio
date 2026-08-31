import {
  DIFFICULTIES,
  PEERS,
  analyzePuzzle,
  candidateNotesForGrid,
  candidatesFor,
  cellName,
  generatePuzzle,
  getCompletedDigits,
  getWrongEntries,
  isSolved,
  suggestNextMoves,
  parsePuzzle,
  serializeGrid,
  validateGrid
} from './core/sudoku.js?v=20260825-levels2';
import {
  clearTrials,
  confirmTrials,
  createTrialState,
  hasTrialChanges,
  markTrialCell,
  pauseTrial,
  snapshotTrialState,
  startTrial,
  trialConflictIndices,
  trialCounts
} from './core/trial.js?v=20260825-trial2';
import { ALL_LESSONS, DETECTABLE_LESSONS, JOURNEY_STAGES, TARGETED_LESSONS, TECHNIQUE_NAMES } from './learning/curriculum.js?v=20260824-advanced1';
import { DRILL_BY_TECHNIQUE } from './learning/drills.js?v=20260824-advanced1';
import {
  diagnoseTechniqueAnswer,
  evaluateDiscriminationAnswer,
  evaluateReasonAnswer,
  evaluateTechniqueAnswer,
  getDiscriminationQuestions,
  getTechniqueQuestions
} from './learning/assessments.js?v=20260831-learning1';
import { getTutorial } from './learning/tutorials.js?v=20260824-advanced1';
import { readProgress, readSession, writeProgress, writeSession } from './learning/storage.js?v=20260831-learning1';
import {
  aggregateSkillDimensions,
  computeSkillDimensions,
  createPuzzleReview,
  hintSupportFor,
  isReviewDue,
  normalizeLessonResult,
  recordDiagnostic,
  scheduleReview
} from './learning/mastery.js?v=20260831-learning1';
import {
  LEVELS,
  LEVEL_STAGES,
  TOTAL_CHALLENGES,
  challengeIdFor,
  challengeNumberFromId,
  evaluateLevelQualification,
  getChallenge,
  getLevelFastTrackSeconds,
  getLevelTimeLimitSeconds,
  getNextChallengeNumber,
  isLevelCheckpoint,
  isChallengeUnlocked
} from './learning/level-catalog.js?v=20260826-ability2';

const byId = (id) => document.getElementById(id);
const board = byId('sudoku-board');
const coachContent = byId('coach-content');
const toast = byId('toast');
const strategyNames = TECHNIQUE_NAMES;
const assessmentTechnique = (lesson) => lesson.assessment || (lesson.analyzer !== 'search' ? lesson.analyzer : null);

const storedProgress = readProgress();
const pendingSession = readSession();

function qualifiedLevelsFrom(records = {}) {
  return new Set(Object.entries(records)
    .filter(([, result]) => result?.qualified === true)
    .map(([level]) => Number(level)));
}

const learningProfile = {
  completedLessons: new Set(Array.isArray(storedProgress.completedLessons) ? storedProgress.completedLessons : []),
  completedDrills: new Set(Array.isArray(storedProgress.completedDrills) ? storedProgress.completedDrills : []),
  completedPuzzles: new Set(Array.isArray(storedProgress.completedPuzzles) ? storedProgress.completedPuzzles : []),
  activities: Array.isArray(storedProgress.activities) ? storedProgress.activities.slice(0, 60) : [],
  totalActivities: Number(storedProgress.totalActivities || storedProgress.activities?.length || 0),
  hintsUsed: Number(storedProgress.hintsUsed || 0),
  analysesRun: Number(storedProgress.analysesRun || 0),
  lessonResults: storedProgress.lessonResults,
  levelQualifications: storedProgress.levelQualifications,
  challengeBestTimes: storedProgress.challengeBestTimes,
  puzzleReviews: storedProgress.puzzleReviews,
  techniqueUsage: storedProgress.techniqueUsage
};
const initialChallengeNumber = getNextChallengeNumber(learningProfile.completedPuzzles, qualifiedLevelsFrom(learningProfile.levelQualifications)) || TOTAL_CHALLENGES;
const initialChallenge = getChallenge(initialChallengeNumber);

const state = {
  record: null,
  grid: [],
  notes: Array.from({ length: 81 }, () => new Set()),
  selected: -1,
  notesMode: false,
  trial: createTrialState(),
  history: [],
  conflicts: new Set(),
  wrong: new Set(),
  hint: null,
  suggestions: [],
  elapsed: 0,
  timerId: null,
  completed: false,
  activeDrill: null,
  title: '',
  sessionId: '',
  activeLesson: null,
  sessionStats: { hints: 0, stalls: 0, usedTechniques: [] },
  solvedCount: Number(storedProgress.solvedCount || 0),
  learning: learningProfile,
  generatorDifficulty: 'easy',
  selectedStage: initialChallenge.stage,
  selectedLevel: initialChallenge.level,
  selectedQuestion: initialChallenge.question,
  selectedChallenge: initialChallengeNumber
};

function persistProgress() {
  writeProgress({
    solvedCount: state.solvedCount,
    completedLessons: [...state.learning.completedLessons],
    completedDrills: [...state.learning.completedDrills],
    completedPuzzles: [...state.learning.completedPuzzles],
    activities: state.learning.activities,
    totalActivities: state.learning.totalActivities,
    hintsUsed: state.learning.hintsUsed,
    analysesRun: state.learning.analysesRun,
    lessonResults: state.learning.lessonResults,
    levelQualifications: state.learning.levelQualifications,
    challengeBestTimes: state.learning.challengeBestTimes,
    puzzleReviews: state.learning.puzzleReviews,
    techniqueUsage: state.learning.techniqueUsage
  });
}

function lessonResult(id) {
  state.learning.lessonResults[id] = normalizeLessonResult(state.learning.lessonResults[id]);
  return state.learning.lessonResults[id];
}

function persistSession() {
  if (!state.record || !state.grid.length) return;
  writeSession({
    id: state.sessionId,
    title: state.title,
    record: state.record,
    grid: state.grid,
    notes: state.notes.map((values) => [...values]),
    trial: snapshotTrialState(state.trial),
    selected: state.selected,
    elapsed: state.elapsed,
    completed: state.completed,
    activeDrill: state.activeDrill?.technique || null,
    startedAt: state.startedAt,
    sessionStats: state.sessionStats
  });
}

function recordActivity(type, detail) {
  state.learning.activities.unshift({ type, detail, at: new Date().toISOString() });
  state.learning.activities = state.learning.activities.slice(0, 60);
  state.learning.totalActivities += 1;
  persistProgress();
  renderJourney();
}

function randomSeed() {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return `STUDIO-${bytes[0].toString(36).slice(-4)}${bytes[1].toString(36).slice(-4)}`.toUpperCase();
}

function renderLevelPicker() {
  const completed = state.learning.completedPuzzles;
  const qualified = qualifiedLevelsFrom(state.learning.levelQualifications);
  const completedCount = [...completed].filter((id) => challengeNumberFromId(id)).length;
  const nextOpen = getNextChallengeNumber(completed, qualified);
  const selectedRecord = getChallenge(state.selectedChallenge);
  const selectedUnlocked = isChallengeUnlocked(state.selectedChallenge, completed, qualified);
  const selectedLevelQualified = qualified.has(selectedRecord.level);
  const checkpointNumber = selectedRecord.level * 10;
  const checkpointId = challengeIdFor(checkpointNumber);
  const checkpointBest = Number(state.learning.challengeBestTimes[checkpointId] || 0);
  const targetSeconds = getLevelTimeLimitSeconds(selectedRecord.level);
  const fastTrackSeconds = getLevelFastTrackSeconds(selectedRecord.level);
  const levelUnlocked = isChallengeUnlocked((selectedRecord.level - 1) * 10 + 1, completed, qualified);
  const abilityState = selectedLevelQualified ? '已達標' : !levelUnlocked ? '未開放' : completed.has(checkpointId) ? '待重考' : '進行中';
  const highestQualified = Array.from({ length: LEVELS.length }, (_, index) => index + 1).reduce((highest, level) => qualified.has(level) ? level : highest, 0);
  byId('bank-progress').textContent = `已破關 ${completedCount} / ${TOTAL_CHALLENGES}`;
  if (nextOpen && isLevelCheckpoint(nextOpen) && completed.has(challengeIdFor(nextOpen))) {
    byId('challenge-status').textContent = `可重考第 ${nextOpen} 關達標，或重玩本級任一關挑戰快速解鎖`;
  } else {
    byId('challenge-status').textContent = nextOpen ? `循序進度第 ${nextOpen} 關 · 能力地圖已開放至 Lv.${Math.min(highestQualified + 1, LEVELS.length)}` : '300 關全部完成，所有關卡皆可重玩';
  }
  byId('challenge-progress-bar').style.width = `${(completedCount / TOTAL_CHALLENGES) * 100}%`;
  const qualification = state.learning.levelQualifications[selectedRecord.level];
  const qualifiedBy = qualification?.route === 'fast-track' ? '超前解鎖' : qualification?.qualified ? '標準檢定' : '';
  byId('ability-waterline').innerHTML = `<span class="ability-badge">Lv.${selectedRecord.level}</span><div><b>快速解鎖 ${formatTime(fastTrackSeconds)} · 標準檢定 ${formatTime(targetSeconds)}</b><p>任一關達快速水位即可跳級；第 ${checkpointNumber} 關適用標準水位。${qualifiedBy ? ` 已由「${qualifiedBy}」達標。` : ''}</p><small>檢定最佳：${checkpointBest ? formatTime(checkpointBest) : '尚無紀錄'} · 已通過 ${qualified.size} / ${LEVELS.length} 級${highestQualified ? ` · 最高 Lv.${highestQualified}` : ''}</small></div><span class="ability-result">${abilityState}</span>`;
  byId('level-stage-tabs').innerHTML = LEVEL_STAGES.map((stage) => {
    const first = (stage.number - 1) * 60 + 1;
    const done = Array.from({ length: 60 }, (_, index) => challengeIdFor(first + index)).filter((id) => completed.has(id)).length;
    return `<button type="button" role="tab" aria-selected="${stage.number === state.selectedStage}" class="${stage.number === state.selectedStage ? 'selected' : ''}" data-level-stage="${stage.number}"><b>${stage.number}階</b><small>${stage.short} ${done}/60</small></button>`;
  }).join('');
  byId('challenge-map').innerHTML = LEVELS.filter((level) => level.stage === state.selectedStage).map((level) => {
    const buttons = Array.from({ length: 10 }, (_, index) => {
      const number = (level.level - 1) * 10 + index + 1;
      const id = challengeIdFor(number);
      const isComplete = completed.has(id);
      const isCurrent = number === nextOpen;
      const assessment = isLevelCheckpoint(number);
      const levelQualified = qualified.has(level.level);
      const unlocked = isChallengeUnlocked(number, completed, qualified);
      const stateLabel = assessment && levelQualified ? '能力檢定已達標' : assessment && isComplete ? '已過關，能力檢定待重考' : isComplete ? '已過關' : isCurrent ? assessment ? '目前能力檢定' : '目前關卡' : '尚未解鎖';
      const nodeMark = assessment ? levelQualified ? '★' : isCurrent && isComplete ? '重考' : '檢' : isComplete ? '✓' : isCurrent ? 'GO' : '鎖';
      return `<button type="button" aria-label="第 ${number} 關，${stateLabel}" class="challenge-node ${number === state.selectedChallenge ? 'selected' : ''} ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''} ${assessment ? 'assessment' : ''} ${levelQualified && assessment ? 'qualified' : ''} ${unlocked ? '' : 'locked'}" data-challenge="${number}" ${unlocked ? '' : 'disabled'}><span>${number}</span><small>${nodeMark}</small></button>`;
    }).join('');
    const done = Array.from({ length: 10 }, (_, index) => completed.has(challengeIdFor((level.level - 1) * 10 + index + 1))).filter(Boolean).length;
    return `<section class="challenge-level"><header><div><b>Lv.${level.level} · ${level.techniqueLabel}</b><small>${level.blanks} 格空白 · ${done}/10 · ${qualified.has(level.level) ? '已達標' : `快速 ${formatTime(getLevelFastTrackSeconds(level.level))}／檢定 ${formatTime(getLevelTimeLimitSeconds(level.level))}`}</small></div></header><div class="challenge-nodes">${buttons}</div></section>`;
  }).join('');
  const selectedComplete = completed.has(selectedRecord.id);
  const assessment = isLevelCheckpoint(selectedRecord.challengeNumber);
  const statusCopy = assessment && selectedLevelQualified
    ? '能力檢定已達標，下一級已開放；本關仍可重玩刷新最佳時間。'
    : assessment && selectedComplete
      ? `本關已完成，但尚未在 ${targetSeconds / 60} 分鐘內達標；請重考以解鎖下一級。`
      : assessment && selectedUnlocked
        ? `這是本級能力檢定，須在 ${targetSeconds / 60} 分鐘內完成。`
        : selectedComplete && selectedLevelQualified
          ? '本級已取得能力資格；可直接往下一級，也可重玩本關。'
          : selectedComplete
            ? '已過關，可隨時重玩或挑戰快速水位。'
            : selectedUnlocked
              ? `目前已解鎖；可循序練習，或在 ${formatTime(fastTrackSeconds)} 內完成任一關，直接開放下一級。`
              : `請先完成目前開放的第 ${nextOpen} 關或能力檢定。`;
  const selectedState = selectedLevelQualified && assessment ? '檢定達標' : selectedComplete && assessment ? '待重考' : selectedComplete ? '已過關' : selectedUnlocked ? '可挑戰' : '未解鎖';
  byId('level-summary').innerHTML = `<div class="challenge-summary-head"><span>第 ${selectedRecord.challengeNumber} / ${TOTAL_CHALLENGES} 關${assessment ? ' · 能力檢定' : ''}</span><b>${selectedState}</b></div><h3>第 ${selectedRecord.stage} 階 · Lv.${selectedRecord.level} ${selectedRecord.techniqueLabel}</h3><p>${statusCopy} ${LEVEL_STAGES[selectedRecord.stage - 1].description}</p><div class="level-metrics"><span>${selectedRecord.blanks} 格空白</span><span>${selectedRecord.clues} 個題目數字</span><span>最難技巧：${selectedRecord.techniqueLabel}</span><span>快速解鎖 ${formatTime(fastTrackSeconds)}</span><span>標準檢定 ${formatTime(targetSeconds)}</span><span>唯一解</span></div>`;
  byId('bank-start-btn').disabled = !selectedUnlocked;
  const startLabel = assessment && selectedComplete && !selectedLevelQualified ? '重考能力檢定' : selectedComplete ? '重新挑戰' : selectedUnlocked ? assessment ? '開始能力檢定' : '挑戰' : '尚未解鎖';
  byId('bank-start-btn').innerHTML = `${startLabel} · 第 ${selectedRecord.challengeNumber} 關 <span>→</span>`;
}

function selectChallenge(challengeNumber) {
  const record = getChallenge(challengeNumber);
  state.selectedChallenge = record.challengeNumber;
  state.selectedStage = record.stage;
  state.selectedLevel = record.level;
  state.selectedQuestion = record.question;
  renderLevelPicker();
}

function updateNextChallengeButton(challengeNumber = null, preferredChallengeNumber = null) {
  const button = byId('next-challenge-btn');
  const qualified = qualifiedLevelsFrom(state.learning.levelQualifications);
  const sequentialNext = challengeNumber === null ? null : getNextChallengeNumber(state.learning.completedPuzzles, qualified);
  const preferredUnlocked = preferredChallengeNumber !== null && isChallengeUnlocked(preferredChallengeNumber, state.learning.completedPuzzles, qualified);
  const next = preferredUnlocked ? preferredChallengeNumber : sequentialNext;
  const available = next !== null && isChallengeUnlocked(next, state.learning.completedPuzzles, qualified);
  button.hidden = !available;
  if (available) {
    button.dataset.challenge = String(next);
    const isFastTrackJump = preferredUnlocked && next > challengeNumber + 1;
    button.innerHTML = isFastTrackJump
      ? `超前前往 Lv.${Math.ceil(next / 10)} · 第 ${next} 關 <span>→</span>`
      : `${next === challengeNumber ? '重考能力檢定 · ' : '進入'}第 ${next} 關 <span>→</span>`;
  } else {
    delete button.dataset.challenge;
  }
}

function showToast(message, tone = '') {
  toast.textContent = message;
  toast.className = `toast show ${tone}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.className = 'toast'; }, 2600);
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function startTimer() {
  clearInterval(state.timerId);
  byId('timer').textContent = formatTime(state.elapsed);
  state.timerId = setInterval(() => {
    if (!state.completed && document.visibilityState === 'visible') state.elapsed += 1;
    byId('timer').textContent = formatTime(state.elapsed);
  }, 1000);
}

function setCoach(number, title, body, concept = '') {
  coachContent.replaceChildren();
  const label = document.createElement('span');
  label.className = 'lesson-number';
  label.textContent = number;
  const heading = document.createElement('h2');
  heading.textContent = title;
  const paragraph = document.createElement('p');
  paragraph.textContent = body;
  coachContent.append(label, heading, paragraph);
  if (concept) {
    const box = document.createElement('div');
    box.className = 'concept-box';
    const strong = document.createElement('b');
    strong.textContent = '推理依據';
    const detail = document.createElement('p');
    detail.textContent = concept;
    box.append(strong, detail);
    coachContent.append(box);
  }
}

function suggestionTarget(step) {
  return step.kind === 'placement' ? step.index : step.indices?.[0];
}

function suggestionAction(step) {
  if (step.kind === 'placement') return `${cellName(step.index)}填入 ${step.digit}`;
  const grouped = new Map();
  for (const { index, digit } of step.eliminations || []) {
    if (!grouped.has(index)) grouped.set(index, []);
    grouped.get(index).push(digit);
  }
  const parts = [...grouped.entries()].map(([index, digits]) => `${cellName(index)}刪除 ${digits.sort().join('、')}`);
  return parts.length <= 3 ? parts.join('；') : `${parts.slice(0, 3).join('；')}；另 ${parts.length - 3} 格`;
}

function focusSuggestion(step) {
  state.hint = { ...step, index: suggestionTarget(step), targets: step.kind === 'placement' ? [step.index] : step.indices };
  state.selected = suggestionTarget(step);
  byId('apply-hint-btn').hidden = step.kind !== 'placement';
  renderBoard();
}

function renderSuggestions(suggestions) {
  coachContent.replaceChildren();
  const label = document.createElement('span');
  label.className = 'lesson-number';
  label.textContent = `目前盤面 · ${suggestions.length} 個建議`;
  const heading = document.createElement('h2');
  heading.textContent = '由簡到難的可行下一手';
  const intro = document.createElement('p');
  intro.textContent = '每一項都直接成立於目前盤面；選擇一項可在盤面定位，但不會自動修改答案。';
  const list = document.createElement('ol');
  list.className = 'suggestion-list';
  suggestions.forEach((step, index) => {
    const item = document.createElement('li');
    const meta = document.createElement('span');
    meta.className = 'suggestion-meta';
    meta.textContent = `建議 ${index + 1} · ${strategyNames[step.strategy] || step.strategy}`;
    const action = document.createElement('b');
    action.textContent = suggestionAction(step);
    const reason = document.createElement('p');
    reason.textContent = step.explanation;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = step.kind === 'placement' ? '定位並可套用' : '定位排除範圍';
    button.addEventListener('click', () => focusSuggestion(step));
    item.append(meta, action, reason, button);
    list.append(item);
  });
  coachContent.append(label, heading, intro, list);
  if (suggestions.length < 3) {
    const note = document.createElement('div');
    note.className = 'concept-box';
    const strong = document.createElement('b');
    strong.textContent = '掃描結果';
    const detail = document.createElement('p');
    detail.textContent = `依難度檢查目前已支援的邏輯技巧後，只找到 ${suggestions.length} 個不重複的下一手。`;
    note.append(strong, detail);
    coachContent.append(note);
  }
}

function initializeBoard() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 81; index += 1) {
    const cell = document.createElement('button');
    cell.className = 'sudoku-cell';
    cell.type = 'button';
    cell.dataset.index = index;
    cell.setAttribute('role', 'gridcell');
    cell.addEventListener('click', () => selectCell(index));
    fragment.append(cell);
  }
  board.append(fragment);
}

function renderBoard() {
  const given = new Set(state.record.puzzle.map((value, index) => value ? index : -1).filter((index) => index >= 0));
  const completedDigits = new Set(getCompletedDigits(state.grid, hasTrialChanges(state.trial) ? null : state.record.solution));
  const selectedValue = state.selected >= 0 ? state.grid[state.selected] : 0;
  for (let index = 0; index < 81; index += 1) {
    const cell = board.children[index];
    const value = state.grid[index];
    const isPeer = state.selected >= 0 && PEERS[state.selected].has(index);
    cell.className = 'sudoku-cell';
    if (given.has(index)) cell.classList.add('given');
    else if (value) cell.classList.add('entered');
    const trialColor = state.trial.marks[index];
    if (trialColor === 1) cell.classList.add('trial-one');
    if (trialColor === 2) cell.classList.add('trial-two');
    if (index === state.selected) cell.classList.add('selected');
    else if (isPeer) cell.classList.add('peer');
    if (selectedValue && value === selectedValue) cell.classList.add('same-number');
    if (value && completedDigits.has(value)) cell.classList.add('digit-completed');
    const answerWrong = state.wrong.has(index) && !trialColor;
    if (state.conflicts.has(index)) cell.classList.add('conflict');
    if (answerWrong) cell.classList.add('wrong');
    if (state.hint?.targets?.includes(index) || state.hint?.index === index) cell.classList.add('hint-target');
    if (state.hint?.related?.includes(index)) cell.classList.add('hint-related');
    cell.replaceChildren();
    if (value) {
      const number = document.createElement('span');
      number.className = 'cell-value';
      number.textContent = value;
      cell.append(number);
    } else if (state.notes[index].size) {
      const notes = document.createElement('span');
      notes.className = 'cell-notes';
      for (let digit = 1; digit <= 9; digit += 1) {
        const note = document.createElement('i');
        note.textContent = state.notes[index].has(digit) ? digit : '';
        notes.append(note);
      }
      cell.append(notes);
    }
    const trialLabel = trialColor === 1 ? '，藍色 A 試填' : trialColor === 2 ? '，紫色 B 試填' : '';
    const errorLabel = state.conflicts.has(index) ? '，與同行、同列或同宮重複' : answerWrong ? '，答案錯誤' : '';
    cell.setAttribute('aria-label', `${cellName(index)}${value ? `，數字 ${value}` : '，空格'}${trialLabel}${errorLabel}`);
    cell.setAttribute('aria-invalid', errorLabel ? 'true' : 'false');
    cell.setAttribute('aria-selected', index === state.selected ? 'true' : 'false');
  }
  document.querySelectorAll('[data-number]').forEach((button) => {
    const digit = Number(button.dataset.number);
    const completed = completedDigits.has(digit);
    button.classList.toggle('completed-digit', completed);
    button.setAttribute('aria-label', `數字 ${digit}${completed ? '，已完成' : ''}`);
    button.title = completed ? `數字 ${digit} 已全部完成` : `填入數字 ${digit}`;
  });
  const candidateNotes = candidateNotesForGrid(state.grid);
  const hasEmptyCell = state.grid.some((value) => !value);
  const notesAreComplete = hasEmptyCell && candidateNotes.every((values, index) => (
    values.length === state.notes[index].size && values.every((digit) => state.notes[index].has(digit))
  ));
  const allNotesButton = byId('all-notes-btn');
  allNotesButton.classList.toggle('active', notesAreComplete);
  allNotesButton.querySelector('b').textContent = notesAreComplete ? '清' : '填';
  allNotesButton.setAttribute('aria-label', notesAreComplete ? '清除全部候選筆記' : '填入全部合法候選筆記');
  allNotesButton.title = notesAreComplete ? '清除全盤候選筆記' : '依目前盤面填入每個空格的合法候選數';
  renderTrialControls();
  renderProgress();
}

function renderProgress() {
  const clues = state.record.puzzle.filter(Boolean).length;
  const placed = state.grid.filter(Boolean).length - clues;
  const total = 81 - clues;
  const percent = total ? Math.max(0, Math.round((placed / total) * 100)) : 100;
  byId('completion-label').textContent = `${percent}%`;
  byId('completion-bar').style.width = `${percent}%`;
  byId('solved-count').textContent = `${state.solvedCount} 題 · ${state.learning.completedLessons.size}/${ALL_LESSONS.length} 技巧`;
}

function selectCell(index) {
  state.selected = index;
  state.hint = null;
  state.suggestions = [];
  byId('apply-hint-btn').hidden = true;
  const value = state.grid[index];
  if (state.record.puzzle[index]) {
    setCoach('盤面觀察', `${cellName(index)}是題目線索`, `數字 ${value} 是出題時給定的條件，不能修改。`, '觀察它如何排除同行、同列與同宮的相同數字。');
  } else if (value) {
    const trialLabel = state.trial.marks[index] === 1 ? '藍色 A 試填' : state.trial.marks[index] === 2 ? '紫色 B 試填' : '';
    setCoach(trialLabel || '你的作答', `${cellName(index)}填了 ${value}`, trialLabel ? '這是尚未轉正的試填數字；可比較推理結果後整批轉正或清除。' : '你可以檢查它是否與同一橫列、直行或九宮中的數字重複。', '沒有重複不一定代表答案正確，但表示目前符合基本規則。');
  } else {
    const candidates = candidatesFor(state.grid, index);
    setCoach('候選數觀察', `${cellName(index)}有 ${candidates.length} 個可能`, candidates.length ? `目前可填：${candidates.join('、')}。` : '這一格已經沒有可用數字，請檢查前面的作答。', '候選數是排除同行、同列與同宮已出現數字後，剩下的可能。');
  }
  renderBoard();
}

function saveHistory() {
  state.history.push({ grid: [...state.grid], notes: state.notes.map((set) => [...set]), trial: snapshotTrialState(state.trial) });
  if (state.history.length > 100) state.history.shift();
}

function renderTrialControls() {
  const panel = byId('trial-panel');
  const button = byId('trial-btn');
  const counts = trialCounts(state.trial);
  const changed = hasTrialChanges(state.trial);
  const hasWrongTrial = trialConflictIndices(state.trial, state.conflicts).length > 0;
  const activeLabel = state.trial.active === 1 ? '藍色 A' : state.trial.active === 2 ? '紫色 B' : '';
  panel.hidden = !state.trial.active && !changed;
  button.classList.toggle('active', Boolean(state.trial.active));
  button.querySelector('b').textContent = state.trial.active ? (state.trial.active === 1 ? 'A' : 'B') : changed ? '留' : '關';
  button.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
  document.querySelectorAll('[data-trial-color]').forEach((colorButton) => {
    colorButton.classList.toggle('active', Number(colorButton.dataset.trialColor) === state.trial.active);
  });
  byId('trial-status').textContent = state.trial.active ? `${activeLabel} 試填中` : '試填已保留';
  byId('trial-summary').textContent = changed
    ? `藍色 A ${counts[1]} 格、紫色 B ${counts[2]} 格；僅檢查基本衝突，不對照答案。${state.trial.active ? '可切換顏色繼續。' : '請選擇續填、轉正或清除。'}`
    : '選擇藍色 A 或紫色 B；只檢查同行、同列與同宮重複，不會對照答案。';
  byId('trial-confirm-btn').disabled = !changed || hasWrongTrial;
  byId('trial-confirm-btn').title = hasWrongTrial ? '請先修正紅色錯誤格' : '保留數字並移除所有試填顏色';
  byId('trial-keep-btn').disabled = !state.trial.active;
  byId('trial-keep-btn').textContent = state.trial.active ? '保留退出' : '已保留';
  byId('trial-clear-btn').disabled = !changed;
}

function activateTrial(color = state.trial.focus) {
  if (state.completed) return showToast('題目已完成，無法開始試填。');
  startTrial(state.trial, color, state.grid, state.notes);
  state.notesMode = false;
  byId('notes-btn').classList.remove('active');
  byId('notes-btn').querySelector('b').textContent = '關';
  renderBoard();
  persistSession();
  const label = color === 1 ? '藍色 A' : '紫色 B';
  setCoach('試填模式', `${label}已啟用`, '接下來輸入或清除的格子會保留特殊顏色；A、B 最多兩種，可隨時切換。', '試填只檢查同行、同列與同宮重複，不會偷看答案；轉正後才恢復正式答案檢查。');
}

function keepTrialChanges({ wrong = false } = {}) {
  pauseTrial(state.trial);
  renderBoard();
  persistSession();
  if (!wrong) {
    setCoach('試填已保留', '暫時離開試填模式', '藍色 A 與紫色 B 仍保留在盤面；點「試填」可繼續，或選擇全部轉正、清除試填。', '保留期間暫停一般填數，避免清除試填時誤動到正式作答。');
    showToast('已保留試填內容並暫停試填。');
  }
}

function confirmTrialChanges() {
  if (!hasTrialChanges(state.trial)) return showToast('目前沒有可轉正的試填內容。');
  if (trialConflictIndices(state.trial, state.conflicts).length) return showToast('請先修正同行、同列或同宮的重複，再將試填轉正。', 'warning');
  const counts = trialCounts(state.trial);
  saveHistory();
  confirmTrials(state.trial);
  renderBoard();
  persistSession();
  setCoach('試填已轉正', '所有試填一次轉為正式作答', `藍色 A ${counts[1]} 格、紫色 B ${counts[2]} 格已移除試填標記，數字與筆記均保留。`, '若需要撤回，可按一次「復原」。');
  showToast('所有試填已一次轉正。', 'success');
}

function clearTrialChanges() {
  if (!hasTrialChanges(state.trial)) return showToast('目前沒有可清除的試填內容。');
  saveHistory();
  clearTrials(state.trial, state.grid, state.notes);
  state.hint = null;
  state.suggestions = [];
  updateValidation();
  renderBoard();
  persistSession();
  setCoach('試填已清除', '盤面已還原', '所有藍色 A、紫色 B 的試填內容與其造成的候選筆記變化，都已回到開始試填前。', '若想取回剛才的試填，可按一次「復原」。');
  showToast('試填內容已清除，盤面已還原。');
}

function trialInputIsPaused() {
  if (state.trial.active || !hasTrialChanges(state.trial)) return false;
  showToast('試填已暫停，請先續填、轉正或清除。', 'warning');
  renderTrialControls();
  return true;
}

function toggleAllNotes() {
  if (state.completed || !state.grid.some((value) => !value)) {
    showToast('題目已完成，沒有空格需要筆記。');
    return;
  }
  if (state.trial.active || hasTrialChanges(state.trial)) {
    showToast('請先將試填轉正或清除，再使用全筆記。', 'warning');
    return;
  }
  const validation = updateValidation();
  if (!validation.valid) {
    renderBoard();
    showToast('盤面有重複數字，請先修正再建立候選筆記。', 'warning');
    return;
  }
  const candidateNotes = candidateNotesForGrid(state.grid);
  const notesAreComplete = candidateNotes.every((values, index) => (
    values.length === state.notes[index].size && values.every((digit) => state.notes[index].has(digit))
  ));
  saveHistory();
  state.notes = notesAreComplete
    ? Array.from({ length: 81 }, () => new Set())
    : candidateNotes.map((values) => new Set(values));
  state.hint = null;
  state.suggestions = [];
  byId('apply-hint-btn').hidden = true;
  renderBoard();
  persistSession();
  if (notesAreComplete) {
    setCoach('候選筆記', '已清除全盤候選數', '你可以保留空白盤面自行計算，也能隨時再按一次重新建立。');
    showToast('已清除全盤候選筆記。');
  } else {
    setCoach('候選筆記', '已填入所有合法候選數', '每個空格都已依同行、同列與同宮重新計算。', '候選數只代表目前合法，不等於答案；接著要用技巧繼續排除。');
    showToast('已填入所有合法候選筆記。', 'success');
  }
}

function updateValidation() {
  const validation = validateGrid(state.grid);
  state.conflicts = new Set(validation.conflicts);
  state.wrong = new Set(getWrongEntries(state.grid, state.record.solution));
  return validation;
}

function enterNumber(digit) {
  const index = state.selected;
  if (index < 0 || state.record.puzzle[index] || state.completed) return;
  if (trialInputIsPaused()) return;
  const hadSuggestions = state.suggestions.length > 0;
  const wasWrong = state.trial.marks[index] ? state.conflicts.has(index) : state.wrong.has(index);
  saveHistory();
  state.hint = null;
  state.suggestions = [];
  byId('apply-hint-btn').hidden = true;
  const isNoteAction = state.notesMode && !state.grid[index];
  if (state.trial.active) markTrialCell(state.trial, index);
  if (isNoteAction) {
    if (state.notes[index].has(digit)) state.notes[index].delete(digit);
    else state.notes[index].add(digit);
  } else {
    state.grid[index] = digit;
    state.notes[index].clear();
    for (const peer of PEERS[index]) state.notes[peer].delete(digit);
  }
  const validation = updateValidation();
  const isTrialEntry = Boolean(state.trial.marks[index]);
  const wrongEntry = !isNoteAction && !isTrialEntry && state.wrong.has(index);
  const wrongTrialEntry = !isNoteAction && isTrialEntry && state.conflicts.has(index);
  if (wrongTrialEntry) pauseTrial(state.trial);
  renderBoard();
  persistSession();
  if (wrongTrialEntry) {
    setCoach('試填發現基本衝突', `${cellName(index)} 的 ${digit} 造成重複`, '這個數字與同行、同列或同宮重複，試填模式已暫停；目前 A、B 試填內容都仍保留。', '系統沒有對照答案。你可以檢查後續填，或選擇「清除試填」回到試填前盤面。');
    showToast('試填造成基本規則衝突，已暫停並保留。', 'warning');
  } else if (wrongEntry) {
    setCoach('立即檢查', `${cellName(index)} 的 ${digit} 不正確`, '這一格已標紅；請重新檢查它所在的行、列與九宮候選。', '系統只指出這一步不符合本題唯一解，不會直接洩漏正確答案。');
    showToast(`${cellName(index)} 填入 ${digit} 不正確，已標紅。`, 'warning');
  } else if (wasWrong) {
    const correctionDetail = isTrialEntry ? '目前已沒有同行、同列或同宮重複；系統仍未對照答案。' : '這個數字現在符合本題唯一解。';
    setCoach('立即檢查', `${cellName(index)} 已修正`, '紅色錯誤標記已移除，可以繼續解題。', correctionDetail);
    showToast(`${cellName(index)} 已修正。`, 'success');
  } else if (!validation.valid) showToast('這個數字與同一單位中的數字重複。', 'warning');
  if (isSolved(state.grid)) completePuzzle();
  else if (hadSuggestions && !wrongEntry && !wasWrong && validation.valid) setCoach('盤面已更新', '先前的建議已失效', '每次填數都會改變候選集合；請先觀察連鎖效果，再重新分析下一手。');
}

function eraseSelected() {
  const index = state.selected;
  if (index < 0 || state.record.puzzle[index] || state.completed) return;
  if (trialInputIsPaused()) return;
  saveHistory();
  if (state.trial.active) markTrialCell(state.trial, index);
  state.grid[index] = 0;
  state.notes[index].clear();
  state.hint = null;
  state.suggestions = [];
  updateValidation();
  renderBoard();
  persistSession();
}

function undo() {
  const snapshot = state.history.pop();
  if (!snapshot || state.completed) return showToast('目前沒有可復原的動作。');
  state.grid = snapshot.grid;
  state.notes = snapshot.notes.map((values) => new Set(values));
  state.trial = createTrialState(snapshot.trial);
  state.hint = null;
  state.suggestions = [];
  updateValidation();
  renderBoard();
  persistSession();
}

function resetPuzzle() {
  if (state.completed) return;
  saveHistory();
  state.grid = [...state.record.puzzle];
  state.notes = Array.from({ length: 81 }, () => new Set());
  state.trial = createTrialState();
  state.elapsed = 0;
  state.selected = -1;
  state.hint = null;
  state.suggestions = [];
  updateValidation();
  setCoach('重新開始', '盤面已回到最初狀態', '先掃描每個九宮，找出候選數最少的空格。', '優先處理唯一候選，通常能打開後續推理。');
  renderBoard();
  persistSession();
}

function completePuzzle() {
  if (state.completed) return;
  confirmTrials(state.trial);
  state.completed = true;
  state.solvedCount += 1;
  const reviewAnalysis = analyzePuzzle(state.record.puzzle);
  const puzzleReview = createPuzzleReview({
    id: state.sessionId,
    title: state.title,
    elapsed: state.elapsed,
    hints: state.sessionStats.hints,
    stalls: state.sessionStats.stalls,
    analysis: reviewAnalysis,
    usedTechniques: state.sessionStats.usedTechniques
  });
  state.learning.puzzleReviews.unshift(puzzleReview);
  state.learning.puzzleReviews = state.learning.puzzleReviews.slice(0, 30);
  puzzleReview.techniques.forEach(({ technique, count }) => {
    const usage = state.learning.techniqueUsage[technique] || { encountered: 0, hinted: 0 };
    usage.encountered += count;
    if (puzzleReview.usedTechniques.includes(technique)) usage.hinted += 1;
    state.learning.techniqueUsage[technique] = usage;
  });
  const challengeNumber = state.record.challengeNumber || challengeNumberFromId(state.record.bankId);
  const firstClear = Boolean(state.record.bankId && !state.learning.completedPuzzles.has(state.record.bankId));
  if (state.record.bankId) state.learning.completedPuzzles.add(state.record.bankId);
  let abilityResult = null;
  if (challengeNumber && state.record.bankId) {
    const previousBest = Number(state.learning.challengeBestTimes[state.record.bankId] || 0);
    state.learning.challengeBestTimes[state.record.bankId] = previousBest ? Math.min(previousBest, state.elapsed) : state.elapsed;
    const attempt = evaluateLevelQualification(challengeNumber, state.elapsed);
    const previousQualification = state.learning.levelQualifications[attempt.level];
    if (attempt.qualified) {
      state.learning.levelQualifications[attempt.level] = {
          ...previousQualification,
          qualified: true,
          bestSeconds: previousQualification?.bestSeconds ? Math.min(previousQualification.bestSeconds, state.elapsed) : state.elapsed,
          targetSeconds: attempt.targetSeconds,
          standardTargetSeconds: attempt.standardTargetSeconds,
          fastTrackSeconds: attempt.fastTrackSeconds,
          route: previousQualification?.route || attempt.route,
          challengeId: previousQualification?.challengeId || state.record.bankId,
          qualifiedAt: previousQualification?.qualifiedAt || new Date().toISOString()
      };
    }
    if (attempt.checkpoint || attempt.qualified) {
      abilityResult = {
        ...attempt,
        passedNow: attempt.qualified,
        wasQualified: previousQualification?.qualified === true,
        bestSeconds: state.learning.challengeBestTimes[state.record.bankId]
      };
    }
  }
  if (state.activeDrill) {
    state.learning.completedDrills.add(state.activeDrill.technique);
    const drillLesson = ALL_LESSONS.find((lesson) => assessmentTechnique(lesson) === state.activeDrill.technique);
    if (drillLesson) {
      const result = lessonResult(drillLesson.id);
      result.transferPassed = true;
      state.learning.lessonResults[drillLesson.id] = scheduleReview(result, { correct: true });
      syncLessonCompletion(drillLesson);
    }
    recordActivity('drill', `通過「${strategyNames[state.activeDrill.technique]}」專項考題，用時 ${formatTime(state.elapsed)}`);
    setCoach('專項完成', `已通過「${strategyNames[state.activeDrill.technique]}」考題`, `你用 ${formatTime(state.elapsed)} 完成這題。`, '回想指定技巧出現時，候選數為何能被排除或確定。');
  } else {
    const label = state.record.bankId ? `${state.record.title}（${state.record.techniqueLabel}）` : `${state.record.difficultyLabel}題目`;
    const assessmentNote = abilityResult ? `，Lv.${abilityResult.level} ${abilityResult.route === 'fast-track' ? '超前解鎖' : '能力檢定'}${abilityResult.passedNow || abilityResult.wasQualified ? '達標' : '未達標'}` : '';
    recordActivity('puzzle', `完成「${label}」，用時 ${formatTime(state.elapsed)}${assessmentNote}`);
    if (abilityResult) {
      const nextLevel = abilityResult.level < LEVELS.length ? abilityResult.level + 1 : null;
      if (abilityResult.passedNow && abilityResult.route === 'fast-track') {
        const title = nextLevel ? `表現遠超水位，Lv.${nextLevel} 已開放！` : '最高級超前水位達成！';
        setCoach(`Lv.${abilityResult.level} 超前解鎖`, title, `你用 ${formatTime(state.elapsed)} 完成，達到任一關 ${formatTime(abilityResult.fastTrackSeconds)} 內的快速水位。${nextLevel ? ` 可直接跳到第 ${abilityResult.level * 10 + 1} 關，也可回來完成本級其餘題目。` : ''}`, '跳級只增加選擇，不會刪除或代替原本的練習題。');
      } else if (abilityResult.passedNow) {
        const title = nextLevel ? `Lv.${nextLevel} 已解鎖！` : '最高級能力水位達成！';
        setCoach(`Lv.${abilityResult.level} 能力檢定通過`, title, `完成時間 ${formatTime(state.elapsed)}，達到 ${formatTime(abilityResult.targetSeconds)} 的標準水位。${nextLevel ? ` 現在可挑戰 Lv.${nextLevel}。` : ''}`, '速度來自穩定的觀察順序；重玩仍會保留更快的最佳成績。');
      } else if (abilityResult.wasQualified) {
        setCoach(`Lv.${abilityResult.level} 檢定重玩完成`, '已保有達標資格', `本次 ${formatTime(state.elapsed)}；你的達標紀錄不會被取消，最佳時間為 ${formatTime(abilityResult.bestSeconds)}。`, '可繼續下一級，也可以再次挑戰刷新最佳時間。');
      } else {
        const overtime = state.elapsed - abilityResult.targetSeconds;
        setCoach(`Lv.${abilityResult.level} 檢定完成`, '尚未達到標準水位', `本次 ${formatTime(state.elapsed)}，目標為 ${formatTime(abilityResult.targetSeconds)}，超出 ${formatTime(overtime)}。仍可重考第 10 關，或重玩本級任一關挑戰 ${formatTime(abilityResult.fastTrackSeconds)} 快速水位。`, '能力門檻有兩條路；選擇比較適合你的節奏即可。');
      }
    } else if (challengeNumber) {
      const next = getNextChallengeNumber(state.learning.completedPuzzles, qualifiedLevelsFrom(state.learning.levelQualifications));
      setCoach(`第 ${challengeNumber} 關破關`, firstClear ? '下一關已解鎖！' : '重玩完成！', `你用 ${formatTime(state.elapsed)} 完成這題。${next && firstClear ? ` 第 ${next} 關現在可以挑戰。` : ''}`, '完成後回想：是哪一個技巧讓盤面開始連鎖解開？');
    } else {
      setCoach('完成', '漂亮的推理！', `你用 ${formatTime(state.elapsed)} 完成這題。`, '完成後回想：是哪一個技巧讓盤面開始連鎖解開？');
    }
  }
  renderLevelPicker();
  const fastTrackTarget = abilityResult?.passedNow && abilityResult.route === 'fast-track' && abilityResult.level < LEVELS.length
    ? abilityResult.level * 10 + 1
    : null;
  updateNextChallengeButton(challengeNumber, fastTrackTarget);
  const toastMessage = abilityResult && !abilityResult.passedNow && !abilityResult.wasQualified
    ? `第 ${challengeNumber} 關已完成；可重考檢定或挑戰任一關快速水位。`
    : abilityResult?.passedNow && abilityResult.route === 'fast-track'
      ? abilityResult.level < LEVELS.length ? `表現遠超水位！Lv.${abilityResult.level + 1} 已提前開放。` : '最高級超前能力水位達成！'
      : abilityResult?.passedNow
        ? `Lv.${abilityResult.level} 能力檢定通過！`
      : challengeNumber
        ? `第 ${challengeNumber} 關破關！進度已保存在這個裝置。`
        : '恭喜完成！學習紀錄已保存在這個裝置。';
  showToast(toastMessage, 'success');
  renderBoard();
  persistSession();
}

function requestHint() {
  state.sessionStats.stalls += 1;
  const validation = updateValidation();
  if (!validation.valid) {
    setCoach('先修正衝突', '盤面中有重複數字', '紅色格子位於同一橫列、直行或九宮，請先修正後再分析。');
    renderBoard();
    return;
  }
  const result = suggestNextMoves(state.grid, { limit: 3 });
  if (!result.suggestions.length) {
    state.hint = null;
    state.suggestions = [];
    byId('apply-hint-btn').hidden = true;
    if (result.status === 'solved') setCoach('分析完成', '這一題已經完成', '目前不需要下一手。');
    else if (result.status === 'invalid') setCoach('無法分析', '目前盤面無法繼續求解', '盤面可能有衝突，或先前填入的數字已造成無解；請先修正。');
    else setCoach('沒有邏輯建議', '已依難度掃描，但找不到可直接成立的下一手', '不會用搜尋猜答案冒充技巧。你可補齊候選筆記，或到題目分析查看搜尋邊界。');
    return;
  }
  state.suggestions = result.suggestions;
  focusSuggestion(result.suggestions[0]);
  state.sessionStats.hints += 1;
  state.learning.hintsUsed += 1;
  const techniques = [...new Set(result.suggestions.map((step) => strategyNames[step.strategy] || step.strategy))];
  recordActivity('hint', `分析 ${result.suggestions.length} 個下一手：${techniques.join('、')}`);
  renderSuggestions(result.suggestions);
}

function applyHint() {
  if (!state.hint || state.hint.kind !== 'placement') return;
  const applied = state.hint;
  if (!state.sessionStats.usedTechniques.includes(applied.strategy)) state.sessionStats.usedTechniques.push(applied.strategy);
  state.notesMode = false;
  state.selected = applied.index;
  enterNumber(applied.digit);
  byId('notes-btn').classList.remove('active');
  byId('notes-btn').querySelector('b').textContent = '關';
  if (!state.completed) setCoach(`已套用 · ${strategyNames[applied.strategy] || applied.strategy}`, `${cellName(applied.index)}已填入 ${applied.digit}`, '盤面候選已重新計算；請先觀察這一步帶來的連鎖效果，再分析新的下一手。', applied.explanation);
}

function checkAnswer() {
  const validation = updateValidation();
  const committedWrong = [...state.wrong].filter((index) => !state.trial.marks[index]);
  if (!validation.valid) {
    showToast(`找到 ${validation.conflicts.length} 個衝突格。`, 'warning');
  } else {
    if (committedWrong.length) showToast(`有 ${committedWrong.length} 格正式作答不符合這題的唯一解。`, 'warning');
    else if (isSolved(state.grid)) completePuzzle();
    else if (hasTrialChanges(state.trial)) showToast('試填目前沒有基本規則衝突；試填不會對照答案。', 'success');
    else showToast('目前填入的答案都正確，可以繼續。', 'success');
  }
  renderBoard();
}

function loadPuzzle(record, title = '', { persist = true } = {}) {
  state.record = record;
  state.grid = [...record.puzzle];
  state.notes = Array.from({ length: 81 }, () => new Set());
  state.trial = createTrialState();
  state.history = [];
  state.selected = -1;
  state.conflicts.clear();
  state.wrong.clear();
  state.hint = null;
  state.suggestions = [];
  state.elapsed = 0;
  state.completed = false;
  state.activeDrill = null;
  state.sessionStats = { hints: 0, stalls: 0, usedTechniques: [] };
  state.title = title || record.title || `${record.seed} · ${record.clues} 個線索`;
  state.sessionId = `${record.seed || 'PUZZLE'}-${Date.now()}`;
  state.startedAt = new Date().toISOString();
  byId('difficulty-badge').textContent = record.difficultyLabel || DIFFICULTIES[record.difficulty]?.label || '練習';
  byId('puzzle-title').textContent = state.title;
  byId('apply-hint-btn').hidden = true;
  updateNextChallengeButton();
  if (record.bankId) {
    setCoach(`第 ${record.challengeNumber} / ${TOTAL_CHALLENGES} 關`, `${record.techniqueLabel} · ${record.blanks} 格空白`, `這是第 ${record.stage} 階、Lv.${record.level} 的第 ${record.question} 關。先找基礎推進，再觀察本級技巧何時出現。`, '關卡同時檢查空格數、唯一解與整題求解路徑；最難技巧不是第一步提示。');
  } else {
    setCoach('觀察 01', '先從候選數最少的格子開始', '點選一個空格，我會整理同行、同列與同宮的關係，並顯示候選數。', '每一步都應該有盤面依據，不必憑感覺猜。');
  }
  startTimer();
  renderBoard();
  if (persist) persistSession();
}

function restoreSession(session) {
  state.record = session.record;
  state.grid = [...session.grid];
  state.notes = Array.from({ length: 81 }, (_, index) => new Set(Array.isArray(session.notes?.[index]) ? session.notes[index] : []));
  state.trial = createTrialState(session.trial);
  state.history = [];
  state.selected = Number.isInteger(session.selected) ? session.selected : -1;
  state.conflicts = new Set();
  state.wrong = new Set();
  state.hint = null;
  state.suggestions = [];
  state.elapsed = Number(session.elapsed || 0);
  state.completed = Boolean(session.completed);
  state.activeDrill = session.activeDrill ? DRILL_BY_TECHNIQUE.get(session.activeDrill) || null : null;
  state.sessionStats = {
    hints: Number(session.sessionStats?.hints || 0),
    stalls: Number(session.sessionStats?.stalls || 0),
    usedTechniques: Array.isArray(session.sessionStats?.usedTechniques) ? session.sessionStats.usedTechniques : []
  };
  state.title = session.title || `${session.record.seed} · 繼續作答`;
  state.sessionId = session.id || `${session.record.seed || 'PUZZLE'}-${Date.now()}`;
  state.startedAt = session.startedAt || new Date().toISOString();
  byId('difficulty-badge').textContent = state.record.difficultyLabel || DIFFICULTIES[state.record.difficulty]?.label || '練習';
  byId('puzzle-title').textContent = state.title;
  byId('apply-hint-btn').hidden = true;
  updateNextChallengeButton(state.completed ? (state.record.challengeNumber || challengeNumberFromId(state.record.bankId)) : null);
  updateValidation();
  const restoredItems = hasTrialChanges(state.trial) ? '盤面、筆記、試填標記' : '盤面、筆記';
  setCoach(state.completed ? '已完成' : '繼續作答', state.completed ? '這題已完成，可以重做' : '已載入上次進度', state.completed ? '按「再練一次」會保留原歷程並建立新的作答。' : `${restoredItems}與 ${formatTime(state.elapsed)} 計時均已復原。`, '資料只保存在這個瀏覽器；清除網站資料或更換裝置後不會同步。');
  startTimer();
  renderBoard();
}

function startTechniqueDrill(technique) {
  const drill = DRILL_BY_TECHNIQUE.get(technique);
  const lesson = ALL_LESSONS.find((item) => item.analyzer === technique);
  if (!drill || !lesson) return;
  const puzzle = parsePuzzle(drill.puzzle);
  const analysis = analyzePuzzle(puzzle, { allowAdvanced: false });
  if (!analysis.valid || !analysis.unique || !analysis.techniqueCounts[technique]) {
    showToast('這份專項題校驗失敗，請稍後再試。', 'warning');
    return;
  }
  loadPuzzle({
    puzzle,
    solution: analysis.solution,
    difficulty: drill.difficulty,
    difficultyLabel: `${DIFFICULTIES[drill.difficulty].label}專項`,
    seed: drill.id,
    clues: analysis.clues
  }, `專項考題 · ${lesson.name}`);
  state.activeDrill = drill;
  persistSession();
  setCoach('技巧專項', `目標：${lesson.name}`, drill.prompt, `完整解題過程經分析器驗證，確實包含「${lesson.name}」；需要時可逐步使用提示。`);
  switchView('practice');
  showToast(`已載入「${lesson.name}」專項考題。`, 'success');
}

function switchView(name) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${name}-view`));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === name));
  if (name === 'learn') renderJourney();
  if (name === 'generator') renderLevelPicker();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function analysisMarkup(analysis) {
  if (!analysis.valid) return `<div class="analysis-error"><b>盤面不合法</b><p>${analysis.conflicts?.length ? `有 ${analysis.conflicts.length} 個互相衝突的格子。` : '這個盤面沒有可行解。'}</p></div>`;
  if (!analysis.unique) return `<div class="analysis-error"><b>不是唯一解題目</b><p>${analysis.solutionCount === 0 ? '找不到任何解。' : '至少存在兩個解，無法作為標準數獨題。'}</p></div>`;
  const chips = Object.entries(analysis.techniqueCounts).map(([key, count]) => `<span>${strategyNames[key] || key} <b>${count}</b></span>`).join('');
  const steps = analysis.steps.slice(0, 12).map((step) => `<li><i>${String(step.number).padStart(2, '0')}</i><div><b>${strategyNames[step.strategy] || step.strategy}</b><p>${step.explanation}</p></div></li>`).join('');
  const boundary = analysis.logicalOnly
    ? '<p class="analysis-boundary">這題可由目前 30 種已實作技巧完整解出，未使用搜尋。</p>'
    : '<p class="analysis-boundary">報告含「搜尋驗證」：代表 30 種邏輯技巧仍不足以完整解題；搜尋只驗證答案，不會冒充技巧。</p>';
  return `<div class="analysis-summary"><div><span>推定難度</span><b>${analysis.rating.label}</b></div><div><span>線索數</span><b>${analysis.clues}</b></div><div><span>解答</span><b>唯一解</b></div></div><p class="analysis-note">${analysis.rating.summary}</p>${boundary}<div class="technique-chips">${chips}</div><ol class="analysis-steps">${steps}</ol>${analysis.steps.length > 12 ? `<p class="more-steps">另有 ${analysis.steps.length - 12} 個步驟，這裡先顯示前 12 步。</p>` : ''}`;
}

function runAnalysis() {
  const output = byId('analysis-result');
  try {
    const puzzle = parsePuzzle(byId('puzzle-input').value);
    output.innerHTML = '<p class="analyzing">正在驗證盤面與推理路徑…</p>';
    requestAnimationFrame(() => {
      const analysis = analyzePuzzle(puzzle);
      output.innerHTML = analysisMarkup(analysis);
      state.learning.analysesRun += 1;
      const detail = analysis.valid && analysis.unique ? `分析唯一解題目：${analysis.rating.label}` : '分析未通過唯一解條件的題目';
      recordActivity('analysis', detail);
    });
  } catch (error) {
    output.innerHTML = `<div class="analysis-error"><b>無法讀取題目</b><p>${error.message}</p></div>`;
  }
}

function syncLessonCompletion(lesson) {
  const result = lessonResult(lesson.id);
  const technique = assessmentTechnique(lesson);
  const questionCount = technique ? getTechniqueQuestions(technique, 12).length : 0;
  const reasonTarget = Math.min(6, Math.max(0, questionCount - 1));
  const passed = result.knowledgePassed && (!questionCount || (
    result.reasonPassedQuestionIds.length >= reasonTarget
    && result.discriminationPassedIds.length >= Math.min(3, getDiscriminationQuestions(technique, 4).length)
    && result.transferPassed
  ));
  if (passed && !state.learning.completedLessons.has(lesson.id)) {
    state.learning.completedLessons.add(lesson.id);
    state.learning.lessonResults[lesson.id] = scheduleReview(result, { correct: true });
    recordActivity('lesson', `通過課程「${lesson.name}」${questionCount ? '的辨識、定點推理與遷移考核' : '理解檢核'}`);
  } else persistProgress();
  return passed;
}

function openLesson(id, phase = 'worked') {
  const lesson = ALL_LESSONS.find((item) => item.id === id);
  if (!lesson) return;
  state.activeLesson = {
    id,
    phase,
    questionIndex: phase === 'target' ? 4 : phase === 'transfer' ? 11 : phase === 'scaffold' ? 1 : 0,
    discriminationIndex: 0,
    selected: -1,
    hintLevel: 0,
    answered: false,
    pendingMove: null,
    feedback: '',
    reasonFeedback: '',
    discriminationFeedback: '',
    attemptsByQuestion: {},
    knowledgeFeedback: ''
  };
  renderLessonWorkbench();
  byId('lesson-workbench').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const LESSON_PHASES = Object.freeze([
  { id: 'worked', number: 1, label: '動態示範' },
  { id: 'scaffold', number: 2, label: '半引導練習' },
  { id: 'target', number: 3, label: '定點考試' },
  { id: 'discriminate', number: 4, label: '混合辨識' },
  { id: 'transfer', number: 5, label: '無提示遷移' }
]);

function assessmentCell(question, index, active, revealLevel = 0, showTarget = true) {
  const value = question.board[index];
  const candidates = question.candidates[index] || [];
  const related = revealLevel >= 1 && question.related.includes(index);
  const target = showTarget && (active.answered || revealLevel >= 2) && question.answers.some((answer) => answer.index === index);
  const visualNode = revealLevel >= 1 ? question.visual?.nodes.find((node) => node.index === index) : null;
  const focusDigit = visualNode?.digit;
  const classes = ['assessment-cell'];
  if (value) classes.push('given');
  if (index === active.selected) classes.push('selected');
  if (related) classes.push('related');
  if (target) classes.push('target');
  if (visualNode) classes.push(`logic-${visualNode.color}`);
  const content = value
    ? `<b>${value}</b>`
    : `<span>${Array.from({ length: 9 }, (_, digit) => `<i class="${focusDigit === digit + 1 ? 'focus-candidate' : ''}">${candidates.includes(digit + 1) ? digit + 1 : ''}</i>`).join('')}</span>`;
  return `<button type="button" class="${classes.join(' ')}" data-assessment-cell="${index}" aria-label="${cellName(index)}">${content}</button>`;
}

function assessmentVisualMarkup(question, revealLevel) {
  if (revealLevel < 1 || !question.visual) return '';
  const center = (index) => ({ x: (index % 9) * 100 + 50, y: Math.floor(index / 9) * 100 + 50 });
  const fish = question.visual.fish;
  const fishLines = fish ? [
    ...fish.rows.map((row) => `<rect class="fish-base" x="0" y="${row * 100 + 3}" width="900" height="94" rx="10"/>`),
    ...fish.cols.map((col) => `<rect class="fish-cover" x="${col * 100 + 3}" y="0" width="94" height="900" rx="10"/>`)
  ].join('') : '';
  const links = question.visual.links.map((link) => {
    const from = center(link.from); const to = center(link.to);
    return `<line class="logic-link ${link.type}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`;
  }).join('');
  const nodes = question.visual.nodes.map((node) => {
    const point = center(node.index);
    return `<circle class="logic-node ${node.role} ${node.color}" cx="${point.x}" cy="${point.y}" r="30"/>`;
  }).join('');
  const groups = question.visual.groups.map((group) => {
    const point = center(group.index);
    return `<rect class="logic-group" x="${point.x - 43}" y="${point.y - 43}" width="86" height="86" rx="12"/>`;
  }).join('');
  return `<svg class="assessment-overlay" viewBox="0 0 900 900" aria-hidden="true">${fishLines}${links}${groups}${nodes}</svg>`;
}

function assessmentBoardMarkup(question, active, revealLevel = 0, showTarget = true) {
  return `<div class="assessment-board-wrap"><div class="assessment-board">${question.board.map((_, index) => assessmentCell(question, index, active, revealLevel, showTarget)).join('')}</div>${assessmentVisualMarkup(question, revealLevel)}</div>`;
}

function resetLessonInteraction(active) {
  active.selected = -1;
  active.hintLevel = 0;
  active.usedHint = false;
  active.answered = false;
  active.pendingMove = null;
  active.feedback = '';
  active.reasonFeedback = '';
  active.discriminationFeedback = '';
}

function questionExerciseMarkup({ lesson, question, active, result, revealLevel, phaseLabel, position, total, allowHint = false }) {
  const passed = result.reasonPassedQuestionIds.includes(question.id);
  const reasoning = active.pendingMove || active.answered
    ? `<div class="reason-check"><b>第二步：為什麼這個動作成立？</b><div class="reason-choices">${question.reasonChoices.map((choice) => `<button type="button" data-reason-answer="${choice.id}" ${active.answered ? 'disabled' : ''}>${choice.text}</button>`).join('')}</div>${active.reasonFeedback ? `<p>${active.reasonFeedback}</p>` : ''}</div>`
    : '';
  const explanation = active.answered || revealLevel >= 3
    ? `<div class="answer-explanation"><b>完整推理</b><p>${question.explanation}</p><small>${question.answerSummary}</small></div>`
    : '';
  return `<div class="assessment-head"><div><span>${phaseLabel} · ${position}/${total}</span><h3>${question.prompt}</h3><p>${question.instruction}</p></div><span class="question-source ${question.sourceKind === 'independent' ? 'independent' : ''}">${question.variantLabel}</span></div>
    <div class="assessment-layout"><div>${assessmentBoardMarkup(question, active, revealLevel)}<div class="assessment-pad">${[1,2,3,4,5,6,7,8,9].map((digit) => `<button type="button" data-assessment-digit="${digit}" ${active.pendingMove || active.answered ? 'disabled' : ''}>${digit}</button>`).join('')}</div></div>
    <aside class="assessment-coach"><span>${passed ? '已通過此題' : '尚未通過'} · 必須同時答對動作與理由</span><p>${revealLevel >= 2 ? '已標出目標；請把注意力放在推理條件。' : revealLevel === 1 ? '已標出關聯格，但不會顯示答案位置。' : `無標記作答。觀察口訣：${lesson.cue}`}</p>${active.feedback ? `<div class="assessment-feedback">${active.feedback}</div>` : ''}${reasoning}${explanation}<div class="assessment-actions">${allowHint && !active.answered ? `<button type="button" data-assessment-hint>${revealLevel === 0 ? '提示：顯示關聯格' : revealLevel === 1 ? '再提示：顯示目標格' : '提示已完整顯示'}</button>` : ''}<button type="button" data-assessment-prev>上一題</button><button type="button" data-assessment-next>下一題</button></div></aside></div>`;
}

function renderLessonWorkbench() {
  const panel = byId('lesson-workbench');
  const active = state.activeLesson;
  if (!panel || !active) {
    if (panel) panel.hidden = true;
    return;
  }
  const lesson = ALL_LESSONS.find((item) => item.id === active.id);
  const content = getTutorial(active.id);
  if (!lesson || !content) return;
  const result = lessonResult(lesson.id);
  const technique = assessmentTechnique(lesson);
  const questions = technique ? getTechniqueQuestions(technique, 12) : [];
  const discrimination = technique ? getDiscriminationQuestions(technique, 4) : [];
  const dimensions = computeSkillDimensions(result);
  const checkMarkup = `<div class="knowledge-check"><span>理解檢核</span><h3>${content.check.prompt}</h3><div class="choice-list">${content.check.choices.map((choice, index) => `<button type="button" data-check-answer="${index}">${choice}</button>`).join('')}</div>${active.knowledgeFeedback ? `<p class="check-feedback">${active.knowledgeFeedback}</p>` : ''}${result.knowledgePassed ? '<b class="pass-note">✓ 已通過理解檢核</b>' : ''}</div>`;
  const phaseNav = questions.length ? `<nav class="lesson-phase-nav" aria-label="五階段學習">${LESSON_PHASES.map((phase) => `<button type="button" data-lesson-phase="${phase.id}" class="${active.phase === phase.id ? 'active' : ''}"><i>${phase.number}</i><span>${phase.label}</span></button>`).join('')}</nav>` : '';
  let phaseMarkup = `<div class="assessment-empty"><b>本節為基礎觀念教材</b><p>讀完原理、例題與陷阱，再完成理解檢核即可通過。</p></div>${checkMarkup}`;
  let activeQuestion = null;

  if (questions.length && active.phase === 'worked') {
    const question = questions[0];
    activeQuestion = question;
    const workedStep = Number(active.workedStep || 0);
    const workedCopy = [
      '先不找答案：辨認題目要觀察的候選數與單位。',
      '現在顯示建立結論的關聯格與連結；逐一核對技巧條件。',
      '現在標出結論位置；先自己說出填入或排除的理由。',
      question.explanation
    ][workedStep];
    phaseMarkup = `<div class="phase-intro"><span>STAGE 1 · WORKED EXAMPLE</span><h3>動態示範：一次只揭露一層</h3><p>${workedCopy}</p></div><div class="assessment-layout"><div>${assessmentBoardMarkup(question, active, workedStep, true)}</div><aside class="assessment-coach"><span>${question.variantLabel}</span><p>${question.prompt}</p>${workedStep >= 3 ? `<div class="answer-explanation"><b>完整推理</b><p>${question.explanation}</p><small>${question.answerSummary}</small></div>` : ''}<div class="assessment-actions"><button type="button" data-worked-next>${workedStep < 3 ? '揭示下一步' : '進入半引導練習'}</button></div></aside></div>${checkMarkup}`;
  } else if (questions.length && ['scaffold', 'target', 'transfer'].includes(active.phase)) {
    const range = active.phase === 'scaffold' ? [1, Math.min(3, questions.length - 1)] : active.phase === 'target' ? [4, Math.min(10, questions.length - 1)] : [Math.min(11, questions.length - 1), Math.min(11, questions.length - 1)];
    if (active.questionIndex < range[0] || active.questionIndex > range[1]) active.questionIndex = range[0];
    const question = questions[active.questionIndex];
    activeQuestion = question;
    const autoSupport = hintSupportFor(result, active.phase, active.questionIndex);
    const revealLevel = active.phase === 'transfer' ? 0 : Math.max(autoSupport, active.hintLevel);
    const label = active.phase === 'scaffold' ? 'STAGE 2 · 半引導練習' : active.phase === 'target' ? 'STAGE 3 · 指定位置考試' : 'STAGE 5 · 無提示遷移考';
    const exercise = questionExerciseMarkup({ lesson, question, active, result, revealLevel, phaseLabel: label, position: active.questionIndex - range[0] + 1, total: range[1] - range[0] + 1, allowHint: active.phase === 'scaffold' });
    const transferAction = active.phase === 'transfer' && DRILL_BY_TECHNIQUE.get(technique) ? `<div class="transfer-action"><div><b>再往前一步：完整盤面專項</b><p>從初始題目解到完成，檢查你能否在沒有標記的情況下自己遇見這個技巧。</p></div><button type="button" data-transfer-drill="${technique}">${result.transferPassed ? '再做完整盤面' : '開始完整盤面'}</button></div>` : '';
    phaseMarkup = `<div class="phase-intro"><span>${label}</span><h3>${active.phase === 'scaffold' ? '提示會逐題淡出' : active.phase === 'target' ? '先找位置，再證明理由' : '沒有關聯格、沒有答案提示'}</h3><p>${active.phase === 'scaffold' ? '第 1 題顯示答案區域，第 2 題只顯示關聯，第 3 題完全不標記；需要時仍可主動求助。' : active.phase === 'target' ? '每題必須完成「動作＋理由」兩段作答，猜中位置不算通過。' : '這題使用完整候選盤面但移除所有教學標記，檢查能否把技巧遷移到新情境。'}</p></div>${exercise}${transferAction}`;
  } else if (questions.length && active.phase === 'discriminate') {
    if (active.discriminationIndex >= discrimination.length) active.discriminationIndex = 0;
    const item = discrimination[active.discriminationIndex];
    activeQuestion = item.sourceQuestion;
    const passed = result.discriminationPassedIds.includes(item.id);
    phaseMarkup = `<div class="phase-intro"><span>STAGE 4 · MIXED DISCRIMINATION</span><h3>先辨識技巧，也要能判斷「不是它」</h3><p>只判斷盤面上標示的候選結構；其他位置即使另有技巧，也不影響本題。</p></div><div class="assessment-head"><div><span>混合辨識 · ${active.discriminationIndex + 1}/${discrimination.length}</span><h3>${item.prompt}</h3></div><span class="question-source">${item.sourceQuestion.variantLabel}</span></div><div class="assessment-layout"><div class="noninteractive-board">${assessmentBoardMarkup(item.sourceQuestion, active, 1, false)}</div><aside class="assessment-coach"><span>${passed ? '已通過此題' : '選出最精確的判斷'}</span><div class="discrimination-choices">${item.choices.map((choice) => `<button type="button" data-discrimination-answer="${choice.id}">${choice.technique ? strategyNames[choice.technique] || choice.technique : '條件不足／以上皆非'}</button>`).join('')}</div>${active.discriminationFeedback ? `<div class="assessment-feedback">${active.discriminationFeedback}</div>` : ''}<div class="assessment-actions"><button type="button" data-discrimination-prev>上一題</button><button type="button" data-discrimination-next>下一題</button></div></aside></div>`;
  }

  const masteryMarkup = `<div class="lesson-mastery-strip">${[['理解', dimensions.understanding], ['辨識', dimensions.recognition], ['執行', dimensions.execution], ['遷移', dimensions.transfer], ['保留', dimensions.retention]].map(([label, value]) => `<div><span>${label}</span><b>${value}</b><i style="--score:${value}%"></i></div>`).join('')}</div>`;
  panel.hidden = false;
  panel.innerHTML = `<header class="workbench-title"><div><span>${lesson.stageTitle} · 五階段精熟課程</span><h2>${lesson.name}</h2></div><button type="button" data-lesson-close aria-label="關閉教材">×</button></header>${phaseNav}${masteryMarkup}<div class="tutorial-grid"><article><b>核心原理</b><p>${content.principle}</p></article><article><b>判讀三步</b><ol>${content.steps.map((step) => `<li>${step}</li>`).join('')}</ol></article><article><b>完整例題</b><p>${content.example}</p></article><article class="pitfall"><b>常見陷阱</b><p>${content.pitfall}</p></article></div><section class="target-assessment">${phaseMarkup}</section>`;

  panel.querySelector('[data-lesson-close]').addEventListener('click', () => { state.activeLesson = null; panel.hidden = true; });
  panel.querySelectorAll('[data-lesson-phase]').forEach((button) => button.addEventListener('click', () => {
    active.phase = button.dataset.lessonPhase;
    if (active.phase === 'scaffold') active.questionIndex = 1;
    if (active.phase === 'target') active.questionIndex = 4;
    if (active.phase === 'transfer') active.questionIndex = Math.min(11, questions.length - 1);
    resetLessonInteraction(active);
    renderLessonWorkbench();
  }));
  panel.querySelectorAll('[data-check-answer]').forEach((button) => button.addEventListener('click', () => {
    const correct = Number(button.dataset.checkAnswer) === content.check.answer;
    active.knowledgeFeedback = `${correct ? '答對：' : '再想一次：'}${content.check.explanation}`;
    if (correct) result.knowledgePassed = true;
    syncLessonCompletion(lesson);
    renderLessonWorkbench();
  }));
  panel.querySelector('[data-worked-next]')?.addEventListener('click', () => {
    if (Number(active.workedStep || 0) < 3) active.workedStep = Number(active.workedStep || 0) + 1;
    else { active.phase = 'scaffold'; active.questionIndex = 1; resetLessonInteraction(active); }
    renderLessonWorkbench();
  });
  if (activeQuestion && ['scaffold', 'target', 'transfer'].includes(active.phase)) {
    panel.querySelectorAll('[data-assessment-cell]').forEach((button) => button.addEventListener('click', () => {
      if (active.pendingMove || active.answered) return;
      active.selected = Number(button.dataset.assessmentCell);
      active.feedback = `已選 ${cellName(active.selected)}，現在選擇要${activeQuestion.kind === 'placement' ? '填入' : '排除'}的數字。`;
      renderLessonWorkbench();
    }));
    panel.querySelectorAll('[data-assessment-digit]').forEach((button) => button.addEventListener('click', () => {
      if (active.selected < 0) { active.feedback = '請先點選一個目標格。'; return renderLessonWorkbench(); }
      const attempts = active.attemptsByQuestion[activeQuestion.id] || 0;
      const digit = Number(button.dataset.assessmentDigit);
      result.attempts += 1;
      if (evaluateTechniqueAnswer(activeQuestion, active.selected, digit)) {
        active.pendingMove = { index: active.selected, digit, firstTry: attempts === 0 && !active.usedHint };
        active.feedback = `動作正確：${cellName(active.selected)} ${activeQuestion.kind === 'placement' ? '填入' : '排除'} ${digit}。還要選對成立理由才算通過。`;
      } else {
        active.attemptsByQuestion[activeQuestion.id] = attempts + 1;
        const diagnostic = diagnoseTechniqueAnswer(activeQuestion, active.selected, digit);
        Object.assign(result, recordDiagnostic(result, diagnostic.code));
        active.feedback = `<b>${diagnostic.title}</b><br>${diagnostic.message}`;
      }
      persistProgress();
      renderLessonWorkbench();
    }));
    panel.querySelectorAll('[data-reason-answer]').forEach((button) => button.addEventListener('click', () => {
      result.reasonAttempts += 1;
      if (evaluateReasonAnswer(activeQuestion, button.dataset.reasonAnswer)) {
        active.answered = true;
        active.reasonFeedback = '理由正確。你已同時完成位置判讀與邏輯證明。';
        if (!result.passedQuestionIds.includes(activeQuestion.id)) result.passedQuestionIds.push(activeQuestion.id);
        if (!result.reasonPassedQuestionIds.includes(activeQuestion.id)) {
          result.reasonPassedQuestionIds.push(activeQuestion.id);
          if (active.pendingMove?.firstTry) result.firstTryCorrect += 1;
        }
        if (active.phase === 'transfer') result.transferPassed = true;
        if (isReviewDue(result)) Object.assign(result, scheduleReview(result, { correct: true }));
      } else {
        Object.assign(result, recordDiagnostic(result, 'technique-confusion'));
        active.reasonFeedback = '理由不成立：它漏掉了必要條件，或把另一種技巧的規則套在這裡。請逐項核對強連結、可見關係與候選集合。';
      }
      syncLessonCompletion(lesson);
      renderLessonWorkbench();
    }));
    panel.querySelector('[data-assessment-hint]')?.addEventListener('click', () => {
      const shown = Math.max(hintSupportFor(result, active.phase, active.questionIndex), active.hintLevel);
      active.hintLevel = Math.min(2, shown + 1);
      active.usedHint = true;
      result.hintsUsed += 1;
      state.learning.hintsUsed += 1;
      active.feedback = active.hintLevel === 1 ? '已標出建立這一步的關聯格。' : '已標出答案區域；請仍自行完成動作與理由。';
      persistProgress();
      renderLessonWorkbench();
    });
    const range = active.phase === 'scaffold' ? [1, Math.min(3, questions.length - 1)] : active.phase === 'target' ? [4, Math.min(10, questions.length - 1)] : [Math.min(11, questions.length - 1), Math.min(11, questions.length - 1)];
    panel.querySelector('[data-assessment-prev]')?.addEventListener('click', () => {
      active.questionIndex = active.questionIndex <= range[0] ? range[1] : active.questionIndex - 1;
      resetLessonInteraction(active); renderLessonWorkbench();
    });
    panel.querySelector('[data-assessment-next]')?.addEventListener('click', () => {
      active.questionIndex = active.questionIndex >= range[1] ? range[0] : active.questionIndex + 1;
      resetLessonInteraction(active); renderLessonWorkbench();
    });
  }
  if (active.phase === 'discriminate' && discrimination.length) {
    const item = discrimination[active.discriminationIndex];
    panel.querySelectorAll('[data-discrimination-answer]').forEach((button) => button.addEventListener('click', () => {
      result.discriminationAttempts += 1;
      const correct = evaluateDiscriminationAnswer(item, button.dataset.discriminationAnswer);
      active.discriminationFeedback = correct ? `判讀正確。${item.explanation}` : `這個判讀混淆了技巧條件。${item.actualTechnique ? `標示結構實際是「${strategyNames[item.actualTechnique] || item.actualTechnique}」。` : '三個列出的技巧都缺少必要條件。'}`;
      if (correct && !result.discriminationPassedIds.includes(item.id)) result.discriminationPassedIds.push(item.id);
      if (!correct) Object.assign(result, recordDiagnostic(result, 'technique-confusion'));
      syncLessonCompletion(lesson); renderLessonWorkbench();
    }));
    panel.querySelector('[data-discrimination-prev]')?.addEventListener('click', () => { active.discriminationIndex = (active.discriminationIndex + discrimination.length - 1) % discrimination.length; resetLessonInteraction(active); renderLessonWorkbench(); });
    panel.querySelector('[data-discrimination-next]')?.addEventListener('click', () => { active.discriminationIndex = (active.discriminationIndex + 1) % discrimination.length; resetLessonInteraction(active); renderLessonWorkbench(); });
  }
  panel.querySelector('[data-transfer-drill]')?.addEventListener('click', () => startTechniqueDrill(technique));
}

function renderResumeCard(session) {
  const card = byId('resume-session-card');
  if (!card || !session) return;
  const updated = session.updatedAt ? new Date(session.updatedAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '先前';
  card.hidden = false;
  const savedItems = session.trial?.marks?.some(Boolean) ? '盤面、筆記、試填標記與時間' : '盤面、筆記與時間';
  card.innerHTML = `<div><span>${session.completed ? 'COMPLETED SESSION' : 'LOCAL AUTOSAVE'}</span><h2>${session.completed ? '這題已完成，可以再練一次' : '已接續上次的解題進度'}</h2><p>${session.title || '數獨練習'} · ${formatTime(Number(session.elapsed || 0))} · ${updated} 儲存。${savedItems}只保存在這個瀏覽器。</p></div><div><button type="button" data-session-continue>${session.completed ? '查看盤面' : '繼續這題'}</button><button type="button" data-session-restart>${session.completed ? '再練一次' : '從頭重做'}</button></div>`;
  card.querySelector('[data-session-continue]').addEventListener('click', () => {
    card.hidden = true;
    byId('sudoku-board').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  card.querySelector('[data-session-restart]').addEventListener('click', () => {
    loadPuzzle(session.record, session.title);
    state.activeDrill = session.activeDrill ? DRILL_BY_TECHNIQUE.get(session.activeDrill) || null : null;
    persistSession();
    card.hidden = true;
    showToast('已保留歷程並建立新的重做紀錄。', 'success');
  });
}

const SKILL_DIMENSIONS = Object.freeze([
  ['understanding', '理解原理'],
  ['recognition', '辨識技巧'],
  ['execution', '執行推理'],
  ['transfer', '無提示遷移'],
  ['retention', '間隔保留']
]);

function reviewDateLabel(value) {
  if (!value) return '尚未排程';
  const date = new Date(value);
  const due = date.getTime() <= Date.now();
  const label = date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
  return due ? `今天到期 · 原排 ${label}` : `${label} 複習`;
}

function puzzleReviewRecommendation(review) {
  if (!review.logicalOnly) return '目前技巧庫無法完整邏輯解出；先看前段可解步驟，不把搜尋驗證當技巧。';
  if (review.hints >= 2 || review.stalls >= 3) return '這題曾多次卡住；建議隔天重做，先自己找下一手，再開提示核對。';
  if (review.hints === 1 || review.stalls > 0) return '整體已完成，但有一次求助或停滯；挑同技巧新題做無提示遷移。';
  return '這次解題流暢；下一步可提高一級，或用理由模式口述最難的一手。';
}

function renderLearningInsights() {
  const targetResults = TARGETED_LESSONS.map((lesson) => lessonResult(lesson.id));
  const dimensions = aggregateSkillDimensions(targetResults);
  const skillMap = byId('skill-map');
  if (skillMap) {
    skillMap.innerHTML = SKILL_DIMENSIONS.map(([key, label]) => `<div class="skill-dimension"><span>${label}</span><div><i style="--score:${dimensions[key]}%"></i></div><b>${dimensions[key]}</b></div>`).join('');
  }

  const scheduled = ALL_LESSONS
    .map((lesson) => ({ lesson, result: lessonResult(lesson.id) }))
    .filter(({ result }) => result.nextReviewAt)
    .sort((a, b) => new Date(a.result.nextReviewAt) - new Date(b.result.nextReviewAt));
  const due = scheduled.filter(({ result }) => isReviewDue(result));
  const dueCount = byId('review-due-count');
  if (dueCount) dueCount.textContent = `${due.length} 課待複習`;
  const queue = byId('review-queue');
  if (queue) {
    queue.innerHTML = scheduled.length
      ? scheduled.slice(0, 6).map(({ lesson, result }) => `<button type="button" class="review-item ${isReviewDue(result) ? 'due' : ''}" data-review-open="${lesson.id}"><span>${reviewDateLabel(result.nextReviewAt)}</span><b>${lesson.name}</b><small>第 ${Math.min(4, result.reviewStage)} / 4 輪 · 1、3、7、21 天</small></button>`).join('')
      : '<p class="insight-empty">完成一門五階課程後，會從隔天開始安排 1、3、7、21 天複習。</p>';
  }

  const reviewList = byId('puzzle-review-list');
  if (reviewList) {
    reviewList.innerHTML = state.learning.puzzleReviews.length
      ? state.learning.puzzleReviews.slice(0, 6).map((review) => {
        const techniques = review.techniques.slice(0, 4).map(({ technique, count }) => `${strategyNames[technique] || technique} × ${count}`).join(' · ') || '未辨識到已實作邏輯技巧';
        return `<article><div><span>${new Date(review.completedAt).toLocaleDateString('zh-TW')} · ${formatTime(review.elapsed)}</span><h3>${review.title}</h3></div><p><b>題目路徑：</b>${techniques}</p><p><b>學習訊號：</b>提示 ${review.hints} 次 · 卡住 ${review.stalls} 次</p><small>${puzzleReviewRecommendation(review)}</small></article>`;
      }).join('')
      : '<p class="insight-empty">完成一題後，這裡會整理時間、提示、卡住次數、實際技巧與下一步建議。</p>';
  }
}

function renderJourney() {
  const container = byId('journey-stages');
  if (!container) return;
  const completed = state.learning.completedLessons;
  const nextLesson = ALL_LESSONS.find((lesson) => !completed.has(lesson.id));
  const percent = Math.round((completed.size / ALL_LESSONS.length) * 100);
  byId('lesson-progress').textContent = `${completed.size} / ${ALL_LESSONS.length}`;
  byId('lesson-progress-bar').style.width = `${percent}%`;
  byId('detector-count').textContent = `${DETECTABLE_LESSONS.length} 種技巧`;
  const totalTargets = TARGETED_LESSONS.length * 11;
  const passedTargets = TARGETED_LESSONS.reduce((sum, lesson) => sum + Math.min(11, lessonResult(lesson.id).reasonPassedQuestionIds.length), 0);
  byId('drill-progress').textContent = `${passedTargets} / ${totalTargets}`;
  byId('activity-count').textContent = `${state.learning.totalActivities} 次`;

  const continueCard = byId('continue-card');
  if (nextLesson) {
    continueCard.innerHTML = `<div><span>下一個學習節點 · ${nextLesson.stageTitle}</span><h2>${nextLesson.name}</h2><p>${nextLesson.summary} ${nextLesson.cue}</p></div><button type="button" data-lesson-open="${nextLesson.id}">開始教學</button>`;
  } else {
    continueCard.innerHTML = '<div><span>旅程完成</span><h2>你已走完全部學習節點</h2><p>下一步是用不同題型反覆練習，並檢查自己能否說明每個排除理由。</p></div><button type="button" data-practice="expert">挑戰一題</button>';
  }

  container.innerHTML = JOURNEY_STAGES.map((stage) => {
    const completedInStage = stage.lessons.filter((lesson) => completed.has(lesson.id)).length;
    const lessons = stage.lessons.map((lesson, index) => {
      const done = completed.has(lesson.id);
      const detector = lesson.analyzer && lesson.analyzer !== 'search' ? '<span class="detector-badge">分析器可辨識</span>' : lesson.assessment ? '<span class="detector-badge">定點題可練</span>' : '<span class="detector-badge">教材涵蓋</span>';
      const caution = lesson.caution ? '<span class="caution-badge">注意假設邊界</span>' : '';
      const drill = lesson.analyzer && DRILL_BY_TECHNIQUE.get(lesson.analyzer);
      const drillDone = drill && state.learning.completedDrills.has(drill.technique);
      const result = lessonResult(lesson.id);
      const technique = assessmentTechnique(lesson);
      const targetCount = technique ? 11 : 0;
      const passedCount = technique ? Math.min(targetCount, result.reasonPassedQuestionIds.length) : 0;
      const drillButton = drill ? `<button class="drill-action ${drillDone ? 'passed' : ''}" type="button" data-technique-drill="${drill.technique}">${drillDone ? '已通過 · 再練' : '完整盤面題'}</button>` : '';
      const mastery = targetCount ? `理解 ${result.knowledgePassed ? '✓' : '○'} · 推理 ${passedCount}/${targetCount} · 辨識 ${Math.min(4, result.discriminationPassedIds.length)}/4 · 遷移 ${result.transferPassed ? '✓' : '○'}` : `理解 ${result.knowledgePassed ? '✓' : '○'}`;
      return `<li class="lesson-item ${done ? 'done' : ''}"><span class="lesson-state">${done ? '✓' : String(index + 1).padStart(2, '0')}</span><div class="lesson-copy"><h3>${lesson.name}${detector}${caution}</h3><p>${lesson.summary}</p><small>觀察口訣：${lesson.cue}｜${mastery}</small></div><div class="lesson-actions">${drillButton}<button class="lesson-action" type="button" data-lesson-open="${lesson.id}">${done ? '複習教學' : '開始教學'}</button></div></li>`;
    }).join('');
    return `<section class="journey-stage"><header class="stage-heading"><span class="stage-number">${stage.number}</span><div class="stage-copy"><h2>${stage.title}</h2><p>${stage.description}</p></div><div class="stage-meta"><b>${stage.level} · ${completedInStage}/${stage.lessons.length}</b><small>${stage.gate}</small><button class="stage-practice" type="button" data-practice="${stage.difficulty}">練習此階段</button></div></header><ol class="lesson-list">${lessons}</ol><p class="stage-gate"><b>過關條件：</b>${stage.gate}</p></section>`;
  }).join('');

  const history = byId('learning-history');
  history.innerHTML = state.learning.activities.length
    ? state.learning.activities.slice(0, 12).map((event) => `<li><time datetime="${event.at}">${new Date(event.at).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })} ${new Date(event.at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</time><span>${event.detail}</span></li>`).join('')
    : '<li class="history-empty">尚無紀錄。完成課程、使用提示、分析或解完題目後會出現在這裡。</li>';

  renderLearningInsights();

  document.querySelectorAll('[data-lesson-open]').forEach((button) => button.addEventListener('click', () => openLesson(button.dataset.lessonOpen)));
  document.querySelectorAll('[data-review-open]').forEach((button) => button.addEventListener('click', () => openLesson(button.dataset.reviewOpen, 'target')));
  document.querySelectorAll('[data-practice]').forEach((button) => button.addEventListener('click', () => {
    state.generatorDifficulty = button.dataset.practice;
    document.querySelectorAll('[data-difficulty]').forEach((item) => item.classList.toggle('selected', item.dataset.difficulty === state.generatorDifficulty));
    switchView('generator');
  }));
  document.querySelectorAll('[data-technique-drill]').forEach((button) => button.addEventListener('click', () => startTechniqueDrill(button.dataset.techniqueDrill)));
  renderLessonWorkbench();
}

initializeBoard();
if (pendingSession) restoreSession(pendingSession);
else loadPuzzle(generatePuzzle({ difficulty: 'easy', seed: 'WELCOME-001' }), '今日暖身題');
renderResumeCard(pendingSession);
byId('seed-input').value = randomSeed();
renderLevelPicker();
renderJourney();

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
document.querySelectorAll('[data-number]').forEach((button) => button.addEventListener('click', () => enterNumber(Number(button.dataset.number))));
document.querySelectorAll('[data-difficulty]').forEach((button) => button.addEventListener('click', () => {
  state.generatorDifficulty = button.dataset.difficulty;
  document.querySelectorAll('[data-difficulty]').forEach((item) => item.classList.toggle('selected', item === button));
}));
byId('level-stage-tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-level-stage]');
  if (!button) return;
  const stage = Number(button.dataset.levelStage);
  const first = (stage - 1) * 60 + 1;
  const last = first + 59;
  const nextOpen = getNextChallengeNumber(state.learning.completedPuzzles, qualifiedLevelsFrom(state.learning.levelQualifications));
  const completedInStage = Array.from({ length: 60 }, (_, index) => first + index).filter((number) => state.learning.completedPuzzles.has(challengeIdFor(number)));
  const target = nextOpen >= first && nextOpen <= last ? nextOpen : completedInStage.at(-1) || first;
  selectChallenge(target);
});
byId('challenge-map').addEventListener('click', (event) => {
  const button = event.target.closest('[data-challenge]');
  if (!button) return;
  selectChallenge(Number(button.dataset.challenge));
});
byId('bank-start-btn').addEventListener('click', () => {
  if (!isChallengeUnlocked(state.selectedChallenge, state.learning.completedPuzzles, qualifiedLevelsFrom(state.learning.levelQualifications))) return;
  const record = getChallenge(state.selectedChallenge);
  loadPuzzle(record, record.title);
  switchView('practice');
  showToast(`已載入第 ${record.challengeNumber} 關：${record.blanks} 格空白，最難技巧為${record.techniqueLabel}。`, 'success');
});
byId('next-challenge-btn').addEventListener('click', (event) => {
  const challengeNumber = Number(event.currentTarget.dataset.challenge);
  if (!isChallengeUnlocked(challengeNumber, state.learning.completedPuzzles, qualifiedLevelsFrom(state.learning.levelQualifications))) return;
  selectChallenge(challengeNumber);
  const record = getChallenge(challengeNumber);
  loadPuzzle(record, record.title);
  showToast(`第 ${challengeNumber} 關已載入。`, 'success');
});

byId('undo-btn').addEventListener('click', undo);
byId('all-notes-btn').addEventListener('click', toggleAllNotes);
byId('trial-btn').addEventListener('click', () => {
  if (state.trial.active) keepTrialChanges();
  else activateTrial(state.trial.focus);
});
document.querySelectorAll('[data-trial-color]').forEach((button) => button.addEventListener('click', () => activateTrial(Number(button.dataset.trialColor))));
byId('trial-confirm-btn').addEventListener('click', confirmTrialChanges);
byId('trial-keep-btn').addEventListener('click', () => keepTrialChanges());
byId('trial-clear-btn').addEventListener('click', clearTrialChanges);
byId('erase-btn').addEventListener('click', eraseSelected);
byId('reset-btn').addEventListener('click', resetPuzzle);
byId('hint-btn').addEventListener('click', requestHint);
byId('apply-hint-btn').addEventListener('click', applyHint);
byId('check-btn').addEventListener('click', checkAnswer);
byId('notes-btn').addEventListener('click', () => {
  if (trialInputIsPaused()) return;
  state.notesMode = !state.notesMode;
  byId('notes-btn').classList.toggle('active', state.notesMode);
  byId('notes-btn').querySelector('b').textContent = state.notesMode ? '開' : '關';
});
byId('random-seed-btn').addEventListener('click', () => { byId('seed-input').value = randomSeed(); });
byId('generate-btn').addEventListener('click', () => {
  const seed = byId('seed-input').value.trim() || randomSeed();
  byId('seed-input').value = seed;
  const record = generatePuzzle({ difficulty: state.generatorDifficulty, seed });
  loadPuzzle(record);
  switchView('practice');
  showToast(`已生成「${record.difficultyLabel}」題目，共 ${record.clues} 個線索。`, 'success');
});
byId('use-current-btn').addEventListener('click', () => { byId('puzzle-input').value = serializeGrid(state.grid, '0'); });
byId('analyze-btn').addEventListener('click', runAnalysis);
window.addEventListener('pagehide', persistSession);

document.addEventListener('keydown', (event) => {
  if (event.target.matches('input, textarea')) return;
  if (/^[1-9]$/.test(event.key)) enterNumber(Number(event.key));
  else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') eraseSelected();
  else if (state.selected >= 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    const row = Math.floor(state.selected / 9);
    const col = state.selected % 9;
    const nextRow = Math.max(0, Math.min(8, row + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)));
    const nextCol = Math.max(0, Math.min(8, col + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)));
    selectCell(nextRow * 9 + nextCol);
  }
});
