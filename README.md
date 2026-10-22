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

## Releasing an update

1. Bump the version: `python tools/bump_version.py 1.2.0`. It updates `js/version.js` and the `?v=`
   cache-busting on every CSS/JS link in `index.html`. (`npm test` fails if they don't match.)
2. Commit and push to the Pages branch.

Players get the new version on their next visit, no hard refresh needed. The service worker is
registered as `sw.js?v=<version>`, so each release gets its own offline cache. Old caches are
deleted, and open tabs reload into the new version (the game saves first). The game's own files
come from the network first; the cache is only a fallback when offline.

## How it works

| File | What it does |
|---|---|
| `js/data.js` | Every number in the game: helpers and their upgrades, customer upgrades, fix-ups, recipes, special orders, goals. Add new ones here. |
| `js/sim.js` | The simulation. `BB.sim(state)` returns the state one 0.1 s tick later, with no DOM and no hidden randomness (the seed is in the state). Player actions are in `BB.act`. |
| `js/main.js` | Real-time loop, input, autosave (`localStorage`, every 5 s and on `pagehide`), and catching up time away (up to one hour). |
| `js/render.js` | Draws the bakery on a canvas from the sprite sheet, 3x, no smoothing. |
| `js/ui.js` | Top bar, shop panel, goal and order cards, banners, popups. |
| `js/intro.js` | Story cutscenes: the intro and the MegaMuffin ending. |
| `js/audio.js` | Retro WebAudio beeps (sound is off by default). |
| `js/version.js` | The release version (see above). |
| `sw.js` | Service worker for offline play and updates. |

The game runs off the wall clock: each frame it counts how many 0.1 s ticks have passed and
runs the sim that many times. The bakery keeps going in a background tab, and when you come
back after a while it catches up and shows **WELCOME BACK!**

Run the simulation checks with `node tools/test_sim.js` (or `npm test`).

Check the game's pacing with `node tools/pacing.js [hours]`. A bot plays like a kid at school:
20 minutes of clicking every 3 hours, otherwise left open, buying the cheapest thing it can.
The script prints when each item and goal arrives. Use it after changing prices.

Saves carry a version number (`state.v`). `BB.migrate` in `js/sim.js` upgrades older saves, so
players never lose their bakery. Add a step there when the save layout changes.

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

## Beating MegaMuffin

The tall bar on the left fills as the bakery grows. It has four equal parts: brownies sold
(a million fills it, on a log scale so it moves early), stars, recipes unlocked, and one-time
upgrades bought. When it's full, tap it to watch the ending. Then choose:

- **Rebirth:** start over at Day 1 with x1.5 customers and brownies. It stacks (x2.25, x3.4...),
  and the crown under the bar shows how many rebirths you've done.
- **Keep this bakery:** carry on as normal. You can still rebirth later from the bar.

The **Trash Man** (under ORDERS & TRASH MAN, below the bakery) takes all your stale brownies for a
tenth of their price. His fee is 100 fresh brownies, and he comes once a minute.

Workers are limited by kitchen size (10 of each). Back Room, Second Floor and Brownie Factory in
FIX UP raise the limit and unlock the Brownie Robot, the Food Truck and the last recipes.

## Ideas for later

Your old boss visiting the bakery, seasonal events (Halloween!), achievements, and more recipes. New helpers, upgrades, recipes, orders and goals only need entries
in `js/data.js`. Goals are saved by id, so new ones can go anywhere in the list.
