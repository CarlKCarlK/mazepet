'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const State = require('./maze-state');
const { generateMaze } = require('./maze');
const defaults = { width: 25, height: 20 };
const seed = () => '00000000';

test('seeded random and maze output remain compatible with released links', () => {
  const random = State.seededRandom('8ac31f02');
  assert.deepEqual(Array.from({ length: 4 }, random), [0.83640456199646, 0.3487091907300055, 0.9597787072416395, 0.9395653766114265]);
  const maze = generateMaze(25, 20, State.seededRandom('8ac31f02'));
  const snapshot = { tiles: maze.tiles, original: maze.originalTiles, removed: [...maze.removed], passages: maze.passages };
  assert.equal(createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'), 'c5f261fb9bb41198931769d817f31c87d29c94fe692ed91c15566fec3e823e16');
  assert.equal(State.seededRandom('00000000')(), State.seededRandom('00000000')());
  assert.throws(() => State.seededRandom('oops'));
});

test('URL round trips preserve the layout, mode, zero seed, unrelated parameters and fragment', () => {
  const state = { width: 40, height: 25, mode: 'petscii', seed: '00000000' };
  const url = new URL(State.toURL('https://example.com/mazepet/v1.0.0/?ref=friend#maze', state));
  assert.equal(url.pathname, '/mazepet/v1.0.0/');
  assert.equal(url.hash, '#maze');
  assert.equal(url.searchParams.get('ref'), 'friend');
  assert.deepEqual(State.parse(url.search, defaults, seed), state);
});

test('missing and malformed URL values use defaults without imposing size caps', () => {
  assert.deepEqual(State.parse('', defaults, seed), { ...defaults, mode: 'fixed', seed: seed() });
  for (const value of ['-1', '0', '1.5', 'Infinity', '1e2', '9007199254740992', 'abc']) {
    assert.equal(State.parse(`?w=${value}&h=20`, defaults, seed).width, 25);
  }
  assert.deepEqual(State.parse('?w=250&h=50&mode=unknown&seed=oops', defaults, seed), { width: 250, height: 50, mode: 'fixed', seed: seed() });
  assert.deepEqual(State.parse('?w=200&h=50&mode=petscii&seed=ABCDEF01', defaults, seed), { width: 200, height: 50, mode: 'petscii', seed: 'abcdef01' });
  assert.equal(State.parse('?w=40&h=25', { width: 12, height: 15 }, seed).width, 40);
  assert.equal(State.validDimensions(1000, 1000), true);
  assert.equal(State.validDimensions(Number.MAX_SAFE_INTEGER, 2), false);
});
