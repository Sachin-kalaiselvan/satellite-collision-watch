# Satellite Collision Watch

Screens the public satellite catalogue (about 18,500 objects, including tracked debris) for close approaches over the next day, in the browser.

## What is in it

- **SGP4 propagation** of every object with satellite.js.
- **Conjunction screening.** A spatial-hash sieve at 20 s steps finds candidate pairs; golden-section search refines the time of closest approach; miss distance is split into radial, along-track and cross-track components.
- **Collision probability estimate** and a **Clohessy–Wiltshire burn planner** for an avoidance manoeuvre.
- **My fleet.** Pick satellites to watch; passes under 5 km within the hour raise an alert.
- **Exports.** Results as CSV and an encounter report as PDF.

## Validation

Checked against independent references. Full method and numbers are in [docs/VALIDATION.md](docs/VALIDATION.md).

- **Propagation:** matches Vallado's official SGP4 verification set to 0.12 mm over 666 reference states.
- **Screening:** a separate brute-force screen with Vallado's C++ SGP4 and a k-d tree at 4× finer time steps ran over the whole catalogue for 2 hours. The app found 99.84% of its 3,718 passes under 5 km, and all 94 under 1 km. Miss distances agree to a median of 4 cm.

## Data

`cat.json` is a snapshot of public two-line element sets; `events.json` is a precomputed 24-hour screening. To refresh:

```
npm install
node tools/prepare-catalog.js path/to/celestrak/tle   # writes cat.json
node tools/screen-catalog.js 24 events.json 1         # 24 h, passes under 1 km
python3 build.py                                      # rebuild index.html from src/
```

Not for operational use: public element sets are not accurate enough for real collision-avoidance decisions.
