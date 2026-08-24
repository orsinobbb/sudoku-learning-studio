import { candidatesFor, cellName } from '../core/sudoku.js?v=20260824-advanced1';

const CLUE_TARGET = 30;

const indexOf = (row, col) => (row - 1) * 9 + col - 1;
const cell = (row, col, digits) => ({ index: indexOf(row, col), digits });
const exactUnit = (kind, number, digit, names) => ({ kind, number, digit, names });

const TRANSFORMS = [
  { label: '聚焦候選圖 A', map: (row, col) => [row, col], shift: 0 },
  { label: '聚焦候選圖 B（轉置）', map: (row, col) => [col, row], shift: 3 },
  { label: '聚焦候選圖 C（旋轉）', map: (row, col) => [10 - row, 10 - col], shift: 5 }
];

const definitions = {
  skyscraper: {
    digit: 1, kind: 'elimination',
    cells: { a: cell(1, 6, [1, 4]), b: cell(5, 6, [1, 7]), c: cell(5, 9, [1, 8]), d: cell(3, 9, [1, 6]), target: cell(1, 7, [1, 2]) },
    related: ['a', 'b', 'c', 'd'], answers: [['target', 1]],
    exactUnits: [exactUnit('col', 6, 1, ['a', 'b']), exactUnit('col', 9, 1, ['c', 'd'])],
    prompt: (n) => `Skyscraper 已成立；指定哪一格可排除候選 ${n(1)}？`,
    explain: (p, n) => `${p('a')}–${p('b')} 與 ${p('c')}–${p('d')} 是候選 ${n(1)} 的兩條強連結，底部 ${p('b')}、${p('c')} 互見，所以兩個頂端至少一個為真；${p('target')} 同時看見兩端，排除 ${n(1)}。`
  },
  kite: {
    digit: 5, kind: 'elimination',
    cells: { a: cell(2, 7, [5, 8]), b: cell(9, 7, [2, 5]), c: cell(8, 5, [5, 6]), d: cell(8, 9, [4, 5]), target: cell(2, 5, [5, 7]) },
    related: ['a', 'b', 'c', 'd'], answers: [['target', 5]],
    exactUnits: [exactUnit('col', 7, 5, ['a', 'b']), exactUnit('row', 8, 5, ['c', 'd'])],
    prompt: (n) => `2-String Kite 已成立；指定哪一格可排除候選 ${n(5)}？`,
    explain: (p, n) => `${p('a')}–${p('b')} 是列強連結，${p('c')}–${p('d')} 是行強連結，${p('b')} 與 ${p('d')} 又在同一宮相接；因此 ${p('a')}、${p('c')} 至少一個為 ${n(5)}，${p('target')} 必須排除 ${n(5)}。`
  },
  emptyRectangle: {
    digit: 9, kind: 'elimination',
    cells: { er1: cell(4, 4, [3, 9]), er2: cell(4, 6, [4, 9]), er3: cell(5, 5, [5, 9]), er4: cell(6, 5, [2, 9]), a: cell(4, 2, [1, 9]), b: cell(9, 2, [5, 9]), target: cell(9, 5, [6, 9]) },
    related: ['er1', 'er2', 'er3', 'er4', 'a', 'b'], answers: [['target', 9]],
    exactUnits: [exactUnit('box', 5, 9, ['er1', 'er2', 'er3', 'er4']), exactUnit('col', 2, 9, ['a', 'b'])],
    prompt: (n) => `Empty Rectangle 已成立；指定哪一格可排除候選 ${n(9)}？`,
    explain: (p, n) => `中宮的 ${n(9)} 全落在交叉的行與列；${p('a')}–${p('b')} 又是列強連結。無論 ${p('a')} 是否為真，${p('target')} 都會被 ${p('b')} 或宮內列方向的 ${n(9)} 看見，因此排除 ${n(9)}。`
  },
  xyzWing: {
    digit: 3, kind: 'elimination',
    cells: { pivot: cell(2, 2, [1, 2, 3]), xz: cell(2, 5, [1, 3]), yz: cell(3, 3, [2, 3]), target: cell(2, 3, [3, 6]) },
    related: ['pivot', 'xz', 'yz'], answers: [['target', 3]],
    prompt: (n) => `XYZ-Wing 已成立；指定哪一格可排除共同候選 ${n(3)}？`,
    explain: (p, n) => `${p('pivot')} 是 XYZ 樞紐，${p('xz')}、${p('yz')} 是兩翼；三格中必有一格放入 ${n(3)}。${p('target')} 同時看見樞紐與兩翼，所以排除 ${n(3)}。`
  },
  wWing: {
    digit: 5, kind: 'elimination',
    cells: { left: cell(4, 4, [5, 9]), right: cell(8, 9, [5, 9]), linkA: cell(4, 7, [3, 9]), linkB: cell(8, 7, [3, 9]), target: cell(4, 9, [5, 7]) },
    related: ['left', 'right', 'linkA', 'linkB'], answers: [['target', 5]],
    exactUnits: [exactUnit('col', 7, 9, ['linkA', 'linkB'])],
    prompt: (n) => `W-Wing 已成立；指定哪一格可排除候選 ${n(5)}？`,
    explain: (p, n) => `${p('left')}、${p('right')} 是相同雙候選；${p('linkA')}–${p('linkB')} 對另一候選 ${n(9)} 形成強連結，因此兩翼至少一格為 ${n(5)}。${p('target')} 看見兩翼，排除 ${n(5)}。`
  },
  simpleColoring: {
    digit: 3, kind: 'elimination',
    cells: { a1: cell(1, 2, [3, 6]), b1: cell(1, 8, [3, 7]), a2: cell(4, 8, [3, 8]), b2: cell(4, 1, [2, 3]), target: cell(2, 1, [3, 4]) },
    related: ['a1', 'b1', 'a2', 'b2'], answers: [['target', 3]],
    exactUnits: [exactUnit('row', 1, 3, ['a1', 'b1']), exactUnit('col', 8, 3, ['b1', 'a2']), exactUnit('row', 4, 3, ['a2', 'b2'])],
    prompt: (n) => `簡單著色形成 Color Trap；指定哪一格可排除 ${n(3)}？`,
    explain: (p, n) => `沿 ${p('a1')}–${p('b1')}–${p('a2')}–${p('b2')} 的強連結交替著色。${p('target')} 同時看見相反顏色的 ${p('a1')} 與 ${p('b2')}，兩色必有一真，因此排除 ${n(3)}。`
  },
  xChain: {
    digit: 7, kind: 'elimination',
    cells: { a: cell(1, 4, [2, 7]), b: cell(1, 1, [3, 7]), c: cell(2, 2, [7, 8]), d: cell(2, 1, [4, 7]), e: cell(5, 1, [7, 9]), f: cell(5, 6, [6, 7]), target: cell(3, 6, [5, 7]) },
    related: ['a', 'b', 'c', 'd', 'e', 'f'], answers: [['target', 7]],
    exactUnits: [exactUnit('row', 1, 7, ['a', 'b']), exactUnit('row', 2, 7, ['c', 'd']), exactUnit('row', 5, 7, ['e', 'f'])],
    prompt: (n) => `X-Chain 首尾已鎖定；指定哪一格可排除 ${n(7)}？`,
    explain: (p, n) => `${p('a')} = ${p('b')} − ${p('c')} = ${p('d')} − ${p('e')} = ${p('f')} 是以 ${n(7)} 強、弱交替且首尾為強連結的鏈；兩端至少一真，${p('target')} 看見兩端，所以排除 ${n(7)}。`
  },
  xyChain: {
    digit: 3, kind: 'elimination',
    cells: { a: cell(7, 4, [3, 9]), b: cell(5, 4, [8, 9]), c: cell(5, 6, [2, 8]), d: cell(2, 6, [2, 3]), target: cell(2, 4, [3, 7]) },
    related: ['a', 'b', 'c', 'd'], answers: [['target', 3]],
    prompt: (n) => `XY-Chain 已接通；指定哪一格可排除鏈端共同候選 ${n(3)}？`,
    explain: (p, n) => `雙候選鏈為 ${n(3)}–${p('a')}–${n(9)}–${p('b')}–${n(8)}–${p('c')}–${n(2)}–${p('d')}–${n(3)}；兩端至少一格為 ${n(3)}，${p('target')} 看見兩端，排除 ${n(3)}。`
  },
  aic: {
    digit: 5, kind: 'elimination',
    cells: { a: cell(1, 2, [5, 8]), b: cell(1, 7, [4, 8]), c: cell(8, 7, [3, 8]), d: cell(8, 3, [3, 5]), e: cell(9, 1, [5, 9]), target: cell(1, 1, [2, 5]) },
    related: ['a', 'b', 'c', 'd', 'e'], answers: [['target', 5]],
    exactUnits: [exactUnit('col', 7, 8, ['b', 'c']), exactUnit('row', 8, 3, ['c', 'd']), exactUnit('box', 7, 5, ['d', 'e'])],
    prompt: (n) => `AIC 強弱連結已交替；指定哪一格可排除端點候選 ${n(5)}？`,
    explain: (p, n) => `鏈為 ${n(5)}=${n(8)}@${p('a')} − ${n(8)}@${p('b')} = ${n(8)}@${p('c')} − ${n(3)}@${p('c')} = ${n(3)}@${p('d')} − ${n(5)}@${p('d')} = ${n(5)}@${p('e')}。首尾 ${n(5)} 至少一真，${p('target')} 看見兩端，故排除。`
  },
  als: {
    digit: 3, kind: 'elimination',
    cells: { a1: cell(1, 1, [1, 2]), a2: cell(1, 2, [2, 3]), b1: cell(2, 3, [1, 3]), b2: cell(3, 3, [3, 4]), target: cell(2, 2, [3, 7]) },
    related: ['a1', 'a2', 'b1', 'b2'], answers: [['target', 3]],
    prompt: (n) => `ALS-XZ 已成立；指定哪一格可排除共同候選 Z=${n(3)}？`,
    explain: (p, n) => `ALS A=${p('a1')},${p('a2')} 與 ALS B=${p('b1')},${p('b2')} 以受限共同候選 X=${n(1)} 相連；另一共同候選 Z=${n(3)} 至少在一個 ALS 內成立。${p('target')} 看見所有 Z 落點，排除 ${n(3)}。`
  },
  sueDeCoq: {
    digit: 4, kind: 'elimination',
    cells: { i1: cell(7, 1, [3, 4]), i2: cell(7, 3, [5, 9]), row: cell(7, 7, [4, 5]), box: cell(8, 3, [3, 9]), target: cell(7, 5, [4, 8]) },
    related: ['i1', 'i2', 'row', 'box'], answers: [['target', 4]],
    prompt: (n) => `Sue de Coq 已把交界拆成兩個鎖定集合；指定哪一格可排除 ${n(4)}？`,
    explain: (p, n) => `交界 ${p('i1')},${p('i2')} 含四候選；行側 ${p('row')} 鎖定其中兩數，宮側 ${p('box')} 鎖定另兩數。${n(4)},${n(5)} 被鎖在該行的三格中，因此行上其他格 ${p('target')} 可排除 ${n(4)}。`
  },
  finnedFish: {
    digit: 6, kind: 'elimination',
    cells: { a: cell(2, 6, [6, 7]), b: cell(2, 8, [6, 9]), c: cell(7, 6, [1, 6]), d: cell(7, 8, [4, 6]), fin: cell(7, 7, [3, 6]), target: cell(8, 8, [2, 6]) },
    related: ['a', 'b', 'c', 'd', 'fin'], answers: [['target', 6]],
    exactUnits: [exactUnit('row', 2, 6, ['a', 'b']), exactUnit('row', 7, 6, ['c', 'd', 'fin'])],
    prompt: (n) => `Finned X-Wing 已成立；指定鰭所限制區域內可排除 ${n(6)} 的格子。`,
    explain: (p, n) => `若 ${p('fin')} 不成立，${p('a')},${p('b')},${p('c')},${p('d')} 形成 X-Wing；若鰭成立，又會直接看見 ${p('target')}。兩種情況都使 ${p('target')} 排除 ${n(6)}。`
  },
  uniqueRectangle: {
    digit: 1, kind: 'elimination',
    cells: { a: cell(1, 1, [1, 5]), b: cell(1, 5, [1, 5]), c: cell(2, 1, [1, 5]), target: cell(2, 5, [1, 5, 8]) },
    related: ['a', 'b', 'c', 'target'], answers: [['target', 1], ['target', 5]],
    prompt: (n) => `唯一矩形 Type 1：指定多候選角，排除任一矩形候選 ${n(1)} 或 ${n(5)}。`,
    explain: (p, n) => `四角若都只剩 ${n(1)}/${n(5)}，會形成可互換的雙解矩形。依唯一解前提，${p('target')} 的額外候選 ${n(8)} 必須成立，所以可排除 ${n(1)} 或 ${n(5)}。此推論依賴唯一解假設。`
  },
  bugPlusOne: {
    digit: 3, kind: 'placement',
    fixedBoard: '289746513436591278175328496857060002040287005020050807598674321364812759712935684',
    stateLabel: '末盤 BUG+1 · 13 個未解格',
    stateIntro: '這是只剩 13 格的末盤候選狀態；每個未解格都顯示目前完整候選。',
    cells: {
      a: cell(4, 4, [1, 4]), b: cell(4, 6, [3, 9]), c: cell(4, 7, [1, 9]), d: cell(4, 8, [3, 4]),
      e: cell(5, 1, [6, 9]), f: cell(5, 3, [1, 3]), g: cell(5, 7, [1, 9]), h: cell(5, 8, [3, 6]),
      i: cell(6, 1, [6, 9]), j: cell(6, 3, [1, 3]), k: cell(6, 4, [1, 4]), l: cell(6, 6, [3, 9]),
      target: cell(6, 8, [3, 4, 6])
    },
    related: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'], answers: [['target', 3]],
    prompt: () => 'BUG+1：其餘 12 格皆為雙候選；唯一三候選格應填入哪個數？',
    explain: (p, n) => `${p('target')} 是唯一三候選格；候選 ${n(3)} 在它所屬的行、列、宮都各出現三次，而 ${n(4)}、${n(6)} 仍各成對。為避免 BUG 雙解，必須在 ${p('target')} 填入多出的 ${n(3)}。此推論依賴唯一解假設。`
  },
  forcingChain: {
    digit: 7, kind: 'elimination',
    cells: { pivot: cell(1, 1, [1, 2]), a: cell(1, 5, [1, 7]), b: cell(5, 1, [2, 7]), target: cell(5, 5, [7, 9]) },
    related: ['pivot', 'a', 'b'], answers: [['target', 7]],
    prompt: (n) => `強制分支得到共同結論；指定哪一格可排除 ${n(7)}？`,
    explain: (p, n) => `若 ${p('pivot')}=${n(1)}，則 ${p('a')}=${n(7)}；若 ${p('pivot')}=${n(2)}，則 ${p('b')}=${n(7)}。兩個完整分支都讓 ${p('target')} 看見一個 ${n(7)}，所以它可排除 ${n(7)}。`
  },
  search: {
    digit: 6, kind: 'placement',
    fixedBoard: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
    cells: { pivot: cell(1, 4, [2, 6]) },
    related: ['pivot'], answers: [['pivot', 6]],
    prompt: (n) => `回溯驗證：完整探索 ${n(2)} 分支後出現矛盾，樞紐應填哪個數？`,
    explain: (p, n) => `${p('pivot')} 原有 ${n(2)}/${n(6)}。把 ${p('pivot')} 暫定為 ${n(2)} 後，完整推演該分支會無解；撤銷假設後只能填入 ${n(6)}。這是可由解題器驗證的搜尋分支，不列入邏輯技巧統計。`
  }
};

