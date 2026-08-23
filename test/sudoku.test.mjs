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
import { ALL_LESSONS, DETECTABLE_LESSONS, JOURNEY_STAGES } from '../src/learning/curriculum.js';
import { TECHNIQUE_DRILLS } from '../src/learning/drills.js';

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
