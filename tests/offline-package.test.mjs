import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('offline manifest exactly covers entry files and all local image references', () => {
  const manifest = JSON.parse(read('runtime-manifest.json'));
  const html = read('preview.html').toString('utf8');
  const refs = [...html.matchAll(/(?:href|src)="\.\/(assets\/runtime\/[a-f0-9]{64}\.(?:png|avif))"/g)].map(x => x[1]);
  const expected = new Set(['extension.js','host-adapter.js','extension.css','preview.html','manifest.json',...refs]);
  assert.equal(manifest.schemaVersion,1);assert.equal(manifest.files.length,expected.size);
  assert.deepEqual(new Set(manifest.files.map(x=>x.path)),expected);
  assert.ok(refs.length>=172);assert.doesNotMatch(html,/data:image\//);
  for (const file of manifest.files) {
    const raw=read(file.path);assert.equal(raw.length,file.bytes,file.path);assert.equal(sha(raw),file.sha256,file.path);
    if(file.path.startsWith('assets/')) assert.ok(file.path.includes(file.sha256),file.path);
  }
  const receipt=JSON.parse(read('docs/build-receipt.json'));
  assert.equal(receipt.runtimeManifestSha256,sha(read('runtime-manifest.json')));
  assert.equal(receipt.runtimeFiles,manifest.files.length);
  assert.equal(receipt.runtimeBytes,manifest.files.reduce((sum,f)=>sum+f.bytes,0));
  assert.equal(receipt.selfContainedHtml,false);assert.equal(receipt.delivery,'offline-directory');
  assert.ok(read('preview.html').length<1024*1024,'HTML remains a small entry rather than a growing image archive');
});
test('art externalization round-trips original bytes, is idempotent and rejects corrupt content paths', t => {
  const dir=mkdtempSync(path.join(tmpdir(),'omni-art-paths-'));
  t.after(()=>{assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep));rmSync(dir,{recursive:true,force:true});});
  mkdirSync(path.join(dir,'assets'));copyFileSync(new URL('scripts/art_files.py',root),path.join(dir,'art_files.py'));
  const script=`from pathlib import Path
from art_files import externalize_svg,hydrate_svg,image_bytes
import base64,hashlib
assets=Path('assets'); raw=b'opaque-original-image-file-bytes'; uri='data:image/png;base64,'+base64.b64encode(raw).decode()
source=('<svg><symbol id="alien-fixture"><image href="'+uri+'"/></symbol></svg>').encode()
local=externalize_svg(source,assets)
assert hydrate_svg(local,assets)==source
assert externalize_svg(local,assets)==local
file=next((assets/'runtime').iterdir()); assert file.read_bytes()==raw
file.write_bytes(b'tampered')
try: hydrate_svg(local,assets)
except ValueError: pass
else: raise AssertionError('accepted altered bytes')
for uri in ('../escape.png','https://example.test/image.png','runtime/../../../escape.png'):
    try: image_bytes(uri,assets)
    except ValueError: pass
    else: raise AssertionError('accepted unsafe reference')
print('roundtrip and rejection verified')`;
  writeFileSync(path.join(dir,'check.py'),script);
  const result=spawnSync(process.env.PYTHON||'python',['check.py'],{cwd:dir,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/roundtrip and rejection verified/);
});
