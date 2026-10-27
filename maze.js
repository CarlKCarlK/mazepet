/* Works both in a browser and with Node.js; no dependencies. */
(function (root) {
  'use strict';

  function generateMaze(width, height, random = Math.random) {
    if (![width, height].every(n => Number.isSafeInteger(n) && n >= 1)) {
      throw new Error('Width and height must be positive integers.');
    }
    const count = width * height;
    const tiles = Array.from({ length: count }, () => random() < 0.5 ? '/' : '\\');
    const originalTiles = tiles.slice();
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
    // Preserve islands by attaching them through empty tiles first. Search
    // the wall-component graph for short paths to the border, favoring large
    // islands when paths compete for the two orientations of the same tile.
    // Filling an already edited tile preserves more original diagonals than
    // deleting an island. This is a heuristic, not a global minimum-edit proof.
    function attachIslands() {
      let progress;
      do {
        progress = false;
        const border = wallRoot(0);
        const sizes = new Map();
        tiles.forEach((tile, i) => {
          if (removed.has(i)) return;
          const component = wallRoot(ends(i, tile)[0]);
          if (component !== border) sizes.set(component, (sizes.get(component) ?? 0) + 1);
        });
        if (!sizes.size) break;
        const adjacency = new Map();
        function add(a, b, edge) {
          if (!adjacency.has(a)) adjacency.set(a, []);
          adjacency.get(a).push({ next: b, edge });
        }
        for (const i of removed) for (const tile of [tiles[i], tiles[i] === '/' ? '\\' : '/']) {
          const [a, b] = ends(i, tile), ra = wallRoot(a), rb = wallRoot(b);
          if (ra === rb) continue;
          const edge = { i, tile, a, b };
          add(ra, rb, edge); add(rb, ra, edge);
        }
        const previous = new Map([[border, null]]), queue = [border];
        for (let head = 0; head < queue.length; head++) {
          const component = queue[head];
          for (const { next, edge } of adjacency.get(component) ?? []) {
            if (previous.has(next)) continue;
            previous.set(next, { component, edge });
            queue.push(next);
          }
        }
        const islands = [...sizes.keys()].filter(c => previous.has(c))
          .sort((a, b) => sizes.get(b) - sizes.get(a));
        for (const island of islands) {
          if (wallRoot(island) === wallRoot(0)) continue;
          const path = [];
          for (let c = island; c !== border;) {
            const step = previous.get(c);
            path.push(step.edge);
            c = step.component;
          }
          // Another island's path may already have used the opposite diagonal.
          if (path.some(e => !removed.has(e.i) && tiles[e.i] !== e.tile)) continue;
          for (const edge of path.reverse()) {
            if (!removed.has(edge.i) || !joinWall(edge.a, edge.b)) continue;
            tiles[edge.i] = edge.tile;
            removed.delete(edge.i);
            progress = true;
          }
        }
      } while (progress);
    }
    attachIslands();
    // Only islands with no available attachment are erased as a fallback.
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

    return { ...createLayout(width, height, tiles, removed), originalTiles };
  }

  // Build passages from the displayed diagonals, including flipped tiles.
  function createLayout(width, height, tiles, removed = new Set()) {
    function room(i, side) {
      if (side === 'top') return 2 * i;
      if (side === 'bottom') return 2 * i + 1;
      const left = tiles[i] === '/' ? 0 : 1;
      return 2 * i + (side === 'left' ? left : 1 - left);
    }
    const passages = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x + 1 < width) passages.push([room(i, 'right'), room(i + 1, 'left')]);
      if (y + 1 < height) passages.push([room(i, 'bottom'), room(i + width, 'top')]);
      if (removed.has(i)) passages.push([2 * i, 2 * i + 1]);
    }
    return { width, height, tiles, removed, passages,
      entrance: room(0, 'left'), exit: room(width * height - 1, 'right') };
  }

  function createOriginalMaze(maze) {
    return createLayout(maze.width, maze.height, maze.originalTiles.slice());
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

  function roomPoint(maze, room) {
    const i = Math.floor(room / 2), bottom = room % 2;
    return [i % maze.width + (maze.tiles[i] === '/' ? (bottom ? 2 / 3 : 1 / 3)
      : (bottom ? 1 / 3 : 2 / 3)), Math.floor(i / maze.width) + (bottom ? 2 / 3 : 1 / 3)];
  }

  // Interpret only nearby, connected moves. No solution knowledge is used.
  function createTrace(maze) {
    const neighbors = Array.from({ length: 2 * maze.width * maze.height }, () => []);
    for (const [a, b] of maze.passages) { neighbors[a].push(b); neighbors[b].push(a); }
    const centers = neighbors.map((_, room) => roomPoint(maze, room));
    const path = [maze.entrance];
    function visit(room) {
      const previous = path.indexOf(room);
      if (previous < 0) path.push(room);
      else path.length = previous + 1;
    }
    return {
      path,
      get complete() { return path[path.length - 1] === maze.exit; },
      jump(point) {
        const [px, py] = point, x = Math.floor(px), y = Math.floor(py);
        if (x < 0 || y < 0 || x >= maze.width || y >= maze.height) return false;
        const tile = y * maze.width + x, dx = px - x, dy = py - y;
        const side = maze.tiles[tile] === '/' ? dx + dy - 1 : dy - dx;
        // A tap on a wall doesn't clearly name either passage beside it.
        if (!maze.removed.has(tile) && Math.abs(side) / Math.SQRT2 < 0.08) return false;
        const target = 2 * tile + Number(side > 0);
        const current = path[path.length - 1];
        if (target === current) return false;
        let route = null, routes = 0;
        // Search only a few tiles around the tip, including corridor bends.
        // Accept exactly one local route, never choose a way around a loop.
        function search(rooms, length) {
          const room = rooms[rooms.length - 1];
          if (room === target) { route = rooms; routes++; return; }
          if (rooms.length > 32 || routes > 1) return;
          for (const next of neighbors[room]) {
            if (rooms.includes(next)) continue;
            const distance = length + Math.hypot(centers[next][0] - centers[room][0], centers[next][1] - centers[room][1]);
            if (distance <= 16) search([...rooms, next], distance);
            if (routes > 1) return;
          }
        }
        search([current], 0);
        if (routes !== 1) return false;
        for (const room of route.slice(1)) visit(room);
        return true;
      },
      advance(point) {
        let changed = false;
        const distance = room => Math.hypot(centers[room][0] - point[0], centers[room][1] - point[1]);
        // Distance must decrease at every step, preventing oscillation. The
        // radius prevents a far-away pointer from pulling us around the maze.
        for (let steps = 0; steps < 8; steps++) {
          const current = path[path.length - 1];
          const candidates = neighbors[current].map(room => ({ room, distance: distance(room) }))
            .sort((a, b) => a.distance - b.distance);
          const best = candidates[0];
          if (!best || best.distance > 1.1 || best.distance + 0.08 >= distance(current)) break;
          // At a fork, wait until one branch is clearly nearer the gesture.
          if (candidates.length > 1 && candidates[1].distance - best.distance < 0.18) break;
          visit(best.room);
          changed = true;
        }
        return changed;
      },
    };
  }

  // Keep the route centered; remove only short, wall-free grid-aligned jogs.
  function solutionPoints(maze, path = solveMaze(maze), complete = true) {
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
    points.push(complete ? [maze.width, maze.height - 0.5] : roomPoint(maze, path[path.length - 1]));
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
    module.exports = { generateMaze, createOriginalMaze, solveMaze, solutionPoints, roomPoint, createTrace, toUnicode };
    if (require.main === module) {
      try {
        const maze = generateMaze(Number(process.argv[2] ?? 30), Number(process.argv[3] ?? 15));
        console.log(toUnicode(maze));
      } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
      }
    }
  } else root.Maze = { generateMaze, createOriginalMaze, solveMaze, solutionPoints, roomPoint, createTrace, toUnicode };
})(typeof globalThis === 'undefined' ? this : globalThis);
