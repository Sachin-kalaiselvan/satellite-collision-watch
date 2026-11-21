"""Independent conjunction screen for checking the app's sieve.
Propagator: python-sgp4 (Vallado's C++ SGP4 wrapped for Python), not satellite.js.
Search: every 5 s, a k-d tree finds all pairs within 45 km (enough for 16 km/s relative
speed over half a step); linear-motion closest approach picks candidates under 15 km;
each candidate is refined with Brent's method on the true SGP4 distance.
python3 bench/screen_ref.py cat.json 2026-11-19T17:30:00Z 2 5 bench/out/ref_2h.json"""
import json, sys, time
import numpy as np
from sgp4.api import Satrec, SatrecArray, jday
from scipy.spatial import cKDTree
from scipy.optimize import minimize_scalar

cat = json.load(open(sys.argv[1])); t0s, hours, thresh, out = sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
sats = [Satrec.twoline2rv(c[1], c[2]) for c in cat]; arr = SatrecArray(sats)
y, mo, d, h, mi, s = int(t0s[:4]), int(t0s[5:7]), int(t0s[8:10]), int(t0s[11:13]), int(t0s[14:16]), float(t0s[17:19])
jd0, fr0 = jday(y, mo, d, h, mi, s)
STEP, R = 5.0, 45.0
nsteps = int(hours * 3600 / STEP)
cand = {}
T = time.time()
for k0 in range(0, nsteps + 1, 120):
    ks = np.arange(k0, min(nsteps + 1, k0 + 120))
    fr = fr0 + ks * STEP / 86400.0
    e, r, v = arr.sgp4(np.full(len(ks), jd0), fr)   # (nsat, nt, 3)
    for j, k in enumerate(ks):
        ok = e[:, j] == 0; idx = np.nonzero(ok)[0]
        P = r[idx, j]; V = v[idx, j]
        pairs = cKDTree(P).query_pairs(R, output_type='ndarray')
        if not len(pairs): continue
        a, b = idx[pairs[:, 0]], idx[pairs[:, 1]]
        dr = r[b, j] - r[a, j]; dv = v[b, j] - v[a, j]; vv = (dv * dv).sum(1)
        tau = np.clip(-(dr * dv).sum(1) / np.maximum(vv, 1e-12), -STEP / 2, STEP / 2)
        md = np.linalg.norm(dr + dv * tau[:, None], axis=1)
        for q in np.nonzero(md < 3 * thresh)[0]:
            key = (int(min(a[q], b[q])), int(max(a[q], b[q]))); tg = k * STEP + tau[q]
            lst = cand.setdefault(key, [])
            if lst and abs(lst[-1][0] - tg) < 1.5 * STEP:
                if md[q] < lst[-1][1]: lst[-1] = (tg, md[q], np.sqrt(vv[q]))
            else: lst.append((tg, md[q], np.sqrt(vv[q])))
    print(f'{ks[-1] / nsteps * 100:5.1f}%  candidates {len(cand)}  {time.time() - T:.0f}s', file=sys.stderr)

def dist(A, B, t):
    f = fr0 + t / 86400.0
    ea, ra, _ = sats[A].sgp4(jd0, f); eb, rb, _ = sats[B].sgp4(jd0, f)
    return np.linalg.norm(np.subtract(ra, rb)) if ea == 0 and eb == 0 else 1e9

events, formation = [], 0
for (A, B), lst in cand.items():
    for tg, md, vrel in lst:
        if vrel < 0.1: formation += 1; continue
        res = minimize_scalar(lambda t: dist(A, B, t), bounds=(tg - STEP, tg + STEP), method='bounded', options={'xatol': 1e-4})
        if res.fun <= thresh: events.append([A, B, float(res.x), float(res.fun), float(vrel)])
json.dump({'t0': t0s, 'hours': hours, 'thresh': thresh, 'step': STEP, 'formation': formation, 'events': events}, open(out, 'w'))
print(f'{len(events)} events under {thresh} km, {formation} formation pairs skipped, {time.time() - T:.0f}s')
