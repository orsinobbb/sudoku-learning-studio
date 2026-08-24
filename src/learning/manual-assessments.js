import { cellName } from '../core/sudoku.js?v=20260824-learning3';

const indexOf = (row, col) => (row - 1) * 9 + col - 1;
const cell = (row, col, digits) => ({ index: indexOf(row, col), digits });

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
    prompt: (n) => `Skyscraper 已成立；指定哪一格可排除候選 ${n(1)}？`,
    explain: (p, n) => `${p('a')}–${p('b')} 與 ${p('c')}–${p('d')} 是候選 ${n(1)} 的兩條強連結，底部 ${p('b')}、${p('c')} 互見，所以兩個頂端至少一個為真；${p('target')} 同時看見兩端，排除 ${n(1)}。`
  },
  kite: {
    digit: 5, kind: 'elimination',
    cells: { a: cell(2, 7, [5, 8]), b: cell(9, 7, [2, 5]), c: cell(8, 4, [3, 5]), d: cell(8, 9, [4, 5]), target: cell(2, 4, [5, 6]) },
    related: ['a', 'b', 'c', 'd'], answers: [['target', 5]],
    prompt: (n) => `2-String Kite 已成立；指定哪一格可排除候選 ${n(5)}？`,
    explain: (p, n) => `${p('a')}–${p('b')} 是列強連結，${p('c')}–${p('d')} 是行強連結，${p('b')} 與 ${p('d')} 又在同一宮相接；因此 ${p('a')}、${p('c')} 至少一個為 ${n(5)}，${p('target')} 必須排除 ${n(5)}。`
  },
  emptyRectangle: {
    digit: 9, kind: 'elimination',
    cells: { er1: cell(4, 5, [2, 9]), er2: cell(4, 6, [4, 9]), er3: cell(6, 6, [7, 9]), a: cell(4, 2, [1, 9]), b: cell(8, 2, [6, 9]), target: cell(8, 6, [3, 9]) },
    related: ['er1', 'er2', 'er3', 'a', 'b'], answers: [['target', 9]],
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
    cells: { left: cell(4, 4, [5, 9]), right: cell(8, 9, [5, 9]), linkA: cell(4, 8, [3, 9]), linkB: cell(8, 8, [2, 9]), target: cell(4, 9, [5, 7]) },
    related: ['left', 'right', 'linkA', 'linkB'], answers: [['target', 5]],
    prompt: (n) => `W-Wing 已成立；指定哪一格可排除候選 ${n(5)}？`,
    explain: (p, n) => `${p('left')}、${p('right')} 是相同雙候選；${p('linkA')}–${p('linkB')} 對另一候選 ${n(9)} 形成強連結，因此兩翼至少一格為 ${n(5)}。${p('target')} 看見兩翼，排除 ${n(5)}。`
  },
  simpleColoring: {
    digit: 3, kind: 'elimination',
    cells: { a1: cell(1, 2, [3, 6]), b1: cell(1, 8, [3, 7]), a2: cell(5, 8, [3, 5]), b2: cell(5, 1, [3, 9]), target: cell(2, 1, [3, 4]) },
    related: ['a1', 'b1', 'a2', 'b2'], answers: [['target', 3]],
    prompt: (n) => `簡單著色形成 Color Trap；指定哪一格可排除 ${n(3)}？`,
    explain: (p, n) => `沿 ${p('a1')}–${p('b1')}–${p('a2')}–${p('b2')} 的強連結交替著色。${p('target')} 同時看見相反顏色的 ${p('a1')} 與 ${p('b2')}，兩色必有一真，因此排除 ${n(3)}。`
  },
  xChain: {
    digit: 7, kind: 'elimination',
    cells: { a: cell(1, 2, [4, 7]), b: cell(1, 9, [5, 7]), c: cell(2, 8, [2, 7]), d: cell(7, 8, [6, 7]), e: cell(7, 3, [1, 7]), f: cell(4, 3, [7, 8]), target: cell(4, 2, [3, 7]) },
    related: ['a', 'b', 'c', 'd', 'e', 'f'], answers: [['target', 7]],
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
    cells: { a: cell(1, 2, [5, 8]), b: cell(1, 7, [4, 8]), c: cell(8, 7, [3, 8]), d: cell(8, 3, [3, 5]), e: cell(3, 3, [5, 9]), target: cell(2, 1, [5, 6]) },
    related: ['a', 'b', 'c', 'd', 'e'], answers: [['target', 5]],
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
    cells: { a: cell(2, 2, [3, 6]), b: cell(2, 8, [6, 9]), c: cell(7, 2, [1, 6]), d: cell(7, 8, [4, 6]), fin: cell(7, 9, [5, 6]), target: cell(8, 8, [2, 6]) },
    related: ['a', 'b', 'c', 'd', 'fin'], answers: [['target', 6]],
    prompt: (n) => `Finned X-Wing 已成立；指定鰭所限制區域內可排除 ${n(6)} 的格子。`,
    explain: (p, n) => `若 ${p('fin')} 不成立，${p('a')},${p('b')},${p('c')},${p('d')} 形成 X-Wing；若鰭成立，又會直接看見 ${p('target')}。兩種情況都使 ${p('target')} 排除 ${n(6)}。`
  },
  uniqueRectangle: {
    digit: 1, kind: 'elimination',
    cells: { a: cell(1, 1, [1, 2]), b: cell(1, 4, [1, 2]), c: cell(5, 1, [1, 2]), target: cell(5, 4, [1, 2, 3]) },
    related: ['a', 'b', 'c', 'target'], answers: [['target', 1], ['target', 2]],
    prompt: (n) => `唯一矩形 Type 1：指定多候選角，排除任一矩形候選 ${n(1)} 或 ${n(2)}。`,
    explain: (p, n) => `四角若都只剩 ${n(1)}/${n(2)}，會形成可互換的雙解矩形。依唯一解前提，${p('target')} 的額外候選 ${n(3)} 必須成立，所以可排除 ${n(1)} 或 ${n(2)}。此推論依賴唯一解假設。`
  },
  bugPlusOne: {
    digit: 5, kind: 'placement',
    cells: { a: cell(1, 2, [2, 5]), b: cell(1, 8, [5, 8]), c: cell(5, 1, [2, 8]), target: cell(5, 5, [2, 5, 8]), d: cell(5, 9, [2, 5]), e: cell(9, 5, [5, 8]) },
    related: ['a', 'b', 'c', 'target', 'd', 'e'], answers: [['target', 5]],
    prompt: (n) => `已確認其餘未解格全為雙候選且符合 BUG；唯一三候選格應填入哪一數？`,
    explain: (p, n) => `BUG 條件下每個候選在相關單位成對出現；${p('target')} 是唯一三候選格，多出的 ${n(5)} 破壞成對分布。為避免 BUG 雙解，必須在 ${p('target')} 填入 ${n(5)}。此推論依賴唯一解假設。`
  },
  forcingChain: {
    digit: 7, kind: 'elimination',
    cells: { pivot: cell(1, 1, [1, 2]), a: cell(1, 5, [1, 7]), b: cell(5, 1, [2, 7]), target: cell(5, 5, [7, 9]) },
    related: ['pivot', 'a', 'b'], answers: [['target', 7]],
    prompt: (n) => `強制分支得到共同結論；指定哪一格可排除 ${n(7)}？`,
    explain: (p, n) => `若 ${p('pivot')}=${n(1)}，則 ${p('a')}=${n(7)}；若 ${p('pivot')}=${n(2)}，則 ${p('b')}=${n(7)}。兩個完整分支都讓 ${p('target')} 看見一個 ${n(7)}，所以它可排除 ${n(7)}。`
  },
  search: {
    digit: 2, kind: 'placement',
    cells: { pivot: cell(1, 1, [1, 2]), a: cell(1, 5, [1, 7]), b: cell(5, 1, [1, 7]), dead: cell(5, 5, [7]) },
    related: ['pivot', 'a', 'b', 'dead'], answers: [['pivot', 2]],
    prompt: () => '回溯驗證：假設樞紐取第一個候選後導致指定格無候選，原樞紐應填哪一數？',
    explain: (p, n) => `假設 ${p('pivot')}=${n(1)}，會迫使 ${p('a')}=${n(7)} 且 ${p('b')}=${n(7)}，使 ${p('dead')} 的唯一候選 ${n(7)} 同時被排除而矛盾。因此撤銷假設，在 ${p('pivot')} 填入 ${n(2)}。這是搜尋驗證，不列入邏輯技巧統計。`
  }
};