const SOLUTIONS = Object.freeze({
  skyscraper: '467891253189235674235674891746358912391427568528169347653712489812946735974583126',
  kite: '689235417134679528257148639368592741791463852425781963816924375972356184543817296',
  emptyRectangle: '348971625621485973957632841516324789789156234234897156873519462162743598495268317',
  xyzWing: '157689234426315789893247156241763895965824317378951462539172648612498573784536921',
  wWing: '873694251962815473541273896124568937689347512357129684215936748496781325738452169',
  simpleColoring: '132456879456789213789123546264597138371268954895314627613842795927635481548971362',
  xChain: '342789615785316429196425738537968142914257386268134957471592863623871594859643271',
  xyChain: '245163789139782456678495123853214967716938245492576318567321894981647532324859671',
  aic: '251378469634915278789462315312789546845136927976254183427893651163547892598621734',
  als: '125346789673589124894127356241763895759812463368954217436291578517638942982475631',
  sueDeCoq: '182743956453968712796512384534621897827395641961874235315286479249137568678459123',
  finnedFish: '751369482839247561642158793596872134178493256423615978217986345984531627365724819',
  uniqueRectangle: '134256789527489136689137245843972561251364897796518324362741958415893672978625413',
  bugPlusOne: '289746513436591278175328496857163942943287165621459837598674321364812759712935684',
  forcingChain: '123475689789316245456829137865243971234197856917568324372651498541982763698734512',
  search: '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
});

