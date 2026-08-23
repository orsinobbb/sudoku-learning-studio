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

export function getCompletedDigits(grid, solution = null) {
  assertGrid(grid);
  if (solution) assertGrid(solution);
  return Array.from({ length: 9 }, (_, index) => index + 1).filter((digit) => {
    const positions = grid.map((value, index) => value === digit ? index : -1).filter((index) => index >= 0);
    return positions.length === 9 && (!solution || positions.every((index) => solution[index] === digit));
  });
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

function combinations(values, size, start = 0, chosen = [], output = []) {
  if (chosen.length === size) {
    output.push([...chosen]);
    return output;
  }
  for (let index = start; index <= values.length - (size - chosen.length); index += 1) {
    chosen.push(values[index]);
    combinations(values, size, index + 1, chosen, output);
    chosen.pop();
  }
  return output;
}

const SUBSET_NAMES = {
  2: { naked: 'nakedPair', hidden: 'hiddenPair', label: '數對' },
  3: { naked: 'nakedTriple', hidden: 'hiddenTriple', label: '三數組' },
  4: { naked: 'nakedQuad', hidden: 'hiddenQuad', label: '四數組' }
};

const FISH_NAMES = { 2: 'xWing', 3: 'swordfish', 4: 'jellyfish' };

export function logicalSolve(source) {
  assertGrid(source);
  const initialValidation = validateGrid(source);
  if (!initialValidation.valid) return { solved: false, invalid: true, grid: [...source], steps: [], hardest: 'invalid' };
  const grid = [...source];
  const candidateMap = createCandidateMap(grid);
  const steps = [];
  let hardest = 'fullHouse';
  const ranks = {
    fullHouse: 1, nakedSingle: 1, hiddenSingle: 2,
    lockedPointing: 3, lockedClaiming: 3,
    nakedPair: 4, hiddenPair: 4,
    nakedTriple: 5, hiddenTriple: 5, nakedQuad: 5, hiddenQuad: 5,
    xWing: 6, xyWing: 7, swordfish: 7, jellyfish: 8, search: 9
  };

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

  function eliminateMany(indices, digits, strategy, explanation, related = []) {
    const changed = [];
    for (const index of indices) {
      const values = candidateMap.get(index);
      if (!values) continue;
      for (const digit of digits) if (values.delete(digit)) changed.push(index);
    }
    if (changed.length) record({ kind: 'elimination', strategy, indices: [...new Set(changed)], digits, related, explanation });
    return changed.length > 0;
  }

  function findNakedSubset(size) {
    for (let unitIndex = 0; unitIndex < UNITS.length; unitIndex += 1) {
      const eligible = UNITS[unitIndex].filter((index) => {
        const count = candidateMap.get(index)?.size || 0;
        return count >= 2 && count <= size;
      });
      for (const anchors of combinations(eligible, size)) {
        const digits = [...new Set(anchors.flatMap((index) => [...candidateMap.get(index)]))].sort();
        if (digits.length !== size) continue;
        const targets = UNITS[unitIndex].filter((index) => !anchors.includes(index));
        const name = SUBSET_NAMES[size];
        if (eliminateMany(targets, digits, name.naked, `${unitName(unitIndex)}中的 ${size} 格只包含 ${digits.join('、')}，形成顯性${name.label}；其他格可排除這些數。`, anchors)) return true;
      }
    }
    return false;
  }

  function findHiddenSubset(size) {
    for (let unitIndex = 0; unitIndex < UNITS.length; unitIndex += 1) {
      const unit = UNITS[unitIndex];
      const availableDigits = Array.from({ length: 9 }, (_, index) => index + 1).filter((digit) => unit.some((cell) => candidateMap.get(cell)?.has(digit)));
      for (const digits of combinations(availableDigits, size)) {
        const anchors = unit.filter((cell) => digits.some((digit) => candidateMap.get(cell)?.has(digit)));
        if (anchors.length !== size || digits.some((digit) => !anchors.some((cell) => candidateMap.get(cell)?.has(digit)))) continue;
        const removals = [];
        for (const cell of anchors) {
          for (const digit of candidateMap.get(cell)) if (!digits.includes(digit)) removals.push({ cell, digit });
        }
        if (!removals.length) continue;
        for (const { cell, digit } of removals) candidateMap.get(cell).delete(digit);
        const name = SUBSET_NAMES[size];
        record({ kind: 'elimination', strategy: name.hidden, indices: [...new Set(removals.map(({ cell }) => cell))], digits, related: anchors, explanation: `${unitName(unitIndex)}中，${digits.join('、')} 只出現在這 ${size} 格，形成隱性${name.label}；這些格可移除其他候選數。` });
        return true;
      }
    }
    return false;
  }

  function findFish(size) {
    const orientations = [
      { bases: ROWS, covers: COLS, baseLabel: '橫列', coverLabel: '直行' },
      { bases: COLS, covers: ROWS, baseLabel: '直行', coverLabel: '橫列' }
    ];
    for (let digit = 1; digit <= 9; digit += 1) {
      for (const orientation of orientations) {
        const baseCandidates = orientation.bases.map((unit, index) => ({ index, positions: unit.filter((cell) => candidateMap.get(cell)?.has(digit)) }))
          .filter(({ positions }) => positions.length >= 2 && positions.length <= size);
        for (const selected of combinations(baseCandidates, size)) {
          const coverIndexes = [...new Set(selected.flatMap(({ positions }) => positions.map((cell) => orientation.bases === ROWS ? cell % 9 : Math.floor(cell / 9))))];
          if (coverIndexes.length !== size) continue;
          const baseIndexes = selected.map(({ index }) => index);
          const targets = coverIndexes.flatMap((cover) => orientation.covers[cover]).filter((cell) => {
            const base = orientation.bases === ROWS ? Math.floor(cell / 9) : cell % 9;
            return !baseIndexes.includes(base);
          });
          const related = selected.flatMap(({ positions }) => positions);
          const label = size === 2 ? 'X-Wing' : size === 3 ? 'Swordfish' : 'Jellyfish';
          if (eliminate(targets, digit, FISH_NAMES[size], `${label}：${digit} 在 ${size} 個${orientation.baseLabel}只落於相同的 ${size} 個${orientation.coverLabel}，因此可從其餘位置排除。`, related)) return true;
        }
      }
    }
    return false;
  }

  function findXYWing() {
    const bivalue = [...candidateMap.entries()].filter(([, values]) => values.size === 2);
    for (const [pivot, pivotValues] of bivalue) {
      const pivotDigits = [...pivotValues];
      const wings = bivalue.filter(([cell]) => PEERS[pivot].has(cell));
      for (const [[left, leftValues], [right, rightValues]] of combinations(wings, 2)) {
        const leftShared = pivotDigits.filter((digit) => leftValues.has(digit));
        const rightShared = pivotDigits.filter((digit) => rightValues.has(digit));
        if (leftShared.length !== 1 || rightShared.length !== 1 || leftShared[0] === rightShared[0]) continue;
        const leftOuter = [...leftValues].filter((digit) => !pivotValues.has(digit));
        const rightOuter = [...rightValues].filter((digit) => !pivotValues.has(digit));
        if (leftOuter.length !== 1 || rightOuter.length !== 1 || leftOuter[0] !== rightOuter[0]) continue;
        const digit = leftOuter[0];
        const targets = [...PEERS[left]].filter((cell) => PEERS[right].has(cell) && cell !== pivot && candidateMap.get(cell)?.has(digit));
        if (eliminate(targets, digit, 'xyWing', `XY-Wing：樞紐 ${cellName(pivot)} 與兩翼形成三組雙候選，不論樞紐取哪個值，兩翼共同可見格都不能是 ${digit}。`, [pivot, left, right])) return true;
      }
    }
    return false;
  }

  for (let guard = 0; guard < 500 && candidateMap.size; guard += 1) {
    const impossible = [...candidateMap.entries()].find(([, values]) => values.size === 0);
    if (impossible) return { solved: false, invalid: true, grid, steps, hardest };

    let progressed = false;
    for (let unitIndex = 0; unitIndex < UNITS.length; unitIndex += 1) {
      const empties = UNITS[unitIndex].filter((index) => candidateMap.has(index));
      if (empties.length !== 1) continue;
      const index = empties[0];
      const digit = [...candidateMap.get(index)][0];
      place(index, digit, 'fullHouse', `${unitName(unitIndex)}只剩 ${cellName(index)} 未填，缺少的數字是 ${digit}。`, UNITS[unitIndex]);
      progressed = true;
      break;
    }
    if (progressed) continue;

    const naked = [...candidateMap.entries()].find(([, values]) => values.size === 1);
    if (naked) {
      const [index, values] = naked;
      const digit = [...values][0];
      place(index, digit, 'nakedSingle', `${cellName(index)} 的其他數字都已被同行、同列或同宮排除，所以只能填 ${digit}。`);
      continue;
    }

    for (let unitIndex = 0; unitIndex < UNITS.length && !progressed; unitIndex += 1) {
      const unit = UNITS[unitIndex];
      for (let digit = 1; digit <= 9; digit += 1) {
        if (unit.some((index) => grid[index] === digit)) continue;
        const possible = unit.filter((index) => candidateMap.get(index)?.has(digit));
        if (possible.length === 1) {
          place(possible[0], digit, 'hiddenSingle', `${unitName(unitIndex)}裡，只有 ${cellName(possible[0])} 還能放 ${digit}。`, unit);
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
          progressed = eliminate(targets, digit, 'lockedPointing', `指向型區塊排除：第 ${boxIndex + 1} 宮中的 ${digit} 都落在第 ${row + 1} 橫列，因此可從同列其他宮排除 ${digit}。`, anchors);
        } else if (cols.size === 1) {
          const col = [...cols][0];
          const targets = COLS[col].filter((index) => !box.includes(index));
          progressed = eliminate(targets, digit, 'lockedPointing', `指向型區塊排除：第 ${boxIndex + 1} 宮中的 ${digit} 都落在第 ${col + 1} 直行，因此可從同行其他宮排除 ${digit}。`, anchors);
        }
        if (progressed) break;
      }
    }
    if (progressed) continue;

    for (const lines of [ROWS, COLS]) {
      for (let lineIndex = 0; lineIndex < lines.length && !progressed; lineIndex += 1) {
        for (let digit = 1; digit <= 9; digit += 1) {
          const anchors = lines[lineIndex].filter((index) => candidateMap.get(index)?.has(digit));
          if (anchors.length < 2) continue;
          const boxes = new Set(anchors.map((index) => Math.floor(index / 27) * 3 + Math.floor((index % 9) / 3)));
          if (boxes.size !== 1) continue;
          const boxIndex = [...boxes][0];
          const targets = BOXES[boxIndex].filter((index) => !anchors.includes(index));
          const lineLabel = lines === ROWS ? `第 ${lineIndex + 1} 橫列` : `第 ${lineIndex + 1} 直行`;
          progressed = eliminate(targets, digit, 'lockedClaiming', `宣告型區塊排除：${lineLabel}中的 ${digit} 都落在第 ${boxIndex + 1} 宮，因此可從該宮其他格排除 ${digit}。`, anchors);
          if (progressed) break;
        }
      }
      if (progressed) break;
    }
    if (progressed) continue;

    for (const size of [2, 3, 4]) {
      if (findNakedSubset(size) || findHiddenSubset(size)) {
        progressed = true;
        break;
      }
    }
    if (progressed) continue;

    if (findFish(2)) continue;
    if (findXYWing()) continue;
    if (findFish(3)) continue;
    if (findFish(4)) continue;

    const solution = solveGrid(grid);
    if (!solution) return { solved: false, invalid: true, grid, steps, hardest };
    const [index] = [...candidateMap.entries()].sort((left, right) => left[1].size - right[1].size || left[0] - right[0])[0];
    const digit = solution[index];
    place(index, digit, 'search', `目前已實作的邏輯技巧不足以直接前進；搜尋驗證 ${cellName(index)} 為 ${digit}，並檢查後續是否矛盾。這不是教材中的邏輯技巧。`);
  }

  return { solved: isSolved(grid), invalid: false, grid, steps, hardest };
}

const RATING = {
  fullHouse: { key: 'easy', label: '入門', summary: '以末格與唯一候選完成。' },
  nakedSingle: { key: 'easy', label: '入門', summary: '主要使用格子的唯一候選。' },
  hiddenSingle: { key: 'medium', label: '進階', summary: '需要找出單位中數字的唯一位置。' },
  lockedPointing: { key: 'hard', label: '挑戰', summary: '需要宮與行列間的指向型區塊排除。' },
  lockedClaiming: { key: 'hard', label: '挑戰', summary: '需要行列與宮間的宣告型區塊排除。' },
  nakedPair: { key: 'hard', label: '挑戰', summary: '需要辨認顯性數對並排除候選數。' },
  hiddenPair: { key: 'hard', label: '挑戰', summary: '需要辨認隱性數對並精簡候選數。' },
  nakedTriple: { key: 'hard', label: '挑戰', summary: '需要使用三數組或四數組。' },
  hiddenTriple: { key: 'hard', label: '挑戰', summary: '需要使用三數組或四數組。' },
  nakedQuad: { key: 'hard', label: '挑戰', summary: '需要使用三數組或四數組。' },
  hiddenQuad: { key: 'hard', label: '挑戰', summary: '需要使用三數組或四數組。' },
  xWing: { key: 'expert', label: '專家', summary: '需要跨行列辨認 X-Wing 魚形。' },
  xyWing: { key: 'expert', label: '專家', summary: '需要辨認雙候選樞紐與兩翼。' },
  swordfish: { key: 'expert', label: '專家', summary: '需要跨三個單位辨認 Swordfish。' },
  jellyfish: { key: 'expert', label: '專家', summary: '需要跨四個單位辨認 Jellyfish。' },
  search: { key: 'expert', label: '專家+', summary: '目前的邏輯分析器仍需搜尋驗證；可再使用鏈或 ALS 等高階技巧分析。' }
};

export function analyzePuzzle(source) {
  assertGrid(source);
  const validation = validateGrid(source);
  const clues = source.filter(Boolean).length;
  if (!validation.valid) return { valid: false, unique: false, solutionCount: 0, clues, conflicts: validation.conflicts, steps: [], rating: null };
  const solutionCount = countSolutions(source, 2);
  if (solutionCount !== 1) return { valid: solutionCount > 0, unique: false, solutionCount, clues, conflicts: [], steps: [], rating: null };
  const logical = logicalSolve(source);
  const rating = RATING[logical.hardest] || RATING.search;
  const techniqueCounts = logical.steps.reduce((counts, step) => ({ ...counts, [step.strategy]: (counts[step.strategy] || 0) + 1 }), {});
  return { valid: true, unique: true, solutionCount, clues, solution: logical.grid, steps: logical.steps, rating, techniqueCounts, logicalOnly: !techniqueCounts.search };
}

export function nextHint(source) {
  const analysis = logicalSolve(source);
  const placementIndex = analysis.steps.findIndex((step) => step.kind === 'placement');
  if (placementIndex < 0) return null;
  const step = analysis.steps[placementIndex];
  const setup = analysis.steps.slice(0, placementIndex).filter((item) => item.kind === 'elimination');
  return { ...step, setup };
}