function shifted(digit, amount) {
  return ((digit - 1 + amount) % 9) + 1;
}

function transformedIndex(source, transform) {
  const row = Math.floor(source / 9) + 1;
  const col = source % 9 + 1;
  const [nextRow, nextCol] = transform.map(row, col);
  return indexOf(nextRow, nextCol);
}

function createQuestion(technique, definition, transform, variant) {
  const board = Array(81).fill(0);
  const candidates = Array.from({ length: 81 }, () => []);
  const positions = {};
  Object.entries(definition.cells).forEach(([name, source]) => {
    const index = transformedIndex(source.index, transform);
    positions[name] = index;
    candidates[index] = source.digits.map((digit) => shifted(digit, transform.shift));
  });
  const answers = definition.answers.map(([name, digit]) => ({ index: positions[name], digit: shifted(digit, transform.shift) }));
  const place = (name) => cellName(positions[name]);
  const number = (digit) => shifted(digit, transform.shift);
  return Object.freeze({
    id: `${technique}-${variant + 1}-focus`, technique, variant: variant + 1,
    variantLabel: `${transform.label} · 已省略無關候選`, kind: definition.kind,
    board: Object.freeze(board), boardKey: `${technique}-${variant + 1}`,
    candidates: Object.freeze(candidates.map((values) => Object.freeze(values))),
    prompt: definition.prompt(number),
    instruction: definition.kind === 'placement' ? '先點選指定目標格，再按下應填入的數字。' : '先點選可排除候選的指定格，再按下該候選數。',
    answers: Object.freeze(answers.map(Object.freeze)),
    related: Object.freeze(definition.related.map((name) => positions[name])),
    explanation: definition.explain(place, number),
    answerSummary: answers.length === 1
      ? `${cellName(answers[0].index)} · ${definition.kind === 'placement' ? '填入' : '排除'} ${answers[0].digit}`
      : `${cellName(answers[0].index)} · 排除 ${answers.map(({ digit }) => digit).join(' 或 ')}`
  });
}

export const MANUAL_ASSESSMENT_TECHNIQUES = Object.freeze(Object.keys(definitions));

export function getManualTechniqueQuestions(technique, count = 3) {
  const definition = definitions[technique];
  if (!definition) return [];
  return Object.freeze(TRANSFORMS.slice(0, count).map((transform, variant) => createQuestion(technique, definition, transform, variant)));
}
