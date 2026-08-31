import { cellName, logicalSolve, parsePuzzle, serializeGrid } from '../core/sudoku.js?v=20260831-learning1';
import { DRILL_BY_TECHNIQUE } from './drills.js?v=20260824-advanced1';
import { ASSESSMENT_SOURCES } from './assessment-sources.generated.js?v=20260831-learning1';
import { getManualTechniqueQuestions, MANUAL_ASSESSMENT_TECHNIQUES } from './manual-assessments.js?v=20260831-learning1';

const TRANSFORMS = [
  { id: 'original', label: '原始盤面', map: (row, col) => [row, col], shift: 0 },
  { id: 'transpose', label: '轉置盤面', map: (row, col) => [col, row], shift: 3 },
  { id: 'rotate', label: '旋轉盤面', map: (row, col) => [8 - row, 8 - col], shift: 5 },
  { id: 'mirror-x', label: '左右鏡射', map: (row, col) => [row, 8 - col], shift: 7 },
  { id: 'mirror-y', label: '上下鏡射', map: (row, col) => [8 - row, col], shift: 2 },
  { id: 'rotate-90', label: '順時針旋轉', map: (row, col) => [col, 8 - row], shift: 4 },
  { id: 'rotate-270', label: '逆時針旋轉', map: (row, col) => [8 - col, row], shift: 6 },
  { id: 'bands', label: '宮帶輪替', map: (row, col) => [(row + 3) % 9, col], shift: 1 },
  { id: 'stacks', label: '宮疊輪替', map: (row, col) => [row, (col + 3) % 9], shift: 8 },
  { id: 'rows', label: '帶內行輪替', map: (row, col) => [Math.floor(row / 3) * 3 + ((row + 1) % 3), col], shift: 3 },
  { id: 'cols', label: '疊內列輪替', map: (row, col) => [row, Math.floor(col / 3) * 3 + ((col + 1) % 3)], shift: 5 },
  { id: 'anti-transpose', label: '轉置鏡射', map: (row, col) => [8 - col, 8 - row], shift: 7 }
];

const STRONG_LINK_TECHNIQUES = new Set(['xWing', 'swordfish', 'jellyfish', 'skyscraper', 'kite', 'wWing', 'simpleColoring', 'xChain', 'xyChain', 'aic', 'finnedFish', 'forcingChain']);
const SET_TECHNIQUES = new Set(['nakedPair', 'hiddenPair', 'nakedTriple', 'hiddenTriple', 'nakedQuad', 'hiddenQuad', 'als', 'sueDeCoq']);
const FISH_TECHNIQUES = new Set(['xWing', 'swordfish', 'jellyfish', 'finnedFish']);

const CONFUSABLES = {
  fullHouse: ['nakedSingle', 'hiddenSingle'], nakedSingle: ['fullHouse', 'hiddenSingle'], hiddenSingle: ['nakedSingle', 'lockedPointing'],
  lockedPointing: ['lockedClaiming', 'hiddenSingle'], lockedClaiming: ['lockedPointing', 'xWing'],
  nakedPair: ['hiddenPair', 'nakedTriple'], hiddenPair: ['nakedPair', 'hiddenTriple'], nakedTriple: ['hiddenTriple', 'nakedPair'],
  hiddenTriple: ['nakedTriple', 'hiddenPair'], nakedQuad: ['hiddenQuad', 'nakedTriple'], hiddenQuad: ['nakedQuad', 'hiddenTriple'],
  xWing: ['skyscraper', 'finnedFish'], swordfish: ['xWing', 'jellyfish'], jellyfish: ['swordfish', 'finnedFish'],
  skyscraper: ['kite', 'xWing'], kite: ['skyscraper', 'emptyRectangle'], emptyRectangle: ['kite', 'xChain'],
  xyWing: ['xyzWing', 'wWing'], xyzWing: ['xyWing', 'als'], wWing: ['xyWing', 'xChain'],
  simpleColoring: ['xChain', 'aic'], xChain: ['simpleColoring', 'aic'], xyChain: ['aic', 'forcingChain'], aic: ['xChain', 'xyChain'],
  als: ['sueDeCoq', 'xyzWing'], sueDeCoq: ['als', 'hiddenQuad'], finnedFish: ['xWing', 'jellyfish'],
  uniqueRectangle: ['bugPlusOne', 'nakedPair'], bugPlusOne: ['uniqueRectangle', 'forcingChain'], forcingChain: ['aic', 'xyChain'],
  search: ['forcingChain', 'aic']
};

