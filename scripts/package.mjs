import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(path.join(root, 'manifest.json'))).version;
const dir = path.join(root, 'dist', `ben10-omnitrix-${version}`);
mkdirSync(dir, { recursive:true });
const files = ['manifest.json','extension.js','host-adapter.js','extension.css','preview.html','README.md','NOTICE.md','assets/provenance.json','docs/host-contract.md','docs/review.md','docs/browser-qa.json'];
for (const file of files) {
  if (!existsSync(path.join(root,file))) throw new Error(`Missing ${file}`);
  mkdirSync(path.dirname(path.join(dir,file)), { recursive:true });
  copyFileSync(path.join(root,file), path.join(dir,file));
}
const entries = files.map(file => ({ file, bytes:readFileSync(path.join(dir,file)).length, sha256:createHash('sha256').update(readFileSync(path.join(dir,file))).digest('hex') }));
writeFileSync(path.join(root,'dist',`package-${version}.json`),JSON.stringify({version,files:entries},null,2));
console.log(JSON.stringify({directory:dir,files:entries.length}));
