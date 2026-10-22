// Pacing check: a simple bot player. Every 3 hours it plays for 20 minutes
// (clicks 3 times a second, catches golden brownies, fills special orders),
// then leaves the game open. Every 5 s it buys the cheapest thing it can.
// Prints when each purchase and goal happens.  node tools/pacing.js [hours]
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ctx = { console, JSON, Math, Date };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/version.js', 'js/data.js', 'js/sim.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
const BB = ctx.BB;
const D = BB.DATA;
const HOURS = +process.argv[2] || 10;
const ACTIVE_MIN = 20;

function options(s) {
  const out = [];
  // Like a kid following the in-game hint: when the tray overflows, skip the bakers.
  const skipBakers = BB.overflowing(s);
  D.helpers.forEach(h => {
    if (skipBakers && (h.rate || h.id === 'nap') && s.coins < 20 * BB.helperPrice(s, h)) return; // unless rich
    const hb = BB.helperBlock(s, h);
    if (hb === '' || hb === 'coins') out.push({ name: h.name + ' #' + (s.helpers[h.id] + 1), price: BB.helperPrice(s, h), buy: () => BB.act.buyHelper(s, h.id) });
    (h.upgrades || []).forEach(u => {
      const b = BB.upgradeBlock(s, u.id);
      if (b === '' || b === 'coins') out.push({ name: u.name, price: u.price, buy: () => BB.act.buyUpgrade(s, u.id) });
    });
  });
  D.customerUps.forEach(u => { if (!s.cust[u.id] && (!u.after || s.cust[u.after])) out.push({ name: u.name, price: u.price, buy: () => BB.act.buyCust(s, u.id) }); });
  D.fixes.forEach(f => { if (!s.fix[f.id]) out.push({ name: f.name, price: f.price, buy: () => BB.act.buyFix(s, f.id) }); });
  D.recipes.forEach(r => { if (!s.recipes[r.id] && s.stars >= r.stars && (!r.after || s.fix[r.after])) out.push({ name: 'Recipe ' + r.name, price: r.cost, buy: () => BB.act.unlockRecipe(s, r.id) }); });
  return out.sort((a, b) => a.price - b.price);
}

let s = BB.newState(1);
s.rebirths = +process.env.REBIRTHS || 0;
const fmt = t => { const m = Math.floor(t / 600); return String(Math.floor(m / 60)).padStart(2) + 'h' + String(m % 60).padStart(2, '0'); };
let lastBuy = 0;
const gaps = [];
for (let t = 0; t < HOURS * 36000; t++) {
  s = BB.simN(s, 1);
  if (t % (3 * 36000) < ACTIVE_MIN * 600) {
    if (t % 3 === 0) BB.act.bake(s);
    if (s.golden) BB.act.catchGolden(s);
    if (t % 600 === 0 && !s.flags.pet) BB.act.pet(s);
    if (s.order && BB.stock(s) >= s.order.qty) BB.act.give(s);
  }
  if (t % 50 === 0) {
    const o = options(s)[0];
    if (o && s.coins >= o.price) {
      o.buy();
      if (!/#/.test(o.name) || /#1$/.test(o.name)) console.log(fmt(t), ' buy  ', o.name.padEnd(26), '$' + o.price);
      gaps.push(t - lastBuy); lastBuy = t;
    }
  }
  for (const e of s.fx) if (e.k === 'goal') console.log(fmt(t), ' GOAL ', e.text);
  for (const e of s.fx) if (e.k === 'megaFull') { console.log(fmt(t), ' **** MEGAMUFFIN BAR FULL: ENDING ****'); if (process.env.STOP) break; }
  if (process.env.STARS && t % 6000 === 0) console.log(fmt(t), ' stars', s.stars.toFixed(2), 'sold', s.totalSold, 'orders', s.ordersDone);
  s.fx = [];
  if (t % 36000 === 35999) console.log(fmt(t), ' ---- stars', s.stars.toFixed(2), 'coins', Math.floor(s.coins), 'earned/h so far', Math.floor(s.totalEarned / ((t + 1) / 36000)),
    'bake/s', BB.baseBakeRate(s), 'deliver/s', BB.deliverRate(s), 'mega', Math.round(BB.megaProgress(s) * 100) + '%');
}
const longest = Math.max(...gaps) / 600;
console.log('purchases:', gaps.length, 'longest wait between purchases:', longest.toFixed(1), 'min');
