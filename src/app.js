import {
  DIFFICULTIES,
  PEERS,
  analyzePuzzle,
  candidatesFor,
  cellName,
  generatePuzzle,
  isSolved,
  nextHint,
  parsePuzzle,
  serializeGrid,
  validateGrid
} from './core/sudoku.js';

const byId = (id) => document.getElementById(id);
const board = byId('sudoku-board');
const coachContent = byId('coach-content');
const toast = byId('toast');
const strategyNames = { single: '唯一候選數', hidden: '隱性單數', locked: '區塊排除', pair: '顯性數對', trial: '進階試探' };

const storedProgress = (() => {
  try { return JSON.parse(localStorage.getItem('sudoku-learning-progress')) || {}; } catch { return {}; }
})();

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
  elapsed: 0,
  timerId: null,
  completed: false,
  solvedCount: Number(storedProgress.solvedCount || 0),
  generatorDifficulty: 'easy'
};

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
    if (state.conflicts.has(index)) cell.classList.add('conflict');
    if (state.wrong.has(index)) cell.classList.add('wrong');
    if (state.hint?.index === index) cell.classList.add('hint-target');
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
  renderProgress();
}

function renderProgress() {
  const clues = state.record.puzzle.filter(Boolean).length;
  const placed = state.grid.filter(Boolean).length - clues;
  const total = 81 - clues;
  const percent = total ? Math.max(0, Math.round((placed / total) * 100)) : 100;
  byId('completion-label').textContent = `${percent}%`;
  byId('completion-bar').style.width = `${percent}%`;
  byId('solved-count').textContent = `${state.solvedCount} 題完成`;
}

