import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PEERS,
  TECHNIQUE_RANKS,
  analyzePuzzle,
  candidateNotesForGrid,
  candidatesFor,
  countSolutions,
  generatePuzzle,
  generateSolution,
  getCompletedDigits,
  getWrongEntries,
  isSolved,
  nextHint,
  parsePuzzle,
  serializeGrid,
  solveGrid,
  suggestNextMoves,
  validateGrid
} from '../src/core/sudoku.js';
import { ADVANCED_TECHNIQUE_ORDER, findAdvancedMoves } from '../src/core/advanced-techniques.js';
import { ALL_LESSONS, DETECTABLE_LESSONS, JOURNEY_STAGES, TARGETED_LESSONS } from '../src/learning/curriculum.js';
import { TECHNIQUE_DRILLS } from '../src/learning/drills.js';
import { evaluateTechniqueAnswer, getTechniqueQuestions } from '../src/learning/assessments.js';
import {
  MANUAL_ASSESSMENT_TECHNIQUES,
  countCandidateStateSolutions,
  validateManualTechniqueQuestion
} from '../src/learning/manual-assessments.js';
import { TUTORIALS } from '../src/learning/tutorials.js';
import {
  LEVELS,
  LEVEL_STAGES,
  LEVEL_TIME_LIMITS_MINUTES,
  TOTAL_CHALLENGES,
  TOTAL_LEVEL_PUZZLES,
  challengeIdFor,
  challengeNumberFor,
  challengeNumberFromId,
  evaluateLevelQualification,
  getChallenge,
  getLevelFastTrackSeconds,
  getLevelPuzzle,
  getLevelTimeLimitSeconds,
  getNextChallengeNumber,
  isLevelCheckpoint,
  isChallengeUnlocked
} from '../src/learning/level-catalog.js';
import { PROGRESS_KEY, SESSION_KEY, readProgress, readSession, writeProgress, writeSession } from '../src/learning/storage.js';
import {
  clearTrials,
  confirmTrials,
  createTrialState,
  hasTrialChanges,
  markTrialCell,
  pauseTrial,
  snapshotTrialState,
  startTrial,
  trialConflictIndices,
  trialCounts
} from '../src/core/trial.js';

const classic = parsePuzzle('530070000600195000098000060800060003400803001700020006060000280000419005000080079');

test('parses and serializes 81-cell puzzle formats', () => {
  const dotted = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';
  assert.deepEqual(parsePuzzle(dotted), classic);
  assert.equal(serializeGrid(classic).length, 81);
  assert.throws(() => parsePuzzle('123'), /81 格/);
});

test('tracks wrong entries immediately and clears them after correction or erase', () => {
  const solution = solveGrid(classic);
  const index = classic.findIndex((value) => value === 0);
  const grid = [...classic];
  grid[index] = solution[index] === 9 ? 8 : solution[index] + 1;
  assert.deepEqual(getWrongEntries(grid, solution), [index]);
  grid[index] = solution[index];
  assert.deepEqual(getWrongEntries(grid, solution), []);
  grid[index] = 0;
  assert.deepEqual(getWrongEntries(grid, solution), []);
});

test('builds legal candidate notes for every empty cell', () => {
  const notes = candidateNotesForGrid(classic);
  assert.equal(notes.length, 81);
  assert.deepEqual(notes[0], []);
  assert.deepEqual(notes[2], [1, 2, 4]);
  assert.ok(notes.every((values, index) => classic[index] ? values.length === 0 : values.length > 0));
});

test('validates conflicts and calculates candidates', () => {
  const invalid = [...classic];
  invalid[2] = 5;
  const validation = validateGrid(invalid);
  assert.equal(validation.valid, false);
  assert.deepEqual(validation.conflicts, [0, 2]);
  assert.deepEqual(candidatesFor(classic, 2), [1, 2, 4]);
});

test('solves a classic puzzle and confirms uniqueness', () => {
  const solution = solveGrid(classic);
  assert.ok(solution);
  assert.equal(isSolved(solution), true);
  assert.equal(countSolutions(classic, 2), 1);
});

