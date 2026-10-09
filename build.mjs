import { readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');
const catalog = JSON.parse(read('assets/catalog.json'));
const watchViews = JSON.parse(read('assets/watches-v4/views.json'));
if (watchViews.columns !== 4 || watchViews.rows !== 2 || watchViews.views?.length !== 4) throw new Error('Invalid watch view layout');
const css = read('styles.css');
const core = read('core.js').replace(/^export /gm, '');
const code = read('app.js').replace(/^import[^\n]+\n/, '');
const svg = read('assets/silhouettes.svg');
if (/<script\b|\bon\w+\s*=/i.test(svg) || /(?:href|src)=["']https?:/i.test(svg)) throw new Error('Unsafe image library');
const assetFiles = new Map();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const runtimeDirectory = path.join(root, 'assets/runtime');
if (existsSync(runtimeDirectory) && (lstatSync(runtimeDirectory).isSymbolicLink() || !lstatSync(runtimeDirectory).isDirectory())) throw new Error('Invalid runtime asset directory');
mkdirSync(runtimeDirectory, { recursive: true });
function storeImage(bytes, type) {
  const relative = `assets/runtime/${hash(bytes)}.${type}`;
  const target = path.join(root, relative);
  if (existsSync(target)) {
    if (lstatSync(target).isSymbolicLink() || !readFileSync(target).equals(bytes)) throw new Error(`Conflicting runtime asset: ${relative}`);
  } else writeFileSync(target, bytes, { flag: 'wx' });
  assetFiles.set(relative, { path: relative, bytes: bytes.length, sha256: hash(bytes) });
  return `./${relative}`;
}
const localSvg = svg.replace(/(<image\b[^>]*\bhref=")([^"]+)(")/g, (_all, before, href, after) => {
  const match = /^runtime\/([a-f0-9]{64})\.(png|avif)$/.exec(href);
  if (!match) throw new Error('Run the verified art importer before building: expected local content-addressed images');
  const bytes = readFileSync(path.join(root, 'assets', href));
  if (hash(bytes) !== match[1]) throw new Error(`Image hash mismatch: ${href}`);
  return before + storeImage(bytes, match[2]) + after;
});
const symbols = localSvg.slice(localSvg.indexOf('>') + 1, localSvg.lastIndexOf('</svg>'));
let html = read('preview.shell.html');
const replacements = {
  '/* APP_STYLES */': css,
  '<!-- ART_SYMBOLS -->': `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" style="position:absolute;overflow:hidden">${symbols}</svg>`,
  '<!-- CATALOG_DATA -->': JSON.stringify(catalog).replace(/</g, '\\u003c'),
  '<!-- WATCH_VIEWS_DATA -->': JSON.stringify(watchViews).replace(/</g, '\\u003c'),
  '/* APP_CODE */': `(() => {\n'use strict';\n${core}\n${code}\n})();`,
};
for (const [key, value] of Object.entries(replacements)) {
  if (html.split(key).length !== 2) throw new Error(`Template marker missing/duplicate: ${key}`);
  html = html.replace(key, () => value);
}
const watchArt = [];
for (const watch of ['original', 'recalibrated', 'ultimatrix', 'omniverse']) {
  const relative = `./assets/watches-v3/${watch}.png`;
  const bytes = readFileSync(path.join(root, relative));
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`Invalid watch PNG: ${watch}`);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height) throw new Error(`Invalid watch dimensions: ${watch}`);
  if (html.split(relative).length !== 2) throw new Error(`Missing watch artwork marker: ${watch}`);
  html = html.replace(relative, storeImage(bytes, 'png'));
  watchArt.push({ id: watch, width, height, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
if (/<(?:script|img)\b[^>]*src=["']https?:/i.test(html)) throw new Error('Unexpected remote runtime asset');
const watchAtlases = [];
for (const watch of ['original', 'recalibrated', 'ultimatrix', 'omniverse']) {
  const frameSet = watchViews.watches[watch];
  if (!frameSet || frameSet.frames?.length !== 4) throw new Error(`Incomplete watch views: ${watch}`);
  for (const frame of frameSet.frames) for (const state of ['closed','raised']) {
    const anchor = frame[state];
    if (!anchor || !['x','y','w','h'].every(key => Number.isFinite(anchor[key]) && anchor[key] > 0 && anchor[key] <= 1)) throw new Error(`Invalid watch anchor: ${watch}`);
    if (anchor.x-anchor.w/2 < 0 || anchor.x+anchor.w/2 > 1 || anchor.y-anchor.h/2 < 0 || anchor.y+anchor.h/2 > 1) throw new Error(`Watch anchor outside frame: ${watch}`);
  }
  const relative = `./assets/watches-v4/${watch}-atlas.png`;
  const bytes = readFileSync(path.join(root, relative));
  if (!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error(`Invalid watch atlas PNG: ${watch}`);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (width !== frameSet.width || height !== frameSet.height || hash(bytes) !== frameSet.sha256) throw new Error(`Watch atlas metadata mismatch: ${watch}`);
  if (html.split(relative).length !== 2) throw new Error(`Missing watch atlas marker: ${watch}`);
  html = html.replace(relative, storeImage(bytes,'png'));
  watchAtlases.push({id:watch,width,height,bytes:bytes.length,sha256:hash(bytes),views:4,states:2});
}
writeFileSync(path.join(root, 'preview.html'), html);
mkdirSync(path.join(root, 'docs'), { recursive: true });
const receipt = { builtAt: new Date().toISOString(), sha256: createHash('sha256').update(html).digest('hex'), bytes: Buffer.byteLength(html), coverage: catalog.coverage, watchArt, watchAtlases, standalone: true, browserVerified: false, realHostVerified: false };
const entryFiles = ['extension.js', 'host-adapter.js', 'extension.css', 'preview.html', 'manifest.json'];
const files = [...entryFiles.map(file => {
  const bytes = readFileSync(path.join(root, file));
  return { path: file, bytes: bytes.length, sha256: hash(bytes) };
}), ...[...assetFiles.values()].sort((a,b) => a.path.localeCompare(b.path))];
const runtimeManifest = JSON.stringify({ schemaVersion: 1, files }, null, 2) + '\n';
if (files.length > 512 || files.some(file => file.bytes > 64*1024*1024) || files.reduce((n,file) => n+file.bytes,0) + Buffer.byteLength(runtimeManifest) > 256*1024*1024) throw new Error('Offline package exceeds installer bounds');
writeFileSync(path.join(root, 'runtime-manifest.json'), runtimeManifest);
Object.assign(receipt, { delivery: 'offline-directory', selfContainedHtml: false, runtimeFiles: files.length, runtimeBytes: files.reduce((n,file) => n+file.bytes,0), runtimeManifestSha256: hash(Buffer.from(runtimeManifest)) });
writeFileSync(path.join(root, 'docs/build-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
