// Brownie Baker: boot, real-time game loop, input and saving.
//
// The game is driven by the wall clock: every frame we work out how many
// 0.1 s ticks have passed since the last one (Date.now()) and run the sim that
// many times. That keeps the bakery going in a background tab, and the same
// sim catches up the time you were away when the game is opened again.
(function () {
  const D = BB.DATA;
  const SAVE_KEY = 'brownieBaker.save.v1';
  const SAVE_EVERY_MS = 5000;
  const AWAY_POPUP_MS = 60000; // a gap this long (e.g. a background tab) gets a WELCOME BACK

  const G = {
    s: null,       // live sim state
    last: 0,       // Date.now() of the last simulated tick
    lastSave: 0,
    playing: false,
    resetting: false,
  };
  const $ = id => document.getElementById(id);
  BB.game = G; // handy from the browser console: BB.game.s is the live state

  // ------------------------------------------------------------ layout
  // The stage is always 800 tall and as wide as the window's shape allows (at
  // least 1280), so there are no empty bars at the sides. Extra width goes to
  // the bakery first (until the goal strip under it would get too thin), then
  // to the shop panel.
  const STAGE_H = 800;
  function fit() {
    const sw = Math.max(1280, Math.round((STAGE_H * window.innerWidth) / window.innerHeight));
    const k = Math.min(window.innerWidth / sw, window.innerHeight / STAGE_H);
    const st = $('stage');
    st.style.width = sw + 'px';
    st.style.transform = 'scale(' + k + ')';
    st.style.left = Math.max(0, (window.innerWidth - sw * k) / 2) + 'px';
    st.style.top = Math.max(0, (window.innerHeight - STAGE_H * k) / 2) + 'px';
    layout(sw);
  }

  function place(id, x, y, w, h) {
    const el = $(id).style;
    el.left = x + 'px';
    el.top = y + 'px';
    if (w != null) el.width = w + 'px';
    if (h != null) el.height = h + 'px';
  }

  function layout(sw) {
    const LEFT = 76; // the MegaMuffin bar sits in front of this
    const GAP = 16;
    const TOP = 80;
    const BOTTOM = 784;
    const sceneW = Math.max(820, Math.min(990, sw - LEFT - GAP - 352 - GAP));
    const shopW = Math.min(520, sw - LEFT - GAP - sceneW - GAP);
    const off = Math.max(0, Math.floor((sw - (LEFT + sceneW + GAP + shopW + GAP)) / 2)); // very wide screens
    const sceneH = Math.round((sceneW * 552) / 876);
    const stripY = TOP + sceneH + GAP;
    place('megaBar', 12 + off, TOP);
    place('sceneWrap', LEFT + off, TOP, sceneW, sceneH);
    place('bottom', LEFT + off, stripY, sceneW, BOTTOM - stripY);
    place('shop', LEFT + off + sceneW + GAP, TOP, shopW);
  }

  // ------------------------------------------------------------ saving
  function save() {
    if (!G.s || G.resetting) return;
    try {
      const state = Object.assign({}, G.s, { fx: [] });
      localStorage.setItem(SAVE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
      G.lastSave = Date.now();
    } catch (e) { /* storage full or blocked: keep playing */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.state || !(data.state.v >= 1)) return null;
      return { state: BB.migrate(data.state), savedAt: data.savedAt || Date.now() };
    } catch (e) {
      return null;
    }
  }

  // ------------------------------------------------------------ catch-up
  // Run the sim for the ticks between `from` and now (max one hour) and report what was earned.
  function catchUp(s, from) {
    const ticks = Math.max(0, Math.min(D.MAX_CATCHUP_TICKS, Math.floor((Date.now() - from) / D.TICK_MS)));
    const before = s.totalEarned;
    const out = BB.simN(s, ticks);
    out.fx = [];
    return { s: out, earned: out.totalEarned - before, ticks };
  }

  function welcomeBack(earned) {
    BB.ui.modal('WELCOME BACK!', 'While you were away, your bakery earned $' + BB.fmt(earned), [
      { label: 'YAY!', onClick: () => BB.audio.play('coin') },
    ]);
  }

  // ------------------------------------------------------------ the loop
  function advance() {
    if (!G.s) return;
    const now = Date.now();
    let n = Math.floor((now - G.last) / D.TICK_MS);
    if (n <= 0) return;
    if (n * D.TICK_MS >= AWAY_POPUP_MS) {
      // The tab was asleep for a while: catch up in one go and say hello.
      const r = catchUp(G.s, G.last);
      G.s = r.s;
      G.last = now;
      if (G.playing && r.earned > 0) welcomeBack(r.earned);
      return;
    }
    n = Math.min(n, D.MAX_CATCHUP_TICKS);
    G.last += n * D.TICK_MS;
    G.s = BB.simN(G.s, n);
  }

  function drainEvents() {
    const s = G.s;
    if (!s.fx.length) return;
    const pnow = performance.now();
    const visible = G.playing && !document.hidden;
    for (const e of s.fx) {
      if (!visible) continue;
      BB.render.onEvent(e, s, pnow);
      BB.ui.onEvent(e, s);
      sound(e);
    }
    s.fx = [];
  }

  function sound(e) {
    const map = {
      bake: 'bake', sale: 'coin', buy: 'buy', goal: 'buy', rush: 'golden', bonus: 'golden', meow: 'meow',
      orderNew: 'bell', orderDone: 'coin', aww: 'sad', dayEnd: 'jingle', dayStart: 'bell', goldenIn: 'bell',
      lunch: 'jingle', parade: 'golden', megaFull: 'fanfare', trash: 'trash',
    };
    if (map[e.k]) BB.audio.play(map[e.k]);
  }

  function frame() {
    advance();
    if (G.s) {
      drainEvents();
      if (G.playing) {
        BB.render.draw(G.s, performance.now());
        BB.ui.update(G.s);
      }
      if (Date.now() - G.lastSave > SAVE_EVERY_MS) save();
    }
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ input
  function act(name, a, b) {
    if (!G.s) return false;
    advance(); // act on the up-to-date state
    const ok = BB.act[name](G.s, a, b);
    drainEvents();
    return ok;
  }

  function sceneClick(ev) {
    ev.preventDefault();
    const cv = $('scene');
    const r = cv.getBoundingClientRect();
    const cx = ((ev.clientX - r.left) * cv.width) / r.width;
    const cy = ((ev.clientY - r.top) * cv.height) / r.height;
    const what = BB.render.hit(G.s, cx, cy);
    if (what === 'golden') act('catchGolden');
    else if (what === 'cat') act('pet');
    else if (what === 'brownie') act('bake');
  }

  function onKey(ev) {
    if (ev.code !== 'Space' && ev.key !== ' ') return;
    if (!G.playing || BB.ui.modalOpen() || !$('intro').hidden) return;
    ev.preventDefault();
    if (!ev.repeat) act('bake');
  }

  function openMenu() {
    BB.ui.modal('MENU', '', [
      { label: 'BACK TO BAKING' },
      { label: 'REPLAY THE STORY', alt: true, onClick: () => playIntro(false) },
      ...(G.s.beaten ? [{ label: 'REPLAY THE ENDING', alt: true, onClick: () => { G.playing = false; $('game').hidden = true; BB.intro.start(showGame, 'ending'); } }] : []),
      { label: 'RESET SAVE', alt: true, onClick: confirmReset },
    ]);
  }

  // ------------------------------------------------------------ MegaMuffin, ending, rebirth
  function megaMenu() {
    const s = G.s;
    const p = BB.megaParts(s);
    const pc = v => Math.floor(v * 100) + '%';
    const body = (s.beaten ? 'You beat MegaMuffin Corp! You can rebirth any time.' : 'Grow your bakery to beat MegaMuffin Corp!') +
      '\n\nBrownies sold: ' + pc(p.sold) + '\nStars: ' + pc(p.stars) +
      '\nRecipes: ' + pc(p.recipes) + '\nUpgrades bought: ' + pc(p.upgrades);
    const buttons = [{ label: 'KEEP BAKING' }];
    if (BB.megaProgress(s) >= 1 && !s.beaten) buttons.unshift({ label: 'SEE THE ENDING!', onClick: playEnding });
    if (s.beaten) buttons.push({ label: 'REBIRTH...', alt: true, onClick: confirmRebirth });
    BB.ui.modal('BEAT MEGAMUFFIN: ' + pc(BB.megaProgress(s)), body, buttons);
  }

  function playEnding() {
    G.playing = false;
    $('game').hidden = true;
    BB.intro.start(() => {
      act('beat');
      showGame();
      chooseRebirth();
    }, 'ending');
  }

  function chooseRebirth() {
    const next = Math.pow(BB.DATA.REBIRTH_BOOST, G.s.rebirths + 1);
    BB.ui.modal('YOU BEAT MEGAMUFFIN!', 'Start a brand new bakery with x' + next + ' customers and brownies forever, or keep playing this one?', [
      { label: 'REBIRTH: x' + next + ' BOOST', onClick: doRebirth },
      { label: 'KEEP THIS BAKERY', alt: true, focus: true, onClick: () => BB.ui.banner('KEEP ON BAKING!', 'cream') },
    ]);
  }

  function confirmRebirth() {
    const next = Math.pow(BB.DATA.REBIRTH_BOOST, G.s.rebirths + 1);
    BB.ui.modal('REBIRTH?', 'You start over at Day 1 with a brand new bakery, but customers and brownies are x' + next + ' forever.', [
      { label: 'NOT YET' },
      { label: 'YES, REBIRTH!', alt: true, onClick: doRebirth },
    ]);
  }

  function doRebirth() {
    advance();
    G.s = BB.rebirth(G.s);
    G.last = Date.now();
    save();
    BB.ui.reset();
    BB.audio.play('fanfare');
    BB.ui.banner('REBIRTH #' + G.s.rebirths + '! x' + BB.boost(G.s) + ' BOOST', '', true);
  }

  function confirmReset() {
    BB.ui.modal('ARE YOU SURE?', 'This deletes your whole bakery and starts over from Day 1.', [
      { label: 'NO, KEEP IT' },
      {
        label: 'YES, RESET', alt: true, onClick: () => {
          G.resetting = true;
          try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
          location.reload();
        },
      },
    ]);
  }

  // ------------------------------------------------------------ start up
  function showGame() {
    $('intro').hidden = true;
    $('game').hidden = false;
    G.playing = true;
    BB.ui.reset();
  }

  function newGame() {
    G.s = BB.newState();
    G.last = Date.now();
    save();
    showGame();
  }

  function playIntro(first) {
    G.playing = false;
    $('game').hidden = true;
    BB.intro.start(first ? newGame : showGame);
  }

  function boot(img) {
    BB.render.init($('scene'), img);
    BB.ui.init(img, {
      state: () => G.s,
      buy(kind, id) {
        const fn = { helper: 'buyHelper', up: 'buyUpgrade', cust: 'buyCust', fix: 'buyFix', recipe: 'unlockRecipe' }[kind];
        if (!act(fn, id)) BB.audio.play('click');
      },
      give: () => { if (act('give')) BB.ui.closeTasks(); },
      trash: () => act('trash'),
      startDay: () => act('startDay'),
      menu: openMenu,
      mega: megaMenu,
    });
    BB.intro.init(img);
    $('loading').hidden = true;

    $('scene').addEventListener('pointerdown', sceneClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) save();
      else advance();
    });
    // rAF stops in background tabs; this keeps time moving (and saving) there too.
    setInterval(() => {
      if (!document.hidden) return;
      advance();
      if (G.s) G.s.fx = [];
      if (Date.now() - G.lastSave > SAVE_EVERY_MS) save();
    }, 1000);

    const saved = load();
    if (saved) {
      const r = catchUp(saved.state, saved.savedAt);
      G.s = r.s;
      G.last = Date.now();
      showGame();
      if (r.ticks >= 50) welcomeBack(r.earned);
    } else {
      playIntro(true);
    }
    requestAnimationFrame(frame);
  }

  fit();
  window.addEventListener('resize', fit);
  BB.audio.set(BB.audio.on); // sync the SOUND buttons with the saved setting
  const img = new Image();
  img.onload = () => boot(img);
  img.onerror = () => { $('loading').textContent = 'Could not load assets/spritesheet.png'; };
  img.src = 'assets/spritesheet.png?v=' + BB.VERSION;

  // Offline support once the game has been loaded from a web server (e.g. GitHub Pages).
  // The version in the URL names the cache, so each release installs a fresh worker
  // (which reloads open tabs when it takes over; see sw.js).
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js?v=' + BB.VERSION).then(reg => {
      // Tabs left open all day at school still pick up a new release within the hour.
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
  }
})();