test('seeded generation is reproducible, valid and unique', () => {
  const first = generatePuzzle({ difficulty: 'medium', seed: 'TAIPEI-0816' });
  const second = generatePuzzle({ difficulty: 'medium', seed: 'TAIPEI-0816' });
  assert.deepEqual(first.puzzle, second.puzzle);
  assert.equal(isSolved(first.solution), true);
  assert.equal(validateGrid(first.puzzle).valid, true);
  assert.equal(countSolutions(first.puzzle, 2), 1);
  assert.ok(first.clues > 0);
});

test('generator difficulty levels match the teaching analyzer', () => {
  for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
    const generated = generatePuzzle({ difficulty, seed: 'CALIBRATE-0816' });
    assert.equal(analyzePuzzle(generated.puzzle).rating.key, difficulty);
  }
});

test('different seeds create different solved grids', () => {
  assert.notDeepEqual(generateSolution('ALPHA'), generateSolution('BETA'));
});

test('analyzer returns a rating and explainable placement steps', () => {
  const analysis = analyzePuzzle(classic);
  assert.equal(analysis.valid, true);
  assert.equal(analysis.unique, true);
  assert.equal(analysis.solution.length, 81);
  assert.ok(analysis.steps.length > 0);
  assert.ok(analysis.steps.some((step) => step.kind === 'placement' && step.explanation.includes('填')));
  assert.ok(analysis.rating.label);
  const hint = nextHint(classic);
  assert.equal(hint.kind, 'placement');
  assert.equal(classic[hint.index], 0);
});

test('next-move coach returns up to three distinct actions valid on the current board', () => {
  const result = suggestNextMoves(classic, { limit: 3 });
  assert.equal(result.status, 'ok');
  assert.equal(result.suggestions.length, 3);
  assert.equal(new Set(result.suggestions.map(({ actionKey }) => actionKey)).size, 3);
  for (const step of result.suggestions) {
    assert.ok(step.explanation.length >= 20);
    if (step.kind === 'placement') {
      assert.equal(classic[step.index], 0);
      assert.ok(candidatesFor(classic, step.index).includes(step.digit));
    } else {
      assert.ok(step.eliminations.every(({ index, digit }) => candidatesFor(classic, index).includes(digit)));
    }
  }
});

test('next-move coach orders easier techniques first and never substitutes search', () => {
  const expert = generatePuzzle({ difficulty: 'expert', seed: 'CHECK' }).puzzle;
  const result = suggestNextMoves(expert, { limit: 3 });
  const ranks = { fullHouse: 1, nakedSingle: 1, hiddenSingle: 2, lockedPointing: 3, lockedClaiming: 3, nakedPair: 4, hiddenPair: 4, nakedTriple: 5, hiddenTriple: 5, nakedQuad: 5, hiddenQuad: 5, xWing: 6, xyWing: 7, swordfish: 7, jellyfish: 8 };
  assert.deepEqual(result.suggestions.map(({ strategy }) => strategy), ['hiddenSingle', 'hiddenSingle', 'lockedClaiming']);
  assert.ok(result.suggestions.every(({ strategy }) => strategy !== 'search'));
  assert.deepEqual(result.suggestions.map(({ strategy }) => ranks[strategy]), [...result.suggestions].map(({ strategy }) => ranks[strategy]).sort((a, b) => a - b));
  assert.equal(suggestNextMoves(Array(81).fill(0)).status, 'none');
  assert.equal(suggestNextMoves(solveGrid(classic)).status, 'solved');
});

test('analyzer distinguishes invalid and non-unique puzzles', () => {
  const invalid = [...classic];
  invalid[2] = 5;
  assert.equal(analyzePuzzle(invalid).valid, false);
  const blank = Array(81).fill(0);
  const analysis = analyzePuzzle(blank);
  assert.equal(analysis.unique, false);
  assert.equal(analysis.solutionCount, 2);
});

