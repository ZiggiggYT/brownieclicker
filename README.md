# Brownie Baker

A cozy pixel-art idle/clicker game for kids. You got fired from Gray Office Co.,
and now you're bringing Grandma's dusty old bakery back to life, one brownie at a time.

Plain HTML, CSS and JavaScript. No build step, no installs, no login. It runs on school
Chromebooks and keeps working offline once it has loaded.

## Play it locally

**Quickest:** open `index.html` in Chrome (double-click it). Everything works from the file,
except offline caching, which needs a web server.

**With a local server** (same as GitHub Pages):

```sh
python3 -m http.server 8000     # or: npm start
```

Then open <http://localhost:8000>.

## Put it on GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
4. Pick your branch (for example `main`) and the **/ (root)** folder, then **Save**.
5. After a minute the game is live at `https://<your-user>.github.io/<repo-name>/`.

There's nothing to build: Pages serves the files exactly as they are in the repo.

## How it works

| File | What it does |
|---|---|
| `js/data.js` | Every number in the game: helpers, fix-ups, recipes, special orders, goals. Add new ones here. |
| `js/sim.js` | The simulation. `BB.sim(state)` returns the state one 0.1 s tick later, with no DOM and no hidden randomness (the seed is in the state). Player actions are in `BB.act`. |
| `js/main.js` | Real-time loop, input, autosave (`localStorage`, every 5 s and on `pagehide`), and catching up time away (up to one hour). |
| `js/render.js` | Draws the bakery on a canvas from the sprite sheet, 3x, no smoothing. |
| `js/ui.js` | Top bar, shop panel, goal and order cards, banners, popups. |
| `js/intro.js` | The story intro. |
| `js/audio.js` | Retro WebAudio beeps (sound is off by default). |
| `sw.js` | Service worker for offline play. |

The game runs off the wall clock: each frame it counts how many 0.1 s ticks have passed and
runs the sim that many times. The bakery keeps going in a background tab, and when you come
back after a while it catches up and shows **WELCOME BACK!**

Run the simulation checks with `node tools/test_sim.js` (or `npm test`).

Open the browser console and type `BB.game.s` to inspect the live game state.

## Art

All art comes from `tools/sprites.py`, which draws every sprite pixel by pixel:

```sh
pip install pillow
python tools/sprites.py          # writes tools/brownie-baker-art/ (PNGs, spritesheet.png/.json)
python tools/export_assets.py    # copies the sheet into assets/ and writes js/atlas.js
```

`js/atlas.js` is the sprite atlas as a script, so the game also works when opened straight
from disk, where browsers won't `fetch()` a JSON file.

Fonts are Press Start 2P and VT323 from Google Fonts, with a monospace fallback when offline.

## Ideas for later

The MegaMuffin rival storyline, your old boss visiting, seasonal events (Halloween!),
achievements, and more recipes. New helpers, recipes, orders and goals only need entries in
`js/data.js`. Saves from older versions merge onto a fresh state, so new fields get their
default values.