const REASON_SUMMARIES = {
  fullHouse: '該行、列或宮只缺這一個數字，所以缺格可以直接確定。',
  nakedSingle: '目標格排除同行、同列與同宮已有數字後，只剩唯一候選。',
  hiddenSingle: '這個數字在指定行、列或宮中只剩目標格可以放。',
  lockedPointing: '宮內該候選全落在同一行或列，因此可從宮外同線格排除。',
  lockedClaiming: '同一行或列的該候選全落在同一宮，因此可從宮內線外格排除。',
  nakedPair: '同一單位中兩格只含同一對候選，其他格不能再含這兩數。',
  hiddenPair: '兩個數在同一單位中只出現在同兩格，可刪除那兩格的其他候選。',
  nakedTriple: '三格的候選聯集恰為三數，因此同單位其他格可排除這三數。',
  hiddenTriple: '三個數在同一單位中只分布於三格，因此三格可刪除其他候選。',
  nakedQuad: '四格的候選聯集恰為四數，因此同單位其他格可排除這四數。',
  hiddenQuad: '四個數在同一單位中只分布於四格，因此四格可刪除其他候選。',
  xWing: '同一候選在兩條基底線各只落於相同兩條覆蓋線，覆蓋線其他格可排除。',
  swordfish: '同一候選在三條基底線只落於三條覆蓋線，覆蓋線其他格可排除。',
  jellyfish: '同一候選在四條基底線只落於四條覆蓋線，覆蓋線其他格可排除。',
  skyscraper: '兩條強連結的近端互見，使兩個遠端至少一個為真；共同可見格可排除。',
  kite: '一條行強連結與一條列強連結在同宮相接，兩個遠端至少一個為真。',
  emptyRectangle: '宮內候選形成空矩形兩臂，配合外部強連結，使共同可見格可排除。',
  xyWing: '樞紐的兩種可能分別迫使兩翼給出同一候選，兩翼共同可見格可排除。',
  xyzWing: '樞紐與兩翼無論哪個候選成立，都會使共同可見格不能保留消去數。',
  wWing: '兩個相同雙候選格由另一候選的強連結相接，使共同可見格可排除共同候選。',
  simpleColoring: '沿同數強連結交替著色後，同色衝突或雙色共同可見會導出排除。',
  xChain: '同一候選的強弱連結交替成鏈，鏈端關係使共同可見格可排除。',
  xyChain: '雙候選格以候選交替串接，兩端同數至少一端為真，故共同可見格可排除。',
  aic: '強弱連結交替的推理鏈保證兩端至少一端成立，因此導出指定排除。',
  als: '幾乎鎖定集合彼此以受限共同候選連接，目標候選不能同時留在共同可見處。',
  sueDeCoq: '行列與宮交界的候選可拆成互斥集合，因此兩側相應候選可排除。',
  finnedFish: '魚形多出一個鰭候選，排除只限於鰭所在宮且位於相應覆蓋線的格。',
  uniqueRectangle: '若保留矩形的兩候選會形成致命多解，因此額外候選必須保留並排除矩形候選。',
  bugPlusOne: '除一格外皆為雙候選時，三候選格須取出現次數異常的數以避免 BUG 多解。',
  forcingChain: '枚舉樞紐的每個候選分支都得到相同結論，因此該結論無條件成立。'
};

function shiftDigit(value, amount) {
  return value ? ((value - 1 + amount) % 9) + 1 : 0;
}

export function transformPuzzle(puzzle, transform) {
  const source = typeof puzzle === 'string' ? parsePuzzle(puzzle) : puzzle;
  const output = Array(81).fill(0);
  source.forEach((value, index) => {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const [nextRow, nextCol] = transform.map(row, col);
    output[nextRow * 9 + nextCol] = shiftDigit(value, transform.shift);
  });
  return output;
}

function actionLabel(step) {
  if (step.kind === 'placement') return `找出可以確定填入 ${step.digit} 的格子`;
  const digits = [...new Set((step.eliminations || []).map(({ digit }) => digit))];
  return digits.length === 1 ? `找出至少一格可以排除候選 ${digits[0]} 的位置` : '找出一組可以移除的候選數與位置';
}

function stableOffset(text, length) {
  return [...text].reduce((sum, character) => sum + character.charCodeAt(0), 0) % length;
}

