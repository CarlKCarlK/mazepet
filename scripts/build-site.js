'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const compareVersions = (a, b) => {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
};

function redirect(target) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>mazepet</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
</head><body><a href="${target}">Open mazepet</a>
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script>
</body></html>\n`;
}

function buildSite({ repo = process.cwd(), out = path.join(repo, '_site'), preview = false } = {}) {
  const git = args => execFileSync('git', args, { cwd: repo, maxBuffer: 32 * 1024 * 1024 });
  const tags = git(['tag', '--list', 'v*']).toString().trim().split('\n')
    .filter(tag => versionPattern.test(tag.slice(1)));
  const releases = new Map(tags.map(tag => [tag.slice(1), tag]));
  if (preview) {
    const version = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version;
    if (!versionPattern.test(version)) throw new Error('Expected a stable three-part package version.');
    // Preview current work locally; production always takes code from immutable tags.
    releases.set(version, null);
  }
  if (!releases.size) throw new Error('No stable release tags found. Use --preview for an unreleased local build.');

  out = path.resolve(out);
  const repository = path.resolve(repo);
  if (out === path.parse(out).root || out === repository || repository.startsWith(out + path.sep)) {
    throw new Error('Build output must not replace the repository or one of its parents.');
  }
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const versions = [...releases.keys()].sort(compareVersions);
  const manifest = [];
  for (const version of versions) {
    const tag = releases.get(version);
    const read = file => tag ? git(['show', `${tag}:${file}`]) : fs.readFileSync(path.join(repo, file));
    const metadata = JSON.parse(read('package.json').toString());
    if (metadata.version !== version) throw new Error(`Tag v${version} disagrees with package.json.`);
    const files = JSON.parse(read('site-files.json').toString());
    const destination = path.join(out, `v${version}`);
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of files) {
      if (typeof entry !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(entry)
        || entry.startsWith('/') || entry.split('/').includes('..')) throw new Error('Invalid site file path.');
      const names = entry.endsWith('/')
        ? (tag ? git(['ls-tree', '-r', '--name-only', tag, '--', entry]).toString().trim().split('\n')
          : fs.readdirSync(path.join(repo, entry), { recursive: true, withFileTypes: true })
            .filter(item => item.isFile()).map(item => path.relative(repo, path.join(item.parentPath, item.name))))
        : [entry];
      for (const name of names.filter(Boolean)) {
        const target = path.join(destination, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, read(name));
      }
    }
    const htmlPath = path.join(destination, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8')
      .replace('<meta name="mazepet-version" content="development">', `<meta name="mazepet-version" content="${version}">`)
      .replaceAll('https://carlkcarlk.github.io/mazepet/assets/', `https://carlkcarlk.github.io/mazepet/v${version}/assets/`)
      .replaceAll('content="https://carlkcarlk.github.io/mazepet/"', `content="https://carlkcarlk.github.io/mazepet/v${version}/"`)
      .replace('rel="canonical" href="https://carlkcarlk.github.io/mazepet/"', `rel="canonical" href="https://carlkcarlk.github.io/mazepet/v${version}/"`);
    fs.writeFileSync(htmlPath, html);
    manifest.push({ version, commit: tag ? git(['rev-list', '-1', tag]).toString().trim() : 'preview' });
  }
  fs.writeFileSync(path.join(out, 'index.html'), redirect(`./v${versions.at(-1)}/`));
  // Preserve previously published asset URLs used in social cards and bookmarks.
  const latestAssets = path.join(out, `v${versions.at(-1)}`, 'assets');
  if (fs.existsSync(latestAssets)) fs.cpSync(latestAssets, path.join(out, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  fs.writeFileSync(path.join(out, 'releases.json'), JSON.stringify(manifest, null, 2) + '\n');
  return versions;
}

module.exports = { buildSite, redirect };
if (require.main === module) {
  console.log(`Built versions: ${buildSite({ preview: process.argv.includes('--preview') }).join(', ')}`);
}