test('expanded analyzer reports advanced logic separately from search', () => {
  const puzzle = generatePuzzle({ difficulty: 'expert', seed: 'CHECK' }).puzzle;
  const analysis = analyzePuzzle(puzzle, { allowAdvanced: false });
  assert.ok(analysis.techniqueCounts.hiddenPair >= 1);
  assert.ok(analysis.techniqueCounts.xWing >= 1);
  assert.ok(analysis.techniqueCounts.search >= 1);
  assert.equal(analysis.logicalOnly, false);
});

test('learning journey is complete, ordered and linked to detector coverage', () => {
  assert.equal(JOURNEY_STAGES.length, 6);
  assert.equal(ALL_LESSONS.length, 34);
  assert.equal(DETECTABLE_LESSONS.length, 30);
  assert.equal(TARGETED_LESSONS.length, 31);
  assert.equal(new Set(ALL_LESSONS.map(({ id }) => id)).size, ALL_LESSONS.length);
  assert.ok(JOURNEY_STAGES.every((stage) => stage.gate && stage.lessons.length >= 2));
});

test('completed digits require all nine correct placements', () => {
  const solution = solveGrid(classic);
  const partial = Array(81).fill(0);
  solution.forEach((value, index) => { if (value === 1) partial[index] = value; });
  assert.deepEqual(getCompletedDigits(partial, solution), [1]);
  const wrong = [...partial];
  wrong[solution.indexOf(1)] = 0;
  wrong[solution.findIndex((value) => value === 2)] = 1;
  assert.deepEqual(getCompletedDigits(wrong, solution), []);
});

test('every detectable technique has a verified dedicated drill', () => {
  assert.equal(new Set(TECHNIQUE_DRILLS.map(({ technique }) => technique)).size, TECHNIQUE_DRILLS.length);
  for (const lesson of DETECTABLE_LESSONS) {
    assert.ok(TECHNIQUE_DRILLS.some(({ technique }) => technique === lesson.analyzer) || lesson.assessment, `${lesson.analyzer} should have a full-board drill or verified candidate-state assessment`);
  }
  for (const drill of TECHNIQUE_DRILLS) {
    const lesson = DETECTABLE_LESSONS.find(({ analyzer }) => analyzer === drill.technique);
    const analysis = analyzePuzzle(parsePuzzle(drill.puzzle), { allowAdvanced: false });
    assert.ok(lesson, `${drill.technique} should map to a detectable lesson`);
    assert.equal(analysis.valid && analysis.unique, true, `${drill.technique} drill should have one solution`);
    assert.ok(analysis.techniqueCounts[drill.technique] >= 1, `${drill.technique} should occur in its drill`);
  }
});

test('all 15 advanced analyzers solve their verified target-position states', () => {
  assert.equal(ADVANCED_TECHNIQUE_ORDER.length, 15);
  for (const technique of ADVANCED_TECHNIQUE_ORDER) {
    for (const question of getTechniqueQuestions(technique, 3)) {
      const moves = findAdvancedMoves(question.board, question.candidates, { techniques: [technique], limit: 1, allowUniqueness: true, targetIndex: question.answers[0].index });
      const move = moves[0];
      const matches = question.answers.some((answer) => move?.kind === 'placement'
        ? move.index === answer.index && move.digit === answer.digit
        : move?.eliminations?.some(({ index, digit }) => index === answer.index && digit === answer.digit));
      assert.equal(matches, true, `${technique} ${question.variantLabel} should identify its verified answer`);
      assert.match(move.explanation, /。/);
    }
  }
});

test('every lesson has complete teaching content and a knowledge check', () => {
  assert.equal(Object.keys(TUTORIALS).length, ALL_LESSONS.length);
  for (const lesson of ALL_LESSONS) {
    const tutorial = TUTORIALS[lesson.id];
    assert.ok(tutorial?.principle && tutorial?.example && tutorial?.pitfall, `${lesson.id} should have full content`);
    assert.equal(tutorial.steps.length, 3);
    assert.ok(tutorial.check.choices[tutorial.check.answer]);
  }
});

