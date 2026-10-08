export const WATCHES = Object.freeze([
  { id: 'original', name: '初代 Omnitrix', era: 'ORIGINAL SERIES', number: '01', detail: '粗黑表带 · 灰白弯爪 · 四灯与独立按钮' },
  { id: 'recalibrated', name: '重校准 Omnitrix', era: 'ALIEN FORCE', number: '02', detail: '紧凑黑绿表壳 · 立体全息投影' },
  { id: 'ultimatrix', name: 'Ultimatrix', era: 'ULTIMATE ALIEN', number: '03', detail: '绿色长护臂 · 侧面弯管 · 上端圆盘' },
  { id: 'omniverse', name: '完成版 Omnitrix', era: 'OMNIVERSE', number: '04', detail: '黑绿滑盖 · 浅色表带 · 打开的圆形核心' },
]);
export const MODES = Object.freeze([
  { id: 'projection', name: '全息投影', code: '01', hint: '滑动切换 · 点击表盘锁定', description: '从表盘升起你的下一种形态。' },
  { id: 'carousel', name: '环形转盘', code: '02', hint: '拨动转盘 · 点选轮廓 · 点击表盘锁定', description: '旋转、瞄准，然后选定。' },
  { id: 'dial', name: '表盘剪影', code: '03', hint: '滑动切换 · 点击菱形表盘锁定', description: '经典黑色剪影，回到最初的变身时刻。' },
]);
export function normalizePreferences(value, forms = []) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const selected = forms.find(x => x.id === v.selectedId) || forms.find(x => typeof v.selectedId === 'string' && x.aliases?.includes(v.selectedId));
  return {
    watch: WATCHES.some(x => x.id === v.watch) ? v.watch : 'original',
    mode: MODES.some(x => x.id === v.mode) ? v.mode : 'projection',
    reducedMotion: v.reducedMotion === true,
    selectedId: selected?.id || forms[0]?.id || '',
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
  const start = Math.max(0, forms.findIndex(f => f.id === id)) - Math.floor(length / 2);
  return Array.from({ length }, (_, n) => forms[(start + n + forms.length) % forms.length]);
}

// Angle 0 faces the viewer at the bottom of the orbit. Measure the stage, not the host viewport.
export function ringPlacement(relativeAngle, width) {
  const size = Number.isFinite(width) && width > 0 ? width : 400;
  const angle = Number.isFinite(relativeAngle) ? relativeAngle : 0;
  const mobile = size < 600;
  const depth = (Math.cos(angle) + 1) / 2;
  return {
    x: Math.sin(angle) * Math.min(mobile ? 170 : 250, size * .32),
    y: Math.cos(angle) * (mobile ? 90 : 110),
    z: Math.cos(angle) * 80,
    scale: .48 + depth * .68,
    opacity: .28 + depth * .72,
    zIndex: 20 + Math.round(depth * 80),
    depth,
  };
}
