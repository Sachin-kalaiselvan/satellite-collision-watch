# satellite-collision-watch

screens the whole public satellite catalogue (~18,500 objects, tracked debris included) for close approaches over the next day. in the browser.

## what's in it

- **SGP4 propagation** for every object via satellite.js
- **conjunction screening.** spatial-hash sieve at 20s steps finds candidate pairs, golden-section search nails the time of closest approach, miss distance split into radial / along-track / cross-track
- **collision probability estimate** + a **clohessy-wiltshire burn planner** for an avoidance manoeuvre
- **my fleet.** pick the sats you care about, anything passing under 5 km in the next hour throws an alert
- **exports.** CSV results + an encounter report PDF

## is it right though

checked against stuff that shares no code with it. full numbers in [docs/VALIDATION.md](docs/VALIDATION.md).

- **propagation:** matches vallado's official SGP4 verification set to **0.12 mm** across 666 reference states
- **screening:** separate brute-force screen using vallado's C++ SGP4 + a k-d tree at 4× finer steps, whole catalogue, 2 hours. app found **99.84%** of its 3,718 passes under 5 km and **all 94** under 1 km. miss distances agree to a median of 4 cm
- **vs SOCRATES** (celestrak's public conjunction report): a github action runs daily, grabs today's catalogue, screens 24h and compares. where both list the same encounter, timing agrees to 0.11s and distance to 0.3 km (median). but only 51% of SOCRATES' crossings show up in mine, most likely because it's fed different input data. not confirmed yet, it's tracked daily in `data/history/`

## data

`cat.json` is a snapshot of public TLEs, `events.json` is a precomputed 24h screen. to refresh:

```bash
npm install
node tools/prepare-catalog.js path/to/celestrak/tle   # writes cat.json
node tools/screen-catalog.js 24 events.json 1         # 24h, passes under 1 km
python3 build.py                                      # rebuild index.html from src/
```

don't use this for real ops. public element sets just aren't accurate enough to make actual collision-avoidance calls.

MIT
