import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const python = process.env.PYTHON || 'python';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value), 'utf8');

// A tiny valid PNG with transparent margins, faint pixels and alpha below 255.
// Its geometry is independent of any production character or generated image.
function fixturePng({ indexed = false, transparent = true } = {}) {
  const chunk = (type, bytes) => {
    const body = Buffer.concat([Buffer.from(type), bytes]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, body, checksum]);
  };
  const width = 8, height = 12, header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = indexed ? 3 : 6;
  if (indexed) {
    const pixels = Buffer.alloc((width + 1) * height);
    for (let y = 2; y < 10; y++) for (let x = 2; x < 6; x++) pixels[y * (width + 1) + x + 1] = 1;
    return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
      chunk('PLTE', Buffer.from([23, 200, 71, 11, 22, 33])),
      ...(transparent ? [chunk('tRNS', Buffer.from([0, 254]))] : []),
      chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
  }
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 2; y < 10; y++) for (let x = 2; x < 6; x++) pixels[y * (width * 4 + 1) + 1 + x * 4 + 3] = 254;
  pixels[(width * 4 + 1) + 1 + 4 + 3] = 1;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ben10-extra-art-'));
  t.after(() => {
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(dir, { recursive: true, force: true });
  });
  for (const folder of ['scripts', 'assets/source-art', 'snapshot']) mkdirSync(path.join(dir, folder), { recursive: true });
  for (const file of ['extra_art.py', 'import-catalog.py', 'fit-dial.py', 'art_files.py']) copyFileSync(path.join(root, 'scripts', file), path.join(dir, 'scripts', file));
  const png = fixturePng();
  writeFileSync(path.join(dir, 'assets/source-art/source.png'), png);
  writeFileSync(path.join(dir, 'assets/source-art/mask.png'), png);
  const forms = [
    { id: 'seed', name: '已审查', en: 'Seed', group: 'os', appearance: 'Fixture Edition', aliases: [], asset: 'alien-seed', sourceUrls: ['https://example.test/seed'], visualVerified: true },
    { id: 'target', name: '目标', en: 'Target', group: 'ua', appearance: 'Fixture Edition', aliases: ['Existing Alias'], asset: null, sourceUrls: ['https://example.test/target'], visualVerified: false },
    { id: 'old-target', name: '旧名称', en: 'Target (Old label)', group: 'ua', appearance: 'Fixture Edition', aliases: ['Legacy spelling'], asset: null, sourceUrls: ['https://example.test/old'], visualVerified: false }
  ];
  const catalog = { schemaVersion: 1, groups: [], coverage: { total: 3, reviewed: 1, missing: 2 }, forms };
  const symbol = `<symbol id="alien-seed" viewBox="0 0 200 240"><image href="data:image/png;base64,${png.toString('base64')}" width="200" height="240"/></symbol>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">${symbol}</svg>`;
  const plan = { schemaVersion: 1, assets: [{
    formId: 'target', sourceFile: 'assets/source-art/source.png', maskFile: 'assets/source-art/mask.png',
    sourceSha256: digest(png), maskSha256: digest(png), sourceViewed: true, maskViewed: true,
    pageUrl: 'https://example.test/source-page', url: 'https://example.test/source.png', rights: 'Fixture only',
    renderMode: 'reference-guided-edit-alpha', artProvenance: 'fixture-reference-edit'
  }], mergedForms: [{ from: 'old-target', into: 'target' }] };
  const provenance = { assets: [{ formId: 'seed', url: 'https://example.test/seed' }], coverage: catalog.coverage };
  writeJson(path.join(dir, 'assets/catalog.json'), catalog);
  writeFileSync(path.join(dir, 'assets/silhouettes.svg'), svg);
  writeJson(path.join(dir, 'assets/provenance.json'), provenance);
  writeJson(path.join(dir, 'assets/extra-art.json'), plan);
  writeJson(path.join(dir, 'snapshot/catalog.json'), catalog);
  writeFileSync(path.join(dir, 'snapshot/display-library-cache-v2.svg'), svg);
  writeJson(path.join(dir, 'snapshot/display-library-cache-v2.json'), {
    sha256: digest(Buffer.from(svg)), catalogJsonSha256: digest(readFileSync(path.join(dir, 'snapshot/catalog.json'))), nativePixelEquivalencePassed: true
  });
  writeJson(path.join(dir, 'snapshot/source-art-manifest.json'), { assets: [{ formId: 'seed', url: 'https://example.test/seed' }] });
  return { dir, png, plan, catalog, svg, provenance };
}

function runPython(f, args) {
  return spawnSync(python, args, { cwd: f.dir, encoding: 'utf8', maxBuffer: 1024 * 1024,
    env: { ...process.env, PYTHONOPTIMIZE: '', PYTHONDONTWRITEBYTECODE: '1' } });
}