function arePeers(left, right) {
  const leftRow = Math.floor(left / 9);
  const rightRow = Math.floor(right / 9);
  const leftCol = left % 9;
  const rightCol = right % 9;
  return leftRow === rightRow
    || leftCol === rightCol
    || (Math.floor(leftRow / 3) === Math.floor(rightRow / 3) && Math.floor(leftCol / 3) === Math.floor(rightCol / 3));
}

function clueTieBreak(index, technique) {
  const seed = [...technique].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 1009, 7);
  return ((index + 1) * 37 + index * index * 13 + seed * 17) % 997;
}

function createBaseBoard(solution, definition, technique) {
  const allowed = [...solution];
  for (const focus of Object.values(definition.cells)) {
    allowed[focus.index] = 0;
    for (let index = 0; index < 81; index += 1) {
      if (focus.digits.includes(solution[index]) && arePeers(focus.index, index)) allowed[index] = 0;
    }
  }

  const board = Array(81).fill(0);
  const rowCounts = Array(9).fill(0);
  const colCounts = Array(9).fill(0);
  const boxCounts = Array(9).fill(0);
  while (board.filter(Boolean).length < CLUE_TARGET) {
    const available = allowed
      .map((digit, index) => ({ digit, index }))
      .filter(({ digit, index }) => digit && !board[index]);
    available.sort((left, right) => {
      const score = ({ index }) => {
        const row = Math.floor(index / 9);
        const col = index % 9;
        const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
        const underThree = Number(rowCounts[row] < 3) + Number(colCounts[col] < 3) + Number(boxCounts[box] < 3);
        return [-underThree, Math.max(rowCounts[row], colCounts[col], boxCounts[box]), rowCounts[row] + colCounts[col] + boxCounts[box]];
      };
      const leftScore = score(left);
      const rightScore = score(right);
      for (let index = 0; index < leftScore.length; index += 1) {
        if (leftScore[index] !== rightScore[index]) return leftScore[index] - rightScore[index];
      }
      return clueTieBreak(left.index, technique) - clueTieBreak(right.index, technique) || left.index - right.index;
    });
    const next = available[0];
    if (!next) throw new Error(`無法為 ${technique} 建立 ${CLUE_TARGET} 格技巧局面`);
    board[next.index] = next.digit;
    const row = Math.floor(next.index / 9);
    const col = next.index % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    rowCounts[row] += 1;
    colCounts[col] += 1;
    boxCounts[box] += 1;
  }
  return board;
}

