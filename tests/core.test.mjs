import test from 'node:test';
import assert from 'node:assert/strict';
import { WATCHES, MODES, normalizePreferences, filterForms, stepSelection, ringItems, ringPlacement, dialSelectionFrames } from '../core.js';
import { sanitizePreferences } from '../host-adapter.js';

const forms = Object.freeze([
  Object.freeze({ id: 'heatblast', name: '火焰人', en: 'Heatblast', group: 'os', asset: 'alien-heatblast', aliases: ['烈焰人', 'Pyronite'] }),
  Object.freeze({ id: 'gwen10-xlr8', name: '小玟快闪之星', en: 'Gwen XLR8', group: 'alternate', asset: null, aliases: ['急速'] }),
  Object.freeze({ id: 'nanomech-ua', name: '纳米魔', en: 'Nanomech', group: 'edition', asset: 'alien-nanomech-ua', aliases: ['纳米人'] }),
  Object.freeze({ id: 'shocksquatch-hu', name: '电蜥', en: 'Shocksquatch', group: 'edition', asset: null, aliases: [] }),
]);
const ids = rows => rows.map(row => row.id);
const defaults = { watch: 'original', mode: 'projection', reducedMotion: false, selectedId: 'heatblast' };

test('four watch generations and exactly three summon modes have unique IDs', () => {
  assert.deepEqual(ids(WATCHES), ['original', 'recalibrated', 'ultimatrix', 'omniverse']);
  assert.deepEqual(ids(MODES), ['projection', 'carousel', 'dial']);
  assert.equal(new Set(ids(WATCHES)).size, WATCHES.length);
  assert.equal(new Set(ids(MODES)).size, MODES.length);
});

test('legacy archive preferences recover to projection without losing the saved watch or form', () => {
  const legacy = Object.freeze({ watch: 'omniverse', mode: 'archive', selectedId: 'nanomech-ua', reducedMotion: true });
  const expected = { ...legacy, mode: 'projection' };
  assert.deepEqual(normalizePreferences(legacy, forms), expected);
  assert.deepEqual(sanitizePreferences(legacy), expected);
  assert.deepEqual(normalizePreferences(sanitizePreferences(legacy), forms), expected);
  assert.equal(legacy.mode, 'archive');
});

test('unusable persisted preferences recover without creating an invalid selection', () => {
  for (const value of [undefined, null, false, 42, 'broken JSON value', [], ['original']]) {
    assert.deepEqual(normalizePreferences(value, forms), defaults);
  }
  assert.deepEqual(normalizePreferences({ watch: 'legacy', mode: 'unknown', selectedId: 'deleted', reducedMotion: 'true' }, forms), defaults);
  assert.deepEqual(normalizePreferences({ watch: {}, mode: [], selectedId: 1, reducedMotion: 1 }, forms), defaults);
  assert.deepEqual(normalizePreferences(null, []), { ...defaults, selectedId: '' });
});

test('valid preferences survive, extra fields are dropped, input remains untouched', () => {
  const input = Object.freeze({ watch: 'ultimatrix', mode: 'carousel', selectedId: 'gwen10-xlr8', reducedMotion: true, sendAutomatically: true });
  assert.deepEqual(normalizePreferences(input, forms), { watch: 'ultimatrix', mode: 'carousel', selectedId: 'gwen10-xlr8', reducedMotion: true });
  assert.equal(input.sendAutomatically, true);
  for (const watch of WATCHES) for (const mode of MODES) {
    assert.equal(normalizePreferences({ watch: watch.id, mode: mode.id }, forms).watch, watch.id);
    assert.equal(normalizePreferences({ watch: watch.id, mode: mode.id }, forms).mode, mode.id);
  }
});

test('merged form IDs restore the canonical selection while a current ID takes priority', () => {
  const merged = [{ id: 'other', aliases: [] }, { id: 'shocksquatch', aliases: ['shocksquatch-hu'] }];
  assert.equal(normalizePreferences({ selectedId: 'shocksquatch-hu' }, merged).selectedId, 'shocksquatch');
  assert.equal(normalizePreferences({ selectedId: 'shocksquatch-hu' }, [...merged, { id: 'shocksquatch-hu' }]).selectedId, 'shocksquatch-hu');
  assert.deepEqual(ids(filterForms(merged, { query: 'shocksquatch-hu', readyOnly: false })), ['shocksquatch']);
});

