// Checks satellite.js (the propagator the app uses) against Vallado's official SGP4
// verification cases (SGP4-VER.TLE / tcppver.out, from "Revisiting Spacetrack Report #3").
// node bench/sgp4_vectors.js <dir with SGP4-VER.TLE and tcppver.out> [out.json]
const fs = require('fs'), path = require('path'), satellite = require('satellite.js');
const dir = process.argv[2];
const tle = fs.readFileSync(path.join(dir, 'SGP4-VER.TLE'), 'utf8').split(/\r?\n/).filter(l => /^[12] /.test(l));
const ref = fs.readFileSync(path.join(dir, 'tcppver.out'), 'utf8').split(/\r?\n/);
const blocks = []; let cur = null;
for (const l of ref) { if (/xx\s*$/.test(l)) { cur = { sat: l.trim().split(/\s+/)[0], rows: [] }; blocks.push(cur); } else if (cur && l.trim()) { const f = l.trim().split(/\s+/).map(Number); if (f.length >= 7 && f.slice(0, 7).every(isFinite)) cur.rows.push(f.slice(0, 7)); } }
const out = []; let worstR = 0, worstV = 0, n = 0;
for (let i = 0; i < blocks.length; i++) {
  const l1 = tle[2 * i], l2 = tle[2 * i + 1].slice(0, 69), b = blocks[i];
  if (l1.slice(2, 7).trim().replace(/^0+/, '') !== b.sat.replace(/^0+/, '')) throw new Error(`order mismatch at ${i}: ${l1.slice(2, 7)} vs ${b.sat}`);
  const rec = satellite.twoline2satrec(l1, l2); let cr = 0, cv = 0, bad = 0;
  for (const [t, x, y, z, vx, vy, vz] of b.rows) {
    const pv = satellite.sgp4(rec, t);
    if (!pv || !pv.position) { bad++; continue; }
    const dr = Math.hypot(pv.position.x - x, pv.position.y - y, pv.position.z - z) * 1000, dv = Math.hypot(pv.velocity.x - vx, pv.velocity.y - vy, pv.velocity.z - vz) * 1000;
    cr = Math.max(cr, dr); cv = Math.max(cv, dv); n++;
  }
  worstR = Math.max(worstR, cr); worstV = Math.max(worstV, cv);
  out.push({ sat: b.sat, points: b.rows.length, failed: bad, maxPosErr_m: cr, maxVelErr_mps: cv });
}
console.log(`${blocks.length} verification satellites, ${n} reference states`);
console.log(`worst position error ${worstR.toExponential(2)} m, worst velocity error ${worstV.toExponential(2)} m/s`);
for (const o of out.filter(o => o.maxPosErr_m > 1e-3 || o.failed)) console.log(' ', o.sat, `${o.maxPosErr_m.toExponential(2)} m`, o.failed ? `${o.failed} states not propagated` : '');
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