function reasonDistractors(question) {
  const digit = question.answers[0]?.digit || '該數';
  const common = [
    `只要兩個標示格都含候選 ${digit}，不必確認它們是否形成強連結。`,
    '目標格只要看見其中一個端點，就可以直接排除候選。',
    '候選數較少的格一定優先成立，所以可忽略同行、同列與同宮的分布。',
    '這一步必須先假設一個答案並搜尋到底，無法由目前候選直接證明。'
  ];
  if (SET_TECHNIQUES.has(question.technique)) common[0] = '只要幾格含有相同候選，就算候選聯集數量大於格數也能鎖定。';
  if (FISH_TECHNIQUES.has(question.technique)) common[1] = '魚形只需數候選總數，不必確認基底線與覆蓋線的分布。';
  if (question.kind === 'placement') common[3] = '因為這一格目前空白，所以可直接填入題目要求的數字。';
  return common.slice(0, 3);
}

function enrichQuestion(question) {
  const correctText = REASON_SUMMARIES[question.technique] || question.explanation;
  const choices = [
    { id: 'correct', text: correctText, correct: true },
    ...reasonDistractors(question).map((text, index) => ({ id: `distractor-${index + 1}`, text, correct: false }))
  ];
  const offset = stableOffset(question.id, choices.length);
  const rotated = [...choices.slice(offset), ...choices.slice(0, offset)].map(Object.freeze);
  return Object.freeze({ ...question, reasonChoices: Object.freeze(rotated), visual: buildQuestionVisual(question) });
}

function buildQuestion(technique, transform, step, ordinal, sourceId, independent) {
  const answers = step.kind === 'placement' ? [{ index: step.index, digit: step.digit }] : (step.eliminations || []);
  if (!step.snapshot || !answers.length) return null;
  return enrichQuestion({
    id: `${technique}-${sourceId}-${transform.id}`,
    technique,
    variant: ordinal + 1,
    variantLabel: independent ? `獨立題源 ${sourceId}` : `${sourceId} · ${transform.label}`,
    sourceId,
    sourceKind: independent ? 'independent' : 'validated-transform',
    kind: step.kind,
    board: Object.freeze([...step.snapshot.grid]),
    boardKey: serializeGrid(step.snapshot.grid),
    candidates: Object.freeze(step.snapshot.candidates.map((values) => Object.freeze([...values]))),
    prompt: actionLabel(step),
    instruction: step.kind === 'placement' ? '先點選目標格，再按下應填入的數字。動作正確後還要選出成立理由。' : '先點選要排除候選的格子，再按下該候選數。動作正確後還要選出成立理由。',
    answers: Object.freeze(answers.map(({ index, digit }) => Object.freeze({ index, digit }))),
    related: Object.freeze([...(step.related || [])]),
    explanation: step.explanation,
    answerSummary: answers.length === 1 ? `${cellName(answers[0].index)} · ${step.kind === 'placement' ? '填入' : '排除'} ${answers[0].digit}` : `${answers.length} 個有效動作，任選一個即可作答`
  });
}

export function buildQuestionVisual(question) {
  const digit = question.answers[0]?.digit || null;
  const targets = new Set(question.answers.map(({ index }) => index));
  const related = [...new Set(question.related || [])];
  const nodes = [...new Set([...related, ...targets])].map((index, order) => Object.freeze({ index, role: targets.has(index) ? 'target' : 'logic', color: order % 2 ? 'b' : 'a', digit }));
  const exactUnits = question.proof?.exactUnits || [];
  const links = [];
  for (const unit of exactUnits) {
    if (unit.allowed.length === 2) links.push(Object.freeze({ from: unit.allowed[0], to: unit.allowed[1], type: 'strong', digit: unit.digit }));
  }
  if (!links.length) related.slice(1).forEach((index, position) => links.push(Object.freeze({ from: related[position], to: index, type: position % 2 ? 'weak' : 'strong', digit })));
  const units = exactUnits.map((unit) => Object.freeze({ indices: Object.freeze([...unit.indices]), allowed: Object.freeze([...unit.allowed]), digit: unit.digit }));
  const rows = [...new Set(related.map((index) => Math.floor(index / 9)))];
  const cols = [...new Set(related.map((index) => index % 9))];
  const fish = FISH_TECHNIQUES.has(question.technique) ? Object.freeze({ digit, base: rows.length <= cols.length ? 'row' : 'col', rows: Object.freeze(rows), cols: Object.freeze(cols) }) : null;
  const groups = ['als', 'sueDeCoq'].includes(question.technique) && question.proof?.positions
    ? Object.freeze(Object.entries(question.proof.positions).map(([name, index]) => Object.freeze({ name, index })))
    : Object.freeze([]);
  return Object.freeze({ nodes: Object.freeze(nodes), links: Object.freeze(links), units: Object.freeze(units), fish, groups });
}

