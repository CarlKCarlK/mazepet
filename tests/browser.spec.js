const { test, expect } = require('@playwright/test');
const version = `v${require('../package.json').version}`;
const pinned = `/${version}/?w=25&h=20&mode=petscii&seed=8ac31f02`;
const snapshot = page => page.evaluate(() => JSON.stringify({ tiles: maze.tiles, removed: [...maze.removed] }));

test('the default URL pins the release and reproduces both layouts', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?w=25&h=20&mode=petscii&seed=8ac31f02#maze');
  await expect(page).toHaveURL(`http://127.0.0.1:8765/${version}/?w=25&h=20&mode=petscii&seed=8ac31f02#maze`);
  await expect(page.locator('#width')).toHaveValue('25');
  await expect(page.locator('#toggle-original')).toHaveText('Show fixed');
  const original = await snapshot(page);
  await page.reload();
  expect(await snapshot(page)).toBe(original);
  await page.locator('#toggle-original').click();
  await expect(page.locator('#toggle-original')).toHaveText('Show original');
  const fixed = await snapshot(page);
  expect(fixed).not.toBe(original);
  await page.reload();
  expect(await snapshot(page)).toBe(fixed);
  expect(errors).toEqual([]);
});

test('Generate preserves mode, updates seed and supports Back/Forward; edits wait for Generate', async ({ page }) => {
  await page.goto(pinned);
  const before = await snapshot(page);
  await page.locator('#width').fill('30');
  expect(new URL(page.url()).searchParams.get('w')).toBe('25');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page).toHaveURL(/w=30&h=20&mode=petscii&seed=/);
  expect(new URL(page.url()).searchParams.get('seed')).not.toBe('8ac31f02');
  const after = await snapshot(page);
  await page.goBack();
  await expect(page.locator('#width')).toHaveValue('25');
  expect(await snapshot(page)).toBe(before);
  await page.goForward();
  await expect(page.locator('#width')).toHaveValue('30');
  expect(await snapshot(page)).toBe(after);
  await page.locator('#toggle-original').click();
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('mode')).toBe('fixed');
});