test('every targeted technique has three target-position questions with exact grading', () => {
  for (const lesson of TARGETED_LESSONS) {
    const technique = lesson.assessment || lesson.analyzer;
    const questions = getTechniqueQuestions(technique, 3);
    assert.equal(questions.length, 3, `${technique} should have three variants`);
    assert.equal(new Set(questions.map(({ boardKey }) => boardKey)).size, 3);
    for (const question of questions) {
      const answer = question.answers[0];
      assert.equal(evaluateTechniqueAnswer(question, answer.index, answer.digit), true);
      assert.ok(question.candidates[answer.index].includes(answer.digit), `${technique} answer must be visible in target candidates`);
      const wrongIndex = question.answers[0].index === 0 ? 1 : 0;
      assert.equal(evaluateTechniqueAnswer(question, wrongIndex, question.answers[0].digit), false);
      assert.equal(question.board.length, 81);
      assert.equal(question.candidates.length, 81);
      if (MANUAL_ASSESSMENT_TECHNIQUES.includes(technique)) {
        const validation = validateManualTechniqueQuestion(question);
        assert.equal(validation.valid, true, `${technique}: ${validation.errors.join('；')}`);
        assert.match(question.variantLabel, /可驗證候選狀態|末盤 BUG\+1/);
        assert.match(question.instruction, /每個未解格都顯示目前完整候選/);
        assert.equal(validateGrid(question.board).valid, true, `${technique} givens should be valid`);
        assert.equal(isSolved(question.solution), true, `${technique} should retain a compatible solution`);
        question.board.forEach((digit, index) => {
          if (digit) assert.equal(digit, question.solution[index], `${technique} given at ${index} should match its solution`);
        });
        question.answers.forEach(({ index, digit }) => {
          assert.equal(question.kind === 'placement' ? question.solution[index] === digit : question.solution[index] !== digit, true);
        });
        question.candidates.forEach((digits, index) => {
          if (!question.board[index]) assert.ok(digits.length, `${technique} blank ${index} should show its complete candidate state`);
          for (const digit of digits) {
            assert.ok(candidatesFor(question.board, index).includes(digit), `${technique} candidate ${digit} at ${index} should be legal`);
          }
        });
      }
    }
  }
});

test('Empty Rectangle questions contain a real empty intersection and verified external strong link', () => {
  for (const question of getTechniqueQuestions('emptyRectangle', 3)) {
    const digit = question.answers[0].digit;
    const rectangle = question.proof.exactUnits.find(({ allowed }) => allowed.length === 4);
    const strongLink = question.proof.exactUnits.find(({ allowed }) => allowed.length === 2);
    const rowCounts = new Map();
    const colCounts = new Map();
    for (const index of rectangle.allowed) {
      rowCounts.set(Math.floor(index / 9), (rowCounts.get(Math.floor(index / 9)) || 0) + 1);
      colCounts.set(index % 9, (colCounts.get(index % 9) || 0) + 1);
    }
    const armRow = [...rowCounts].find(([, count]) => count === 2)[0];
    const armCol = [...colCounts].find(([, count]) => count === 2)[0];
    const intersection = armRow * 9 + armCol;
    assert.ok(rectangle.allowed.every((index) => Math.floor(index / 9) === armRow || index % 9 === armCol));
    assert.equal(rectangle.allowed.includes(intersection), false);
    assert.equal(question.candidates[intersection].includes(digit), false, 'ERI intersection must not contain the digit');
    assert.equal(strongLink.allowed.filter((index) => question.candidates[index].includes(digit)).length, 2);
    const target = question.answers[0].index;
    assert.ok(strongLink.allowed.some((index) => Math.floor(index / 9) === Math.floor(target / 9) || index % 9 === target % 9));
  }
});

