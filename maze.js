/* Works both in a browser and with Node.js; no dependencies. */
(function (root) {
  'use strict';

  function generateMaze(width, height, random = Math.random) {
    if (![width, height].every(n => Number.isSafeInteger(n) && n >= 1)) {
      throw new Error('Width and height must be positive integers.');
    }
    const count = width * height;
    const tiles = Array.from({ length: count }, () => random() < 0.5 ? '/' : '\\');
    const parent = Array.from({ length: 2 * count }, (_, i) => i);
    const rank = new Uint8Array(2 * count);
    const find = n => {
      while (parent[n] !== n) {
        parent[n] = parent[parent[n]];
        n = parent[n];
      }
      return n;
    };
    function join(a, b) {
      a = find(a); b = find(b);
      if (a === b) return false;
      if (rank[a] < rank[b]) [a, b] = [b, a];
      parent[b] = a;
      if (rank[a] === rank[b]) rank[a]++;
      return true;
    }
    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
    // Each tile has two triangular rooms: 0 touches top, 1 touches bottom.
    function room(i, side) {
      if (side === 'top') return 2 * i;
      if (side === 'bottom') return 2 * i + 1;
      const left = tiles[i] === '/' ? 0 : 1;
      return 2 * i + (side === 'left' ? left : 1 - left);
    }
    const boundaries = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (x + 1 < width) boundaries.push({
          a: room(i, 'right'), b: room(i + 1, 'left'),
          x1: x + 1, y1: y, x2: x + 1, y2: y + 1,
        });
        if (y + 1 < height) boundaries.push({
          a: room(i, 'bottom'), b: room(i + width, 'top'),
          x1: x, y1: y + 1, x2: x + 1, y2: y + 1,
        });
      }
    }
    // Keep every passage between tiles, including those that form loops.
    for (const edge of boundaries) {
      join(edge.a, edge.b);
    }
    const removed = new Set();
    // Remove just enough diagonals to connect all the existing regions.
    for (const i of shuffle(Array.from({ length: count }, (_, i) => i))) {
      if (join(2 * i, 2 * i + 1)) {
        removed.add(i);
      }
    }

    // Fill wide halls with either diagonal whenever it won't cut off a room.
    // In the planar wall graph, a new edge separates rooms exactly when its
    // endpoints are already connected. Wire the perimeter together to detect
    // walls that would split the maze from one boundary to another as well.
    const wallParent = Array.from({ length: (width + 1) * (height + 1) }, (_, i) => i);
    function wallRoot(n) {
      while (wallParent[n] !== n) {
        wallParent[n] = wallParent[wallParent[n]];
        n = wallParent[n];
      }
      return n;
    }
    function joinWall(a, b) {
      a = wallRoot(a); b = wallRoot(b);
      if (a === b) return false;
      wallParent[b] = a;
      return true;
    }
    const corner = (x, y) => y * (width + 1) + x;
    function ends(i, tile) {
      const x = i % width, y = Math.floor(i / width);
      return tile === '/' ? [corner(x, y + 1), corner(x + 1, y)]
        : [corner(x, y), corner(x + 1, y + 1)];
    }
    function buildWalls() {
      for (let i = 0; i < wallParent.length; i++) wallParent[i] = i;
      for (let x = 0; x <= width; x++) {
        joinWall(0, corner(x, 0)); joinWall(0, corner(x, height));
      }
      for (let y = 0; y <= height; y++) {
        joinWall(0, corner(0, y)); joinWall(0, corner(width, y));
      }
      tiles.forEach((tile, i) => {
        if (!removed.has(i)) joinWall(...ends(i, tile));
      });
    }
    buildWalls();
    // Detached wall trees can be walked around. Remove them before growing
    // new walls exclusively from the border-connected wall network.
    tiles.forEach((tile, i) => {
      if (!removed.has(i) && wallRoot(ends(i, tile)[0]) !== wallRoot(0)) removed.add(i);
    });
    buildWalls();
    let added;
    do {
      added = false;
      for (const i of shuffle([...removed])) {
        for (const tile of [tiles[i], tiles[i] === '/' ? '\\' : '/']) {
          const [a, b] = ends(i, tile);
          const border = wallRoot(0);
          if (wallRoot(a) !== border && wallRoot(b) !== border) continue;
          if (joinWall(a, b)) {
            tiles[i] = tile;
            removed.delete(i);
            added = true;
            break;
          }
        }
      }
    } while (added);

    // A flipped tile changes which triangular room touches each side.
    const passages = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x + 1 < width) passages.push([room(i, 'right'), room(i + 1, 'left')]);
      if (y + 1 < height) passages.push([room(i, 'bottom'), room(i + width, 'top')]);
      if (removed.has(i)) passages.push([2 * i, 2 * i + 1]);
    }
    return { width, height, tiles, removed, passages,
      entrance: room(0, 'left'), exit: room(count - 1, 'right') };
  }

  function solveMaze(maze) {
    const neighbors = Array.from({ length: 2 * maze.width * maze.height }, () => []);
    for (const [a, b] of maze.passages) {
      neighbors[a].push(b); neighbors[b].push(a);
    }
    const previous = new Int32Array(neighbors.length).fill(-1);
    previous[maze.entrance] = maze.entrance;
    const queue = [maze.entrance];
    for (let i = 0; i < queue.length && previous[maze.exit] === -1; i++) {
      for (const next of neighbors[queue[i]]) {
        if (previous[next] !== -1) continue;
        previous[next] = queue[i];
        queue.push(next);
      }
    }
    if (previous[maze.exit] === -1) return [];
    const path = [maze.exit];
    while (path[path.length - 1] !== maze.entrance) path.push(previous[path[path.length - 1]]);
    return path.reverse();
  }

  // Keep the route centered; remove only short, wall-free grid-aligned jogs.
  function solutionPoints(maze, path = solveMaze(maze)) {
    if (!path.length) return [];
    const points = [[0, 0.5]];
    for (let step = 1; step < path.length; step++) {
      const a = Math.floor(path[step - 1] / 2), b = Math.floor(path[step] / 2);
      const x = a % maze.width, y = Math.floor(a / maze.width);
      const bx = b % maze.width, by = Math.floor(b / maze.width);
      if (a === b) points.push([x + 0.5, y + 0.5]);
      else if (y === by) points.push([Math.max(x, bx), y + 0.5]);
      else points.push([x + 0.5, Math.max(y, by)]);
    }
    points.push([maze.width, maze.height - 0.5]);
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    function clear(a, b) {
      // Include touching a wall tip as a collision, not just crossing a wall.
      for (let y = Math.max(0, Math.floor(Math.min(a[1], b[1])) - 1);
        y <= Math.min(maze.height - 1, Math.floor(Math.max(a[1], b[1]))); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(a[0], b[0])) - 1);
          x <= Math.min(maze.width - 1, Math.floor(Math.max(a[0], b[0]))); x++) {
          const i = y * maze.width + x;
          if (maze.removed.has(i)) continue;
          const [c, d] = maze.tiles[i] === '/' ? [[x, y + 1], [x + 1, y]]
            : [[x, y], [x + 1, y + 1]];
          if (Math.max(a[0], b[0]) < x || Math.min(a[0], b[0]) > x + 1
            || Math.max(a[1], b[1]) < y || Math.min(a[1], b[1]) > y + 1) continue;
          if (cross(a, b, c) * cross(a, b, d) <= 0
            && cross(c, d, a) * cross(c, d, b) <= 0) return false;
        }
      }
      return true;
    }
    const result = [points[0]];
    for (let i = 0; i < points.length - 1;) {
      let next = i + 1;
      // A small window removes local bumps without redrawing entire corridors.
      for (let j = Math.min(points.length - 1, i + 6); j > i + 1; j--) {
        const dx = Math.abs(points[j][0] - points[i][0]);
        const dy = Math.abs(points[j][1] - points[i][1]);
        if (Math.max(dx, dy) > 2 || (dx !== 0 && dy !== 0 && dx !== dy)) continue;
        if (clear(points[i], points[j])) { next = j; break; }
      }
      result.push(points[next]);
      i = next;
    }
    return result;
  }

  // A text schematic: dots mark tile corners; characters between them are walls.
  function toUnicode(maze) {
    const { width: w, height: h, tiles, removed } = maze;
    const grid = Array.from({ length: 2 * h + 1 }, () => Array(2 * w + 1).fill(' '));
    for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) grid[2 * y][2 * x] = '·';
    for (let x = 0; x < w; x++) grid[0][2 * x + 1] = grid[2 * h][2 * x + 1] = '─';
    for (let y = 0; y < h; y++) {
      if (y !== 0) grid[2 * y + 1][0] = '│';
      if (y !== h - 1) grid[2 * y + 1][2 * w] = '│';
    }
    tiles.forEach((tile, i) => {
      if (!removed.has(i)) grid[2 * Math.floor(i / w) + 1][2 * (i % w) + 1] = tile === '/' ? '╱' : '╲';
    });
    return grid.map(row => row.join('')).join('\n');
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateMaze, solveMaze, solutionPoints, toUnicode };
    if (require.main === module) {
      try {
        const maze = generateMaze(Number(process.argv[2] ?? 30), Number(process.argv[3] ?? 15));
        console.log(toUnicode(maze));
      } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
      }
    }
  } else root.Maze = { generateMaze, solveMaze, solutionPoints, toUnicode };
})(typeof globalThis === 'undefined' ? this : globalThis);