function shifted(digit, amount) {
  return ((digit - 1 + amount) % 9) + 1;
}

function transformedIndex(source, transform) {
  const row = Math.floor(source / 9) + 1;
  const col = source % 9 + 1;
  const [nextRow, nextCol] = transform.map(row, col);
  return indexOf(nextRow, nextCol);
}

function sourceUnitIndexes(kind, number) {
  const offset = number - 1;
  if (kind === 'row') return Array.from({ length: 9 }, (_, col) => offset * 9 + col);
  if (kind === 'col') return Array.from({ length: 9 }, (_, row) => row * 9 + offset);
  const startRow = Math.floor(offset / 3) * 3;
  const startCol = (offset % 3) * 3;
  return Array.from({ length: 9 }, (_, position) => (startRow + Math.floor(position / 3)) * 9 + startCol + position % 3);
}

function buildCandidateState(board, solution, definition, positions, transform) {
  const candidates = board.map((value, index) => value ? [] : candidatesFor(board, index));
  const exactCells = [];
  Object.entries(definition.cells).forEach(([name, source]) => {
    const index = positions[name];
    const digits = source.digits.map((digit) => shifted(digit, transform.shift)).sort((a, b) => a - b);
    candidates[index] = digits;
    exactCells.push({ index, digits });
  });

  const exactUnits = (definition.exactUnits || []).map((rule) => {
    const indices = sourceUnitIndexes(rule.kind, rule.number).map((index) => transformedIndex(index, transform));
    const allowed = rule.names.map((name) => positions[name]).sort((a, b) => a - b);
    const digit = shifted(rule.digit, transform.shift);
    for (const index of indices) {
      if (!allowed.includes(index)) candidates[index] = candidates[index].filter((candidate) => candidate !== digit);
    }
    return { indices, allowed, digit };
  });

  const errors = [];
  candidates.forEach((digits, index) => {
    if (board[index]) return;
    const raw = candidatesFor(board, index);
    if (!digits.length) errors.push(`${cellName(index)} 沒有候選`);
    if (!digits.includes(solution[index])) errors.push(`${cellName(index)} 遺失正解 ${solution[index]}`);
    for (const digit of digits) if (!raw.includes(digit)) errors.push(`${cellName(index)} 的 ${digit} 不符合盤面`);
  });
  if (errors.length) throw new Error(`${definition.prompt((digit) => digit)}：${errors.join('；')}`);
  return { candidates, exactCells, exactUnits };
}

