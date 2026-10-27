'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { buildSite, redirect } = require('./scripts/build-site');

test('release builds retain exact tagged files and select the latest release numerically', t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'mazepet-release-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  git('init');
  git('config', 'user.name', 'Release Test');
  git('config', 'user.email', 'test@example.com');
  fs.writeFileSync(path.join(repo, 'site-files.json'), '["index.html", "maze.js", "assets/"]');
  fs.mkdirSync(path.join(repo, 'assets'));
  fs.writeFileSync(path.join(repo, 'assets', 'icon.svg'), '<svg/>');
  const out = path.join(repo, '_site');
  assert.throws(() => buildSite({ repo, out }), /No stable release/);
  for (const version of ['1.0.0', '1.2.0', '1.10.0', '2.0.0']) {
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ version }));
    fs.writeFileSync(path.join(repo, 'index.html'), '<meta name="mazepet-version" content="development">');
    fs.writeFileSync(path.join(repo, 'maze.js'), `// ${version}`);
    git('add', 'package.json', 'site-files.json', 'index.html', 'maze.js', 'assets');
    git('commit', '-m', version);
    git('tag', `v${version}`);
  }
  git('tag', 'v3.0.0-beta.1');
  fs.writeFileSync(path.join(repo, 'maze.js'), '// unreleased edit');
  assert.deepEqual(buildSite({ repo, out }), ['1.0.0', '1.2.0', '1.10.0', '2.0.0']);
  assert.equal(fs.readFileSync(path.join(out, 'v1.0.0', 'maze.js'), 'utf8'), '// 1.0.0');
  assert.match(fs.readFileSync(path.join(out, 'v1.0.0', 'index.html'), 'utf8'), /content="1.0.0"/);
  assert.equal(fs.existsSync(path.join(out, 'v1')), false);
  assert.equal(fs.existsSync(path.join(out, 'v2')), false);
  assert.match(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), /\.\/v2\.0\.0\//);
  assert.equal(fs.readFileSync(path.join(out, 'v1.0.0', 'assets', 'icon.svg'), 'utf8'), '<svg/>');
  assert(fs.existsSync(path.join(out, '.nojekyll')));
  fs.rmSync(out, { recursive: true });
  buildSite({ repo, out, preview: true });
  assert.equal(fs.readFileSync(path.join(out, 'v2.0.0', 'maze.js'), 'utf8'), '// unreleased edit');
});

test('redirect preserves query and fragment and replaces the history entry', () => {
  const html = redirect('../v1.0.0/');
  let destination;
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    location: { search: '?w=25&mode=petscii&seed=00000000', hash: '#maze', replace(value) { destination = value; } },
  });
  assert.equal(destination, '../v1.0.0/?w=25&mode=petscii&seed=00000000#maze');
});
