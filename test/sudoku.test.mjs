import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePuzzle,
  candidatesFor,
  countSolutions,
  generatePuzzle,
  generateSolution,
  isSolved,
  nextHint,
  parsePuzzle,
  serializeGrid,
  solveGrid,
  validateGrid
} from '../src/core/sudoku.js';

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
