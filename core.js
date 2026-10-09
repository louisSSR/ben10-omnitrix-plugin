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

// The watch center is the origin; angle 0 is the selected slot at twelve o'clock.
// The ring stays in one plane. Depth changes size and stacking, not its z position.
export function ringPlacement(relativeAngle, width) {
  const size = Number.isFinite(width) && width > 0 ? width : 400;
  const angle = Number.isFinite(relativeAngle) ? relativeAngle : 0;
  const depth = (Math.cos(angle) + 1) / 2;
  // Match CSS --ring-radius: min(220px, 34cqw). Cards remain upright;
  // only extremely narrow stages need the largest 58px icon's half-width guard.
  const edgeRadius = Math.max(0, size / 2 - 58 * 1.25 / 2 - 4);
  const radiusX = Math.min(size * .34, 220, edgeRadius);
  const radiusY = radiusX * .8;
  return {
    x: Math.sin(angle) * radiusX,
    y: -Math.cos(angle) * radiusY,
    z: 0,
    rotate: Math.atan2(radiusY * Math.sin(angle), radiusX * Math.cos(angle)) * 180 / Math.PI,
    scale: .70 + depth * .55,
    opacity: .35 + depth * .65,
    zIndex: 20 + Math.round(depth * 80),
    depth,
  };
}

// CSS contract: a/b are permanent full-size leaves; their parent #screen-rotor
// rotates around its center. These equal-vertex clips morph the opening itself.
// The 760ms choreography is interaction design, not a verified animation timing.
export function dialSelectionFrames(direction = 1) {
  const sign = Number.isFinite(direction) && direction < 0 ? -1 : 1;
  const duration = 760;
  const aOpen = 'polygon(0% 0%,50% 0%,0% 50%,50% 100%,0% 100%)';
  const bOpen = 'polygon(50% 0%,100% 0%,100% 100%,50% 100%,100% 50%)';
  const aHourglass = 'polygon(0% 0%,25% 0%,42% 50%,25% 100%,0% 100%)';
  const bHourglass = 'polygon(75% 0%,100% 0%,100% 100%,75% 100%,58% 50%)';
  const aClosed = 'polygon(0% 0%,50% 0%,50% 50%,50% 100%,0% 100%)';
  const bClosed = 'polygon(50% 0%,100% 0%,100% 100%,50% 100%,50% 50%)';
  const curve = 'cubic-bezier(.45,0,.2,1)';
  const leaf = (open, hourglass, closed) => [
    { clipPath: open, offset: 0, easing: curve },
    { clipPath: hourglass, offset: .16, easing: curve },
    { clipPath: closed, offset: .30, easing: 'linear' },
    { clipPath: closed, offset: .55, easing: curve },
    { clipPath: hourglass, offset: .76, easing: curve },
    { clipPath: open, offset: 1, easing: 'linear' },
  ];
  return {
    duration,
    swapAt: duration * .45,
    // Global easing must stay linear so swapAt matches the covered wall-clock window.
    // Individual transition segments carry their own easing instead.
    easing: 'linear',
    a: leaf(aOpen, aHourglass, aClosed),
    b: leaf(bOpen, bHourglass, bClosed),
    rotor: [
      { transform: 'rotate(0deg)', offset: 0, easing: 'linear' },
      { transform: 'rotate(0deg)', offset: .16, easing: curve },
      { transform: `rotate(${sign * 90}deg)`, offset: .30, easing: 'linear' },
      { transform: `rotate(${sign * 90}deg)`, offset: .55, easing: curve },
      { transform: `rotate(${sign * 180}deg)`, offset: .76, easing: 'linear' },
      { transform: `rotate(${sign * 180}deg)`, offset: 1, easing: 'linear' },
    ],
  };
}