test('search matches Chinese names, aliases, English case, IDs and normalized full-width input', () => {
  for (const query of ['火焰人', '烈焰人', 'HEATBLAST', 'pyronite', '  ＨＥＡＴＢＬＡＳＴ  ']) {
    assert.deepEqual(ids(filterForms(forms, { query })), ['heatblast']);
  }
  assert.deepEqual(ids(filterForms(forms, { query: 'nanomech-ua' })), ['nanomech-ua']);
  assert.deepEqual(ids(filterForms(forms, { query: '纳米人' })), ['nanomech-ua']);
});

test('readiness, group and query compose; zero results and empty catalogs remain empty', () => {
  assert.deepEqual(ids(filterForms(forms)), ['heatblast', 'nanomech-ua']);
  assert.deepEqual(ids(filterForms(forms, { readyOnly: false })), ids(forms));
  assert.deepEqual(ids(filterForms(forms, { group: 'edition', readyOnly: false })), ['nanomech-ua', 'shocksquatch-hu']);
  assert.deepEqual(ids(filterForms(forms, { group: 'edition', query: '魔' })), ['nanomech-ua']);
  assert.deepEqual(filterForms(forms, { group: 'os', query: 'Nanomech' }), []);
  assert.deepEqual(filterForms(forms, { query: '不存在的形态' }), []);
  assert.deepEqual(filterForms([], { query: 'heatblast' }), []);
  assert.deepEqual(ids(forms), ['heatblast', 'gwen10-xlr8', 'nanomech-ua', 'shocksquatch-hu']);
});

test('selection wraps in both directions including large and fractional steps', () => {
  assert.equal(stepSelection(forms, 'heatblast', -1), forms[3]);
  assert.equal(stepSelection(forms, 'shocksquatch-hu', 1), forms[0]);
  assert.equal(stepSelection(forms, 'gwen10-xlr8', 9), forms[2]);
  assert.equal(stepSelection(forms, 'gwen10-xlr8', -10), forms[3]);
  assert.equal(stepSelection(forms, 'heatblast', 1.9), forms[1]);
  assert.equal(stepSelection(forms, 'heatblast', -1.9), forms[3]);
  for (const delta of [NaN, Infinity, -Infinity, undefined]) assert.equal(stepSelection(forms, 'nanomech-ua', delta), forms[2]);
  assert.equal(stepSelection(forms, 'removed', 0), forms[0]);
  assert.equal(stepSelection([], 'heatblast', 1), null);
  assert.equal(stepSelection([forms[0]], 'heatblast', -19), forms[0]);
});

test('ring keeps the selection between its neighbors and wraps eight distinct forms', () => {
  const many = Array.from({ length: 12 }, (_, n) => ({ id: `form-${n}` }));
  const ring = ringItems(many, 'form-10');
  assert.deepEqual(ids(ring), ['form-6', 'form-7', 'form-8', 'form-9', 'form-10', 'form-11', 'form-0', 'form-1']);
  assert.equal(new Set(ids(ring)).size, 8);
  assert.deepEqual(ids(ringItems(many, 'form-11', 3)), ['form-10', 'form-11', 'form-0']);
});

test('small rings never duplicate forms and absent selections recover to the first form', () => {
  for (const length of [1, 2, 7]) {
    const small = Array.from({ length }, (_, n) => ({ id: `small-${n}` }));
    const ring = ringItems(small, small.at(-1).id);
    assert.equal(ring.length, length);
    assert.equal(new Set(ids(ring)).size, length);
    assert.equal(ring[Math.floor(length / 2)], small.at(-1));
    assert.equal(ringItems(small, 'removed')[Math.floor(length / 2)], small[0]);
  }
  assert.deepEqual(ringItems([], 'none'), []);
});

