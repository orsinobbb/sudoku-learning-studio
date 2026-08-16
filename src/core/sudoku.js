export const SIZE = 9;
export const CELL_COUNT = 81;

export const ROWS = Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, col) => row * 9 + col));
export const COLS = Array.from({ length: 9 }, (_, col) => Array.from({ length: 9 }, (_, row) => row * 9 + col));
export const BOXES = Array.from({ length: 9 }, (_, box) => {
  const startRow = Math.floor(box / 3) * 3;
  const startCol = (box % 3) * 3;
  return Array.from({ length: 9 }, (_, offset) => (startRow + Math.floor(offset / 3)) * 9 + startCol + (offset % 3));
});
export const UNITS = [...ROWS, ...COLS, ...BOXES];

export const PEERS = Array.from({ length: 81 }, (_, index) => {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
  return new Set([...ROWS[row], ...COLS[col], ...BOXES[box]].filter((cell) => cell !== index));
});

export const DIFFICULTIES = {
  easy: { label: '入門', subtitle: '單一候選' },
  medium: { label: '進階', subtitle: '隱性單數' },
  hard: { label: '挑戰', subtitle: '區塊排除' },
  expert: { label: '專家', subtitle: '綜合推理' }
};

const CALIBRATED_TEMPLATES = {
  easy: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
  medium: '000000907000420180000705026100904000050000040000507009920108000034059000507000000',
  hard: '400000805030000000000700000020000060000080400000010000000603070500200000104000000',
  expert: '005300000800000020070010500400005300010070006003200080060500009004000030000009700'
};

export function parsePuzzle(input) {
  const normalized = String(input == null ? '' : input).replace(/[.·_]/g, '0').replace(/[^0-9]/g, '');
  if (normalized.length !== 81) throw new Error(`需要 81 格，目前讀到 ${normalized.length} 格。`);
  return [...normalized].map(Number);
}

export function serializeGrid(grid, empty = '0') {
  assertGrid(grid);
  return grid.map((value) => value || empty).join('');
}

export function assertGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== 81 || grid.some((value) => !Number.isInteger(value) || value < 0 || value > 9)) {
    throw new TypeError('盤面必須是包含 81 個 0–9 整數的陣列。');
  }
}

export function validateGrid(grid) {
  assertGrid(grid);
  const conflicts = new Set();
  for (const unit of UNITS) {
    const seen = new Map();
    for (const index of unit) {
      const value = grid[index];
      if (!value) continue;
      if (seen.has(value)) {
        conflicts.add(index);
        conflicts.add(seen.get(value));
      } else {
        seen.set(value, index);
      }
    }
  }
  return { valid: conflicts.size === 0, conflicts: [...conflicts].sort((a, b) => a - b) };
}

export function candidatesFor(grid, index) {
  assertGrid(grid);
  if (grid[index]) return [];
  const used = new Set([...PEERS[index]].map((peer) => grid[peer]).filter(Boolean));
  return Array.from({ length: 9 }, (_, offset) => offset + 1).filter((digit) => !used.has(digit));
}

export function isSolved(grid) {
  return grid.every(Boolean) && validateGrid(grid).valid;
}

function makeMasks(grid) {
  const rows = Array(9).fill(0);
  const cols = Array(9).fill(0);
  const boxes = Array(9).fill(0);
  for (let index = 0; index < 81; index += 1) {
    const digit = grid[index];
    if (!digit) continue;
    const row = Math.floor(index / 9);
    const col = index % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    const bit = 1 << digit;
    if ((rows[row] & bit) || (cols[col] & bit) || (boxes[box] & bit)) return null;
    rows[row] |= bit;
    cols[col] |= bit;
    boxes[box] |= bit;
  }
  return { rows, cols, boxes };
}

