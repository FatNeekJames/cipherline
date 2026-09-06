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

test('all thirty campaign puzzles are valid and perfectly solvable', () => {
  for (let level = 1; level <= 30; level += 1) assert.equal(validatePuzzle(generatePuzzle(level)), true);
});

test('scoring rewards success and penalizes hints', () => {
  assert.equal(scoreAttempt(0, 3, 10, 2, false, 0), 0);
  assert.ok(scoreAttempt(3, 3, 10, 2, false, 2) > scoreAttempt(2, 3, 10, 2, false, 2));
  assert.ok(scoreAttempt(3, 3, 10, 2, false, 2) > scoreAttempt(3, 3, 10, 2, true, 2));
});
