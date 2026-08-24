import { parsePuzzle, solveGrid } from '../core/sudoku.js?v=20260825-levels2';
import { TECHNIQUE_NAMES } from './curriculum.js?v=20260824-advanced1';
import { LEVEL_PUZZLE_BASES } from './level-puzzles.generated.js?v=20260825-levels2';

export const LEVEL_STAGES = [
  { number: 1, name: '基礎單數', short: '基礎', range: 'Lv.1–6', description: '從末格、唯一候選開始，建立穩定掃描順序。', difficulty: 'easy' },
  { number: 2, name: '隱性定位', short: '定位', range: 'Lv.7–12', description: '在行、列、宮中找出某數唯一能放的位置。', difficulty: 'medium' },
  { number: 3, name: '區塊與集合', short: '集合', range: 'Lv.13–18', description: '利用數對與宮線互鎖，先排除候選再推進。', difficulty: 'hard' },
  { number: 4, name: '圖形與翼', short: '圖形', range: 'Lv.19–24', description: '辨識翼形、魚形與跨單位的候選結構。', difficulty: 'expert' },
  { number: 5, name: '鏈與高階', short: '高階', range: 'Lv.25–30', description: '追蹤推理鏈與近鎖定集合，最後明確區分搜尋驗證。', difficulty: 'expert' }
];

const phaseNames = ['初識', '觀察', '定位', '應用', '整合', '熟練'];

export const LEVELS = LEVEL_PUZZLE_BASES.map((base, index) => {
  const stage = LEVEL_STAGES[Math.floor(index / 6)];
  const focusTechnique = base.hardestTechniques[0];
  const techniqueLabel = TECHNIQUE_NAMES[focusTechnique] || focusTechnique;
  return {
    ...base,
    stage: stage.number,
    stageName: stage.name,
    difficulty: stage.difficulty,
    title: `${techniqueLabel} · ${phaseNames[index % 6]}`,
    clues: 81 - base.blanks,
    questionCount: 10,
    focusTechnique,
    techniqueLabel
  };
});

export const TOTAL_LEVEL_PUZZLES = LEVELS.reduce((total, level) => total + level.questionCount, 0);

export function getLevel(levelNumber) {
  return LEVELS.find((level) => level.level === Number(levelNumber)) || null;
}

export function getLevelPuzzle(levelNumber, questionNumber) {
  const level = getLevel(levelNumber);
  const question = Number(questionNumber);
  if (!level) throw new Error(`未知級別：${levelNumber}`);
  if (!Number.isInteger(question) || question < 1 || question > level.questionCount) throw new Error(`題號必須介於 1–${level.questionCount}。`);
  const id = `L${String(level.level).padStart(2, '0')}-Q${String(question).padStart(2, '0')}`;
  const puzzle = parsePuzzle(level.puzzles[question - 1].puzzle);
  const solution = solveGrid(puzzle);
  if (!solution) throw new Error(`${id} 無解。`);
  return {
    id,
    bankId: id,
    puzzle,
    solution,
    seed: id,
    clues: level.clues,
    blanks: level.blanks,
    difficulty: level.difficulty,
    difficultyLabel: `第 ${level.stage} 階 · Lv.${level.level}`,
    level: level.level,
    stage: level.stage,
    question,
    focusTechnique: level.focusTechnique,
    techniqueLabel: level.techniqueLabel,
    title: `Lv.${level.level} ${level.title} · 第 ${question} 題`
  };
}
