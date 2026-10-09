import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildWatchGeometry, watchPose, projectWatchFace, createWatchModel } from '../watch-model.js';

const watches = ['original', 'recalibrated', 'ultimatrix', 'omniverse'];
const views = ['top', 'left', 'low', 'right'];
const geometryDigest = geometry => {
  const hash = createHash('sha256');
  for (const part of geometry.parts) {
    for (const values of [part.positions, part.normals, part.colors]) {
      hash.update(Buffer.from(values.buffer, values.byteOffset, values.byteLength));
    }
  }
  hash.update(JSON.stringify({ face: geometry.face, bounds: geometry.bounds }));
  return hash.digest('hex');
};

test('all watch meshes have finite lit triangles, bounded coordinates and actual three-axis volume', () => {
  const shapes = new Set();
  for (const watch of watches) {
    const geometry = buildWatchGeometry(watch);
    assert.equal(geometry.watch, watch);
    assert.ok(geometry.parts.some(part => part.group === 'body'), `${watch}: fixed body`);
    assert.ok(geometry.parts.some(part => part.group === 'core'), `${watch}: separate moving core`);
    const shape = createHash('sha256');
    const observed = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const part of geometry.parts) {
      assert.ok(part.positions instanceof Float32Array, `${watch}/${part.id}: typed positions`);
      assert.ok(part.normals instanceof Float32Array, `${watch}/${part.id}: typed normals`);
      assert.ok(part.colors instanceof Float32Array, `${watch}/${part.id}: typed colors`);
      assert.ok(part.positions.length > 0 && part.positions.length % 9 === 0, `${watch}/${part.id}: triangles`);
      assert.equal(part.normals.length, part.positions.length, `${watch}/${part.id}: normal per vertex`);
      assert.equal(part.colors.length, part.positions.length / 3 * 4, `${watch}/${part.id}: color per vertex`);
      shape.update(Buffer.from(part.positions.buffer, part.positions.byteOffset, part.positions.byteLength));
      for (const values of [part.positions, part.normals, part.colors]) assert.ok(values.every(Number.isFinite), `${watch}/${part.id}: finite buffers`);
      for (let i = 0; i < part.positions.length; i += 3) {
        const normalLength = Math.hypot(...part.normals.subarray(i, i + 3));
        assert.ok(Math.abs(normalLength - 1) < .003, `${watch}/${part.id}: usable unit normal`);
        for (let axis = 0; axis < 3; axis++) {
          const value = part.positions[i + axis];
          observed.min[axis] = Math.min(observed.min[axis], value);
          observed.max[axis] = Math.max(observed.max[axis], value);
          assert.ok(value >= geometry.bounds.min[axis] - 1e-5 && value <= geometry.bounds.max[axis] + 1e-5,
            `${watch}/${part.id}: camera-fit bounds include the vertex`);
        }
      }
    }
    for (let axis = 0; axis < 3; axis++) assert.ok(observed.max[axis] - observed.min[axis] > .1, `${watch}: volume on axis ${axis}`);
    assert.ok(geometry.face.center.every(Number.isFinite) && geometry.face.radius > 0 && geometry.lift > 0, `${watch}: physical moving face`);
    shapes.add(shape.digest('hex'));
  }
  assert.equal(shapes.size, watches.length, 'generations must differ in geometry, not only labels or colors');
});

test('OV cover panels are independently grouped instead of rising with the fixed case', () => {
  const geometry = buildWatchGeometry('omniverse');
  for (const group of ['body', 'core', 'lid-left', 'lid-right']) assert.ok(geometry.parts.some(part => part.group === group), group);
});

test('the fully extended core shaft remains seated in its fixed collar on every watch', () => {
  const collars = { original: 'fixed-core-collar', recalibrated: 'fixed-core-collar', ultimatrix: 'offset-silver-core-collar', omniverse: 'small-black-core-collar' };
  for (const watch of watches) {
    const geometry = buildWatchGeometry(watch);
    const shaft = geometry.parts.find(part => part.id === 'independent-lift-core');
    const collar = geometry.parts.find(part => part.id === collars[watch]);
    assert.ok(shaft && collar, `${watch}: separate piston and socket`);
    assert.equal(shaft.group, 'core'); assert.equal(collar.group, 'body');
    let shaftBottom = Infinity, collarTop = -Infinity;
    for (let i = 1; i < shaft.positions.length; i += 3) shaftBottom = Math.min(shaftBottom, shaft.positions[i]);
    for (let i = 1; i < collar.positions.length; i += 3) collarTop = Math.max(collarTop, collar.positions[i]);
    assert.ok(shaftBottom + geometry.lift <= collarTop + 1e-6, `${watch}: no floating gap between raised core and fixed socket`);
  }
});

