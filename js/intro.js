// The story intro: title screen, five pixel scenes with typed-out dialogue,
// and the "GRANDMA'S BAKERY IS OPEN!" end card. Plays on first launch and can
// be replayed from the menu. Each scene is a 640x300 canvas drawn at 3x
// (213 x 100 scene pixels), going from gray to warm as the story goes on.
(function () {
  const U = 3;
  const W = 214;
  const H = 100;
  const PS = '"Press Start 2P", "Courier New", monospace';
  const CPS = 38; // typed characters per second
  const $ = id => document.getElementById(id);

  let cv, ctx, sheet, A;
  let st = null;
  let parts = [];

  // ------------------------------------------------------------ helpers
  const P = n => Math.round(n * U);
  function rect(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(P(x), P(y), P(w), P(h));
  }
  function spr(name, x, y, sc) {
    const f = A[name];
    const k = (sc || 1) * U;
    ctx.drawImage(sheet, f.x, f.y, f.w, f.h, P(x), P(y), f.w * k, f.h * k);
  }
  function text(str, x, y, size, color, shadow) {
    ctx.font = size + 'px ' + PS;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (shadow) {
      ctx.fillStyle = shadow;
      ctx.fillText(str, P(x) + 3, P(y) + 3);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, P(x), P(y));
  }
  const q = (v, step) => Math.floor(v / step) * step; // stepped animation time
  function glow(x, y, radii, col) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = col;
    radii.forEach(r => { ctx.beginPath(); ctx.arc(P(x), P(y), P(r), 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }
  function rain(t, x0, y0, w, h, n, col, speed) {
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i * 37) % w);
      const y = y0 + ((q(t, 0.05) * speed + i * 23) % h);
      rect(x, y, 1, 3, col);
    }
  }
  function sparkle(x, y, t, k) {
    if (Math.floor(t * 6 + k) % 3 === 0) return;
    rect(x, y - 2, 1, 5, '#fff1b8');
    rect(x - 2, y, 5, 1, '#fff1b8');
  }

  // ------------------------------------------------------------ scenes
  const SCENES = [
    { // 1. the gray office
      lines: [
        { text: 'DAY 847 AT GRAY OFFICE CO.' },
        { text: 'Emails. Meetings. More emails.' },
        { text: 'You stopped trying a long time ago.' },
        { who: 'BOSS', text: 'Hey. My office. NOW.', on: () => sfx('bell') },
      ],
      draw(t, li, lt) {
        rect(0, 0, W, H, '#5d6068');
        rect(0, 0, W, 5, '#4a4c52');
        // window with rain
        rect(13, 11, 42, 40, '#3a3c42');
        rect(15, 13, 38, 36, '#7d8590');
        ctx.save();
        ctx.beginPath();
        ctx.rect(P(15), P(13), P(38), P(36));
        ctx.clip();
        rain(t, 15, 10, 38, 42, 14, '#b8c0cc', 70);
        ctx.restore();
        rect(33, 13, 2, 36, '#3a3c42');
        rect(15, 30, 38, 2, '#3a3c42');
        // calendar
        rect(63, 11, 24, 26, '#2a2c30');
        rect(64, 12, 22, 24, '#e6e6e6');
        rect(64, 12, 22, 6, '#8a5a5a');
        text('DAY', 75, 15.2, 7, '#e6e6e6');
        text('847', 75, 27, 16, '#2a2c30');
        // floor
        rect(0, 82, W, 18, '#45474d');
        rect(0, 82, W, 1, '#2a2c30');
        // you at your desk
        spr(li >= 3 ? 'you_office' : 'you_office_sleep', 108, 40 + (li < 3 ? 6 : 0));
        rect(84, 66, 86, 4, '#8a8c92');
        rect(84, 70, 86, 2, '#5a5c62');
        rect(88, 72, 4, 12, '#5a5c62');
        rect(162, 72, 4, 12, '#5a5c62');
        rect(130, 72, 30, 9, '#6e7076');
        rect(143, 75, 4, 1, '#3a3c42');
        // monitor
        rect(86, 50, 20, 14, '#2a2c30');
        rect(88, 52, 16, 9, '#4a5a66');
        rect(94, 64, 6, 2, '#2a2c30');
        // the huge paper stack
        for (let y = 64; y > 8; y -= 2) {
          const off = Math.round(Math.sin(y * 0.6) * 1.5);
          rect(140 + off, y, 22, 2, '#2a2c30');
          rect(141 + off, y, 20, 1, y % 4 ? '#f0f0f0' : '#d8d8d8');
        }
        if (li < 3) {
          for (let k = 0; k < 3; k++) {
            const p = (q(t, 0.12) * 0.5 + k / 3) % 1;
            text('Z', 124 + p * 12, 44 - p * 30, 10 + Math.floor(p * 3) * 4, 'rgba(230,230,240,' + (1 - p * 0.7) + ')');
          }
        } else {
          const pop = lt < 0.12 ? 30 : 22;
          text('!', 118, 34, pop, '#f5c04a', '#2a2c30');
        }
      },
    },

    { // 2. fired
      lines: [
        { who: 'BOSS', text: 'You slept through SIX meetings this week.' },
        { who: 'BOSS', text: "You 'worked from home'... from a hammock." },
        { who: 'BOSS', text: "YOU'RE FIRED!", on: () => { sfx('boom'); st.shakeUntil = performance.now() + 450; } },
        { who: 'YOU', text: '...can I at least keep the stapler?' },
      ],
      draw(t, li, lt) {
        rect(0, 0, W, H, '#6e6662');
        rect(0, 0, W, 5, '#55504c');
        // window with blinds
        rect(150, 10, 48, 38, '#3e3a38');
        rect(152, 12, 44, 34, '#9aa2aa');
        for (let y = 12; y < 46; y += 4) rect(152, y, 44, 2, '#c8c4bc');
        // "Boss of the Year" photo
        rect(18, 10, 42, 34, '#c9a050');
        rect(20, 12, 38, 22, '#8fa3b8');
        rect(33, 15, 12, 12, '#e3a48a');
        rect(33, 15, 12, 2, '#3a2a20');
        rect(35, 20, 2, 1, '#1a1a1a'); rect(41, 20, 2, 1, '#1a1a1a');
        rect(36, 24, 6, 1, '#3a2a20');
        rect(30, 27, 18, 7, '#2b2f38');
        rect(20, 34, 38, 8, '#2a2420');
        text('BOSS OF THE YEAR', 39, 38.4, 6, '#f5c04a');
        // floor, boss, desk
        rect(0, 82, W, 18, '#4e4744');
        rect(0, 82, W, 1, '#2a2420');
        spr('boss_angry', 86, 38);
        rect(64, 64, 66, 4, '#6a4a3a');
        rect(64, 68, 66, 16, '#57392c');
        rect(66, 70, 62, 1, '#3e281e');
        rect(90, 60, 16, 4, '#c9a050');
        // you
        spr('you_office_sad', 160, 58);
        if (li === 2) {
          const pop = lt < 0.15 ? 1.15 : 1;
          ctx.save();
          ctx.translate(P(104), P(20));
          ctx.scale(pop, pop);
          ctx.translate(-P(104), -P(20));
          // jagged shout bubble
          rect(58, 8, 92, 24, '#1a1a1a');
          rect(60, 10, 88, 20, '#ffffff');
          for (let x = 62; x < 146; x += 8) { rect(x, 6, 4, 2, '#1a1a1a'); rect(x + 1, 7, 2, 3, '#ffffff'); rect(x, 32, 4, 2, '#1a1a1a'); rect(x + 1, 30, 2, 3, '#ffffff'); }
          rect(96, 30, 6, 6, '#ffffff');
          rect(95, 34, 1, 4, '#1a1a1a');
          text("YOU'RE FIRED!", 104, 20.5, 16, '#b33a3a');
          ctx.restore();
        }
        if (li === 3) text('?', 170, 52, 14, '#e6e6e6', '#2a2420');
      },
    },

    { // 3. rainy night street
      lines: [
        { text: 'You applied everywhere.' },
        { text: 'The cafe. The bank. The pet store. The other pet store.' },
        { text: '47 applications. 47 rejections.' },
        { text: 'NOBODY IS HIRING...' },
      ],
      draw(t, li, lt) {
        rect(0, 0, W, H, '#1f2238');
        rect(0, 12, 60, 70, '#2c2f45');
        rect(64, 22, 72, 60, '#34374f');
        rect(140, 6, 74, 76, '#2a2d42');
        // shop windows with NOT HIRING signs
        [[6, 42, 44, 22], [72, 30, 56, 18], [156, 34, 46, 24]].forEach(([x, y, w, h], i) => {
          rect(x, y, w, h, '#6a6450');
          rect(x + 2, y + 2, w - 4, h - 4, '#8a8262');
          const sx = x + w / 2;
          rect(sx - 15, y + h / 2 - 5, 30, 10, '#1a1a1a');
          rect(sx - 14, y + h / 2 - 4, 28, 8, '#e6e6e6');
          text('NOT', sx, y + h / 2 - 1.6, 6, '#b33a3a');
          text('HIRING', sx, y + h / 2 + 1.9, 6, '#b33a3a');
          if (i === 1) rect(x, y + h, w, 2, '#1a1a1a');
        });
        // street lamp
        rect(58, 28, 2, 54, '#14141e');
        rect(53, 26, 12, 3, '#14141e');
        rect(55, 29, 8, 1, '#f0e0a0');
        glow(59, 30, [16, 10], 'rgba(90,80,30,0.18)');
        // sidewalk
        rect(0, 82, W, 18, '#3a3a48');
        rect(0, 82, W, 2, '#4e4e60');
        for (let x = 0; x < W; x += 24) rect(x, 84, 1, 16, '#2e2e3a');
        // bench and you
        rect(84, 60, 52, 3, '#5a3d28');
        rect(84, 65, 52, 3, '#5a3d28');
        spr('you_office_sad', 98, 46);
        rect(82, 72, 56, 4, '#6b4a32');
        rect(82, 76, 56, 1, '#3a2418');
        rect(86, 77, 3, 7, '#3a2418');
        rect(131, 77, 3, 7, '#3a2418');
        // the letters marked NO, one more per line
        for (let i = 0; i <= li; i++) {
          const restY = 66 - i * 3;
          let y = restY;
          if (i === li) y = Math.min(restY, -10 + q(lt, 0.06) * 160);
          const x = 116 + (i % 2) * 4;
          rect(x - 1, y - 1, 14, 9, '#1a1a1a');
          rect(x, y, 12, 7, '#e6e6e6');
          text('NO', x + 6, y + 3.8, 6, '#b33a3a');
        }
        // your own little rain cloud
        rect(96, 30, 24, 6, '#5a5e70');
        rect(100, 27, 10, 4, '#6a6e82');
        rect(108, 26, 8, 5, '#6a6e82');
        rect(96, 35, 24, 1, '#44485a');
        ctx.save();
        ctx.beginPath();
        ctx.rect(P(97), P(36), P(22), P(14));
        ctx.clip();
        rain(t * 1.3, 97, 34, 22, 16, 8, '#9aa6d0', 90);
        ctx.restore();
        rain(t, 0, -4, W, 90, 30, 'rgba(140,150,190,0.5)', 60);
      },
    },

    { // 4. sunset, grandma's old bakery
      lines: [
        { text: 'Then you remembered something...' },
        { text: "Grandma's old bakery." },
        { text: 'Closed for ten years. Covered in dust. Missing a few letters.' },
        { who: 'YOU', text: "Well... it's still mine." },
      ],
      draw(t) {
        rect(0, 0, W, 16, '#7a4a7a');
        rect(0, 16, W, 14, '#b05a6a');
        rect(0, 30, W, 16, '#e07a5f');
        rect(0, 46, W, 16, '#f2a65a');
        rect(0, 62, W, 20, '#ffd59a');
        rect(170, 52, 22, 10, '#ffe08a');
        rect(166, 56, 30, 6, '#ffe08a');
        // the bakery
        rect(36, 16, 108, 5, '#3a2018');
        for (let y = 21; y < 82; y += 4) {
          rect(40, y, 100, 4, '#8a4a3a');
          rect(40, y + 3, 100, 1, '#6a3428');
          for (let x = 40 + ((y / 4) % 2) * 6; x < 140; x += 12) rect(x, y, 1, 3, '#6a3428');
        }
        rect(48, 24, 84, 13, '#2a1a14');
        rect(49, 25, 82, 11, '#4a3a30');
        text("GR NDMA'S BAK RY", 90, 30.8, 11, '#c9a98a');
        // boarded windows and door
        [[48, 44, 26, 26], [106, 44, 26, 26]].forEach(([x, y, w, h]) => {
          rect(x, y, w, h, '#2a1a14');
          rect(x - 1, y + 6, w + 2, 3, '#8a6a48');
          rect(x - 1, y + 16, w + 2, 3, '#7a5a3e');
          for (let i = 0; i < w; i += 2) rect(x + i, y + Math.floor(i * h / w), 2, 2, '#9a7a52');
        });
        rect(80, 48, 20, 34, '#4a3020');
        rect(79, 56, 22, 3, '#8a6a48');
        rect(79, 70, 22, 3, '#8a6a48');
        rect(96, 64, 2, 2, '#c9a050');
        // street
        rect(0, 82, W, 4, '#9a7a62');
        rect(0, 86, W, 14, '#5a3d2e');
        // warm sunlight over everything
        rect(0, 0, W, H, 'rgba(255,170,90,0.08)');
        // you walk in from the right with a swinging key
        const x = Math.max(150, 214 - q(t, 0.1) * 26);
        const walking = x > 150;
        const bob = walking ? Math.floor(t * 4) % 2 : 0;
        spr('you_office', x, 50 - bob);
        const a = Math.sin(t * (walking ? 7 : 3)) * 0.7;
        const kx = x + 3 + Math.round(Math.sin(a) * 3);
        const ky = 72 - bob + Math.round(Math.cos(a) * 3);
        rect(x + 3, 70 - bob, 1, 2, '#c9a050');
        rect(kx, ky, 3, 2, '#f5c04a');
        rect(kx + 1, ky + 2, 1, 2, '#f5c04a');
      },
    },

    { // 5. inside, the very first brownie
      lines: [
        { text: "Inside, you found Grandma's recipe book." },
        { text: 'Most of the pages were missing. But page one was still there:' },
        { text: '~ BROWNIES ~' },
        { text: 'You had no idea what you were doing. You did it anyway.', on: () => { sfx('jingle'); st.flashUntil = performance.now() + 260; st.brownieAt = performance.now(); } },
        { text: 'Your very first brownie. A little lopsided. Totally perfect.' },
        { who: 'YOU', text: "OKAY. LET'S DO THIS." },
      ],
      draw(t, li, lt) {
        rect(0, 0, W, H, '#8a5a3e');
        for (let y = 10; y < 82; y += 10) rect(0, y, W, 1, '#7a4e35');
        rect(0, 0, W, 4, '#2e1c14');
        rect(0, 82, W, 18, '#6b4a32');
        for (let y = 82; y < H; y += 6) rect(0, y, W, 1, '#4e3424');
        rect(0, 82, W, 1, '#120a07');
        spr('oven', 8, 18);
        const fl = Math.floor(t * 6) % 2;
        glow(32, 60, [34 + fl * 2, 22, 12], 'rgba(120,50,10,0.16)');
        spr('grandma_portrait', 70, 12);
        spr('lamp_on', 180, 4);
        glow(188, 26, [26, 14], 'rgba(120,90,20,0.14)');
        // you behind the counter
        const baker = li >= 3;
        const arms = li >= 5 || (li === 3 && lt < 1.2);
        spr(baker ? (arms ? 'baker_bake' : 'baker_idle') : 'you_office', 104, 28);
        spr('counter', 92, 50);
        // the recipe book
        rect(132, 45, 26, 5, '#120a07');
        rect(133, 45, 12, 4, '#f0e2c8');
        rect(145, 45, 12, 4, '#e6d4b4');
        rect(135, 46, 8, 1, '#8a6a55');
        rect(147, 46, 8, 1, '#8a6a55');
        if (li >= 2 && li < 3) text('~ BROWNIES ~', 145, 40, 7, '#f6e7cf', '#120a07');
        // the first brownie rises with sparkles
        if (li >= 3) {
          const since = (performance.now() - (st.brownieAt || 0)) / 1000;
          const rise = Math.min(1, q(since, 0.1) / 1.2);
          const by = 28 - rise * 20;
          spr('brownie_classic', 135, by);
          for (let k = 0; k < 4; k++) sparkle(133 + (k % 2) * 24, by - 2 + Math.floor(k / 2) * 20, t, k);
        }
      },
    },
  ];

  // ------------------------------------------------------------ end card
  function drawEnd(t) {
    SCENES[4].draw(t, 5, 9);
    rect(0, 0, W, H, 'rgba(29,18,13,0.55)');
    text('DAY 1', W / 2, 36, 24, '#f5c04a', '#120a07');
    text("GRANDMA'S BAKERY", W / 2, 54, 16, '#f6e7cf', '#120a07');
    text('IS OPEN!', W / 2, 66, 16, '#f6e7cf', '#120a07');
    if (Math.random() < 0.5) confetti(6);
  }

  function confetti(n) {
    const cols = ['#f5c04a', '#ff9ad0', '#8fe0b0', '#8fc4e8', '#f6e7cf', '#ff6a8a'];
    for (let i = 0; i < n; i++) {
      parts.push({ x: Math.random() * 640, y: -10, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 80, c: cols[i % cols.length], life: 4 });
    }
  }

  function drawParts(dt) {
    parts = parts.filter(p => (p.life -= dt) > 0 && p.y < 310);
    for (const p of parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x / 3) * 3, Math.round(p.y / 3) * 3, 6, 6);
    }
  }

  // ------------------------------------------------------------ controller
  function sfx(n) { BB.audio.play(n); }

  function curLine() {
    return SCENES[st.scene] && SCENES[st.scene].lines[st.line];
  }

  function startLine() {
    const l = curLine();
    st.chars = 0;
    st.lineStart = performance.now();
    $('speaker').textContent = l.who || '';
    $('line').className = '';
    $('line').textContent = '';
    if (l.on) l.on();
  }

  function setScene(i) {
    st.scene = i;
    st.line = 0;
    st.sceneStart = performance.now();
    if (i >= SCENES.length) {
      st.mode = 'end';
      st.endAt = performance.now();
      $('speaker').textContent = '';
      $('line').className = 'title';
      $('line').textContent = "DAY 1 · GRANDMA'S BAKERY IS OPEN!";
      sfx('fanfare');
      confetti(80);
      return;
    }
    st.mode = 'scene';
    startLine();
  }

  function fadeTo(i) {
    st.fade = { t0: performance.now(), next: i, switched: false };
  }

  function advance() {
    if (!st) return;
    if (st.mode === 'title') {
      $('titleScreen').hidden = true;
      sfx('click');
      setScene(0);
      st.fade = { t0: performance.now() - 400, next: 0, switched: true }; // fade in from black
      return;
    }
    if (st.fade) return;
    if (st.mode === 'end') {
      if (performance.now() - st.endAt > 700) finish();
      return;
    }
    const l = curLine();
    if (st.chars < l.text.length) {
      st.chars = l.text.length;
      return;
    }
    if (st.line + 1 < SCENES[st.scene].lines.length) {
      st.line++;
      startLine();
    } else {
      fadeTo(st.scene + 1);
    }
  }

  function finish() {
    if (!st) return;
    const done = st.onDone;
    st = null;
    parts = [];
    $('intro').hidden = true;
    done();
  }

  function loop(now) {
    if (!st) return;
    const dt = Math.min(0.1, (now - (st.prev || now)) / 1000);
    st.prev = now;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (st.shakeUntil > now) ctx.translate((Math.floor(now / 50) % 2 ? 1 : -1) * 6, (Math.floor(now / 70) % 2 ? 1 : -1) * 3);
    const t = (now - st.sceneStart) / 1000;
    if (st.mode === 'scene') {
      // type the line out with a soft blip
      const l = curLine();
      const want = Math.min(l.text.length, Math.floor(((now - st.lineStart) / 1000) * CPS));
      if (want > st.chars) {
        if (l.text[want - 1] !== ' ' && want % 2 === 0) sfx('blip');
        st.chars = want;
      }
      const shown = l.text.slice(0, st.chars);
      if ($('line').textContent !== shown) $('line').textContent = shown;
      $('more').hidden = st.chars < l.text.length;
      SCENES[st.scene].draw(t, st.line, (now - st.lineStart) / 1000);
    } else if (st.mode === 'end') {
      $('more').hidden = false;
      drawEnd(t);
      if (now - st.endAt > 6000) { ctx.restore(); finish(); return; }
    }
    ctx.restore();
    drawParts(dt);
    if (st.flashUntil > now) {
      ctx.fillStyle = '#fff8dc';
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
    // stepped fade to black between scenes
    if (st.fade) {
      const p = (now - st.fade.t0) / 400; // 0..1 out, 1..2 in
      if (p >= 1 && !st.fade.switched) {
        st.fade.switched = true;
        setScene(st.fade.next);
      }
      const a = p < 1 ? Math.ceil(p * 5) / 5 : Math.ceil((2 - p) * 5) / 5;
      ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0, Math.min(1, a)) + ')';
      ctx.fillRect(0, 0, cv.width, cv.height);
      if (p >= 2) st.fade = null;
    }
    requestAnimationFrame(loop);
  }

  BB.intro = {
    init(img) {
      sheet = img;
      A = BB.ATLAS.frames;
      cv = $('introCanvas');
      ctx = cv.getContext('2d');
      const tb = $('titleBrownie').getContext('2d');
      tb.imageSmoothingEnabled = false;
      const f = A.brownie_classic;
      tb.drawImage(sheet, f.x, f.y, f.w, f.h, 0, 0, f.w * 8, f.h * 8);

      $('introCanvas').addEventListener('pointerdown', e => { e.preventDefault(); advance(); });
      $('dialog').addEventListener('pointerdown', e => { e.preventDefault(); advance(); });
      $('titleScreen').addEventListener('pointerdown', e => { e.preventDefault(); advance(); });
      $('skipBtn').addEventListener('click', () => { sfx('click'); finish(); });
      $('introSound').addEventListener('click', () => BB.audio.toggle());
      window.addEventListener('keydown', e => {
        if (!st) return;
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          if (!e.repeat) advance();
        } else if (e.key === 'Escape') {
          finish();
        }
      });
    },

    start(onDone) {
      st = { mode: 'title', onDone, scene: 0, line: 0, chars: 0, sceneStart: performance.now(), lineStart: 0 };
      parts = [];
      $('intro').hidden = false;
      $('titleScreen').hidden = false;
      $('speaker').textContent = '';
      $('line').textContent = '';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cv.width, cv.height);
      requestAnimationFrame(loop);
    },

    get running() { return !!st; },
  };
})();
