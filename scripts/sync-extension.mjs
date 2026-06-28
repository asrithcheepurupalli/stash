/**
 * Mirrors stash-extension/ into public/extension/ (so the landing can serve and
 * zip it) and writes public/extension/files.json listing every bundled file.
 * Runs automatically before `npm run build` (see package.json "prebuild").
 */
import fs from 'fs';
import path from 'path';

const SRC = path.resolve('stash-extension');
const DEST = path.resolve('public/extension');

function walk(dir, base = '') {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(abs, rel));
    else out.push(rel);
  }
  return out;
}

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });

const files = walk(SRC);
for (const rel of files) {
  const dest = path.join(DEST, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(SRC, rel), dest);
}

fs.writeFileSync(path.join(DEST, 'files.json'), JSON.stringify(files));
console.log(`synced ${files.length} extension files -> public/extension (files.json written)`);