function searchSolutions(source, limit, keepFirst) {
  assertGrid(source);
  const grid = [...source];
  const masks = makeMasks(grid);
  if (!masks) return { count: 0, solution: null };
  let count = 0;
  let solution = null;

  function search() {
    if (count >= limit) return;
    let bestIndex = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let index = 0; index < 81; index += 1) {
      if (grid[index]) continue;
      const row = Math.floor(index / 9);
      const col = index % 9;
      const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
      const available = 0x3fe & ~(masks.rows[row] | masks.cols[col] | masks.boxes[box]);
      const amount = bitCount(available);
      if (amount === 0) return;
      if (amount < bestCount) {
        bestCount = amount;
        bestIndex = index;
        bestMask = available;
        if (amount === 1) break;
      }
    }
    if (bestIndex < 0) {
      count += 1;
      if (keepFirst && !solution) solution = [...grid];
      return;
    }
    const row = Math.floor(bestIndex / 9);
    const col = bestIndex % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    for (let digit = 1; digit <= 9; digit += 1) {
      const bit = 1 << digit;
      if (!(bestMask & bit)) continue;
      grid[bestIndex] = digit;
      masks.rows[row] |= bit;
      masks.cols[col] |= bit;
      masks.boxes[box] |= bit;
      search();
      grid[bestIndex] = 0;
      masks.rows[row] &= ~bit;
      masks.cols[col] &= ~bit;
      masks.boxes[box] &= ~bit;
      if (count >= limit) return;
    }
  }

  search();
  return { count, solution };
}

function bitCount(value) {
  let count = 0;
  for (let number = value; number; number &= number - 1) count += 1;
  return count;
}

export function countSolutions(grid, limit = 2) {
  return searchSolutions(grid, Math.max(1, limit), false).count;
}

export function solveGrid(grid) {
  return searchSolutions(grid, 1, true).solution;
}

function hashSeed(seed) {
  let value = 2166136261;
  for (const character of String(seed)) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function seededRandom(seed) {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function generateSolution(seed = 'SUDOKU') {
  const random = seededRandom(seed);
  const bands = shuffle([0, 1, 2], random);
  const stacks = shuffle([0, 1, 2], random);
  const rows = bands.flatMap((band) => shuffle([0, 1, 2], random).map((row) => band * 3 + row));
  const cols = stacks.flatMap((stack) => shuffle([0, 1, 2], random).map((col) => stack * 3 + col));
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const pattern = (row, col) => (row * 3 + Math.floor(row / 3) + col) % 9;
  return rows.flatMap((row) => cols.map((col) => digits[pattern(row, col)]));
}

export function generatePuzzle({ difficulty = 'easy', seed = 'SUDOKU' } = {}) {
  const config = DIFFICULTIES[difficulty];
  if (!config) throw new Error(`未知難度：${difficulty}`);
  const normalizedSeed = String(seed || 'SUDOKU').trim().toUpperCase();
  const source = parsePuzzle(CALIBRATED_TEMPLATES[difficulty]);
  const random = seededRandom(`${normalizedSeed}:TRANSFORM:${difficulty}`);
  const bands = shuffle([0, 1, 2], random);
  const stacks = shuffle([0, 1, 2], random);
  const rows = bands.flatMap((band) => shuffle([0, 1, 2], random).map((row) => band * 3 + row));
  const cols = stacks.flatMap((stack) => shuffle([0, 1, 2], random).map((col) => stack * 3 + col));
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const transpose = random() > 0.5;
  const puzzle = Array(81).fill(0);
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const sourceRow = transpose ? rows[col] : rows[row];
      const sourceCol = transpose ? cols[row] : cols[col];
      const value = source[sourceRow * 9 + sourceCol];
      puzzle[row * 9 + col] = value ? digits[value - 1] : 0;
    }
  }
  const solution = solveGrid(puzzle);
  if (!solution || countSolutions(puzzle, 2) !== 1) throw new Error('校準題庫未通過唯一解驗證。');

  return {
    puzzle,
    solution,
    difficulty,
    difficultyLabel: config.label,
    seed: normalizedSeed,
    clues: puzzle.filter(Boolean).length
  };
}

