"""Download the public catalogue from CelesTrak (GP data, TLE format) into cat.json.
python3 tools/fetch_catalog.py cat.json"""
import json, sys, urllib.request
GROUPS = [('stations', 'stations'), ('starlink', 'starlink'), ('oneweb', 'oneweb'), ('kuiper', 'kuiper'), ('gnss', 'navigation'), ('weather', 'weather'),
          ('cosmos-2251-debris', 'debris'), ('iridium-33-debris', 'debris'), ('fengyun-1c-debris', 'debris'), ('cosmos-1408-debris', 'debris'), ('active', 'other')]
out, seen = [], set()
for g, label in GROUPS:
    url = f'https://celestrak.org/NORAD/elements/gp.php?GROUP={g}&FORMAT=tle'
    txt = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'satellite-collision-watch'}), timeout=120).read().decode()
    L = [l.rstrip() for l in txt.splitlines() if l.strip()]
    for i in range(0, len(L) - 2, 3):
        name, l1, l2 = L[i].strip(), L[i + 1], L[i + 2]
        if not (l1.startswith('1 ') and l2.startswith('2 ')): continue
        sid = l1[2:7]
        if sid in seen: continue
        seen.add(sid); out.append([name, l1, l2, label])
    print(g, len(L) // 3, file=sys.stderr)
json.dump(out, open(sys.argv[1], 'w')); print(len(out), 'objects')
