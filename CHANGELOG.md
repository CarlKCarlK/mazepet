# Changelog

## 0.1.3 — 2026-10-27

- Fix blurry rendering in large mazes, including 1000 × 20 layouts, by drawing at full resolution across smaller canvas tiles.
- Preserve continuous walls, solution paths, and dragging across tile boundaries.
- Add browser regression coverage for wide and tall mazes at standard and high pixel densities.
