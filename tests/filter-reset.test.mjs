import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { filterForms, normalizePreferences } from '../core.js';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const shell = await readFile(new URL('../preview.shell.html', import.meta.url), 'utf8');
const data = JSON.parse(await readFile(new URL('../assets/catalog.json', import.meta.url), 'utf8'));

function appFunction(name) {
  const match = app.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `app.js must define ${name}`);
  return match[0];
}

function filterSession({ query = '', group = 'all', readyOnly = true, selectedId = data.forms[0].id } = {}) {
  const nodes = {
    search: { value: query },
    'ready-only': { checked: readyOnly },
    confirmation: { hidden: false },
    'filter-summary': { textContent: '' },
  };
  const calls = { stopped: 0, filters: 0, catalog: 0, stage: 0, saved: [] };
  const preferences = normalizePreferences({ selectedId, watch: 'ultimatrix', mode: 'dial', reducedMotion: true }, data.forms);
  const context = vm.createContext({
    data, forms: data.forms, query, group, readyOnly, preferences,
    visible: filterForms(data.forms, { query, group, readyOnly }),
    $: id => nodes[id], filterForms,
    stopMotion: () => calls.stopped++,
    save: () => calls.saved.push(structuredClone(preferences)),
    renderFilters: () => calls.filters++,
    renderCatalog: () => { calls.catalog++; context.renderFilterSummary(); },
    renderStage: () => calls.stage++,
  });
  vm.runInContext(['refreshFilter', 'renderFilterSummary', 'resetFilters'].map(appFunction).join('\n'), context);
  return { context, nodes, calls };
}

test('clearing the observed Diamond Matter search restores the entire catalog and preserves the chosen hero', () => {
  const match = data.forms.find(form => form.id === 'diamond-matter');
  assert.ok(match?.asset);
  const { context, nodes, calls } = filterSession({ query: 'Diamond Matter', selectedId: match.id });
  assert.equal(context.visible.length, 1, 'reproduce the reported one-hero filter');
  const before = structuredClone(context.preferences);
  context.resetFilters();
  assert.equal(context.visible.length, data.forms.length);
  assert.equal(context.query, '');
  assert.equal(context.group, 'all');
  assert.equal(context.readyOnly, false);
  assert.equal(nodes.search.value, '');
  assert.equal(nodes['ready-only'].checked, false);
  assert.equal(nodes.confirmation.hidden, true);
  assert.deepEqual(context.preferences, before);
  assert.equal(calls.saved.length, 0, 'reset does not persist temporary filters');
  assert.deepEqual([calls.stopped, calls.filters, calls.catalog, calls.stage], [1, 1, 1, 1]);
  assert.match(nodes['filter-summary'].textContent, new RegExp(`${data.forms.length} / ${data.forms.length}`));
  assert.match(nodes['filter-summary'].textContent, /全部形态/);
});

test('one reset clears search, group and ready-only together, including an empty result set', () => {
  const { context, nodes } = filterSession({ query: 'no-such-alien-000', group: 'ultimate', readyOnly: true });
  assert.equal(context.visible.length, 0);
  context.resetFilters();
  assert.deepEqual(Array.from(context.visible, form => form.id), data.forms.map(form => form.id));
  assert.ok(context.visible.some(form => !form.asset), 'pending forms remain honest catalog entries');
  assert.equal(nodes['ready-only'].checked, false);
});

test('resetting repeatedly is stable and leaves watch, mode and motion preferences intact', () => {
  const { context } = filterSession({ query: '火焰', group: 'classic', readyOnly: true });
  context.resetFilters();
  const selected = context.preferences.selectedId;
  context.resetFilters();
  assert.equal(context.visible.length, data.forms.length);
  assert.equal(context.preferences.selectedId, selected);
  assert.equal(context.preferences.watch, 'ultimatrix');
  assert.equal(context.preferences.mode, 'dial');
  assert.equal(context.preferences.reducedMotion, true);
});

test('visible filter summary explains the restricted count and does not insert HTML', () => {
  const { context, nodes } = filterSession({ query: '<img onerror=alert(1)>', group: 'ultimate', readyOnly: true });
  context.renderFilterSummary();
  assert.match(nodes['filter-summary'].textContent, /显示 0 \/ \d+ 个英雄/);
  assert.ok(nodes['filter-summary'].textContent.includes('<img onerror=alert(1)>'));
  assert.ok(nodes['filter-summary'].textContent.includes(data.groups.ultimate));
  assert.match(nodes['filter-summary'].textContent, /仅已有剪影/);
  assert.equal(nodes['filter-summary'].innerHTML, undefined);
});

test('recovery control remains visible beside the selection controls, outside stage and catalog', () => {
  const recovery = shell.match(/<div class="filter-recovery[^>]*>[\s\S]*?<\/div>/)?.[0];
  assert.ok(recovery);
  assert.match(recovery, /id="filter-summary"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(recovery, /id="reset-filters"[^>]*type="button"[^>]*data-action="reset-filters"/);
  assert.match(recovery, /显示全部英雄/);
  assert.doesNotMatch(recovery, /\bhidden\b/);
  assert.ok(shell.indexOf(recovery) > shell.indexOf('class="selection-bar"'));
  assert.ok(shell.indexOf(recovery) < shell.indexOf('class="library"'));
  assert.match(app, /action === 'reset-filters'\) resetFilters\(\)/);
});

test('temporary search and group never become persisted preferences', () => {
  const prefs = normalizePreferences({ selectedId: 'diamond-matter', query: 'Diamond Matter', group: 'fusions', readyOnly: true }, data.forms);
  assert.deepEqual(Object.keys(prefs).sort(), ['mode', 'reducedMotion', 'selectedId', 'watch']);
});
