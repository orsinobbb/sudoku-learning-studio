import { cellName, logicalSolve, parsePuzzle, serializeGrid } from '../core/sudoku.js?v=20260824-learning6';
import { DRILL_BY_TECHNIQUE } from './drills.js?v=20260824-learning6';
import { getManualTechniqueQuestions } from './manual-assessments.js?v=20260824-learning6';

const TRANSFORMS = [
  { id: 'original', label: '原始盤面', map: (row, col) => [row, col], shift: 0 },
  { id: 'transpose', label: '轉置盤面', map: (row, col) => [col, row], shift: 3 },
  { id: 'rotate', label: '旋轉盤面', map: (row, col) => [8 - row, 8 - col], shift: 5 },
  { id: 'mirror', label: '鏡射盤面', map: (row, col) => [row, 8 - col], shift: 7 },
  { id: 'bands', label: '交換宮帶', map: (row, col) => [(row + 3) % 9, col], shift: 2 },
  { id: 'stacks', label: '交換宮疊', map: (row, col) => [row, (col + 3) % 9], shift: 4 },
  { id: 'transverse', label: '轉置鏡射', map: (row, col) => [8 - col, row], shift: 6 },
  { id: 'digits-one', label: '數字置換 A', map: (row, col) => [row, col], shift: 1 },
  { id: 'digits-two', label: '數字置換 B', map: (row, col) => [row, col], shift: 2 }
];

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
  return digits.length === 1
    ? `找出至少一格可以排除候選 ${digits[0]} 的位置`
    : '找出一組可以移除的候選數與位置';
}

function buildQuestion(technique, transform, step, ordinal) {
  const answers = step.kind === 'placement'
    ? [{ index: step.index, digit: step.digit }]
    : (step.eliminations || []);
  if (!step.snapshot || !answers.length) return null;
  return Object.freeze({
    id: `${technique}-${ordinal + 1}-${transform.id}`,
    technique,
    variant: ordinal + 1,
    variantLabel: transform.label,
    kind: step.kind,
    board: Object.freeze([...step.snapshot.grid]),
    boardKey: serializeGrid(step.snapshot.grid),
    candidates: Object.freeze(step.snapshot.candidates.map((values) => Object.freeze([...values]))),
    prompt: actionLabel(step),
    instruction: step.kind === 'placement'
      ? '先點選目標格，再按下應填入的數字。'
      : '先點選要排除候選的格子，再按下該候選數。',
    answers: Object.freeze(answers.map(({ index, digit }) => Object.freeze({ index, digit }))),
    related: Object.freeze([...(step.related || [])]),
    explanation: step.explanation,
    answerSummary: answers.length === 1
      ? `${cellName(answers[0].index)} · ${step.kind === 'placement' ? '填入' : '排除'} ${answers[0].digit}`
      : `${answers.length} 個有效動作，任選一個即可作答`
  });
}

const questionCache = new Map();

export function getTechniqueQuestions(technique, count = 3) {
  const key = `${technique}:${count}`;
  if (questionCache.has(key)) return questionCache.get(key);
  const drill = DRILL_BY_TECHNIQUE.get(technique);
  if (!drill) {
    const manualQuestions = getManualTechniqueQuestions(technique, count);
    questionCache.set(key, manualQuestions);
    return manualQuestions;
  }
  const questions = [];
  const seenBoards = new Set();
  for (const transform of TRANSFORMS) {
    const puzzle = transformPuzzle(drill.puzzle, transform);
    const trace = logicalSolve(puzzle, { includeSnapshots: true });
    const step = trace.steps.find((item) => item.strategy === technique && item.snapshot);
    const question = step ? buildQuestion(technique, transform, step, questions.length) : null;
    if (!question || seenBoards.has(question.boardKey)) continue;
    seenBoards.add(question.boardKey);
    questions.push(question);
    if (questions.length === count) break;
  }
  const frozen = Object.freeze(questions);
  questionCache.set(key, frozen);
  return frozen;
}

export function evaluateTechniqueAnswer(question, index, digit) {
  return question.answers.some((answer) => answer.index === index && answer.digit === digit);
}

export function getTechniqueQuestionBank(techniques, count = 3) {
  return new Map(techniques.map((technique) => [technique, getTechniqueQuestions(technique, count)]));
}