function createQuestion(technique, definition, transform, variant) {
  const baseSolution = [...SOLUTIONS[technique]].map(Number);
  const baseBoard = definition.fixedBoard
    ? [...definition.fixedBoard].map(Number)
    : createBaseBoard(baseSolution, definition, technique);
  const board = Array(81).fill(0);
  const solution = Array(81).fill(0);
  const positions = {};
  baseBoard.forEach((digit, index) => {
    if (digit) board[transformedIndex(index, transform)] = shifted(digit, transform.shift);
  });
  baseSolution.forEach((digit, index) => {
    solution[transformedIndex(index, transform)] = shifted(digit, transform.shift);
  });
  Object.entries(definition.cells).forEach(([name, source]) => {
    const index = transformedIndex(source.index, transform);
    positions[name] = index;
  });
  const state = buildCandidateState(board, solution, definition, positions, transform);
  const candidates = state.candidates;
  const answers = definition.answers.map(([name, digit]) => ({ index: positions[name], digit: shifted(digit, transform.shift) }));
  const place = (name) => cellName(positions[name]);
  const number = (digit) => shifted(digit, transform.shift);
  return Object.freeze({
    id: `${technique}-${variant + 1}-focus`, technique, variant: variant + 1,
    variantLabel: `${transform.label} · ${definition.stateLabel || `可驗證候選狀態 · ${board.filter(Boolean).length} 個盤面數字`}`, kind: definition.kind,
    board: Object.freeze(board), boardKey: `${technique}-${variant + 1}`,
    solution: Object.freeze(solution),
    candidates: Object.freeze(candidates.map((values) => Object.freeze(values))),
    prompt: definition.prompt(number),
    instruction: `${definition.stateIntro || '這是先前步驟完成後的中盤快照；每個未解格都顯示目前完整候選。'}${definition.kind === 'placement' ? '先點選指定目標格，再按下應填入的數字。' : '先點選可排除候選的指定格，再按下該候選數。'}`,
    answers: Object.freeze(answers.map(Object.freeze)),
    related: Object.freeze(definition.related.map((name) => positions[name])),
    proof: Object.freeze({
      candidateMode: 'complete-state',
      positions: Object.freeze({ ...positions }),
      exactCells: Object.freeze(state.exactCells.map((item) => Object.freeze({ index: item.index, digits: Object.freeze(item.digits) }))),
      exactUnits: Object.freeze(state.exactUnits.map((item) => Object.freeze({ indices: Object.freeze(item.indices), allowed: Object.freeze(item.allowed), digit: item.digit })))
    }),
    explanation: definition.explain(place, number),
    answerSummary: answers.length === 1
      ? `${cellName(answers[0].index)} · ${definition.kind === 'placement' ? '填入' : '排除'} ${answers[0].digit}`
      : `${cellName(answers[0].index)} · 排除 ${answers.map(({ digit }) => digit).join(' 或 ')}`
  });
}

export const MANUAL_ASSESSMENT_TECHNIQUES = Object.freeze(Object.keys(definitions));

