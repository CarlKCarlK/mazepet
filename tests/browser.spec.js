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
  await expect(page.locator('#toggle-original')).toHaveText('Fix');
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
  await page.goto(`/${version}/?w=9999999&h=-1&mode=oops&seed=invalid`);
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
  await expect(page.locator('#completion')).toBeVisible();
  await page.locator('#restart').click();
  await expect(page.locator('#completion')).toBeHidden();
});

test('unreachable PETSCII exits and excessive cell counts give useful feedback', async ({ page }) => {
  await page.goto(`/${version}/?w=1&h=2&mode=petscii&seed=00000000`);
  // Seed zero starts with a slash, isolating the entrance.
  await page.locator('#solve').click();
  await expect(page.locator('#status')).toContainText('no route');
  const previousURL = page.url();
  await page.locator('#width').fill('200');
  await page.locator('#height').fill('200');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page.locator('#status')).toContainText('at most 10,000 cells');
  expect(page.url()).toBe(previousURL);
});
