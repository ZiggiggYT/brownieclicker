// Retro WebAudio beeps. Sound is OFF by default (kids play at school).
(function () {
  const KEY = 'brownieBaker.sound';
  let ctx = null;
  let on = false;
  try { on = localStorage.getItem(KEY) === 'on'; } catch (e) { /* storage blocked */ }

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // One square/triangle note with an optional pitch slide.
  function tone(freq, dur, opts) {
    const o = opts || {};
    const c = ac();
    if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const vol = o.vol || 0.04;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function notes(list, gap, opts) {
    const start = (opts && opts.delay) || 0;
    list.forEach((f, i) => tone(f, gap * 1.6, Object.assign({}, opts, { delay: start + i * gap })));
  }

  const SOUNDS = {
    bake: () => tone(520 + Math.random() * 80, 0.06, { vol: 0.03 }),
    coin: () => { tone(988, 0.06, { vol: 0.03 }); tone(1319, 0.12, { vol: 0.03, delay: 0.06 }); },
    buy: () => notes([523, 659, 784, 1047], 0.07, { vol: 0.035 }),
    golden: () => notes([784, 988, 1175, 1568, 1976], 0.05, { type: 'triangle', vol: 0.06 }),
    meow: () => { tone(700, 0.12, { to: 1100, type: 'triangle', vol: 0.06 }); tone(1100, 0.2, { to: 600, type: 'triangle', vol: 0.06, delay: 0.12 }); },
    blip: () => tone(380 + Math.random() * 40, 0.025, { type: 'triangle', vol: 0.025 }),
    boom: () => { tone(110, 0.5, { to: 40, type: 'sine', vol: 0.25 }); tone(60, 0.6, { to: 30, type: 'square', vol: 0.05 }); },
    jingle: () => notes([659, 784, 988, 1319], 0.1, { type: 'triangle', vol: 0.06 }),
    fanfare: () => { notes([523, 523, 523, 659], 0.12, { vol: 0.04 }); notes([784, 1047], 0.22, { vol: 0.045, delay: 0.48 }); },
    sad: () => { tone(392, 0.15, { type: 'triangle', vol: 0.04 }); tone(330, 0.3, { type: 'triangle', vol: 0.04, delay: 0.15 }); },
    bell: () => { tone(1568, 0.15, { type: 'triangle', vol: 0.04 }); tone(1319, 0.25, { type: 'triangle', vol: 0.04, delay: 0.12 }); },
    click: () => tone(660, 0.03, { vol: 0.02 }),
    trash: () => { tone(330, 0.25, { to: 70, vol: 0.05 }); tone(160, 0.3, { to: 50, type: 'triangle', vol: 0.06, delay: 0.15 }); },
  };

  BB.audio = {
    get on() { return on; },
    set(v) {
      on = !!v;
      try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ }
      if (on) ac();
      document.querySelectorAll('[data-sound-label]').forEach(el => { el.textContent = 'SOUND ' + (on ? 'ON' : 'OFF'); });
    },
    toggle() { this.set(!on); if (on) SOUNDS.click(); },
    play(name) {
      if (!on || !SOUNDS[name]) return;
      try { SOUNDS[name](); } catch (e) { /* audio is optional */ }
    },
  };
})();
