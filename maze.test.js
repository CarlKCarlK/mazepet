const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateMaze, solveMaze, solutionPoints, roomPoint, createTrace, toUnicode } = require('./maze.js');

test('short taps ahead follow corridor bends and taps behind erase the route', () => {
  let seed = 123;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const maze = generateMaze(10, 10, random), trace = createTrace(maze), path = solveMaze(maze);
  const target = path[5];
  assert(trace.jump(roomPoint(maze, target)));
  assert.deepEqual(trace.path, path.slice(0, 6));
  assert(trace.jump(roomPoint(maze, maze.entrance)));
  assert.deepEqual(trace.path, [maze.entrance]);
  assert.equal(trace.jump([100, 100]), false);
  assert.equal(trace.jump(roomPoint(maze, path.at(-1))), false, 'do not solve the maze with a distant tap');
});

test('jumps reject walls, disconnected rooms, and two possible local routes', () => {
  const blocked = { width: 1, height: 1, tiles: ['/'], removed: new Set(),
    entrance: 0, exit: 1, passages: [] };
  const trace = createTrace(blocked);
  assert.equal(trace.jump([0.5, 0.5]), false, 'tap on a wall is ambiguous');
  assert.equal(trace.jump(roomPoint(blocked, 1)), false, 'cannot jump through a wall');
  assert.deepEqual(trace.path, [0]);
  const loop = { width: 2, height: 2, tiles: ['/', '/', '/', '/'], removed: new Set([0, 1, 2, 3]),
    entrance: 1, exit: 7, passages: [[0, 1], [2, 3], [4, 5], [6, 7], [1, 2], [5, 6], [1, 4], [3, 6]] };
  const loopTrace = createTrace(loop);
  assert.equal(loopTrace.jump(roomPoint(loop, 3)), false, 'do not choose either way around a loop');
  assert.deepEqual(loopTrace.path, [1]);
});

test('tracing follows passages to completion and erases steps when retraced', () => {
  let seed = 55;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (const [w, h] of [[1, 1], [1, 10], [10, 1], [10, 10]]) {
    const maze = generateMaze(w, h, random), trace = createTrace(maze);
    const path = solveMaze(maze);
    assert.equal(trace.complete, false);
    for (const room of path.slice(1)) trace.advance(roomPoint(maze, room));
    assert.deepEqual(trace.path, path);
    assert.equal(trace.complete, true);
    for (const room of path.slice(0, -1).reverse()) trace.advance(roomPoint(maze, room));
    assert.deepEqual(trace.path, [maze.entrance]);
    assert.equal(trace.complete, false);
    const points = solutionPoints(maze, trace.path, false);
    assert.deepEqual(points.at(-1), roomPoint(maze, maze.entrance));
  }
});

