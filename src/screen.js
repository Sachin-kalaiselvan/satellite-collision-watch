// Conjunction screening: SGP4 propagation, spatial hashing sieve, closest-approach refinement.
// Expects global `satellite` (satellite.js).
const RE = 6378.135;
function makeRecs(cat) {
  return cat.map(([name, l1, l2, group], i) => {
    const s = satellite.twoline2satrec(l1, l2);
    const a = s.a * RE, e = s.ecco;
    return { i, name, group, id: l1.slice(2, 7).trim(), s, perigee: a * (1 - e) - RE, apogee: a * (1 + e) - RE, periodMin: 2 * Math.PI / s.no };
  });
}
function posvel(rec, date) {
  const pv = satellite.propagate(rec.s, date);
  if (!pv.position || isNaN(pv.position.x)) return null;
  return pv;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
// refine closest approach between two satellites near tGuess (ms), searching +-win seconds
function refine(A, B, tGuess, win) {
  const f = t => { const a = posvel(A, new Date(t)), b = posvel(B, new Date(t)); return a && b ? dist(a.position, b.position) : 1e9; };
  let lo = tGuess - win * 1000, hi = tGuess + win * 1000; const g = 0.6180339887;
  let c = hi - g * (hi - lo), d = lo + g * (hi - lo), fc = f(c), fd = f(d);
  for (let k = 0; k < 40; k++) { if (fc < fd) { hi = d; d = c; fd = fc; c = hi - g * (hi - lo); fc = f(c); } else { lo = c; c = d; fc = fd; d = lo + g * (hi - lo); fd = f(d); } }
  const t = (lo + hi) / 2, a = posvel(A, new Date(t)), b = posvel(B, new Date(t));
  if (!a || !b) return null;
  return { t, miss: dist(a.position, b.position), a, b };
}
// relative geometry in the primary's radial / along-track / cross-track frame
function rtn(a, b) {
  const r = a.position, v = a.velocity;
  const nr = Math.hypot(r.x, r.y, r.z), R = [r.x / nr, r.y / nr, r.z / nr];
  const h = [r.y * v.z - r.z * v.y, r.z * v.x - r.x * v.z, r.x * v.y - r.y * v.x], nh = Math.hypot(...h), N = h.map(q => q / nh);
  const T = [N[1] * R[2] - N[2] * R[1], N[2] * R[0] - N[0] * R[2], N[0] * R[1] - N[1] * R[0]];
  const d = [b.position.x - r.x, b.position.y - r.y, b.position.z - r.z];
  const dv = [b.velocity.x - v.x, b.velocity.y - v.y, b.velocity.z - v.z];
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  return { radial: dot(d, R), along: dot(d, T), cross: dot(d, N), vrel: Math.hypot(...dv), alt: nr - RE, speed: Math.hypot(v.x, v.y, v.z) };
}
// rough collision probability: isotropic 2-D Gaussian in the encounter plane
function pcEstimate(missKm, sigmaKm, hbrKm) { const s2 = 2 * sigmaKm * sigmaKm; return (hbrKm * hbrKm / s2) * Math.exp(-(missKm * missKm) / s2); }

// Screen `subject` indices (or all) against the whole catalogue.
// opts: {t0 (ms), hours, step (s), thresh (km), subject: array|null, onProgress}
function screen(recs, opts) {
  const { t0, hours, step, thresh } = opts;
  const subject = opts.subject ? new Set(opts.subject) : null;
  // altitude-band prefilter for one-vs-all screening
  let pool = recs;
  if (subject) {
    const subs = recs.filter(r => subject.has(r.i));
    pool = recs.filter(r => subject.has(r.i) || subs.some(s => r.perigee - thresh - 20 < s.apogee && s.perigee - thresh - 20 < r.apogee));
  }
  const steps = Math.ceil(hours * 3600 / step);
  const vmax = 16; // km/s, upper bound on relative speed
  const C = vmax * step / 2 + thresh + 5;
  const cand = new Map();
  const P = new Float64Array(pool.length * 6), ok = new Uint8Array(pool.length);
  for (let k = 0; k <= steps; k++) {
    const t = t0 + k * step * 1000, date = new Date(t);
    for (let j = 0; j < pool.length; j++) { const pv = posvel(pool[j], date); if (!pv) { ok[j] = 0; continue; } ok[j] = 1; const o = j * 6; P[o] = pv.position.x; P[o + 1] = pv.position.y; P[o + 2] = pv.position.z; P[o + 3] = pv.velocity.x; P[o + 4] = pv.velocity.y; P[o + 5] = pv.velocity.z; }
    const grid = new Map();
    const key = (x, y, z) => (x + 512) * 1048576 + (y + 512) * 1024 + (z + 512);
    for (let j = 0; j < pool.length; j++) { if (!ok[j]) continue; const o = j * 6; const kx = Math.floor(P[o] / C), ky = Math.floor(P[o + 1] / C), kz = Math.floor(P[o + 2] / C); const kk = key(kx, ky, kz); let a = grid.get(kk); if (!a) grid.set(kk, a = []); a.push(j); }
    for (const [kk, arr] of grid) {
      const kx = Math.floor(kk / 1048576) - 512, ky = Math.floor((kk % 1048576) / 1024) - 512, kz = kk % 1024 - 512;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const other = grid.get(key(kx + dx, ky + dy, kz + dz)); if (!other) continue;
        for (const a of arr) for (const b of other) {
          if (b <= a) continue;
          const A = pool[a], B = pool[b];
          if (subject && !subject.has(A.i) && !subject.has(B.i)) continue;
          const oa = a * 6, ob = b * 6;
          const rx = P[ob] - P[oa], ry = P[ob + 1] - P[oa + 1], rz = P[ob + 2] - P[oa + 2];
          const vx = P[ob + 3] - P[oa + 3], vy = P[ob + 4] - P[oa + 4], vz = P[ob + 5] - P[oa + 5];
          const vv = vx * vx + vy * vy + vz * vz;
          let tau = vv > 1e-9 ? -(rx * vx + ry * vy + rz * vz) / vv : 0; tau = Math.max(-step / 2, Math.min(step / 2, tau));
          const mx = rx + vx * tau, my = ry + vy * tau, mz = rz + vz * tau, md = Math.sqrt(mx * mx + my * my + mz * mz);
          if (md < thresh * 3) {
            const pk = A.i < B.i ? A.i + ':' + B.i : B.i + ':' + A.i;
            const tg = t + tau * 1000, prev = cand.get(pk);
            if (!prev) cand.set(pk, [{ tg, md, vrel: Math.sqrt(vv) }]);
            else { const last = prev[prev.length - 1]; if (Math.abs(last.tg - tg) < step * 1500) { if (md < last.md) { last.tg = tg; last.md = md; } } else prev.push({ tg, md, vrel: Math.sqrt(vv) }); }
          }
        }
      }
    }
    if (opts.onProgress && k % 20 === 0) opts.onProgress(k / steps, cand.size);
  }
  // refine
  const events = []; let formation = 0;
  for (const [pk, list] of cand) {
    const [ia, ib] = pk.split(':').map(Number), A = recs[ia], B = recs[ib];
    for (const c of list) {
      if (c.vrel < 0.1) { formation++; continue; } // flying together, not a crossing
      const r = refine(A, B, c.tg, step); if (!r || r.miss > thresh) continue;
      const g = rtn(r.a, r.b);
      events.push({ a: ia, b: ib, t: r.t, miss: r.miss, vrel: g.vrel, radial: g.radial, along: g.along, cross: g.cross, alt: g.alt, pc: pcEstimate(r.miss, 1.0, 0.01) });
    }
  }
  events.sort((x, y) => x.miss - y.miss);
  return { events, formation, candidates: cand.size, pool: pool.length };
}
if (typeof module !== 'undefined') module.exports = { makeRecs, screen, refine, rtn, posvel, pcEstimate, RE };
