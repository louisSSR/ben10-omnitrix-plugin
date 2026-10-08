export const WATCHES = Object.freeze([
  { id: 'original', name: '初代 Omnitrix', era: 'ORIGINAL SERIES', number: '01', detail: '厚重圆形表盘 · 灰白护甲 · 四点指示灯' },
  { id: 'recalibrated', name: '重校准 Omnitrix', era: 'ALIEN FORCE', number: '02', detail: '紧凑黑绿表壳 · 立体全息投影' },
  { id: 'ultimatrix', name: 'Ultimatrix', era: 'ULTIMATE ALIEN', number: '03', detail: '长形护腕 · 双侧能量导轨' },
  { id: 'omniverse', name: '完成版 Omnitrix', era: 'OMNIVERSE', number: '04', detail: '方形护甲 · 环形选择界面' },
]);
export const MODES = Object.freeze([
  { id: 'projection', name: '全息投影', code: '01', hint: '滑动切换 · 点击表盘锁定', description: '从表盘升起你的下一种形态。' },
  { id: 'carousel', name: '环形转盘', code: '02', hint: '拨动转盘 · 点选轮廓 · 点击表盘锁定', description: '旋转、瞄准，然后选定。' },
  { id: 'dial', name: '表盘剪影', code: '03', hint: '滑动切换 · 点击菱形表盘锁定', description: '经典黑色剪影，回到最初的变身时刻。' },
  { id: 'archive', name: '宇宙记录墙', code: '04', hint: '点击卡片翻转 · 点击锁定形态确认', description: '所有形态，一面无限延伸的记录墙。' },
]);
export function normalizePreferences(value, forms = []) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    watch: WATCHES.some(x => x.id === v.watch) ? v.watch : 'original',
    mode: MODES.some(x => x.id === v.mode) ? v.mode : 'projection',
    reducedMotion: v.reducedMotion === true,
    selectedId: forms.some(x => x.id === v.selectedId) ? v.selectedId : (forms[0]?.id || ''),
  };
}
export function filterForms(forms, { query = '', group = 'all', readyOnly = true } = {}) {
  const needle = String(query).normalize('NFKC').toLocaleLowerCase().trim();
  return forms.filter(f => (!readyOnly || !!f.asset) && (group === 'all' || f.group === group) &&
    (!needle || [f.name, f.en, f.id, ...(f.aliases || [])].filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase().includes(needle)));
}
export function stepSelection(forms, id, delta) {
  if (!forms.length) return null;
  const position = forms.findIndex(f => f.id === id);
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  const index = ((Math.max(0, position) + step) % forms.length + forms.length) % forms.length;
  return forms[index];
}
export function ringItems(forms, id, slots = 8) {
  if (!forms.length) return [];
  const length = Math.min(forms.length, Math.max(1, Math.trunc(slots) || 8));
  const start = Math.max(0, forms.findIndex(f => f.id === id));
  return Array.from({ length }, (_, n) => forms[(start + n) % forms.length]);
}
