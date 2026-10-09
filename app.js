import { WATCHES, MODES, normalizePreferences, filterForms, stepSelection, ringItems, ringPlacement, dialSelectionFrames, watchFrameLayout } from './core.js';

const data = JSON.parse(document.getElementById('catalog-data').textContent);
const forms = data.forms;
const readyForms = forms.filter(form => !!form.asset);
const byId = new Map(forms.map(form => [form.id, form]));
const $ = id => document.getElementById(id);
const app = $('omni-app');
const lifetime = new AbortController();
const listen = (node, event, fn, options = {}) => node.addEventListener(event, fn, { ...options, signal: lifetime.signal });
const storageKey = 'ben10-omnitrix.preview.v1';
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
let stored = {};
try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { /* Local preview also works with storage disabled. */ }
let preferences = normalizePreferences(stored, forms);
let query = '', group = 'all', readyOnly = false;
let catalogVisible = filterForms(forms, { query, group, readyOnly });
let visible = watchSelectionPool();
let host = null;
let toastTimer, lastConfirm = 0, motionHandles = [];
let pointerStart = null;
let displayedId = preferences.selectedId;
let motionRevision = 0, ringFrame = 0, ringRotation = 0, ringTarget = 0, suppressClickUntil = 0;
let projectionFrame = 0, projectionUntil = 0;
const motionTimers = new Set();
const ringNodes = [], ringEntries = [];
const turn = Math.PI * 2;
const modulo = (n, length) => ((n % length) + length) % length;
let watchViews = {};
try { watchViews = JSON.parse($('watch-views')?.textContent || '{}'); } catch { /* Older previews retain the front artwork. */ }
if (!watchViews || typeof watchViews !== 'object' || Array.isArray(watchViews)) watchViews = {};
const viewOptions = ['top', 'left', 'low', 'right'].map((id, index) => ({ id,
  name: typeof watchViews.views?.[index]?.name === 'string' ? watchViews.views[index].name : ['俯视', '左前', '低角度', '右前'][index] }));
let watchViewIndex = 2;
const raisedByMode = { projection: true, carousel: false };
const watchAtlasStates = new Map();

function watchSelectionPool() {
  if (!readyForms.length) return forms;
  const selected = byId.get(preferences.selectedId);
  return selected && !selected.asset
    ? forms.filter(form => !!form.asset || form.id === selected.id)
    : readyForms;
}