test('phone fitting only supplies defaults and invalid links remain bounded', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/${version}/`);
  expect(Number(await page.locator('#width').inputValue())).toBeLessThan(25);
  await page.goto(pinned);
  await expect(page.locator('#width')).toHaveValue('25');
  await expect(page.locator('#height')).toHaveValue('20');
  await page.goto(`/${version}/?w=9007199254740992&h=-1&mode=oops&seed=invalid`);
  expect(new URL(page.url()).searchParams.get('seed')).toMatch(/^[0-9a-f]{8}$/);
  expect(new URL(page.url()).searchParams.get('mode')).toBe('fixed');
  expect(Number(await page.locator('#width').inputValue())).toBeLessThan(25);
});

test('completion requires playing, with independent progress in each mode', async ({ page }) => {
  await page.goto(`/${version}/?w=1&h=2&mode=petscii&seed=00000005`);
  // This seed has two backslashes and an entrance-to-exit passage.
  await page.locator('#solve').click();
  await expect(page.locator('#completion')).toBeHidden();
  await page.locator('#restart').click();
  const target = await page.evaluate(() => Maze.roomPoint(maze, maze.exit));
  await page.locator('#maze').click({ position: { x: target[0] * 20 + 4, y: target[1] * 20 + 4 } });
  await expect(page.locator('#completion')).toBeVisible();
  await page.locator('#toggle-original').click();
  await expect(page.locator('#completion')).toBeHidden();
  await page.locator('#toggle-original').click();
  expect(await page.evaluate(() => trace.complete)).toBe(true);
  await expect(page.locator('#completion')).toBeHidden();
  await page.locator('#restart').click();
  await expect(page.locator('#completion')).toBeHidden();
});

test('completion announcement dismisses after one second or a tap, without restarting', async ({ page }) => {
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  await page.goto(`/${version}/?w=1&h=2&mode=petscii&seed=00000005`);
  const target = await page.evaluate(() => Maze.roomPoint(maze, maze.exit));
  const finish = () => page.locator('#maze').click({ position: { x: target[0] * 20 + 4, y: target[1] * 20 + 4 } });
  await finish();
  await expect(page.locator('#completion')).toBeVisible();
  await page.clock.fastForward(999);
  await expect(page.locator('#completion')).toBeVisible();
  await page.clock.fastForward(1);
  await expect(page.locator('#completion')).toBeHidden();
  await expect(page.locator('#maze-frame')).toHaveClass(/completed/);
  await page.locator('#restart').click();
  await finish();
  await expect(page.locator('#completion')).toBeVisible();
  await page.locator('#dismiss-completion').click();
  await expect(page.locator('#completion')).toBeHidden();
  expect(await page.evaluate(() => trace.complete)).toBe(true);
});

test('unreachable PETSCII exits give useful feedback', async ({ page }) => {
  await page.goto(`/${version}/?w=1&h=2&mode=petscii&seed=00000000`);
  // Seed zero starts with a slash, isolating the entrance.
  await page.locator('#solve').click();
  await expect(page.locator('#status')).toContainText('no route');
});

test('large dimensions work in controls and shared URLs without the former caps', async ({ page }) => {
  await page.goto(pinned);
  await page.locator('#width').fill('250');
  await page.locator('#height').fill('50');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page).toHaveURL(/w=250&h=50&mode=petscii&seed=/);
  const original = await snapshot(page);
  await page.reload();
  await expect(page.locator('#width')).toHaveValue('250');
  await expect(page.locator('#height')).toHaveValue('50');
  expect(await snapshot(page)).toBe(original);
  await expect(page.locator('#width')).not.toHaveAttribute('max');
  await expect(page.locator('#height')).not.toHaveAttribute('max');
});

for (const density of [1, 2]) {
  test.describe(`large maze rendering at ${density}x density`, () => {
    test.use({ deviceScaleFactor: density });

    for (const [width, height] of [[1000, 20], [20, 1000]]) {
      test(`${width} x ${height} stays sharp through tile edges and the exit`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`/${version}/?w=${width}&h=${height}&mode=fixed&seed=8ac31f02`);
        const tiles = await page.locator('#maze canvas').evaluateAll(nodes => nodes.map(tile => ({
          width: tile.width, height: tile.height,
          left: parseFloat(tile.style.left), top: parseFloat(tile.style.top),
          cssWidth: parseFloat(tile.style.width), cssHeight: parseFloat(tile.style.height),
        })));
        expect(tiles).toHaveLength(10);
        for (const tile of tiles) {
          expect(tile.width).toBe(tile.cssWidth * density);
          expect(tile.height).toBe(tile.cssHeight * density);
          expect(Math.max(tile.width, tile.height)).toBeLessThanOrEqual(4096);
        }
        const last = tiles.at(-1);
        expect(last.left + last.cssWidth).toBe(width * 20 + 8);
        expect(last.top + last.cssHeight).toBe(height * 20 + 8);
        // Outer walls must remain unbroken on both sides of every tile seam.
        const seamAlphas = await page.locator('#maze canvas').evaluateAll((nodes, density) =>
          nodes.slice(1).flatMap((tile, index) => {
            const previous = nodes[index];
            const horizontal = parseFloat(tile.style.left) > 0;
            return [previous, tile].map((node, side) => {
              const x = horizontal ? (side === 0 ? node.width - 1 : 0) : 4 * density;
              const y = horizontal ? 4 * density : (side === 0 ? node.height - 1 : 0);
              return node.getContext('2d').getImageData(x, y, 1, 1).data[3];
            });
          }), density);
        expect(seamAlphas.every(alpha => alpha > 0)).toBe(true);
        await page.locator('#solve').click();
        const exitPixel = await page.locator('#maze canvas').last().evaluate((tile, { width, height, density }) => {
          const x = (width * 20 + 4 - parseFloat(tile.style.left)) * density;
          const y = ((height - 0.5) * 20 + 4 - parseFloat(tile.style.top)) * density;
          return [...tile.getContext('2d').getImageData(x, y, 1, 1).data];
        }, { width, height, density });
        // Rounded endpoints can have slightly translucent antialiased pixels.
        for (const [index, expected] of [255, 212, 121, 255].entries()) {
          expect(Math.abs(exitPixel[index] - expected)).toBeLessThanOrEqual(2);
        }
        await page.locator('#restart').click();
        const crossing = await page.evaluate(() => {
          const route = Maze.solveMaze(maze);
          const screenPoint = room => Maze.roomPoint(maze, room).map(n => n * 20 + 4);
          const axis = maze.width > maze.height ? 0 : 1;
          const nextIndex = route.findIndex((room, index) => index > 0
            && (screenPoint(room)[axis] < 2048) !== (screenPoint(route[index - 1])[axis] < 2048));
          // Start immediately before a real passage across the first tile seam.
          trace.path.splice(0, trace.path.length, ...route.slice(0, nextIndex));
          render();
          const start = screenPoint(route[nextIndex - 1]);
          const end = screenPoint(route[nextIndex]);
          const bounds = document.getElementById('maze').getBoundingClientRect();
          window.scrollTo(window.scrollX + bounds.left + start[0] - innerWidth / 2,
            window.scrollY + bounds.top + start[1] - innerHeight / 2);
          const rect = document.getElementById('maze').getBoundingClientRect();
          return { start: [rect.left + start[0], rect.top + start[1]],
            end: [rect.left + end[0], rect.top + end[1]], target: route[nextIndex] };
        });
        await page.mouse.move(...crossing.start);
        await page.mouse.down();
        await page.mouse.move(...crossing.end, { steps: 8 });
        await page.mouse.up();
        expect(await page.evaluate(() => trace.path.at(-1))).toBe(crossing.target);
        // Resizing removes surplus tiles and leaves the maze interactive.
        await page.locator('#width').fill('1');
        await page.locator('#height').fill('2');
        await page.getByRole('button', { name: 'Generate', exact: true }).click();
        await expect(page.locator('#maze canvas')).toHaveCount(1);
        const entrance = await page.evaluate(() => Maze.roomPoint(maze, maze.entrance));
        await page.locator('#maze').click({ position: { x: entrance[0] * 20 + 4, y: entrance[1] * 20 + 4 } });
        await expect(page.locator('#status')).toContainText('Tap ahead or keep dragging');
        expect(errors).toEqual([]);
      });
    }
  });
}