test('tracing pauses at ambiguous forks and accepts a chosen dead end', () => {
  // Room 1 opens left to 2 and right to 4; room 0 is behind it.
  const maze = { width: 3, height: 1, tiles: ['/', '/', '\\'], removed: new Set([0]),
    entrance: 1, exit: 5, passages: [[1, 0], [1, 2], [1, 4]] };
  const trace = createTrace(maze);
  const a = roomPoint(maze, 2), b = roomPoint(maze, 4);
  trace.advance([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  assert.deepEqual(trace.path, [1], 'do not choose between equally near branches');
  trace.advance(a);
  assert.deepEqual(trace.path, [1, 2], 'allow a dead end instead of picking a solution');
  trace.advance(roomPoint(maze, 1));
  assert.deepEqual(trace.path, [1]);
  trace.advance([100, 100]);
  assert.deepEqual(trace.path, [1], 'distant gestures do not pull the route forward');
});

test('tracing never crosses a diagonal to an unconnected nearby room', () => {
  const maze = { width: 1, height: 1, tiles: ['/'], removed: new Set(),
    entrance: 0, exit: 1, passages: [] };
  const trace = createTrace(maze);
  trace.advance(roomPoint(maze, 1));
  assert.deepEqual(trace.path, [0]);
  assert.equal(trace.complete, false);
});

test('diagonal-only repairs connect all rooms, including narrow and single-tile mazes', () => {
  let state = 12345;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (const [w, h] of [[1, 1], [1, 20], [20, 1], [2, 2], [40, 25], [201, 201]]) {
    const maze = generateMaze(w, h, random);
    const nodes = 2 * w * h;
    assert(maze.passages.length >= nodes - 1);
    const neighbors = Array.from({ length: nodes }, () => []);
    for (const [a, b] of maze.passages) { neighbors[a].push(b); neighbors[b].push(a); }
    const visited = new Set([maze.entrance]);
    const queue = [maze.entrance];
    for (let i = 0; i < queue.length; i++) for (const next of neighbors[queue[i]]) {
      if (!visited.has(next)) { visited.add(next); queue.push(next); }
    }
    assert.equal(visited.size, nodes);
    assert(visited.has(maze.exit));
    const path = solveMaze(maze);
    assert.equal(path[0], maze.entrance);
    assert.equal(path[path.length - 1], maze.exit);
    assert.equal(new Set(path).size, path.length);
    for (let i = 1; i < path.length; i++) assert(neighbors[path[i - 1]].includes(path[i]));
    assert.equal(maze.passages.length,
      h * (w - 1) + w * (h - 1) + maze.removed.size);
    const text = toUnicode(maze).split('\n');
    assert.equal(text.length, 2 * h + 1);
    assert(text.every(line => line.length === 2 * w + 1));
    assert.equal(text[1][0], ' ');
    assert.equal(text[2 * h - 1][2 * w], ' ');
    for (const line of text.slice(1, -1)) {
      assert(!/[─│]/u.test(line.slice(1, -1)), 'no straight interior walls');
    }
  }
});

test('rejects invalid sizes', () => {
  for (const value of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => generateMaze(value, 10));
  }
});

test('attaches an original wall island instead of deleting its diagonals', () => {
  function randomFrom(seed) {
    return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  }
  const originalRandom = randomFrom(10);
  const original = Array.from({ length: 36 }, () => originalRandom() < 0.5 ? '/' : '\\');
  const maze = generateMaze(6, 6, randomFrom(10));
  // In this starting picture, tiles 16 and 21 form a two-wall island.
  // The delete-islands version changed 14 tiles and lost one of these walls.
  // Both original island walls can survive when attached through open tiles.
  for (const i of [16, 21]) {
    assert(!maze.removed.has(i));
    assert.equal(maze.tiles[i], original[i]);
  }
  const edits = maze.tiles.reduce((n, tile, i) => n + Number(maze.removed.has(i) || tile !== original[i]), 0);
  assert(edits <= 13, `expected fewer than the former 14 edits, got ${edits}`);
});

test('centered solutions use grid-aligned segments and never cross diagonal walls', () => {
  let seed = 937;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let sample = 0; sample < 60; sample++) {
    const maze = generateMaze(10, 10, random);
    const points = solutionPoints(maze);
    assert.deepEqual(points[0], [0, 0.5]);
    assert.deepEqual(points[points.length - 1], [10, 9.5]);
    for (let step = 1; step < points.length; step++) {
      const a = points[step - 1], b = points[step];
      const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]);
      assert(dx === 0 || dy === 0 || dx === dy, 'keep centered horizontal, vertical, or 45-degree segments');
      maze.tiles.forEach((tile, i) => {
        if (maze.removed.has(i)) return;
        const x = i % 10, y = Math.floor(i / 10);
        const [c, d] = tile === '/' ? [[x, y + 1], [x + 1, y]] : [[x, y], [x + 1, y + 1]];
        const intersects = cross(a, b, c) * cross(a, b, d) < -1e-10
          && cross(c, d, a) * cross(c, d, b) < -1e-10;
        assert(!intersects, `solution crosses wall ${i} in sample ${sample}`);
      });
    }
  }
  const single = generateMaze(1, 1, random);
  assert.deepEqual(solutionPoints(single), [[0, 0.5], [1, 0.5]]);
});

test('walls have no islands and open tiles cannot accept a connected, safe diagonal', () => {
  // Reconstruct room connectivity independently of the generator's wall graph.
  function connected(maze, candidate, tile) {
    const { width: w, height: h, removed } = maze;
    const tiles = maze.tiles.slice();
    if (candidate !== undefined) tiles[candidate] = tile;
    const neighbors = Array.from({ length: 2 * w * h }, () => []);
    function link(a, b) { neighbors[a].push(b); neighbors[b].push(a); }
    const left = i => 2 * i + (tiles[i] === '/' ? 0 : 1);
    const right = i => 2 * i + (tiles[i] === '/' ? 1 : 0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x + 1 < w) link(right(i), left(i + 1));
      if (y + 1 < h) link(2 * i + 1, 2 * (i + w));
      if (removed.has(i) && i !== candidate) link(2 * i, 2 * i + 1);
    }
    const seen = new Set([0]), queue = [0];
    for (let i = 0; i < queue.length; i++) for (const n of neighbors[queue[i]]) {
      if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
    return seen.size === neighbors.length;
  }
  let seed = 42;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let sample = 0; sample < 30; sample++) {
    const maze = generateMaze(10, 10, random);
    assert(connected(maze), 'final geometry stays connected');
    const w = maze.width, h = maze.height;
    const point = (x, y) => y * (w + 1) + x;
    const ends = (i, tile) => {
      const x = i % w, y = Math.floor(i / w);
      return tile === '/' ? [point(x, y + 1), point(x + 1, y)]
        : [point(x, y), point(x + 1, y + 1)];
    };
    const neighbors = Array.from({ length: (w + 1) * (h + 1) }, () => []);
    maze.tiles.forEach((tile, i) => {
      if (maze.removed.has(i)) return;
      const [a, b] = ends(i, tile);
      neighbors[a].push(b); neighbors[b].push(a);
    });
    const reached = new Set();
    for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
      if (x === 0 || y === 0 || x === w || y === h) reached.add(point(x, y));
    }
    const queue = [...reached];
    for (let i = 0; i < queue.length; i++) for (const next of neighbors[queue[i]]) {
      if (!reached.has(next)) { reached.add(next); queue.push(next); }
    }
    maze.tiles.forEach((tile, i) => {
      if (!maze.removed.has(i)) assert(ends(i, tile).every(p => reached.has(p)), 'every wall reaches the border');
    });
    for (const i of maze.removed) for (const tile of ['/', '\\']) {
      if (ends(i, tile).some(p => reached.has(p))) {
        assert(!connected(maze, i, tile), `tile ${i} could still be filled with ${tile}`);
      }
    }
  }
});