const mergeHarness = `import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(sys.argv[1])/'scripts'))
from extra_art import merge_extra_art
root=Path(sys.argv[1]); catalog=json.loads((root/'assets/catalog.json').read_text(encoding='utf-8')); svg=(root/'assets/silhouettes.svg').read_bytes(); provenance=json.loads((root/'assets/provenance.json').read_text(encoding='utf-8'))
for _ in range(int(sys.argv[2])): catalog,svg,provenance=merge_extra_art(catalog,svg,provenance)
print(json.dumps({'catalog':catalog,'svg':svg.decode(),'provenance':provenance}))`;

function merge(f, times = 1, optimize = false) {
  return runPython(f, [...(optimize ? ['-O'] : []), '-c', mergeHarness, f.dir, String(times)]);
}

function merged(f, times = 1) {
  const result = merge(f, times);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}

function savePlan(f) { writeJson(path.join(f.dir, 'assets/extra-art.json'), f.plan); }
function reject(result, message) {
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0, message + ': unexpectedly accepted');
  assert.doesNotMatch(result.stderr, /UnicodeDecodeError|ModuleNotFoundError|FileNotFoundError/, 'fixture setup must not masquerade as validation rejection');
}

test('current supplemental registry binds both original and reviewed mask bytes', () => {
  const plan = readJson(path.join(root, 'assets/extra-art.json'));
  assert.equal(new Set(plan.assets.map(entry => entry.formId)).size, plan.assets.length);
  for (const entry of plan.assets) {
    assert.equal(entry.sourceViewed, true, entry.formId);
    assert.equal(entry.maskViewed, true, entry.formId);
    for (const kind of ['source', 'mask']) assert.equal(digest(readFileSync(path.join(root, entry[kind + 'File']))), entry[kind + 'Sha256'], `${entry.formId} ${kind}`);
  }
});

test('reviewed supplement merges one body, provenance and old selected ID without duplicates', t => {
  const f = fixture(t), result = merged(f), target = result.catalog.forms.find(form => form.id === 'target');
  assert.deepEqual(result.catalog.coverage, { total: 2, reviewed: 2, missing: 0 });
  assert.deepEqual(result.provenance.coverage, result.catalog.coverage);
  assert.equal(target.asset, 'alien-target');
  assert.ok(target.aliases.includes('old-target'));
  assert.ok(target.aliases.includes('Target (Old label)'));
  assert.ok(target.aliases.includes('Existing Alias'));
  assert.deepEqual(target.sourceUrls, ['https://example.test/target', 'https://example.test/old']);
  assert.match(target.artSourceLabel, /not official/);
  assert.equal((result.svg.match(/id="alien-target"/g) || []).length, 1);
  assert.equal(result.provenance.assets.filter(asset => asset.formId === 'target').length, 1);
  assert.equal(result.provenance.svgSha256, digest(Buffer.from(result.svg)));
});

test('palette transparency remains byte-exact and yields a body fit; an opaque palette is rejected', t => {
  const f = fixture(t), file = path.join(f.dir, f.plan.assets[0].maskFile);
  const indexed = fixturePng({ indexed: true });
  writeFileSync(file, indexed); f.plan.assets[0].maskSha256 = digest(indexed); savePlan(f);
  assert.ok(merged(f).svg.includes(indexed.toString('base64')));
  const result = runPython(f, [path.join(f.dir, 'scripts/extra_art.py')]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(file), indexed);
  const fit = readJson(path.join(f.dir, 'assets/dial-fit.json')).fits.target;
  assert.equal(fit.visiblePixels, 32);
  assert.ok(fit.diamondExtent * fit.scale <= .87);
  const opaque = fixturePng({ indexed: true, transparent: false });
  writeFileSync(file, opaque); f.plan.assets[0].maskSha256 = digest(opaque); savePlan(f);
  const invalid = merge(f); reject(invalid, 'palette without alpha');
  assert.match(invalid.stderr, /Missing alpha/);
});

for (const kind of ['source', 'mask']) {
  test(`${kind} byte tampering is rejected even when review flags remain true`, t => {
    const f = fixture(t);
    const file = path.join(f.dir, f.plan.assets[0][kind + 'File']);
    writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from('changed')]));
    reject(merge(f), `${kind} hash mismatch`);
  });
  test(`${kind} review must be the boolean true`, t => {
    const f = fixture(t);
    for (const invalid of [false, null, 'true', 1]) {
      f.plan.assets[0][kind + 'Viewed'] = invalid; savePlan(f);
      reject(merge(f), `${kind} review=${JSON.stringify(invalid)}`);
    }
    delete f.plan.assets[0][kind + 'Viewed']; savePlan(f);
    reject(merge(f), `${kind} review absent`);
  });
}