test('camera changes and core poses reuse unchanged geometry and project the real moving face', () => {
  for (const watch of watches) {
    const geometry = buildWatchGeometry(watch), before = geometryDigest(geometry), cameraDirections = new Set();
    for (const view of views) {
      const closed = watchPose({ watch, view, raised: false, mode: 'projection' });
      const raised = watchPose({ watch, view, raised: true, mode: 'projection' });
      cameraDirections.add(`${closed.azimuth}/${closed.elevation}`);
      assert.equal(closed.lift, 0, `${watch}/${view}: closed core`);
      assert.ok(raised.lift > closed.lift, `${watch}/${view}: core lifts`);
      assert.equal(closed.azimuth, raised.azimuth, 'core control must not move the camera');
      assert.equal(closed.elevation, raised.elevation, 'core control must not tilt the camera');
      for (const aspect of [1, 1.4, .75]) {
        const lower = projectWatchFace(geometry, closed, aspect);
        const upper = projectWatchFace(geometry, raised, aspect);
        for (const face of [lower, upper]) {
          for (const key of ['x', 'y', 'w', 'h', 'a', 'ellipseRatio']) assert.ok(Number.isFinite(face[key]), `${watch}/${view}/${key}`);
          assert.ok(face.w > 0 && face.h > 0 && face.ellipseRatio > 0 && face.ellipseRatio <= 1, `${watch}/${view}: nondegenerate visible face`);
          assert.ok(face.x >= 0 && face.x <= 1 && face.y >= 0 && face.y <= 1, `${watch}/${view}: emitter centre in canvas`);
          assert.equal(face.visible, true, `${watch}/${view}: supplied view faces the camera`);
        }
        assert.ok(['x', 'y', 'w', 'h'].some(key => Math.abs(upper[key] - lower[key]) > 1e-5), `${watch}/${view}: anchor follows the lifted geometry`);
      }
    }
    assert.equal(cameraDirections.size, views.length, `${watch}: independent camera directions`);
    assert.equal(geometryDigest(geometry), before, `${watch}: camera and pose changes cannot redraw or mutate the fixed body`);
  }
});

test('the full moving watch fits the square canvas in every view and lift checkpoint', () => {
  // Check every vertex independently of projectWatchFace: a visible emitter alone does not prove an unclipped cuff or lid.
  // The renderer canvas has aspect-ratio:1 in the application. Browser tests separately check the canvas inside its stage.
  for (const watch of watches) {
    const geometry = buildWatchGeometry(watch);
    for (const mode of ['projection', 'dial']) for (const view of views) for (const raised of [0, .25, .5, .75, 1]) {
      const pose = watchPose({ watch, mode, view, raised });
      const ca = Math.cos(pose.azimuth), sa = Math.sin(pose.azimuth);
      const ce = Math.cos(pose.elevation), se = Math.sin(pose.elevation), lens = Math.tan(pose.fov / 2);
      const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, near: Infinity, far: -Infinity };
      for (const part of geometry.parts) for (let i = 0; i < part.positions.length; i += 3) {
        const slide = part.group === 'lid-left' ? -pose.lidSlide : part.group === 'lid-right' ? pose.lidSlide : 0;
        const x = part.positions[i] + slide - pose.target[0];
        const y = part.positions[i + 1] + (part.group === 'core' ? pose.lift : 0) - pose.target[1];
        const z = part.positions[i + 2] - pose.target[2];
        // Undo yaw and pitch into the camera's local basis, then apply perspective division.
        const horizontal = x * ca - z * sa, rotatedZ = x * sa + z * ca;
        const vertical = y * ce - rotatedZ * se, depth = pose.distance - y * se - rotatedZ * ce;
        const px = .5 + horizontal / (2 * depth * lens), py = .5 - vertical / (2 * depth * lens);
        bounds.minX = Math.min(bounds.minX, px); bounds.maxX = Math.max(bounds.maxX, px);
        bounds.minY = Math.min(bounds.minY, py); bounds.maxY = Math.max(bounds.maxY, py);
        bounds.near = Math.min(bounds.near, depth); bounds.far = Math.max(bounds.far, depth);
      }
      const label = `${watch}/${mode}/${view}/lift=${raised}: ${JSON.stringify(bounds)}`;
      assert.ok(Object.values(bounds).every(Number.isFinite), label);
      assert.ok(bounds.minX >= -1e-6 && bounds.maxX <= 1 + 1e-6 && bounds.minY >= -1e-6 && bounds.maxY <= 1 + 1e-6, label);
      assert.ok(bounds.near > .1 && bounds.far < 25, `${label}: inside clipping planes`);
    }
  }
});

