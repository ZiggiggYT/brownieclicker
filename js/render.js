// Draws the bakery scene on a canvas. Everything is pixel art from the sprite
// sheet (plus a few chunky rectangles), scaled 3x with no smoothing. The scene
// is laid out in "scene pixels" (292 x 184); one scene pixel = 3 canvas px.
//
// The renderer only reads the sim state. Purely visual things (Daves walking,
// Fudge the cat, crumbs, bubbles) live in `vis` here and never affect the game.
(function () {
  const U = 3;
  const W = 292;
  const H = 184;
  const FLOOR = 150;
  const PS = '"Press Start 2P", "Courier New", monospace';
  const VT = 'VT323, "Courier New", monospace';
  const COL = {
    night: '#1d120d', panel: '#2e1c14', brownie: '#5a3324', crust: '#8a5a3e', ink: '#120a07',
    cream: '#f6e7cf', toffee: '#c9a98a', gold: '#f5c04a', pink: '#c25a8a', pinkHi: '#ff9ad0',
  };
  // Brownie on the counter: 5 canvas px per art pixel, bottom row sitting on the pan.
  const BIG = { px: 5, x: 268, y: 265 };

  let cv, ctx, sheet, A;
  const vis = {
    parts: [],      // crumbs, confetti, sparkles: {x, y, vx, vy, g, life, max, col, size}
    texts: [],      // floating numbers: {str, x, y, life, max, col, size}
    hearts: [],     // {x, y, life}
    bubbles: {},    // customer id -> {text, until}
    hops: {},       // customer id -> until
    squish: 0,
    arms: 0,
    daves: [],
    cat: { x: 120, dir: 1, mode: 'walk', target: 150, until: 0, bubble: 0 },
    lastNow: 0,
  };

  // ------------------------------------------------------------ drawing helpers
  const P = n => Math.round(n * U);

  function rect(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(P(x), P(y), P(w), P(h));
  }

  // Draw a sprite at scene position (x, y). o.sc multiplies the 3x scale, o.flip mirrors it.
  function spr(name, x, y, o) {
    const f = A[name];
    if (!f) return;
    const sc = ((o && o.sc) || 1) * U;
    const dx = Math.round(x * U);
    const dy = Math.round(y * U);
    const dw = f.w * sc;
    const dh = f.h * sc;
    if (o && o.flip) {
      ctx.save();
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, dx, dy, dw, dh);
    }
  }

  // Text at a scene position (centred by default). size is in canvas px.
  function text(str, x, y, o) {
    o = o || {};
    ctx.font = (o.size || 12) + 'px ' + (o.font === 'vt' ? VT : PS);
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    const tx = Math.round(x * U);
    const ty = Math.round(y * U);
    if (o.shadow !== false) {
      ctx.fillStyle = o.shadowCol || COL.ink;
      ctx.fillText(str, tx + 2, ty + 2);
    }
    ctx.fillStyle = o.color || COL.cream;
    ctx.fillText(str, tx, ty);
  }

  // A small chunky speech bubble centred on (x, y) in scene px.
  function bubble(str, x, y, col) {
    ctx.font = '10px ' + PS;
    const w = Math.ceil(ctx.measureText(str).width / U) + 6;
    const bx = Math.round(x - w / 2);
    rect(bx - 1, y - 1, w + 2, 10, COL.ink);
    rect(bx, y, w, 8, '#fffaf0');
    rect(x - 1, y + 9, 3, 2, COL.ink);
    rect(x, y + 8, 1, 2, '#fffaf0');
    text(str, x, y + 4.3, { size: 10, color: col || COL.brownie, shadow: false });
  }

  // Cheap repeatable "random" for stepped flicker effects.
  function hash(n) {
    const v = Math.sin(n * 127.1) * 43758.5453;
    return v - Math.floor(v);
  }

  // ------------------------------------------------------------ scene parts
  function drawWall(s) {
    if (s.fix.paint) {
      for (let x = 0; x < W; x += 16) {
        rect(x, 0, 8, FLOOR, '#9a3a30');
        rect(x + 8, 0, 8, FLOOR, '#b24a3a');
      }
      rect(0, 120, W, 30, COL.brownie);
      rect(0, 119, W, 2, COL.toffee);
      for (let x = 6; x < W; x += 24) rect(x, 124, 1, 24, '#4a2a1d');
    } else if (s.fix.sweep) {
      rect(0, 0, W, FLOOR, COL.crust);
      for (let y = 12; y < FLOOR; y += 12) rect(0, y, W, 1, '#7a4e35');
      for (let y = 0; y < FLOOR; y += 12) for (let x = (y / 12) % 2 ? 0 : 20; x < W; x += 40) rect(x, y, 1, 12, '#7a4e35');
    } else {
      rect(0, 0, W, FLOOR, '#6e5a4c');
      for (let y = 12; y < FLOOR; y += 12) rect(0, y, W, 1, '#5e4c40');
      for (let i = 0; i < 40; i++) rect(Math.floor(hash(i) * W), Math.floor(hash(i + 99) * FLOOR), 1, 1, '#5a4a3e');
    }
    rect(0, 0, W, 5, COL.panel);
    rect(0, 5, W, 1, COL.ink);
  }

  function skyColors(s) {
    if (!s.open) return ['#141432', '#24244a', 'night'];
    const f = BB.dayFrac(s);
    if (f < 0.08) return ['#f2a65a', '#ffd59a', 'sunrise'];
    if (f < 0.82) return ['#8fc4e8', '#bfe3f5', 'day'];
    if (f < 0.94) return ['#e07a5f', '#f2a65a', 'sunset'];
    return ['#3a2f5a', '#6a4a7a', 'dusk'];
  }

  function drawWindow(s, T) {
    const wx = 150;
    const wy = 30;
    spr('window', wx, wy);
    const [top, bot, phase] = skyColors(s);
    ctx.save();
    ctx.beginPath();
    ctx.rect(P(wx + 4), P(wy + 4), P(22), P(34));
    ctx.rect(P(wx + 30), P(wy + 4), P(22), P(34));
    ctx.clip();
    rect(wx + 4, wy + 4, 48, 34, top);
    rect(wx + 4, wy + 18, 48, 20, bot);
    if (phase === 'night' || phase === 'dusk') {
      for (let i = 0; i < 12; i++) {
        if (hash(i + Math.floor(T * 2) * 0.01) > 0.2) rect(wx + 5 + Math.floor(hash(i) * 46), wy + 5 + Math.floor(hash(i + 7) * 14), 1, 1, '#fff8dc');
      }
      rect(wx + 40, wy + 7, 5, 6, '#f0eedc');
      rect(wx + 39, wy + 8, 1, 4, '#f0eedc');
      rect(wx + 42, wy + 7, 3, 4, top);
    } else {
      // clouds drift by
      for (let i = 0; i < 2; i++) {
        const cx = wx + ((T * (1.5 + i) + i * 37) % 70) - 12;
        const cy = wy + 8 + i * 6;
        rect(cx, cy, 10, 2, '#ffffff');
        rect(cx + 2, cy - 1, 5, 1, '#ffffff');
      }
      // a bird every so often
      const bt = (T % 25) / 6;
      if (bt < 1) {
        const bx = wx + 2 + bt * 54;
        const by = wy + 12 + Math.round(Math.sin(T * 3) * 2);
        const flap = Math.floor(T * 6) % 2;
        rect(bx, by + flap, 1, 1, '#2a2a3a');
        rect(bx + 1, by + 1, 1, 1, '#2a2a3a');
        rect(bx + 2, by + flap, 1, 1, '#2a2a3a');
      }
    }
    // MegaMuffin across the street
    rect(wx + 4, wy + 22, 48, 16, COL.pink);
    rect(wx + 4, wy + 21, 48, 1, '#8a3a62');
    for (let x = 0; x < 48; x += 4) rect(wx + 4 + x, wy + 27, 2, 2, COL.pinkHi);
    rect(wx + 8, wy + 30, 8, 8, '#8a3a62');
    rect(wx + 38, wy + 30, 10, 5, '#ffd9ec');
    const blink = Math.floor(T * 2) % 2 === 0;
    // the sign is split across the two panes so the window bar doesn't hide it
    rect(wx + 5, wy + 22, 20, 5, '#5a1e3e');
    rect(wx + 31, wy + 22, 20, 5, '#5a1e3e');
    text('MEGA', wx + 15, wy + 24.6, { size: 8, color: blink ? COL.pinkHi : '#ffffff', shadow: false });
    text('MUFFIN', wx + 41, wy + 24.6, { size: 8, color: blink ? COL.pinkHi : '#ffffff', shadow: false });
    // delivery bikes ride past on the street, more often the more bikes you have
    const bikes = s.helpers.bike;
    if (bikes && s.open) {
      const period = Math.max(3, 9 / Math.min(bikes, 3));
      const bt = (T % period) / period;
      const bx = Math.round(wx + 56 - bt * 70);
      const by = wy + 31;
      const spin = Math.floor(T * 8) % 2;
      rect(bx, by + 4, 3, 3, '#2a2a2a'); rect(bx + 7, by + 4, 3, 3, '#2a2a2a');
      rect(bx + 1 - spin, by + 5, 1, 1, '#9aa0ad'); rect(bx + 8 + spin, by + 5, 1, 1, '#9aa0ad');
      rect(bx + 2, by + 4, 6, 1, s.ups.ebike ? '#3f6fb5' : '#c24a4a');
      rect(bx + 4, by - 1, 3, 4, '#e0a030');
      rect(bx + 4, by - 4, 3, 3, '#f2c9a0');
      rect(bx + 4, by - 5, 3, 1, '#4a8a4a');
      rect(bx, by + 1, 3, 3, s.ups.basket ? '#c9945a' : '#a8743f');
    }
    if (phase === 'night' || phase === 'dusk') rect(wx + 4, wy + 4, 48, 34, 'rgba(10,10,40,0.35)');
    ctx.restore();
    if (s.cust.window) {
      // a brownie on a little cake stand in the window
      const r = BB.recipe(s);
      rect(wx + 7, wy + 36, 13, 1, '#ffffff');
      rect(wx + 12, wy + 37, 3, 3, '#c9e0f0');
      mini(wx + 10, wy + 31, r.top, r.base);
      if (Math.floor(T * 2) % 2) rect(wx + 19, wy + 30, 1, 1, '#fff1b8');
    }
    rect(wx + 26, wy + 4, 4, 34, '#5a3d28');
  }

  // Things pinned to the walls by customer upgrades.
  function drawWallExtras(s, T) {
    if (s.cust.news) {
      spr('icon_news', 40, 42);
      text('#1 BROWNIES', 49, 63, { size: 6, color: COL.cream });
    }
    if (s.cust.flyers) {
      spr('icon_flyer', 207, 46);
      spr('icon_flyer', 224, 52);
    }
    if (s.cust.rush) {
      spr('icon_rush', 261, 66);
      if (BB.lunchRush(s)) {
        const on = Math.floor(T * 3) % 2;
        rect(253, 56, 34, 9, COL.ink);
        rect(254, 57, 32, 7, on ? COL.pinkHi : COL.pink);
        text('LUNCH RUSH', 270, 60.7, { size: 7, color: on ? COL.ink : '#ffffff', shadow: false });
      }
    }
  }

  function drawSign(s, T) {
    const fixed = s.fix.sign;
    ctx.save();
    if (!fixed) {
      ctx.translate(P(139), P(15));
      ctx.rotate(-0.025);
      ctx.translate(-P(139), -P(15));
    }
    rect(61, 7, 156, 17, COL.ink);
    rect(62, 8, 154, 15, fixed ? '#3a2418' : '#4a3a30');
    rect(62, 8, 154, 1, fixed ? '#6a4430' : '#5e4e44');
    rect(66, 4, 2, 4, '#2a1a10');
    rect(210, 4, 2, 4, '#2a1a10');
    if (fixed) {
      const glint = Math.floor(T * 1.5) % 6;
      text("GRANDMA'S BAKERY", 139, 16, { size: 18, color: COL.gold });
      rect(70 + glint * 24, 11, 2, 1, '#fff1b8');
    } else {
      text("GR NDMA'S BAK RY", 139, 16, { size: 18, color: '#a08a76' });
    }
    ctx.restore();
  }

  function drawChalkboard(s) {
    const r = BB.recipe(s);
    spr('chalkboard', 94, 36);
    rect(96, 38, 40, 24, '#2a332a');
    text("TODAY'S", 116, 42, { size: 7, color: '#c9d3c0', shadow: false });
    text(r.short, 116, 50, { size: 18, color: '#e6e6e6', font: 'vt', shadow: false });
    text('$' + r.price + ' EACH', 116, 57.5, { size: 8, color: COL.gold, shadow: false });
  }

  function drawLamps(s, T, glow) {
    [44, 228].forEach((lx, i) => {
      const ang = (Math.round(Math.sin(T * 1.4 + i * 2) * 2) * 1.5 * Math.PI) / 180;
      ctx.save();
      ctx.translate(P(lx + 8), P(6));
      ctx.rotate(ang);
      const f = A[glow ? 'lamp_on' : 'lamp_off'];
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, -8 * U, 0, f.w * U, f.h * U);
      ctx.restore();
    });
  }

  function drawLampGlow(T) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    [44, 228].forEach((lx, i) => {
      const cx = P(lx + 8) + Math.round(Math.sin(T * 1.4 + i * 2) * 2) * 3;
      const cy = P(26);
      [60, 42, 26].forEach(r => {
        ctx.fillStyle = 'rgba(120,80,20,0.12)';
        ctx.beginPath();
        ctx.arc(cx, cy, r * U / 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    ctx.restore();
  }

  function drawOven(s, T) {
    // chimney up to the ceiling
    for (let y = 6; y < 86; y += 4) {
      rect(20, y, 16, 4, '#a0533f');
      rect(20, y + 3, 16, 1, '#7a3a2c');
      rect((y / 4) % 2 ? 27 : 23, y, 1, 3, '#7a3a2c');
    }
    rect(19, 6, 1, 80, COL.ink);
    rect(36, 6, 1, 80, COL.ink);
    spr('oven', 4, 86);
    // flickering fire, redrawn in steps
    const step = Math.floor(T * 7);
    const magic = s.ups.magic;
    const hot = s.ups.fire;
    const fc = magic ? ['#7a5aff', '#a06aff', '#ff9ad0', '#8fe0f0'] : ['#ff6a2a', '#ff8a3d', '#ffc04a', '#ffe08a'];
    rect(16, 113, 24, 17, '#1a0d0a');
    rect(16, 124, 24, 6, fc[0]);
    for (let i = 0; i < 6; i++) {
      const h = Math.min(11, (hot ? 7 : 4) + Math.floor(hash(step * 7 + i) * 8));
      rect(16 + i * 4, 124 - h, 4, h, fc[1]);
      const h2 = Math.floor(h * 0.55);
      rect(17 + i * 4, 124 - h2, 2, h2, fc[2]);
    }
    rect(20, 126, 16, 3, fc[3]);
    if (hot) rect(24, 122 + (step % 2), 8, 4, '#ffffff');
    if (s.helpers.oven) {
      rect(9, 141, 16, 7, COL.ink);
      rect(10, 142, 14, 5, '#c99428');
      text('x' + (s.helpers.oven + 1), 17, 144.7, { size: 7, color: COL.ink, shadow: false });
    }
    // steam puffs drifting up past the chimney
    for (let i = 0; i < 4; i++) {
      const p = ((T * 0.35 + i / 4) % 1);
      const sy = 84 - p * 60;
      const sx = 40 + Math.round(Math.sin(p * 9 + i) * 2) + p * 6;
      const sz = 2 + Math.floor(p * 3);
      if (p < 0.85) rect(Math.round(sx), Math.round(sy), sz, sz, p < 0.5 ? 'rgba(246,231,207,0.55)' : 'rgba(246,231,207,0.3)');
    }
  }

  function drawDoor(s) {
    spr('door', 254, 86);
    rect(260, 110, 20, 10, COL.ink);
    rect(261, 111, 18, 8, s.open ? COL.cream : '#e8d6c0');
    text(s.open ? 'OPEN' : 'CLOSED', 270, 115.3, { size: s.open ? 9 : 7, color: s.open ? '#2a7a2a' : '#b33a3a', shadow: false });
  }

  function drawFloor() {
    rect(0, FLOOR, W, H - FLOOR, '#6b4a32');
    for (let y = FLOOR, row = 0; y < H; y += 6, row++) {
      rect(0, y, W, 1, '#4e3424');
      for (let x = (row % 2) * 18; x < W; x += 36) rect(x, y, 1, 6, '#4e3424');
      rect(0, y + 1, W, 1, '#7a5a40');
    }
    rect(0, FLOOR, W, 2, COL.ink);
  }

  function drawTable(s) {
    if (!s.fix.tables) return;
    const r = BB.recipe(s);
    // chairs
    rect(5, 150, 3, 26, '#7a5030'); rect(5, 166, 10, 2, '#a8743f'); rect(13, 168, 2, 8, '#7a5030');
    rect(52, 150, 3, 26, '#7a5030'); rect(45, 166, 10, 2, '#a8743f'); rect(45, 168, 2, 8, '#7a5030');
    // table
    rect(14, 158, 32, 4, '#a8743f'); rect(14, 161, 32, 1, '#7a5030');
    rect(17, 162, 3, 15, '#7a5030'); rect(40, 162, 3, 15, '#7a5030');
    rect(13, 157, 34, 1, COL.ink);
    rect(24, 156, 12, 2, '#f0e2c8');
    mini(27, 152, r.top, r.base);
  }

  function mini(x, y, top, base) {
    rect(x, y, 7, 5, COL.ink);
    rect(x + 1, y + 1, 5, 3, base);
    rect(x + 1, y + 1, 5, 1, top);
  }

  function drawCounter(s, now) {
    // you, behind the counter
    const arms = now < vis.arms;
    spr(arms ? 'baker_bake' : 'baker_idle', 70, 90);
    if (s.ups.mitts) { // oven mitts on your hands
      const hy = arms ? 97 : 109;
      rect(72, hy, 2, 3, '#c24a4a'); rect(83, hy, 2, 3, '#c24a4a');
    }
    if (s.helpers.linda) {
      const busy = s.customers.some(c => c.st === 'wait');
      spr(busy || s.ups.smile ? 'linda_happy' : 'linda_idle', 150, 84);
      if (s.ups.smile && (now / 1000) % 5 < 0.9) spr('heart', 157, 77 - Math.floor(((now / 1000) % 5) * 6));
    }
    spr('counter', 60, 118);
    spr('counter', 124, 118);
    if (s.helpers.coffee) {
      spr(s.ups.fancymug ? 'icon_fancymug' : 'icon_coffee', 56, 101);
      if (s.ups.espresso) { // a tiny espresso cup in front of the mug
        rect(61, 113, 6, 5, COL.ink); rect(62, 114, 4, 3, '#f0f0ea'); rect(62, 114, 4, 1, '#3a1c12');
      }
    }
    if (s.ups.register) {
      rect(176, 109, 12, 9, COL.ink);
      rect(177, 110, 10, 7, '#9aa0ad');
      rect(178, 105, 8, 5, COL.ink);
      rect(179, 106, 6, 3, '#8fe0b0');
      rect(178, 112, 2, 1, '#f6f6f0'); rect(181, 112, 2, 1, '#f6f6f0'); rect(184, 112, 2, 1, '#f6f6f0');
    }
    if (s.cust.tipjar) { // fills up with coins as tips come in today
      const lvl = Math.min(7, Math.ceil(s.dayTips / 2));
      rect(165, 106, 10, 12, COL.ink);
      rect(166, 107, 8, 10, 'rgba(201,224,240,0.45)');
      if (lvl) rect(166, 117 - lvl, 8, lvl, COL.gold);
      rect(166, 105, 8, 1, '#a8c0d0');
      rect(167, 108, 1, 4, '#ffffff');
    }
    if (s.cust.samples) { // free samples card on the counter front
      rect(155, 121, 30, 13, COL.ink);
      rect(156, 122, 28, 11, COL.cream);
      text('FREE', 170, 125.5, { size: 7, color: '#b33a3a', shadow: false });
      const r = BB.recipe(s);
      for (let i = 0; i < 3; i++) { rect(159 + i * 8, 129, 4, 3, r.base); rect(159 + i * 8, 129, 4, 1, r.top); }
    }
    // the big brownie on its pan
    rect(87, 114, 40, 4, '#9aa0ad');
    rect(87, 117, 40, 1, '#6a6d75');
    rect(86, 114, 1, 4, COL.ink); rect(127, 114, 1, 4, COL.ink);
    const f = A[BB.recipe(s).sprite];
    let sx = 1;
    let sy = 1;
    const sq = vis.squish - now;
    if (sq > 60) { sx = 1.15; sy = 0.82; } else if (sq > 0) { sx = 0.94; sy = 1.08; }
    const w = f.w * BIG.px * sx;
    const h = f.h * BIG.px * sy;
    const bottom = BIG.y + 16 * BIG.px;
    ctx.drawImage(sheet, f.x, f.y, f.w, f.h, Math.round(BIG.x + 50 - w / 2), Math.round(bottom - 16 * BIG.px * sy), Math.round(w), Math.round(h));
    drawTray(s);
    // the big count on the counter front
    const n = BB.stock(s);
    rect(98, 122, 52, 21, COL.ink);
    rect(99, 123, 50, 19, COL.panel);
    text(BB.fmt(n), 124, 128, { size: 20, color: n ? COL.gold : '#a08a76' });
    text(n === 1 ? 'BROWNIE READY' : 'BROWNIES READY', 124, 138, { size: 9 });
    if (s.stale) text(BB.fmt(s.stale) + ' stale (half price)', 124, 145, { size: 18, font: 'vt', color: COL.toffee });
  }

  function drawTray(s) {
    const r = BB.recipe(s);
    const gold = s.fix.case;
    rect(129, 103, 34, 15, 'rgba(201,224,240,0.22)');
    const fresh = Math.min(8, s.fresh);
    const stale = Math.min(8 - fresh, s.stale);
    for (let i = 0; i < fresh + stale; i++) {
      const x = 130 + (i % 4) * 8;
      const y = i < 4 ? 112 : 106;
      if (i < fresh) mini(x, y, r.top, r.base);
      else mini(x, y, '#a59a8a', '#7e7468');
    }
    const fc = gold ? COL.gold : '#c9e0f0';
    rect(128, 102, 36, 1, fc);
    rect(128, 102, 1, 16, fc);
    rect(163, 102, 1, 16, fc);
    rect(128, 117, 36, 2, gold ? '#c99428' : COL.crust);
    rect(132, 104, 1, 1, '#ffffff'); rect(133, 105, 1, 1, '#ffffff');
    if (gold) { rect(127, 101, 2, 2, '#fff1b8'); rect(162, 101, 2, 2, '#fff1b8'); }
  }

  function drawLine(s) {
    if (!s.cust.line1) return;
    // velvet rope posts along the line
    const posts = s.cust.line2 ? [207, 229, 251, 217] : [207, 229, 251];
    posts.forEach((x, i) => {
      const y = i === 3 ? 154 : 140;
      rect(x - 1, y - 1, 4, 16, COL.ink);
      rect(x, y, 2, 14, COL.gold);
      rect(x - 1, y - 1, 4, 2, '#fff1b8');
    });
    rect(209, 143, 20, 2, '#b33a3a'); rect(231, 143, 20, 2, '#b33a3a');
  }

  function customerDrawer(s, c, now, step) {
    return () => {
      const walking = c.st === 'in' || c.st === 'out';
      let name = c.look + (walking && step ? '_walk2' : '_walk1');
      if (c.mood) name = c.look + '_' + c.mood;
      else if (c.st === 'wait' && c.t > 30) name = c.look + '_sad'; // empty tray, getting worried
      const bob = c.mood && step ? 1 : 0; // mood faces have no walk frame, so bob them along
      const hop = ((vis.hops[c.id] || 0) > now ? 3 : 0) + bob;
      const top = c.y - 32 - hop;
      spr(name, c.x, top);
      if (c.box && c.mood === 'happy') { // a party box of 6
        rect(c.x + 11, top + 15, 9, 7, COL.ink);
        rect(c.x + 12, top + 16, 7, 5, COL.pinkHi);
        rect(c.x + 15, top + 16, 1, 5, COL.gold);
      }
    };
  }

  // Dave wears his upgrades: a whisk in his pocket, red speed shoes, a second tray.
  function daveDrawer(s, d, i, T) {
    return () => {
      const step = Math.floor(T * (s.ups.shoes ? 6 : 4)) % 2;
      const frame = d.pause > 0 ? 'dave_walk1' : (step ? 'dave_walk2' : 'dave_walk1');
      const x = Math.round(d.x);
      const y = 178 - 32 - i;
      const flip = d.dir < 0;
      spr(frame, x, y, { flip });
      const ov = (dx, dy, w, h, col) => rect(flip ? x + 20 - dx - w : x + dx, y + dy, w, h, col);
      if (s.ups.whisk) { ov(5, 12, 3, 1, '#c0c4cc'); ov(6, 13, 1, 3, '#c0c4cc'); }
      if (s.ups.shoes) {
        const w1 = frame === 'dave_walk1';
        ov(5, w1 ? 25 : 26, 3, 1, '#e04a4a'); ov(10, w1 ? 26 : 25, 3, 1, '#e04a4a');
      }
      if (s.ups.trays) {
        ov(12, 14, 7, 1, '#9aa0ad'); ov(13, 13, 2, 1, '#6b3a26'); ov(16, 13, 2, 1, '#6b3a26');
      }
    };
  }

  function moveDaves(s, dt) {
    const want = Math.min(3, s.helpers.dave);
    while (vis.daves.length < want) vis.daves.push({ x: 60 + vis.daves.length * 50, dir: vis.daves.length % 2 ? -1 : 1, pause: 0 });
    vis.daves.length = want;
    const speed = s.ups.shoes ? 26 : 14;
    vis.daves.forEach((d, i) => {
      if (d.pause > 0) d.pause -= dt;
      else {
        d.x += d.dir * dt * speed;
        if (d.x > 240) { d.x = 240; d.dir = -1; d.pause = 1 + i; }
        if (d.x < 58) { d.x = 58; d.dir = 1; d.pause = 1.5; }
      }
    });
  }

  // Everyone on the shop floor, drawn back to front so nobody stands on anyone's head.
  function drawFloorPeople(s, now, T, dt) {
    const step = Math.floor(T * 4) % 2;
    moveDaves(s, dt);
    const items = s.customers.map(c => [c.y, customerDrawer(s, c, now, step)]);
    vis.daves.forEach((d, i) => items.push([178 - i, daveDrawer(s, d, i, T)]));
    items.push([182, () => drawCat(now, T, dt)]);
    items.sort((a, b) => a[0] - b[0]).forEach(([, fn]) => fn());
  }

  function drawCat(now, T, dt) {
    const c = vis.cat;
    if (c.mode === 'walk') {
      c.x += c.dir * dt * 10;
      if ((c.dir > 0 && c.x >= c.target) || (c.dir < 0 && c.x <= c.target)) {
        c.mode = 'sit';
        c.since = now;
        c.until = now + 3000 + Math.random() * (Math.random() < 0.3 ? 15000 : 5000);
      }
    } else if (now > c.until) {
      c.target = 10 + Math.random() * 240;
      c.dir = c.target > c.x ? 1 : -1;
      c.mode = 'walk';
    }
    const x = Math.round(c.x);
    const y = 182 - 16;
    if (c.mode === 'sit') {
      spr('fudge_sit', x, y, { flip: c.dir < 0 });
      // tail wag
      const wag = Math.floor(T * 3) % 2;
      const tx = c.dir < 0 ? x + 19 - wag : x + 1 + wag;
      rect(tx, y + 6 + wag, 2, 2, '#7a4a2a');
      if (now - (c.since || now) > 6000 && c.bubble < now) { // a little cat nap
        const zt = ((now - c.since) / 1000) % 2;
        text('z', x + (c.dir < 0 ? 4 : 17) + zt * 2, y - 2 - zt * 5, { size: 10 + Math.floor(zt) * 3, color: COL.cream });
      }
    } else {
      spr(Math.floor(T * 6) % 2 ? 'fudge_walk2' : 'fudge_walk1', x, y, { flip: c.dir < 0 });
    }
    if (c.bubble > now) bubble('MEOW!', x + 11, y - 12, '#b33a3a');
  }

  function drawGolden(s, T) {
    const g = s.golden;
    if (!g) return;
    if (g.t < 30 && Math.floor(T * 8) % 2) return; // blink before it vanishes
    const bob = Math.round(Math.sin(T * 3) * 2);
    spr('golden_sparkle', g.x, g.y + bob);
    if (Math.floor(T * 4) % 2) {
      rect(g.x + 2, g.y + 14 + bob, 1, 1, '#fff1b8');
      rect(g.x + 29, g.y + 18 + bob, 1, 1, '#fff1b8');
    }
  }

  function drawBubbles(s, now) {
    for (const c of s.customers) {
      const b = vis.bubbles[c.id];
      if (b && b.until > now) bubble(b.text, c.x + 10, c.y - 46, b.col);
    }
  }

  // ------------------------------------------------------------ particles
  function stepParticles(dt) {
    const snap = v => Math.round(v / U) * U;
    vis.parts = vis.parts.filter(p => (p.life -= dt) > 0);
    for (const p of vis.parts) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.fillStyle = p.col;
      ctx.fillRect(snap(p.x), snap(p.y), p.size, p.size);
    }
    vis.hearts = vis.hearts.filter(h => (h.life -= dt) > 0);
    for (const h of vis.hearts) {
      h.y -= dt * 45;
      const f = A.heart;
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, snap(h.x), snap(h.y), f.w * U, f.h * U);
    }
    vis.texts = vis.texts.filter(t => (t.life -= dt) > 0);
    for (const t of vis.texts) {
      t.y -= dt * 50;
      ctx.font = t.size + 'px ' + PS;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COL.ink;
      ctx.fillText(t.str, snap(t.x) + 2, snap(t.y) + 2);
      ctx.fillStyle = t.col;
      ctx.fillText(t.str, snap(t.x), snap(t.y));
    }
  }

  function burst(x, y, n, cols, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed || 200) * (0.4 + Math.random() * 0.8);
      vis.parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (o.up || 120),
        g: o.g == null ? 500 : o.g,
        life: (o.life || 0.7) * (0.6 + Math.random() * 0.6),
        col: cols[i % cols.length],
        size: o.size || 6,
      });
    }
  }

  function floatText(str, x, y, col, size) {
    vis.texts.push({ str, x, y, life: 1, col: col || COL.cream, size: size || 16 });
  }

  // ------------------------------------------------------------ public
  BB.render = {
    COL,
    init(canvas, img) {
      cv = canvas;
      ctx = cv.getContext('2d');
      sheet = img;
      A = BB.ATLAS.frames;
      ctx.imageSmoothingEnabled = false;
    },

    draw(s, now) {
      const dt = Math.min(0.1, (now - (vis.lastNow || now)) / 1000);
      vis.lastNow = now;
      const T = now / 1000;
      ctx.imageSmoothingEnabled = false;
      const f = BB.dayFrac(s);
      const evening = !s.open || f > 0.82;

      drawWall(s);
      drawWindow(s, T);
      drawSign(s, T);
      spr('grandma_portrait', 66, 36);
      drawChalkboard(s);
      drawWallExtras(s, T);
      drawOven(s, T);
      drawDoor(s);
      drawFloor();
      drawTable(s);
      drawCounter(s, now);
      drawLine(s);
      drawFloorPeople(s, now, T, dt);
      drawLamps(s, T, evening && s.open);

      if (!s.fix.sweep) {
        // dusty tint and cobwebs until you sweep
        rect(0, 0, W, H, 'rgba(150,140,125,0.18)');
        const web = '#d8d2c8';
        for (let i = 0; i < 10; i++) { rect(6 + i, 6 + i, 1, 1, web); rect(286 - i, 6 + i, 1, 1, web); }
        rect(6, 10, 8, 1, web); rect(10, 6, 1, 8, web); rect(278, 10, 8, 1, web); rect(281, 6, 1, 8, web);
        rect(152, 32, 6, 1, web); rect(152, 32, 1, 6, web); rect(153, 33, 3, 3, 'rgba(216,210,200,0.6)');
      }

      // sunset / night tint, stepped
      let tint = 0;
      if (!s.open) tint = 0.55;
      else if (f > 0.88) tint = 0.3 * Math.ceil(((f - 0.88) / 0.12) * 4) / 4;
      if (tint) rect(0, 0, W, H, 'rgba(25,12,45,' + tint + ')');
      if (evening && s.open) drawLampGlow(T);

      drawGolden(s, T);
      drawBubbles(s, now);
      stepParticles(dt);
      if (s.rush > 0 && Math.random() < 0.3) burst(Math.random() * W * U, Math.random() * H * U, 1, [COL.gold, '#fff1b8'], { speed: 30, up: 40, g: 0, life: 0.6 });
    },

    // What is under canvas point (cx, cy)?
    hit(s, cx, cy) {
      const x = cx / U;
      const y = cy / U;
      const g = s.golden;
      if (g && x >= g.x && x <= g.x + 32 && y >= g.y - 2 && y <= g.y + 34) return 'golden';
      const c = vis.cat;
      if (x >= c.x - 2 && x <= c.x + 24 && y >= 160 && y <= 184) return 'cat';
      if (cx >= BIG.x - 10 && cx <= BIG.x + 110 && cy >= BIG.y - 10 && cy <= BIG.y + 95) return 'brownie';
      return null;
    },

    onEvent(e, s, now) {
      const cust = e.id ? s.customers.find(c => c.id === e.id) : null;
      const say = (txt, ms, col) => { if (cust) vis.bubbles[cust.id] = { text: txt, until: now + ms, col }; };
      switch (e.k) {
        case 'bake': {
          vis.squish = now + 120;
          vis.arms = now + 220;
          const cx = BIG.x + 50 + (Math.random() * 40 - 20);
          burst(cx, BIG.y + 30, 8, [BB.recipe(s).base, BB.recipe(s).top, '#3a1c12'], { speed: 160, up: 140, size: 6 });
          floatText('+' + e.n, cx, BIG.y - 6, COL.cream, 18);
          break;
        }
        case 'arrive':
          vis.hops[e.id] = now + 220;
          break;
        case 'sale':
          say('+$' + BB.fmt(e.amt), 1100, '#2a7a2a');
          vis.hops[e.id] = now + 200;
          if (cust) vis.hearts.push({ x: P(cust.x + 6), y: P(cust.y - 48), life: 0.9 });
          if (e.tip) {
            floatText('+$' + BB.fmt(e.tip) + ' TIP', P(170), P(100), COL.gold, 12);
            burst(P(170), P(106), 5, [COL.gold, '#fff1b8'], { speed: 80, up: 120, size: 6 });
          }
          break;
        case 'deliver':
          floatText('+$' + BB.fmt(e.amt), P(178), P(30), '#8fe0b0', 14);
          break;
        case 'parade':
          burst(P(e.x + 16), P(e.y + 16), 30, [COL.pinkHi, COL.gold, '#ffffff'], { speed: 260, up: 60, g: 200, life: 1 });
          floatText('PARADE!', P(e.x + 16), P(e.y + 8), COL.pinkHi, 16);
          break;
        case 'hello':
          say('Hello?', 2500);
          break;
        case 'aww':
          say('Aww...', 1500, '#5a3a8a');
          break;
        case 'meow':
          vis.cat.bubble = now + 1000;
          vis.cat.mode = 'sit';
          vis.cat.until = now + 2500;
          vis.hearts.push({ x: P(vis.cat.x + 6), y: P(160), life: 1 });
          break;
        case 'rush':
          burst(P(e.x + 16), P(e.y + 16), 30, [COL.gold, '#fff1b8', '#ffffff'], { speed: 260, up: 60, g: 200, life: 1 });
          floatText('BROWNIE RUSH!', P(e.x + 16), P(e.y + 8), COL.gold, 16);
          break;
        case 'bonus':
          burst(P(e.x + 16), P(e.y + 16), 30, [COL.gold, '#fff1b8', '#ffffff'], { speed: 260, up: 60, g: 200, life: 1 });
          floatText('+$' + BB.fmt(e.amt), P(e.x + 16), P(e.y + 8), COL.gold, 18);
          break;
        default:
          break;
      }
    },

    confetti() {
      burst(W * U / 2, 30 * U, 60, ['#f5c04a', '#ff9ad0', '#8fe0b0', '#8fc4e8', '#f6e7cf', '#ff6a8a'], { speed: 420, up: 150, g: 380, life: 1.6, size: 9 });
    },
  };

  // 1234 -> "1,234"; 1234567 -> "1.23M"
  BB.fmt = function (n) {
    n = Math.floor(n);
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    return n.toLocaleString('en-US');
  };
})();
