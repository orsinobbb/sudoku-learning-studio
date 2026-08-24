import {
  DIFFICULTIES,
  PEERS,
  analyzePuzzle,
  candidateNotesForGrid,
  candidatesFor,
  cellName,
  generatePuzzle,
  getCompletedDigits,
  isSolved,
  suggestNextMoves,
  parsePuzzle,
  serializeGrid,
  validateGrid
} from './core/sudoku.js?v=20260824-notes1';
import { ALL_LESSONS, DETECTABLE_LESSONS, JOURNEY_STAGES, TARGETED_LESSONS, TECHNIQUE_NAMES } from './learning/curriculum.js?v=20260824-notes1';
import { DRILL_BY_TECHNIQUE } from './learning/drills.js?v=20260824-notes1';
import { evaluateTechniqueAnswer, getTechniqueQuestions } from './learning/assessments.js?v=20260824-notes1';
import { getTutorial } from './learning/tutorials.js?v=20260824-notes1';
import { readProgress, readSession, writeProgress, writeSession } from './learning/storage.js?v=20260824-notes1';

const byId = (id) => document.getElementById(id);
const board = byId('sudoku-board');
const coachContent = byId('coach-content');
const toast = byId('toast');
const strategyNames = TECHNIQUE_NAMES;
const assessmentTechnique = (lesson) => lesson.assessment || (lesson.analyzer !== 'search' ? lesson.analyzer : null);

const storedProgress = readProgress();
const pendingSession = readSession();

const learningProfile = {
  completedLessons: new Set(Array.isArray(storedProgress.completedLessons) ? storedProgress.completedLessons : []),
  completedDrills: new Set(Array.isArray(storedProgress.completedDrills) ? storedProgress.completedDrills : []),
  activities: Array.isArray(storedProgress.activities) ? storedProgress.activities.slice(0, 60) : [],
  totalActivities: Number(storedProgress.totalActivities || storedProgress.activities?.length || 0),
  hintsUsed: Number(storedProgress.hintsUsed || 0),
  analysesRun: Number(storedProgress.analysesRun || 0),
  lessonResults: storedProgress.lessonResults
};

const state = {
  record: null,
  grid: [],
  notes: Array.from({ length: 81 }, () => new Set()),
  selected: -1,
  notesMode: false,
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
  solvedCount: Number(storedProgress.solvedCount || 0),
  learning: learningProfile,
  generatorDifficulty: 'easy'
};

function persistProgress() {
  writeProgress({
    solvedCount: state.solvedCount,
    completedLessons: [...state.learning.completedLessons],
    completedDrills: [...state.learning.completedDrills],
    activities: state.learning.activities,
    totalActivities: state.learning.totalActivities,
    hintsUsed: state.learning.hintsUsed,
    analysesRun: state.learning.analysesRun,
    lessonResults: state.learning.lessonResults
  });
}