test('BUG+1 questions are genuine all-bivalue states with one three-candidate cell', () => {
  for (const question of getTechniqueQuestions('bugPlusOne', 3)) {
    const blanks = question.board.map((value, index) => value ? -1 : index).filter((index) => index >= 0);
    const target = question.answers[0].index;
    const answer = question.answers[0].digit;
    assert.equal(blanks.length, 13);
    assert.equal(blanks.filter((index) => question.candidates[index].length === 2).length, 12);
    assert.deepEqual(blanks.filter((index) => question.candidates[index].length === 3), [target]);
    const row = Math.floor(target / 9);
    const col = target % 9;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    const units = [
      Array.from({ length: 9 }, (_, offset) => row * 9 + offset),
      Array.from({ length: 9 }, (_, offset) => offset * 9 + col),
      Array.from({ length: 9 }, (_, offset) => (boxRow + Math.floor(offset / 3)) * 9 + boxCol + offset % 3)
    ];
    for (const unit of units) {
      for (const digit of question.candidates[target]) {
        const occurrences = unit.filter((index) => question.candidates[index].includes(digit)).length;
        assert.equal(occurrences, digit === answer ? 3 : 2);
      }
    }
    assert.equal(countCandidateStateSolutions(question, null, 2), 1);
    for (const wrong of question.candidates[target].filter((digit) => digit !== answer)) {
      assert.equal(countCandidateStateSolutions(question, { index: target, digit: wrong }, 1), 0);
    }
  }
});

test('search questions verify the rejected branch instead of showing a pre-existing contradiction', () => {
  for (const question of getTechniqueQuestions('search', 3)) {
    const target = question.answers[0].index;
    const answer = question.answers[0].digit;
    const wrong = question.candidates[target].find((digit) => digit !== answer);
    assert.equal(question.candidates[target].length, 2);
    assert.equal(countCandidateStateSolutions(question, null, 2), 1);
    assert.equal(countCandidateStateSolutions(question, { index: target, digit: wrong }, 1), 0);
    assert.equal(countCandidateStateSolutions(question, { index: target, digit: answer }, 1), 1);
  }
});

test('progress migrates and puzzle sessions round-trip through browser storage', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  values.set(PROGRESS_KEY, JSON.stringify({ version: 3, solvedCount: 2, completedLessons: ['rules'] }));
  const migrated = readProgress(storage);
  assert.equal(migrated.solvedCount, 2);
  assert.deepEqual(migrated.lessonResults, {});
  assert.deepEqual(migrated.levelQualifications, {});
  assert.deepEqual(migrated.challengeBestTimes, {});
  writeProgress({ ...migrated, lessonResults: { rules: { knowledgePassed: true } }, levelQualifications: { 1: { qualified: true, bestSeconds: 300 } }, challengeBestTimes: { 'L01-Q10': 300 } }, storage);
  const savedProgress = JSON.parse(values.get(PROGRESS_KEY));
  assert.equal(savedProgress.version, 6);
  assert.equal(savedProgress.levelQualifications[1].bestSeconds, 300);
  assert.equal(savedProgress.challengeBestTimes['L01-Q10'], 300);
  const record = generatePuzzle({ difficulty: 'easy', seed: 'SAVE' });
  writeSession({ id: 'one', record, grid: record.puzzle, notes: Array.from({ length: 81 }, () => []), elapsed: 42 }, storage);
  assert.equal(readSession(storage).elapsed, 42);
  assert.equal(JSON.parse(values.get(SESSION_KEY)).version, 1);
});

test('two trial colors survive serialization and paused state', () => {
  const grid = Array(81).fill(0);
  const notes = Array.from({ length: 81 }, () => new Set());
  const trial = createTrialState();
  startTrial(trial, 1, grid, notes);
  markTrialCell(trial, 0);
  grid[0] = 4;
  startTrial(trial, 2, grid, notes);
  markTrialCell(trial, 10);
  grid[10] = 7;
  pauseTrial(trial);
  const restored = createTrialState(snapshotTrialState(trial));
  assert.deepEqual(trialCounts(restored), { 1: 1, 2: 1 });
  assert.equal(restored.active, 0);
  assert.equal(restored.focus, 2);
  assert.equal(hasTrialChanges(restored), true);
});

