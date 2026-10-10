import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { createWatchMeshLoader, validateWatchMeshManifest } from '../watch-meshes.js';

function meshFixture(layout = 'pn6-f32le', watch = 'original') {
  const binaries = new Map(), parts = ['body', 'core'].map((group, index) => {
    const positions = [-.3, index * .2, -.3, .3, index * .2, -.3, 0, index * .2, .3];
    const values = new Float32Array(3 * (layout === 'pn6-f32le' ? 6 : 10));
    for (let vertex = 0; vertex < 3; vertex++) {
      const stride = layout === 'pn6-f32le' ? 6 : 10, offset = vertex * stride;
      values.set(positions.slice(vertex * 3, vertex * 3 + 3), offset); values.set([0, 1, 0], offset + 3);
      if (stride === 10) values.set([.2, .5, .1, vertex + 1], offset + 6);
    }
    const file = `./assets/watch-meshes/${watch}-${group}.bin`;
    binaries.set(new URL(file, 'https://test.invalid/preview.html').href, values.buffer);
    return { id: `${watch}-${group}`, group, file, vertices: 3, bytes: values.byteLength, material: [.2, .5, .1, 2] };
  });
  const manifest = { watch, modelKind: 'source-mesh', sourceArchiveSha256: 'a'.repeat(64), vertexLayout: layout, parts, face: { center: [0, .2, 0], radius: .25 }, lift: .32, bounds: { min: [-.3, 0, -.3], max: [.3, .2, .3] } };
  let fetched = 0;
  const fetchImpl = async url => { fetched++; return { ok: true, arrayBuffer: async () => binaries.get(url).slice(0) }; };
  return { manifest, binaries, fetchImpl, get fetched() { return fetched; } };
}
const loaderFor = (f, options = {}) => createWatchMeshLoader({ manifests: { [f.manifest.watch]: f.manifest }, baseUrl: 'https://test.invalid/preview.html', fetchImpl: f.fetchImpl, ...options });

test('PN6 source vertices and normals are preserved and fixed material becomes colors4', async () => {
  const f = meshFixture(), load = loaderFor(f), geometry = await load('original');
  assert.equal(geometry.modelKind, 'source-mesh'); assert.equal(geometry.sourceArchiveSha256, f.manifest.sourceArchiveSha256);
  assert.deepEqual(geometry.face, f.manifest.face); assert.deepEqual(geometry.bounds, f.manifest.bounds);
  for (const part of geometry.parts) {
    assert.ok(part.positions instanceof Float32Array); assert.ok(part.normals instanceof Float32Array); assert.ok(part.colors instanceof Float32Array);
    assert.deepEqual([...part.normals], [0, 1, 0, 0, 1, 0, 0, 1, 0]);
    assert.deepEqual(part.colors, new Float32Array([.2, .5, .1, 2, .2, .5, .1, 2, .2, .5, .1, 2]));
  }
  assert.equal(await load('original'), geometry); assert.equal(f.fetched, 2, 'completed geometry is cached');
  assert.equal(await load('omniverse'), null, 'absent generations keep their fallback');
  load.dispose(); assert.equal(load.peek('original'), null); await assert.rejects(load('original'), /disposed/);
});

test('PNC10 keeps triangle-region material tags without splitting more files', async () => {
  const f = meshFixture('pn-c10-f32le');
  for (const p of f.manifest.parts) delete p.material;
  const geometry = await loaderFor(f)('original');
  assert.deepEqual([...geometry.parts[0].colors].filter((_v, index) => index % 4 === 3), [1, 2, 3]);
  assert.equal(f.fetched, 2);
});

test('mesh validation rejects unsafe paths and over-budget models before fetching', async () => {
  for (const mutate of [
    m => { m.parts[0].file = 'https://elsewhere.invalid/mesh.bin'; },
    m => { m.parts[0].file = './assets/watch-meshes/../secret.bin'; },
    m => { m.parts[0].vertices = 450000; delete m.parts[0].bytes; },
    m => { m.parts[0].vertices = 4; },
    m => { m.parts[0].group = 'unknown'; },
    m => { m.parts[1].id = m.parts[0].id; },
    m => { m.sourceArchiveSha256 = 'unverified'; },
    m => { m.parts[0].bytes++; },
    m => { m.camera = { distance: .5, target: [0, 0, 0] }; },
    m => { m.camera = { distance: 5, target: [0, NaN, 0] }; },
  ]) {
    const f = meshFixture(); mutate(f.manifest);
    assert.throws(() => validateWatchMeshManifest(f.manifest));
    await assert.rejects(loaderFor(f)('original')); assert.equal(f.fetched, 0);
  }
});

