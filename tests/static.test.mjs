import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { inflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { WATCHES, MODES, dialSelectionFrames } from '../core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const html = read('preview.html');
const css = read('styles.css');
const app = read('app.js');
const sourceSvg = read('assets/silhouettes.svg');
const inlineSvg = sourceSvg.replace(/href="runtime\/([a-f0-9]{64})\.(png|avif)"/g, (_all, sha, type) => {
  const raw = readFileSync(path.join(root, 'assets/runtime', `${sha}.${type}`));
  assert.equal(createHash('sha256').update(raw).digest('hex'), sha);
  return `href="data:image/${type};base64,${raw.toString('base64')}"`;
});
const sourceCatalog = JSON.parse(read('assets/catalog.json'));
const extraArt = JSON.parse(read('assets/extra-art.json'));
const expectedReviewed = 98 + extraArt.assets.length;
const expectedTotal = 225 - (extraArt.mergedForms || []).length;
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const catalogScripts = scripts.filter(match => /\bid=["']catalog-data["']/i.test(match[1]));
assert.equal(catalogScripts.length, 1, 'exactly one embedded catalog');
const catalog = JSON.parse(catalogScripts[0][2]);
const runtimeScripts = scripts.filter(match => !/\btype=["']application\/json["']/i.test(match[1]));

test('offline directory build keeps the baseline and every individually reviewed addition', () => {
  assert.deepEqual(catalog, sourceCatalog);
  assert.deepEqual(catalog.coverage, { total: expectedTotal, reviewed: expectedReviewed, missing: expectedTotal - expectedReviewed });
  assert.equal(catalog.forms.length, expectedTotal);
  assert.equal(new Set(catalog.forms.map(form => form.id)).size, expectedTotal);
  const ready = catalog.forms.filter(form => form.asset);
  const missing = catalog.forms.filter(form => !form.asset);
  assert.equal(ready.length, expectedReviewed);
  assert.equal(missing.length, expectedTotal - expectedReviewed);
  const symbolIds = [...html.matchAll(/<symbol\b[^>]*\bid=["']([^"']+)["']/gi)].map(match => match[1]);
  assert.equal(symbolIds.length, expectedReviewed);
  assert.equal(new Set(symbolIds).size, expectedReviewed);
  for (const form of ready) {
    assert.match(form.asset, /^alien-[a-z0-9-]+$/);
    assert.equal(symbolIds.filter(id => id === form.asset).length, 1, `${form.id} resolves to one embedded body`);
  }
  for (const id of ['ghostfreak-ov', 'nanomech-ua']) assert.ok(ready.some(form => form.id === id), `${id} has reviewed art`);
});

function rgbaPixels(png) {
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.ok(width > 0 && width <= 8192 && height > 0 && height <= 8192);
  assert.equal(png[24], 8); assert.equal(png[28], 0);
  assert.ok([3, 6].includes(png[25]), 'bodies use RGBA or indexed transparent PNG');
  const channels = png[25] === 3 ? 1 : 4;
  let palette, transparency;
  const blocks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') blocks.push(png.subarray(offset + 8, offset + 8 + length));
    if (type === 'PLTE') palette = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'tRNS') transparency = png.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(blocks)), stride = width * channels, pixels = Buffer.alloc(stride * height);
  assert.equal(raw.length, (stride + 1) * height);
  const paeth = (a, b, c) => { const p = a + b - c, distances = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)]; return distances[0] <= distances[1] && distances[0] <= distances[2] ? a : distances[1] <= distances[2] ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x, left = x >= channels ? pixels[index - channels] : 0, up = y ? pixels[index - stride] : 0, diagonal = y && x >= channels ? pixels[index - stride - channels] : 0;
      const prediction = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, diagonal)][filter];
      pixels[index] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255;
    }
  }
  if (channels === 4) return { pixels, width, height };
  assert.ok(palette?.length && palette.length % 3 === 0 && transparency?.length);
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < pixels.length; i++) {
    const index = pixels[i]; assert.ok(index * 3 + 2 < palette.length);
    palette.copy(rgba, i * 4, index * 3, index * 3 + 3);
    rgba[i * 4 + 3] = transparency[index] ?? 255;
  }
  return { pixels: rgba, width, height };
}

// Pillow only decodes the original AVIF bytes. Filter and envelope verification
// below runs independently in JS; it does not import or execute the fit builder.
function legacyRgbPixels() {
  const decoder = `import base64,io,json,sys,zlib,xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image
ns='{http://www.w3.org/2000/svg}'
result={}
for symbol in ET.parse(sys.argv[1]).iter(ns+'symbol'):
    image=symbol.find(ns+'image')
    uri=image.attrib['href']
    if not uri.endswith('.avif'): continue
    with Image.open(io.BytesIO((Path(sys.argv[1]).parent/uri).read_bytes())) as pic:
        assert pic.format=='AVIF' and pic.mode=='RGB'
        result[symbol.attrib['id']]={'width':pic.width,'height':pic.height,'rgb':base64.b64encode(zlib.compress(pic.tobytes())).decode('ascii')}
print(json.dumps(result))`;
  return JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', decoder, path.join(root, 'assets/silhouettes.svg')], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
}