test('the selected orbit slot is at twelve oclock and larger than the opposite slot', () => {
  for (const width of [320, 390, 720, 1024]) {
    const front = ringPlacement(0, width), side = ringPlacement(Math.PI / 2, width), back = ringPlacement(Math.PI, width);
    assert.equal(front.x, 0);
    assert.ok(front.y < 0 && Math.abs(side.y) < 1e-9 && back.y > 0);
    assert.equal(front.depth, 1);
    assert.equal(front.scale, 1.25);
    assert.equal(back.scale, .70);
    for (const property of ['scale', 'opacity', 'zIndex']) {
      assert.ok(front[property] > side[property] && side[property] > back[property], `${property} follows depth at ${width}px`);
    }
    assert.equal(front.z, 0);
    assert.equal(side.z, 0);
    assert.equal(back.z, 0);
    const opposite = ringPlacement(-Math.PI / 2, width);
    assert.ok(Math.abs(side.x + opposite.x) < 1e-9);
    assert.equal(side.scale, opposite.scale);
    assert.ok(Math.abs(front.y + back.y) < 1e-9);
    assert.equal(front.rotate, 0);
    assert.ok(Math.abs(side.rotate - 90) < 1e-9);
    assert.ok(front.opacity <= 1 && back.opacity > 0);
  }
});

test('the ellipse matches the CSS ring and upright 40 to 58px icons stay inside the stage', () => {
  for (const width of [81, 160, 240, 277, 320, 343, 390, 599, 600, 720, 1024]) {
    const radiusX = ringPlacement(Math.PI / 2, width).x;
    const radiusY = -ringPlacement(0, width).y;
    assert.ok(radiusX <= width * .34 && radiusX <= 220);
    assert.equal(radiusY, radiusX * .8);
    if (width >= 277) assert.equal(radiusX, Math.min(220, width * .34));
    for (let step = 0; step < 48; step++) {
      const pose = ringPlacement(step * Math.PI / 24, width);
      assert.ok(Math.abs((pose.x / radiusX) ** 2 + (pose.y / radiusY) ** 2 - 1) < 1e-9);
      for (const iconSize of [40, 58]) {
        const halfBounds = iconSize * pose.scale / 2;
        assert.ok(Math.abs(pose.x) + halfBounds <= width / 2 - 4 + 1e-9, `${width}px at slot ${step} fits a ${iconSize}px icon`);
      }
    }
  }
  for (const width of [1, 40, 76, 80]) for (const angle of [0, Math.PI / 2, Math.PI]) {
    const pose = ringPlacement(angle, width);
    assert.equal(Math.abs(pose.x), 0);
    assert.equal(Math.abs(pose.y), 0);
    assert.ok(Object.values(pose).every(Number.isFinite));
  }
});

test('moving a slot from back to front changes depth continuously and invalid measurements stay finite', () => {
  const poses = [Math.PI, Math.PI * .75, Math.PI * .5, Math.PI * .25, 0].map(angle => ringPlacement(angle, 390));
  for (let n = 1; n < poses.length; n++) {
    assert.ok(poses[n].scale > poses[n - 1].scale);
    assert.ok(poses[n].zIndex > poses[n - 1].zIndex);
  }
  for (const value of [undefined, NaN, Infinity, -Infinity]) {
    assert.ok(Object.values(ringPlacement(value, value)).every(Number.isFinite));
  }
});

const polygonPoints = clip => [...clip.matchAll(/([\d.]+)%\s+([\d.]+)%/g)].map(match => [Number(match[1]), Number(match[2])]);
const horizontalBounds = (clip, y) => {
  const points = polygonPoints(clip), xs = [];
  for (let n = 0; n < points.length; n++) {
    const [x1, y1] = points[n], [x2, y2] = points[(n + 1) % points.length];
    if (y1 !== y2 && y >= Math.min(y1, y2) && y <= Math.max(y1, y2)) xs.push(x1 + (x2 - x1) * (y - y1) / (y2 - y1));
  }
  return [Math.min(...xs), Math.max(...xs)];
};
const effectProgress = (easing, time) => {
  if (easing === 'linear') return time;
  const match = easing.match(/^cubic-bezier\(([^)]+)\)$/);
  assert.ok(match, 'the motion declares a supported global easing');
  const [x1, y1, x2, y2] = match[1].split(',').map(Number);
  const component = (t, p1, p2) => 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3;
  let low = 0, high = 1;
  for (let n = 0; n < 40; n++) {
    const mid = (low + high) / 2;
    if (component(mid, x1, x2) < time) low = mid; else high = mid;
  }
  return component((low + high) / 2, y1, y2);
};