function lessonResult(id) {
  if (!state.learning.lessonResults[id]) {
    state.learning.lessonResults[id] = { knowledgePassed: false, passedQuestionIds: [], attempts: 0, firstTryCorrect: 0, hintsUsed: 0 };
  }
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
    selected: state.selected,
    elapsed: state.elapsed,
    completed: state.completed,
    activeDrill: state.activeDrill?.technique || null,
    startedAt: state.startedAt
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
  const completedDigits = new Set(getCompletedDigits(state.grid, state.record.solution));
  const selectedValue = state.selected >= 0 ? state.grid[state.selected] : 0;
  for (let index = 0; index < 81; index += 1) {
    const cell = board.children[index];
    const value = state.grid[index];
    const isPeer = state.selected >= 0 && PEERS[state.selected].has(index);
    cell.className = 'sudoku-cell';
    if (given.has(index)) cell.classList.add('given');
    else if (value) cell.classList.add('entered');
    if (index === state.selected) cell.classList.add('selected');
    else if (isPeer) cell.classList.add('peer');
    if (selectedValue && value === selectedValue) cell.classList.add('same-number');
    if (value && completedDigits.has(value)) cell.classList.add('digit-completed');
    if (state.conflicts.has(index)) cell.classList.add('conflict');
    if (state.wrong.has(index)) cell.classList.add('wrong');
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
    cell.setAttribute('aria-label', `${cellName(index)}${value ? `，數字 ${value}` : '，空格'}`);
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
    setCoach('你的作答', `${cellName(index)}填了 ${value}`, '你可以檢查它是否與同一橫列、直行或九宮中的數字重複。', '沒有重複不一定代表答案正確，但表示目前符合基本規則。');
  } else {
    const candidates = candidatesFor(state.grid, index);
    setCoach('候選數觀察', `${cellName(index)}有 ${candidates.length} 個可能`, candidates.length ? `目前可填：${candidates.join('、')}。` : '這一格已經沒有可用數字，請檢查前面的作答。', '候選數是排除同行、同列與同宮已出現數字後，剩下的可能。');
  }
  renderBoard();
}

function saveHistory() {
  state.history.push({ grid: [...state.grid], notes: state.notes.map((set) => [...set]) });
  if (state.history.length > 100) state.history.shift();
}

