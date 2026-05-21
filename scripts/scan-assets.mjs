#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   scan-assets.mjs — scan asset folders, emit a manifest the site can read.

   Walks `assets/showcase/<id>/` and lists image files for each `<id>`.
   Writes `data/asset-manifest.json` keyed by showcase id.

   No dependencies. Run with: `node scripts/scan-assets.mjs`.
   Auto-run by .github/workflows/scan-assets.yml on push.
   ════════════════════════════════════════════════════════════════════════ */

import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, posix, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOWCASE_ROOT = 'assets/showcase';
const MANIFEST_OUT = 'data/asset-manifest.json';
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);

async function listImages(absDir, relDir) {
  const entries = await readdir(absDir, { withFileTypes: true });
  return entries
    .filter(e => e.isFile())
    .filter(e => !e.name.startsWith('_') && !e.name.startsWith('.'))
    .filter(e => IMAGE_EXTS.has(extname(e.name).toLowerCase()))
    .map(e => e.name)
    .sort()
    .map(name => posix.join(relDir, name));
}

async function scan() {
  const showcaseAbs = join(REPO_ROOT, SHOWCASE_ROOT);
  if (!existsSync(showcaseAbs)) {
    console.warn(`No ${SHOWCASE_ROOT} directory — nothing to scan.`);
    return {};
  }

  const manifest = {};
  const dirents = await readdir(showcaseAbs, { withFileTypes: true });
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    const id = dirent.name;
    const relDir = posix.join(SHOWCASE_ROOT, id);
    const absDir = join(showcaseAbs, id);
    const images = await listImages(absDir, relDir);
    if (images.length) manifest[id] = images;
  }
  return manifest;
}

const manifest = await scan();
const outAbs = join(REPO_ROOT, MANIFEST_OUT);
await mkdir(dirname(outAbs), { recursive: true });
await writeFile(outAbs, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

const folderCount = Object.keys(manifest).length;
const fileCount = Object.values(manifest).reduce((n, arr) => n + arr.length, 0);
console.log(`Wrote ${MANIFEST_OUT} — ${folderCount} folder${folderCount === 1 ? '' : 's'}, ${fileCount} image${fileCount === 1 ? '' : 's'}.`);
