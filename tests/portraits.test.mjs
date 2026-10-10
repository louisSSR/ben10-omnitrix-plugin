import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PORTRAIT_PALETTES, portraitColorMatrix, validatePortraitRegistry, createPortraitRenderer } from '../portrait-renderer.js';
import { normalizePreferences } from '../core.js';
import { sanitizePreferences } from '../host-adapter.js';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url));
const registry = JSON.parse(read('assets/portraits.json'));
const catalog = JSON.parse(read('assets/catalog.json'));
const ids = catalog.forms.map(form => form.id);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
const apply = (matrix, rgba) => [0, 1, 2, 3].map(row => rgba.reduce((sum, value, column) => sum + value * matrix[row * 5 + column], matrix[row * 5 + 4]));

test('every source portrait remains a content-addressed original with its source and exact identity evidence', () => {
  const { assets, bindings } = validatePortraitRegistry(registry, ids);
  assert.ok(assets.size > 0 && bindings.size > 0);
  const html = read('preview.html').toString();
  for (const asset of assets.values()) {
    const bytes = read(`assets/${asset.file}`);
    assert.equal(sha(bytes), asset.sha256);
    assert.equal(bytes.length, asset.bytes);
    const type = asset.file.endsWith('.webp') ? 'webp' : 'png';
    if (type === 'webp') {
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.equal(bytes.toString('ascii', 12, 16), 'VP8X');
      assert.ok(bytes[20] & 0x10, 'source includes alpha');
      assert.equal(bytes.readUIntLE(24, 3) + 1, asset.width);
      assert.equal(bytes.readUIntLE(27, 3) + 1, asset.height);
      assert.equal(asset.source.kind, 'user-supplied-third-party-app-resource');
      assert.match(asset.source.archiveEntry, /^res\/drawable-mdpi-v4\/omniverse__[0-9]+_\.webp$/);
      assert.match(asset.source.apkSha256, /^[a-f0-9]{64}$/);
    } else {
      assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
      assert.equal(bytes.readUInt32BE(16), asset.width);
      assert.equal(bytes.readUInt32BE(20), asset.height);
      assert.equal(bytes[25], 6, 'reference edit retains RGBA');
      assert.equal(asset.source.kind, 'ai-reference-redraw');
      assert.equal(sha(read(asset.source.referenceFile)), asset.source.referenceSha256);
      assert.equal(typeof asset.source.officialPublisherVerified, 'boolean');
      if (asset.source.officialPublisherVerified) {
        const evidence = JSON.parse(read('assets/extra-art.json')).assets.find(source =>
          source.sourceFile === asset.source.referenceFile &&
          source.sourceSha256 === asset.source.referenceSha256);
        assert.equal(evidence?.officialSourceVerified, true, 'official reference must match retained, verified source evidence');
      }
    }
    assert.deepEqual(read(`assets/runtime/${asset.sha256}.${type}`), bytes);
    assert.ok(html.includes(`href="./assets/runtime/${asset.sha256}.${type}"`));
  }
  for (const binding of registry.bindings) {
    assert.equal(binding.confirmed, true);
    assert.ok(binding.reason.length > 10);
    assert.match(binding.reference.url, /^https?:\/\//);
    assert.match(binding.reference.sha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(catalog.forms.length, 237, 'head coverage never narrows the catalog');
  assert.equal(catalog.forms.filter(form => form.asset).length, 236);
  assert.deepEqual(catalog.forms.filter(form => !form.asset).map(form => form.id), ['nemetrix-crabdozer']);
});

test('two-tone colors hit independent expected endpoints and never alter alpha', () => {
  for (const asset of registry.assets) for (const palette of Object.values(PORTRAIT_PALETTES)) {
    const matrix = portraitColorMatrix(asset, palette);
    for (const [tone, expected] of [[asset.dark, rgb(palette.main)], [asset.light, rgb(palette.light)]]) {
      for (const alpha of [0, .1, .5, 1]) {
        const out = apply(matrix, [tone, tone, tone, alpha]);
        assert.equal(out[3], alpha);
        for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(out[channel] - expected[channel]) < 1e-9);
      }
    }
  }
  for (const input of [{ dark: 1, light: 1 }, { dark: -.1, light: .5 }, { dark: .5, light: 2 }, { dark: NaN, light: .8 }]) assert.throws(() => portraitColorMatrix(input));
});

test('bindings reject unknown or duplicate forms rather than inferring a family or edition', () => {
  const copy = () => structuredClone(registry);
  const unknown = copy(); unknown.bindings[0].formId = 'unregistered';
  assert.throws(() => validatePortraitRegistry(unknown, ids));
  const duplicate = copy(); duplicate.bindings.push(duplicate.bindings[0]);
  assert.throws(() => validatePortraitRegistry(duplicate, ids));
  const missing = copy(); missing.assets = [];
  assert.throws(() => validatePortraitRegistry(missing, ids));
  for (const invalid of ['../outside', 'icon\" onload=\"bad', '']) {
    const bad = copy(); bad.assets[0].id = invalid;
    assert.throws(() => validatePortraitRegistry(bad, ids));
  }
  for (const width of [0, -1, 2049, 1.5, NaN]) {
    const bad = copy(); bad.assets[0].width = width;
    assert.throws(() => validatePortraitRegistry(bad, ids));
  }
});

function fakeDocument() {
  class Node {
    constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.style = {}; }
    setAttribute(key, value) { this.attrs[key] = value; }
    append(...nodes) { this.children.push(...nodes); }
    remove() { this.removed = true; }
  }
  return { body: new Node('body'), createElement: tag => new Node(tag), createElementNS: (_, tag) => new Node(tag) };
}

test('recoloring existing ring heads updates their shared filter without destroying head features', () => {
  const doc = fakeDocument(), renderer = createPortraitRenderer(registry, ids, doc);
  const binding = registry.bindings[0], node = renderer.figure(binding.formId);
  assert.equal(node.tag, 'svg');
  assert.equal(node.children[0].attrs.href, `#portrait-sprite-${binding.portraitId}`);
  const filter = doc.body.children[0].children[0].children.find(item => item.attrs.id === `portrait-tint-${binding.portraitId}`);
  const before = filter.children[0].attrs.values;
  renderer.setPalette('amber');
  assert.notEqual(filter.children[0].attrs.values, before);
  assert.deepEqual(filter.children[0].attrs.values.split(' ').slice(-5), ['0', '0', '0', '1', '0']);
  assert.equal(renderer.figure('nemetrix-crabdozer').textContent, '头像待补');
  renderer.dispose(); assert.equal(doc.body.children[0].removed, true);
});

test('palette preferences round-trip both adapters while legacy settings and selected form survive', () => {
  const legacy = { watch: 'omniverse', mode: 'carousel', selectedId: 'heatblast', reducedMotion: false };
  assert.deepEqual(normalizePreferences(legacy, catalog.forms), legacy);
  for (const palette of Object.keys(PORTRAIT_PALETTES)) {
    const input = { ...legacy, palette };
    assert.deepEqual(normalizePreferences(sanitizePreferences(input), catalog.forms), input);
  }
  for (const palette of ['__proto__', 'invalid', null, {}, 123]) assert.deepEqual(normalizePreferences(sanitizePreferences({ ...legacy, palette }), catalog.forms), legacy);
});
