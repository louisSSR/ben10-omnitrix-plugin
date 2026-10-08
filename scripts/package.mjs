import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(path.join(root, 'manifest.json'))).version;
const dir = path.join(root, 'dist', `ben10-omnitrix-${version}`);
mkdirSync(dir, { recursive:true });
const files = ['manifest.json','extension.js','host-adapter.js','extension.css','preview.html','README.md','NOTICE.md','assets/provenance.json','assets/dial-fit.json','assets/watches-v3/provenance.json','assets/watches-v3/prompts.json','docs/host-contract.md','docs/review-v2.md','docs/browser-qa-v2.json','docs/dial-animation-reference.md','docs/watch-generation-reference.md','docs/install-troubleshooting.md','docs/mobile-install.md','scripts/mobile-install.mjs','scripts/mobile-install.sh'];
const supplemental = JSON.parse(readFileSync(path.join(root, 'assets/extra-art.json')));
const reviewKey = version.replaceAll('.', '');
files.push('assets/extra-art.json', 'docs/build-receipt.json', `docs/review-v${reviewKey}.md`, `docs/browser-qa-v${reviewKey}.json`);
const browserQa = JSON.parse(readFileSync(path.join(root, `docs/browser-qa-v${reviewKey}.json`)));
for (const image of browserQa.screenshots) {
  if (!/^screenshots\/v[0-9]+-[a-z0-9-]+\.png$/.test(image)) throw new Error(`Unexpected evidence path: ${image}`);
  files.push(`docs/${image}`);
}
for (const file of new Set(supplemental.assets.flatMap(asset => [asset.sourceFile, asset.maskFile]))) {
  if (!/^assets\/source-art\/[a-z0-9-]+\.(?:png|jpe?g|webp)$/.test(file)) throw new Error(`Unexpected supplemental path: ${file}`);
  files.push(file);
}
for (const file of files) {
  if (!existsSync(path.join(root,file))) throw new Error(`Missing ${file}`);
  mkdirSync(path.dirname(path.join(dir,file)), { recursive:true });
  copyFileSync(path.join(root,file), path.join(dir,file));
}
const entries = files.map(file => ({ file, bytes:readFileSync(path.join(dir,file)).length, sha256:createHash('sha256').update(readFileSync(path.join(dir,file))).digest('hex') }));
writeFileSync(path.join(root,'dist',`package-${version}.json`),JSON.stringify({version,files:entries},null,2));
console.log(JSON.stringify({directory:dir,files:entries.length}));
