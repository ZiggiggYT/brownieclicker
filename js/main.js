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
  function fit() {
    const k = Math.min(window.innerWidth / 1280, window.innerHeight / 800);
    const st = $('stage');
    st.style.transform = 'scale(' + k + ')';
    st.style.left = Math.max(0, (window.innerWidth - 1280 * k) / 2) + 'px';
    st.style.top = Math.max(0, (window.innerHeight - 800 * k) / 2) + 'px';
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
      { label: 'RESET SAVE', alt: true, onClick: confirmReset },
    ]);
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
      give: () => act('give'),
      startDay: () => act('startDay'),
      menu: openMenu,
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
  // The version in the URL names the cache, so each release installs a fresh worker.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadWorker = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // A new release took over this open tab: save and reload once so it runs the new code.
      if (!hadWorker || reloading) return;
      reloading = true;
      save();
      location.reload();
    });
    navigator.serviceWorker.register('sw.js?v=' + BB.VERSION).then(reg => {
      // Tabs left open all day at school still pick up a new release within the hour.
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
  }
})();
