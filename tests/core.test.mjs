import test from 'node:test';
import assert from 'node:assert/strict';
import { WATCHES, MODES, normalizePreferences, filterForms, stepSelection, ringItems, ringPlacement } from '../core.js';
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

test('orbit depth makes the front larger, brighter and above the back on desktop and mobile', () => {
  for (const width of [320, 390, 720, 1024]) {
    const front = ringPlacement(0, width), side = ringPlacement(Math.PI / 2, width), back = ringPlacement(Math.PI, width);
    for (const property of ['scale', 'opacity', 'zIndex', 'z', 'y']) {
      assert.ok(front[property] > side[property] && side[property] > back[property], `${property} follows depth at ${width}px`);
    }
    assert.ok(Math.abs(side.x) < width / 2, 'side position stays inside the measured stage');
    const opposite = ringPlacement(-Math.PI / 2, width);
    assert.ok(Math.abs(side.x + opposite.x) < 1e-9);
    assert.equal(side.scale, opposite.scale);
    assert.ok(front.opacity <= 1 && back.opacity > 0);
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
