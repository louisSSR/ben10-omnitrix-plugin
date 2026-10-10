import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { createWatchMeshLoader } from '../watch-meshes.js';
import { watchPose, projectWatchFace } from '../watch-model.js';

const registry = JSON.parse(await readFile(new URL('../assets/watch-meshes/registry.json', import.meta.url), 'utf8'));
const load = createWatchMeshLoader({
  manifests: registry.watches, baseUrl: new URL('../preview.html', import.meta.url).href, cryptoImpl: webcrypto,
  fetchImpl: async url => { const bytes = await readFile(new URL(url)); return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }; },
});
const sources = new Map();

test('retained source mesh assets load with verified hashes and fit the per-generation triangle budget', async () => {
  assert.equal(registry.schemaVersion, 1); assert.deepEqual(Object.keys(registry.watches).sort(), ['omniverse', 'original', 'recalibrated', 'ultimatrix']);
  for (const [watch, manifest] of Object.entries(registry.watches)) {
    const geometry = await load(watch); sources.set(watch, geometry);
    assert.equal(geometry.modelKind, 'source-mesh'); assert.equal(geometry.sourceArchiveSha256, manifest.sourceArchiveSha256);
    const triangles = geometry.parts.reduce((count, part) => count + part.positions.length / 9, 0);
    assert.equal(triangles, manifest.triangles, `${watch}: no hidden source part was dropped at runtime`);
    assert.ok(triangles <= 150000, `${watch}: mobile triangle limit`);
    assert.equal(geometry.parts.length, manifest.parts.length);
    assert.equal(load.peek(watch), geometry, `${watch}: parsed geometry is cached`);
  }
});

test('every source-mesh vertex and projected dial fits every production camera and lift checkpoint', async () => {
  for (const watch of Object.keys(registry.watches)) {
    const geometry = sources.get(watch) || await load(watch);
    for (const mode of ['projection', 'dial']) for (const view of ['top', 'left', 'low', 'right']) for (const raised of [0, .25, .5, .75, 1]) {
      const pose = watchPose({ watch, mode, view, raised }, geometry);
      const ca = Math.cos(pose.azimuth), sa = Math.sin(pose.azimuth), ce = Math.cos(pose.elevation), se = Math.sin(pose.elevation), lens = Math.tan(pose.fov / 2);
      const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, near: Infinity, far: -Infinity };
      for (const part of geometry.parts) for (let i = 0; i < part.positions.length; i += 3) {
        const slide = part.group === 'lid-left' ? -pose.lidSlide : part.group === 'lid-right' ? pose.lidSlide : 0;
        const x = part.positions[i] + slide - pose.target[0], y = part.positions[i + 1] + (part.group === 'core' ? pose.lift : 0) - pose.target[1], z = part.positions[i + 2] - pose.target[2];
        const horizontal = x * ca - z * sa, rotatedZ = x * sa + z * ca, vertical = y * ce - rotatedZ * se, depth = pose.distance - y * se - rotatedZ * ce;
        const px = .5 + horizontal / (2 * depth * lens), py = .5 - vertical / (2 * depth * lens);
        bounds.minX = Math.min(bounds.minX, px); bounds.maxX = Math.max(bounds.maxX, px); bounds.minY = Math.min(bounds.minY, py); bounds.maxY = Math.max(bounds.maxY, py); bounds.near = Math.min(bounds.near, depth); bounds.far = Math.max(bounds.far, depth);
      }
      const label = `${watch}/${mode}/${view}/${raised}: ${JSON.stringify(bounds)}`;
      assert.ok(Object.values(bounds).every(Number.isFinite), label);
      assert.ok(bounds.minX >= 0 && bounds.maxX <= 1 && bounds.minY >= 0 && bounds.maxY <= 1 && bounds.near > .1 && bounds.far < 25, label);
      const face = projectWatchFace(geometry, pose, 1), angle = face.a * Math.PI / 180;
      const extentX = Math.hypot(face.w / 2 * Math.cos(angle), face.h / 2 * Math.sin(angle));
      const extentY = Math.hypot(face.w / 2 * Math.sin(angle), face.h / 2 * Math.cos(angle));
      assert.equal(face.visible, true, `${label}: visible face`);
      assert.ok(face.x - extentX >= 0 && face.x + extentX <= 1 && face.y - extentY >= 0 && face.y + extentY <= 1, `${label}: projected overlay remains in the canvas`);
      if (mode === 'dial') { assert.equal(pose.lift, 0); assert.equal(face.a, 0); }
    }
  }
});