function addQuestion(collection, seenBoards, question) {
  if (!question || seenBoards.has(question.boardKey)) return;
  seenBoards.add(question.boardKey);
  collection.push(question.reasonChoices ? question : enrichQuestion(question));
}

const questionCache = new Map();

export function getTechniqueQuestions(technique, count = 12) {
  const key = `${technique}:${count}`;
  if (questionCache.has(key)) return questionCache.get(key);
  const questions = [];
  const seenBoards = new Set();
  const sources = ASSESSMENT_SOURCES[technique] || [];
  const manualQuestions = MANUAL_ASSESSMENT_TECHNIQUES.includes(technique) ? getManualTechniqueQuestions(technique, count) : [];

  // Advanced techniques first expose three rigorously validated candidate-state
  // examples. The rest of the bank then prefers independent 300-level sources.
  for (const question of manualQuestions.slice(0, Math.min(3, count))) addQuestion(questions, seenBoards, question);

  for (const source of sources) {
    const puzzle = parsePuzzle(source.puzzle);
    const trace = logicalSolve(puzzle, { includeSnapshots: true, allowAdvanced: true });
    const step = trace.steps.find((item) => item.strategy === technique && item.snapshot);
    addQuestion(questions, seenBoards, step ? buildQuestion(technique, TRANSFORMS[0], step, questions.length, source.id, true) : null);
    if (questions.length >= count) break;
  }

  for (const transform of TRANSFORMS.slice(1)) {
    for (const source of sources) {
      if (questions.length >= count) break;
      const puzzle = transformPuzzle(source.puzzle, transform);
      const trace = logicalSolve(puzzle, { includeSnapshots: true, allowAdvanced: true });
      const step = trace.steps.find((item) => item.strategy === technique && item.snapshot);
      addQuestion(questions, seenBoards, step ? buildQuestion(technique, transform, step, questions.length, source.id, false) : null);
    }
    if (questions.length >= count) break;
  }

  const drill = DRILL_BY_TECHNIQUE.get(technique);
  if (drill) {
    for (const transform of TRANSFORMS) {
      if (questions.length >= count) break;
      const puzzle = transformPuzzle(drill.puzzle, transform);
      let trace = logicalSolve(puzzle, { includeSnapshots: true, allowAdvanced: false });
      let step = trace.steps.find((item) => item.strategy === technique && item.snapshot);
      if (!step) {
        trace = logicalSolve(puzzle, { includeSnapshots: true, allowAdvanced: true });
        step = trace.steps.find((item) => item.strategy === technique && item.snapshot);
      }
      addQuestion(questions, seenBoards, step ? buildQuestion(technique, transform, step, questions.length, drill.id, false) : null);
    }
  }

  if (questions.length < count) {
    for (const question of manualQuestions.length ? manualQuestions : getManualTechniqueQuestions(technique, count)) {
      if (questions.length >= count) break;
      addQuestion(questions, seenBoards, question);
    }
  }
  const frozen = Object.freeze(questions.slice(0, count));
  questionCache.set(key, frozen);
  return frozen;
}

export function evaluateTechniqueAnswer(question, index, digit) {
  return question.answers.some((answer) => answer.index === index && answer.digit === digit);
}

export function evaluateReasonAnswer(question, choiceId) {
  const choice = typeof choiceId === 'number' ? question.reasonChoices[choiceId] : question.reasonChoices.find((item) => item.id === choiceId);
  return Boolean(choice?.correct);
}

function peer(left, right) {
  const leftRow = Math.floor(left / 9); const leftCol = left % 9;
  const rightRow = Math.floor(right / 9); const rightCol = right % 9;
  return leftRow === rightRow || leftCol === rightCol || (Math.floor(leftRow / 3) === Math.floor(rightRow / 3) && Math.floor(leftCol / 3) === Math.floor(rightCol / 3));
}

