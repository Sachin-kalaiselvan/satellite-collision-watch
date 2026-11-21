// CI check: satellite.js must reproduce Vallado's SGP4 verification states to 1 mm.
const { execFileSync } = require('child_process'), path = require('path');
const dir = execFileSync('python3', ['-c', 'import sgp4,os;print(os.path.dirname(sgp4.__file__))']).toString().trim();
execFileSync('node', [path.join(__dirname, '../bench/sgp4_vectors.js'), dir, '/tmp/sgp4_vectors.json'], { stdio: 'inherit' });
const worst = Math.max(...require('/tmp/sgp4_vectors.json').map(o => o.maxPosErr_m));
if (!(worst < 1e-3)) { console.error(`FAIL worst position error ${worst} m`); process.exit(1); }
console.log('PASS SGP4 verification set within 1 mm');
