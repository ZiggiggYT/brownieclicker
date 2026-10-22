// Headless checks for the simulation: node tools/test_sim.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ctx = { window: {}, console, JSON, Math, Date };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/version.js', 'js/data.js', 'js/sim.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
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
check(Object.keys(s.goalsDone).length > 0, 'goals complete on their own (' + Object.keys(s.goalsDone).length + ' done)');

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

// Worker upgrades multiply their worker.
s = BB.newState(11); s.coins = 1e6; s.helpers.dave = 2;
const r0 = BB.bakeRate(s);
check(BB.act.buyUpgrade(s, 'whisk') && BB.bakeRate(s) === r0 + 2, 'Better Whisk doubles Dave');
check(!BB.act.buyUpgrade(s, 'shoes') && BB.upgradeBlock(s, 'shoes') === 'needs', 'Speed Shoes needs 3 Daves');
check(!BB.act.buyUpgrade(s, 'fire'), 'oven upgrades need an oven first');
s.helpers.nap = 1; BB.act.buyUpgrade(s, 'mitts');
check(BB.perClick(s) === 4, 'Oven Mitts double clicks');

// Customer upgrades.
s = BB.newState(12); s.coins = 1e6;
check(BB.queueSize(s) === 3 && !BB.act.buyCust(s, 'line2'), 'Even Bigger Line needs Bigger Line first');
BB.act.buyCust(s, 'line1'); BB.act.buyCust(s, 'line2');
check(BB.queueSize(s) === 5, 'line upgrades make room for 5');
const sp = BB.spawnChance(s); BB.act.buyCust(s, 'window');
check(Math.abs(BB.spawnChance(s) / sp - 1.25) < 1e-9, 'Window Display brings 25% more customers');
s.dayT = Math.round(BB.DATA.DAY_TICKS * 0.3); BB.act.buyCust(s, 'rush');
check(BB.lunchRush(s), 'Rush Hour is on at lunch');
s = BB.newState(13); s.coins = 1e6; s.fresh = 5000; BB.act.buyCust(s, 'tipjar'); BB.act.buyCust(s, 'samples');
s = BB.simN(s, 6000);
check(s.dayTips > 0 || (s.lastDay && s.lastDay.tips > 0), 'tip jar collects tips');
check(s.customers.every(c => c.y >= 150 && c.y <= 180), 'customers stay on the floor');

// Delivery bikes sell from the tray while open.
s = BB.newState(14); s.helpers.bike = 2; s.fresh = 1000;
const sold0 = s.totalSold; s = BB.simN(s, 100);
check(s.totalSold - sold0 >= 9 && s.totalSold - sold0 <= 14, 'two bikes deliver ~1 a second (' + (s.totalSold - sold0) + ' in 10 s)');

// Old v1 saves load and keep their progress.
const v1 = { v: 1, seed: 5, t: 9000, coins: 1234, fresh: 40, stale: 3, bakeAcc: 0.5, totalBaked: 3000, totalSold: 2500,
  totalEarned: 4000, clicks: 300, stars: 2.2, helpers: { nap: 3, coffee: 4, dave: 2, linda: 1, oven: 0 },
  fix: { sweep: true, sign: true, case: false, paint: false, tables: false }, recipes: { classic: true, blondie: true },
  recipe: 'blondie', day: 6, dayT: 400, open: true, nightT: 0, daySold: 30, dayEarned: 60, lastDay: null, staleT: 10,
  customers: [{ id: 9, look: 'mo', x: 218, st: 'wait', t: 0, want: 2, mood: null }], cid: 9, order: null, orderIdx: 3,
  orderCd: 100, golden: null, goldenCd: 300, rush: 0, goal: 13, flags: { pet: true, golden: true }, fx: [] };
const m = BB.migrate(JSON.parse(JSON.stringify(v1)));
check(m.v === 3 && m.rebirths === 0 && !m.beaten && m.coins === 1234 && m.helpers.dave === 2 && m.helpers.bike === 0 && m.recipe === 'blondie', 'v1 save keeps coins, helpers and recipe');
check(m.goalsDone.mint === undefined && m.goalsDone.star2 && m.goalsDone.linda && Object.keys(m.goalsDone).length === 13, 'v1 goal progress carries over');
check(m.customers[0].y === 160 && m.goal === undefined, 'v1 customers get a floor position');
check(BB.simN(m, 3000).coins > 1234, 'migrated save keeps running');

// Kitchen size limits workers; expansions raise it and unlock new workers and recipes.
s = BB.newState(21); s.coins = 1e12;
for (let i = 0; i < 12; i++) BB.act.buyHelper(s, 'coffee');
check(s.helpers.coffee === 10 && BB.helperBlock(s, BB.DATA.helpers[1]) === 'full', 'kitchen holds 10 of a worker');
check(!BB.act.buyHelper(s, 'robot'), 'Brownie Robot needs the Back Room');
BB.act.buyFix(s, 'backroom');
check(BB.act.buyHelper(s, 'coffee') && BB.act.buyHelper(s, 'robot'), 'Back Room makes room and unlocks robots');
s.stars = 5;
check(!BB.act.unlockRecipe(s, 'smores'), "S'mores needs the Second Floor");
BB.act.buyFix(s, 'upstairs');
check(BB.act.unlockRecipe(s, 'smores'), "Second Floor unlocks S'mores");

// The MegaMuffin bar is only full when everything is done.
s = BB.newState(22);
check(BB.megaProgress(s) === 0, 'bar starts empty');
s.totalSold = 1e6; s.stars = 5;
BB.DATA.recipes.forEach(r => { s.recipes[r.id] = true; });
BB.DATA.customerUps.forEach(u => { s.cust[u.id] = true; });
BB.DATA.fixes.forEach(f => { s.fix[f.id] = true; });
check(BB.megaProgress(s) < 1, 'bar not full while worker upgrades are missing (' + BB.megaProgress(s).toFixed(3) + ')');
BB.DATA.helpers.forEach(h => (h.upgrades || []).forEach(u => { s.ups[u.id] = true; }));
check(BB.megaProgress(s) === 1, 'bar full when everything is done');
s = BB.simN(s, 60);
check(s.flags.megaFull && s.fx.some(e => e.k === 'megaFull'), 'filling the bar announces the ending');

// Rebirth: start over with a stacking 1.5x boost.
s.coins = 5e6; s.helpers.dave = 4;
BB.act.beat(s);
const r1 = BB.rebirth(s);
check(r1.rebirths === 1 && r1.coins === 0 && r1.helpers.dave === 0 && !r1.beaten && r1.day === 1, 'rebirth starts a fresh bakery');
const r2 = BB.rebirth(r1);
check(BB.boost(r2) === 2.25, 'rebirth boost stacks (x2.25 after two)');
r2.helpers.dave = 2;
check(BB.bakeRate(r2) === 2 * 2.25 && Math.abs(BB.spawnChance(r2) / BB.spawnChance(Object.assign({}, r2, { rebirths: 0 })) - 2.25) < 1e-9, 'boost multiplies baking and customers');

// A 1.1 (v2) save loads as v3.
const v2 = Object.assign(BB.newState(23), { v: 2 }); delete v2.rebirths; delete v2.beaten; delete v2.helpers.robot; delete v2.helpers.truck;
v2.coins = 777; v2.helpers.dave = 14;
const m2 = BB.migrate(JSON.parse(JSON.stringify(v2)));
check(m2.v === 3 && m2.coins === 777 && m2.helpers.dave === 14 && m2.helpers.robot === 0 && m2.rebirths === 0, 'v2 save migrates (and keeps 14 Daves over the new limit)');

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
