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
export function ringPlacement(relativeAngle, width, ellipseRatio = .8) {
  const size = Number.isFinite(width) && width > 0 ? width : 400;
  const angle = Number.isFinite(relativeAngle) ? relativeAngle : 0;
  const depth = (Math.cos(angle) + 1) / 2;
  // Match CSS --ring-radius: min(165px, 34cqw). Cards remain upright;
  // only extremely narrow stages need the largest 58px icon's half-width guard.
  const edgeRadius = Math.max(0, size / 2 - 58 * 1.25 / 2 - 4);
  const radiusX = Math.min(size * .34, 165, edgeRadius);
  const ratio = Number.isFinite(ellipseRatio) ? Math.min(1, Math.max(.32, ellipseRatio)) : .8;
  const radiusY = radiusX * ratio;
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

// Each anchor is the centre and size of the already-drawn face in one atlas cell.
// The viewport must have this exact cell aspect ratio (no object-fit letterboxing).
// Invalid geometry falls back to the existing front artwork instead of guessing.
export function watchFrameLayout(atlas, viewIndex = 2, raised = false, columns = 4, rows = 2) {
  if (!atlas || columns !== 4 || rows !== 2 || !Number.isInteger(viewIndex) || viewIndex < 0 || viewIndex >= columns ||
      !Number.isFinite(atlas.width) || atlas.width <= 0 || !Number.isFinite(atlas.height) || atlas.height <= 0 ||
      !Array.isArray(atlas.frames) || atlas.frames.length !== columns) return null;
  const anchor = atlas.frames[viewIndex]?.[raised ? 'raised' : 'closed'];
  if (!anchor || !['x', 'y', 'w', 'h'].every(key => Number.isFinite(anchor[key])) ||
      anchor.x < 0 || anchor.x > 1 || anchor.y < 0 || anchor.y > 1 ||
      anchor.w <= 0 || anchor.w > 1 || anchor.h <= 0 || anchor.h > 1) return null;
  return {
    left: `${-100 * viewIndex}%`, top: raised ? '-100%' : '0%',
    aspectRatio: `${atlas.width / columns} / ${atlas.height / rows}`,
    anchor: { x: anchor.x, y: anchor.y, w: anchor.w, h: anchor.h, a: Number.isFinite(anchor.a) ? anchor.a : 0 },
    ellipseRatio: Math.min(1, Math.max(.32, anchor.h / anchor.w)),
  };
}

// CSS contract: a/b are permanent full-size leaves, clipped by a fixed circular
// #screen-rotor. Each leaf twists independently; the hero and outer case stay put.
// The observed clip supports interlocking plates and a central diamond aperture,
// not an A-to-B hero swap. This 760ms selection choreography is interaction design.
export function dialSelectionFrames(direction = 1) {
  const sign = Number.isFinite(direction) && direction < 0 ? -1 : 1;
  const duration = 760;
  // Seven corresponding vertices keep every clip transition continuous. Open
  // collinear vertices match the five-vertex resting CSS diamond exactly.
  const aOpen = 'polygon(0% 0%,50% 0%,25% 25%,0% 50%,25% 75%,50% 100%,0% 100%)';
  const bOpen = 'polygon(50% 0%,100% 0%,100% 100%,50% 100%,75% 75%,100% 50%,75% 25%)';
  const aSweep = 'polygon(0% 0%,62% 0%,47% 27%,35% 50%,44% 73%,58% 100%,0% 100%)';
  const bSweep = 'polygon(42% 0%,100% 0%,100% 100%,38% 100%,53% 73%,65% 50%,56% 27%)';
  const aPinhole = 'polygon(0% 0%,52% 0%,52% 40%,44% 50%,52% 60%,52% 100%,0% 100%)';
  const bPinhole = 'polygon(48% 0%,100% 0%,100% 100%,48% 100%,48% 60%,56% 50%,48% 40%)';
  // Slight overlap avoids a rasterized seam exposing the hero during the swap.
  const aClosed = 'polygon(0% 0%,50.6% 0%,50.6% 25%,50.6% 50%,50.6% 75%,50.6% 100%,0% 100%)';
  const bClosed = 'polygon(49.4% 0%,100% 0%,100% 100%,49.4% 100%,49.4% 75%,49.4% 50%,49.4% 25%)';
  const curve = 'cubic-bezier(.45,0,.2,1)';
  const rest = 'translate(0%,0%) rotate(0deg)';
  const leaf = (open, sweep, pinhole, closed, side) => [
    { clipPath: open, transform: rest, offset: 0, easing: curve },
    { clipPath: sweep, transform: `translate(${side * 2.5}%,0%) rotate(${sign * side * 18}deg)`, offset: .16, easing: curve },
    { clipPath: pinhole, transform: rest, offset: .28, easing: curve },
    { clipPath: closed, transform: rest, offset: .36, easing: 'linear' },
    { clipPath: closed, transform: rest, offset: .60, easing: curve },
    { clipPath: pinhole, transform: rest, offset: .70, easing: curve },
    { clipPath: sweep, transform: `translate(${side * 2.5}%,0%) rotate(${-sign * side * 18}deg)`, offset: .84, easing: curve },
    { clipPath: open, transform: rest, offset: 1, easing: 'linear' },
  ];
  return {
    duration,
    swapAt: duration * .48,
    // Global easing must stay linear so swapAt matches the covered wall-clock window.
    // Individual transition segments carry their own easing instead.
    easing: 'linear',
    a: leaf(aOpen, aSweep, aPinhole, aClosed, 1),
    b: leaf(bOpen, bSweep, bPinhole, bClosed, -1),
    rotor: [
      { transform: 'rotate(0deg)', offset: 0, easing: 'linear' },
      { transform: 'rotate(0deg)', offset: 1, easing: 'linear' },
    ],
  };
}
