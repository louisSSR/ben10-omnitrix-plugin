import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(path.join(root, 'manifest.json'))).version;
const dir = path.join(root, 'dist', `ben10-omnitrix-${version}`);
mkdirSync(dir, { recursive:true });
const files = ['manifest.json','extension.js','host-adapter.js','extension.css','preview.html','README.md','NOTICE.md','assets/provenance.json','assets/dial-fit.json','assets/watches-v3/provenance.json','assets/watches-v3/prompts.json','docs/host-contract.md','docs/review-v2.md','docs/browser-qa-v2.json','docs/dial-animation-reference.md','docs/watch-generation-reference.md','docs/install-troubleshooting.md','docs/mobile-install.md','scripts/mobile-install.mjs','scripts/mobile-install.sh'];
const runtime = JSON.parse(readFileSync(path.join(root, 'runtime-manifest.json')));
if (runtime.schemaVersion !== 1 || !Array.isArray(runtime.files)) throw new Error('Invalid runtime manifest');
files.push('runtime-manifest.json');
for (const entry of runtime.files) {
  if (!/^(?:extension\.js|host-adapter\.js|extension\.css|preview\.html|manifest\.json|assets\/runtime\/[a-f0-9]{64}\.(?:png|avif))$/.test(entry.path)) throw new Error('Unsafe runtime path');
  const raw = readFileSync(path.join(root, entry.path));
  if (raw.length !== entry.bytes || createHash('sha256').update(raw).digest('hex') !== entry.sha256) throw new Error(`Stale runtime file: ${entry.path}`);
  if (!files.includes(entry.path)) files.push(entry.path);
}
const supplemental = JSON.parse(readFileSync(path.join(root, 'assets/extra-art.json')));
const reviewKey = version.replaceAll('.', '');
files.push('assets/extra-art.json', 'docs/build-receipt.json', `docs/review-v${reviewKey}.md`, `docs/browser-qa-v${reviewKey}.json`);
if (existsSync(path.join(root, `docs/asset-migration-v${reviewKey}.json`))) files.push(`docs/asset-migration-v${reviewKey}.json`);
const browserQa = JSON.parse(readFileSync(path.join(root, `docs/browser-qa-v${reviewKey}.json`)));
for (const image of browserQa.screenshots) {
  if (!/^screenshots\/v[0-9]+-[a-z0-9-]+\.png$/.test(image)) throw new Error(`Unexpected evidence path: ${image}`);
  files.push(`docs/${image}`);
}
for (const file of new Set(supplemental.assets.flatMap(asset => [asset.sourceFile, asset.maskFile]))) {
  if (!/^assets\/source-art\/[a-z0-9-]+\.(?:png|jpe?g|webp)$/.test(file)) throw new Error(`Unexpected supplemental path: ${file}`);
  files.push(file);
}
for (const asset of supplemental.assets.filter(asset => asset.sourceFrame?.containerFile)) {
  const { containerFile, containerSha256 } = asset.sourceFrame;
  if (!/^assets\/source-art\/[a-z0-9-]+\.gif$/.test(containerFile) || createHash('sha256').update(readFileSync(path.join(root,containerFile))).digest('hex') !== containerSha256) throw new Error('Invalid retained source container');
  if (!files.includes(containerFile)) files.push(containerFile);
}
for (const file of files) {
  if (!existsSync(path.join(root,file))) throw new Error(`Missing ${file}`);
  mkdirSync(path.dirname(path.join(dir,file)), { recursive:true });
  copyFileSync(path.join(root,file), path.join(dir,file));
}
const entries = files.map(file => ({ file, bytes:readFileSync(path.join(dir,file)).length, sha256:createHash('sha256').update(readFileSync(path.join(dir,file))).digest('hex') }));
writeFileSync(path.join(root,'dist',`package-${version}.json`),JSON.stringify({version,files:entries},null,2));
console.log(JSON.stringify({directory:dir,files:entries.length}));
