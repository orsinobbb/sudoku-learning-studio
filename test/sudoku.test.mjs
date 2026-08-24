import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePuzzle,
  candidatesFor,
  countSolutions,
  generatePuzzle,
  generateSolution,
  getCompletedDigits,
  isSolved,
  nextHint,
  parsePuzzle,
  serializeGrid,
  solveGrid,
  validateGrid
} from '../src/core/sudoku.js';
import { ALL_LESSONS, DETECTABLE_LESSONS, JOURNEY_STAGES, TARGETED_LESSONS } from '../src/learning/curriculum.js';
import { TECHNIQUE_DRILLS } from '../src/learning/drills.js';
import { evaluateTechniqueAnswer, getTechniqueQuestions } from '../src/learning/assessments.js';
import { MANUAL_ASSESSMENT_TECHNIQUES } from '../src/learning/manual-assessments.js';
import { TUTORIALS } from '../src/learning/tutorials.js';
import { PROGRESS_KEY, SESSION_KEY, readProgress, readSession, writeProgress, writeSession } from '../src/learning/storage.js';

const classic = parsePuzzle('530070000600195000098000060800060003400803001700020006060000280000419005000080079');

test('parses and serializes 81-cell puzzle formats', () => {
  const dotted = '53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79';
  assert.deepEqual(parsePuzzle(dotted), classic);
  assert.equal(serializeGrid(classic).length, 81);
  assert.throws(() => parsePuzzle('123'), /81 格/);
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
  const analysis = analyzePuzzle(puzzle);
  assert.ok(analysis.techniqueCounts.hiddenPair >= 1);
  assert.ok(analysis.techniqueCounts.xWing >= 1);
  assert.ok(analysis.techniqueCounts.search >= 1);
  assert.equal(analysis.logicalOnly, false);
});

test('learning journey is complete, ordered and linked to detector coverage', () => {
  assert.equal(JOURNEY_STAGES.length, 6);
  assert.equal(ALL_LESSONS.length, 34);
  assert.equal(DETECTABLE_LESSONS.length, 15);
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
  assert.equal(TECHNIQUE_DRILLS.length, DETECTABLE_LESSONS.length);
  assert.equal(new Set(TECHNIQUE_DRILLS.map(({ technique }) => technique)).size, TECHNIQUE_DRILLS.length);
  for (const drill of TECHNIQUE_DRILLS) {
    const lesson = DETECTABLE_LESSONS.find(({ analyzer }) => analyzer === drill.technique);
    const analysis = analyzePuzzle(parsePuzzle(drill.puzzle));
    assert.ok(lesson, `${drill.technique} should map to a detectable lesson`);
    assert.equal(analysis.valid && analysis.unique, true, `${drill.technique} drill should have one solution`);
    assert.ok(analysis.techniqueCounts[drill.technique] >= 1, `${drill.technique} should occur in its drill`);
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
        assert.equal(question.board.filter(Boolean).length, 30, `${technique} should show 30 mid-game givens`);
        const unitCounts = Array.from({ length: 27 }, () => 0);
        question.board.forEach((digit, index) => {
          if (!digit) return;
          const row = Math.floor(index / 9);
          const col = index % 9;
          const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
          unitCounts[row] += 1;
          unitCounts[9 + col] += 1;
          unitCounts[18 + box] += 1;
        });
        assert.ok(unitCounts.every((count) => count >= 2 && count <= 5), `${technique} givens should be balanced across every row, column, and box`);
        assert.match(question.variantLabel, /中盤技巧局面 · 30 個盤面數字/);
        assert.match(question.instruction, /只顯示本題相關候選/);
        assert.equal(validateGrid(question.board).valid, true, `${technique} givens should be valid`);
        assert.equal(isSolved(question.solution), true, `${technique} should retain a compatible solution`);
        question.board.forEach((digit, index) => {
          if (digit) assert.equal(digit, question.solution[index], `${technique} given at ${index} should match its solution`);
        });
        question.answers.forEach(({ index, digit }) => {
          assert.equal(question.kind === 'placement' ? question.solution[index] === digit : question.solution[index] !== digit, true);
        });
        question.candidates.forEach((digits, index) => {
          for (const digit of digits) {
            assert.ok(candidatesFor(question.board, index).includes(digit), `${technique} candidate ${digit} at ${index} should be legal`);
          }
        });
      }
    }
  }
});

test('progress migrates and puzzle sessions round-trip through browser storage', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  values.set(PROGRESS_KEY, JSON.stringify({ version: 3, solvedCount: 2, completedLessons: ['rules'] }));
  const migrated = readProgress(storage);
  assert.equal(migrated.solvedCount, 2);
  assert.deepEqual(migrated.lessonResults, {});
  writeProgress({ ...migrated, lessonResults: { rules: { knowledgePassed: true } } }, storage);
  assert.equal(JSON.parse(values.get(PROGRESS_KEY)).version, 4);
  const record = generatePuzzle({ difficulty: 'easy', seed: 'SAVE' });
  writeSession({ id: 'one', record, grid: record.puzzle, notes: Array.from({ length: 81 }, () => []), elapsed: 42 }, storage);
  assert.equal(readSession(storage).elapsed, 42);
  assert.equal(JSON.parse(values.get(SESSION_KEY)).version, 1);
});
