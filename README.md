# mazepet

[Play mazepet in your browser](https://carlkcarlk.github.io/mazepet/).

Inspired by the Commodore 64's [10 PRINT](https://10print.org/), which draws a maze-like picture from random PETSCII diagonals:

```basic
10 PRINT CHR$(205.5+RND(1)); : GOTO 10
```

mazepet starts with that random `/` and `\` pattern and repairs it into a connected, solvable maze. It tries to preserve the original picture: opening passages, attaching wall islands to the border, and narrowing wide halls with whole diagonals. It aims for fewer edits rather than guaranteeing a global minimum.

## Run locally

Open [index.html](index.html) in your browser. Set the width and height, click **Generate**, and use **Solve** to reveal the route. Enter at the upper left and exit at the lower right. Zoom out or use browser scrolling for large mazes. No dependencies, server, or internet connection needed.

For a Unicode terminal version and the automated checks, use Node.js:

```sh
node maze.js 30 15
node --test maze.test.js
```

## Policy on AI-assisted development and contributions

The use of AI tools is permitted for development and contributions to this repository. AI may be used as a productivity aid for drafting, exploration, and refactoring.

All code and documentation contributed to this repository must be reviewed, edited, and validated by a human contributor. AI tools are not a substitute for design judgment, testing, or responsibility for correctness.

## License

Licensed under either:

- [MIT license](LICENSE-MIT)
- [Apache License, Version 2.0](LICENSE-APACHE)

at your option.
