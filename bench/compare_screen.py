"""Matches the app's screening results against the independent reference.
python3 bench/compare_screen.py bench/out/ours_2h.json bench/out/ref_2h.json"""
import json, sys, numpy as np
ours, ref = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
t0 = ours['t0'] / 1000
O = {}
for a, b, t, miss, *_ in ours['events']: O.setdefault((min(a, b), max(a, b)), []).append((t / 1000 - t0, miss))
Rf = {}
for a, b, t, miss, _ in ref['events']: Rf.setdefault((a, b), []).append((t, miss))
def match(src, dst, tol=10):
    hit, pairs = 0, []
    for k, lst in src.items():
        for t, m in lst:
            best = min((abs(t - t2), m2, t2) for t2, m2 in dst.get(k, [])) if k in dst else None
            if best and best[0] < tol: hit += 1; pairs.append((m, best[1], t - best[2]))
    return hit, pairs
nref = sum(len(v) for v in Rf.values()); nours = sum(len(v) for v in O.values())
found, pairs = match(Rf, O); conf, _ = match(O, Rf)
missed = [(k, t, m) for k, lst in Rf.items() for t, m in lst if not any(abs(t - t2) < 10 for t2, _ in O.get(k, []))]
dm = np.array([abs(a - b) * 1000 for a, b, _ in pairs]); dt = np.array([abs(c) for *_, c in pairs])
print(f'reference events {nref}, ours {nours}')
print(f'recall {found}/{nref} = {found / nref * 100:.2f}%   precision {conf}/{nours} = {conf / nours * 100:.2f}%')
print(f'miss distance agreement: median {np.median(dm):.3f} m, 99th pct {np.percentile(dm, 99):.3f} m, max {dm.max():.3f} m')
print(f'time of closest approach agreement: median {np.median(dt) * 1000:.3f} ms, max {dt.max() * 1000:.3f} ms')
missed.sort(key=lambda x: x[2])
good = np.array([(abs(a - b) * 1000, abs(c)) for a, b, c in pairs if abs(c) < 1])
print(f'same-encounter matches (TCA within 1 s): {len(good)}, miss distance diff median {np.median(good[:, 0]):.3f} m, max {good[:, 0].max():.3f} m')
r1 = [(k, t) for k, lst in Rf.items() for t, m in lst if m < 1]; f1 = sum(any(abs(t - t2) < 10 for t2, _ in O.get(k, [])) for k, t in r1)
print(f'recall for passes under 1 km: {f1}/{len(r1)}')
print('missed (closest first):', [(k, round(t), round(m, 3)) for k, t, m in missed[:10]])
by = np.array([m for _, _, m in missed]); print('missed by miss distance (km) under 1/2/5:', (by < 1).sum(), (by < 2).sum(), len(by))
json.dump({'reference': nref, 'ours': nours, 'recall': found / nref, 'precision': conf / nours, 'missDiff_m': {'median': float(np.median(dm)), 'p99': float(np.percentile(dm, 99)), 'max': float(dm.max())}, 'tcaDiff_ms': {'median': float(np.median(dt) * 1000), 'max': float(dt.max() * 1000)}, 'missed': [[list(k), t, m] for k, t, m in missed], 'sameEncounter': {'n': len(good), 'missDiff_m_median': float(np.median(good[:, 0])), 'missDiff_m_max': float(good[:, 0].max())}, 'recallUnder1km': [f1, len(r1)]}, open('bench/out/screen_cmp.json', 'w'), indent=1)
