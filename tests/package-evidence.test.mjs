import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const packageScript = new URL('../scripts/package.mjs', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const writeJson = (file, data) => writeFileSync(file, JSON.stringify(data));
const gif89a = Buffer.from('47494638396101000100800000000000ffffff2c00000000010001000002024401003b', 'hex');
const gif87a = Buffer.concat([Buffer.from('GIF87a'), gif89a.subarray(6)]);
const retainGif = (f, name, bytes = gif89a) => {
  const file = `assets/source-art/${name}.gif`;
  writeFileSync(path.join(f.root, file), bytes);
  return { file, sha256: sha(bytes) };
};

function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'omni-package-evidence-'));
  const root = path.join(dir, 'project');
  t.after(() => {
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(dir, { recursive: true, force: true });
  });
  const files = ['extension.js', 'host-adapter.js', 'extension.css', 'preview.html', 'README.md', 'NOTICE.md',
    'assets/provenance.json', 'assets/dial-fit.json', 'assets/watches-v3/provenance.json', 'assets/watches-v3/prompts.json',
    'assets/watches-v4/views.json', 'assets/watches-v4/original-generation.json', 'assets/watches-v4/recalibrated-generation.json',
    'assets/watches-v4/ultimatrix-generation.json', 'assets/watches-v4/omniverse-generation.json',
    'docs/host-contract.md', 'docs/review-v2.md', 'docs/browser-qa-v2.json', 'docs/dial-animation-reference.md',
    'docs/watch-generation-reference.md', 'docs/install-troubleshooting.md', 'docs/mobile-install.md',
    'scripts/mobile-install.mjs', 'scripts/mobile-install.sh', 'docs/build-receipt.json', 'docs/review-v001.md',
    'assets/source-art/body.png', 'assets/source-art/mask.png', 'assets/source-art/head.png',
    'docs/screenshots/v001-mobile.png'];
  for (const file of files) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), Buffer.from('retained fixture bytes: ' + file));
  }
  copyFileSync(packageScript, path.join(root, 'scripts/package.mjs'));
  writeJson(path.join(root, 'manifest.json'), { version: '0.0.1' });
  const entryFiles = ['manifest.json', 'extension.js', 'host-adapter.js', 'extension.css', 'preview.html'];
  writeJson(path.join(root, 'runtime-manifest.json'), { schemaVersion: 1, files: entryFiles.map(file => {
    const bytes = readFileSync(path.join(root, file));
    return { path: file, bytes: bytes.length, sha256: sha(bytes) };
  }) });
  writeJson(path.join(root, 'docs/browser-qa-v001.json'), { screenshots: ['screenshots/v001-mobile.png'] });
  const head = 'assets/source-art/head.png';
  const asset = { formId: 'fixture', sourceFile: 'assets/source-art/body.png', maskFile: 'assets/source-art/mask.png',
    supportingSources: [{ file: head, sha256: sha(readFileSync(path.join(root, head))) }] };
  const plan = { schemaVersion: 1, assets: [asset] };
  const run = () => {
    writeJson(path.join(root, 'assets/extra-art.json'), plan);
    return spawnSync(process.execPath, ['scripts/package.mjs'], { cwd: root, encoding: 'utf8' });
  };
  return { dir, root, head, asset, plan, run, output: path.join(root, 'dist/ben10-omnitrix-0.0.1'), receipt: path.join(root, 'dist/package-0.0.1.json') };
}

test('package copies supporting evidence bytes and lists repeated/shared files once', t => {
  const f = fixture(t);
  const body = f.asset.sourceFile;
  const gifs = [retainGif(f, 'clip-87', gif87a), retainGif(f, 'clip-89')];
  f.asset.supportingSources.push(...gifs, { ...gifs[0] });
  f.asset.supportingSources.push({ ...f.asset.supportingSources[0] }, { file: body, sha256: sha(readFileSync(path.join(f.root, body))) });
  f.plan.assets.push({ ...f.asset, formId: 'second-fixture' });
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(path.join(f.output, f.head)), readFileSync(path.join(f.root, f.head)));
  const receipt = JSON.parse(readFileSync(f.receipt));
  assert.equal(receipt.files.filter(row => row.file === f.head).length, 1);
  assert.equal(receipt.files.filter(row => row.file === body).length, 1);
  const retained = receipt.files.find(row => row.file === f.head);
  assert.equal(retained.sha256, f.asset.supportingSources[0].sha256);
  assert.equal(retained.bytes, readFileSync(path.join(f.output, f.head)).length);
  for (const gif of gifs) {
    assert.deepEqual(readFileSync(path.join(f.output, gif.file)), readFileSync(path.join(f.root, gif.file)));
    assert.equal(receipt.files.filter(row => row.file === gif.file).length, 1);
    assert.equal(receipt.files.find(row => row.file === gif.file).sha256, gif.sha256);
  }
});

