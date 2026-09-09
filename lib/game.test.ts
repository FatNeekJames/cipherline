import test from 'node:test';
import assert from 'node:assert/strict';
import { activeCells, completedTargets, containsSequence, generatePuzzle, scoreAttempt, validatePuzzle } from './game.ts';

test('finds contiguous and overlapping sequences', () => {
  const buffer = ['A7', 'K2', 'FF'];
  assert.equal(containsSequence(buffer, ['A7', 'K2']), true);
  assert.equal(containsSequence(buffer, ['K2', 'FF']), true);
  assert.deepEqual(completedTargets(buffer, [
    { id: 'A', codes: ['A7', 'K2'], reward: 100 },
    { id: 'B', codes: ['K2', 'FF'], reward: 100 },
  ]), ['A', 'B']);
});

test('alternates the active axis and prevents tile reuse', () => {
  assert.equal(activeCells([]).every((cell) => cell.row === 0), true);
  const afterOne = activeCells([{ row: 0, col: 2 }]);
  assert.equal(afterOne.every((cell) => cell.col === 2), true);
  assert.equal(afterOne.some((cell) => cell.row === 0), false);
  const afterTwo = activeCells([{ row: 0, col: 2 }, { row: 3, col: 2 }]);
  assert.equal(afterTwo.every((cell) => cell.row === 3), true);
});

test('supports larger matrices and excludes ICE-locked cells', () => {
  const cells = activeCells([], 7, [{ row: 0, col: 3 }]);
  assert.equal(cells.length, 6);
  assert.equal(cells.every((cell) => cell.row === 0), true);
  assert.equal(cells.some((cell) => cell.col === 3), false);
});

test('all thirty campaign puzzles are valid and perfectly solvable', () => {
  for (let level = 1; level <= 30; level += 1) assert.equal(validatePuzzle(generatePuzzle(level)), true);
});

test('campaign difficulty escalates across all five network tiers', () => {
  assert.deepEqual([1, 7, 13, 19, 25].map((level) => generatePuzzle(level).size), [5, 6, 7, 8, 9]);
  assert.equal(generatePuzzle(13).blocked.length > 0, true);
  assert.equal(generatePuzzle(19).instantTrace, true);
  assert.equal(generatePuzzle(25).selectionCost, 0.6);
  assert.equal(generatePuzzle(25).targets.length, 4);
  for (const level of [13, 19, 25, 30]) {
    const puzzle = generatePuzzle(level);
    assert.equal(puzzle.blocked.some((blocked) => puzzle.solution.some((cell) => cell.row === blocked.row && cell.col === blocked.col)), false);
  }
});

test('scoring rewards success and penalizes hints', () => {
  assert.equal(scoreAttempt(0, 3, 10, 2, false, 0), 0);
  assert.ok(scoreAttempt(3, 3, 10, 2, false, 2) > scoreAttempt(2, 3, 10, 2, false, 2));
  assert.ok(scoreAttempt(3, 3, 10, 2, false, 2) > scoreAttempt(3, 3, 10, 2, true, 2));
});
