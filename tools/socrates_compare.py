"""Compare our 24-hour screen with CelesTrak SOCRATES, the public conjunction report produced from the
same public element sets. Matches events by object pair and time of closest approach.
python3 tools/socrates_compare.py events_24h.json cat.json out.json"""
import csv, io, json, sys, urllib.request, datetime as dt
ours, cat = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
ids = [c[1][2:7].strip().lstrip('0') for c in cat]
t0 = dt.datetime.fromisoformat(ours['t0'].replace('Z', '+00:00'))
if t0.tzinfo is None: t0 = t0.replace(tzinfo=dt.timezone.utc)
t1 = t0 + dt.timedelta(hours=ours['hours'])
raw = urllib.request.urlopen(urllib.request.Request('https://celestrak.org/SOCRATES/sort-minRange.csv', headers={'User-Agent': 'satellite-collision-watch'}), timeout=120).read().decode()
rows = list(csv.DictReader(io.StringIO(raw)))
print('SOCRATES columns:', list(rows[0].keys()) if rows else 'none')
col = lambda r, *keys: next((r[k] for k in r if any(s in k.upper() for s in keys)), None)
O = {}
for a, b, t, miss, *_ in ours['events']:
    O.setdefault(tuple(sorted((ids[a], ids[b]))), []).append((t0 + dt.timedelta(seconds=t), miss))
inwin, matched, diffs, missed = [], 0, [], []
for r in rows:
    n1, n2 = r['NORAD_CAT_ID_1'].strip().lstrip('0'), r['NORAD_CAT_ID_2'].strip().lstrip('0')
    tca = dt.datetime.fromisoformat(r['TCA'].strip().replace(' ', 'T')).replace(tzinfo=dt.timezone.utc)
    rng = float(r['TCA_RANGE'])
    if not (t0 <= tca <= t1) or rng > ours['thresh'] or n1 not in ids or n2 not in ids: continue
    r['_slow'] = float(r['TCA_RELATIVE_SPEED']) < 0.1    # formation flying: our screen skips these on purpose
    inwin.append(r); hits = [(abs((t - tca).total_seconds()), m) for t, m in O.get(tuple(sorted((n1, n2))), [])]
    best = min(hits) if hits else None
    if best and best[0] < 60: matched += 1; r['_hit'] = True; diffs.append((best[0], abs(best[1] - rng)))
    else: r['_hit'] = False; missed.append(dict(pair=[n1, n2], tca=tca.isoformat(), range_km=rng, rel_speed=float(r['TCA_RELATIVE_SPEED'])))
fast = [r for r in inwin if not r['_slow']]
under1 = [r for r in fast if float(r['TCA_RANGE']) < 1]
res = dict(window=[t0.isoformat(), t1.isoformat()],
           crossing_events=len(fast), crossing_found=sum(r['_hit'] for r in fast), crossing_recall=sum(r['_hit'] for r in fast) / max(1, len(fast)),
           crossing_under_1km=len(under1), crossing_under_1km_found=sum(r['_hit'] for r in under1),
           formation_events_skipped_by_design=len(inwin) - len(fast), socrates_events_in_window=len(inwin), found_by_us=matched,
           recall=matched / max(1, len(inwin)), tca_diff_s_median=sorted(d[0] for d in diffs)[len(diffs) // 2] if diffs else None,
           range_diff_km_median=sorted(d[1] for d in diffs)[len(diffs) // 2] if diffs else None,
           range_diff_km_p95=sorted(d[1] for d in diffs)[int(len(diffs) * 0.95)] if diffs else None, missed=[x for x in missed if x['rel_speed'] >= 0.1][:50])
print(json.dumps(res, indent=1)); json.dump(res, open(sys.argv[3], 'w'), indent=1)