function validateTechniqueGeometry(question, errors) {
  const p = question.proof.positions;
  const sees = (left, right) => arePeers(left, right);
  const require = (condition, message) => { if (!condition) errors.push(message); };
  const candidates = (name) => question.candidates[p[name]];
  const sameDigits = (left, right) => candidates(left).join(',') === candidates(right).join(',');
  const row = (name) => Math.floor(p[name] / 9);
  const col = (name) => p[name] % 9;
  const box = (name) => Math.floor(row(name) / 3) * 3 + Math.floor(col(name) / 3);

  if (question.technique === 'skyscraper') {
    require(sees(p.b, p.c) && sees(p.target, p.a) && sees(p.target, p.d), 'Skyscraper 端點可見關係不成立');
  } else if (question.technique === 'kite') {
    require(sees(p.b, p.d) && sees(p.target, p.a) && sees(p.target, p.c), '2-String Kite 近端或遠端可見關係不成立');
  } else if (question.technique === 'emptyRectangle') {
    const rectangle = question.proof.exactUnits.find(({ allowed }) => allowed.length === 4);
    const rows = new Map();
    const cols = new Map();
    for (const index of rectangle.allowed) {
      rows.set(Math.floor(index / 9), (rows.get(Math.floor(index / 9)) || 0) + 1);
      cols.set(index % 9, (cols.get(index % 9) || 0) + 1);
    }
    const armRow = [...rows].find(([, count]) => count === 2)?.[0];
    const armCol = [...cols].find(([, count]) => count === 2)?.[0];
    const intersection = armRow * 9 + armCol;
    require(rectangle.allowed.every((index) => Math.floor(index / 9) === armRow || index % 9 === armCol), 'Empty Rectangle 宮內候選未形成兩臂');
    require(!rectangle.allowed.includes(intersection) && !question.candidates[intersection].includes(rectangle.digit), 'Empty Rectangle 交點不可含目標候選');
    const aUsesRowArm = row('a') === armRow;
    const aUsesColArm = col('a') === armCol;
    const targetUsesRowArm = row('target') === armRow;
    const targetUsesColArm = col('target') === armCol;
    require(
      sees(p.target, p.b)
        && ((aUsesRowArm && targetUsesColArm) || (aUsesColArm && targetUsesRowArm)),
      'Empty Rectangle 外部強連結未接上兩臂'
    );
  } else if (question.technique === 'xyzWing') {
    const wingIntersection = candidates('xz').filter((digit) => candidates('yz').includes(digit));
    require(candidates('pivot').length === 3 && candidates('xz').length === 2 && candidates('yz').length === 2, 'XYZ-Wing 必須是一個三候選樞紐與兩個雙候選翼');
    require(['xz', 'yz'].every((name) => candidates(name).every((digit) => candidates('pivot').includes(digit))), 'XYZ-Wing 兩翼候選必須是樞紐候選的子集');
    require(wingIntersection.length === 1 && wingIntersection[0] === question.answers[0].digit, 'XYZ-Wing 兩翼共同候選與排除數不一致');
    require(sees(p.pivot, p.xz) && sees(p.pivot, p.yz) && [p.pivot, p.xz, p.yz].every((index) => sees(p.target, index)), 'XYZ-Wing 樞紐、兩翼或目標可見關係不成立');
  } else if (question.technique === 'wWing') {
    const connector = candidates('left').find((digit) => digit !== question.answers[0].digit);
    require(candidates('left').length === 2 && sameDigits('left', 'right'), 'W-Wing 兩翼必須是相同雙候選格');
    require(candidates('linkA').includes(connector) && candidates('linkB').includes(connector), 'W-Wing 強連結沒有承接另一翼候選');
    require(sameDigits('left', 'right') && sees(p.left, p.linkA) && sees(p.right, p.linkB) && sees(p.target, p.left) && sees(p.target, p.right), 'W-Wing 雙候選翼或強連結幾何不成立');
  } else if (question.technique === 'simpleColoring') {
    require(['a1', 'b1', 'a2', 'b2', 'target'].every((name) => candidates(name).includes(question.answers[0].digit)), '簡單著色鏈遺失目標候選');
    require(sees(p.a1, p.b1) && sees(p.b1, p.a2) && sees(p.a2, p.b2) && sees(p.target, p.a1) && sees(p.target, p.b2), '簡單著色鏈或 Color Trap 不成立');
  } else if (question.technique === 'xChain') {
    require(['a', 'b', 'c', 'd', 'e', 'f', 'target'].every((name) => candidates(name).includes(question.answers[0].digit)), 'X-Chain 節點遺失鏈候選');
    require(sees(p.a, p.b) && sees(p.b, p.c) && sees(p.c, p.d) && sees(p.d, p.e) && sees(p.e, p.f) && sees(p.target, p.a) && sees(p.target, p.f), 'X-Chain 連結或端點可見關係不成立');
  } else if (question.technique === 'xyChain') {
    const chain = ['a', 'b', 'c', 'd'];
    require(chain.every((name) => candidates(name).length === 2), 'XY-Chain 鏈格必須皆為雙候選');
    require(chain.slice(1).every((name, index) => sees(p[chain[index]], p[name]) && candidates(chain[index]).filter((digit) => candidates(name).includes(digit)).length === 1), 'XY-Chain 相鄰格未正確承接單一候選');
    require(candidates('a').includes(question.answers[0].digit) && candidates('d').includes(question.answers[0].digit), 'XY-Chain 兩端共同候選與排除數不一致');
    require(sees(p.target, p.a) && sees(p.target, p.d), 'XY-Chain 目標未同時看見兩端');
  } else if (question.technique === 'aic') {
    const chain = ['a', 'b', 'c', 'd', 'e'];
    require(chain.every((name) => candidates(name).length === 2), 'AIC 範例鏈格必須皆為雙候選');
    require(chain.slice(1).every((name, index) => candidates(chain[index]).filter((digit) => candidates(name).includes(digit)).length === 1), 'AIC 相鄰節點未承接單一候選');
    require(candidates('a').includes(question.answers[0].digit) && candidates('e').includes(question.answers[0].digit), 'AIC 兩端候選與排除數不一致');
    require(sees(p.a, p.b) && sees(p.b, p.c) && sees(p.c, p.d) && sees(p.d, p.e) && sees(p.target, p.a) && sees(p.target, p.e), 'AIC 鏈結或端點可見關係不成立');
  } else if (question.technique === 'als') {
    const groupA = ['a1', 'a2'];
    const groupB = ['b1', 'b2'];
    const union = (names) => [...new Set(names.flatMap(candidates))];
    const unionA = union(groupA);
    const unionB = union(groupB);
    const shared = unionA.filter((digit) => unionB.includes(digit));
    const z = question.answers[0].digit;
    const x = shared.find((digit) => digit !== z);
    require(unionA.length === groupA.length + 1 && unionB.length === groupB.length + 1, 'ALS 每組 n 格必須恰含 n+1 個候選');
    require(shared.length === 2 && shared.includes(z), 'ALS-XZ 必須有受限共同候選 X 與共同候選 Z');
    const xInA = groupA.filter((name) => candidates(name).includes(x));
    const xInB = groupB.filter((name) => candidates(name).includes(x));
    require(xInA.length === 1 && xInB.length === 1 && sees(p[xInA[0]], p[xInB[0]]), 'ALS-XZ 的 X 不是受限共同候選');
    require(sees(p.a1, p.a2) && sees(p.b1, p.b2) && sees(p.a1, p.b1), 'ALS 集合或受限共同候選關係不成立');
    require([...groupA, ...groupB].filter((name) => candidates(name).includes(z)).every((name) => sees(p.target, p[name])), 'ALS-XZ 目標未看見所有 Z 落點');
  } else if (question.technique === 'sueDeCoq') {
    const intersectionUsesRow = row('i1') === row('i2');
    const intersectionUsesCol = col('i1') === col('i2');
    const onIntersectionLine = (name) => intersectionUsesRow ? row(name) === row('i1') : col(name) === col('i1');
    const intersectionDigits = [...new Set([...candidates('i1'), ...candidates('i2')])];
    const lineDigits = candidates('row');
    const boxDigits = candidates('box');
    require(intersectionDigits.length === 4 && lineDigits.length === 2 && boxDigits.length === 2, 'Sue de Coq 交界與兩側候選數量不成立');
    require(lineDigits.every((digit) => !boxDigits.includes(digit)) && [...lineDigits, ...boxDigits].every((digit) => intersectionDigits.includes(digit)), 'Sue de Coq 兩側集合未完整且互斥地拆分交界候選');
    require(lineDigits.includes(question.answers[0].digit) && candidates('target').includes(question.answers[0].digit), 'Sue de Coq 行列側集合與排除數不一致');
    require((intersectionUsesRow || intersectionUsesCol) && box('i1') === box('i2'), 'Sue de Coq 交界格不在同一行列與宮的交界');
    require(onIntersectionLine('row') && box('row') !== box('i1') && box('box') === box('i1') && !onIntersectionLine('box'), 'Sue de Coq 行列側或宮側集合位置不成立');
    require(onIntersectionLine('target') && box('target') !== box('i1'), 'Sue de Coq 排除格位置不成立');
  } else if (question.technique === 'finnedFish') {
    const baseUsesRows = row('a') === row('b');
    const baseUsesCols = col('a') === col('b');
    const sameBase = (left, right) => baseUsesRows ? row(left) === row(right) : col(left) === col(right);
    const sameCover = (left, right) => baseUsesRows ? col(left) === col(right) : row(left) === row(right);
    require((baseUsesRows || baseUsesCols) && sameBase('c', 'd') && sameBase('d', 'fin'), 'Finned X-Wing 基底行列不成立');
    require(['a', 'b', 'c', 'd', 'fin', 'target'].every((name) => candidates(name).includes(question.answers[0].digit)), 'Finned X-Wing 節點遺失魚候選');
    require(sameCover('a', 'c') && sameCover('b', 'd') && box('fin') === box('target') && sameCover('target', 'b'), 'Finned X-Wing 覆蓋行列、鰭宮或排除格不成立');
  } else if (question.technique === 'uniqueRectangle') {
    const corners = ['a', 'b', 'c', 'target'];
    const rectanglePair = candidates('a');
    require(new Set(corners.map(row)).size === 2 && new Set(corners.map(col)).size === 2 && new Set(corners.map(box)).size === 2, '唯一矩形必須跨兩行、兩列及兩宮');
    require(rectanglePair.length === 2 && sameDigits('a', 'b') && sameDigits('a', 'c') && candidates('target').length === 3 && rectanglePair.every((digit) => candidates('target').includes(digit)), '唯一矩形 Type 1 候選配置不成立');
    require(question.answers.every(({ digit }) => rectanglePair.includes(digit)), '唯一矩形排除答案不是矩形候選');
  } else if (question.technique === 'bugPlusOne') {
    const blanks = question.board.map((value, index) => value ? -1 : index).filter((index) => index >= 0);
    require(blanks.filter((index) => question.candidates[index].length === 2).length === blanks.length - 1, 'BUG+1 其他未解格必須全為雙候選');
    require(question.candidates[p.target].length === 3, 'BUG+1 必須只有一個三候選格');
  } else if (question.technique === 'forcingChain') {
    const pivotDigits = candidates('pivot');
    const branchA = pivotDigits.filter((digit) => candidates('a').includes(digit));
    const branchB = pivotDigits.filter((digit) => candidates('b').includes(digit));
    require(pivotDigits.length === 2 && candidates('a').length === 2 && candidates('b').length === 2, '強制鏈樞紐與分支格必須為雙候選');
    require(branchA.length === 1 && branchB.length === 1 && branchA[0] !== branchB[0], '強制鏈兩分支沒有分別承接樞紐兩個候選');
    require(candidates('a').includes(question.answers[0].digit) && candidates('b').includes(question.answers[0].digit) && candidates('target').includes(question.answers[0].digit), '強制鏈共同結論與排除數不一致');
    require(sees(p.pivot, p.a) && sees(p.pivot, p.b) && sees(p.target, p.a) && sees(p.target, p.b), '強制鏈分支或共同結論可見關係不成立');
  }
}