test('all dial fits keep every visible pixel corner inside the safe diamond without changing body bytes', () => {
  const fitReport = JSON.parse(read('assets/dial-fit.json')), svg = inlineSvg;
  const finalCatalogHash = createHash('sha256').update(readFileSync(path.join(root, 'assets/catalog.json'))).digest('hex');
  assert.equal(JSON.parse(read('assets/provenance.json')).catalogSha256, finalCatalogHash);
  assert.equal(fitReport.sourceSvgSha256, createHash('sha256').update(sourceSvg).digest('hex'));
  assert.equal(fitReport.shapeCount, expectedReviewed); assert.equal(fitReport.bitmapEdits, 0); assert.equal(fitReport.safeDiamondRadius, .87);
  // Source geometry can be tested before preview.html is rebuilt. A separate
  // build-freshness test above still requires its catalog to match this source.
  const ready = sourceCatalog.forms.filter(form => form.asset), legacy = legacyRgbPixels();
  assert.deepEqual(Object.keys(fitReport.fits).sort(), ready.map(form => form.id).sort());
  let nativeCount = 0, legacyCount = 0;
  for (const form of ready) {
    const fit = fitReport.fits[form.id]; assert.deepEqual(form.dialFit, fit);
    assert.ok(Number.isFinite(fit.scale) && fit.scale > 0 && fit.scale < 1, form.id);
    const symbol = svg.match(new RegExp(`<symbol\\b[^>]*id="${form.asset}"[^>]*>[\\s\\S]*?<\\/symbol>`))?.[0];
    assert.ok(symbol, form.id);
    const storedSymbol = sourceSvg.match(new RegExp(`<symbol\\b[^>]*id="${form.asset}"[^>]*>[\\s\\S]*?<\\/symbol>`))?.[0];
    assert.ok(storedSymbol && html.includes(storedSymbol.replace(/href="runtime\//g, 'href="./assets/runtime/')), `${form.id} keeps the same local body reference and geometry`);
    const encoded = symbol.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)?.[1];
    let extent = 0, visiblePixels = 0;
    const checkCorner = (x, y, margin = 0) => {
      const distance = (Math.abs(x - 100) + Math.abs(y - 120) + margin) / 120;
      extent = Math.max(extent, distance);
      assert.ok(distance * fit.scale <= fitReport.safeDiamondRadius + 1e-6, `${form.id} visible corner (${x}, ${y}) is clipped by the dial`);
    };
    if (encoded) {
      nativeCount++; assert.equal(fit.method, 'native-png-alpha-diamond-envelope');
      const { pixels, width, height } = rgbaPixels(Buffer.from(encoded, 'base64'));
      const ratio = Math.min(200 / width, 240 / height), ox = (200 - width * ratio) / 2, oy = (240 - height * ratio) / 2;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (pixels[(y * width + x) * 4 + 3] > 0) {
        visiblePixels++;
        for (const dx of [0, 1]) for (const dy of [0, 1]) checkCorner(ox + (x + dx) * ratio, oy + (y + dy) * ratio);
      }
      assert.equal(visiblePixels, fit.visiblePixels, form.id);
    } else {
      legacyCount++; assert.equal(fit.method, 'legacy-avif-filter-diamond-envelope');
      const decoded = legacy[form.asset]; assert.ok(decoded, form.id);
      const { width, height } = decoded, rgb = inflateSync(Buffer.from(decoded.rgb, 'base64'));
      assert.equal(rgb.length, width * height * 3); assert.deepEqual(fit.sourceImageSize, [width, height]);
      const imageTag = symbol.match(/<image\b[^>]*\/>/)[0];
      const attribute = name => imageTag.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
      assert.equal(attribute('preserveAspectRatio'), 'xMidYMid meet');
      assert.equal(attribute('transform'), undefined);
      const filterId = attribute('filter').match(/^url\(#([^()]+)\)$/)[1];
      assert.equal(fit.filterId, filterId);
      const filter = svg.match(new RegExp(`<filter\\b[^>]*id="${filterId}"[^>]*>[\\s\\S]*?<\\/filter>`))[0];
      assert.match(filter, /color-interpolation-filters="sRGB"/);
      assert.equal((filter.match(/<feComponentTransfer>/g) || []).length, 1);
      assert.equal((filter.match(/<feColorMatrix\b/g) || []).length, 1);
      assert.doesNotMatch(filter, /<feFuncA\b/);
      const matrix = filter.match(/<feColorMatrix type="matrix" values="([^"]+)"/)[1].split(/\s+/).map(Number);
      assert.deepEqual(matrix, [...Array(15).fill(0), 1, 1, 1, 0, 0]);
      const tables = ['R', 'G', 'B'].map(channel => {
        const table = filter.match(new RegExp(`<feFunc${channel} type="table" tableValues="([^"]+)"`))[1].split(/\s+/).map(Number);
        assert.equal(table.length, 256); assert.ok(table.every(value => value >= 0 && value <= 1));
        const transparent = table.flatMap((value, index) => value === 0 ? [index] : []);
        assert.ok(transparent.length > 0);
        assert.equal(transparent.at(-1) - transparent[0] + 1, transparent.length, 'interpolating transparent colors cannot create visible islands');
        return table;
      });
      const transferred = (value, table) => {
        const index = value / 255 * (table.length - 1), low = Math.floor(index), high = Math.min(low + 1, table.length - 1);
        return table[low] + (index - low) * (table[high] - table[low]);
      };
      const boxWidth = Number(attribute('width')), boxHeight = Number(attribute('height'));
      const ratio = Math.min(boxWidth / width, boxHeight / height);
      const originX = Number(attribute('x') || 0) + (boxWidth - width * ratio) / 2;
      const originY = Number(attribute('y') || 0) + (boxHeight - height * ratio) / 2;
      assert.equal(fit.resamplingMargin, 2, 'reserve one SVG unit per axis for sampling');
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const pixel = (y * width + x) * 3;
        const alpha = Math.min(1, tables.reduce((sum, table, channel) => sum + transferred(rgb[pixel + channel], table), 0));
        if (alpha <= 0) continue;
        visiblePixels++;
        for (const dx of [0, 1]) for (const dy of [0, 1]) checkCorner(originX + (x + dx) * ratio, originY + (y + dy) * ratio, fit.resamplingMargin);
      }
      assert.equal(visiblePixels, fit.visiblePixels, form.id);
      assert.ok(fit.scale > .4745, `${form.id} uses its visible body instead of the empty viewport`);
    }
    assert.ok(Math.abs(extent - fit.diamondExtent) < 1e-6, `${form.id} fit records the measured envelope`);
  }
  assert.deepEqual([nativeCount, legacyCount], [90 + extraArt.assets.length, 8]);
  assert.ok(fitReport.fits.heatblast.scale > .8, 'Heatblast remains legible instead of retaining the old half-size fit');
  for (const form of sourceCatalog.forms.filter(form => !form.asset)) assert.equal(form.dialFit, undefined, `${form.id} remains missing`);
});

test('built preview has no runtime remote resource or unresolved build marker', () => {
  const resourceTags = [...html.matchAll(/<(script|img|link|iframe|video|audio|source|image|use)\b([^>]*)>/gi)];
  for (const [, tag, attributes] of resourceTags) {
    for (const match of attributes.matchAll(/\b(?:src|href|xlink:href|srcset)\s*=\s*(["'])(.*?)\1/gi)) {
      const value = match[2].trim();
      assert.ok(value.startsWith('#') || /^\.\/assets\/runtime\/[a-f0-9]{64}\.(png|avif)$/.test(value), `${tag} requires an undeclared resource: ${value.slice(0, 100)}`);
    }
  }
  assert.doesNotMatch(css, /@import\b|url\(\s*["']?\s*(?:https?:|\/\/)/i);
  assert.doesNotMatch(html, /APP_STYLES|ART_SYMBOLS|CATALOG_DATA|APP_CODE/);
  assert.equal(runtimeScripts.length, 1);
  const runtime = runtimeScripts[0][2];
  assert.doesNotMatch(runtimeScripts[0][1], /\bsrc\s*=/i);
  assert.doesNotMatch(runtime, /^\s*(?:import|export)\s/m);
  assert.doesNotMatch(runtime, /\b(?:fetch|XMLHttpRequest)\s*\(/);
  assert.ok(runtime.includes(read('core.js').replace(/^export /gm, '')), 'delivered core matches the tested source');
  assert.ok(runtime.includes(app.replace(/^import[^\n]+\n/, '')), 'delivered app matches the tested source');
  assert.doesNotThrow(() => new vm.Script(runtime, { filename: 'built-preview-runtime.js' }));
});

test('build receipt binds the actual delivered HTML bytes and coverage', () => {
  const receipt = JSON.parse(read('docs/build-receipt.json'));
  assert.equal(receipt.sha256, createHash('sha256').update(html).digest('hex'));
  assert.equal(receipt.bytes, Buffer.byteLength(html));
  assert.deepEqual(receipt.coverage, catalog.coverage);
  assert.equal(receipt.standalone, true);
});

test('all four watch images are stored unchanged and bound by the build receipt', () => {
  const receipt = JSON.parse(read('docs/build-receipt.json'));
  const provenance = JSON.parse(read('assets/watches-v3/provenance.json'));
  const decoder = `import json,sys
from pathlib import Path
from PIL import Image
result={}
for name in ('original','recalibrated','ultimatrix','omniverse'):
    with Image.open(Path(sys.argv[1])/(name+'.png')) as pic:
        assert pic.format=='PNG' and pic.mode=='RGBA'
        alpha=pic.getchannel('A')
        result[name]={'width':pic.width,'height':pic.height,'alphaExtrema':alpha.getextrema(),'transparentPixels':alpha.histogram()[0]}
print(json.dumps(result))`;
  const decoded = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', decoder, path.join(root, 'assets/watches-v3')], { encoding: 'utf8' }));
  assert.deepEqual(receipt.watchArt.map(item => item.id), WATCHES.map(watch => watch.id));
  assert.deepEqual(provenance.assets.map(item => item.id).sort(), WATCHES.map(watch => watch.id).sort());
  for (const item of receipt.watchArt) {
    const bytes = readFileSync(path.join(root, 'assets', 'watches-v3', `${item.id}.png`));
    const metadata = provenance.assets.find(asset => asset.id === item.id);
    const actual = decoded[item.id];
    assert.equal(item.sha256, createHash('sha256').update(bytes).digest('hex'), item.id);
    assert.equal(item.bytes, bytes.length, item.id);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', item.id);
    assert.deepEqual([bytes[24], bytes[25]], [8, 6], `${item.id} uses RGBA PNG`);
    const dimensions = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    assert.ok(dimensions.every(size => size >= 512), `${item.id} has sufficient native resolution`);
    assert.deepEqual([item.width, item.height], dimensions, `${item.id} receipt dimensions`);
    assert.deepEqual([actual.width, actual.height], dimensions, `${item.id} decoded dimensions`);
    assert.deepEqual([metadata.width, metadata.height], dimensions, `${item.id} provenance dimensions`);
    assert.equal(metadata.file, `${item.id}.png`, item.id);
    assert.equal(metadata.byteLength, bytes.length, item.id);
    assert.equal(metadata.sha256, item.sha256, item.id);
    // Image generation may retain alpha 254 on the visible subject; exact 255 was never an asset requirement.
    assert.equal(actual.alphaExtrema[0], 0, `${item.id} has genuinely transparent background pixels`);
    assert.ok(actual.alphaExtrema[1] >= 250, `${item.id} has a near-opaque visible subject`);
    assert.ok(actual.transparentPixels > 0 && actual.transparentPixels < item.width * item.height, item.id);
    assert.deepEqual(metadata.alphaExtrema, actual.alphaExtrema, `${item.id} provenance alpha range`);
    assert.equal(metadata.transparentPixels, actual.transparentPixels, `${item.id} provenance transparency count`);
    const relative = `./assets/runtime/${item.sha256}.png`;
    assert.ok(html.includes(relative), `${item.id} has an offline file reference`);
    assert.deepEqual(readFileSync(path.join(root, relative)), bytes, `${item.id} original bytes are preserved`);
  }
});

test('offline build includes four watch skins, exactly three stages and the two dial shutters', () => {
  const runtime = runtimeScripts[0][2];
  for (const watch of WATCHES) assert.ok(runtime.includes(`id: '${watch.id}'`), watch.id);
  for (const mode of MODES) assert.ok(runtime.includes(`id: '${mode.id}'`), mode.id);
  assert.match(html, /id=["']omni-app["'][^>]*data-mode=["']projection["'][^>]*data-watch=["']original["']/);
  assert.match(css, /\.watch-case\s*\{/);
  for (const id of ['recalibrated', 'ultimatrix', 'omniverse']) assert.ok(css.includes(`[data-watch=${id}]`), `${id} skin CSS`);
  for (const id of ['holo-shape', 'holo-depth-back', 'holo-depth-mid', 'holo-depth-front', 'projection-emitter', 'carousel', 'dial-shape', 'dial-previous', 'screen-rotor', 'dial-shutter-a', 'dial-shutter-b']) assert.ok(html.includes(`id="${id}"`), `${id} stage`);
  assert.ok(css.includes('[data-mode=carousel]'));
  assert.ok(css.includes('[data-mode=dial]'));
  assert.doesNotMatch(html, /id=["']archive-grid["']|data-mode=["']archive["']/);
  assert.doesNotMatch(css, /\[data-mode=["']?archive\b|\.archive-(?:grid|card)\b/);
  assert.doesNotMatch(app, /archive-grid|renderArchive/);
});

function functionSection(first, next) {
  const start = app.indexOf(`function ${first}(`);
  const end = app.indexOf(`function ${next}(`, start);
  assert.ok(start >= 0 && end > start, `source section ${first} to ${next}`);
  return app.slice(start, end);
}
function node(tag, namespaceURI = null) {
  const result = { tag, namespaceURI, children: [], attributes: {}, dataset: {}, className: '', textContent: '', hidden: false,
    style: { setProperty(name, value) { this[name] = String(value); }, getPropertyValue(name) { return this[name] || ''; } },
    setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'class') this.className = String(value); },
    getAttribute(name) { return this.attributes[name]; },
    append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } },
    replaceChildren(...children) { this.children = []; this.append(...children); },
    matches(selector) {
      return selector.split(',').some(part => {
        part = part.trim();
        if (part.startsWith('.')) return this.className.split(/\s+/).includes(part.slice(1));
        if (part.startsWith('#')) return this.id === part.slice(1);
        const attribute = part.match(/^\[([^=\]]+)(?:=["']([^"']*)["'])?\]$/);
        if (attribute) {
          const key = attribute[1].startsWith('data-') ? attribute[1].slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) : null;
          const value = key ? this.dataset[key] : this.attributes[attribute[1]];
          return attribute[2] === undefined ? value !== undefined : value === attribute[2];
        }
        return this.tag === part;
      });
    },
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; },
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    focus() { this.onFocus?.(this); },
  };
  result.classList = {
    contains: name => result.className.split(/\s+/).includes(name),
    add(...names) { result.className = [...new Set([...result.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
    remove(...names) { result.className = result.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
    toggle(name, force) { const add = force === undefined ? !this.contains(name) : force; if (add) this.add(name); else this.remove(name); return add; },
  };
  return result;
}

// Execute the actual app, using controlled browser interfaces to test state and cancellation.
// Explicit rectangle fixtures below test coordinate handling, not browser layout or painted pixels.
function boot({ mode = 'projection', reducedMotion = false, systemReduced = false, rects = {}, atlas = null, imageState = 'ready' } = {}) {
  let now = 1000, serial = 0;
  const timers = new Map(), frames = new Map(), animations = [], elements = new Map(), anonymous = [];
  const rectangles = new Map(Object.entries(rects)), observers = [];
  const document = { activeElement: null };
  const makeNode = (tag, namespace = null) => {
    const result = node(tag, namespace), listeners = new Map();
    result.onFocus = value => { document.activeElement = value; };
    result.addEventListener = (type, fn, options = {}) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push({ fn, signal: options.signal }); };
    result.emit = (type, extra = {}) => {
      const event = { target: result, preventDefault() { this.defaultPrevented = true; }, isTrusted: true, ...extra };
      for (const { fn, signal } of listeners.get(type) || []) if (!signal?.aborted) fn(event);
    };
    result.animate = (keyframes, options) => {
      const handle = { node: result, keyframes, options, cancelled: false, finished: new Promise(() => {}), cancel() { this.cancelled = true; } };
      animations.push(handle); return handle;
    };
    result.showModal = () => { result.open = true; }; result.close = () => { result.open = false; };
    result.getBoundingClientRect = () => rectangles.get(result.id) || { left: 0, top: 0, right: 500, bottom: 500 };
    return result;
  };
  for (const match of read('preview.shell.html').matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const result = makeNode(match[1].toLowerCase()), id = match[2].match(/\bid=["']([^"']+)["']/)?.[1];
    result.className = match[2].match(/\bclass=["']([^"']+)["']/)?.[1] || '';
    for (const attribute of match[2].matchAll(/\bdata-([\w-]+)=["']([^"']*)["']/g)) result.dataset[attribute[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = attribute[2];
    if (id) { result.id = id; elements.set(id, result); } else anonymous.push(result);
  }
  document.createElement = tag => makeNode(tag);
  document.createElementNS = (namespace, tag) => makeNode(tag, namespace);
  document.getElementById = id => elements.get(id) || null;
  document.querySelector = selector => [...elements.values(), ...anonymous].find(value => value.matches(selector)) || null;
  const fixture = [...sourceCatalog.forms.filter(form => form.asset).slice(0, 12), sourceCatalog.forms.find(form => !form.asset)];
  elements.get('catalog-data').textContent = JSON.stringify({ ...sourceCatalog, forms: fixture });
  if (elements.has('watch-views')) elements.get('watch-views').textContent = JSON.stringify(atlas);
  for (const watch of WATCHES) {
    const image = elements.get(`watch-atlas-${watch.id}`);
    if (image) { image.complete = imageState !== 'loading'; image.naturalWidth = imageState === 'ready' ? 2400 : 0; }
  }
  elements.get('stage').clientWidth = 390;
  let saved = JSON.stringify({ mode, watch: 'original', selectedId: fixture[0].id, reducedMotion });
  const window = makeNode('window'), systemMotion = makeNode('media'); window.parent = window; systemMotion.matches = systemReduced;
  const context = vm.createContext({ document, window, matchMedia: () => systemMotion, AbortController,
    localStorage: { getItem: () => saved, setItem: (_, value) => { saved = value; } },
    location: { origin: 'null' }, navigator: { clipboard: { writeText: async () => {} } },
    performance: { now: () => now }, Date: { now: () => now },
    setTimeout(fn, delay) { const id = ++serial; timers.set(id, { fn, due: now + delay }); return id; }, clearTimeout: id => timers.delete(id),
    requestAnimationFrame(fn) { const id = ++serial; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; observers.push(this); }
      observe(target) { this.targets.add(target); }
      disconnect() { this.targets.clear(); this.disconnected = true; }
    },
  });
  const core = read('core.js').replace(/^export /gm, '');
  vm.runInContext(`(() => { ${core}\n${app.replace(/^import[^\n]+\n/, '')}\n})();`, context);
  const advance = ms => {
    const end = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].due; next[1].fn();
    }
    now = end;
  };
  return { elements, fixture, animations, timers, frames, systemMotion, window, observers,
    get preferences() { return JSON.parse(saved); },
    advance,
    setRect(id, rect) { rectangles.set(id, rect); },
    resize() { for (const observer of observers) if (!observer.disconnected) observer.callback([...observer.targets].map(target => ({ target }))); },
    frame(ms = 16) { advance(ms); const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(now); },
    click(id) { elements.get(id).emit('click'); },
    action(action, value) { const control = makeNode('button'); control.dataset = { action, value }; elements.get('omni-app').emit('click', { target: control }); },
  };
}

function assertCoordinates(actual, expected, message) {
  assert.equal(actual.length, expected.length, message);
  actual.forEach((value, index) => assert.ok(Number.isFinite(value) && Math.abs(value - expected[index]) < 1e-6,
    `${message}: coordinate ${index} is ${value}, expected ${expected[index]}`));
}
function projectionAnchor(h) {
  const hologram = h.elements.get('hologram');
  return [parseFloat(hologram.style.left), parseFloat(hologram.style.top) + parseFloat(hologram.style.height) - 5];
}
function assertProjectionBase(h, center, message) {
  assert.equal(h.elements.get('projection-emitter').hidden, true, `${message}: the old synthetic emitter stays hidden`);
  assertCoordinates(projectionAnchor(h), center, `${message}: the atlas face itself is the beam base`);
}

function viewFixture() {
  const frames = Array.from({ length: 4 }, (_, index) => ({
    closed: { x: .4 + index * .03, y: .6, w: .3, h: .3 - index * .05, a: index - 2 },
    raised: { x: .4 + index * .03, y: .3, w: .3, h: .3 - index * .06, a: index - 2 },
  }));
  return { columns: 4, rows: 2, views: [
    { id: 'top', name: '俯视' }, { id: 'left', name: '左前' }, { id: 'low', name: '低角度' }, { id: 'right', name: '右前' },
  ], watches: Object.fromEntries(WATCHES.map(watch => [watch.id, { width: 2400, height: 1200, frames }])) };
}

test('watch atlas starts at the low view with the mode-specific core and preserves host preferences', () => {
  for (const mode of ['projection', 'carousel', 'dial']) {
    const h = boot({ mode, atlas: viewFixture(), reducedMotion: true });
    const appNode = h.elements.get('omni-app'), image = h.elements.get('watch-atlas-original');
    assert.equal(appNode.dataset.watchView, 'low');
    assert.equal(appNode.dataset.coreState, mode === 'projection' ? 'raised' : 'closed');
    assert.equal(appNode.dataset.watchArt, mode === 'dial' ? 'dial' : 'atlas');
    assert.equal(h.elements.get('watch-view-toolbar').hidden, mode === 'dial');
    assert.equal(image.hidden, mode === 'dial');
    assert.equal(image.style.left, '-200%');
    assert.equal(image.style.top, mode === 'projection' ? '-100%' : '0%');
    if (mode !== 'dial') {
      assert.equal(h.elements.get('watch-multiview').style.aspectRatio, '600 / 600');
      assert.equal(h.elements.get('watch-device').style.aspectRatio, '600 / 600');
      assertCoordinates(['left', 'top', 'width', 'height'].map(key => parseFloat(h.elements.get('watch-screen').style[key])),
        [46, mode === 'projection' ? 30 : 60, 30, mode === 'projection' ? 18 : 20], `${mode} uses its current frame face`);
    } else assert.equal(h.elements.get('watch-screen').style.left, '', 'dial retains the old front-face positioning');
    const saved = h.preferences;
    h.action('watch-view', 'right');
    if (mode !== 'dial') {
      assert.equal(appNode.dataset.watchView, 'right');
      assert.equal(image.style.left, '-300%');
      assert.equal(h.elements.get('watch-screen').style['--watch-face-angle'], '1deg');
      const selected = h.elements.get('watch-view-controls').children.find(control => control.dataset.value === 'right');
      assert.equal(selected.attributes['aria-pressed'], 'true');
    } else assert.equal(appNode.dataset.watchView, 'low', 'dial ignores hidden view controls');
    assert.deepEqual(h.preferences, saved, 'view controls do not write local or host preferences');
  }
});

test('watch atlas core toggle updates row, beam visibility and ring centre from the same frame', () => {
  const h = boot({ mode: 'carousel', atlas: viewFixture(), reducedMotion: true, rects: {
    stage: { left: 20, top: 60, width: 390, height: 590 },
    'watch-device': { left: 80, top: 330, width: 240, height: 240 },
    'watch-screen': { left: 180, top: 400, width: 50, height: 30 },
  } });
  const stage = h.elements.get('stage'), image = h.elements.get('watch-atlas-original');
  const saved = h.preferences;
  assertCoordinates(['--ring-center-x', '--ring-center-y'].map(key => parseFloat(stage.style[key])), [170.4, 414], 'closed face centres the ring');
  assertCoordinates([Number(stage.style['--ring-ellipse'])], [.2 / .3], 'closed view determines the ring ellipse');
  h.click('toggle-watch-core');
  assert.equal(image.style.top, '-100%');
  assert.equal(h.elements.get('toggle-watch-core').textContent, '收起表芯');
  assertCoordinates(['--ring-center-x', '--ring-center-y'].map(key => parseFloat(stage.style[key])), [170.4, 342], 'raised face recentres the ring');
  assertCoordinates([Number(stage.style['--ring-ellipse'])], [.18 / .3], 'raised view determines the ring ellipse');
  assert.deepEqual(h.preferences, saved, 'core row is session state');
  h.action('mode', 'projection');
  assert.equal(h.elements.get('hologram').hidden, false, 'projection starts with its raised core');
  h.click('toggle-watch-core');
  assert.equal(image.style.top, '0%');
  assert.equal(h.elements.get('hologram').hidden, true); assert.equal(h.elements.get('holo-light').hidden, true);
  h.click('next');
  assert.equal(h.elements.get('hologram').hidden, true, 'hero selection does not reopen a lowered core');
  h.click('toggle-watch-core');
  assert.equal(h.elements.get('hologram').hidden, false);
  h.action('mode', 'dial');
  assert.equal(h.elements.get('watch-device').style.aspectRatio, '');
  for (const key of ['left', 'top', 'width', 'height']) assert.equal(h.elements.get('watch-screen').style[key], '');
  h.action('mode', 'carousel');
  assert.equal(image.style.top, '-100%', 'each summon mode retains its own temporary core state');
});

test('watch atlas loading and errors restore the front image and can recover without affecting other watches', () => {
  const h = boot({ atlas: viewFixture(), imageState: 'loading', reducedMotion: true });
  const appNode = h.elements.get('omni-app'), original = h.elements.get('watch-atlas-original');
  assert.equal(appNode.dataset.watchArt, 'loading');
  assert.equal(h.elements.get('watch-multiview').hidden, true);
  assert.match(h.elements.get('watch-view-status').textContent, /加载中/);
  assert.ok(h.elements.get('watch-view-controls').children.every(control => control.disabled));
  h.action('watch-view', 'top'); assert.equal(appNode.dataset.watchView, 'low');
  original.naturalWidth = 2400; original.emit('load');
  assert.equal(appNode.dataset.watchArt, 'atlas'); assert.equal(original.hidden, false);
  assert.equal(h.elements.get('watch-view-status').hidden, true);
  original.emit('error');
  assert.equal(appNode.dataset.watchArt, 'fallback'); assert.equal(original.hidden, true);
  assert.equal(h.elements.get('watch-screen').style.left, '');
  assert.match(h.elements.get('watch-view-status').textContent, /已回退正视图/);
  original.emit('load');
  const inactive = h.elements.get('watch-atlas-ultimatrix'); inactive.emit('error');
  assert.equal(appNode.dataset.watchArt, 'atlas', 'an inactive watch error cannot replace the visible atlas');
  h.action('watch', 'ultimatrix');
  assert.equal(appNode.dataset.watchArt, 'fallback');
  h.action('watch', 'original');
  assert.equal(appNode.dataset.watchArt, 'atlas');
  h.window.emit('pagehide'); original.emit('error');
  assert.equal(appNode.dataset.watchArt, 'atlas', 'page exit aborts atlas event listeners');
});

test('watch atlas face-centred body width follows views and core rows and resets on fallback', () => {
  const atlas = viewFixture();
  atlas.watches.original.frames[0].raised.x = .7;
  const h = boot({ mode: 'carousel', atlas, reducedMotion: true });
  const device = h.elements.get('watch-device');
  const assertBody = (faceX, width, message) => {
    assertCoordinates([parseFloat(device.style['--watch-view-face-x']), parseFloat(device.style['--watch-ring-body-width'])],
      [faceX * 100, width], message);
    assert.match(device.style['--watch-view-face-x'], /%$/);
    assert.match(device.style['--watch-ring-body-width'], /cqw$/);
    assert.ok(width * Math.max(faceX, 1 - faceX) <= 48 + 1e-6, `${message}: neither side of the centred face crosses the stage`);
  };
  assertBody(.46, 92 / (2 * .54), 'initial low-view frame');
  h.action('watch-view', 'top');
  assertBody(.4, 92 / (2 * .6), 'new view updates the body offset and safe width');
  h.click('toggle-watch-core');
  assertBody(.7, 92 / (2 * .7), 'raised face can have a different horizontal anchor');
  h.click('toggle-watch-core');
  assertBody(.4, 92 / (2 * .6), 'closing restores its own frame geometry');
  h.elements.get('watch-atlas-original').emit('error');
  assertBody(.5, 96, 'front-art fallback clears the prior atlas offset');
});

test('watch atlas invalid metadata falls back without displaying misaligned frame artwork', () => {
  for (const atlas of [null, [], { ...viewFixture(), columns: 8 },
    { ...viewFixture(), watches: { original: { width: 2400, height: 1200, frames: [] } } }]) {
    const h = boot({ atlas, reducedMotion: true });
    assert.equal(h.elements.get('omni-app').dataset.watchArt, 'fallback');
    assert.equal(h.elements.get('watch-multiview').hidden, true);
    assert.equal(h.elements.get('toggle-watch-core').disabled, true);
  }
});

test('watch atlas angle fades are short and cancelled on rapid input or reduced motion', () => {
  const h = boot({ atlas: viewFixture() });
  h.action('watch-view', 'top');
  const first = h.animations.find(handle => handle.node.id === 'watch-multiview');
  assert.equal(first.options.duration, 180);
  assert.ok(first.keyframes.every(frame => !('transform' in frame)), 'the body is never flattened with a whole-watch rotation');
  h.action('watch-view', 'left');
  assert.equal(first.cancelled, true);
  const second = h.animations.at(-1);
  h.click('motion-toggle');
  assert.equal(second.cancelled, true);
  const count = h.animations.length;
  h.action('watch-view', 'right'); h.click('toggle-watch-core');
  assert.equal(h.animations.length, count, 'reduced motion changes atlas cells immediately');
  assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0);
  assert.equal(h.elements.get('watch-atlas-original').style.left, '-300%');
  assert.equal(h.elements.get('watch-atlas-original').style.top, '0%');
});

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

test('manual and system reduced motion select immediately with no pending animation work', () => {
  for (const mode of ['projection', 'carousel', 'dial']) for (const options of [{ reducedMotion: true }, { systemReduced: true }]) {
    const h = boot({ mode, ...options }); h.click('next');
    assert.equal(h.preferences.selectedId, h.fixture[1].id);
    assert.equal(h.animations.length, 0);
    assert.equal(h.frames.size, 0);
    assert.equal(h.timers.size, 0);
    assert.notEqual(h.elements.get('dial-shape').style.visibility, 'hidden');
    assert.equal(h.elements.get('holo-light').hidden, mode !== 'projection');
  }
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none!important;transition:\s*none!important/);
  assert.match(css, /\.reduced-motion[\s\S]*?animation:\s*none!important;transition:\s*none!important/);
});

test('projection keeps its steady light after settling and hides it for missing art and other modes', () => {
  const h = boot(), light = h.elements.get('holo-light'); assert.equal(light.hidden, false);
  h.click('next'); h.click('next'); h.advance(1000);
  assert.equal(h.timers.size, 0); assert.equal(light.hidden, false);
  h.click('motion-toggle'); assert.equal(light.hidden, false);
  for (const mode of ['carousel', 'dial']) { h.action('mode', mode); assert.equal(light.hidden, true); }
  h.action('mode', 'projection');
  h.elements.get('ready-only').emit('change', { target: { checked: false } });
  h.action('select', h.fixture.at(-1).id);
  assert.equal(light.hidden, true); assert.equal(h.elements.get('stage-notice').hidden, false);
});

test('projection anchor follows the actual offset faces of all four watch generations', () => {
  const h = boot({ rects: {
    stage: { left: 120, top: 220, width: 480, height: 550 },
    'watch-screen': { left: 295, top: 560, width: 110, height: 70 },
  } });
  const light = h.elements.get('hologram');
  assertCoordinates(projectionAnchor(h), [230, 375], 'stage scroll/column offset is removed from the rendered face center');
  assertProjectionBase(h, [230, 375], 'original light is centered on the rendered face');
  h.frame(901);
  assert.equal(h.frames.size, 0, 'initial geometry tracking is bounded');
  for (const [watch, rectangle, expected] of [
    ['recalibrated', { left: 310, top: 568, width: 84, height: 58 }, [232, 377]],
    ['ultimatrix', { left: 301, top: 513, width: 98, height: 70 }, [230, 328]],
    ['omniverse', { left: 288, top: 535, width: 130, height: 62 }, [233, 346]],
    ['original', { left: 295, top: 560, width: 110, height: 70 }, [230, 375]],
  ]) {
    h.setRect('watch-screen', rectangle); h.action('watch', watch);
    assertCoordinates(projectionAnchor(h), expected, `${watch} uses its own face instead of the classic-watch center`);
    assertProjectionBase(h, expected, `${watch} light follows the moving watch face`);
    assert.equal(h.frames.size, 1, `${watch} follows the layout transition`);
    h.frame(901);
    assert.equal(h.frames.size, 0, `${watch} does not retain a permanent layout loop`);
  }
  const settled = { ...light.style };
  h.click('next');
  assert.equal(h.frames.size, 0, 'changing only the alien does not start another layout follower');
  assert.equal(light.style.top, settled.top);
  assert.equal(light.style.height, settled.height);
});

test('projection light uses the existing face without adding synthetic emitter travel', () => {
  for (const width of [60, 130, 240]) {
    const h = boot({ reducedMotion: true, rects: {
      stage: { left: 0, top: 0, width: 480, height: 550 },
      'watch-screen': { left: 100, top: 400, width, height: 80 },
    } });
    assertCoordinates(projectionAnchor(h), [100 + width / 2, 440], `face width ${width} retains its center`);
    assertProjectionBase(h, [100 + width / 2, 440], `face width ${width} retains its already-drawn height`);
    assert.equal(h.frames.size, 0, 'reduced motion places the emitter without a layout animation');
  }
});

test('projection anchor realigns on resize and follows changing perspective bounds for only 900 ms', () => {
  const h = boot({ rects: {
    stage: { left: 120, top: 220, width: 480, height: 550 },
    'watch-screen': { left: 295, top: 560, width: 110, height: 70 },
  } });
  h.frame(901);
  h.setRect('stage', { left: 17, top: 185, width: 356, height: 470 });
  h.setRect('watch-screen', { left: 151, top: 459, width: 88, height: 54 });
  h.resize();
  const light = h.elements.get('hologram');
  assert.equal(light.style.left, '178px');
  assertCoordinates(projectionAnchor(h), [178, 301], 'resize follows the raised emitter and face center');
  assertProjectionBase(h, [178, 301], 'resized light stays centered');
  assert.equal(h.frames.size, 1);
  h.setRect('watch-screen', { left: 164, top: 445, width: 70, height: 44 });
  h.frame(450);
  assert.equal(light.style.left, '182px', 'animation-frame sampling follows the moved display');
  assertCoordinates(projectionAnchor(h), [182, 282], 'moving face keeps the same emitter-to-hologram relationship');
  assert.equal(h.frames.size, 1);
  h.frame(451);
  assert.equal(h.frames.size, 0);
  const top = light.style.top;
  h.frame(1000);
  assert.equal(light.style.top, top, 'no permanent frame task remains after the transition');
});

test('projection anchor keeps the original layout deadline after selecting or confirming mid-transition', () => {
  for (const action of ['next', 'confirm']) {
    const h = boot({ rects: {
      stage: { left: 120, top: 220, width: 480, height: 550 },
      'watch-screen': { left: 295, top: 560, width: 110, height: 70 },
    } });
    const light = h.elements.get('hologram');
    h.setRect('watch-screen', { left: 301, top: 513, width: 98, height: 70 });
    h.action('watch', 'ultimatrix');
    assertCoordinates(projectionAnchor(h), [230, 328], `${action}: UA face anchors the rising emitter`);
    assert.equal(h.frames.size, 1);
    h.setRect('watch-screen', { left: 309, top: 527, width: 98, height: 70 });
    h.frame(450);
    assertCoordinates(projectionAnchor(h), [238, 342], `${action}: the moving UA face is followed before interaction`);
    h.click(action);
    if (action === 'next') assert.equal(h.preferences.selectedId, h.fixture[1].id);
    else assert.equal(h.elements.get('confirmation').hidden, false);
    assert.equal(h.frames.size, 1, `${action}: stopMotion resumes the remaining layout follow-up`);
    h.setRect('watch-screen', { left: 296, top: 490, width: 104, height: 64 });
    h.frame(16);
    assertCoordinates(projectionAnchor(h), [228, 302], `${action}: the next frame follows the continuing face movement`);
    assert.equal(h.frames.size, 1);
    h.frame(434);
    assert.equal(h.frames.size, 0, `${action}: tracking ends at the original 900 ms, not 900 ms after interaction`);
    h.click('next');
    assert.equal(h.frames.size, 0, `${action}: later alien selections do not restart an expired layout window`);
  }
});

test('projection anchor reduced motion aligns immediately and page exit cancels its layout follower', () => {
  const rects = {
    stage: { left: 17, top: 185, width: 356, height: 470 },
    'watch-screen': { left: 151, top: 459, width: 88, height: 54 },
  };
  for (const options of [{ reducedMotion: true }, { systemReduced: true }]) {
    const h = boot({ rects, ...options });
    assert.equal(h.elements.get('hologram').style.left, '178px');
    assert.equal(h.frames.size, 0);
    h.setRect('watch-screen', { left: 160, top: 420, width: 70, height: 44 });
    h.resize();
    assert.equal(h.elements.get('hologram').style.left, '178px');
    assertCoordinates(projectionAnchor(h), [178, 257], 'reduced-motion resize keeps the emitter centered on the face');
    assertProjectionBase(h, [178, 257], 'reduced-motion light aligns without a follower');
    assert.equal(h.frames.size, 0, 'resize does not animate when reduced motion is already enabled');
  }
  for (const interrupt of ['manual', 'system', 'mode', 'pagehide']) {
    const h = boot({ rects });
    h.resize();
    assert.equal(h.frames.size, 1, interrupt);
    const staleFrame = [...h.frames.values()][0];
    if (interrupt === 'manual') h.click('motion-toggle');
    if (interrupt === 'system') { h.systemMotion.matches = true; h.systemMotion.emit('change'); }
    if (interrupt === 'mode') h.action('mode', 'dial');
    if (interrupt === 'pagehide') h.window.emit('pagehide');
    assert.equal(h.frames.size, 0, `${interrupt} cancels the pending geometry frame`);
    if (interrupt === 'pagehide') {
      assert.ok(h.observers.every(observer => observer.disconnected));
      const before = { ...h.elements.get('hologram').style };
      h.setRect('watch-screen', { left: 1000, top: 1000, width: 90, height: 60 });
      staleFrame(2500); h.resize();
      assert.equal(h.elements.get('hologram').style.left, before.left);
      assert.equal(h.elements.get('hologram').style.top, before.top);
      assert.equal(h.frames.size, 0, 'a stale callback cannot restart work after pagehide');
    }
  }
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

test('dial keeps the old figure until covered and rapid selection cannot reveal a stale transition', () => {
  const h = boot({ mode: 'dial' }), previous = h.elements.get('dial-previous'), current = h.elements.get('dial-shape');
  const motion = dialSelectionFrames(1);
  h.click('next');
  assert.equal(previous.querySelector('use').attributes.href, `#${h.fixture[0].asset}`);
  assert.equal(previous.hidden, false);
  assert.equal(current.style.visibility, 'hidden');
  const firstAnimations = h.animations.filter(handle => ['dial-shutter-a', 'dial-shutter-b', 'screen-rotor'].includes(handle.node.id));
  assert.equal(firstAnimations.length, 3);
  for (const [id, keyframes] of [['dial-shutter-a', motion.a], ['dial-shutter-b', motion.b], ['screen-rotor', motion.rotor]]) {
    const animation = firstAnimations.find(handle => handle.node.id === id);
    assert.equal(animation.options.duration, motion.duration);
    assert.deepEqual(JSON.parse(JSON.stringify(animation.keyframes)), keyframes, `${id} uses the shared direction-aware choreography`);
  }
  const swapOffset = motion.swapAt / motion.duration;
  for (const frames of [motion.a, motion.b]) {
    const plateau = frames.findIndex((frame, index) => index + 1 < frames.length && frame.clipPath === frames[index + 1].clipPath && frame.offset <= swapOffset && frames[index + 1].offset >= swapOffset);
    assert.ok(plateau >= 0, 'the shape exchange occurs while a leaf holds its closed geometry');
    assert.notEqual(frames[plateau].clipPath, frames[0].clipPath, 'closed geometry differs from the open aperture');
    assert.ok(frames.every(frame => !('opacity' in frame)), 'heroes exchange behind moving leaves instead of a dissolve');
  }
  const staleCallbacks = [...h.timers.values()].map(timer => timer.fn);
  h.advance(100); h.click('next');
  assert.ok(firstAnimations.every(handle => handle.cancelled), 'both old leaves and the old rotor are cancelled');
  for (const fn of staleCallbacks) fn();
  assert.equal(previous.hidden, false, 'an old completion cannot uncover the new transition early');
  assert.equal(previous.querySelector('use').attributes.href, `#${h.fixture[0].asset}`);
  h.advance(motion.swapAt - 1); assert.equal(current.style.visibility, 'hidden');
  assert.equal(previous.hidden, false, 'the latest requested hero is not revealed before the closed exchange point');
  h.advance(1);
  assert.equal(previous.hidden, true); assert.equal(current.style.visibility, '');
  assert.equal(current.querySelector('use').attributes.href, `#${h.fixture[2].asset}`);
  h.advance(500); assert.equal(h.timers.size, 0);
  assert.equal(h.elements.get('omni-app').classList.contains('dial-transition'), false);
});

test('mode, filter, reduced-motion and page-exit interrupts leave the latest selection settled', () => {
  for (const interrupt of ['mode', 'filter', 'manual', 'system', 'pagehide']) {
    const h = boot({ mode: 'dial' }); h.click('next');
    const staleCallbacks = [...h.timers.values()].map(timer => timer.fn);
    if (interrupt === 'mode') h.action('mode', 'projection');
    if (interrupt === 'filter') h.elements.get('search').emit('input', { target: { value: 'no matching form 987654321' } });
    if (interrupt === 'manual') h.click('motion-toggle');
    if (interrupt === 'system') { h.systemMotion.matches = true; h.systemMotion.emit('change'); }
    if (interrupt === 'pagehide') h.window.emit('pagehide');
    for (const fn of staleCallbacks) fn();
    h.advance(1000);
    assert.equal(h.elements.get('dial-previous').hidden, true, interrupt);
    assert.equal(h.elements.get('dial-shape').style.visibility, '', interrupt);
    assert.equal(h.timers.size, 0, interrupt); assert.equal(h.frames.size, 0, interrupt);
    if (interrupt === 'filter') {
      assert.equal(h.elements.get('confirm').disabled, false);
      assert.equal(h.elements.get('dial-shape').querySelector('use').attributes.href, `#${h.fixture[1].asset}`);
      assert.equal(h.elements.get('empty-state').hidden, false);
    } else assert.equal(h.elements.get('dial-shape').querySelector('use').attributes.href, `#${h.fixture[1].asset}`, interrupt);
  }
});

test('ring reuses slots while the incoming form moves larger and above the rear forms', () => {
  const h = boot({ mode: 'carousel' }), carousel = h.elements.get('carousel');
  const slots = [...carousel.children], incoming = carousel.querySelector(`[data-value="${h.fixture[1].id}"]`);
  const before = { transform: incoming.style.transform, zIndex: Number(incoming.style.zIndex), opacity: Number(incoming.style.opacity) };
  h.click('next'); h.frame(160);
  assert.ok(carousel.children.every((slot, index) => slot === slots[index]));
  assert.equal(carousel.querySelector(`[data-value="${h.fixture[1].id}"]`), incoming);
  assert.notEqual(incoming.style.transform, before.transform);
  assert.ok(Number(incoming.style.zIndex) > before.zIndex);
  assert.ok(Number(incoming.style.opacity) > before.opacity);
  h.frame(600); h.advance(50);
  assert.equal(incoming.attributes['aria-pressed'], 'true');
  assert.ok(incoming.classList.contains('is-front'));
  const rear = carousel.children.find(slot => slot.classList.contains('is-back'));
  assert.ok(Number(incoming.style.zIndex) > Number(rear.style.zIndex));
  assert.equal(carousel.style.transform, undefined, 'the parent plane is not rotated');
  assert.equal(h.frames.size, 0);
  h.click('next'); h.click('motion-toggle');
  assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0);
});

test('keyboard navigation works from a ring button and a swipe is not overwritten by its follow-up click', () => {
  const h = boot({ mode: 'carousel' }), stage = h.elements.get('stage');
  const selected = h.elements.get('carousel').querySelector(`[data-value="${h.fixture[0].id}"]`);
  selected.focus(); stage.emit('keydown', { target: selected, key: 'ArrowRight' });
  assert.equal(h.preferences.selectedId, h.fixture[1].id);
  stage.emit('pointerdown', { pointerId: 1, clientX: 250, clientY: 80, button: 0, pointerType: 'touch' });
  stage.emit('pointerup', { pointerId: 1, clientX: 150, clientY: 83 });
  assert.equal(h.preferences.selectedId, h.fixture[2].id);
  h.action('select', h.fixture[0].id);
  assert.equal(h.preferences.selectedId, h.fixture[2].id);
  h.advance(400); h.action('select', h.fixture[0].id);
  assert.equal(h.preferences.selectedId, h.fixture[0].id);
});

test('catalog searches never narrow watch navigation in any summon mode', () => {
  for (const mode of ['projection', 'carousel', 'dial']) {
    const h = boot({ mode }), target = h.fixture[4];
    const selected = h.preferences.selectedId;
    const search = h.elements.get('search'); search.value = target.id; search.emit('input');
    assert.equal(h.elements.get('catalog-grid').children.length, 1, mode);
    assert.equal(h.preferences.selectedId, selected, 'search does not choose a hero automatically');
    assert.match(h.elements.get('filter-summary').textContent, /档案搜索 1 \/ 13 · 手表可切换 12 个/);
    h.action('select', target.id);
    assert.equal(h.preferences.selectedId, target.id, mode);
    h.click('next'); h.advance(1000);
    assert.notEqual(h.preferences.selectedId, target.id, 'next leaves the single search result');
    assert.ok(h.fixture.find(form => form.id === h.preferences.selectedId)?.asset);
    assert.equal(search.value, target.id, 'navigation preserves the search text');
    assert.equal(h.elements.get('catalog-grid').children.length, 1);
    const slots = h.elements.get('carousel').children.filter(node => !node.hidden);
    assert.equal(slots.length, 8, mode);
    assert.equal(new Set(slots.map(node => node.dataset.value)).size, 8);
  }
});

test('empty catalog results keep the current hero and next/previous controls usable', () => {
  const h = boot({ mode: 'carousel' });
  const before = h.preferences.selectedId;
  const search = h.elements.get('search'); search.value = 'no matching form 987654321'; search.emit('input');
  assert.equal(h.elements.get('catalog-grid').children.length, 0);
  assert.equal(h.elements.get('empty-state').hidden, false);
  assert.equal(h.preferences.selectedId, before);
  for (const id of ['previous', 'next', 'confirm']) assert.equal(h.elements.get(id).disabled, false, id);
  h.click('next');
  assert.notEqual(h.preferences.selectedId, before);
  h.click('previous');
  assert.equal(h.preferences.selectedId, before);
  assert.equal(h.elements.get('carousel').children.filter(node => !node.hidden).length, 8);
});

test('pending catalog selections remain honest while watch neighbors and eight slots prefer ready bodies', () => {
  for (const arrow of ['previous', 'next']) {
    const h = boot({ mode: 'carousel' }), missing = h.fixture.at(-1);
    assert.ok(!missing.asset);
    assert.equal(h.elements.get('catalog-grid').children.length, 13, 'all records are shown initially');
    h.action('select', missing.id);
    assert.equal(h.preferences.selectedId, missing.id);
    assert.equal(h.elements.get('stage-notice').hidden, false, 'missing artwork is not impersonated');
    const readyOnly = h.elements.get('ready-only'); readyOnly.checked = true; readyOnly.emit('change');
    assert.equal(h.elements.get('catalog-grid').children.length, 12);
    assert.equal(h.preferences.selectedId, missing.id, 'archive readiness filtering does not force the selected hero');
    const carousel = h.elements.get('carousel'), originalSlots = [...carousel.children];
    let slots = carousel.children.filter(node => !node.hidden);
    assert.equal(slots.length, 8);
    assert.equal(slots.filter(node => node.dataset.value === missing.id).length, 1);
    h.click(arrow);
    assert.ok(h.fixture.find(form => form.id === h.preferences.selectedId)?.asset, arrow);
    slots = carousel.children.filter(node => !node.hidden);
    assert.equal(slots.length, 8);
    assert.ok(slots.every(node => !!h.fixture.find(form => form.id === node.dataset.value)?.asset));
    originalSlots.forEach((node, index) => assert.equal(carousel.children[index], node, 'ring nodes remain stable'));
  }
});

test('unsupported shutter animation degrades to an immediate visible selection', () => {
  const h = boot({ mode: 'dial' }); h.elements.get('dial-shutter-a').animate = undefined;
  h.click('next');
  assert.equal(h.elements.get('dial-shape').querySelector('use').attributes.href, `#${h.fixture[1].asset}`);
  assert.equal(h.elements.get('dial-shape').style.visibility, '');
  assert.equal(h.elements.get('omni-app').classList.contains('selection-transition'), false);
  assert.equal(h.timers.size, 0);
});

test('keyboard and mobile layout affordances remain in the offline build', () => {
  assert.match(html, /id=["']stage["'][^>]*tabindex=["']0["']/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*380px\)/);
  assert.match(app, /new ResizeObserver\(/);
  assert.match(app, /resize\.disconnect\(\)/);
});
