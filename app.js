import { WATCHES, MODES, normalizePreferences, filterForms, stepSelection, ringItems } from './core.js';

const data = JSON.parse(document.getElementById('catalog-data').textContent);
const forms = data.forms;
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
let query = '', group = 'all', readyOnly = !!byId.get(preferences.selectedId)?.asset;
let visible = filterForms(forms, { query, group, readyOnly });
let host = null;
let toastTimer, lastConfirm = 0, motionHandles = [];
let pointerStart = null;
let archiveSignature = '';

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
function stopMotion() { motionHandles.forEach(handle => handle.cancel()); motionHandles = []; }
function animate(node, frames, options) {
  if (reduced() || typeof node.animate !== 'function') return;
  const handle = node.animate(frames, options); motionHandles.push(handle);
  handle.finished.then(() => { motionHandles = motionHandles.filter(item => item !== handle); }).catch(() => {});
}
function selectionMotion(direction = 1) {
  stopMotion();
  if (preferences.mode === 'projection') {
    animate($('holo-shape'), [
      { opacity: 0, transform: `translate(${direction * 12}px,32px) scale(.65)`, filter: 'blur(8px)' },
      { opacity: 1, transform: 'translate(0,-5px) scale(1.04)', filter: 'blur(0px)', offset: .75 },
      { opacity: 1, transform: 'translate(0,0) scale(1)', filter: 'blur(0px)' },
    ], { duration: 570, easing: 'cubic-bezier(.2,.8,.2,1)' });
  } else if (preferences.mode === 'carousel') {
    animate($('carousel'), [{ transform: `rotate(${direction * 38}deg) scale(.92)`, opacity: .5 }, { transform: 'rotate(0) scale(1)', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' });
  } else if (preferences.mode === 'dial') {
    animate($('dial-shape'), [{ opacity: 0, transform: `rotateY(${direction * 90}deg)` }, { opacity: 1, transform: 'rotateY(0)' }], { duration: 390, easing: 'ease-out' });
  }
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
function renderRing() {
  const items = ringItems(visible, preferences.selectedId, 8);
  const width = $('stage').clientWidth || 400;
  const mobile = width < 600;
  const radiusX = Math.min(mobile ? 133 : 198, width * .34);
  const radiusY = mobile ? 119 : 144;
  $('carousel').replaceChildren(...items.map((form, n) => {
    const angle = (n / items.length * Math.PI * 2) - Math.PI / 2;
    const node = button('', 'ring-item', 'select', form.id);
    node.style.transform = `translate(${Math.cos(angle) * radiusX}px,${Math.sin(angle) * radiusY}px)`;
    node.setAttribute('aria-pressed', String(form.id === preferences.selectedId));
    node.setAttribute('aria-label', `选择 ${form.name || form.en}`);
    node.append(figure(form), textElement('span', form.name || form.en)); return node;
  }));
}
function renderArchive() {
  const signature = visible.map(form => form.id).join('|');
  if (archiveSignature === signature && $('archive-grid').children.length) {
    for (const card of $('archive-grid').children) card.setAttribute('aria-pressed', String(card.dataset.value === preferences.selectedId));
    return;
  }
  archiveSignature = signature;
  $('archive-grid').replaceChildren(...visible.map((form, n) => {
    const node = button('', 'archive-card', 'select', form.id);
    node.style.setProperty('--phase', `${-(n % 7)}s`);
    node.setAttribute('aria-pressed', String(form.id === preferences.selectedId));
    node.setAttribute('aria-label', `翻转并选择 ${form.name || form.en}`);
    const front = textElement('span', '', 'archive-front');
    front.append(figure(form), textElement('span', form.name || form.en));
    const back = textElement('span', '', 'archive-back');
    back.append(textElement('strong', form.name || form.en), textElement('small', form.en || ''), textElement('small', '已选择 · 等待锁定'));
    node.append(front, back); return node;
  }));
}
function renderStage() {
  const form = visible.length ? byId.get(preferences.selectedId) : null;
  const mode = MODES.find(item => item.id === preferences.mode);
  const watch = WATCHES.find(item => item.id === preferences.watch);
  app.dataset.mode = preferences.mode; app.dataset.watch = preferences.watch;
  $('mode-name').textContent = mode.name; $('mode-code').textContent = `SELECTION / ${mode.code}`;
  $('watch-chip').textContent = watch.name; $('stage-hint').textContent = mode.hint;
  $('selected-en').textContent = form?.en || ''; $('selected-name').textContent = form?.name || form?.en || '没有可选形态';
  $('selected-group').textContent = form ? (data.groups[form.group] || '') : '';
  $('sequence-id').textContent = form ? String(forms.indexOf(form) + 1).padStart(3, '0') : '---';
  $('holo-shape').replaceChildren(figure(form)); $('dial-shape').replaceChildren(figure(form));
  $('stage-notice').textContent = !visible.length ? '当前筛选没有形态，请调整搜索或分类' : '这个形态的素材还在整理中';
  $('stage-notice').hidden = !!form?.asset;
  $('watch-device').setAttribute('aria-label', `锁定 ${form?.name || form?.en || '形态'}`);
  const disabled = !visible.length;
  for (const id of ['previous', 'next', 'confirm', 'watch-device']) $(id).disabled = disabled;
  renderRing();
  if (preferences.mode === 'archive') renderArchive(); else { $('archive-grid').replaceChildren(); archiveSignature = ''; }
}
function renderCatalog() {
  $('result-count').textContent = `${visible.length} / ${forms.length}`;
  $('empty-state').hidden = visible.length !== 0;
  $('catalog-grid').replaceChildren(...visible.map(form => {
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
  visible = filterForms(forms, { query, group, readyOnly });
  if (visible.length && !visible.some(form => form.id === preferences.selectedId)) {
    preferences.selectedId = visible[0].id; save();
  }
  $('confirmation').hidden = true;
  renderFilters(); renderCatalog(); renderStage();
}
function select(id, direction = 1) {
  if (!byId.has(id)) return;
  preferences.selectedId = id;
  $('confirmation').hidden = true;
  const focused = document.activeElement?.dataset?.action === 'select' ? document.activeElement.dataset.value : null;
  renderStage();
  for (const node of $('catalog-grid').querySelectorAll('.alien-card')) node.setAttribute('aria-pressed', String(node.dataset.value === id));
  if (focused && ['archive', 'carousel'].includes(preferences.mode)) $(preferences.mode === 'archive' ? 'archive-grid' : 'carousel').querySelector(`[data-value="${id}"]`)?.focus({ preventScroll: true });
  save(); post('select', { formId: id, name: byId.get(id).name || byId.get(id).en }); selectionMotion(direction);
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
  animate(document.querySelector('.summon-flash'), [{ opacity: 0 }, { opacity: .75, offset: .23 }, { opacity: 0 }], { duration: 800 });
  animate(document.querySelector('.summon-ring'), [{ opacity: 1, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(4)' }], { duration: 800, easing: 'ease-out' });
  $('confirmation-label').textContent = `${form.name || form.en} · 形态已锁定${form.asset ? '' : '（剪影素材待补）'}`;
  $('confirmation').hidden = false;
  post('select', { formId: form.id, name: form.name || form.en });
  notice(`已锁定 ${form.name || form.en}`);
}
listen(app, 'click', event => {
  const control = event.target.closest('[data-action]'); if (!control) return;
  const { action, value } = control.dataset;
  if (action === 'select') select(value);
  else if (action === 'watch' && WATCHES.some(watch => watch.id === value)) {
    preferences.watch = value; renderControls(); renderStage(); selectionMotion(); save();
  } else if (action === 'mode' && MODES.some(mode => mode.id === value)) {
    preferences.mode = value; renderControls(); renderStage(); selectionMotion(); save();
  } else if (action === 'group') { group = value; refreshFilter(); }
});
listen($('previous'), 'click', () => step(-1)); listen($('next'), 'click', () => step(1));
listen($('confirm'), 'click', confirm); listen($('watch-device'), 'click', confirm);
listen($('search'), 'input', event => { query = event.target.value; refreshFilter(); });
listen($('ready-only'), 'change', event => { readyOnly = event.target.checked; refreshFilter(); });
listen($('motion-toggle'), 'click', () => {
  if (systemMotion.matches) { notice('已遵循系统的“减少动态”设置'); return; }
  preferences.reducedMotion = !preferences.reducedMotion; stopMotion(); renderControls(); save();
});
listen(systemMotion, 'change', () => { stopMotion(); renderControls(); });
listen($('stage'), 'keydown', event => {
  if (event.target.closest('button')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); }
  else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); confirm(); }
});
listen($('stage'), 'pointerdown', event => {
  if (preferences.mode !== 'archive') pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
});
listen($('stage'), 'pointerup', event => {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y; pointerStart = null;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) { step(dx > 0 ? -1 : 1); lastConfirm = Date.now(); }
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
    host = message.payload;
    preferences = normalizePreferences(host.preferences, forms);
    readyOnly = !!byId.get(preferences.selectedId)?.asset;
    $('ready-only').checked = readyOnly;
    $('draft-button').textContent = host.capabilities?.draftInput ? '写入酒馆输入框' : '复制形态名称';
    renderControls(); refreshFilter();
  } else if (message.type === 'prefs' && host && message.payload.capabilities) {
    host.capabilities = message.payload.capabilities;
    $('draft-button').textContent = host.capabilities.draftInput ? '写入酒馆输入框' : '复制形态名称';
  } else if (message.type === 'draft-result') notice(message.payload.ok ? '已写入酒馆输入框，等待你手动发送' : message.payload.reason || '暂时无法写入输入框');
});
const resize = new ResizeObserver(() => { if (preferences.mode === 'carousel') renderRing(); });
resize.observe($('stage'));
listen(window, 'pagehide', () => { stopMotion(); clearTimeout(toastTimer); resize.disconnect(); lifetime.abort(); });
$('material-summary').textContent = `${data.coverage.reviewed} 个剪影已接入 / ${data.coverage.total} 条形态记录`;
$('coverage-note').textContent = `当前有 ${data.coverage.total} 条形态记录，其中 ${data.coverage.reviewed} 条已接入核对过的剪影，${data.coverage.missing} 条素材待补。目录同时保留不同作品版本、身体状态、融合及扩展形态，不等于独立物种数量。`;
$('ready-only').checked = readyOnly;
renderControls(); refreshFilter(); post('ready');