function unitName(unitIndex) {
  if (unitIndex < 9) return `第 ${unitIndex + 1} 橫列`;
  if (unitIndex < 18) return `第 ${unitIndex - 8} 直行`;
  return `第 ${unitIndex - 17} 宮`;
}

export function cellName(index) {
  return `第 ${Math.floor(index / 9) + 1} 列第 ${(index % 9) + 1} 格`;
}

function createCandidateMap(grid) {
  return new Map(grid.map((value, index) => [value, index]).filter(([value]) => !value).map(([, index]) => [index, new Set(candidatesFor(grid, index))]));
}

export function logicalSolve(source) {
  assertGrid(source);
  const initialValidation = validateGrid(source);
  if (!initialValidation.valid) return { solved: false, invalid: true, grid: [...source], steps: [], hardest: 'invalid' };
  const grid = [...source];
  const candidateMap = createCandidateMap(grid);
  const steps = [];
  let hardest = 'single';
  const ranks = { single: 1, hidden: 2, locked: 3, pair: 4, trial: 5 };

  function record(step) {
    steps.push({ number: steps.length + 1, ...step });
    if (ranks[step.strategy] > ranks[hardest]) hardest = step.strategy;
  }

  function place(index, digit, strategy, explanation, related = []) {
    grid[index] = digit;
    candidateMap.delete(index);
    for (const peer of PEERS[index]) candidateMap.get(peer)?.delete(digit);
    record({ kind: 'placement', strategy, index, digit, related, explanation });
  }

  function eliminate(indices, digit, strategy, explanation, related = []) {
    const changed = [];
    for (const index of indices) {
      if (candidateMap.get(index)?.delete(digit)) changed.push(index);
    }
    if (changed.length) record({ kind: 'elimination', strategy, indices: changed, digit, related, explanation });
    return changed.length > 0;
  }

  for (let guard = 0; guard < 500 && candidateMap.size; guard += 1) {
    const impossible = [...candidateMap.entries()].find(([, values]) => values.size === 0);
    if (impossible) return { solved: false, invalid: true, grid, steps, hardest };

    const naked = [...candidateMap.entries()].find(([, values]) => values.size === 1);
    if (naked) {
      const [index, values] = naked;
      const digit = [...values][0];
      place(index, digit, 'single', `${cellName(index)} 的其他數字都已被同行、同列或同宮排除，所以只能填 ${digit}。`);
      continue;
    }

    let progressed = false;
    for (let unitIndex = 0; unitIndex < UNITS.length && !progressed; unitIndex += 1) {
      const unit = UNITS[unitIndex];
      for (let digit = 1; digit <= 9; digit += 1) {
        if (unit.some((index) => grid[index] === digit)) continue;
        const possible = unit.filter((index) => candidateMap.get(index)?.has(digit));
        if (possible.length === 1) {
          place(possible[0], digit, 'hidden', `${unitName(unitIndex)}裡，只有 ${cellName(possible[0])} 還能放 ${digit}。`, unit);
          progressed = true;
          break;
        }
      }
    }
    if (progressed) continue;

    for (let boxIndex = 0; boxIndex < BOXES.length && !progressed; boxIndex += 1) {
      const box = BOXES[boxIndex];
      for (let digit = 1; digit <= 9; digit += 1) {
        const anchors = box.filter((index) => candidateMap.get(index)?.has(digit));
        if (anchors.length < 2) continue;
        const rows = new Set(anchors.map((index) => Math.floor(index / 9)));
        const cols = new Set(anchors.map((index) => index % 9));
        if (rows.size === 1) {
          const row = [...rows][0];
          const targets = ROWS[row].filter((index) => !box.includes(index));
          progressed = eliminate(targets, digit, 'locked', `第 ${boxIndex + 1} 宮中的 ${digit} 都落在第 ${row + 1} 橫列，因此可從同列其他宮排除 ${digit}。`, anchors);
        } else if (cols.size === 1) {
          const col = [...cols][0];
          const targets = COLS[col].filter((index) => !box.includes(index));
          progressed = eliminate(targets, digit, 'locked', `第 ${boxIndex + 1} 宮中的 ${digit} 都落在第 ${col + 1} 直行，因此可從同行其他宮排除 ${digit}。`, anchors);
        }
        if (progressed) break;
      }
    }
    if (progressed) continue;

    for (let unitIndex = 0; unitIndex < UNITS.length && !progressed; unitIndex += 1) {
      const unit = UNITS[unitIndex];
      const pairs = new Map();
      for (const index of unit) {
        const values = candidateMap.get(index);
        if (values?.size !== 2) continue;
        const key = [...values].sort().join('');
        if (!pairs.has(key)) pairs.set(key, []);
        pairs.get(key).push(index);
      }
      for (const [key, anchors] of pairs) {
        if (anchors.length !== 2) continue;
        const digits = [...key].map(Number);
        const targets = unit.filter((index) => !anchors.includes(index));
        const changed = [];
        for (const digit of digits) {
          for (const index of targets) if (candidateMap.get(index)?.delete(digit)) changed.push(index);
        }
        if (changed.length) {
          record({ kind: 'elimination', strategy: 'pair', indices: [...new Set(changed)], digits, related: anchors, explanation: `${unitName(unitIndex)}中的兩格都只剩 ${digits.join('、')}，所以其他格可排除這兩個數。` });
          progressed = true;
          break;
        }
      }
    }
    if (progressed) continue;

    const solution = solveGrid(grid);
    if (!solution) return { solved: false, invalid: true, grid, steps, hardest };
    const [index] = [...candidateMap.entries()].sort((left, right) => left[1].size - right[1].size || left[0] - right[0])[0];
    const digit = solution[index];
    place(index, digit, 'trial', `目前的四種基礎技巧不足以直接前進；進階分析試探 ${cellName(index)} 為 ${digit}，並檢查後續是否矛盾。`);
  }

  return { solved: isSolved(grid), invalid: false, grid, steps, hardest };
}

