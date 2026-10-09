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

function filterSession({ query = '', group = 'all', readyOnly = false, selectedId = data.forms[0].id } = {}) {
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
    readyForms: data.forms.filter(form => !!form.asset),
    byId: new Map(data.forms.map(form => [form.id, form])),
    catalogVisible: filterForms(data.forms, { query, group, readyOnly }),
    $: id => nodes[id], filterForms,
    stopMotion: () => calls.stopped++,
    save: () => calls.saved.push(structuredClone(preferences)),
    renderFilters: () => calls.filters++,
    renderCatalog: () => { calls.catalog++; context.renderFilterSummary(); },
    renderStage: () => calls.stage++,
  });
  vm.runInContext(['watchSelectionPool', 'refreshFilter', 'renderFilterSummary', 'resetFilters'].map(appFunction).join('\n'), context);
  context.visible = context.watchSelectionPool();
  return { context, nodes, calls };
}

test('clearing the observed Diamond Matter search restores the entire catalog and preserves the chosen hero', () => {
  const match = data.forms.find(form => form.id === 'diamond-matter');
  assert.ok(match?.asset);
  const { context, nodes, calls } = filterSession({ query: 'Diamond Matter', selectedId: match.id });
  assert.equal(context.catalogVisible.length, 1, 'the archive search finds one record');
  assert.equal(context.visible.length, data.coverage.reviewed, 'watch navigation remains independent of the search');
  const before = structuredClone(context.preferences);
  context.resetFilters();
  assert.equal(context.catalogVisible.length, data.forms.length);
  assert.equal(context.visible.length, data.coverage.reviewed);
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
  assert.equal(context.catalogVisible.length, 0);
  assert.equal(context.visible.length, data.coverage.reviewed);
  context.resetFilters();
  assert.deepEqual(Array.from(context.catalogVisible, form => form.id), data.forms.map(form => form.id));
  assert.ok(context.catalogVisible.some(form => !form.asset), 'pending forms remain honest catalog entries');
  assert.ok(context.visible.every(form => !!form.asset), 'watch neighbors prefer ready artwork');
  assert.equal(nodes['ready-only'].checked, false);
});

test('resetting repeatedly is stable and leaves watch, mode and motion preferences intact', () => {
  const { context } = filterSession({ query: '火焰', group: 'classic', readyOnly: true });
  context.resetFilters();
  const selected = context.preferences.selectedId;
  context.resetFilters();
  assert.equal(context.catalogVisible.length, data.forms.length);
  assert.equal(context.preferences.selectedId, selected);
  assert.equal(context.preferences.watch, 'ultimatrix');
  assert.equal(context.preferences.mode, 'dial');
  assert.equal(context.preferences.reducedMotion, true);
});

test('visible filter summary explains the restricted count and does not insert HTML', () => {
  const { context, nodes } = filterSession({ query: '<img onerror=alert(1)>', group: 'ultimate', readyOnly: true });
  context.renderFilterSummary();
  assert.match(nodes['filter-summary'].textContent, /档案搜索 0 \/ \d+/);
  assert.match(nodes['filter-summary'].textContent, new RegExp(`手表可切换 ${data.coverage.reviewed} 个`));
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
