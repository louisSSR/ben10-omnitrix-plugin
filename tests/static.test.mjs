import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { WATCHES, MODES } from '../core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const html = read('preview.html');
const css = read('styles.css');
const app = read('app.js');
const sourceCatalog = JSON.parse(read('assets/catalog.json'));
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const catalogScripts = scripts.filter(match => /\bid=["']catalog-data["']/i.test(match[1]));
assert.equal(catalogScripts.length, 1, 'exactly one embedded catalog');
const catalog = JSON.parse(catalogScripts[0][2]);
const runtimeScripts = scripts.filter(match => !/\btype=["']application\/json["']/i.test(match[1]));

test('standalone build keeps all records and exactly 98 reviewed silhouettes', () => {
  assert.deepEqual(catalog, sourceCatalog);
  assert.deepEqual(catalog.coverage, { total: 225, reviewed: 98, missing: 127 });
  assert.equal(catalog.forms.length, 225);
  assert.equal(new Set(catalog.forms.map(form => form.id)).size, 225);
  const ready = catalog.forms.filter(form => form.asset);
  const missing = catalog.forms.filter(form => !form.asset);
  assert.equal(ready.length, 98);
  assert.equal(missing.length, 127);
  const symbolIds = [...html.matchAll(/<symbol\b[^>]*\bid=["']([^"']+)["']/gi)].map(match => match[1]);
  assert.equal(symbolIds.length, 98);
  assert.equal(new Set(symbolIds).size, 98);
  for (const form of ready) {
    assert.match(form.asset, /^alien-[a-z0-9-]+$/);
    assert.equal(symbolIds.filter(id => id === form.asset).length, 1, `${form.id} resolves to one embedded body`);
  }
  for (const id of ['ghostfreak-ov', 'nanomech-ua']) assert.ok(ready.some(form => form.id === id), `${id} has reviewed art`);
});

test('built preview has no runtime remote resource or unresolved build marker', () => {
  const resourceTags = [...html.matchAll(/<(script|img|link|iframe|video|audio|source|image|use)\b([^>]*)>/gi)];
  for (const [, tag, attributes] of resourceTags) {
    for (const match of attributes.matchAll(/\b(?:src|href|xlink:href|srcset)\s*=\s*(["'])(.*?)\1/gi)) {
      const value = match[2].trim();
      assert.ok(value.startsWith('#') || value.startsWith('data:'), `${tag} requires external resource: ${value.slice(0, 100)}`);
    }
  }
  assert.doesNotMatch(css, /@import\b|url\(\s*["']?\s*(?:https?:|\/\/)/i);
  assert.doesNotMatch(html, /APP_STYLES|ART_SYMBOLS|CATALOG_DATA|APP_CODE/);
  assert.equal(runtimeScripts.length, 1);
  const runtime = runtimeScripts[0][2];
  assert.doesNotMatch(runtimeScripts[0][1], /\bsrc\s*=/i);
  assert.doesNotMatch(runtime, /^\s*(?:import|export)\s/m);
  assert.doesNotMatch(runtime, /\b(?:fetch|XMLHttpRequest)\s*\(/);
  assert.doesNotThrow(() => new vm.Script(runtime, { filename: 'built-preview-runtime.js' }));
});

test('build receipt binds the actual delivered HTML bytes and coverage', () => {
  const receipt = JSON.parse(read('docs/build-receipt.json'));
  assert.equal(receipt.sha256, createHash('sha256').update(html).digest('hex'));
  assert.equal(receipt.bytes, Buffer.byteLength(html));
  assert.deepEqual(receipt.coverage, catalog.coverage);
  assert.equal(receipt.standalone, true);
});

test('all four watch skins and three summon modes plus archive are included', () => {
  const runtime = runtimeScripts[0][2];
  for (const watch of WATCHES) assert.ok(runtime.includes(`id: '${watch.id}'`), watch.id);
  for (const mode of MODES) assert.ok(runtime.includes(`id: '${mode.id}'`), mode.id);
  assert.match(html, /id=["']omni-app["'][^>]*data-mode=["']projection["'][^>]*data-watch=["']original["']/);
  assert.match(css, /\.watch-case\s*\{/);
  for (const id of ['recalibrated', 'ultimatrix', 'omniverse']) assert.ok(css.includes(`[data-watch=${id}]`), `${id} skin CSS`);
  for (const id of ['holo-shape', 'carousel', 'dial-shape', 'archive-grid']) assert.ok(html.includes(`id="${id}"`), `${id} stage`);
  assert.ok(css.includes('[data-mode=carousel]'));
  assert.ok(css.includes('[data-mode=dial]'));
  assert.ok(css.includes('[data-mode=archive]'));
});

function functionSection(first, next) {
  const start = app.indexOf(`function ${first}(`);
  const end = app.indexOf(`function ${next}(`, start);
  assert.ok(start >= 0 && end > start, `source section ${first} to ${next}`);
  return app.slice(start, end);
}
function node(tag, namespaceURI = null) {
  return { tag, namespaceURI, children: [], attributes: {}, dataset: {}, className: '', textContent: '',
    style: { setProperty() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
  };
}

test('actual figure renderer gives missing or invalid art a labeled placeholder', () => {
  const context = vm.createContext({ document: {
    createElement: tag => node(tag), createElementNS: (namespace, tag) => node(tag, namespace),
  } });
  vm.runInContext(`${functionSection('textElement', 'hourglass')}globalThis.figureForTest = figure;`, context);
  for (const form of [undefined, { asset: null }, { asset: 'https://example.com/fake.svg' }, { asset: 'alien-<script>' }]) {
    const result = context.figureForTest(form, 'card-shape');
    assert.equal(result.tag, 'span');
    assert.equal(result.textContent, '素材待补');
    assert.equal(result.className, 'card-shape pending-figure');
    assert.equal(result.children.length, 0);
  }
  const valid = context.figureForTest({ asset: 'alien-heatblast' }, 'card-shape');
  assert.equal(valid.tag, 'svg');
  assert.equal(valid.attributes.viewBox, '0 0 200 240');
  assert.equal(valid.children.length, 1);
  assert.equal(valid.children[0].tag, 'use');
  assert.equal(valid.children[0].attributes.href, '#alien-heatblast');
});

test('actual animation policy honors manual and system reduced motion and cancels handles', () => {
  const preferences = { reducedMotion: true };
  const systemMotion = { matches: false };
  let animations = 0, cancels = 0;
  const animatedNode = { animate() { animations++; return { cancel() { cancels++; }, finished: new Promise(() => {}) }; } };
  const context = vm.createContext({ preferences, systemMotion, motionHandles: [] });
  vm.runInContext(`${functionSection('reduced', 'selectionMotion')}globalThis.animateForTest = animate; globalThis.stopForTest = stopMotion;`, context);
  context.animateForTest(animatedNode, [], {});
  assert.equal(animations, 0);
  preferences.reducedMotion = false; systemMotion.matches = true;
  context.animateForTest(animatedNode, [], {});
  assert.equal(animations, 0);
  systemMotion.matches = false;
  context.animateForTest(animatedNode, [], {});
  assert.equal(animations, 1);
  context.stopForTest();
  assert.equal(cancels, 1);
  assert.equal(context.motionHandles.length, 0);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none!important;transition:\s*none!important/);
  assert.match(css, /\.reduced-motion[\s\S]*?animation:\s*none!important;transition:\s*none!important/);
});

test('rebuilding watch and mode controls restores the active replacement button', () => {
  const elements = new Map(['watch-options', 'mode-options', 'motion-toggle'].map(id => [id, node('div')]));
  const document = { activeElement: null };
  document.createElement = tag => {
    const created = node(tag);
    created.focus = () => { document.activeElement = created; };
    return created;
  };
  document.createElementNS = (namespace, tag) => node(tag, namespace);
  const context = vm.createContext({ document, WATCHES, MODES,
    $: id => elements.get(id), app: { classList: { toggle() {} } },
    preferences: { watch: 'omniverse', mode: 'dial', reducedMotion: false },
    systemMotion: { matches: false }, reduced: () => false,
  });
  vm.runInContext(`${functionSection('textElement', 'post')}${functionSection('renderControls', 'renderRing')}globalThis.controlsForTest = renderControls;`, context);
  for (const [action, value, container] of [['watch', 'omniverse', 'watch-options'], ['mode', 'dial', 'mode-options']]) {
    const oldControl = { dataset: { action, value } };
    document.activeElement = oldControl;
    context.controlsForTest();
    assert.notEqual(document.activeElement, oldControl);
    assert.equal(document.activeElement.dataset.action, action);
    assert.equal(document.activeElement.dataset.value, value);
    assert.equal(document.activeElement.attributes['aria-pressed'], 'true');
    assert.ok(elements.get(container).children.includes(document.activeElement));
  }
});

test('archive selection updates existing cards so their flip transitions can run', () => {
  const grid = node('div');
  const visible = [{ id: 'heatblast', en: 'Heatblast', asset: 'alien-heatblast' }, { id: 'wildmutt', en: 'Wildmutt', asset: 'alien-wildmutt' }];
  const preferences = { selectedId: 'heatblast' };
  const context = vm.createContext({ visible, preferences, archiveSignature: '', $: () => grid,
    document: { createElement: tag => node(tag), createElementNS: (namespace, tag) => node(tag, namespace) },
  });
  vm.runInContext(`${functionSection('textElement', 'hourglass')}${functionSection('renderArchive', 'renderStage')}globalThis.archiveForTest = renderArchive;`, context);
  context.archiveForTest();
  const originalCards = [...grid.children];
  preferences.selectedId = 'wildmutt';
  context.archiveForTest();
  assert.equal(grid.children[0], originalCards[0]);
  assert.equal(grid.children[1], originalCards[1]);
  assert.equal(grid.children[0].attributes['aria-pressed'], 'false');
  assert.equal(grid.children[1].attributes['aria-pressed'], 'true');
  context.visible = [visible[1]];
  context.archiveForTest();
  assert.equal(grid.children.length, 1);
  assert.notEqual(grid.children[0], originalCards[1]);
});

test('keyboard and mobile layout affordances remain in the offline build', () => {
  assert.match(html, /id=["']stage["'][^>]*tabindex=["']0["']/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*380px\)/);
  assert.match(app, /new ResizeObserver\(/);
  assert.match(app, /resize\.disconnect\(\)/);
});
