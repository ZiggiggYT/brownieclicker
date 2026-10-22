// Headless checks for the simulation: node tools/test_sim.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ctx = { window: {}, console, JSON, Math, Date };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/data.js', 'js/sim.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
const BB = ctx.BB;
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };

// Pure: sim does not modify its input, and is deterministic.
const a = BB.newState(42);
const a0 = JSON.stringify(a);
const b1 = BB.sim(a);
check(JSON.stringify(a) === a0, 'sim(state) leaves its input untouched');
check(JSON.stringify(BB.simN(a, 500)) === JSON.stringify(BB.simN(a, 500)), 'same seed gives the same result');
check(b1.t === 1, 'one tick advances t');

// A fresh shop left alone for an hour.
let s = BB.simN(BB.newState(1), 36000);
check(s.day >= 20, 'an hour covers ~20 days (day ' + s.day + ')');
check(s.stars >= 0.5, 'stars never drop below 0.5 (' + s.stars.toFixed(2) + ')');

// A shop with helpers earns money while away.
s = BB.newState(7);
s.helpers.coffee = 3; s.helpers.dave = 2; s.fresh = 30;
const before = s.totalEarned;
s = BB.simN(s, 36000);
check(s.totalEarned - before > 500, 'helpers keep the bakery earning (+$' + (s.totalEarned - before) + ')');
check(s.fresh >= 0 && s.stale >= 0, 'stock never negative');
check(s.goal > 0, 'goals complete on their own (goal ' + s.goal + ')');

// Buying and orders.
s = BB.newState(3); s.coins = 100;
check(BB.act.buyHelper(s, 'nap') && s.coins === 85 && BB.perClick(s) === 2, 'Stop Napping costs 15 and adds +1 per click');
check(BB.helperPrice(s, BB.DATA.helpers[0]) === 18, 'repeatable price grows x1.2');
BB.act.bake(s);
check(s.fresh === 3, 'clicking bakes 1 + Stop Napping');
s.order = { who: 'Pip', look: 'pip_happy', qty: 2, t: 900, dur: 900 };
const c0 = s.coins;
check(BB.act.give(s) && s.coins === c0 + 3 && s.order === null, 'special order pays qty x price x 1.5');

// Day rollover makes fresh brownies stale and starts a new day by itself.
s = BB.newState(5); s.fresh = 50; s.dayT = BB.DATA.DAY_TICKS - 1;
s = BB.simN(s, 1);
check(!s.open && s.fresh === 0 && s.stale >= 40, 'closing turns fresh stale');
s = BB.simN(s, BB.DATA.NIGHT_TICKS + 1);
check(s.open && s.day === 2, 'next day starts by itself');

// Speed of a full hour catch-up.
const t0 = Date.now(); BB.simN(BB.newState(9), 36000);
check(Date.now() - t0 < 1500, 'one hour of catch-up runs fast (' + (Date.now() - t0) + ' ms)');

// Release version: index.html's ?v= strings must match js/version.js (tools/bump_version.py keeps them in sync).
const root = path.join(__dirname, '..');
const version = /BB\.VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'js/version.js'), 'utf8'))[1];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const vs = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
check(vs.length >= 10 && vs.every(v => v === version), 'index.html cache-busting matches version ' + version);
check(/src="js\/(\w+)\.js"/.test(html) === false && !/href="css\/style\.css"/.test(html), 'every css/js link is versioned');
process.exit(fails ? 1 : 0);
