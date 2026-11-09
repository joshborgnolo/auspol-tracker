/* ===================== the way to the nearest polling place =====================
   Zoomed in where no polling place is on screen (out bush, at sea off a coast),
   a note at the stage's top left says how far the nearest one is from the middle
   of the map, with an arrow turned towards it; pressing it flies there.
   - Counted: the year's polling places and early voting centres with a spot on
     the map. Hospital and mobile teams (AEC types 2–4) visit people; nobody can
     walk to them, so they don't count.
   - Shown only where polling places are drawn (zoomed in to their zoom, or a
     seat chosen), so it never speaks for dots the map isn't showing anyway.
   - "Off screen" means the dot lies wholly outside the clear stage: in full
     screen, outside the plates. The arrow turns on the screen, so it points
     where the dot is on the map as drawn.
   - Distance is the great-circle distance between the two points, read
     back through the year's own projection. */
const nearEl = document.createElement("button");
nearEl.type = "button"; nearEl.className = "mp-near"; nearEl.hidden = true;
nearEl.innerHTML = `<svg class="mp-near-arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6 13.4 14 8 11 2.6 14Z" fill="currentColor"/></svg><span class="mp-near-t"></span>`;
$("#stage").appendChild(nearEl);
const nearArrow = nearEl.querySelector(".mp-near-arrow"), nearText = nearEl.querySelector(".mp-near-t");
let nearAt = -1, nearKey = "";
nearEl.addEventListener("click", () => { if (nearAt >= 0) goBooth(nearAt); });
// the kinds a voter can walk into: ordinary (1), early voting (5) and, in sources
// that don't type their places, unknown (0)
const nearKind = (ty) => ty === 1 || ty === 5 || ty === 0;
function kmBetween(m, x0, y0, x1, y1) {
  const a = m.proj.invert([x0, y0]), b = m.proj.invert([x1, y1]);
  if (!a || !b) return NaN;
  const r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const nearKm = (km) => km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString("en-AU")} km`;
function nearHide() { if (!nearEl.hidden) nearEl.hidden = true; nearAt = -1; nearKey = ""; }
function updateNear(m) {
  const b = m && m.booth;
  if (S.view !== "map" || morph || ymorph || !b || !b.n || !m.proj || document.documentElement.classList.contains("ch-on")
    || islOf(m, away) || (T.k < K_IN && selDiv() == null)) return nearHide();
  // the clear stage and its middle, in stage px
  const q = FS.on ? FS.ins : { t: 0, r: 0, b: 0, l: 0 };
  const L = q.l, R = Wpx - q.r, Tp = q.t, B = Hpx - q.b, cx = (L + R) / 2, cy = (Tp + B) / 2;
  const key = [m.year, T.k, T.x, T.y, L, R, Tp, B, S.sel.level, S.sel.div, backBtn.hidden, $("#filterpill").hidden].join();
  if (key === nearKey) return;
  nearKey = key;
  // the nearest by map units (an equal-area conic: true enough at this zoom to pick it)
  const mx = (cx - T.x) / T.k, my = (cy - T.y) / T.k;
  let bj = -1, bd = Infinity;
  for (let j = 0; j < b.n; j++) {
    const x = b.x[j]; if (Number.isNaN(x) || !nearKind(b.ty[j])) continue;
    const dx = x - mx, dy = b.y[j] - my, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; bj = j; }
  }
  if (bj < 0) return nearHide();
  const sx = b.x[bj] * T.k + T.x, sy = b.y[bj] * T.k + T.y, r = rad(boothSizeVotes(b, bj)) + 2;
  if (sx + r > L && sx - r < R && sy + r > Tp && sy - r < B) return nearHide();
  const km = kmBetween(m, mx, my, b.x[bj], b.y[bj]);
  if (!Number.isFinite(km)) return nearHide();
  nearAt = bj;
  const name = dn(b.name[bj]), t = `${nearKm(km)} to the nearest polling place`;
  if (nearText.textContent !== t) nearText.textContent = t;
  nearEl.title = `Go to ${name}`; nearEl.setAttribute("aria-label", `${t}: ${name}. Go there`);
  nearArrow.style.transform = `rotate(${(Math.atan2(sy - cy, sx - cx) * 180 / Math.PI + 90).toFixed(1)}deg)`;
  // top left of the clear stage, under the way back from an island and the
  // filter pill wherever they'd overlap it
  let top = Tp + 8; const left = L + 8;
  nearEl.style.left = `${left}px`;
  if (nearEl.hidden) nearEl.hidden = false;
  const w = nearEl.offsetWidth;
  for (const el of [backBtn, $("#filterpill")]) {
    if (!el || el.hidden) continue;
    if (el.offsetLeft < left + w && el.offsetLeft + el.offsetWidth > left) top = Math.max(top, el.offsetTop + el.offsetHeight + 6);
  }
  nearEl.style.top = `${top}px`;
}
