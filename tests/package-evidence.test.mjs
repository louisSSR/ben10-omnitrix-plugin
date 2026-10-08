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

function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'omni-package-evidence-'));
  const root = path.join(dir, 'project');
  t.after(() => {
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(dir, { recursive: true, force: true });
  });
  const files = ['extension.js', 'host-adapter.js', 'extension.css', 'preview.html', 'README.md', 'NOTICE.md',
    'assets/provenance.json', 'assets/dial-fit.json', 'assets/watches-v3/provenance.json', 'assets/watches-v3/prompts.json',
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
});

test('package rejects traversal, backslash, absolute and remote supporting paths', t => {
  const f = fixture(t);
  for (const file of ['assets/source-art/../head.png', 'assets/source-art\\head.png', path.resolve(f.root, f.head), 'https://example.test/head.png']) {
    f.asset.supportingSources[0].file = file;
    const result = f.run();
    assert.notEqual(result.status, 0, file);
    assert.match(result.stderr, /Unsafe supporting source path/, file);
    assert.equal(existsSync(f.receipt), false);
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
});

test('package rejects a real supporting-source directory junction or symlink', t => {
  const f = fixture(t);
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
});
