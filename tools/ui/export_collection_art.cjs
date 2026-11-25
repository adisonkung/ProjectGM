// Mechanical format export only; original generated PNG remains unchanged.
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = 'assets/ui/collection/generated/archive-background-source.png';
const output = 'public/ui/collection/archive-background.webp';
const sha256 = file => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
execFileSync('magick', [path.join(root, source), '-quality', '90', path.join(root, output)]);
writeFileSync(path.join(root, 'assets/ui/collection/generated/manifest.json'), JSON.stringify({
  origin: 'OpenAI image generation, 2026-11-26; original PNG retained without retouching.',
  direction: 'Quiet charcoal celestial archive with pale orbital linework and light.',
  source: { file: source, sha256: sha256(source) },
  output: { file: output, sha256: sha256(output) },
}, null, 2) + '\n');
console.log('Exported generated archive background.');