function textElement(tag, text, className = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}
function button(text, className, action, value) {
  const node = textElement('button', text, className);
  node.type = 'button'; node.dataset.action = action;
  if (value) node.dataset.value = value;
  return node;
}
function figure(form, className = '') {
  if (!form?.asset || !/^alien-[a-z0-9-]+$/.test(form.asset)) {
    return textElement('span', '素材待补', className ? `${className} pending-figure` : 'pending-figure');
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 240');
  svg.setAttribute('aria-hidden', 'true');
  // Applied by dial-only CSS to both old/new figures; projection and orbit retain their own scale.
  svg.style.setProperty('--dial-scale', String(form.dialFit?.scale || .55));
  if (className) svg.setAttribute('class', className);
  const use = document.createElementNS(svg.namespaceURI, 'use');
  use.setAttribute('href', `#${form.asset}`); svg.append(use);
  return svg;
}
function hourglass() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', 'M10 10h80L64 50l26 40H10l26-40z'); path.setAttribute('fill', 'currentColor');
  svg.append(path); return svg;
}
function post(type, payload = {}) {
  if (window.parent !== window && location.origin !== 'null') {
    window.parent.postMessage({ namespace: 'ben10-omnitrix', type, payload }, location.origin);
  }
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* Session-only fallback. */ }
  if (host) post('prefs', { preferences });
}
function notice(text) {
  clearTimeout(toastTimer); $('toast').textContent = text; $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2700);
}
function reduced() { return preferences.reducedMotion || systemMotion.matches; }
function currentWatchLayout(raised = raisedByMode[preferences.mode] === true) {
  return watchFrameLayout(watchViews.watches?.[preferences.watch], watchViewIndex, raised, watchViews.columns, watchViews.rows);
}
function projectionVisible(form) {
  return preferences.mode === 'projection' && raisedByMode.projection && !!form?.asset;
}
function renderWatchView(withMotion = false) {
  const viewport = $('watch-multiview'), screen = $('watch-screen');
  const layout = currentWatchLayout(), isDial = preferences.mode === 'dial';
  const state = !layout || !viewport ? 'fallback' : watchAtlasStates.get(preferences.watch) || 'loading';
  const ready = !isDial && state === 'ready';
  app.dataset.watchView = viewOptions[watchViewIndex].id;
  app.dataset.coreState = raisedByMode[preferences.mode] ? 'raised' : 'closed';
  app.dataset.watchArt = isDial ? 'dial' : ready ? 'atlas' : state;
  if (viewport) {
    viewport.hidden = !ready;
    viewport.style.aspectRatio = layout?.aspectRatio || '';
  }
  // CSS gives #watch-device and the clipped viewport the exact same cell bounds.
  $('watch-device').style.aspectRatio = ready ? layout.aspectRatio : '';
  $('watch-device').style.setProperty('--watch-view-face-x', ready ? `${layout.anchor.x * 100}%` : '50%');
  $('watch-device').style.setProperty('--watch-ring-body-width', ready ? `${Math.min(96, 92 / (2 * Math.max(layout.anchor.x, 1 - layout.anchor.x)))}cqw` : '96cqw');
  for (const watch of WATCHES) {
    const image = $(`watch-atlas-${watch.id}`);
    if (!image) continue;
    image.hidden = !ready || watch.id !== preferences.watch;
    if (layout) { image.style.left = layout.left; image.style.top = layout.top; }
  }
  for (const [property, key] of [['left', 'x'], ['top', 'y'], ['width', 'w'], ['height', 'h']]) {
    screen.style[property] = ready ? `${layout.anchor[key] * 100}%` : '';
  }
  screen.style.setProperty('--watch-face-angle', ready ? `${layout.anchor.a}deg` : '0deg');
  if ($('projection-emitter')) $('projection-emitter').hidden = true;
  const toolbar = $('watch-view-toolbar'), controls = $('watch-view-controls');
  if (toolbar) toolbar.hidden = isDial;
  if (controls) {
    const focused = document.activeElement?.dataset?.action === 'watch-view' ? document.activeElement.dataset.value : null;
    controls.replaceChildren(...viewOptions.map((view, index) => {
      const control = button(view.name, 'watch-view-option', 'watch-view', view.id);
      control.setAttribute('aria-pressed', String(watchViewIndex === index)); control.disabled = !ready;
      return control;
    }));
    if (focused) [...controls.children].find(control => control.dataset.value === focused)?.focus({ preventScroll: true });
  }
  if ($('toggle-watch-core')) {
    $('toggle-watch-core').textContent = raisedByMode[preferences.mode] ? '收起表芯' : '弹出表芯';
    $('toggle-watch-core').setAttribute('aria-pressed', String(raisedByMode[preferences.mode] === true));
    $('toggle-watch-core').disabled = !ready;
  }
  if ($('watch-view-status')) {
    $('watch-view-status').textContent = isDial || ready ? '' : state === 'loading' ? '多角度表身加载中，暂用正视图' : '多角度表身暂不可用，已回退正视图';
    $('watch-view-status').hidden = isDial || ready;
  }
  if (withMotion && ready) animate(viewport, [{ opacity: .25 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
}
function alignRing() {
  if (preferences.mode !== 'carousel') return .8;
  const stage = $('stage'), bounds = stage.getBoundingClientRect();
  const layout = app.dataset.watchArt === 'atlas' ? currentWatchLayout() : null;
  const device = $('watch-device').getBoundingClientRect();
  const face = $('watch-screen').getBoundingClientRect();
  const x = layout ? device.left + device.width * layout.anchor.x - bounds.left : face.left + face.width / 2 - bounds.left;
  const y = layout ? device.top + device.height * layout.anchor.y - bounds.top : face.top + face.height / 2 - bounds.top;
  if (Number.isFinite(x) && Number.isFinite(y)) {
    stage.style.setProperty('--ring-center-x', `${x}px`); stage.style.setProperty('--ring-center-y', `${y}px`);
  }
  const ratio = layout?.ellipseRatio || .8;
  stage.style.setProperty('--ring-ellipse', String(ratio));
  return ratio;
}
function alignProjection() {
  const screen = $('watch-screen'), hologram = $('hologram');
  if (preferences.mode !== 'projection' || !raisedByMode.projection || !screen || !hologram) return false;
  const stage = $('stage').getBoundingClientRect(), face = screen.getBoundingClientRect();
  if (!Number.isFinite(face.width) || !face.width || !stage.height) return false;
  // The atlas already depicts the raised core; its face is the beam base.
  const x = face.left + face.width / 2 - stage.left;
  const y = face.top + face.height / 2 - stage.top;
  const top = Math.max(8, Math.min(78, y - 100), y - 285), height = Math.max(0, y - top + 5);
  hologram.style.left = `${x}px`; hologram.style.top = `${top}px`;
  const room = Number.isFinite(stage.width) ? Math.max(0, 2 * Math.min(x, stage.width - x) - 16) : 236;
  hologram.style.height = `${height}px`; hologram.style.width = `${Math.min(236, height * .82, room)}px`;
  return true;
}
function trackProjection(transition = false) {
  cancelAnimationFrame(projectionFrame); projectionFrame = 0;
  if (!alignProjection() || reduced()) { projectionUntil = 0; return; }
  if (transition) projectionUntil = performance.now() + 900;
  if (performance.now() >= projectionUntil) return;
  const follow = now => {
    projectionFrame = 0;
    if (lifetime.signal.aborted || !alignProjection()) return;
    if (now < projectionUntil) projectionFrame = requestAnimationFrame(follow);
  };
  projectionFrame = requestAnimationFrame(follow);
}
function setFigures(form) {
  $('holo-shape').replaceChildren(figure(form));
  for (const id of ['holo-depth-back', 'holo-depth-mid', 'holo-depth-front']) {
    if ($(id)) $(id).replaceChildren(figure(form));
  }
  $('dial-shape').replaceChildren(figure(form));
  $('dial-shape').style.visibility = '';
  displayedId = form?.id || '';
  $('hologram').hidden = !projectionVisible(form);
  if ($('holo-light')) $('holo-light').hidden = !projectionVisible(form);
}
function stopMotion(settle = true) {
  motionRevision++;
  motionTimers.forEach(timer => clearTimeout(timer)); motionTimers.clear();
  cancelAnimationFrame(ringFrame); ringFrame = 0;
  cancelAnimationFrame(projectionFrame); projectionFrame = 0;
  motionHandles.forEach(handle => handle.cancel()); motionHandles = [];
  app.classList.remove('selection-transition', 'dial-transition', 'holo-transition', 'ring-transition');
  for (const id of ['dial-previous', 'holo-echo', 'holo-scan']) if ($(id)) $(id).hidden = true;
  // CSS supplies complementary diagonal polygons above both dial figures, with pointer-events:none.
  for (const id of ['dial-shutter-a', 'dial-shutter-b']) {
    if ($(id)) { $(id).style.transform = ''; $(id).style.clipPath = ''; }
  }
  const form = visible.length ? byId.get(settle ? preferences.selectedId : displayedId) : null;
  setFigures(form);
  if (settle) { ringRotation = ringTarget; positionRing(ringRotation); }
}
function after(delay, callback) {
  const revision = motionRevision;
  const timer = setTimeout(() => {
    motionTimers.delete(timer);
    if (revision === motionRevision && !lifetime.signal.aborted) callback();
  }, delay);
  motionTimers.add(timer);
}
function animate(node, frames, options) {
  if (!node || reduced() || typeof node.animate !== 'function') return;
  const handle = node.animate(frames, options); motionHandles.push(handle);
  handle.finished.then(() => { motionHandles = motionHandles.filter(item => item !== handle); }).catch(() => {});
  return handle;
}
function selectionMotion(direction = 1, previousForm = null) {
  if (reduced()) return;
  app.classList.add('selection-transition');
  if (preferences.mode === 'projection') {
    if (!projectionVisible(byId.get(preferences.selectedId))) { app.classList.remove('selection-transition'); return; }
    app.classList.add('holo-transition');
    animate($('holo-volume'), [
      { opacity: 0, transform: 'translateY(45px) scale(.35,.05)' },
      { opacity: .3, offset: .25 },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], { duration: 760, easing: 'cubic-bezier(.2,.7,.2,1)' });
    animate($('holo-shape'), [
      { opacity: .15, transform: `translate(${direction * 10}px,55px) scale(.76,.3)`, clipPath: 'inset(100% 0 0 0)', filter: 'blur(6px)' },
      { opacity: .8, transform: 'translate(0,12px) scale(1.02,.92)', clipPath: 'inset(35% 0 0 0)', filter: 'blur(2px)', offset: .4 },
      { opacity: 1, transform: 'translate(0,-7px) scale(1.03)', clipPath: 'inset(0% 0 0 0)', filter: 'blur(0px)', offset: .78 },
      { opacity: 1, transform: 'translate(0,0) scale(1)', clipPath: 'inset(0% 0 0 0)', filter: 'blur(0px)' },
    ], { duration: 720, easing: 'cubic-bezier(.2,.7,.2,1)' });
    // CSS: echo shares the shape's bounds; scan is a luminous horizontal band, light is the cone beneath it.
    if ($('holo-echo')) {
      $('holo-echo').replaceChildren(figure(previousForm)); $('holo-echo').hidden = false;
      animate($('holo-echo'), [{ opacity: .5, transform: 'translate(0,0) scale(1)' }, { opacity: 0, transform: `translate(${direction * -18}px,-28px) scale(1.12)`, filter: 'blur(5px)' }], { duration: 390, easing: 'ease-out' });
    }
    for (const id of ['holo-scan', 'holo-light']) if ($(id)) $(id).hidden = !byId.get(preferences.selectedId)?.asset;
    animate($('holo-scan'), [{ opacity: 0, transform: 'translateY(125px)' }, { opacity: 1, offset: .16 }, { opacity: .8, offset: .74 }, { opacity: 0, transform: 'translateY(-125px)' }], { duration: 660, easing: 'linear' });
    animate($('holo-light'), [{ opacity: .1, transform: 'scaleX(.65)' }, { opacity: .85, transform: 'scaleX(1.12)', offset: .48 }, { opacity: .55, transform: 'scaleX(1)' }], { duration: 760 });
  } else if (preferences.mode === 'dial') {
    const a = $('dial-shutter-a'), b = $('dial-shutter-b'), previous = $('dial-previous');
    if (!a || !b || !previous || typeof a.animate !== 'function' || typeof b.animate !== 'function') {
      app.classList.remove('selection-transition'); return;
    }
    app.classList.add('dial-transition');
    previous.replaceChildren(figure(previousForm)); previous.hidden = false;
    $('dial-shape').style.visibility = 'hidden'; displayedId = previousForm?.id || '';
    // Two opposing leaves narrow the opening, cross over its centre, then reopen.
    // Swap behind the closed leaves, never dissolve one hero into the next.
    const motion = dialSelectionFrames(direction);
    animate(a, motion.a, { duration: motion.duration, easing: motion.easing });
    animate(b, motion.b, { duration: motion.duration, easing: motion.easing });
    animate($('screen-rotor'), motion.rotor, { duration: motion.duration, easing: motion.easing });
    after(motion.swapAt, () => { previous.hidden = true; $('dial-shape').style.visibility = ''; displayedId = preferences.selectedId; });
  }
  after(780, () => {
    for (const id of ['dial-previous', 'holo-echo', 'holo-scan']) if ($(id)) $(id).hidden = true;
    if ($('holo-light')) $('holo-light').hidden = !projectionVisible(byId.get(preferences.selectedId));
    app.classList.remove('selection-transition', 'dial-transition', 'holo-transition');
  });
}
function renderControls() {
  const focusAction = document.activeElement?.dataset?.action;
  const focusValue = document.activeElement?.dataset?.value;
  $('watch-options').replaceChildren(...WATCHES.map(watch => {
    const node = button('', 'watch-option', 'watch', watch.id);
    node.setAttribute('aria-pressed', String(watch.id === preferences.watch));
    node.title = watch.detail;
    const mini = textElement('span', '', `watch-mini ${watch.id}`); mini.append(hourglass());
    const copy = textElement('span', ''); copy.append(textElement('strong', watch.name), textElement('small', watch.era));
    node.append(mini, copy); return node;
  }));
  $('mode-options').replaceChildren(...MODES.map(mode => {
    const node = button(mode.name, 'mode-option', 'mode', mode.id);
    node.setAttribute('aria-pressed', String(mode.id === preferences.mode));
    node.append(textElement('span', mode.code)); return node;
  }));
  $('motion-toggle').setAttribute('aria-pressed', String(reduced()));
  $('motion-toggle').textContent = systemMotion.matches ? '系统减少动态' : preferences.reducedMotion ? '动态已减少' : '减少动态';
  app.classList.toggle('reduced-motion', reduced());
  if (['watch', 'mode'].includes(focusAction)) {
    const container = $(focusAction === 'watch' ? 'watch-options' : 'mode-options');
    [...container.children].find(node => node.dataset.value === focusValue)?.focus({ preventScroll: true });
  }
}
function positionRing(rotation) {
  const count = ringEntries.length;
  const width = $('stage').clientWidth || 400;
  const ellipseRatio = alignRing();
  $('stage').style.setProperty('--ring-radius', `${Math.abs(ringPlacement(Math.PI / 2, width, ellipseRatio).x)}px`);
  $('stage').style.setProperty('--ring-turn', `${rotation * 180 / Math.PI}deg`);
  ringNodes.forEach((node, index) => {
    if (index >= count) return;
    const pose = ringPlacement(index / count * turn + rotation, width, ellipseRatio);
    node.style.transform = `translate3d(${pose.x}px,${pose.y}px,${pose.z}px) scale(${pose.scale})`;
    node.style.opacity = String(pose.opacity); node.style.zIndex = String(pose.zIndex);
    node.style.setProperty('--ring-depth', String(pose.depth));
    node.style.setProperty('--sector-angle', `${pose.rotate || 0}deg`);
    node.classList.toggle('is-front', pose.depth > .7); node.classList.toggle('is-back', pose.depth < .3);
  });
}
function renderRing(withMotion = false) {
  const items = ringItems(visible, preferences.selectedId, 8);
  // CSS contract: #carousel is a perspective stage; children are centered at its origin.
  // Never rotate its whole plane or apply CSS transform transitions to these eight persistent nodes.
  while (ringNodes.length < 8) {
    const node = button('', 'ring-item', 'select'); node.id = `ring-slot-${ringNodes.length}`;
    ringNodes.push(node); $('carousel').append(node);
  }
  const oldCount = ringEntries.length;
  const anchor = items.findIndex(form => ringEntries.some(item => item.id === form.id));
  const offset = anchor >= 0 && oldCount === items.length ? ringEntries.findIndex(form => form.id === items[anchor].id) - anchor : 0;
  const entries = Array(items.length);
  items.forEach((form, index) => { entries[modulo(index + offset, items.length)] = form; });
  ringEntries.splice(0, ringEntries.length, ...entries);
  ringNodes.forEach((node, index) => {
    const form = ringEntries[index]; node.hidden = !form;
    if (!form) { node.dataset.value = ''; return; }
    if (node.dataset.value !== form.id) {
      node.dataset.value = form.id;
      node.replaceChildren(figure(form), textElement('span', form.name || form.en));
    }
    node.setAttribute('aria-pressed', String(form.id === preferences.selectedId));
    node.setAttribute('aria-label', `选择 ${form.name || form.en}`);
    node.classList.toggle('is-selected', form.id === preferences.selectedId);
  });
  cancelAnimationFrame(ringFrame); ringFrame = 0;
  app.classList.remove('ring-transition');
  if (!items.length) return;
  const base = -ringEntries.findIndex(form => form.id === preferences.selectedId) / items.length * turn;
  const delta = modulo(base - ringRotation + Math.PI, turn) - Math.PI;
  ringTarget = ringRotation + delta;
  if (!withMotion || reduced() || anchor < 0 || oldCount !== items.length) {
    ringRotation = ringTarget; positionRing(ringRotation); return;
  }
  const from = ringRotation, start = performance.now(), revision = motionRevision;
  app.classList.add('ring-transition');
  const frame = now => {
    if (revision !== motionRevision || lifetime.signal.aborted) return;
    const t = Math.min(1, Math.max(0, (now - start) / 640));
    const eased = 1 - (1 - t) ** 3;
    ringRotation = from + (ringTarget - from) * eased;
    positionRing(ringRotation);
    if (t < 1) ringFrame = requestAnimationFrame(frame);
    else { ringFrame = 0; app.classList.remove('ring-transition'); }
  };
  ringFrame = requestAnimationFrame(frame);
}
function renderStage(withMotion = false, previousForm = null, direction = 1) {
  const form = visible.length ? byId.get(preferences.selectedId) : null;
  const mode = MODES.find(item => item.id === preferences.mode);
  const watch = WATCHES.find(item => item.id === preferences.watch);
  const layoutChanged = app.dataset.mode !== preferences.mode || app.dataset.watch !== preferences.watch;
  app.dataset.mode = preferences.mode; app.dataset.watch = preferences.watch;
  renderWatchView();
  $('mode-name').textContent = mode.name; $('mode-code').textContent = `SELECTION / ${mode.code}`;
  $('watch-chip').textContent = watch.name; $('stage-hint').textContent = mode.hint;
  $('selected-en').textContent = form?.en || ''; $('selected-name').textContent = form?.name || form?.en || '没有可选形态';
  $('selected-group').textContent = form ? (data.groups[form.group] || '') : '';
  $('sequence-id').textContent = form ? String(forms.indexOf(form) + 1).padStart(3, '0') : '---';
  setFigures(form);
  $('stage-notice').textContent = !visible.length ? '暂时没有可选形态' : '这个形态的素材还在整理中';
  $('stage-notice').hidden = !!form?.asset;
  $('watch-device').setAttribute('aria-label', `锁定 ${form?.name || form?.en || '形态'}`);
  const disabled = !visible.length;
  for (const id of ['previous', 'next', 'confirm', 'watch-device']) $(id).disabled = disabled;
  renderRing(withMotion && preferences.mode === 'carousel');
  trackProjection(layoutChanged);
  if (withMotion) selectionMotion(direction, previousForm);
}
function renderCatalog() {
  $('result-count').textContent = `${catalogVisible.length} / ${forms.length}`;
  renderFilterSummary();
  $('empty-state').hidden = catalogVisible.length !== 0;
  $('catalog-grid').replaceChildren(...catalogVisible.map(form => {
    const node = button('', 'alien-card', 'select', form.id);
    node.setAttribute('aria-pressed', String(form.id === preferences.selectedId));
    node.setAttribute('aria-label', `选择 ${form.name || form.en}${form.asset ? '' : '，素材待补'}`);
    const holder = textElement('span', '', 'card-figure'); holder.append(figure(form));
    node.append(holder, textElement('strong', form.name || form.en), textElement('small', form.name ? form.en : data.groups[form.group]));
    return node;
  }));
}
function renderFilters() {
  const entries = [['all', '全部'], ...Object.entries(data.groups)];
  $('group-filters').replaceChildren(...entries.map(([id, name]) => {
    const node = button(name, 'group-filter', 'group', id);
    node.setAttribute('aria-pressed', String(id === group)); return node;
  }));
}
function refreshFilter() {
  stopMotion();
  catalogVisible = filterForms(forms, { query, group, readyOnly });
  visible = watchSelectionPool();
  $('confirmation').hidden = true;
  renderFilters(); renderCatalog(); renderStage();
}
function renderFilterSummary() {
  const filters = [];
  if (query.trim()) filters.push(`搜索「${query.trim()}」`);
  if (group !== 'all') filters.push(data.groups[group] || group);
  if (readyOnly) filters.push('仅已有剪影');
  $('filter-summary').textContent = `档案搜索 ${catalogVisible.length} / ${forms.length} · 手表可切换 ${readyForms.length || forms.length} 个 · ${filters.join(' · ') || '全部形态'}`;
}
function resetFilters() {
  query = ''; group = 'all'; readyOnly = false;
  $('search').value = '';
  $('ready-only').checked = false;
  refreshFilter();
}
function select(id, direction = 1) {
  if (!byId.has(id)) return;
  const previousForm = byId.get(displayedId);
  stopMotion(false);
  preferences.selectedId = id;
  visible = watchSelectionPool();
  $('confirmation').hidden = true;
  const focused = document.activeElement?.dataset?.action === 'select' ? document.activeElement.dataset.value : null;
  renderStage(true, previousForm, direction);
  for (const node of $('catalog-grid').querySelectorAll('.alien-card')) node.setAttribute('aria-pressed', String(node.dataset.value === id));
  if (focused && preferences.mode === 'carousel') $('carousel').querySelector(`[data-value="${id}"]`)?.focus({ preventScroll: true });
  save(); post('select', { formId: id, name: byId.get(id).name || byId.get(id).en });
}
function step(delta) {
  const next = stepSelection(visible, preferences.selectedId, delta);
  if (next) select(next.id, delta);
}
function confirm() {
  const form = byId.get(preferences.selectedId);
  if (!form || !visible.length) return;
  const now = Date.now(); if (now - lastConfirm < 650) return; lastConfirm = now;
  stopMotion();
  trackProjection();
  animate(document.querySelector('.summon-flash'), [{ opacity: 0 }, { opacity: .75, offset: .23 }, { opacity: 0 }], { duration: 800 });
  animate(document.querySelector('.summon-ring'), [{ opacity: 1, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(4)' }], { duration: 800, easing: 'ease-out' });
  $('confirmation-label').textContent = `${form.name || form.en} · 形态已锁定${form.asset ? '' : '（剪影素材待补）'}`;
  $('confirmation').hidden = false;
  post('select', { formId: form.id, name: form.name || form.en });
  notice(`已锁定 ${form.name || form.en}`);
}
function suppressesStageClick(event) {
  // Ignore only the pointer click left over from a stage swipe, never keyboard activation or outside controls.
  return Date.now() < suppressClickUntil && event.detail !== 0 && !!event.target.closest('#stage');
}
listen(app, 'click', event => {
  const control = event.target.closest('[data-action]'); if (!control) return;
  if (suppressesStageClick(event)) { event.preventDefault(); return; }
  const { action, value } = control.dataset;
  if (action === 'select') select(value);
  else if (action === 'watch' && WATCHES.some(watch => watch.id === value)) {
    stopMotion();
    const previousForm = byId.get(displayedId);
    preferences.watch = value; renderControls(); renderStage(true, previousForm); save();
  } else if (action === 'mode' && MODES.some(mode => mode.id === value)) {
    stopMotion();
    const previousForm = byId.get(displayedId);
    preferences.mode = value; renderControls(); renderStage(true, previousForm); save();
  } else if (action === 'watch-view' && preferences.mode !== 'dial' && app.dataset.watchArt === 'atlas') {
    const index = viewOptions.findIndex(view => view.id === value);
    if (index < 0 || index === watchViewIndex) return;
    stopMotion(); watchViewIndex = index; renderWatchView(true); positionRing(ringRotation); trackProjection(true);
  } else if (action === 'group') { group = value; refreshFilter(); }
  else if (action === 'reset-filters') resetFilters();
});
if ($('toggle-watch-core')) listen($('toggle-watch-core'), 'click', () => {
  if (preferences.mode === 'dial' || app.dataset.watchArt !== 'atlas') return;
  stopMotion(); raisedByMode[preferences.mode] = !raisedByMode[preferences.mode];
  renderWatchView(true); setFigures(byId.get(preferences.selectedId)); positionRing(ringRotation); trackProjection(true);
});
for (const watch of WATCHES) {
  const image = $(`watch-atlas-${watch.id}`); if (!image) continue;
  const update = state => {
    watchAtlasStates.set(watch.id, state);
    if (preferences.watch === watch.id && preferences.mode !== 'dial') {
      renderWatchView(); positionRing(ringRotation); trackProjection(true);
    }
  };
  watchAtlasStates.set(watch.id, image.complete ? image.naturalWidth > 0 ? 'ready' : 'fallback' : 'loading');
  listen(image, 'load', () => update(image.naturalWidth > 0 ? 'ready' : 'fallback'));
  listen(image, 'error', () => update('fallback'));
}
listen($('previous'), 'click', () => step(-1)); listen($('next'), 'click', () => step(1));
listen($('confirm'), 'click', confirm);
listen($('watch-device'), 'click', event => {
  if (suppressesStageClick(event)) { event.preventDefault(); return; }
  confirm();
});
listen($('search'), 'input', event => { query = event.target.value; refreshFilter(); });
listen($('ready-only'), 'change', event => { readyOnly = event.target.checked; refreshFilter(); });
listen($('motion-toggle'), 'click', () => {
  if (systemMotion.matches) { notice('已遵循系统的“减少动态”设置'); return; }
  preferences.reducedMotion = !preferences.reducedMotion; stopMotion(); renderControls(); trackProjection(); save();
});
listen(systemMotion, 'change', () => { stopMotion(); renderControls(); trackProjection(); });
listen($('stage'), 'keydown', event => {
  if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); }
  else if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) { event.preventDefault(); confirm(); }
});
listen($('stage'), 'pointerdown', event => {
  if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
  pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
});
listen($('stage'), 'pointerup', event => {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y; pointerStart = null;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    step(dx > 0 ? -1 : 1); suppressClickUntil = Date.now() + 350;
  }
});
listen($('stage'), 'pointercancel', () => { pointerStart = null; });
listen($('sources-button'), 'click', () => $('about-dialog').showModal());
listen($('close-about'), 'click', () => $('about-dialog').close());
listen($('about-dialog'), 'click', event => { if (event.target === $('about-dialog')) { const b = event.target.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) event.target.close(); } });
listen($('draft-button'), 'click', async event => {
  if (!event.isTrusted) return;
  const form = byId.get(preferences.selectedId); if (!form) return;
  const name = form.name || form.en;
  if (host?.capabilities?.draftInput) { post('select', { formId: form.id, name }); post('draft', { formId: form.id, name }); }
  else {
    try { await navigator.clipboard.writeText(name); notice(`已复制 ${name}`); }
    catch { notice(`请复制此名称：${name}`); }
  }
});
listen(window, 'message', event => {
  if (event.source !== window.parent || event.origin !== location.origin || window.parent === window) return;
  const message = event.data;
  if (!message || message.namespace !== 'ben10-omnitrix' || typeof message.payload !== 'object' || message.payload === null) return;
  if (message.type === 'init') {
    stopMotion();
    host = message.payload;
    preferences = normalizePreferences(host.preferences, forms);
    $('ready-only').checked = readyOnly;
    $('draft-button').textContent = host.capabilities?.draftInput ? '写入酒馆输入框' : '复制形态名称';
    renderControls(); refreshFilter();
  } else if (message.type === 'prefs' && host && message.payload.capabilities) {
    host.capabilities = message.payload.capabilities;
    $('draft-button').textContent = host.capabilities.draftInput ? '写入酒馆输入框' : '复制形态名称';
  } else if (message.type === 'draft-result') notice(message.payload.ok ? '已写入酒馆输入框，等待你手动发送' : message.payload.reason || '暂时无法写入输入框');
});
const resize = new ResizeObserver(() => { if (preferences.mode === 'carousel') renderRing(); trackProjection(true); });
resize.observe($('stage'));
listen(window, 'pagehide', () => { stopMotion(); clearTimeout(toastTimer); resize.disconnect(); lifetime.abort(); });
$('material-summary').textContent = `${data.coverage.reviewed} 个剪影已接入 / ${data.coverage.total} 条形态记录`;
$('coverage-note').textContent = `当前有 ${data.coverage.total} 条形态记录，其中 ${data.coverage.reviewed} 条已接入核对过的剪影，${data.coverage.missing} 条素材待补。目录同时保留不同作品版本、身体状态、融合及扩展形态，不等于独立物种数量。`;
$('ready-only').checked = readyOnly;
renderControls(); refreshFilter(); post('ready');
