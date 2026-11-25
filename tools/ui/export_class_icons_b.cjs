// Export the approved B silhouettes directly; no redraw or generated replacement.
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = 'assets/ui/class-icons-b/approved-board.png';
const hash = file => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
const geometry = execFileSync('magick', ['identify', '-format', '%wx%h', path.join(root, source)], { encoding: 'utf8' });
if (geometry !== '1774x887') throw Error('Unexpected approved board dimensions: ' + geometry);
const rows = [
  ['fighter', 120, '#ff2345'], ['tank', 390, '#ffce24'],
  ['assassin', 670, '#c954ff'], ['archer', 940, '#ff9a25'],
  ['mage', 1220, '#48e4ff'], ['healer', 1495, '#49ef69'],
];
const icons = rows.map(([id, left, color]) => {
  const output = `public/ui/generated/class/${id}.webp`;
  // Chroma isolates the colored glyphs from both the dark board and white miniatures.
  // Extract alpha from that contrast, then apply the existing class palette.
  execFileSync('magick', [path.join(root, source), '-crop', `260x234+${left}+470`, '+repage',
    '-alpha', 'off', '-fx', 'max(r,max(g,b))-min(r,min(g,b))', '-level', '8%,40%',
    '-alpha', 'copy', '-channel', 'RGB', '-fill', color, '-colorize', '100%', '+channel',
    '-trim', '+repage', '-resize', '216x216', '-gravity', 'center', '-background', 'none',
    '-extent', '256x256', '-define', 'webp:lossless=true', path.join(root, output)]);
  return { id, color, crop: [left, 470, 260, 234], output, sha256: hash(output) };
});
writeFileSync(path.join(root, 'assets/ui/class-icons-b/manifest.json'), JSON.stringify({
  approved: 'User selected row B with straight Ranger arrow, 2026-11-26.',
  source: { file: source, sha256: hash(source) },
  export: 'Mechanical crop/alpha extraction; no redraw. Glyph fits216px in a256px transparent canvas.',
  icons,
}, null, 2) + '\n');
console.log('Exported all six approved B class icons.');