test('clearing trials restores the exact pre-trial grid and notes', () => {
  const grid = Array(81).fill(0);
  grid[3] = 6;
  const notes = Array.from({ length: 81 }, () => new Set());
  notes[0] = new Set([1, 2, 5]);
  notes[8] = new Set([5, 9]);
  const trial = createTrialState();
  startTrial(trial, 1, grid, notes);
  markTrialCell(trial, 0);
  grid[0] = 5;
  notes[0].clear();
  notes[8].delete(5);
  startTrial(trial, 2, grid, notes);
  markTrialCell(trial, 0);
  grid[0] = 9;
  clearTrials(trial, grid, notes);
  assert.equal(grid[0], 0);
  assert.equal(grid[3], 6);
  assert.deepEqual([...notes[0]], [1, 2, 5]);
  assert.deepEqual([...notes[8]], [5, 9]);
  assert.equal(hasTrialChanges(trial), false);
  assert.equal(trial.baseline, null);
});

test('confirming trials keeps entries and rejects a third color', () => {
  const grid = Array(81).fill(0);
  const notes = Array.from({ length: 81 }, () => new Set());
  const trial = createTrialState();
  startTrial(trial, 1, grid, notes);
  markTrialCell(trial, 4);
  grid[4] = 8;
  assert.throws(() => startTrial(trial, 3, grid, notes), RangeError);
  confirmTrials(trial);
  assert.equal(grid[4], 8);
  assert.equal(hasTrialChanges(trial), false);
  assert.equal(trial.active, 0);
});

test('trial errors use board conflicts instead of comparing the solution', () => {
  const solution = solveGrid(classic);
  const index = classic.findIndex((value) => value === 0);
  const wrongButLegal = candidatesFor(classic, index).find((digit) => digit !== solution[index]);
  assert.ok(wrongButLegal, 'fixture should have a legal candidate different from the solution');

  const grid = [...classic];
  const notes = Array.from({ length: 81 }, () => new Set());
  const trial = createTrialState();
  startTrial(trial, 1, grid, notes);
  markTrialCell(trial, index);
  grid[index] = wrongButLegal;

  assert.deepEqual(getWrongEntries(grid, solution), [index]);
  assert.deepEqual(validateGrid(grid).conflicts, []);
  assert.deepEqual(trialConflictIndices(trial, validateGrid(grid).conflicts), []);

  const peer = [...PEERS[index]].find((peerIndex) => grid[peerIndex]);
  assert.ok(Number.isInteger(peer));
  grid[index] = grid[peer];
  assert.deepEqual(trialConflictIndices(trial, validateGrid(grid).conflicts), [index]);
});

test('five-stage curriculum contains 30 ordered levels and 300 verified puzzles', () => {
  assert.equal(LEVEL_STAGES.length, 5);
  assert.equal(LEVELS.length, 30);
  assert.equal(TOTAL_LEVEL_PUZZLES, 300);
  assert.deepEqual(LEVEL_STAGES.map((stage) => LEVELS.filter((level) => level.stage === stage.number).length), [6, 6, 6, 6, 6]);

  const puzzleIds = new Set();
  const puzzleGrids = new Set();
  let previousBlanks = 0;
  for (const level of LEVELS) {
    if (level.level > 1) assert.equal(level.blanks, previousBlanks + 1, `Lv.${level.level} must add exactly one blank`);
    previousBlanks = level.blanks;
    assert.equal(level.questionCount, 10);
    for (let question = 1; question <= level.questionCount; question += 1) {
      const record = getLevelPuzzle(level.level, question);
      const report = analyzePuzzle(record.puzzle);
      const hardest = report.steps.reduce((result, step) => TECHNIQUE_RANKS[step.strategy] > TECHNIQUE_RANKS[result] ? step.strategy : result, 'fullHouse');
      assert.equal(record.puzzle.filter((value) => !value).length, level.blanks, record.id);
      assert.equal(report.unique, true, record.id);
      assert.equal(isSolved(record.solution), true, record.id);
      assert.equal(hardest, level.focusTechnique, record.id);
      assert.ok(TECHNIQUE_RANKS[hardest] >= level.minRank && TECHNIQUE_RANKS[hardest] <= level.maxRank, record.id);
      puzzleIds.add(record.id);
      puzzleGrids.add(serializeGrid(record.puzzle));
    }
  }
  assert.equal(puzzleIds.size, 300);
  assert.equal(puzzleGrids.size, 300);
});