function selectCell(index) {
  state.selected = index;
  state.hint = null;
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

function updateValidation() {
  const validation = validateGrid(state.grid);
  state.conflicts = new Set(validation.conflicts);
  state.wrong.clear();
  return validation;
}

function enterNumber(digit) {
  const index = state.selected;
  if (index < 0 || state.record.puzzle[index] || state.completed) return;
  saveHistory();
  state.hint = null;
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
  if (!validation.valid) showToast('這個數字與同一單位中的數字重複。', 'warning');
  if (isSolved(state.grid)) completePuzzle();
}

function eraseSelected() {
  const index = state.selected;
  if (index < 0 || state.record.puzzle[index] || state.completed) return;
  saveHistory();
  state.grid[index] = 0;
  state.notes[index].clear();
  state.hint = null;
  updateValidation();
  renderBoard();
}

function undo() {
  const snapshot = state.history.pop();
  if (!snapshot || state.completed) return showToast('目前沒有可復原的動作。');
  state.grid = snapshot.grid;
  state.notes = snapshot.notes.map((values) => new Set(values));
  state.hint = null;
  updateValidation();
  renderBoard();
}

function resetPuzzle() {
  if (state.completed) return;
  saveHistory();
  state.grid = [...state.record.puzzle];
  state.notes = Array.from({ length: 81 }, () => new Set());
  state.elapsed = 0;
  state.selected = -1;
  state.hint = null;
  updateValidation();
  setCoach('重新開始', '盤面已回到最初狀態', '先掃描每個九宮，找出候選數最少的空格。', '優先處理唯一候選，通常能打開後續推理。');
  renderBoard();
}

function completePuzzle() {
  if (state.completed) return;
  state.completed = true;
  state.solvedCount += 1;
  localStorage.setItem('sudoku-learning-progress', JSON.stringify({ solvedCount: state.solvedCount }));
  setCoach('完成', '漂亮的推理！', `你用 ${formatTime(state.elapsed)} 完成這題。`, '完成後回想：是哪一個技巧讓盤面開始連鎖解開？');
  showToast('恭喜完成！學習紀錄已保存在這個裝置。', 'success');
  renderBoard();
}

function requestHint() {
  const validation = updateValidation();
  if (!validation.valid) {
    setCoach('先修正衝突', '盤面中有重複數字', '紅色格子位於同一橫列、直行或九宮，請先修正後再分析。');
    renderBoard();
    return;
  }
  const hint = nextHint(state.grid);
  if (!hint) {
    setCoach('暫時無法分析', '這個盤面可能無解或已完成', '請檢查先前輸入，或使用「題目分析」查看完整結果。');
    return;
  }
  state.hint = hint;
  state.selected = hint.index;
  const setup = hint.setup.length ? `前置推理：${hint.setup.map((step) => strategyNames[step.strategy]).join('、')}。` : '';
  setCoach(`提示 · ${strategyNames[hint.strategy]}`, `${cellName(hint.index)}可以填 ${hint.digit}`, hint.explanation, setup || '先自己確認排除過程，再決定是否套用這一步。');
  byId('apply-hint-btn').hidden = false;
  renderBoard();
}

function applyHint() {
  if (!state.hint) return;
  state.notesMode = false;
  state.selected = state.hint.index;
  enterNumber(state.hint.digit);
  byId('notes-btn').classList.remove('active');
  byId('notes-btn').querySelector('b').textContent = '關';
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

function loadPuzzle(record, title = '') {
  state.record = record;
  state.grid = [...record.puzzle];
  state.notes = Array.from({ length: 81 }, () => new Set());
  state.history = [];
  state.selected = -1;
  state.conflicts.clear();
  state.wrong.clear();
  state.hint = null;
  state.elapsed = 0;
  state.completed = false;
  byId('difficulty-badge').textContent = DIFFICULTIES[record.difficulty].label;
  byId('puzzle-title').textContent = title || `${record.seed} · ${record.clues} 個線索`;
  byId('apply-hint-btn').hidden = true;
  setCoach('觀察 01', '先從候選數最少的格子開始', '點選一個空格，我會整理同行、同列與同宮的關係，並顯示候選數。', '每一步都應該有盤面依據，不必憑感覺猜。');
  startTimer();
  renderBoard();
}

function switchView(name) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${name}-view`));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function analysisMarkup(analysis) {
  if (!analysis.valid) return `<div class="analysis-error"><b>盤面不合法</b><p>${analysis.conflicts?.length ? `有 ${analysis.conflicts.length} 個互相衝突的格子。` : '這個盤面沒有可行解。'}</p></div>`;
  if (!analysis.unique) return `<div class="analysis-error"><b>不是唯一解題目</b><p>${analysis.solutionCount === 0 ? '找不到任何解。' : '至少存在兩個解，無法作為標準數獨題。'}</p></div>`;
  const labels = { single: '唯一候選', hidden: '隱性單數', locked: '區塊排除', pair: '顯性數對', trial: '進階試探' };
  const chips = Object.entries(analysis.techniqueCounts).map(([key, count]) => `<span>${labels[key]} <b>${count}</b></span>`).join('');
  const steps = analysis.steps.slice(0, 8).map((step) => `<li><i>${String(step.number).padStart(2, '0')}</i><div><b>${labels[step.strategy]}</b><p>${step.explanation}</p></div></li>`).join('');
  return `<div class="analysis-summary"><div><span>推定難度</span><b>${analysis.rating.label}</b></div><div><span>線索數</span><b>${analysis.clues}</b></div><div><span>解答</span><b>唯一解</b></div></div><p class="analysis-note">${analysis.rating.summary}</p><div class="technique-chips">${chips}</div><ol class="analysis-steps">${steps}</ol>${analysis.steps.length > 8 ? `<p class="more-steps">另有 ${analysis.steps.length - 8} 個步驟，這裡先顯示前 8 步。</p>` : ''}`;
}

function runAnalysis() {
  const output = byId('analysis-result');
  try {
    const puzzle = parsePuzzle(byId('puzzle-input').value);
    output.innerHTML = '<p class="analyzing">正在驗證盤面與推理路徑…</p>';
    requestAnimationFrame(() => {
      const analysis = analyzePuzzle(puzzle);
      output.innerHTML = analysisMarkup(analysis);
    });
  } catch (error) {
    output.innerHTML = `<div class="analysis-error"><b>無法讀取題目</b><p>${error.message}</p></div>`;
  }
}

initializeBoard();
loadPuzzle(generatePuzzle({ difficulty: 'easy', seed: 'WELCOME-001' }), '今日暖身題');
byId('seed-input').value = randomSeed();

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
document.querySelectorAll('[data-number]').forEach((button) => button.addEventListener('click', () => enterNumber(Number(button.dataset.number))));
document.querySelectorAll('[data-difficulty]').forEach((button) => button.addEventListener('click', () => {
  state.generatorDifficulty = button.dataset.difficulty;
  document.querySelectorAll('[data-difficulty]').forEach((item) => item.classList.toggle('selected', item === button));
}));

byId('undo-btn').addEventListener('click', undo);
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