export function diagnoseTechniqueAnswer(question, index, digit) {
  if (evaluateTechniqueAnswer(question, index, digit)) return null;
  const target = question.answers[0];
  const candidates = question.candidates[index] || [];
  if (!candidates.includes(digit)) return Object.freeze({ code: 'over-elimination', title: '過度排除', message: `${cellName(index)} 原本沒有候選 ${digit}；請先確認你是在操作盤面上實際存在的候選。` });
  if (index === target.index) return Object.freeze({ code: 'candidate-set', title: '候選集合不完整', message: '目標格方向接近，但數字不對。重新核對該格的完整候選集合，以及技巧真正鎖定的是哪一個候選。' });
  if (STRONG_LINK_TECHNIQUES.has(question.technique) && question.related.includes(index)) return Object.freeze({ code: 'strong-link', title: '強連結端點誤判', message: `${cellName(index)} 是推理結構的一部分，不是排除目標；強連結必須先確認該單位中此候選恰有兩處。` });
  if (peer(index, target.index)) return Object.freeze({ code: 'visibility', title: '共同可見區域誤判', message: `${cellName(index)} 雖與答案格共享單位，但不一定同時看見推理的必要端點；逐一檢查共同可見關係。` });
  if (SET_TECHNIQUES.has(question.technique)) return Object.freeze({ code: 'candidate-set', title: '候選集合數量不符', message: '請重新數「格數」與「候選聯集數」；裸集與隱集不可只看重複出現的數字。' });
  if (question.related.includes(index)) return Object.freeze({ code: 'technique-confusion', title: '把結構格當成答案格', message: `${cellName(index)} 用來建立技巧條件；排除或填入必須落在結構推導出的目標格。` });
  return Object.freeze({ code: 'wrong-target', title: '目標格判讀錯誤', message: `${cellName(index)} 不在這一步可證明的目標中；先找出所有關聯格，再尋找同時受它們限制的位置。` });
}

export function getDiscriminationQuestions(technique, count = 4) {
  const own = getTechniqueQuestions(technique, Math.max(2, count));
  const alternatives = (CONFUSABLES[technique] || []).filter((name) => getTechniqueQuestions(name, 1).length);
  if (!own.length) return Object.freeze([]);
  const output = [];
  for (let index = 0; index < count; index += 1) {
    const positive = index < Math.ceil(count / 2) || !alternatives.length;
    const useNone = !positive && index === count - 1;
    const optionKeys = [technique, ...alternatives].filter((value, position, array) => array.indexOf(value) === position).slice(0, 3);
    let actual = positive ? technique : alternatives[(index - Math.ceil(count / 2)) % alternatives.length];
    if (!useNone && !optionKeys.includes(actual)) optionKeys[Math.max(1, optionKeys.length - 1)] = actual;
    while (optionKeys.length < 3) optionKeys.push(['nakedSingle', 'xWing', 'xyWing'].find((name) => !optionKeys.includes(name)));
    if (useNone) {
      const excluded = new Set(optionKeys);
      actual = [...Object.keys(ASSESSMENT_SOURCES), ...MANUAL_ASSESSMENT_TECHNIQUES]
        .find((name) => !excluded.has(name) && name !== technique && getTechniqueQuestions(name, 1).length) || alternatives[0];
    }
    const source = positive ? own[index % own.length] : getTechniqueQuestions(actual, 1)[0];
    const choices = [...optionKeys.map((key) => ({ id: key, technique: key })), { id: 'none', technique: null }];
    output.push(Object.freeze({
      id: `${technique}-discriminate-${index + 1}`,
      technique,
      actualTechnique: useNone ? null : actual,
      sourceTechnique: actual,
      sourceQuestion: source,
      board: source.board,
      candidates: source.candidates,
      related: source.related,
      visual: source.visual,
      choices: Object.freeze(choices.map(Object.freeze)),
      prompt: useNone ? '只判斷標示的候選結構：下列技巧是否足以成立？' : '只判斷標示的候選結構：最符合哪一種技巧？',
      explanation: useNone ? `標示的是另一種已驗證結構，不符合本題列出的技巧；應選「條件不足／以上皆非」。` : source.explanation
    }));
  }
  return Object.freeze(output);
}

export function evaluateDiscriminationAnswer(question, answer) {
  return (question.actualTechnique || 'none') === answer;
}

export function getTechniqueQuestionBank(techniques, count = 12) {
  return new Map(techniques.map((technique) => [technique, getTechniqueQuestions(technique, count)]));
}