export function validateManualTechniqueQuestion(question) {
  const errors = [];
  question.board.forEach((value, index) => {
    const digits = question.candidates[index];
    if (value && digits.length) errors.push(`${cellName(index)} 已填數字卻仍有候選`);
    if (!value && !digits.length) errors.push(`${cellName(index)} 沒有顯示候選`);
    if (!value && !digits.includes(question.solution[index])) errors.push(`${cellName(index)} 候選不含正解`);
    for (const digit of digits) {
      if (!candidatesFor(question.board, index).includes(digit)) errors.push(`${cellName(index)} 的候選 ${digit} 與盤面衝突`);
    }
  });
  for (const check of question.proof.exactCells) {
    if (question.candidates[check.index].join(',') !== check.digits.join(',')) errors.push(`${cellName(check.index)} 候選集合不符`);
  }
  for (const check of question.proof.exactUnits) {
    const actual = check.indices.filter((index) => question.candidates[index].includes(check.digit)).sort((a, b) => a - b);
    if (actual.join(',') !== check.allowed.join(',')) errors.push(`候選 ${check.digit} 的強連結或限制單位不成立`);
  }
  for (const answer of question.answers) {
    const matchesSolution = question.solution[answer.index] === answer.digit;
    if ((question.kind === 'placement') !== matchesSolution) errors.push(`${cellName(answer.index)} 的答案與完成盤不一致`);
  }
  validateTechniqueGeometry(question, errors);
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function countCandidateStateSolutions(question, assumption = null, limit = 2) {
  const grid = [...question.board];
  if (assumption) {
    const { index, digit } = assumption;
    if (grid[index] || !question.candidates[index].includes(digit)) return 0;
    grid[index] = digit;
  }
  let count = 0;
  const allowed = (index, digit) => {
    const row = Math.floor(index / 9);
    const col = index % 9;
    for (let offset = 0; offset < 9; offset += 1) {
      if (grid[row * 9 + offset] === digit || grid[offset * 9 + col] === digit) return false;
    }
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let r = startRow; r < startRow + 3; r += 1) {
      for (let c = startCol; c < startCol + 3; c += 1) if (grid[r * 9 + c] === digit) return false;
    }
    return true;
  };
  const visit = () => {
    if (count >= limit) return;
    let next = -1;
    let options = null;
    for (let index = 0; index < 81; index += 1) {
      if (grid[index]) continue;
      const available = question.candidates[index].filter((digit) => allowed(index, digit));
      if (!available.length) return;
      if (!options || available.length < options.length) {
        next = index;
        options = available;
        if (options.length === 1) break;
      }
    }
    if (next < 0) {
      count += 1;
      return;
    }
    for (const digit of options) {
      grid[next] = digit;
      visit();
      grid[next] = 0;
      if (count >= limit) return;
    }
  };
  visit();
  return count;
}

export function getManualTechniqueQuestions(technique, count = 3) {
  const definition = definitions[technique];
  if (!definition) return [];
  return Object.freeze(TRANSFORMS.slice(0, count).map((transform, variant) => createQuestion(technique, definition, transform, variant)));
}