test('hash and review gates still reject tampering under Python optimization', t => {
  const f = fixture(t);
  f.plan.assets[0].sourceViewed = false; savePlan(f);
  writeFileSync(path.join(f.dir, f.plan.assets[0].sourceFile), Buffer.from('different original'));
  reject(merge(f, 1, true), 'optimized Python must retain safety checks');
});

test('duplicate supplement entries and conflicting existing symbols are rejected', t => {
  const f = fixture(t);
  f.plan.assets.push(structuredClone(f.plan.assets[0])); savePlan(f);
  reject(merge(f), 'duplicate formId');
  f.plan.assets.pop(); savePlan(f);
  writeFileSync(path.join(f.dir, 'assets/silhouettes.svg'), f.svg.replace('</svg>', '<symbol id="alien-target" viewBox="0 0 200 240"><path d="M0 0"/></symbol></svg>'));
  reject(merge(f), 'conflicting body');
});

test('merging edition duplicates preserves every searchable legacy alias', t => {
  const f = fixture(t), result = merged(f), aliases = result.catalog.forms.find(form => form.id === 'target').aliases;
  for (const alias of f.catalog.forms.find(form => form.id === 'old-target').aliases) assert.ok(aliases.includes(alias), `lost old alias: ${alias}`);
});

test('merges reject a different edition or a second already reviewed body', t => {
  const f = fixture(t), file = path.join(f.dir, 'assets/catalog.json');
  f.catalog.forms.find(form => form.id === 'old-target').appearance = 'Different Edition'; writeJson(file, f.catalog);
  reject(merge(f), 'different appearance');
  f.catalog.forms.find(form => form.id === 'old-target').appearance = 'Fixture Edition';
  f.catalog.forms.find(form => form.id === 'old-target').asset = 'alien-old-target'; writeJson(file, f.catalog);
  reject(merge(f), 'already reviewed distinct source');
});

test('repeating the same merge is byte-for-byte and structurally idempotent', t => {
  const f = fixture(t);
  assert.deepEqual(merged(f, 2), merged(f, 1));
});

test('snapshot import retains supplements and repeated imports produce identical output', t => {
  const f = fixture(t), importer = path.join(f.dir, 'scripts/import-catalog.py');
  const files = ['catalog.json', 'silhouettes.svg', 'provenance.json', 'dial-fit.json'];
  const run = () => {
    const result = runPython(f, [importer, path.join(f.dir, 'snapshot')]);
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return files.map(file => digest(readFileSync(path.join(f.dir, 'assets', file))));
  };
  const first = run();
  assert.deepEqual(run(), first);
  const catalog = readJson(path.join(f.dir, 'assets/catalog.json'));
  assert.deepEqual(catalog.coverage, { total: 2, reviewed: 2, missing: 0 });
  assert.ok(catalog.forms.find(form => form.id === 'target').aliases.includes('old-target'));
  assert.equal(readJson(path.join(f.dir, 'assets/dial-fit.json')).bitmapEdits, 0);
  assert.equal(readJson(path.join(f.dir, 'assets/provenance.json')).catalogSha256, digest(readFileSync(path.join(f.dir, 'assets/catalog.json'))));
});

test('invalid mask decoding cannot partially overwrite a previously valid import', t => {
  const f = fixture(t), mask = f.png.subarray(0, 33);
  writeFileSync(path.join(f.dir, f.plan.assets[0].maskFile), mask);
  f.plan.assets[0].maskSha256 = digest(mask); savePlan(f);
  const files = ['catalog.json', 'silhouettes.svg', 'provenance.json'];
  const before = files.map(file => digest(readFileSync(path.join(f.dir, 'assets', file))));
  const result = runPython(f, [path.join(f.dir, 'scripts/import-catalog.py'), path.join(f.dir, 'snapshot')]);
  reject(result, 'truncated PNG');
  const after = files.map(file => digest(readFileSync(path.join(f.dir, 'assets', file))));
  assert.deepEqual(after, before, 'failed validation changed live output files');
  assert.equal(existsSync(path.join(f.dir, 'assets/dial-fit.json')), false);
});

test('optimized snapshot import rejects changed baseline bytes before output writes', t => {
  const f = fixture(t), file = path.join(f.dir, 'snapshot/display-library-cache-v2.svg');
  writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from('\nchanged')]));
  const before = readFileSync(path.join(f.dir, 'assets/catalog.json'));
  reject(runPython(f, ['-O', path.join(f.dir, 'scripts/import-catalog.py'), path.join(f.dir, 'snapshot')]), 'snapshot hash');
  assert.deepEqual(readFileSync(path.join(f.dir, 'assets/catalog.json')), before);
});