function toggleAllNotes() {
  if (state.completed || !state.grid.some((value) => !value)) {
    showToast('題目已完成，沒有空格需要筆記。');
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
  state.wrong.clear();
  return validation;
}

function enterNumber(digit) {
  const index = state.selected;
  if (index < 0 || state.record.puzzle[index] || state.completed) return;
  const hadSuggestions = state.suggestions.length > 0;
  saveHistory();
  state.hint = null;
  state.suggestions = [];
  byId('apply-hint-btn').hidden = true;
  if (state.notesMode && !state.grid[index]) {
    if (state.notes[index].has(digit)) state.notes[index].delete(digit);
    else state.notes[index].add(digit);
  } else {
    state.grid[index] = digit;
    state.notes[index].clear();
    for (const peer of PEERS[index]) state.notes[peer].delete(digit);
  }
  const validation = updateValidation();
  renderBoard();
  persistSession();
  if (!validation.valid) showToast('這個數字與同一單位中的數字重複。', 'warning');
  if (isSolved(state.grid)) completePuzzle();
  else if (hadSuggestions) setCoach('盤面已更新', '先前的建議已失效', '每次填數都會改變候選集合；請先觀察連鎖效果，再重新分析下一手。');
}

function eraseSelected() {
  const index = state.selected;
  if (index < 0 || state.record.puzzle[index] || state.completed) return;
  saveHistory();
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
  state.completed = true;
  state.solvedCount += 1;
  if (state.activeDrill) {
    state.learning.completedDrills.add(state.activeDrill.technique);
    recordActivity('drill', `通過「${strategyNames[state.activeDrill.technique]}」專項考題，用時 ${formatTime(state.elapsed)}`);
    setCoach('專項完成', `已通過「${strategyNames[state.activeDrill.technique]}」考題`, `你用 ${formatTime(state.elapsed)} 完成這題。`, '回想指定技巧出現時，候選數為何能被排除或確定。');
  } else {
    recordActivity('puzzle', `完成「${state.record.difficultyLabel}」題目，用時 ${formatTime(state.elapsed)}`);
    setCoach('完成', '漂亮的推理！', `你用 ${formatTime(state.elapsed)} 完成這題。`, '完成後回想：是哪一個技巧讓盤面開始連鎖解開？');
  }
  showToast('恭喜完成！學習紀錄已保存在這個裝置。', 'success');
  renderBoard();
  persistSession();
}

function requestHint() {
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
  state.learning.hintsUsed += 1;
  const techniques = [...new Set(result.suggestions.map((step) => strategyNames[step.strategy] || step.strategy))];
  recordActivity('hint', `分析 ${result.suggestions.length} 個下一手：${techniques.join('、')}`);
  renderSuggestions(result.suggestions);
}

function applyHint() {
  if (!state.hint || state.hint.kind !== 'placement') return;
  const applied = state.hint;
  state.notesMode = false;
  state.selected = applied.index;
  enterNumber(applied.digit);
  byId('notes-btn').classList.remove('active');
  byId('notes-btn').querySelector('b').textContent = '關';
  if (!state.completed) setCoach(`已套用 · ${strategyNames[applied.strategy] || applied.strategy}`, `${cellName(applied.index)}已填入 ${applied.digit}`, '盤面候選已重新計算；請先觀察這一步帶來的連鎖效果，再分析新的下一手。', applied.explanation);
}

function checkAnswer() {
  const validation = updateValidation();
  if (!validation.valid) {
    showToast(`找到 ${validation.conflicts.length} 個衝突格。`, 'warning');
  } else {
    state.wrong = new Set(state.grid.map((value, index) => value && value !== state.record.solution[index] ? index : -1).filter((index) => index >= 0));
    if (state.wrong.size) showToast(`有 ${state.wrong.size} 格不符合這題的唯一解。`, 'warning');
    else if (isSolved(state.grid)) completePuzzle();
    else showToast('目前填入的答案都正確，可以繼續。', 'success');
  }
  renderBoard();
}

function loadPuzzle(record, title = '', { persist = true } = {}) {
  state.record = record;
  state.grid = [...record.puzzle];
  state.notes = Array.from({ length: 81 }, () => new Set());
  state.history = [];
  state.selected = -1;
  state.conflicts.clear();
  state.wrong.clear();
  state.hint = null;
  state.suggestions = [];
  state.elapsed = 0;
  state.completed = false;
  state.activeDrill = null;
  state.title = title || `${record.seed} · ${record.clues} 個線索`;
  state.sessionId = `${record.seed || 'PUZZLE'}-${Date.now()}`;
  state.startedAt = new Date().toISOString();
  byId('difficulty-badge').textContent = DIFFICULTIES[record.difficulty].label;
  byId('puzzle-title').textContent = state.title;
  byId('apply-hint-btn').hidden = true;
  setCoach('觀察 01', '先從候選數最少的格子開始', '點選一個空格，我會整理同行、同列與同宮的關係，並顯示候選數。', '每一步都應該有盤面依據，不必憑感覺猜。');
  startTimer();
  renderBoard();
  if (persist) persistSession();
}

function restoreSession(session) {
  state.record = session.record;
  state.grid = [...session.grid];
  state.notes = Array.from({ length: 81 }, (_, index) => new Set(Array.isArray(session.notes?.[index]) ? session.notes[index] : []));
  state.history = [];
  state.selected = Number.isInteger(session.selected) ? session.selected : -1;
  state.conflicts = new Set();
  state.wrong = new Set();
  state.hint = null;
  state.suggestions = [];
  state.elapsed = Number(session.elapsed || 0);
  state.completed = Boolean(session.completed);
  state.activeDrill = session.activeDrill ? DRILL_BY_TECHNIQUE.get(session.activeDrill) || null : null;
  state.title = session.title || `${session.record.seed} · 繼續作答`;
  state.sessionId = session.id || `${session.record.seed || 'PUZZLE'}-${Date.now()}`;
  state.startedAt = session.startedAt || new Date().toISOString();
  byId('difficulty-badge').textContent = DIFFICULTIES[state.record.difficulty]?.label || state.record.difficultyLabel || '練習';
  byId('puzzle-title').textContent = state.title;
  byId('apply-hint-btn').hidden = true;
  updateValidation();
  setCoach(state.completed ? '已完成' : '繼續作答', state.completed ? '這題已完成，可以重做' : '已載入上次進度', state.completed ? '按「再練一次」會保留原歷程並建立新的作答。' : `盤面、筆記與 ${formatTime(state.elapsed)} 計時均已復原。`, '資料只保存在這個瀏覽器；清除網站資料或更換裝置後不會同步。');
  startTimer();
  renderBoard();
}

function startTechniqueDrill(technique) {
  const drill = DRILL_BY_TECHNIQUE.get(technique);
  const lesson = ALL_LESSONS.find((item) => item.analyzer === technique);
  if (!drill || !lesson) return;
  const puzzle = parsePuzzle(drill.puzzle);
  const analysis = analyzePuzzle(puzzle);
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function analysisMarkup(analysis) {
  if (!analysis.valid) return `<div class="analysis-error"><b>盤面不合法</b><p>${analysis.conflicts?.length ? `有 ${analysis.conflicts.length} 個互相衝突的格子。` : '這個盤面沒有可行解。'}</p></div>`;
  if (!analysis.unique) return `<div class="analysis-error"><b>不是唯一解題目</b><p>${analysis.solutionCount === 0 ? '找不到任何解。' : '至少存在兩個解，無法作為標準數獨題。'}</p></div>`;
  const chips = Object.entries(analysis.techniqueCounts).map(([key, count]) => `<span>${strategyNames[key] || key} <b>${count}</b></span>`).join('');
  const steps = analysis.steps.slice(0, 12).map((step) => `<li><i>${String(step.number).padStart(2, '0')}</i><div><b>${strategyNames[step.strategy] || step.strategy}</b><p>${step.explanation}</p></div></li>`).join('');
  const boundary = analysis.logicalOnly
    ? '<p class="analysis-boundary">這題可由目前 15 種已實作技巧完整解出，未使用搜尋。</p>'
    : '<p class="analysis-boundary">報告含「搜尋驗證」：代表目前分析器尚未實作足夠的鏈、ALS 或其他高階邏輯，不把搜尋冒充技巧。</p>';
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
  const questionCount = technique ? getTechniqueQuestions(technique, 3).length : 0;
  const passed = result.knowledgePassed && (!questionCount || result.passedQuestionIds.length >= questionCount);
  if (passed && !state.learning.completedLessons.has(lesson.id)) {
    state.learning.completedLessons.add(lesson.id);
    recordActivity('lesson', `通過課程「${lesson.name}」${questionCount ? `與 ${questionCount} 題定點考試` : '理解檢核'}`);
  } else persistProgress();
  return passed;
}

function openLesson(id) {
  const lesson = ALL_LESSONS.find((item) => item.id === id);
  if (!lesson) return;
  state.activeLesson = {
    id,
    questionIndex: 0,
    selected: -1,
    mode: 'guided',
    hintLevel: 0,
    answered: false,
    feedback: '',
    attemptsByQuestion: {},
    knowledgeFeedback: ''
  };
  renderLessonWorkbench();
  byId('lesson-workbench').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function assessmentCell(question, index, active) {
  const value = question.board[index];
  const candidates = question.candidates[index] || [];
  const related = active.hintLevel >= 1 && question.related.includes(index);
  const target = (active.answered || active.hintLevel >= 2) && question.answers.some((answer) => answer.index === index);
  const classes = ['assessment-cell'];
  if (value) classes.push('given');
  if (index === active.selected) classes.push('selected');
  if (related) classes.push('related');
  if (target) classes.push('target');
  const content = value
    ? `<b>${value}</b>`
    : `<span>${Array.from({ length: 9 }, (_, digit) => `<i>${candidates.includes(digit + 1) ? digit + 1 : ''}</i>`).join('')}</span>`;
  return `<button type="button" class="${classes.join(' ')}" data-assessment-cell="${index}" aria-label="${cellName(index)}">${content}</button>`;
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
  const questions = technique ? getTechniqueQuestions(technique, 3) : [];
  const question = questions[active.questionIndex] || null;
  const checkMarkup = `<div class="knowledge-check"><span>理解檢核</span><h3>${content.check.prompt}</h3><div class="choice-list">${content.check.choices.map((choice, index) => `<button type="button" data-check-answer="${index}">${choice}</button>`).join('')}</div>${active.knowledgeFeedback ? `<p class="check-feedback">${active.knowledgeFeedback}</p>` : ''}${result.knowledgePassed ? '<b class="pass-note">✓ 已通過理解檢核</b>' : ''}</div>`;
  let assessmentMarkup = '<div class="assessment-empty"><b>本節為觀念教材</b><p>完成理解檢核即可通過；分析器尚未假裝能自動辨識這項進階技巧。</p></div>';
  if (question) {
    const passedCount = result.passedQuestionIds.filter((id) => questions.some((item) => item.id === id)).length;
    assessmentMarkup = `<div class="assessment-head"><div><span>定點判讀 · ${active.questionIndex + 1}/${questions.length}</span><h3>${question.prompt}</h3><p>${question.instruction}</p></div><div class="mode-switch"><button type="button" data-assessment-mode="guided" class="${active.mode === 'guided' ? 'active' : ''}">教學</button><button type="button" data-assessment-mode="exam" class="${active.mode === 'exam' ? 'active' : ''}">考試</button></div></div>
      <div class="assessment-layout"><div><div class="assessment-board">${question.board.map((_, index) => assessmentCell(question, index, active)).join('')}</div><div class="assessment-pad">${[1,2,3,4,5,6,7,8,9].map((digit) => `<button type="button" data-assessment-digit="${digit}">${digit}</button>`).join('')}</div></div>
      <aside class="assessment-coach"><span>${question.variantLabel} · 已通過 ${passedCount}/${questions.length}</span><p>${active.mode === 'guided' ? `觀察口訣：${lesson.cue}` : '考試模式不顯示提示；請獨立完成一次判讀。'}</p>${active.feedback ? `<div class="assessment-feedback">${active.feedback}</div>` : ''}<div class="assessment-actions">${active.mode === 'guided' && !active.answered ? `<button type="button" data-assessment-hint>${active.hintLevel === 0 ? '提示：標出關聯格' : '再提示：標出答案格'}</button>` : ''}<button type="button" data-assessment-next>下一題</button></div>${active.answered || active.hintLevel >= 2 ? `<div class="answer-explanation"><b>推理說明</b><p>${question.explanation}</p><small>${question.answerSummary}</small></div>` : ''}</aside></div>`;
  }
  panel.hidden = false;
  panel.innerHTML = `<header class="workbench-title"><div><span>${lesson.stageTitle} · 完整教學</span><h2>${lesson.name}</h2></div><button type="button" data-lesson-close aria-label="關閉教材">×</button></header><div class="tutorial-grid"><article><b>核心原理</b><p>${content.principle}</p></article><article><b>判讀三步</b><ol>${content.steps.map((step) => `<li>${step}</li>`).join('')}</ol></article><article><b>完整例題</b><p>${content.example}</p></article><article class="pitfall"><b>常見陷阱</b><p>${content.pitfall}</p></article></div>${checkMarkup}<section class="target-assessment"><div class="target-intro"><span>TARGETED ASSESSMENT</span><h2>指定位置判讀</h2><p>不是把整題做完才算練習：直接判斷哪一格能填入、或哪個候選能排除。</p></div>${assessmentMarkup}</section>`;

  panel.querySelector('[data-lesson-close]').addEventListener('click', () => { state.activeLesson = null; panel.hidden = true; });
  panel.querySelectorAll('[data-check-answer]').forEach((button) => button.addEventListener('click', () => {
    const correct = Number(button.dataset.checkAnswer) === content.check.answer;
    active.knowledgeFeedback = `${correct ? '答對：' : '再想一次：'}${content.check.explanation}`;
    if (correct) result.knowledgePassed = true;
    syncLessonCompletion(lesson);
    renderLessonWorkbench();
  }));
  panel.querySelectorAll('[data-assessment-cell]').forEach((button) => button.addEventListener('click', () => {
    active.selected = Number(button.dataset.assessmentCell);
    active.feedback = `已選 ${cellName(active.selected)}，現在選擇要${question.kind === 'placement' ? '填入' : '排除'}的數字。`;
    renderLessonWorkbench();
  }));
  panel.querySelectorAll('[data-assessment-digit]').forEach((button) => button.addEventListener('click', () => {
    if (active.selected < 0) { active.feedback = '請先點選一個目標格。'; return renderLessonWorkbench(); }
    const attempts = active.attemptsByQuestion[question.id] || 0;
    const correct = evaluateTechniqueAnswer(question, active.selected, Number(button.dataset.assessmentDigit));
    result.attempts += 1;
    if (correct) {
      const firstTry = attempts === 0 && !active.usedHint;
      active.answered = true;
      active.hintLevel = 2;
      active.feedback = `答對：${cellName(active.selected)} ${question.kind === 'placement' ? '填入' : '排除'} ${button.dataset.assessmentDigit}。`;
      if (!result.passedQuestionIds.includes(question.id)) {
        result.passedQuestionIds.push(question.id);
        if (firstTry) result.firstTryCorrect += 1;
      }
    } else {
      active.attemptsByQuestion[question.id] = attempts + 1;
      active.feedback = '這個動作不是本步可證明的答案；回到技巧條件逐項核對。';
    }
    syncLessonCompletion(lesson);
    renderLessonWorkbench();
  }));
  panel.querySelectorAll('[data-assessment-mode]').forEach((button) => button.addEventListener('click', () => {
    active.mode = button.dataset.assessmentMode;
    active.hintLevel = 0;
    active.usedHint = false;
    active.feedback = '';
    renderLessonWorkbench();
  }));
  panel.querySelector('[data-assessment-hint]')?.addEventListener('click', () => {
    active.hintLevel = Math.min(2, active.hintLevel + 1);
    active.usedHint = true;
    result.hintsUsed += 1;
    state.learning.hintsUsed += 1;
    active.feedback = active.hintLevel === 1 ? '已標出建立這一步的關聯格。' : `答案位置已標出；請再說出理由：${question.explanation}`;
    persistProgress();
    renderLessonWorkbench();
  });
  panel.querySelector('[data-assessment-next]')?.addEventListener('click', () => {
    active.questionIndex = (active.questionIndex + 1) % questions.length;
    active.selected = -1;
    active.hintLevel = 0;
    active.usedHint = false;
    active.answered = false;
    active.feedback = '';
    renderLessonWorkbench();
  });
}

function renderResumeCard(session) {
  const card = byId('resume-session-card');
  if (!card || !session) return;
  const updated = session.updatedAt ? new Date(session.updatedAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '先前';
  card.hidden = false;
  card.innerHTML = `<div><span>${session.completed ? 'COMPLETED SESSION' : 'LOCAL AUTOSAVE'}</span><h2>${session.completed ? '這題已完成，可以再練一次' : '已接續上次的解題進度'}</h2><p>${session.title || '數獨練習'} · ${formatTime(Number(session.elapsed || 0))} · ${updated} 儲存。盤面、筆記與時間只保存在這個瀏覽器。</p></div><div><button type="button" data-session-continue>${session.completed ? '查看盤面' : '繼續這題'}</button><button type="button" data-session-restart>${session.completed ? '再練一次' : '從頭重做'}</button></div>`;
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

function renderJourney() {
  const container = byId('journey-stages');
  if (!container) return;
  const completed = state.learning.completedLessons;
  const nextLesson = ALL_LESSONS.find((lesson) => !completed.has(lesson.id));
  const percent = Math.round((completed.size / ALL_LESSONS.length) * 100);
  byId('lesson-progress').textContent = `${completed.size} / ${ALL_LESSONS.length}`;
  byId('lesson-progress-bar').style.width = `${percent}%`;
  byId('detector-count').textContent = `${DETECTABLE_LESSONS.length} 種技巧`;
  const totalTargets = TARGETED_LESSONS.reduce((sum, lesson) => sum + getTechniqueQuestions(assessmentTechnique(lesson), 3).length, 0);
  const passedTargets = TARGETED_LESSONS.reduce((sum, lesson) => sum + lessonResult(lesson.id).passedQuestionIds.length, 0);
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
      const targetCount = technique ? getTechniqueQuestions(technique, 3).length : 0;
      const passedCount = technique ? result.passedQuestionIds.filter((id) => id.startsWith(`${technique}-`)).length : 0;
      const drillButton = drill ? `<button class="drill-action ${drillDone ? 'passed' : ''}" type="button" data-technique-drill="${drill.technique}">${drillDone ? '已通過 · 再練' : '完整盤面題'}</button>` : '';
      const mastery = targetCount ? `理解 ${result.knowledgePassed ? '✓' : '○'} · 定點 ${passedCount}/${targetCount}` : `理解 ${result.knowledgePassed ? '✓' : '○'}`;
      return `<li class="lesson-item ${done ? 'done' : ''}"><span class="lesson-state">${done ? '✓' : String(index + 1).padStart(2, '0')}</span><div class="lesson-copy"><h3>${lesson.name}${detector}${caution}</h3><p>${lesson.summary}</p><small>觀察口訣：${lesson.cue}｜${mastery}</small></div><div class="lesson-actions">${drillButton}<button class="lesson-action" type="button" data-lesson-open="${lesson.id}">${done ? '複習教學' : '開始教學'}</button></div></li>`;
    }).join('');
    return `<section class="journey-stage"><header class="stage-heading"><span class="stage-number">${stage.number}</span><div class="stage-copy"><h2>${stage.title}</h2><p>${stage.description}</p></div><div class="stage-meta"><b>${stage.level} · ${completedInStage}/${stage.lessons.length}</b><small>${stage.gate}</small><button class="stage-practice" type="button" data-practice="${stage.difficulty}">練習此階段</button></div></header><ol class="lesson-list">${lessons}</ol><p class="stage-gate"><b>過關條件：</b>${stage.gate}</p></section>`;
  }).join('');

  const history = byId('learning-history');
  history.innerHTML = state.learning.activities.length
    ? state.learning.activities.slice(0, 12).map((event) => `<li><time datetime="${event.at}">${new Date(event.at).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })} ${new Date(event.at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</time><span>${event.detail}</span></li>`).join('')
    : '<li class="history-empty">尚無紀錄。完成課程、使用提示、分析或解完題目後會出現在這裡。</li>';

  document.querySelectorAll('[data-lesson-open]').forEach((button) => button.addEventListener('click', () => openLesson(button.dataset.lessonOpen)));
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
renderJourney();

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
document.querySelectorAll('[data-number]').forEach((button) => button.addEventListener('click', () => enterNumber(Number(button.dataset.number))));
document.querySelectorAll('[data-difficulty]').forEach((button) => button.addEventListener('click', () => {
  state.generatorDifficulty = button.dataset.difficulty;
  document.querySelectorAll('[data-difficulty]').forEach((item) => item.classList.toggle('selected', item === button));
}));

byId('undo-btn').addEventListener('click', undo);
byId('all-notes-btn').addEventListener('click', toggleAllNotes);
byId('erase-btn').addEventListener('click', eraseSelected);
byId('reset-btn').addEventListener('click', resetPuzzle);
byId('hint-btn').addEventListener('click', requestHint);
byId('apply-hint-btn').addEventListener('click', applyHint);
byId('check-btn').addEventListener('click', checkAnswer);
byId('notes-btn').addEventListener('click', () => {
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
