import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');
const catalog = JSON.parse(read('assets/catalog.json'));
const css = read('styles.css');
const core = read('core.js').replace(/^export /gm, '');
const code = read('app.js').replace(/^import[^\n]+\n/, '');
const svg = read('assets/silhouettes.svg');
if (/<script\b|\bon\w+\s*=/i.test(svg) || /(?:href|src)=["']https?:/i.test(svg)) throw new Error('Unsafe image library');
const symbols = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
let html = read('preview.shell.html');
const replacements = {
  '/* APP_STYLES */': css,
  '<!-- ART_SYMBOLS -->': `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" style="position:absolute;overflow:hidden">${symbols}</svg>`,
  '<!-- CATALOG_DATA -->': JSON.stringify(catalog).replace(/</g, '\\u003c'),
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
  html = html.replace(relative, `data:image/png;base64,${bytes.toString('base64')}`);
  watchArt.push({ id: watch, width, height, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
if (/<(?:script|img)\b[^>]*src=["']https?:/i.test(html)) throw new Error('Unexpected remote runtime asset');
writeFileSync(path.join(root, 'preview.html'), html);
mkdirSync(path.join(root, 'docs'), { recursive: true });
const receipt = { builtAt: new Date().toISOString(), sha256: createHash('sha256').update(html).digest('hex'), bytes: Buffer.byteLength(html), coverage: catalog.coverage, watchArt, standalone: true, browserVerified: false, realHostVerified: false };
writeFileSync(path.join(root, 'docs/build-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