test('dial presentation always retracts the core and uses the same top-view pose', () => {
  for (const watch of watches) {
    const left = watchPose({ watch, view: 'left', raised: true, mode: 'dial' });
    const right = watchPose({ watch, view: 'right', raised: false, mode: 'dial' });
    assert.equal(left.lift, 0, watch);
    assert.equal(right.lift, 0, watch);
    assert.equal(left.lidSlide, watch === 'omniverse' ? .47 : 0, `${watch}: dial exposes the face without raising the core`);
    assert.equal(right.lidSlide, left.lidSlide, `${watch}: dial cover state is independent of the previous view`);
    assert.equal(left.azimuth, right.azimuth, watch);
    assert.equal(left.elevation, right.elevation, watch);
    assert.ok(left.elevation > 1, `${watch}: near top view`);
  }
});

test('five mechanical lift checkpoints retain a fixed body and advance the core without camera motion', () => {
  for (const watch of watches) {
    const geometry = buildWatchGeometry(watch), before = geometryDigest(geometry);
    const poses = [0, .25, .5, .75, 1].map(raised => watchPose({ watch, view: 'low', raised, mode: 'projection' }));
    for (let i = 0; i < poses.length; i++) {
      const pose = poses[i];
      assert.ok(Number.isFinite(pose.lift) && pose.lift >= 0, `${watch}/${i}: finite lift`);
      if (i) assert.ok(pose.lift >= poses[i - 1].lift, `${watch}: monotonic physical lift`);
      assert.equal(pose.azimuth, poses[0].azimuth, `${watch}: stationary camera azimuth`);
      assert.equal(pose.elevation, poses[0].elevation, `${watch}: stationary camera elevation`);
      projectWatchFace(geometry, pose, 1);
      assert.equal(geometryDigest(geometry), before, `${watch}/${i}: fixed body and base geometry unchanged`);
    }
    assert.ok(poses.at(-1).lift > poses[0].lift, `${watch}: actual lift range`);
    assert.ok(poses.slice(1, -1).some(pose => pose.lift > poses[0].lift && pose.lift < poses.at(-1).lift), `${watch}: intermediate core geometry, not an endpoint swap`);
  }
});

test('missing WebGL returns an explicit fallback without touching DOM-only resources', () => {
  const unavailable = { getContext: () => null };
  assert.equal(createWatchModel(unavailable), null);
});

