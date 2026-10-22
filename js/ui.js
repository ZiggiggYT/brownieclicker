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

  function describeRows(s) {
    if (tab === 'helpers') {
      return D.helpers.map(h => {
        const n = s.helpers[h.id];
        const owned = !h.repeat && n > 0;
        const price = BB.helperPrice(s, h);
        return {
          key: 'helper:' + h.id, icon: h.icon, name: h.name, line: h.line,
          count: h.repeat && n ? 'x' + n : '',
          price: owned ? 'HIRED' : priceHTML(price),
          cls: owned ? 'owned' : s.coins < price ? 'dim' : '',
        };
      });
    }
    if (tab === 'fixes') {
      return D.fixes.map(f => {
        const owned = s.fix[f.id];
        return {
          key: 'fix:' + f.id, icon: f.icon, name: f.name, line: f.line, count: '',
          price: owned ? 'DONE' : priceHTML(f.price),
          cls: owned ? 'owned' : s.coins < f.price ? 'dim' : '',
        };
      });
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

  function buildRows(s) {
    const box = $('rows');
    box.textContent = '';
    rowCache = {};
    describeRows(s).forEach(d => {
      const b = document.createElement('button');
      b.className = 'row';
      b.innerHTML = '<span class="icon"></span><span class="name"><span></span><span class="count"></span></span><span class="line"></span><span class="price"></span>';
      const f = A[d.icon];
      const person = f && f.h === 32;
      b.querySelector('.icon').appendChild(sprite(d.icon, 3, person ? 21 : 0));
      b.addEventListener('click', () => {
        const [kind, id] = d.key.split(':');
        handlers.buy(kind, id);
      });
      box.appendChild(b);
      rowCache[d.key] = { el: b, sig: '' };
    });
    updateRows(s);
  }

  function updateRows(s) {
    describeRows(s).forEach(d => {
      const r = rowCache[d.key];
      if (!r) return;
      const sig = [d.name, d.line, d.count, d.price, d.cls].join('|');
      if (sig === r.sig) return;
      r.sig = sig;
      const el = r.el;
      el.className = 'row ' + d.cls;
      el.querySelector('.name span').textContent = d.name;
      el.querySelector('.count').textContent = d.count;
      el.querySelector('.line').textContent = d.line;
      const p = el.querySelector('.price');
      p.innerHTML = d.price;
      fillIcons(p);
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
        buildRows(h.state());
        BB.audio.play('click');
      }));
      $('giveBtn').addEventListener('click', () => h.give());
      $('startNow').addEventListener('click', () => h.startDay());
      $('menuBtn').addEventListener('click', () => h.menu());
      $('soundBtn').addEventListener('click', () => BB.audio.toggle());
    },

    reset() {
      Object.keys(last).forEach(k => delete last[k]);
      rowCache = {};
    },

    update(s) {
      if (!rowCache[Object.keys(rowCache)[0]]) buildRows(s);
      setText($('clock'), 'clock', clockText(s));
      setText($('coins'), 'coins', BB.fmt(s.coins));
      drawStars(s);
      drawSunMoon(s);
      updateRows(s);

      // goal
      const g = BB.currentGoal(s);
      if (g) {
        const [have, need] = g.have(s);
        setText($('goalText'), 'goalText', g.text);
        const pct = Math.floor(Math.min(1, have / need) * 20) * 5;
        if (last.goalPct !== pct) { last.goalPct = pct; $('goalBar').firstChild.style.width = pct + '%'; }
        if (last.goalReward !== g.reward) {
          last.goalReward = g.reward;
          $('goalReward').innerHTML = 'REWARD ' + priceHTML(g.reward);
          fillIcons($('goalReward'));
        }
      } else {
        setText($('goalText'), 'goalText', D.ALL_GOALS_DONE);
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

      // end of day card
      $('dayCard').hidden = s.open;
      if (!s.open && s.lastDay) {
        setText($('dayTitle'), 'dayTitle', 'DAY ' + s.lastDay.day + ' DONE!');
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
      buttons.forEach(b => {
        const el = document.createElement('button');
        el.className = 'btn' + (b.alt ? ' alt' : '');
        el.textContent = b.label;
        el.addEventListener('click', () => {
          BB.audio.play('click');
          if (!b.keepOpen) BB.ui.closeModal();
          b.onClick && b.onClick();
        });
        box.appendChild(el);
      });
      $('modal').hidden = false;
      const first = box.querySelector('.btn');
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
