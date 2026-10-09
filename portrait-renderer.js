export const PORTRAIT_PALETTES = Object.freeze({
  energy: Object.freeze({ name: '能量绿', main: '#588e1c', light: '#c4fc72', accent: '#b3ef64', hue: 0 }),
  amber: Object.freeze({ name: '琥珀橙', main: '#96551b', light: '#ffcc7c', accent: '#ffbb67', hue: -65 }),
  rose: Object.freeze({ name: '玫瑰粉', main: '#943c6c', light: '#ffa9d7', accent: '#ffa9d7', hue: -120 }),
});

export function portraitColorMatrix(asset, palette = PORTRAIT_PALETTES.energy) {
  const parse = color => {
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new TypeError('Invalid portrait palette');
    return [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255);
  };
  const dark = asset?.dark, light = asset?.light;
  if (!Number.isFinite(dark) || !Number.isFinite(light) || dark < 0 || light > 1 || light - dark < .05) throw new RangeError('Invalid portrait tone anchors');
  const main = parse(palette.main), highlight = parse(palette.light), values = [];
  for (let channel = 0; channel < 3; channel++) {
    const slope = (highlight[channel] - main[channel]) / (light - dark);
    values.push(slope * .2126, slope * .7152, slope * .0722, 0, main[channel] - slope * dark);
  }
  // Only RGB changes. Transparent holes and antialiased alpha remain byte-for-byte source alpha.
  values.push(0, 0, 0, 1, 0);
  return values;
}

export function validatePortraitRegistry(registry, formIds) {
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.assets) || !Array.isArray(registry.bindings)) throw new TypeError('Invalid portrait registry');
  const assets = new Map(), bindings = new Map(), knownForms = new Set(formIds);
  for (const asset of registry.assets) {
    if (!asset || !/^dna-omv-[0-9]{3}$/.test(asset.id) || assets.has(asset.id) || asset.width !== 150 || asset.height !== 150) throw new TypeError('Invalid portrait resource');
    portraitColorMatrix(asset);
    assets.set(asset.id, asset);
  }
  for (const binding of registry.bindings) {
    if (!binding || !knownForms.has(binding.formId) || bindings.has(binding.formId) || !assets.has(binding.portraitId)) throw new TypeError('Invalid portrait identity binding');
    bindings.set(binding.formId, assets.get(binding.portraitId));
  }
  return { assets, bindings };
}

export function createPortraitRenderer(registry, formIds, doc = document) {
  const { assets, bindings } = validatePortraitRegistry(registry, formIds);
  const NS = 'http://www.w3.org/2000/svg';
  const element = (tag, attributes = {}) => {
    const node = doc.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
    return node;
  };
  const library = element('svg', { width: 0, height: 0, 'aria-hidden': 'true' });
  library.style.position = 'absolute'; library.style.overflow = 'hidden';
  const definitions = element('defs'), matrices = new Map();
  library.append(definitions); doc.body.append(library);
  for (const asset of assets.values()) {
    const filter = element('filter', { id: `portrait-tint-${asset.id}`, x: '0%', y: '0%', width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' });
    const matrix = element('feColorMatrix', { type: 'matrix' });
    filter.append(matrix); definitions.append(filter); matrices.set(asset.id, matrix);
  }
  function setPalette(id) {
    const palette = Object.hasOwn(PORTRAIT_PALETTES, id) ? PORTRAIT_PALETTES[id] : PORTRAIT_PALETTES.energy;
    for (const [assetId, matrix] of matrices) matrix.setAttribute('values', portraitColorMatrix(assets.get(assetId), palette).map(v => Number(v.toFixed(9))).join(' '));
    return palette;
  }
  function figure(formId, label = '') {
    const asset = bindings.get(formId);
    if (!asset) {
      const pending = doc.createElement('span');
      pending.className = 'portrait-pending'; pending.textContent = label ? `${label}\n头像待补` : '头像待补';
      return pending;
    }
    const svg = element('svg', { class: 'portrait-icon', viewBox: `0 0 ${asset.width} ${asset.height}`, 'aria-hidden': 'true', focusable: 'false', 'data-portrait-id': asset.id });
    const use = element('use', { href: `#portrait-sprite-${asset.id}`, filter: ['url', '(', '#portrait-tint-', asset.id, ')'].join('') });
    svg.append(use); return svg;
  }
  setPalette('energy');
  return { figure, setPalette, has: id => bindings.has(id), count: bindings.size, dispose: () => library.remove() };
}
