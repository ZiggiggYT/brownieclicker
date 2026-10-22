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

  // Scene positions (in scene pixels) that customers walk between.
  const SPOTS = [196, 218, 240]; // queue spots right of the counter, front first
  const DOOR_X = 262;
  const GONE_X = 300;
  const WALK = 3;                // scene px per tick

  BB.SCENE = { SPOTS, DOOR_X };

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
      v: 1,
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
      fix: {},
      recipes: { classic: true },
      recipe: 'classic',
      day: 1,
      dayT: 0,
      open: true,
      nightT: 0,
      daySold: 0,
      dayEarned: 0,
      lastDay: null,
      staleT: 0,
      customers: [],
      cid: 0,
      order: null,
      orderIdx: 0,
      orderCd: D.ORDER_GAP,
      golden: null,
      goldenCd: 600,
      rush: 0,
      goal: 0,
      flags: {},
      fx: [],
    };
    D.helpers.forEach(h => { s.helpers[h.id] = 0; });
    D.fixes.forEach(f => { s.fix[f.id] = false; });
    return s;
  };

  // ------------------------------------------------------------ derived values
  BB.recipe = s => D.recipes.find(r => r.id === s.recipe) || D.recipes[0];
  BB.stalePrice = s => Math.max(1, Math.floor(BB.recipe(s).price / 2));
  BB.stock = s => s.fresh + s.stale;
  BB.mult = s => (s.rush > 0 ? 3 : 1);
  BB.perClick = s => (1 + s.helpers.nap) * BB.mult(s);
  BB.bakeRate = s => D.helpers.reduce((sum, h) => sum + (h.rate || 0) * s.helpers[h.id], 0) * BB.mult(s);
  BB.helperPrice = (s, h) => (h.repeat ? Math.ceil(h.price * Math.pow(D.PRICE_GROWTH, s.helpers[h.id])) : h.price);
  BB.spawnChance = s => 0.01 + s.stars * 0.003 + (s.fix.sign ? 0.004 : 0) + (s.fix.tables ? 0.006 : 0);
  BB.dayFrac = s => (s.open ? s.dayT / D.DAY_TICKS : 1);
  BB.orderReward = s => (s.order ? Math.round(s.order.qty * BB.recipe(s).price * 1.5) : 0);
  BB.currentGoal = s => D.goals[s.goal] || null;

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

  // Take n brownies from the tray, fresh first. Returns [fresh, stale] taken.
  function take(s, n) {
    const f = Math.min(n, s.fresh);
    const st = Math.min(n - f, s.stale);
    s.fresh -= f;
    s.stale -= st;
    return [f, st];
  }

  // ------------------------------------------------------------ one tick
  function step(s) {
    s.t++;

    // Helpers bake all the time, even at night.
    s.bakeAcc += BB.bakeRate(s) / 10;
    if (s.bakeAcc >= 1) {
      const n = Math.floor(s.bakeAcc);
      s.bakeAcc -= n;
      addBaked(s, n);
    }

    if (s.rush > 0 && --s.rush === 0) emit(s, { k: 'rushEnd' });

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

    stepCustomers(s);
    stepOrder(s);
    stepGolden(s);
    checkGoal(s);
    return s;
  }

  function closeShop(s) {
    s.open = false;
    s.nightT = D.NIGHT_TICKS;
    s.lastDay = { day: s.day, sold: s.daySold, earned: s.dayEarned };
    s.stale += s.fresh; // unsold fresh brownies go stale overnight
    s.fresh = 0;
    s.golden = null;
    s.customers.forEach(c => { if (c.st !== 'out') { c.st = 'out'; c.mood = null; } });
    emit(s, { k: 'dayEnd', day: s.day, sold: s.daySold, earned: s.dayEarned });
  }

  function openShop(s) {
    s.open = true;
    s.day++;
    s.dayT = 0;
    s.nightT = 0;
    s.daySold = 0;
    s.dayEarned = 0;
    emit(s, { k: 'dayStart', day: s.day });
  }

  function stepCustomers(s) {
    let queued = 0;
    for (const c of s.customers) if (c.st !== 'out') queued++;
    if (s.open && queued < SPOTS.length && rand(s) < BB.spawnChance(s)) {
      s.customers.push({
        id: ++s.cid,
        look: D.customers[Math.floor(rand(s) * D.customers.length)],
        x: DOOR_X,
        st: 'in',
        t: 0,
        want: rand(s) < 0.5 ? 1 : 2,
        mood: null,
      });
      emit(s, { k: 'custIn' });
    }

    let qi = 0;
    const waitTicks = s.helpers.linda ? 4 : 12;
    for (const c of s.customers) {
      if (c.st === 'out') { c.x += WALK; continue; }
      const front = qi === 0;
      const tx = SPOTS[qi++];
      if (c.x > tx) { // still walking up the queue
        c.x = Math.max(tx, c.x - WALK);
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
    const [f, st] = take(s, c.want);
    const amt = f * BB.recipe(s).price + st * BB.stalePrice(s);
    earn(s, amt);
    s.totalSold += f + st;
    s.daySold += f + st;
    addStars(s, f > 0 ? 0.006 : 0.002);
    c.st = 'out';
    c.mood = 'happy';
    emit(s, { k: 'sale', id: c.id, amt, n: f + st });
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
      const loop = Math.floor(s.orderIdx / D.orders.length);
      s.order = { who: base.who, look: base.look, qty: base.qty * (1 + loop), t: D.ORDER_TIME, dur: D.ORDER_TIME };
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
    const g = D.goals[s.goal];
    if (!g) return;
    const [have, need] = g.have(s);
    if (have >= need) {
      earn(s, g.reward);
      s.goal++;
      emit(s, { k: 'goal', text: g.text, reward: g.reward, last: s.goal >= D.goals.length });
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
      const h = D.helpers.find(x => x.id === id);
      if (!h || (!h.repeat && s.helpers[id] > 0)) return false;
      const price = BB.helperPrice(s, h);
      if (s.coins < price) return false;
      s.coins -= price;
      s.helpers[id]++;
      emit(s, { k: 'buy', banner: h.banner });
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
      addStars(s, 0.25);
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
      if (rand(s) < 0.5) {
        s.rush = D.RUSH_TICKS;
        emit(s, { k: 'rush', x, y });
      } else {
        const bonus = Math.floor(25 + s.coins * 0.1);
        earn(s, bonus);
        emit(s, { k: 'bonus', amt: bonus, x, y });
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
