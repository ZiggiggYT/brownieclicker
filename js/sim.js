// Brownie Baker simulation.
//
// The whole game advances in 0.1 s ticks. `BB.sim(state)` returns the next
// state and depends only on the state it is given (randomness comes from the
// seed stored in the state), so the exact same code runs live play and the
// "while you were away" catch-up. Player actions live in `BB.act`.
//
// The sim never touches the DOM. It reports things worth showing (a sale, a
// banner, a sound) by pushing small event objects onto `state.fx`, which the
// renderer and UI drain each frame.
(function () {
  const D = BB.DATA;
  const STATE_VERSION = 2;

  // Queue spots in scene pixels, front first: three along the counter, then the
  // line bends forward when Bigger Line upgrades make room for more.
  const SPOTS = [[196, 160], [218, 160], [240, 160], [228, 174], [204, 176]];
  const DOOR = [262, 160];
  const EXIT_Y = 166;
  const GONE_X = 300;
  const WALK = 3; // scene px per tick

  BB.SCENE = { SPOTS, DOOR };

  function rand(s) { // mulberry32 on s.seed
    let t = (s.seed = (s.seed + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function emit(s, e) {
    s.fx.push(e);
    if (s.fx.length > 300) s.fx.shift();
  }

  BB.newState = function (seed) {
    const s = {
      v: STATE_VERSION,
      seed: (seed == null ? Date.now() : seed) | 0,
      t: 0,
      coins: 0,
      fresh: 1, // your very first brownie
      stale: 0,
      bakeAcc: 0,
      totalBaked: 1,
      totalSold: 0,
      totalEarned: 0,
      clicks: 0,
      stars: D.START_STARS,
      helpers: {},
      ups: {},     // worker upgrades owned, by id
      cust: {},    // customer upgrades owned, by id
      fix: {},
      recipes: { classic: true },
      recipe: 'classic',
      day: 1,
      dayT: 0,
      open: true,
      nightT: 0,
      daySold: 0,
      dayEarned: 0,
      dayTips: 0,
      bestDay: 0,
      lastDay: null,
      staleT: 0,
      customers: [],
      cid: 0,
      delAcc: 0,   // deliveries owed but not yet made
      delAmt: 0,   // delivery money since the last "+$" popup
      delN: 0,
      delT: 0,
      order: null,
      orderIdx: 0,
      ordersDone: 0,
      orderCd: D.ORDER_GAP,
      golden: null,
      goldenCd: 600,
      rush: 0,
      parade: 0,
      goalsDone: {},
      flags: {},
      fx: [],
    };
    D.helpers.forEach(h => { s.helpers[h.id] = 0; });
    D.fixes.forEach(f => { s.fix[f.id] = false; });
    return s;
  };

  // Load a saved state from any version: merge it onto a fresh state (so new
  // fields get their defaults), then upgrade older layouts step by step.
  BB.migrate = function (saved) {
    const s = BB.newState(saved.seed);
    for (const k of Object.keys(saved)) {
      if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && saved[k] && typeof saved[k] === 'object') {
        Object.assign(s[k], saved[k]);
      } else {
        s[k] = saved[k];
      }
    }
    if ((saved.v || 1) < 2) {
      // v1 tracked goals by position in its list of 19.
      D.V1_GOALS.slice(0, saved.goal || 0).forEach(id => { s.goalsDone[id] = true; });
      delete s.goal;
      // v1 customers only walked left and right.
      s.customers.forEach(c => { c.y = c.st === 'out' ? EXIT_Y : DOOR[1]; });
    }
    s.v = STATE_VERSION;
    s.fx = [];
    return s;
  };

  // ------------------------------------------------------------ derived values
  const helper = id => D.helpers.find(h => h.id === id);
  BB.findUpgrade = id => {
    for (const h of D.helpers) for (const u of h.upgrades || []) if (u.id === id) return [h, u];
    return [null, null];
  };
  BB.recipe = s => D.recipes.find(r => r.id === s.recipe) || D.recipes[0];
  BB.stalePrice = s => Math.max(1, Math.floor(BB.recipe(s).price / 2));
  BB.stock = s => s.fresh + s.stale;
  BB.mult = s => (s.rush > 0 ? 3 : 1);
  // Product of the owned upgrade multipliers for one worker.
  BB.upMult = (s, id) => (helper(id).upgrades || []).reduce((m, u) => (s.ups[u.id] && u.mult ? m * u.mult : m), 1);
  BB.perClick = s => (1 + s.helpers.nap) * BB.upMult(s, 'nap') * BB.mult(s);
  BB.helperRate = (s, h) => (h.rate || 0) * s.helpers[h.id] * BB.upMult(s, h.id);
  BB.baseBakeRate = s => D.helpers.reduce((sum, h) => sum + BB.helperRate(s, h), 0);
  BB.bakeRate = s => BB.baseBakeRate(s) * BB.mult(s);
  BB.deliverRate = s => D.helpers.reduce((sum, h) => sum + (h.sells || 0) * s.helpers[h.id] * BB.upMult(s, h.id), 0);
  BB.helperPrice = (s, h) => (h.repeat ? Math.ceil(h.price * Math.pow(D.PRICE_GROWTH, s.helpers[h.id])) : h.price);
  BB.queueSize = s => D.customerUps.reduce((n, u) => (s.cust[u.id] && u.queue ? Math.max(n, u.queue) : n), 3);
  BB.visits = s => D.customerUps.reduce((v, u) => (s.cust[u.id] && u.visits ? v + u.visits : v), 1);
  BB.lunchRush = s => !!(s.cust.rush && s.open && BB.dayFrac(s) >= D.LUNCH[0] && BB.dayFrac(s) < D.LUNCH[1]);
  BB.spawnChance = s => Math.min(0.3,
    (0.01 + s.stars * 0.003 + (s.fix.sign ? 0.004 : 0) + (s.fix.tables ? 0.006 : 0)) *
    BB.visits(s) * (BB.lunchRush(s) ? 3 : 1) * (s.parade > 0 ? 4 : 1));
  // The tray holds more than a few minutes of sales: more bakers won't help, more customers will.
  BB.overflowing = s => BB.stock(s) > 300 && BB.stock(s) > BB.baseBakeRate(s) * 120;
  BB.waitTicks = s => (s.ups.register ? 1 : s.helpers.linda ? 4 : 12);
  BB.dayFrac = s => (s.open ? s.dayT / D.DAY_TICKS : 1);
  BB.orderReward = s => (s.order ? Math.round(s.order.qty * BB.recipe(s).price * 1.5) : 0);
  BB.currentGoal = s => D.goals.find(g => !s.goalsDone[g.id]) || null;

  // Stars from customers and orders get harder to earn the more you have, so the
  // later recipes (which need stars) take a few school days, not one afternoon.
  function earnStars(s, d) {
    const k = Math.max(0.12, 1 - (s.stars - 0.5) / 4.8);
    addStars(s, d * k * k);
  }

  function addStars(s, d) {
    s.stars = Math.min(D.MAX_STARS, Math.max(D.MIN_STARS, s.stars + d));
  }

  function earn(s, amt) {
    s.coins += amt;
    s.totalEarned += amt;
    s.dayEarned += amt;
  }

  function addBaked(s, n) {
    s.fresh += n;
    s.totalBaked += n;
  }

  // Take up to n brownies from the tray, fresh first. Returns [fresh, stale] taken.
  function take(s, n) {
    const f = Math.min(n, s.fresh);
    const st = Math.min(n - f, s.stale);
    s.fresh -= f;
    s.stale -= st;
    return [f, st];
  }

  // Sell up to n brownies from the tray at today's prices. Returns [count, money].
  function sellFromTray(s, n) {
    const [f, st] = take(s, n);
    const amt = f * BB.recipe(s).price + st * BB.stalePrice(s);
    earn(s, amt);
    s.totalSold += f + st;
    s.daySold += f + st;
    return [f + st, amt, f];
  }

  // ------------------------------------------------------------ one tick
  function step(s) {
    s.t++;
    const wasLunch = BB.lunchRush(s);

    // Helpers bake all the time, even at night.
    s.bakeAcc += BB.bakeRate(s) / 10;
    if (s.bakeAcc >= 1) {
      const n = Math.floor(s.bakeAcc);
      s.bakeAcc -= n;
      addBaked(s, n);
    }

    if (s.rush > 0 && --s.rush === 0) emit(s, { k: 'rushEnd' });
    if (s.parade > 0) s.parade--;

    // Gentle staleness: only bites when the tray is overflowing.
    s.staleT++;
    if (s.staleT >= D.STALE_EVERY * (s.fix.case ? 2 : 1)) {
      s.staleT = 0;
      if (s.fresh > 10) {
        const n = Math.max(1, Math.floor(s.fresh * 0.1));
        s.fresh -= n;
        s.stale += n;
      }
    }

    if (s.open) {
      if (++s.dayT >= D.DAY_TICKS) closeShop(s);
    } else if (--s.nightT <= 0) {
      openShop(s);
    }
    if (!wasLunch && BB.lunchRush(s)) emit(s, { k: 'lunch' });

    stepDeliveries(s);
    stepCustomers(s);
    stepOrder(s);
    stepGolden(s);
    checkGoal(s);
    return s;
  }

  function closeShop(s) {
    s.open = false;
    s.nightT = D.NIGHT_TICKS;
    const record = s.day > 1 && s.dayEarned > s.bestDay;
    s.bestDay = Math.max(s.bestDay, s.dayEarned);
    s.lastDay = { day: s.day, sold: s.daySold, earned: s.dayEarned, tips: s.dayTips, record };
    s.stale += s.fresh; // unsold fresh brownies go stale overnight
    s.fresh = 0;
    s.golden = null;
    s.customers.forEach(c => { if (c.st !== 'out') { c.st = 'out'; c.mood = null; } });
    emit(s, { k: 'dayEnd', day: s.day, sold: s.daySold, earned: s.dayEarned, record });
  }

  function openShop(s) {
    s.open = true;
    s.day++;
    s.dayT = 0;
    s.nightT = 0;
    s.daySold = 0;
    s.dayEarned = 0;
    s.dayTips = 0;
    emit(s, { k: 'dayStart', day: s.day });
  }

  // Delivery bikes sell straight from the tray while the shop is open.
  function stepDeliveries(s) {
    const rate = BB.deliverRate(s);
    if (!rate || !s.open) return;
    s.delAcc = Math.min(s.delAcc + rate / 10, rate + 1); // no huge backlog when the tray is empty
    const n = Math.min(Math.floor(s.delAcc), BB.stock(s));
    if (n > 0) {
      const [sold, amt] = sellFromTray(s, n);
      s.delAcc -= sold;
      s.delAmt += amt;
      s.delN += sold;
    }
    if (++s.delT >= 50) { // one "+$" popup every 5 s, not one per brownie
      if (s.delAmt) emit(s, { k: 'deliver', amt: s.delAmt, n: s.delN });
      s.delT = 0;
      s.delAmt = 0;
      s.delN = 0;
    }
  }

  function stepCustomers(s) {
    let queued = 0;
    for (const c of s.customers) if (c.st !== 'out') queued++;
    const room = Math.min(BB.queueSize(s), SPOTS.length);
    if (s.open && queued < room && rand(s) < BB.spawnChance(s)) {
      let want = rand(s) < 0.5 ? 1 : 2;
      let box = false;
      want += Math.floor(s.stars / 2); // a famous bakery sells more per visit
      if (s.cust.party && rand(s) < D.PARTY_CHANCE) { want = 6; box = true; }
      if (s.cust.samples) want += 1;
      if (s.ups.smile && rand(s) < 0.3) want += 1;
      s.customers.push({
        id: ++s.cid,
        look: D.customers[Math.floor(rand(s) * D.customers.length)],
        x: DOOR[0],
        y: DOOR[1],
        st: 'in',
        t: 0,
        want,
        box,
        mood: null,
      });
      emit(s, { k: 'custIn' });
    }

    let qi = 0;
    const waitTicks = BB.waitTicks(s);
    for (const c of s.customers) {
      if (c.st === 'out') {
        c.x += WALK;
        c.y += Math.sign(EXIT_Y - c.y);
        continue;
      }
      const front = qi === 0;
      const [tx, ty] = SPOTS[qi++];
      if (c.x !== tx || c.y !== ty) { // still walking up the line
        c.x = c.x > tx ? Math.max(tx, c.x - WALK) : Math.min(tx, c.x + WALK);
        c.y = c.y > ty ? Math.max(ty, c.y - 2) : Math.min(ty, c.y + 2);
        continue;
      }
      c.st = 'wait';
      if (!front) continue;
      if (c.t === 0) emit(s, { k: 'arrive', id: c.id });
      c.t++;
      if (BB.stock(s) > 0) {
        if (c.t >= waitTicks) sell(s, c);
      } else if (c.t === 30) {
        emit(s, { k: 'hello', id: c.id });
      } else if (c.t >= 60) {
        c.st = 'out';
        c.mood = 'sad';
        addStars(s, -0.02);
        emit(s, { k: 'aww', id: c.id });
      }
    }
    if (s.customers.length && s.customers[0].x >= GONE_X) s.customers = s.customers.filter(c => c.x < GONE_X);
  }

  function sell(s, c) {
    const [n, amt, fresh] = sellFromTray(s, c.want);
    let tip = 0;
    if (s.cust.tipjar && rand(s) < D.TIP_CHANCE) {
      tip = Math.max(1, Math.round(amt * 0.5));
      earn(s, tip);
      s.dayTips++;
    }
    earnStars(s, (fresh > 0 ? 0.006 : 0.002) * (s.ups.smile ? 1.5 : 1));
    c.st = 'out';
    c.mood = 'happy';
    c.box = c.box && n >= 6;
    emit(s, { k: 'sale', id: c.id, amt, n, tip, box: c.box });
  }

  function stepOrder(s) {
    if (s.order) {
      if (--s.order.t <= 0) {
        emit(s, { k: 'orderGone', who: s.order.who });
        s.order = null;
        s.orderIdx++;
        s.orderCd = D.ORDER_GAP;
      }
    } else if (s.open && --s.orderCd <= 0) {
      const base = D.orders[s.orderIdx % D.orders.length];
      // Each time round the list, orders get bigger (up to 10x).
      const loop = Math.min(9, Math.floor(s.orderIdx / D.orders.length));
      const qty = base.qty * (1 + loop);
      s.order = { who: base.who, look: base.look, qty, t: D.ORDER_TIME, dur: D.ORDER_TIME };
      emit(s, { k: 'orderNew', who: base.who });
    }
  }

  function stepGolden(s) {
    if (s.golden) {
      if (--s.golden.t <= 0) s.golden = null;
    } else if (s.open && --s.goldenCd <= 0) {
      s.golden = { x: 20 + Math.floor(rand(s) * 230), y: 18 + Math.floor(rand(s) * 80), t: D.GOLDEN_LIFE };
      s.goldenCd = 700 + Math.floor(rand(s) * 400); // ~once every 90 s
      emit(s, { k: 'goldenIn' });
    }
  }

  function checkGoal(s) {
    const g = BB.currentGoal(s);
    if (!g) return;
    const [have, need] = g.have(s);
    if (have >= need) {
      earn(s, g.reward);
      s.goalsDone[g.id] = true;
      emit(s, { k: 'goal', text: g.text, reward: g.reward, last: !BB.currentGoal(s) });
    }
  }

  // ------------------------------------------------------------ public sim API
  const clone = s => JSON.parse(JSON.stringify(s));

  // sim(state) -> next state, one 0.1 s tick later. Does not modify its input.
  BB.sim = function (state) {
    return step(clone(state));
  };

  // Advance n ticks (one copy, then n steps in place). Used every frame and for catch-up.
  BB.simN = function (state, n) {
    const s = clone(state);
    for (let i = 0; i < n; i++) step(s);
    return s;
  };

  // Can this worker upgrade be bought? Returns '' or a short reason.
  BB.upgradeBlock = (s, id) => {
    const [h, u] = BB.findUpgrade(id);
    if (!u) return 'missing';
    if (s.ups[id]) return 'owned';
    if (s.helpers[h.id] < Math.max(1, u.needs || 1)) return 'needs';
    if (s.coins < u.price) return 'coins';
    return '';
  };

  // ------------------------------------------------------------ player actions
  // Actions change the live state directly and return true when they did something.
  BB.act = {
    bake(s) {
      const n = BB.perClick(s);
      addBaked(s, n);
      s.clicks++;
      emit(s, { k: 'bake', n });
      checkGoal(s);
      return true;
    },

    buyHelper(s, id) {
      const h = helper(id);
      if (!h || (!h.repeat && s.helpers[id] > 0)) return false;
      const price = BB.helperPrice(s, h);
      if (s.coins < price) return false;
      s.coins -= price;
      s.helpers[id]++;
      emit(s, { k: 'buy', banner: h.banner });
      checkGoal(s);
      return true;
    },

    buyUpgrade(s, id) {
      if (BB.upgradeBlock(s, id)) return false;
      const [, u] = BB.findUpgrade(id);
      s.coins -= u.price;
      s.ups[id] = true;
      emit(s, { k: 'buy', banner: u.banner });
      checkGoal(s);
      return true;
    },

    buyCust(s, id) {
      const u = D.customerUps.find(x => x.id === id);
      if (!u || s.cust[id] || (u.after && !s.cust[u.after]) || s.coins < u.price) return false;
      s.coins -= u.price;
      s.cust[id] = true;
      emit(s, { k: 'buy', banner: u.banner });
      checkGoal(s);
      return true;
    },

    buyFix(s, id) {
      const f = D.fixes.find(x => x.id === id);
      if (!f || s.fix[id] || s.coins < f.price) return false;
      s.coins -= f.price;
      s.fix[id] = true;
      if (f.stars) addStars(s, f.stars);
      emit(s, { k: 'buy', banner: f.banner });
      checkGoal(s);
      return true;
    },

    unlockRecipe(s, id) {
      const r = D.recipes.find(x => x.id === id);
      if (!r) return false;
      if (s.recipes[id]) { // already unlocked: switch to it
        if (s.recipe === id) return false;
        s.recipe = id;
        emit(s, { k: 'recipe', id });
        return true;
      }
      if (s.stars < r.stars || s.coins < r.cost) return false;
      s.coins -= r.cost;
      s.recipes[id] = true;
      s.recipe = id;
      emit(s, { k: 'buy', banner: 'NEW RECIPE: ' + r.name.toUpperCase() + '!' });
      checkGoal(s);
      return true;
    },

    give(s) {
      if (!s.order || BB.stock(s) < s.order.qty) return false;
      const reward = BB.orderReward(s);
      take(s, s.order.qty);
      s.totalSold += s.order.qty;
      s.daySold += s.order.qty;
      earn(s, reward);
      earnStars(s, D.ORDER_STARS);
      s.ordersDone++;
      emit(s, { k: 'orderDone', who: s.order.who, reward });
      s.order = null;
      s.orderIdx++;
      s.orderCd = D.ORDER_GAP;
      checkGoal(s);
      return true;
    },

    catchGolden(s) {
      if (!s.golden) return false;
      const { x, y } = s.golden;
      s.golden = null;
      s.flags.golden = true;
      const r = rand(s);
      if (r < 0.4) {
        s.rush = D.RUSH_TICKS;
        emit(s, { k: 'rush', x, y });
      } else if (r < 0.8) {
        const bonus = Math.floor(25 + s.coins * 0.1);
        earn(s, bonus);
        emit(s, { k: 'bonus', amt: bonus, x, y });
      } else {
        s.parade = D.RUSH_TICKS; // a crowd of customers for 15 s
        emit(s, { k: 'parade', x, y });
      }
      checkGoal(s);
      return true;
    },

    pet(s) {
      s.flags.pet = true;
      emit(s, { k: 'meow' });
      checkGoal(s);
      return true;
    },

    startDay(s) {
      if (s.open) return false;
      openShop(s);
      return true;
    },
  };
})();
