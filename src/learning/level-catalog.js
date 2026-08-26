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
export const TOTAL_CHALLENGES = TOTAL_LEVEL_PUZZLES;

// 每級第 10 關是標準能力檢定；任何一關若在一半時間內完成，可提前證明能力並解鎖下一級。
export const LEVEL_TIME_LIMITS_MINUTES = Object.freeze([
  6, 7, 8, 9, 10, 11,
  12, 13, 14, 15, 16, 17,
  18, 19, 20, 21, 22, 23,
  24, 25, 26, 27, 28, 29,
  30, 32, 34, 36, 38, 40
]);

export function challengeNumberFor(levelNumber, questionNumber) {
  const level = Number(levelNumber);
  const question = Number(questionNumber);
  if (!Number.isInteger(level) || level < 1 || level > LEVELS.length) throw new Error(`級別必須介於 1–${LEVELS.length}。`);
  if (!Number.isInteger(question) || question < 1 || question > 10) throw new Error('題號必須介於 1–10。');
  return (level - 1) * 10 + question;
}

export function challengeIdFor(challengeNumber) {
  const number = Number(challengeNumber);
  if (!Number.isInteger(number) || number < 1 || number > TOTAL_CHALLENGES) throw new Error(`關卡必須介於 1–${TOTAL_CHALLENGES}。`);
  const level = Math.ceil(number / 10);
  const question = ((number - 1) % 10) + 1;
  return `L${String(level).padStart(2, '0')}-Q${String(question).padStart(2, '0')}`;
}

export function challengeNumberFromId(id) {
  const match = /^L(\d{2})-Q(\d{2})$/.exec(String(id || ''));
  if (!match) return null;
  const level = Number(match[1]);
  const question = Number(match[2]);
  if (level < 1 || level > LEVELS.length || question < 1 || question > 10) return null;
  return challengeNumberFor(level, question);
}

export function getLevelTimeLimitSeconds(levelNumber) {
  const level = Number(levelNumber);
  if (!Number.isInteger(level) || level < 1 || level > LEVELS.length) throw new Error(`級別必須介於 1–${LEVELS.length}。`);
  return LEVEL_TIME_LIMITS_MINUTES[level - 1] * 60;
}

export function getLevelFastTrackSeconds(levelNumber) {
  return Math.floor(getLevelTimeLimitSeconds(levelNumber) / 2);
}

export function isLevelCheckpoint(challengeNumber) {
  const number = Number(challengeNumber);
  return Number.isInteger(number) && number >= 1 && number <= TOTAL_CHALLENGES && number % 10 === 0;
}

export function evaluateLevelQualification(challengeNumber, elapsedSeconds) {
  const number = Number(challengeNumber);
  const elapsed = Number(elapsedSeconds);
  if (!Number.isInteger(number) || number < 1 || number > TOTAL_CHALLENGES) throw new Error(`關卡必須介於 1–${TOTAL_CHALLENGES}。`);
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error('完成時間必須是非負秒數。');
  const level = Math.ceil(number / 10);
  const checkpoint = isLevelCheckpoint(number);
  const standardTargetSeconds = getLevelTimeLimitSeconds(level);
  const fastTrackSeconds = getLevelFastTrackSeconds(level);
  const targetSeconds = checkpoint ? standardTargetSeconds : fastTrackSeconds;
  return {
    level,
    checkpoint,
    route: checkpoint ? 'checkpoint' : 'fast-track',
    qualified: elapsed <= targetSeconds,
    targetSeconds,
    standardTargetSeconds,
    fastTrackSeconds
  };
}

function normalizeQualifiedLevels(qualifiedLevels) {
  if (qualifiedLevels instanceof Set) return qualifiedLevels;
  if (Array.isArray(qualifiedLevels)) return new Set(qualifiedLevels.map(Number));
  if (qualifiedLevels && typeof qualifiedLevels === 'object') {
    return new Set(Object.entries(qualifiedLevels)
      .filter(([, result]) => result?.qualified === true)
      .map(([level]) => Number(level)));
  }
  return new Set();
}

export function getNextChallengeNumber(completedIds = [], qualifiedLevels = []) {
  const completed = completedIds instanceof Set ? completedIds : new Set(completedIds);
  const qualified = normalizeQualifiedLevels(qualifiedLevels);
  for (let level = 1; level <= LEVELS.length; level += 1) {
    const first = challengeNumberFor(level, 1);
    const checkpoint = challengeNumberFor(level, 10);
    for (let number = first; number <= checkpoint; number += 1) {
      if (!completed.has(challengeIdFor(number))) return number;
    }
    if (level < LEVELS.length && !qualified.has(level)) return checkpoint;
  }
  return null;
}

export function isChallengeUnlocked(challengeNumber, completedIds = [], qualifiedLevels = []) {
  const number = Number(challengeNumber);
  if (!Number.isInteger(number) || number < 1 || number > TOTAL_CHALLENGES) return false;
  const completed = completedIds instanceof Set ? completedIds : new Set(completedIds);
  if (completed.has(challengeIdFor(number))) return true;
  const qualified = normalizeQualifiedLevels(qualifiedLevels);
  const level = Math.ceil(number / 10);
  if (level > 1 && !qualified.has(level - 1)) return false;
  const first = challengeNumberFor(level, 1);
  for (let previous = first; previous < number; previous += 1) {
    if (!completed.has(challengeIdFor(previous))) return false;
  }
  return true;
}

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
  const challengeNumber = challengeNumberFor(level.level, question);
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
    challengeNumber,
    focusTechnique: level.focusTechnique,
    techniqueLabel: level.techniqueLabel,
    title: `第 ${challengeNumber} 關 · Lv.${level.level} ${level.title}`
  };
}

export function getChallenge(challengeNumber) {
  const number = Number(challengeNumber);
  if (!Number.isInteger(number) || number < 1 || number > TOTAL_CHALLENGES) throw new Error(`關卡必須介於 1–${TOTAL_CHALLENGES}。`);
  return getLevelPuzzle(Math.ceil(number / 10), ((number - 1) % 10) + 1);
}
