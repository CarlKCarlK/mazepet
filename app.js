// @ts-check
'use strict';
/** @param {string} id */
function element(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing page element: ${id}`);
  return node;
}
/** @param {string} id */
function input(id) {
  const node = element(id);
  if (!(node instanceof HTMLInputElement)) throw new Error(`Expected input: ${id}`);
  return node;
}
/** @typedef {{width: number, height: number, tiles: string[], removed: Set<number>, passages: number[][], entrance: number, exit: number}} Layout */
/** @typedef {ReturnType<typeof Maze.createTrace>} Trace */
/** @typedef {{maze: Layout, trace: Trace, solution: number[], status: string | null}} View */
const canvas = /** @type {HTMLCanvasElement} */ (element('maze'));
const size = 20, margin = 4;
/** @type {Layout} */
let maze;
let showOriginal = false;
/** @type {Record<'fixed' | 'original', View>} */
let views;
/** @type {ReturnType<typeof MazeState.parse>} */
let currentState;
/** @type {number[]} */
let solution = [];
/** @type {Trace} */
let trace;
/** @type {number | null} */
let activePointer = null;
/** @type {number[] | null} */
let lastPoint = null;
const mazeStatus = element('status');
/** @type {WeakMap<Trace, boolean>} */
const completionStates = new WeakMap();
/** @type {Trace | null} */
let completionTrace = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let completionTimer = null;
function dismissCompletion() {
  if (completionTimer !== null) clearTimeout(completionTimer);
  completionTimer = null;
  element('completion').hidden = true;
}
element('dismiss-completion').addEventListener('click', dismissCompletion);
function restart() {
  if (activePointer !== null && canvas.hasPointerCapture(activePointer)) canvas.releasePointerCapture(activePointer);
  activePointer = null;
  lastPoint = null;
  solution = [];
  trace = Maze.createTrace(maze);
  mazeStatus.textContent = 'Tap a little ahead of the upper-left entrance.';
  render();
}
/** @param {ReturnType<typeof MazeState.parse>} state */
function generate(state) {
  if (activePointer !== null) endDrag({ pointerId: activePointer });
  currentState = state;
  input('width').value = String(state.width);
  input('height').value = String(state.height);
  showOriginal = state.mode === 'petscii';
  const fixed = Maze.generateMaze(state.width, state.height, MazeState.seededRandom(state.seed));
  const original = Maze.createOriginalMaze(fixed);
  views = {
    fixed: { maze: fixed, trace: Maze.createTrace(fixed), solution: [], status: 'Tap a little ahead of the upper-left entrance.' },
    original: { maze: original, trace: Maze.createTrace(original), solution: [], status: 'Try tracing the original PETSCII layout from the upper-left entrance.' },
  };
  activateView();
}
function activateView() {
  const view = views[showOriginal ? 'original' : 'fixed'];
  ({ maze, trace, solution } = view);
  mazeStatus.textContent = view.status;
  render();
}
function render() {
  const completed = trace.complete && solution.length === 0;
  const previouslyCompleted = completionStates.get(trace) || false;
  completionStates.set(trace, completed);
  if (completionTrace !== trace || !completed) dismissCompletion();
  if (completed && !previouslyCompleted) {
    completionTrace = trace;
    element('completion').hidden = false;
    completionTimer = setTimeout(dismissCompletion, 1000);
  }
  element('maze-frame').classList.toggle('completed', completed);
  const toggle = element('toggle-original');
  toggle.textContent = showOriginal ? 'Show fixed' : 'Show original';
  toggle.setAttribute('aria-pressed', String(showOriginal));
  element('layout-note').textContent = showOriginal
    ? 'Original PETSCII: the exit may be unreachable. ' : '';
  canvas.setAttribute('aria-label', showOriginal
    ? 'Interactive original PETSCII maze. Trace from the upper-left entrance; the lower-right exit may be unreachable.'
    : 'Interactive diagonal maze. Tap ahead or drag from the upper-left entrance to the lower-right exit.');
  const width = maze.width * size + 2 * margin;
  const height = maze.height * size + 2 * margin;
  // Cap backing resolution for large mazes while keeping logical cells square.
  const ratio = Math.min(window.devicePixelRatio || 1, 2, 8192 / Math.max(width, height));
  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil(height * ratio);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas drawing is unavailable.');
  const ctx = context;
  ctx.scale(ratio, ratio);
  ctx.translate(margin, margin);
  ctx.strokeStyle = '#c6b3ff';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  /** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 */
  function wall(x1, y1, x2, y2) { ctx.moveTo(x1 * size, y1 * size); ctx.lineTo(x2 * size, y2 * size); }
  // Use exact shared endpoints. Font glyph bounding boxes do not guarantee
  // that the ends of a diagonal actually reach opposite tile corners.
  maze.tiles.forEach((tile, i) => {
    if (maze.removed.has(i)) return;
    const x = i % maze.width, y = Math.floor(i / maze.width);
    if (tile === '/') wall(x, y + 1, x + 1, y);
    else wall(x, y, x + 1, y + 1);
  });
  wall(0, 0, maze.width, 0);
  wall(0, maze.height, maze.width, maze.height);
  if (maze.height > 1) {
    wall(0, 1, 0, maze.height);
    wall(maze.width, 0, maze.width, maze.height - 1);
  }
  ctx.stroke();
  const path = solution.length ? solution : trace.path;
  if (path.length) {
    ctx.strokeStyle = '#ffd479';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const points = Maze.solutionPoints(maze, path, solution.length > 0 || trace.complete);
    ctx.moveTo(points[0][0] * size, points[0][1] * size);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x * size, y * size);
    ctx.stroke();
  }
  if (!solution.length) {
    const [x, y] = Maze.roomPoint(maze, trace.path[trace.path.length - 1]);
    ctx.fillStyle = trace.complete ? '#9fffc3' : '#ffd479';
    ctx.beginPath();
    ctx.arc(x * size, y * size, 4, 0, 2 * Math.PI);
    ctx.fill();
  }
}
/** @param {PointerEvent} event */
function pointerPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return [(event.clientX - rect.left - margin) / size, (event.clientY - rect.top - margin) / size];
}
canvas.addEventListener('pointerdown', event => {
  if (activePointer !== null || !event.isPrimary || event.button !== 0) return;
  const point = pointerPoint(event);
  const tip = Maze.roomPoint(maze, trace.path[trace.path.length - 1]);
  const jumped = trace.jump(point);
  if (!jumped && Math.hypot(point[0] - tip[0], point[1] - tip[1]) > 1.2) {
    mazeStatus.textContent = 'Tap a little closer, along a clear passage.';
    return;
  }
  event.preventDefault();
  activePointer = event.pointerId;
  lastPoint = point;
  canvas.setPointerCapture(event.pointerId);
  solution = [];
  mazeStatus.textContent = trace.complete ? 'Maze complete! Well done!' : 'Tap ahead or keep dragging along the passage.';
  render();
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== activePointer || lastPoint === null) return;
  const point = pointerPoint(event);
  // Sample fast drags, too, so a skipped browser event cannot jump a wall.
  const steps = Math.max(1, Math.ceil(Math.hypot(point[0] - lastPoint[0], point[1] - lastPoint[1]) / 0.15));
  let changed = false;
  for (let i = 1; i <= steps; i++) {
    changed = trace.advance([lastPoint[0] + (point[0] - lastPoint[0]) * i / steps,
      lastPoint[1] + (point[1] - lastPoint[1]) * i / steps]) || changed;
  }
  if (!changed) changed = trace.jump(point);
  lastPoint = point;
  if (changed) {
    mazeStatus.textContent = trace.complete ? 'Maze complete! Well done!' : 'Tap ahead or keep dragging along the passage.';
    render();
  }
});
/** @param {{pointerId: number}} event */
function endDrag(event) {
  if (event.pointerId !== activePointer) return;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  activePointer = null;
  lastPoint = null;
}
for (const name of /** @type {const} */ (['pointerup', 'pointercancel', 'lostpointercapture'])) canvas.addEventListener(name, endDrag);
/** @param {'pushState' | 'replaceState'} method */
function updateURL(method) {
  history[method](null, '', MazeState.toURL(location.href, currentState));
}
element('controls').addEventListener('submit', event => {
  event.preventDefault();
  const width = Number(input('width').value);
  const height = Number(input('height').value);
  if (!MazeState.validDimensions(width, height)) {
    mazeStatus.textContent = 'Use positive whole-number dimensions.';
    return;
  }
  generate({ width, height, mode: showOriginal ? 'petscii' : 'fixed', seed: MazeState.newSeed() });
  updateURL('pushState');
});
element('restart').addEventListener('click', restart);
element('toggle-original').addEventListener('click', () => {
  if (activePointer !== null) endDrag({ pointerId: activePointer });
  views[showOriginal ? 'original' : 'fixed'] = { maze, trace, solution, status: mazeStatus.textContent };
  showOriginal = !showOriginal;
  currentState.mode = showOriginal ? 'petscii' : 'fixed';
  activateView();
  updateURL('replaceState');
});
element('solve').addEventListener('click', () => {
  solution = Maze.solveMaze(maze);
  mazeStatus.textContent = solution.length
    ? 'Solution shown. Start over to try it yourself.'
    : 'This original PETSCII layout has no route to the exit. You can still explore its passages.';
  render();
});
// Use a 25×20 default on computers; fit smaller touch screens.
// Run only on load: resizing or zooming must not replace the user's maze.
function setInitialDimensions() {
  if (!matchMedia('(max-width: 640px), (pointer: coarse) and (max-width: 1024px)').matches) return;
  const frame = element('maze-frame');
  const frameStyle = getComputedStyle(frame);
  const bodyStyle = getComputedStyle(document.body);
  const hint = element('instructions');
  const hintStyle = getComputedStyle(hint);
  const horizontalFrame = parseFloat(frameStyle.paddingLeft) + parseFloat(frameStyle.paddingRight)
    + parseFloat(frameStyle.borderLeftWidth) + parseFloat(frameStyle.borderRightWidth);
  const verticalFrame = parseFloat(frameStyle.paddingTop) + parseFloat(frameStyle.paddingBottom)
    + parseFloat(frameStyle.borderTopWidth) + parseFloat(frameStyle.borderBottomWidth);
  const availableWidth = document.documentElement.clientWidth
    - parseFloat(bodyStyle.marginLeft) - parseFloat(bodyStyle.marginRight) - horizontalFrame - 2 * margin;
  const availableHeight = document.documentElement.clientHeight - frame.getBoundingClientRect().top
    - parseFloat(bodyStyle.marginBottom) - verticalFrame - 2 * margin
    - hint.getBoundingClientRect().height - parseFloat(hintStyle.marginTop) - parseFloat(hintStyle.marginBottom);
  input('width').value = String(Math.max(1, Math.floor(availableWidth / size)));
  input('height').value = String(Math.max(1, Math.floor(availableHeight / size)));
}
// Screen fitting is only a default. Shared dimensions take precedence.
setInitialDimensions();
const defaults = {
  width: Math.max(1, Number(input('width').value)),
  height: Math.max(1, Number(input('height').value)),
};
generate(MazeState.parse(location.search, defaults));
updateURL('replaceState');
window.addEventListener('popstate', () => {
  generate(MazeState.parse(location.search, defaults));
  updateURL('replaceState');
});
element('version').textContent = /** @type {HTMLMetaElement} */ (document.querySelector('meta[name="mazepet-version"]')).content;