const RATING = {
  single: { key: 'easy', label: '入門', summary: '主要使用唯一候選數。' },
  hidden: { key: 'medium', label: '進階', summary: '需要找出隱藏在單位中的唯一位置。' },
  locked: { key: 'hard', label: '挑戰', summary: '需要宮與行列之間的區塊排除。' },
  pair: { key: 'hard', label: '挑戰', summary: '需要辨認顯性數對並排除候選數。' },
  trial: { key: 'expert', label: '專家', summary: '基礎技巧後仍需進階試探或更高階策略。' }
};

export function analyzePuzzle(source) {
  assertGrid(source);
  const validation = validateGrid(source);
  const clues = source.filter(Boolean).length;
  if (!validation.valid) return { valid: false, unique: false, solutionCount: 0, clues, conflicts: validation.conflicts, steps: [], rating: null };
  const solutionCount = countSolutions(source, 2);
  if (solutionCount !== 1) return { valid: solutionCount > 0, unique: false, solutionCount, clues, conflicts: [], steps: [], rating: null };
  const logical = logicalSolve(source);
  const rating = RATING[logical.hardest] || RATING.trial;
  const techniqueCounts = logical.steps.reduce((counts, step) => ({ ...counts, [step.strategy]: (counts[step.strategy] || 0) + 1 }), {});
  return { valid: true, unique: true, solutionCount, clues, solution: logical.grid, steps: logical.steps, rating, techniqueCounts };
}

export function nextHint(source) {
  const analysis = logicalSolve(source);
  const placementIndex = analysis.steps.findIndex((step) => step.kind === 'placement');
  if (placementIndex < 0) return null;
  const step = analysis.steps[placementIndex];
  const setup = analysis.steps.slice(0, placementIndex).filter((item) => item.kind === 'elimination');
  return { ...step, setup };
}
