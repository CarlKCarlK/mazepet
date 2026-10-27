// @ts-check
/* Seed and URL format are part of the released maze's compatibility contract. */
(function (root) {
  'use strict';
  /** @typedef {{width: number, height: number, mode: 'fixed' | 'petscii', seed: string}} State */
  const MAX_DIMENSION = 200;
  const MAX_CELLS = 10000;

  /** @param {string} seed */
  function seededRandom(seed) {
    if (!/^[0-9a-f]{8}$/i.test(seed)) throw new Error('Expected an eight-digit hexadecimal seed.');
    let value = parseInt(seed, 16);
    // Mulberry32, with explicit 32-bit arithmetic; zero is a valid seed.
    return () => {
      value = (value + 0x6D2B79F5) >>> 0;
      let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function newSeed() {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8, '0');
  }

  /** @param {number} width @param {number} height */
  function validDimensions(width, height) {
    return [width, height].every(n => Number.isInteger(n) && n >= 1 && n <= MAX_DIMENSION)
      && width * height <= MAX_CELLS;
  }

  /** @param {string | null} text @param {number} fallback */
  function dimension(text, fallback) {
    const n = text !== null && /^[1-9]\d{0,2}$/.test(text) ? Number(text) : NaN;
    return n >= 1 && n <= MAX_DIMENSION ? n : fallback;
  }

  /** @param {string} search @param {{width: number, height: number}} defaults @param {() => string} [makeSeed] @returns {State} */
  function parse(search, defaults, makeSeed = newSeed) {
    const params = new URLSearchParams(search);
    let width = dimension(params.get('w'), defaults.width);
    let height = dimension(params.get('h'), defaults.height);
    if (!validDimensions(width, height)) {
      width = defaults.width;
      height = defaults.height;
    }
    const seed = params.get('seed');
    return {
      width, height,
      mode: params.get('mode') === 'petscii' ? 'petscii' : 'fixed',
      seed: seed !== null && /^[0-9a-f]{8}$/i.test(seed) ? seed.toLowerCase() : makeSeed(),
    };
  }

  /** @param {string} href @param {State} state */
  function toURL(href, state) {
    const url = new URL(href);
    url.searchParams.set('w', String(state.width));
    url.searchParams.set('h', String(state.height));
    url.searchParams.set('mode', state.mode);
    url.searchParams.set('seed', state.seed);
    return url.href;
  }

  const api = { seededRandom, newSeed, validDimensions, parse, toURL, MAX_DIMENSION, MAX_CELLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, { MazeState: api });
})(globalThis);