test('package rejects corrupted supporting evidence before any package files are copied', t => {
  const f = fixture(t);
  writeFileSync(path.join(f.root, f.head), 'changed after source receipt');
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid supporting source hash/);
  assert.equal(existsSync(f.receipt), false);
  assert.equal(existsSync(path.join(f.output, 'manifest.json')), false);
  assert.equal(existsSync(path.join(f.output, f.head)), false);
  for (const bytes of [Buffer.from('GIF89'), Buffer.from('GIF90a'), Buffer.from('NOTGIF-body'), Buffer.concat([Buffer.from([0xc7]), gif89a.subarray(1)])]) {
    const gif = retainGif(f, 'invalid-clip', bytes);
    f.asset.supportingSources = [gif];
    const invalid = f.run();
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Invalid supporting GIF signature/);
    assert.equal(existsSync(f.receipt), false);
    assert.equal(existsSync(path.join(f.output, 'manifest.json')), false);
    assert.equal(existsSync(path.join(f.output, gif.file)), false);
  }
});

test('package rejects traversal, backslash, absolute and remote supporting paths', t => {
  const f = fixture(t);
  for (const file of ['assets/source-art/../head.png', 'assets/source-art\\head.png', path.resolve(f.root, f.head), 'https://example.test/head.png',
    'assets/source-art/../clip.gif', 'assets/source-art\\clip.gif', path.resolve(f.root, 'assets/source-art/clip.gif'), 'https://example.test/clip.gif']) {
    f.asset.supportingSources[0].file = file;
    const result = f.run();
    assert.notEqual(result.status, 0, file);
    assert.match(result.stderr, /Unsafe supporting source path/, file);
    assert.equal(existsSync(f.receipt), false);
  }
  const gif = retainGif(f, 'primary-clip');
  for (const field of ['sourceFile', 'maskFile']) {
    const original = f.asset[field];
    f.asset[field] = gif.file;
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unexpected supplemental path/);
    assert.equal(existsSync(f.receipt), false);
    f.asset[field] = original;
  }
});

test('package rejects malformed or conflicting supporting SHA even for a duplicated file', t => {
  const f = fixture(t);
  f.asset.supportingSources[0].sha256 = 'not-a-sha256';
  let result = f.run();
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Invalid supporting source SHA/);
  const good = { file: f.head, sha256: sha(readFileSync(path.join(f.root, f.head))) };
  f.asset.supportingSources = [good, { ...good, sha256: '0'.repeat(64) }];
  result = f.run();
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Invalid supporting source hash/);
  assert.equal(existsSync(f.receipt), false);
  const gif = retainGif(f, 'hash-clip');
  f.asset.supportingSources = [gif, { ...gif, sha256: '0'.repeat(64) }];
  result = f.run();
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Invalid supporting source hash/);
  assert.equal(existsSync(f.receipt), false);
});

test('package rejects a real supporting-source directory junction or symlink', t => {
  const f = fixture(t);
  const gif = retainGif(f, 'linked-clip');
  const source = path.join(f.root, 'assets/source-art');
  const outside = path.join(f.dir, 'outside-source-art');
  assert.ok(source.startsWith(f.dir + path.sep)); assert.ok(outside.startsWith(f.dir + path.sep));
  renameSync(source, outside);
  symlinkSync(outside, source, process.platform === 'win32' ? 'junction' : 'dir');
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsafe supporting source link/);
  assert.equal(existsSync(f.receipt), false);
  assert.equal(existsSync(path.join(f.output, f.head)), false);
  f.asset.supportingSources = [gif];
  const gifResult = f.run();
  assert.notEqual(gifResult.status, 0);
  assert.match(gifResult.stderr, /Unsafe supporting source link/);
  assert.equal(existsSync(f.receipt), false);
  assert.equal(existsSync(path.join(f.output, gif.file)), false);
});
