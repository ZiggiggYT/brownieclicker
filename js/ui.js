// DOM side of the bakery: top bar, shop panel, goal / order cards, banners,
// the end-of-day card and popups. Reads the sim state each frame and only
// touches the DOM when something it shows has changed.
(function () {
  const D = BB.DATA;
  const $ = id => document.getElementById(id);
  let A;
  let sheet;
  let handlers;
  let tab = 'helpers';
  let rowCache = {};
  const last = {};
  const bannerQueue = [];
  let bannerBusy = false;
  let frameNo = 0;
  const rate = n => (n >= 100 ? BB.fmt(n) : String(Math.round(n * 10) / 10));

  // A canvas showing one sprite at an integer scale. crop = rows to keep from the top.
  function sprite(name, scale, crop) {
    const f = A[name];
    const c = document.createElement('canvas');
    if (!f) return c;
    const h = crop || f.h;
    c.width = f.w * scale;
    c.height = h * scale;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(sheet, f.x, f.y, f.w, h, 0, 0, f.w * scale, h * scale);
    return c;
  }

  function fillIcons(root) {
    root.querySelectorAll('.ico[data-sprite]').forEach(el => {
      el.textContent = '';
      el.appendChild(sprite(el.dataset.sprite, +el.dataset.scale || 2));
    });
  }

  function setText(el, key, val) {
    if (last[key] !== val) {
      last[key] = val;
      el.textContent = val;
    }
  }

  function clockText(s) {
    const mins = s.open ? 480 + Math.floor((s.dayT / D.DAY_TICKS) * 720 / 5) * 5 : 1200;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const h12 = ((h + 11) % 12) + 1;
    return 'DAY ' + s.day + '  ' + h12 + ':' + String(m).padStart(2, '0') + (h >= 12 ? ' PM' : ' AM');
  }

  // ------------------------------------------------------------ shop rows
  function priceHTML(n) {
    return '<span class="ico" data-sprite="coin" data-scale="2"></span>' + BB.fmt(n);
  }

  // Rows for one tab. cls '' means "you can buy this right now".
  function describeRows(s, which) {
    if (which === 'helpers') {
      const rows = [];
      D.helpers.forEach(h => {
        const n = s.helpers[h.id];
        const block = BB.helperBlock(s, h);
        const ups = h.upgrades || [];
        const shown = {
          after: ['NEEDS ' + String(BB.fixName(h.after)).toUpperCase(), 'dim locked'],
          hired: ['HIRED', 'owned'],
          full: ['KITCHEN FULL! EXPAND IN FIX UP', 'dim locked'],
          coins: [priceHTML(BB.helperPrice(s, h)), 'dim'],
          '': [priceHTML(BB.helperPrice(s, h)), ''],
        }[block];
        rows.push({
          key: 'helper:' + h.id, icon: h.icon, name: h.name, line: h.line,
          count: h.repeat && n ? 'x' + n + (block === 'full' ? ' MAX' : '') : '',
          price: shown[0],
          cls: shown[1],
          badges: ups.filter(u => s.ups[u.id]).map(u => u.icon),
        });
        if (!n) return; // upgrades appear once you own the worker
        let teaser = false;
        ups.forEach(u => {
          if (s.ups[u.id]) return;
          const block = BB.upgradeBlock(s, u.id);
          if (block === 'needs') {
            if (teaser) return; // only tease the next locked one
            teaser = true;
            rows.push({ key: 'up:' + u.id, icon: u.icon, name: u.name, line: u.line, count: '', sub: true,
              price: h.unit ? 'NEEDS ' + u.needs + ' ' + h.unit : 'NEEDS ' + h.name.toUpperCase() + ' x' + u.needs,
              cls: 'dim locked' });
            return;
          }
          rows.push({ key: 'up:' + u.id, icon: u.icon, name: u.name, line: u.line, count: '', sub: true,
            price: priceHTML(u.price), cls: block === 'coins' ? 'dim' : '' });
        });
      });
      return rows;
    }
    // Finished one-time buys sink to the bottom so new things are easy to find.
    const doneLast = rows => rows.filter(r => r.cls !== 'owned').concat(rows.filter(r => r.cls === 'owned'));
    if (which === 'customers') {
      return doneLast(D.customerUps.filter(u => !u.after || s.cust[u.after]).map(u => {
        const owned = s.cust[u.id];
        return {
          key: 'cust:' + u.id, icon: u.icon, name: u.name, line: u.line, count: '',
          price: owned ? 'DONE' : priceHTML(u.price),
          cls: owned ? 'owned' : s.coins < u.price ? 'dim' : '',
        };
      }));
    }
    if (which === 'fixes') {
      return doneLast(D.fixes.map(f => {
        const owned = s.fix[f.id];
        return {
          key: 'fix:' + f.id, icon: f.icon, name: f.name, line: f.line, count: '',
          price: owned ? 'DONE' : priceHTML(f.price),
          cls: owned ? 'owned' : s.coins < f.price ? 'dim' : '',
        };
      }));
    }
    return D.recipes.map(r => {
      const have = !!s.recipes[r.id];
      const starsOk = s.stars >= r.stars;
      let price;
      let cls;
      if (have) {
        price = s.recipe === r.id ? 'ON THE MENU' : 'BAKE THIS';
        cls = s.recipe === r.id ? 'current' : 'owned';
      } else if (!starsOk) {
        price = 'NEEDS ' + r.stars + ' STAR' + (r.stars > 1 ? 'S' : '');
        cls = 'dim locked';
      } else if (r.after && !s.fix[r.after]) {
        price = 'NEEDS ' + String(BB.fixName(r.after)).toUpperCase();
        cls = 'dim locked';
      } else {
        price = priceHTML(r.cost);
        cls = s.coins < r.cost ? 'dim' : '';
      }
      return {
        key: 'recipe:' + r.id, icon: r.sprite,
        name: have || !r.hiddenName ? r.name : r.hiddenName,
        line: 'Sells for $' + r.price + ' each', count: '', price, cls,
      };
    });
  }

  let rowKeys = '';

  function buildRows(s, rows) {
    const box = $('rows');
    box.textContent = '';
    rowCache = {};
    rows.forEach(d => {
      const b = document.createElement('button');
      b.className = 'row';
      b.innerHTML = '<span class="icon"></span><span class="name"><span></span><span class="count"></span></span><span class="line"></span><span class="price"><span class="cost"></span><span class="badges"></span></span>';
      const f = A[d.icon];
      const person = f && f.h === 32;
      b.querySelector('.icon').appendChild(sprite(d.icon, d.sub ? 2 : 3, person ? 21 : 0));
      b.addEventListener('click', () => {
        const [kind, id] = d.key.split(':');
        handlers.buy(kind, id);
      });
      box.appendChild(b);
      rowCache[d.key] = { el: b, sig: '' };
    });
  }

  function updateRows(s) {
    const rows = describeRows(s, tab);
    const keys = rows.map(d => d.key).join(',');
    if (keys !== rowKeys) { // a new upgrade showed up (or went away): rebuild the list
      rowKeys = keys;
      buildRows(s, rows);
    }
    rows.forEach(d => {
      const r = rowCache[d.key];
      if (!r) return;
      const badges = (d.badges || []).join(',');
      const sig = [d.name, d.line, d.count, d.price, d.cls, badges].join('|');
      if (sig === r.sig) return;
      r.sig = sig;
      const el = r.el;
      el.className = 'row ' + (d.sub ? 'sub ' : '') + d.cls;
      el.querySelector('.name span').textContent = d.name;
      el.querySelector('.count').textContent = d.count;
      el.querySelector('.line').textContent = d.line;
      const p = el.querySelector('.cost');
      p.innerHTML = d.price;
      fillIcons(p);
      const bx = el.querySelector('.badges');
      bx.textContent = '';
      (d.badges || []).forEach(name => bx.appendChild(sprite(name, 2)));
    });
  }

  // A dot on each tab that has something you can buy right now.
  function updateTabDots(s) {
    document.querySelectorAll('.tab').forEach(t => {
      const can = describeRows(s, t.dataset.tab).some(d => d.cls === '');
      t.classList.toggle('dot', can);
    });
  }

  // ------------------------------------------------------------ top bar bits
  function drawStars(s) {
    const q = Math.round(s.stars * 4) / 4;
    if (last.stars === q) return;
    last.stars = q;
    const box = $('stars');
    box.textContent = '';
    for (let i = 0; i < 5; i++) {
      const v = s.stars - i;
      box.appendChild(sprite(v >= 0.75 ? 'star' : v >= 0.25 ? 'star_half' : 'star_empty', 2));
    }
    box.title = 'Reputation: ' + s.stars.toFixed(1) + ' / 5 stars';
  }

  function drawSunMoon(s) {
    const night = !s.open || BB.dayFrac(s) > 0.88;
    if (last.night === night) return;
    last.night = night;
    const c = $('sunmoon');
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, c.width, c.height);
    const f = A[night ? 'icon_moon' : 'icon_sun'];
    x.drawImage(sheet, f.x, f.y, f.w, f.h, 0, 0, f.w * 3, f.h * 3);
  }

  // ------------------------------------------------------------ banners
  function nextBanner() {
    if (bannerBusy || !bannerQueue.length) return;
    const b = bannerQueue.shift();
    bannerBusy = true;
    const el = document.createElement('div');
    el.className = 'banner ' + (b.style || '');
    el.textContent = b.text;
    $('banners').appendChild(el);
    if (b.confetti) BB.render.confetti();
    setTimeout(() => {
      el.remove();
      bannerBusy = false;
      nextBanner();
    }, 2400);
  }

  BB.ui = {
    sprite,

    init(img, h) {
      sheet = img;
      A = BB.ATLAS.frames;
      handlers = h;
      fillIcons(document.body);
      document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
        tab = t.dataset.tab;
        document.querySelectorAll('.tab').forEach(o => o.classList.toggle('active', o === t));
        rowKeys = '';
        $('rows').scrollTop = 0;
        updateRows(h.state());
        BB.audio.play('click');
      }));
      $('giveBtn').addEventListener('click', () => h.give());
      $('trashBtn').addEventListener('click', () => h.trash());
      $('startNow').addEventListener('click', () => h.startDay());
      $('menuBtn').addEventListener('click', () => h.menu());
      $('megaBar').addEventListener('click', () => h.mega());
      $('soundBtn').addEventListener('click', () => BB.audio.toggle());
    },

    reset() {
      Object.keys(last).forEach(k => delete last[k]);
      rowCache = {};
      rowKeys = '';
    },

    update(s) {
      setText($('clock'), 'clock', clockText(s));
      setText($('coins'), 'coins', BB.fmt(s.coins));
      drawStars(s);
      drawSunMoon(s);
      updateRows(s);
      if (++frameNo % 15 === 0) updateTabDots(s);

      // tray overflowing hint, and what the bakery is doing
      const over = BB.overflowing(s);
      if (last.over !== over) { last.over = over; $('hint').hidden = !over; }
      const visits = BB.visits(s) * (BB.lunchRush(s) ? 3 : 1);
      const parts = ['BAKING ' + rate(BB.bakeRate(s)) + '/s'];
      if (BB.deliverRate(s)) parts.push('DELIVERING ' + rate(BB.deliverRate(s)) + '/s');
      if (visits > 1) parts.push('VISITS x' + (Math.round(visits * 10) / 10));
      if (s.rebirths) parts.push('REBIRTH BOOST x' + (Math.round(BB.boost(s) * 100) / 100));

      // the Beat MegaMuffin bar
      const mega = BB.megaProgress(s);
      const pct = Math.floor(mega * 100);
      if (last.mega !== pct) {
        last.mega = pct;
        $('megaBar').querySelector('.mega-track i').style.height = pct + '%';
        $('megaPct').textContent = pct + '%';
        $('megaBar').classList.toggle('full', mega >= 1 && !s.beaten);
      }
      if (last.rebirths !== s.rebirths) {
        last.rebirths = s.rebirths;
        $('rebirthBadge').hidden = !s.rebirths;
        $('rebirthCount').textContent = s.rebirths;
        $('rebirthBadge').title = s.rebirths + (s.rebirths === 1 ? ' rebirth' : ' rebirths') + ': x' + BB.boost(s) + ' customers and brownies';
      }
      setText($('stats'), 'stats', parts.join('  ·  '));

      // goal
      const g = BB.currentGoal(s);
      if (g) {
        const [have, need] = g.have(s);
        setText($('goalText'), 'goalText', g.text);
        const pct = Math.floor(Math.min(1, have / need) * 20) * 5;
        if (last.goalPct !== pct) { last.goalPct = pct; $('goalBar').firstChild.style.width = pct + '%'; }
        if (last.goalReward !== g.reward) {
          last.goalReward = g.reward;
          $('goalReward').innerHTML = g.reward ? 'REWARD ' + priceHTML(g.reward) : 'REWARD: THE ENDING!';
          fillIcons($('goalReward'));
        }
      } else {
        setText($('goalText'), 'goalText', s.beaten ? D.ALL_GOALS_REBIRTH : D.ALL_GOALS_DONE);
        $('goalBar').firstChild.style.width = '100%';
        $('goalReward').hidden = true;
      }

      // special order
      const o = s.order;
      const whoKey = o ? o.look : '';
      if (last.who !== whoKey) {
        last.who = whoKey;
        const w = $('orderWho');
        w.textContent = '';
        if (o) w.appendChild(sprite(o.look, 2));
      }
      if (o) {
        setText($('orderText'), 'orderText', o.who + ' wants ' + BB.fmt(o.qty) + ' brownies!');
        $('orderBar').firstChild.style.width = Math.ceil((o.t / o.dur) * 20) * 5 + '%';
        const can = BB.stock(s) >= o.qty;
        setText($('giveBtn'), 'give', 'GIVE +$' + BB.fmt(BB.orderReward(s)));
        if ($('giveBtn').disabled === can) $('giveBtn').disabled = !can;
      } else {
        setText($('orderText'), 'orderText', 'No special orders right now. Someone will ask soon!');
        $('orderBar').firstChild.style.width = '0%';
        setText($('giveBtn'), 'give', 'GIVE');
        $('giveBtn').disabled = true;
      }

      // the Trash Man
      let trashLabel;
      if (s.trashCd > 0) trashLabel = 'BACK IN ' + Math.ceil(s.trashCd / 10) + 's';
      else if (BB.stock(s) <= D.TRASH_FEE) trashLabel = 'NEED 101+';
      else trashLabel = 'DUMP ALL +$' + BB.fmt(BB.trashValue(s));
      setText($('trashBtn'), 'trash', trashLabel);
      const canTrash = s.trashCd <= 0 && BB.stock(s) > D.TRASH_FEE;
      if ($('trashBtn').disabled === canTrash) $('trashBtn').disabled = !canTrash;

      // end of day card
      $('dayCard').hidden = s.open;
      if (!s.open && s.lastDay) {
        setText($('dayTitle'), 'dayTitle', 'DAY ' + s.lastDay.day + ' DONE!');
        const ld = s.lastDay;
        setText($('dayExtra'), 'dayExtra', (ld.record ? 'NEW RECORD DAY! ' : '') + (ld.tips ? ld.tips + (ld.tips === 1 ? ' tip' : ' tips') + ' in the jar' : ''));
        setText($('dayText'), 'dayText', 'You sold ' + BB.fmt(s.lastDay.sold) + (s.lastDay.sold === 1 ? ' brownie' : ' brownies') + ' and earned $' + BB.fmt(s.lastDay.earned));
        setText($('dayCount'), 'dayCount', 'Next day starts in ' + Math.max(1, Math.ceil(s.nightT / 10)) + '...');
      }

      // brownie rush
      const rush = s.rush > 0;
      $('rushBar').hidden = !rush;
      $('sceneWrap').classList.toggle('rush', rush);
      if (rush) $('rushBar').querySelector('i').style.width = Math.ceil((s.rush / D.RUSH_TICKS) * 20) * 5 + '%';
    },

    onEvent(e) {
      switch (e.k) {
        case 'sale': {
          const box = $('coinBox');
          box.classList.remove('bump');
          void box.offsetWidth;
          box.classList.add('bump');
          break;
        }
        case 'buy':
          this.banner(e.banner, '', true);
          break;
        case 'goal':
          this.banner('GOAL DONE! +$' + BB.fmt(e.reward), 'cream', true);
          if (e.last) this.banner('MASTER BAKER!', '', true);
          break;
        case 'rush':
          this.banner('BROWNIE RUSH! x3', '', true);
          break;
        case 'bonus':
          this.banner('GOLDEN BONUS! +$' + BB.fmt(e.amt), '', true);
          break;
        case 'trash':
          this.banner('TRASH MAN TOOK ' + BB.fmt(e.n) + '! +$' + BB.fmt(e.amt), 'cream');
          break;
        case 'megaFull':
          this.banner('MEGAMUFFIN IS DONE FOR! TAP THE BAR!', '', true);
          break;
        case 'lunch':
          this.banner('LUNCH RUSH!', 'pink');
          break;
        case 'parade':
          this.banner('CUSTOMER PARADE!', '', true);
          break;
        case 'orderNew':
          this.banner('NEW SPECIAL ORDER!', 'pink');
          break;
        case 'orderDone':
          this.banner('ORDER DONE! +$' + BB.fmt(e.reward), '', true);
          break;
        case 'dayStart':
          this.banner('DAY ' + e.day + ' · OPEN!', 'cream');
          break;
        default:
          break;
      }
    },

    banner(text, style, confetti) {
      if (bannerQueue.length > 4) bannerQueue.shift();
      bannerQueue.push({ text, style, confetti });
      nextBanner();
    },

    // Popups never pause the game; they just sit on top until closed.
    modal(title, body, buttons) {
      $('modalTitle').textContent = title;
      $('modalBody').textContent = body;
      $('modalBody').hidden = !body;
      const box = $('modalButtons');
      box.textContent = '';
      const openedAt = performance.now();
      buttons.forEach(b => {
        const el = document.createElement('button');
        el.className = 'btn' + (b.alt ? ' alt' : '');
        el.textContent = b.label;
        if (b.focus) el.dataset.focus = '1';
        el.addEventListener('click', () => {
          // ignore taps and key presses that were meant for whatever was on screen just before
          if (performance.now() - openedAt < 600) return;
          BB.audio.play('click');
          if (!b.keepOpen) BB.ui.closeModal();
          b.onClick && b.onClick();
        });
        box.appendChild(el);
      });
      $('modal').hidden = false;
      const first = box.querySelector('[data-focus]') || box.querySelector('.btn');
      if (first) first.focus();
    },

    closeModal() {
      $('modal').hidden = true;
    },

    modalOpen() {
      return !$('modal').hidden;
    },
  };
})();