test('optional source camera is copied without changing manifest coordinates', async () => {
  const f = meshFixture(); f.manifest.camera = { distance: 5.6, target: [-.080657, -.44124, 0] };
  const geometry = await loaderFor(f)('original');
  assert.deepEqual(geometry.camera, f.manifest.camera); assert.notEqual(geometry.camera.target, f.manifest.camera.target);
  geometry.camera.target[0] = 2; assert.equal(f.manifest.camera.target[0], -.080657);
});

test('retained complete source bodies load without inventing a detachable core', async () => {
  const f = meshFixture(); f.manifest.parts = f.manifest.parts.slice(0, 1);
  f.manifest.sourceMotion = { core: false, lids: false }; f.manifest.lift = 0;
  f.manifest.sourceFinish = 'source-preserved';
  const geometry = await loaderFor(f)('original');
  assert.equal(geometry.parts.length, 1); assert.equal(geometry.lift, 0);
  assert.deepEqual(geometry.sourceMotion, { core: false, lids: false });
  assert.equal(geometry.sourceFinish, 'source-preserved');
  geometry.sourceMotion.core = true; assert.equal(f.manifest.sourceMotion.core, false);
  for (const mutate of [
    m => { delete m.sourceMotion; }, m => { m.sourceMotion.core = true; },
    m => { m.lift = .1; }, m => { m.sourceMotion.lids = true; },
    m => { m.sourceMotion.core = 'false'; }, m => { m.sourceMotion.extra = false; },
    m => { m.sourceFinish = 'unknown'; },
  ]) {
    const changed = structuredClone(f.manifest); mutate(changed);
    assert.throws(() => validateWatchMeshManifest(changed));
  }
  const moving = meshFixture(); moving.manifest.sourceMotion = { core: false, lids: false };
  assert.throws(() => validateWatchMeshManifest(moving.manifest), /motion/);
});

test('bad binary size, bounds, finite values and non-unit normals cannot enter the cache', async () => {
  for (const mutate of [
    bytes => bytes.slice(4),
    bytes => { new Float32Array(bytes)[0] = 10; return bytes; },
    bytes => { new Float32Array(bytes)[0] = Infinity; return bytes; },
    bytes => { new Float32Array(bytes)[4] = 0; return bytes; },
    bytes => { new Float32Array(bytes)[4] = 1.004; return bytes; },
    bytes => { new Float32Array(bytes)[4] = NaN; return bytes; },
  ]) {
    const f = meshFixture(), first = f.binaries.keys().next().value;
    f.binaries.set(first, mutate(f.binaries.get(first)));
    const load = loaderFor(f); await assert.rejects(load('original')); assert.equal(load.peek('original'), null);
  }
  const f = meshFixture('pn-c10-f32le'), first = f.binaries.keys().next().value;
  new Float32Array(f.binaries.get(first))[9] = 7;
  await assert.rejects(loaderFor(f)('original'), /material/);
});

test('declared content hashes are checked when WebCrypto exists and HTTP without it remains usable', async () => {
  const f = meshFixture();
  for (const p of f.manifest.parts) p.sha256 = createHash('sha256').update(new Uint8Array(f.binaries.get(new URL(p.file, 'https://test.invalid/preview.html').href))).digest('hex');
  assert.equal((await loaderFor(f, { cryptoImpl: webcrypto })('original')).modelKind, 'source-mesh');
  f.manifest.parts[0].sha256 = 'b'.repeat(64);
  await assert.rejects(loaderFor(f, { cryptoImpl: webcrypto })('original'), /hash mismatch/);
  assert.equal((await loaderFor(f, { cryptoImpl: null })('original')).modelKind, 'source-mesh');
});

test('aborted late response never populates the CPU cache', async () => {
  const f = meshFixture(); let finish;
  const load = loaderFor(f, { fetchImpl: url => new Promise(resolve => { finish = () => resolve({ ok: true, arrayBuffer: async () => f.binaries.get(url).slice(0) }); }) });
  const controller = new AbortController(), pending = load('original', { signal: controller.signal });
  controller.abort(); finish();
  await assert.rejects(pending, error => error.name === 'AbortError'); assert.equal(load.peek('original'), null);
});

test('cache memory budget evicts older geometry and zero disables retention', async () => {
  const a = meshFixture(), b = meshFixture('pn6-f32le', 'recalibrated'), binaries = new Map([...a.binaries, ...b.binaries]);
  const load = createWatchMeshLoader({ manifests: { original: a.manifest, recalibrated: b.manifest }, baseUrl: 'https://test.invalid/preview.html', maxCachedBytes: 240, fetchImpl: async url => ({ ok: true, arrayBuffer: async () => binaries.get(url).slice(0) }) });
  await load('original'); assert.ok(load.peek('original'));
  await load('recalibrated'); assert.equal(load.peek('original'), null); assert.ok(load.peek('recalibrated'));
  const uncached = loaderFor(a, { maxCachedBytes: 0 }); await uncached('original'); assert.equal(uncached.peek('original'), null);
});
