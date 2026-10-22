// Brownie Baker game data. Every number from the design brief lives here so
// new helpers, recipes, orders and goals can be added without touching the sim.
window.BB = window.BB || {};

BB.DATA = {
  TICK_MS: 100,             // one simulation tick = 0.1 s
  DAY_TICKS: 1800,          // a shop day is 180 s (8 AM to 8 PM)
  NIGHT_TICKS: 80,          // the "DAY DONE" card counts down 8 s
  MAX_CATCHUP_TICKS: 36000, // never simulate more than one hour at once
  PRICE_GROWTH: 1.2,

  STALE_EVERY: 900,         // 90 s (doubled by the Display Case)
  ORDER_GAP: 300,           // ~30 s between special orders
  ORDER_TIME: 900,          // 90 s to fill one
  GOLDEN_LIFE: 120,         // golden brownie floats for 12 s
  RUSH_TICKS: 150,          // BROWNIE RUSH lasts 15 s

  START_STARS: 0.5,
  MIN_STARS: 0.5,
  MAX_STARS: 5,

  helpers: [
    { id: 'nap', name: 'Stop Napping', line: '+1 brownie per click', price: 15, repeat: true, icon: 'icon_pillow',
      banner: 'NO MORE NAPS!' },
    { id: 'coffee', name: 'Morning Coffee', line: 'Bakes 0.5 brownies a second', price: 40, repeat: true, rate: 0.5,
      icon: 'icon_coffee', banner: 'COFFEE IS BREWING!' },
    { id: 'dave', name: 'Hire Dave', line: 'Bakes 1 brownie a second', price: 300, repeat: true, rate: 1,
      icon: 'dave_walk1', banner: 'DAVE JOINED THE TEAM!' },
    { id: 'linda', name: 'Hire Linda', line: 'Customers buy faster', price: 800, repeat: false,
      icon: 'linda_happy', banner: 'LINDA JOINED THE TEAM!' },
    { id: 'oven', name: 'Another Oven', line: 'Bakes 4 brownies a second', price: 2500, repeat: true, rate: 4,
      icon: 'icon_oven', banner: 'ANOTHER OVEN FIRED UP!' },
  ],

  fixes: [
    { id: 'sweep', name: 'Sweep the Dust', line: 'Bye bye cobwebs. +0.5 star', price: 50, stars: 0.5,
      icon: 'icon_broom', banner: 'SPARKLING CLEAN!' },
    { id: 'sign', name: 'Fix the Sign', line: 'All the letters back. More customers', price: 200,
      icon: 'icon_sign', banner: 'THE SIGN IS FIXED!' },
    { id: 'case', name: 'Display Case', line: 'Brownies stay fresh 2x longer', price: 500,
      icon: 'icon_case', banner: 'SHINY NEW DISPLAY CASE!' },
    { id: 'paint', name: 'Paint the Walls', line: 'Cozy striped wallpaper. +0.5 star', price: 1200, stars: 0.5,
      icon: 'icon_paint', banner: 'FRESH NEW WALLS!' },
    { id: 'tables', name: 'Tables & Chairs', line: 'A place to sit. Even more customers', price: 3000,
      icon: 'icon_table', banner: 'TABLES & CHAIRS ARE IN!' },
  ],

  // top/base colours are used for the little tray brownies.
  recipes: [
    { id: 'classic', name: 'Classic Fudge', short: 'CLASSIC FUDGE', price: 1, cost: 0, stars: 0, sprite: 'brownie_classic', top: '#7a4430', base: '#5a3020' },
    { id: 'blondie', name: 'Blondie', short: 'BLONDIE', price: 2, cost: 400, stars: 1, sprite: 'brownie_blondie', top: '#e3b56a', base: '#c98f48' },
    { id: 'mint', name: 'Mint Chip', short: 'MINT CHIP', price: 3, cost: 2000, stars: 2, sprite: 'brownie_mint', top: '#8fe0b0', base: '#5a3020' },
    { id: 'pb', name: 'Peanut Butter', short: 'PEANUT BUTTER', price: 5, cost: 8000, stars: 3, sprite: 'brownie_pb', top: '#e0b070', base: '#5a3020' },
    { id: 'caramel', name: 'Salted Caramel', short: 'SALTED CARAMEL', price: 8, cost: 25000, stars: 4, sprite: 'brownie_caramel', top: '#f0a030', base: '#5a3020' },
    { id: 'golden', name: 'Golden Brownie', hiddenName: '??? (missing page)', short: 'GOLDEN BROWNIE', price: 25, cost: 150000, stars: 5, sprite: 'brownie_golden', top: '#f5c94a', base: '#d9a020' },
  ],

  // Walk-in customers (sprite prefixes from the art kit).
  customers: ['mo', 'pip', 'rose', 'gus', 'jen', 'critic'],

  orders: [
    { who: 'Mo the mail carrier', look: 'mo_happy', qty: 15 },
    { who: 'Pip', look: 'pip_happy', qty: 10 },
    { who: 'Rose next door', look: 'rose_happy', qty: 25 },
    { who: 'The book club', look: 'jen_happy', qty: 40 },
    { who: 'A food critic', look: 'critic_happy', qty: 60 },
    { who: 'Your old boss', look: 'boss_walk1', qty: 100 },
  ],

  // Goals run one at a time. `have` returns [current, target] for the progress bar.
  goals: [
    { text: 'Bake 25 brownies', reward: 15, have: s => [s.totalBaked, 25] },
    { text: 'Buy Morning Coffee', reward: 20, have: s => [s.helpers.coffee, 1] },
    { text: 'Sell 50 brownies', reward: 30, have: s => [s.totalSold, 50] },
    { text: 'Sweep the dust', reward: 40, have: s => [s.fix.sweep ? 1 : 0, 1] },
    { text: 'Pet Fudge the cat', reward: 10, have: s => [s.flags.pet ? 1 : 0, 1] },
    { text: 'Catch a golden brownie', reward: 50, have: s => [s.flags.golden ? 1 : 0, 1] },
    { text: 'Hire Dave', reward: 100, have: s => [s.helpers.dave, 1] },
    { text: 'Reach 1 star', reward: 120, have: s => [s.stars, 1] },
    { text: 'Unlock Blondies', reward: 200, have: s => [s.recipes.blondie ? 1 : 0, 1] },
    { text: 'Fix the sign', reward: 250, have: s => [s.fix.sign ? 1 : 0, 1] },
    { text: 'Sell 1,000 brownies', reward: 500, have: s => [s.totalSold, 1000] },
    { text: 'Hire Linda', reward: 600, have: s => [s.helpers.linda, 1] },
    { text: 'Reach 2 stars', reward: 800, have: s => [s.stars, 2] },
    { text: 'Unlock Mint Chip', reward: 1500, have: s => [s.recipes.mint ? 1 : 0, 1] },
    { text: 'Sell 10,000 brownies', reward: 4000, have: s => [s.totalSold, 10000] },
    { text: 'Reach 3 stars', reward: 5000, have: s => [s.stars, 3] },
    { text: 'Unlock Peanut Butter', reward: 8000, have: s => [s.recipes.pb ? 1 : 0, 1] },
    { text: 'Reach 5 stars', reward: 50000, have: s => [s.stars, 5] },
    { text: 'Find the Golden Brownie', reward: 100000, have: s => [s.recipes.golden ? 1 : 0, 1] },
  ],
  ALL_GOALS_DONE: "All goals done. You're a master baker!",
};
