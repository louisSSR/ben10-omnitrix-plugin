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
    assert.ok(radiusX <= width * .34 && radiusX <= 165);
    assert.equal(radiusY, radiusX * .8);
    if (width >= 277) assert.equal(radiusX, Math.min(165, width * .34));
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
  for (const direction of [-1, 1]) {
    const motion = dialSelectionFrames(direction);
    for (const delta of [-50, 0, 50]) {
      const progress = effectProgress(motion.easing, (motion.swapAt + delta) / motion.duration);
      const held = [motion.a, motion.b].map(frames => {
        const next = frames.findIndex(frame => frame.offset > progress);
        assert.ok(next > 0, 'swap has an enclosing transition segment');
        const before = frames[next - 1], after = frames[next];
        assert.equal(before.clipPath, after.clipPath, 'coverage does not change in the swap segment');
        assert.equal(before.transform, after.transform, 'neither leaf moves in the swap segment');
        assert.equal(before.transform, 'translate(0%,0%) rotate(0deg)');
        return before;
      });
      // Scan the entire face, not just the centre: a visible leg or tail must not
      // leak through an edge while its image is replaced. The leaves overlap.
      for (const y of [.1, 5, 25, 50, 75, 95, 99.9]) {
        const left = horizontalBounds(held[0].clipPath, y), right = horizontalBounds(held[1].clipPath, y);
        assert.equal(left[0], 0);
        assert.equal(right[1], 100);
        assert.ok(left[1] > right[0], `overlapping full coverage at y=${y}, time=${motion.swapAt + delta}ms`);
      }
    }
  }
});

test('dial leaves independently cross, expose a small central aperture and settle back to the original diamond', () => {
  const motion = dialSelectionFrames(1), swapOffset = motion.swapAt / motion.duration;
  assert.ok(motion.duration > 0 && motion.duration <= 760);
  assert.ok(swapOffset > 0 && swapOffset < 1);
  for (const frames of [motion.a, motion.b, motion.rotor]) {
    assert.equal(frames[0].offset, 0);
    assert.equal(frames.at(-1).offset, 1);
    for (let n = 1; n < frames.length; n++) assert.ok(frames[n].offset > frames[n - 1].offset);
  }
  for (const frames of [motion.a, motion.b]) {
    assert.equal(frames[0].clipPath, frames.at(-1).clipPath);
    assert.equal(frames[0].transform, 'translate(0%,0%) rotate(0deg)');
    assert.equal(frames.at(-1).transform, frames[0].transform, 'finish and cancellation can return to resting CSS without a jump');
    assert.ok(frames.every(frame => polygonPoints(frame.clipPath).length === 7), 'matching vertex counts allow continuous polygon interpolation');
    assert.ok(frames.every(frame => !('opacity' in frame)), 'the metal plates never fade away');
    assert.ok(frames.every(frame => Math.abs(Number(frame.transform.match(/translate\(([-\d.]+)%/)[1])) <= 2.5), 'plates stay in the dial rather than flying off screen');
    assert.ok(frames.some(frame => frame.transform !== frames[0].transform), 'each plate has its own motion');
  }
  const opening = (index, y) => horizontalBounds(motion.b[index].clipPath, y)[0] - horizontalBounds(motion.a[index].clipPath, y)[1];
  const pinhole = motion.a.findIndex((frame, index) => frame.offset < swapOffset && frame.transform === motion.a[0].transform && opening(index, 50) > 0 && opening(index, 50) < 20);
  assert.ok(pinhole > 0, 'a visible small central opening precedes total coverage');
  assert.ok(opening(pinhole, 40) <= 0 && opening(pinhole, 60) <= 0, 'the small opening stays central, not a full-height slit');
  assert.ok(motion.a.some((frame, index) => frame.transform !== motion.b[index].transform), 'opposing plates have different transforms, not one shared screen rotation');
  for (const frame of motion.rotor) assert.equal(frame.transform, 'rotate(0deg)', 'the circular case and screen carrier remain fixed');
  // The first and last geometry must match the permanent CSS diamond.
  for (const y of [5, 25, 50, 75, 95]) {
    assert.equal(opening(0, y), 100 - Math.abs(y - 50) * 2);
    assert.equal(opening(motion.a.length - 1, y), opening(0, y));
  }
});

test('dial plate twists reverse with direction while its carrier stays fixed and calls do not share mutable keyframes', () => {
  const next = dialSelectionFrames(1), previous = dialSelectionFrames(-1);
  for (const key of ['a', 'b']) for (let n = 0; n < next[key].length; n++) {
    const forward = next[key][n], reverse = previous[key][n];
    assert.equal(reverse.clipPath, forward.clipPath);
    assert.equal(reverse.offset, forward.offset);
    const angle = frame => Number(frame.transform.match(/rotate\(([-\d.]+)deg\)/)[1]);
    assert.equal(angle(reverse) + angle(forward), 0);
  }
  assert.deepEqual(previous.rotor, next.rotor);
  assert.equal(previous.swapAt, next.swapAt);
  for (const direction of [undefined, 0, NaN, Infinity, -Infinity, '-1']) assert.deepEqual(dialSelectionFrames(direction), next);
  next.a[0].clipPath = 'none'; next.rotor[0].transform = 'none';
  assert.notEqual(dialSelectionFrames(1).a[0].clipPath, 'none');
  assert.notEqual(dialSelectionFrames(1).rotor[0].transform, 'none');
});
