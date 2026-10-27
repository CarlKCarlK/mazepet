# mazepet

[Play mazepet in your browser](https://carlkcarlk.github.io/mazepet/).

[![A purple maze made from diagonal walls. Click to play mazepet.](assets/maze-example.png)](https://carlkcarlk.github.io/mazepet/)

Inspired by the Commodore 64's [10 PRINT](https://10print.org/), which draws a maze-like picture from random PETSCII diagonals:

```basic
10 PRINT CHR$(205.5+RND(1)); : GOTO 10
```

mazepet repairs that random picture into a solvable maze while trying to preserve its original diagonals.

## Algorithm sketch

1. **Draw the picture.** Fill each tile randomly with `/` or `\`, splitting it into two triangular rooms.
2. **Connect the passages.** Visit diagonals in random order. Erase a diagonal when its two rooms belong to disconnected passage regions, until every room is reachable.
3. **Attach wall islands.** Search through empty tiles for chains of diagonals that connect detached walls to the border-connected wall network. Favor larger islands when attachment paths compete for a tile.
4. **Remove unattached islands.** Erase any wall sections that could not be connected to the border.
5. **Narrow the halls.** Repeatedly try filling empty tiles with their original diagonal, then its opposite. Keep a diagonal only if it extends the border-connected walls to a new corner without cutting off passages.

Union-find tracks passage regions and, separately, connected walls. Island attachment uses breadth-first search. All interior walls remain whole diagonals; no horizontal, vertical, or half-tile walls are added. The repair favors fewer changed tiles but does not guarantee the minimum possible number of edits.

The solver uses breadth-first search through the triangular rooms. Its highlighted route follows passage openings, with small wall-safe shortcuts to remove unnecessary jogs.

## Run locally

Open [index.html](index.html) in your browser. Computers start with a 40×25 maze; phones start with dimensions fitted to their screen. Set the width and height and click **Generate** for a new maze. No dependencies, server, or internet connection needed.

Tap or click a little ahead of the line, starting near the upper-left entrance, or drag with a mouse or finger. You don't need to grab the dot. Short jumps follow a single clear passage, including around bends, for up to about sixteen tiles of travel. Distant taps, taps on walls, and jumps with two possible nearby routes leave the line in place. At forks, tap clearly into your chosen branch. Wrong turns are allowed—the interaction never consults the solution.

Tap or drag backward along your route to erase steps. Lift your finger or release the mouse to pause, then tap ahead again to resume. Reach the lower-right exit to see **Maze complete!** Use **Start over** to clear your route on the same maze, or **Solve** to reveal the answer. Revealing the answer does not count as completing the maze. Scroll outside the maze or zoom out to navigate large mazes; dragging inside the maze traces your route.

For a Unicode terminal version and the automated checks, use Node.js:

```sh
node maze.js 30 15
node --test maze.test.js
```

## Policy on AI-assisted development and contributions

The use of AI tools is permitted for development and contributions to this repository. AI may be used as a productivity aid for drafting, exploration, and refactoring.

All code and documentation contributed to this repository must be reviewed, edited, and validated by a human contributor. AI tools are not a substitute for design judgment, testing, or responsibility for correctness.

## Deployment

The [GitHub Pages workflow](.github/workflows/pages.yml) runs the tests and publishes the maze on each push to `main`. It can also be run manually from the Actions tab.

## License

Licensed under either:

- [MIT license](LICENSE-MIT)
- [Apache License, Version 2.0](LICENSE-APACHE)

at your option.
