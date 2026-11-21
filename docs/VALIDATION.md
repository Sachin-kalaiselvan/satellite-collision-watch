# Validation

Two questions decide whether a conjunction screener can be trusted: are the orbits propagated correctly, and does the screen find every close approach that is really there? Both were checked against independent references. Everything below can be re-run from `bench/`.

## 1. Propagation: satellite.js against Vallado's SGP4 verification set

The app propagates every object with [satellite.js](https://github.com/shashwatak/satellite-js). It was run on the official SGP4 verification cases from Vallado, Crawford, Hujsak and Kelso, *Revisiting Spacetrack Report #3* (AIAA 2006-6753): the 33 test satellites in `SGP4-VER.TLE` (near-Earth, deep-space, resonant, high-eccentricity and decaying orbits) compared state by state with the reference output `tcppver.out`.

| | Result |
|---|---|
| Reference states compared | 666 |
| Worst position error | 0.12 mm |
| Worst velocity error | 0.0009 mm/s |
| States not produced | 1 (satellite 33334, a case built to trigger SGP4 error code 2; the reference prints only its epoch state) |

```
node bench/sgp4_vectors.js <folder holding SGP4-VER.TLE and tcppver.out>
```
The two files ship with the Python `sgp4` package (`pip install sgp4`).

## 2. Screening: the app's sieve against an independent brute-force screen

The app finds close approaches with a spatial-hash sieve at 20-second steps, then refines each candidate by golden-section search. The reference shares none of that code:

- **Propagator:** python-sgp4, Vallado's C++ SGP4 compiled for Python, instead of satellite.js.
- **Search:** every 5 seconds (four times finer), a k-d tree finds all pairs within 45 km. Linear motion over half a step picks candidates, and each is refined with Brent's method on the true SGP4 distance.

Both screened the full catalogue (18,524 objects) over the same two hours from 2026-11-19 17:30 UTC for passes under 5 km. Formation pairs (relative speed under 0.1 km/s, such as docked spacecraft) are skipped by both.

| | Result |
|---|---|
| Close approaches found by the reference | 3,718 |
| Found by the app (recall) | 3,712 (99.84%) |
| Recall for passes under 1 km | 94 of 94 |
| Miss distance, same encounter (3,693 pairs) | median difference 4 cm, worst 68 cm |
| Time of closest approach | median difference 1 ms |
| App screening time, 2 hours of the full catalogue | 40 s in Node on one core |

**The 6 misses** are all between 3.5 and 4.7 km. They come from two slow-crossing pairs that pass each other several times within a few seconds; the sieve merges those repeated minima into one event.

**The 10 app events the reference does not list** are not false alarms:
- 9 have their closest approach within 11 s of the window edge. The app refines up to one step beyond the window; the reference stops at the window.
- 1 is exactly 5.000 km, on the threshold.

![Screening against the reference](screening-vs-reference.png)

```
NODE_PATH=... T0=2026-11-19T17:30:00Z node tools/screen-catalog.js 2 bench/out/ours_2h.json 5
python3 bench/screen_ref.py cat.json 2026-11-19T17:30:00Z 2 5 bench/out/ref_2h.json
python3 bench/compare_screen.py bench/out/ours_2h.json bench/out/ref_2h.json
```

## 3. Against a live operational product: CelesTrak SOCRATES (daily, on GitHub)

`.github/workflows/daily.yml` runs every day on GitHub's servers. It:
1. downloads the current catalogue from CelesTrak, about 30,000 objects including debris;
2. screens the next 24 hours with the brute-force screener (5 minutes);
3. compares the result with SOCRATES, CelesTrak's public conjunction report;
4. saves the comparison in `data/history/`.

First run, 21–22 Nov 2026, passes under 5 km:

| | Result |
|---|---|
| SOCRATES crossings in the window | 12,752 (plus 200 formation pairs, which we skip by design) |
| Also found by our screen | 6,562 (51%) |
| SOCRATES crossings under 1 km | 523, of which we found 311 (59%) |
| Same event found by both: time of closest approach | median difference 0.11 s |
| Same event found by both: miss distance | median difference 0.31 km, 95th percentile 2.4 km |

Where both screens see the same encounter, they agree closely. But half of SOCRATES' crossings are not in our list at all, including some it puts at tens of metres.

Our screen finds 99.8% of what our own data contains (section 2), so the gap must come from the input data. The likely cause is not yet confirmed: SOCRATES may use element sets we do not, such as operator-supplied supplemental GP data for constellations like Starlink, or element sets fetched at a different time of day. That is the next thing to test. The daily history will show whether the gap is stable.

## What this does not show

- **TLE accuracy.** Public two-line elements are typically off by hundreds of metres to a few kilometres after a day, more for debris and manoeuvring satellites. These checks prove the screen is faithful to the TLEs, not that the TLEs are right. Operators screen with owner ephemerides and covariance from the Space Force's 18th Space Defense Squadron or a commercial provider.
- **Collision probability.** The app's probability is an isotropic-Gaussian estimate with an assumed 1 km position uncertainty. TLEs carry no covariance, so a proper Pc (Foster, Alfano or Monte Carlo methods) cannot be computed from this data.
