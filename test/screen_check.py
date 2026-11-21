"""CI check: screen 20 minutes of the full catalogue with the app's code and with the
independent reference, and require full recall under 1 km and 99% overall."""
import json, subprocess, sys, os
env = dict(os.environ, T0='2026-11-19T17:30:00Z')
subprocess.run(['node', 'tools/screen-catalog.js', '0.3333', '/tmp/ours.json', '5'], check=True, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
subprocess.run([sys.executable, 'bench/screen_ref.py', 'cat.json', '2026-11-19T17:30:00Z', '0.3333', '5', '/tmp/ref.json'], check=True, stderr=subprocess.DEVNULL)
o, r = json.load(open('/tmp/ours.json')), json.load(open('/tmp/ref.json')); t0 = o['t0'] / 1000
O = {}
for a, b, t, m, *_ in o['events']: O.setdefault((min(a, b), max(a, b)), []).append(t / 1000 - t0)
hit = lambda a, b, t: any(abs(t - t2) < 10 for t2 in O.get((a, b), []))
found = sum(hit(a, b, t) for a, b, t, m, _ in r['events']); close = [(a, b, t) for a, b, t, m, _ in r['events'] if m < 1]
rec = found / max(1, len(r['events'])); rec1 = sum(hit(*c) for c in close)
print(f'recall {found}/{len(r["events"])} ({rec * 100:.2f}%), under 1 km {rec1}/{len(close)}')
sys.exit(0 if rec >= 0.99 and rec1 == len(close) else 1)
