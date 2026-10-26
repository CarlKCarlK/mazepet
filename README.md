# Diagonal maze

Open `index.html` in a browser. Set the width and height to positive integers, then click **Generate** for a fresh maze. There is no application-imposed upper size limit. No installation, server, or internet connection is needed.

Click **Solve** to highlight a shortest route through the current maze in gold. Generating a new maze clears the solution.

The browser draws diagonal walls with exact shared endpoints so there are no gaps at tile corners. The entrance is the opening on the upper left side; the exit is on the lower right side. Large mazes scroll. Unicode `╱` and `╲` are available in the terminal version below.

You can also print a Unicode schematic in a terminal with Node.js:

```sh
node maze.js 30 15
```

The terminal version marks tile corners with dots. Terminal font proportions affect its appearance; the browser version keeps tiles square.

Each tile starts with a random diagonal and two triangular rooms. Union-find identifies connected regions, then removes diagonal walls to join them all. Detached wall islands are removed so there are no walls you can walk all the way around. Open tiles are then filled with diagonals that extend the border-connected walls without cutting off any rooms. This repeats until no more walls can be added under those rules. Interior walls are diagonal only; all rooms remain reachable.

Run the topology checks with `node --test maze.test.js`.