test('300-stage challenge supports both sequential progress and performance-based fast unlocks', () => {
  assert.equal(TOTAL_CHALLENGES, 300);
  assert.equal(LEVEL_TIME_LIMITS_MINUTES.length, 30);
  assert.deepEqual(LEVEL_TIME_LIMITS_MINUTES.slice(0, 3), [6, 7, 8]);
  assert.deepEqual(LEVEL_TIME_LIMITS_MINUTES.slice(-3), [36, 38, 40]);
  assert.equal(getLevelTimeLimitSeconds(1), 360);
  assert.equal(getLevelTimeLimitSeconds(30), 2400);
  assert.equal(getLevelFastTrackSeconds(1), 180);
  assert.equal(getLevelFastTrackSeconds(2), 210);
  assert.deepEqual(evaluateLevelQualification(1, 180), {
    level: 1,
    checkpoint: false,
    route: 'fast-track',
    qualified: true,
    targetSeconds: 180,
    standardTargetSeconds: 360,
    fastTrackSeconds: 180
  });
  assert.equal(evaluateLevelQualification(1, 181).qualified, false);
  assert.equal(evaluateLevelQualification(10, 360).qualified, true);
  assert.equal(evaluateLevelQualification(10, 361).qualified, false);
  assert.equal(isLevelCheckpoint(10), true);
  assert.equal(isLevelCheckpoint(11), false);
  for (let number = 1; number <= TOTAL_CHALLENGES; number += 1) {
    const record = getChallenge(number);
    assert.equal(record.challengeNumber, number);
    assert.equal(challengeNumberFor(record.level, record.question), number);
    assert.equal(challengeIdFor(number), record.id);
    assert.equal(challengeNumberFromId(record.id), number);
  }

  const completed = new Set();
  const qualified = new Set();
  assert.equal(getNextChallengeNumber(completed), 1);
  assert.equal(isChallengeUnlocked(1, completed, qualified), true);
  assert.equal(isChallengeUnlocked(2, completed, qualified), false);
  completed.add(challengeIdFor(1));
  assert.equal(getNextChallengeNumber(completed, qualified), 2);
  assert.equal(isChallengeUnlocked(1, completed, qualified), true);
  assert.equal(isChallengeUnlocked(2, completed, qualified), true);
  assert.equal(isChallengeUnlocked(3, completed, qualified), false);
  const fastQualified = new Set([1]);
  assert.equal(getNextChallengeNumber(completed, fastQualified), 2);
  assert.equal(isChallengeUnlocked(11, completed, fastQualified), true);
  assert.equal(isChallengeUnlocked(12, completed, fastQualified), false);
  for (let number = 2; number <= 10; number += 1) completed.add(challengeIdFor(number));
  assert.equal(getNextChallengeNumber(completed, qualified), 10);
  assert.equal(isChallengeUnlocked(10, completed, qualified), true);
  assert.equal(isChallengeUnlocked(11, completed, qualified), false);
  qualified.add(1);
  assert.equal(getNextChallengeNumber(completed, qualified), 11);
  assert.equal(isChallengeUnlocked(11, completed, qualified), true);
  assert.equal(isChallengeUnlocked(12, completed, qualified), false);
  for (let number = 11; number <= TOTAL_CHALLENGES; number += 1) completed.add(challengeIdFor(number));
  for (let level = 2; level < LEVELS.length; level += 1) qualified.add(level);
  assert.equal(getNextChallengeNumber(completed, qualified), null);
  assert.equal(isChallengeUnlocked(300, completed, qualified), true);
});