test('dial swap stays inside actual wall clock coverage after global WAAPI easing', () => {
  const motion = dialSelectionFrames(1);
  for (const delta of [-20, 0, 20]) {
    const progress = effectProgress(motion.easing, (motion.swapAt + delta) / motion.duration);
    assert.ok(progress >= motion.a[2].offset && progress <= motion.a[3].offset, `both leaves remain closed at ${motion.swapAt + delta}ms`);
    assert.ok(progress >= motion.rotor[2].offset && progress <= motion.rotor[3].offset, 'the rotor remains at the covered angle');
  }
});

test('dial leaves visibly form an hourglass then fully cover the swap before reopening', () => {
  const motion = dialSelectionFrames(1), swapOffset = motion.swapAt / motion.duration;
  assert.ok(motion.duration > 0 && motion.duration <= 760);
  assert.ok(swapOffset > .30 && swapOffset < .55);
  for (const frames of [motion.a, motion.b, motion.rotor]) {
    assert.equal(frames[0].offset, 0);
    assert.equal(frames.at(-1).offset, 1);
    for (let n = 1; n < frames.length; n++) assert.ok(frames[n].offset > frames[n - 1].offset);
  }
  for (const frames of [motion.a, motion.b]) {
    assert.equal(frames[0].clipPath, frames.at(-1).clipPath);
    assert.ok(frames.every(frame => polygonPoints(frame.clipPath).length === 5));
    assert.ok(frames.every(frame => !('opacity' in frame) && !('transform' in frame)), 'permanent leaves morph their structure');
    assert.equal(frames[2].clipPath, frames[3].clipPath, 'coverage stays fixed throughout the swap window');
  }
  const opening = y => horizontalBounds(motion.b[1].clipPath, y)[0] - horizontalBounds(motion.a[1].clipPath, y)[1];
  assert.ok(opening(50) > 0 && opening(5) > opening(50) && opening(95) > opening(50), 'the waist narrows while both ends remain open');
  for (const y of [.1, 5, 25, 50, 75, 95, 99.9]) {
    const left = horizontalBounds(motion.a[2].clipPath, y), right = horizontalBounds(motion.b[2].clipPath, y);
    assert.equal(left[0], 0);
    assert.equal(right[1], 100);
    assert.equal(left[1], right[0], 'the two half-screen leaves meet without a gap');
  }
  assert.equal(motion.rotor[2].transform, motion.rotor[3].transform, 'rotation also holds at the covered swap');
  assert.equal(motion.rotor[0].transform, 'rotate(0deg)');
  assert.equal(motion.rotor[2].transform, 'rotate(90deg)');
  assert.equal(motion.rotor.at(-1).transform, 'rotate(180deg)');
});

test('dial rotation reverses with direction and calls do not share mutable keyframes', () => {
  const next = dialSelectionFrames(1), previous = dialSelectionFrames(-1);
  assert.deepEqual(previous.a, next.a);
  assert.deepEqual(previous.b, next.b);
  assert.equal(previous.rotor[2].transform, 'rotate(-90deg)');
  assert.equal(previous.rotor.at(-1).transform, 'rotate(-180deg)');
  assert.equal(previous.swapAt, next.swapAt);
  for (const direction of [undefined, 0, NaN, Infinity, -Infinity, '-1']) assert.deepEqual(dialSelectionFrames(direction), next);
  next.a[0].clipPath = 'none'; next.rotor[0].transform = 'none';
  assert.notEqual(dialSelectionFrames(1).a[0].clipPath, 'none');
  assert.notEqual(dialSelectionFrames(1).rotor[0].transform, 'none');
});