// Instrument GPU submissions and time, not rasterized pixels. Visual evidence comes from the real browser.
function rendererHarness() {
  let time = 1000, serial = 0, boundBuffer = null;
  const frames = new Map(), listeners = new Map(), observers = [], uploads = [], batches = [], callbacks = [];
  const deletedBuffers = new Set(), deletedPrograms = new Set(), uniforms = new Map(), unavailable = [];
  const gl = new Proxy({
    createShader: type => ({ type, id: ++serial }),
    getShaderParameter: () => true,
    createProgram: () => ({ id: ++serial }),
    getProgramParameter: () => true,
    getAttribLocation: (_program, name) => ['aPosition', 'aNormal', 'aColor'].indexOf(name),
    getUniformLocation: (_program, name) => name,
    createBuffer: () => ({ id: ++serial }),
    bindBuffer(_type, buffer) { boundBuffer = buffer; },
    bufferData(_type, values) { uploads.push({ buffer: boundBuffer, values: new Float32Array(values) }); },
    deleteBuffer(buffer) { assert.ok(!deletedBuffers.has(buffer), 'buffer deleted once'); deletedBuffers.add(buffer); },
    deleteProgram(program) { assert.ok(!deletedPrograms.has(program), 'program deleted once'); deletedPrograms.add(program); },
    uniform3fv(name, values) { uniforms.set(name, [...values]); },
    uniformMatrix4fv(name, _transpose, values) { uniforms.set(name, [...values]); },
    clear() { batches.push([]); },
    drawArrays(_type, _start, count) {
      batches.at(-1).push({ buffer: boundBuffer, count, offset: uniforms.get('uOffset'), matrix: uniforms.get('uViewProjection') });
    },
  }, { get(target, key) { return key in target ? target[key] : /^[A-Z_]+$/.test(key) ? 1 : () => {}; } });
  const win = {
    performance: { now: () => time }, devicePixelRatio: 3,
    requestAnimationFrame(fn) { const id = ++serial; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
  };
  const canvas = {
    ownerDocument: { defaultView: win }, width: 0, height: 0,
    getContext: () => gl,
    getBoundingClientRect: () => ({ width: 400, height: 400 }),
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
  };
  const model = createWatchModel(canvas, { onFrame: frame => callbacks.push(frame), onUnavailable: reason => unavailable.push(reason) });
  assert.ok(model);
  return { model, canvas, frames, uploads, batches, callbacks, deletedBuffers, deletedPrograms, observers, listeners, unavailable,
    tick(ms = 0) { time += ms; const work = [...frames.values()]; frames.clear(); for (const fn of work) fn(time); },
  };
}

test('mechanical lift keeps the submitted body fixed and reverses from its current height', () => {
  const h = rendererHarness();
  h.model.setState({ watch: 'original', view: 'low', raised: false, reducedMotion: true }); h.tick();
  const geometry = buildWatchGeometry('original');
  const bodyCount = geometry.parts.filter(part => part.group === 'body').reduce((n, part) => n + part.positions.length / 3, 0);
  const baseDraw = h.batches.at(-1).find(draw => draw.count === bodyCount);
  assert.ok(baseDraw, 'fixed body was submitted');
  const initialUploads = h.uploads.length;
  h.model.setState({ raised: true, reducedMotion: false }); h.tick(220);
  const halfway = h.callbacks.at(-1).coreLift;
  assert.ok(halfway > 0 && halfway < geometry.lift, 'visible intermediate lift');
  h.model.setState({ raised: false }); h.tick();
  assert.ok(Math.abs(h.callbacks.at(-1).coreLift - halfway) < 1e-9, 'reversal begins at the displayed height');
  h.tick(220);
  assert.ok(h.callbacks.at(-1).coreLift > 0 && h.callbacks.at(-1).coreLift < halfway, 'core moves continuously back down');
  h.tick(220);
  assert.equal(h.callbacks.at(-1).coreLift, 0);
  assert.equal(h.frames.size, 0, 'completed motion has no idle render loop');
  assert.equal(h.uploads.length, initialUploads, 'lift does not replace body geometry');
  for (const draws of h.batches) {
    const body = draws.find(draw => draw.buffer === baseDraw.buffer);
    assert.deepEqual(body.offset, [0, 0, 0], 'only moving parts receive a translation');
    assert.deepEqual(body.matrix, baseDraw.matrix, 'lifting a core must not move the camera or body');
  }
  h.model.dispose();
});

test('reduced motion settles an active camera and lift, and hiding cancels GPU work', () => {
  const h = rendererHarness();
  h.model.setState({ watch: 'original', view: 'low', raised: false, reducedMotion: true }); h.tick();
  h.model.setState({ view: 'right', raised: true, reducedMotion: false }); h.tick(100);
  assert.equal(h.callbacks.at(-1).transitioning, true);
  h.model.setState({ reducedMotion: true }); h.tick();
  assert.equal(h.callbacks.at(-1).transitioning, false);
  assert.equal(h.callbacks.at(-1).coreLift, buildWatchGeometry('original').lift);
  assert.equal(h.frames.size, 0);
  h.model.setState({ view: 'left', raised: false, reducedMotion: false });
  const staleFrame = [...h.frames.values()][0];
  assert.equal(typeof staleFrame, 'function');
  h.model.setState({ visible: false });
  const drawsWhenHidden = h.batches.length;
  assert.equal(h.frames.size, 0);
  staleFrame(1400);
  for (const observer of h.observers) observer.callback();
  assert.equal(h.batches.length, drawsWhenHidden, 'late callbacks cannot draw a hidden model');
  assert.equal(h.frames.size, 0, 'resize cannot restart a hidden model');
  h.model.setState({ visible: true }); h.tick();
  assert.equal(h.callbacks.at(-1).transitioning, false, 'restoring visibility starts settled');
  assert.ok(h.batches.length > drawsWhenHidden);
  assert.ok(Math.max(h.canvas.width, h.canvas.height) <= 1440, 'device pixel ratio is bounded');
  h.model.dispose();
});

test('context loss releases GPU resources once and stale callbacks cannot revive the renderer', () => {
  const h = rendererHarness();
  h.model.setState({ watch: 'omniverse', view: 'low', raised: true });
  const staleFrame = [...h.frames.values()][0];
  let prevented = false;
  h.listeners.get('webglcontextlost')({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(h.unavailable, ['context-lost']);
  assert.equal(h.deletedBuffers.size, h.uploads.length);
  assert.equal(h.deletedPrograms.size, 1);
  assert.ok(h.observers.every(observer => observer.disconnected));
  assert.equal(h.listeners.has('webglcontextlost'), false);
  assert.equal(h.frames.size, 0);
  const drawsAtDisposal = h.batches.length;
  staleFrame(1500);
  h.model.setState({ visible: true, raised: false });
  for (const observer of h.observers) observer.callback();
  h.model.dispose();
  assert.equal(h.frames.size, 0);
  assert.equal(h.batches.length, drawsAtDisposal);
  assert.deepEqual(h.unavailable, ['context-lost']);
});

test('circular dials keep upright content across generations, scales and near-square viewports', () => {
  for (const watch of watches) {
    const original = buildWatchGeometry(watch), digest = geometryDigest(original);
    const pose = watchPose({ watch, mode: 'dial', view: 'left', raised: true });
    for (const radius of [original.face.radius, .0001, .08, .168, .467, 1.2]) {
      const geometry = { ...original, face: { ...original.face, radius } };
      for (const aspect of [1, 1 - Number.EPSILON, 1 + Number.EPSILON, 1 - 1e-8, 1 + 1e-8, 1 - 2e-7, 1 + 2e-7]) {
        const face = projectWatchFace(geometry, pose, aspect);
        assert.equal(face.a, 0, `${watch}/radius=${radius}/aspect=${aspect}: a circular screen must not rotate the hero`);
        assert.ok(face.w > 0 && face.h > 0 && Number.isFinite(face.w + face.h));
        assert.ok(face.ellipseRatio > .99999, 'these fixtures are visually circular');
      }
    }
    assert.equal(geometryDigest(original), digest, 'projection must not mutate geometry');
  }
});

test('almost overhead round faces remain upright under tiny pitch and aspect perturbations', () => {
  for (const watch of watches) {
    const geometry = buildWatchGeometry(watch);
    for (const azimuth of [0, .41, 1.2]) for (const aspect of [1 - 1e-8, 1, 1 + 1e-8]) {
      const pose = { ...watchPose({ watch, mode: 'dial' }), azimuth, elevation: Math.PI / 2 - 1e-5 };
      const before = structuredClone(pose), face = projectWatchFace(geometry, pose, aspect);
      assert.ok(face.ellipseRatio > .99999, 'the near-overhead fixture is visually circular');
      assert.equal(face.a, 0, `${watch}/${azimuth}/${aspect}: no arbitrary principal-axis rotation near a circle`);
      assert.deepEqual(pose, before, 'axis stabilization does not change the camera pose');
    }
  }
});

test('clearly elliptical top-view projections retain their nondegenerate major-axis direction', () => {
  for (const watch of watches) {
    const geometry = buildWatchGeometry(watch), pose = watchPose({ watch, mode: 'dial' });
    for (const aspect of [.5, .75, 1.4, 2]) {
      const face = projectWatchFace(geometry, pose, aspect);
      assert.ok(face.ellipseRatio < .85, `${watch}/${aspect}: not a degenerate circle`);
      assert.equal(face.a, aspect < 1 ? 0 : 90, 'preserve normalized-canvas ellipse orientation outside the circular limit');
    }
  }
});
