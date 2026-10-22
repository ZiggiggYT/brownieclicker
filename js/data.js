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
  ORDER_GAP: 600,           // ~60 s between special orders
  ORDER_TIME: 900,          // 90 s to fill one
  ORDER_STARS: 0.1,
  GOLDEN_LIFE: 120,         // golden brownie floats for 12 s
  RUSH_TICKS: 150,          // BROWNIE RUSH lasts 15 s

  START_STARS: 0.5,
  MIN_STARS: 0.5,
  MAX_STARS: 5,

  // Workers. `rate` bakes brownies a second, `sells` delivers them. Each worker has
  // upgrades that show up under it in the HELPERS tab once you own one; `needs` is
  // how many of that worker you need first (`unit` names them) and `mult` multiplies its output.
  helpers: [
    { id: 'nap', name: 'Stop Napping', line: '+1 brownie per click', price: 15, repeat: true, icon: 'icon_pillow',
      banner: 'NO MORE NAPS!', unit: '', upgrades: [
        { id: 'mitts', name: 'Oven Mitts', line: 'Your clicks bake 2x', price: 120, needs: 1, mult: 2, icon: 'icon_mitts', banner: 'COZY OVEN MITTS!' },
        { id: 'pin', name: "Grandma's Rolling Pin", line: 'Your clicks bake 2x', price: 2500, needs: 5, mult: 2, icon: 'icon_rollingpin', banner: "GRANDMA'S ROLLING PIN!" },
        { id: 'spatula', name: 'Golden Spatula', line: 'Your clicks bake 3x', price: 150000, needs: 15, mult: 3, icon: 'icon_spatula', banner: 'THE GOLDEN SPATULA!' },
      ] },
    { id: 'coffee', name: 'Morning Coffee', line: 'Bakes 0.5 brownies a second', price: 40, repeat: true, rate: 0.5,
      icon: 'icon_coffee', banner: 'COFFEE IS BREWING!', unit: 'COFFEES', upgrades: [
        { id: 'espresso', name: 'Espresso', line: 'Coffee bakes 2x faster', price: 350, needs: 1, mult: 2, icon: 'icon_espresso', banner: 'ESPRESSO TIME!' },
        { id: 'fancymug', name: 'Fancy Mug', line: 'Coffee bakes 2x faster', price: 3000, needs: 5, mult: 2, icon: 'icon_fancymug', banner: 'SO FANCY!' },
        { id: 'pot', name: 'Bottomless Pot', line: 'Coffee bakes 2x faster', price: 80000, needs: 15, mult: 2, icon: 'icon_coffeepot', banner: 'BOTTOMLESS COFFEE!' },
      ] },
    { id: 'dave', name: 'Hire Dave', line: 'Bakes 1 brownie a second', price: 300, repeat: true, rate: 1,
      icon: 'dave_walk1', banner: 'DAVE JOINED THE TEAM!', unit: 'DAVES', upgrades: [
        { id: 'whisk', name: 'Better Whisk', line: 'Daves bake 2x faster', price: 1800, needs: 1, mult: 2, icon: 'icon_whisk', banner: 'WHISK WHISK WHISK!' },
        { id: 'shoes', name: 'Speed Shoes', line: 'Daves zoom around. 2x faster', price: 9000, needs: 3, mult: 2, icon: 'icon_shoes', banner: 'ZOOM ZOOM, DAVE!' },
        { id: 'trays', name: 'Double Trays', line: 'Daves carry 2 trays. 2x faster', price: 90000, needs: 8, mult: 2, icon: 'icon_trays', banner: 'DOUBLE TRAYS!' },
      ] },
    { id: 'linda', name: 'Hire Linda', line: 'Customers buy faster', price: 800, repeat: false,
      icon: 'linda_happy', banner: 'LINDA JOINED THE TEAM!', unit: '', upgrades: [
        { id: 'smile', name: 'Friendly Smile', line: 'More stars, and some buy 1 extra', price: 2500, needs: 1, icon: 'icon_smile', banner: 'WHAT A SMILE!' },
        { id: 'register', name: 'Speedy Register', line: 'Checkout is instant. Ka-ching!', price: 7000, needs: 1, icon: 'icon_register', banner: 'KA-CHING!' },
      ] },
    { id: 'bike', name: 'Delivery Bike', line: 'Delivers 0.5 brownies a second around town', price: 1500, repeat: true, sells: 0.5,
      icon: 'icon_bike', banner: 'DELIVERIES ARE ROLLING!', unit: 'BIKES', upgrades: [
        { id: 'basket', name: 'Cargo Basket', line: 'Bikes deliver 2x more', price: 12000, needs: 3, mult: 2, icon: 'icon_basket', banner: 'BIG BASKETS!' },
        { id: 'ebike', name: 'Electric Bikes', line: 'Bikes deliver 2x more', price: 150000, needs: 8, mult: 2, icon: 'icon_ebike', banner: 'ELECTRIC BIKES! BZZT!' },
      ] },
    { id: 'oven', name: 'Another Oven', line: 'Bakes 4 brownies a second', price: 2500, repeat: true, rate: 4,
      icon: 'icon_oven', banner: 'ANOTHER OVEN FIRED UP!', unit: 'OVENS', upgrades: [
        { id: 'fire', name: 'Hotter Fire', line: 'Ovens bake 2x faster', price: 20000, needs: 1, mult: 2, icon: 'icon_fire', banner: 'HOTTER FIRE!' },
        { id: 'pans', name: 'Bigger Pans', line: 'Ovens bake 2x faster', price: 200000, needs: 6, mult: 2, icon: 'icon_pans', banner: 'BIGGER PANS!' },
        { id: 'magic', name: 'Magic Flame', line: 'Ovens bake 3x faster', price: 2000000, needs: 12, mult: 3, icon: 'icon_magicflame', banner: 'A MAGIC FLAME?!' },
      ] },
    { id: 'robot', name: 'Brownie Robot', line: 'Bakes 20 brownies a second. Beep!', price: 60000, repeat: true, rate: 20, after: 'backroom',
      icon: 'robot1', banner: 'BEEP BOOP! A ROBOT!', unit: 'ROBOTS', upgrades: [
        { id: 'oil', name: 'Oil Change', line: 'Robots bake 2x faster', price: 450000, needs: 3, mult: 2, icon: 'icon_oil', banner: 'SMOOTH ROBOTS!' },
        { id: 'turbo', name: 'Turbo Mode', line: 'Robots bake 3x faster', price: 5000000, needs: 8, mult: 3, icon: 'icon_turbo', banner: 'TURBO MODE!' },
      ] },
    { id: 'truck', name: 'Food Truck', line: 'Sells 5 brownies a second all over town', price: 120000, repeat: true, sells: 5, after: 'upstairs',
      icon: 'icon_truck', banner: 'FOOD TRUCK ON THE ROAD!', unit: 'TRUCKS', upgrades: [
        { id: 'bigtruck', name: 'Bigger Truck', line: 'Trucks sell 2x more', price: 900000, needs: 3, mult: 2, icon: 'icon_bigtruck', banner: 'BIGGER TRUCKS!' },
        { id: 'song', name: 'Truck Song', line: 'A catchy tune! Trucks sell 2x more', price: 7000000, needs: 10, mult: 2, icon: 'icon_music', banner: 'DING DING DING!' },
      ] },
  ],
  // How many of each repeatable worker fit in the kitchen. Kitchen expansions
  // in FIX UP raise it (and unlock the Robot, Food Truck and late recipes).
  HELPER_CAP: 10,

  // Things that bring in more (and hungrier) customers. Shown in the CUSTOMERS tab.
  // visits: +x customers, queue: line length, extra: brownies per customer.
  customerUps: [
    { id: 'window', name: 'Window Display', line: '+25% customers', price: 150, visits: 0.25, icon: 'icon_display', banner: 'WHAT A WINDOW!' },
    { id: 'samples', name: 'Free Samples', line: 'Every customer buys 1 more', price: 450, extra: 1, icon: 'icon_samples', banner: 'FREE SAMPLES! YUM!' },
    { id: 'flyers', name: 'Flyers Around Town', line: '+30% customers', price: 900, visits: 0.3, icon: 'icon_flyer', banner: 'FLYERS EVERYWHERE!' },
    { id: 'line1', name: 'Bigger Line', line: 'Room for 4 people in line', price: 1200, queue: 4, icon: 'icon_line', banner: 'MORE ROOM IN LINE!' },
    { id: 'tipjar', name: 'Tip Jar', line: '1 in 4 customers leaves a tip', price: 2000, icon: 'icon_tipjar', banner: 'TIPS WELCOME!' },
    { id: 'news', name: 'Newspaper Ad', line: '+50% customers', price: 8000, visits: 0.5, icon: 'icon_news', banner: 'YOU MADE THE NEWS!' },
    { id: 'line2', name: 'Even Bigger Line', line: 'Room for 5 people in line', price: 10000, queue: 5, after: 'line1', icon: 'icon_line', banner: 'THE LINE GOES ON!' },
    { id: 'rush', name: 'Rush Hour', line: 'Lunch rush! 3x customers 11 AM to 1 PM', price: 20000, icon: 'icon_rush', banner: 'LUNCH RUSH IS ON!' },
    { id: 'party', name: 'Party Boxes', line: 'Some customers buy a box of 6', price: 45000, icon: 'icon_party', banner: 'PARTY BOXES!' },
    { id: 'tv', name: 'TV Commercial', line: '+100% customers', price: 400000, visits: 1, icon: 'icon_tv', banner: "YOU'RE ON TV!" },
    { id: 'billboard', name: 'Giant Billboard', line: '+100% customers', price: 1500000, visits: 1, icon: 'icon_billboard', banner: 'BIGGEST BILLBOARD EVER!' },
    { id: 'blogger', name: 'Famous Food Blogger', line: 'Every customer buys 2 more', price: 4000000, extra: 2, icon: 'icon_blogger', banner: 'YOU WENT VIRAL!' },
    { id: 'fanclub', name: 'Brownie Fan Club', line: 'Half of all customers leave a tip', price: 10000000, tipChance: 0.5, icon: 'icon_fanclub', banner: 'BROWNIE FAN CLUB!' },
  ],
  TIP_CHANCE: 0.25,
  PARTY_CHANCE: 0.12,
  LUNCH: [0.25, 5 / 12], // 11 AM to 1 PM as a fraction of the day

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
    { id: 'backroom', name: 'Back Room', line: 'Room for 25 of each worker. Robots!', price: 6000, cap: 25,
      icon: 'icon_backroom', banner: 'THE BAKERY GOT BIGGER!' },
    { id: 'neon', name: 'Neon Sign', line: 'It glows! +20% customers', price: 15000, visits: 0.2,
      icon: 'icon_neon', banner: 'SO SHINY!' },
    { id: 'floor', name: 'Checkered Floor', line: 'Fancy floor. +0.25 star', price: 50000, stars: 0.25,
      icon: 'icon_floor', banner: 'FANCY FLOOR!' },
    { id: 'upstairs', name: 'Second Floor', line: 'Room for 60 of each worker. Food Trucks!', price: 150000, cap: 60,
      icon: 'icon_upstairs', banner: 'A WHOLE SECOND FLOOR!' },
    { id: 'fountain', name: 'Chocolate Fountain', line: 'Golden brownies show up 2x as often', price: 400000, golden: 2,
      icon: 'icon_fountain', banner: 'CHOCOLATE FOUNTAIN!' },
    { id: 'factory', name: 'Brownie Factory', line: 'Room for 150 of each worker', price: 2500000, cap: 150,
      icon: 'icon_factory', banner: 'BROWNIE FACTORY!' },
    { id: 'frame', name: 'Golden Grandma', line: 'Grandma is proud! All baking 1.5x', price: 8000000, bake: 1.5,
      icon: 'icon_frame', banner: 'GRANDMA IS SO PROUD!' },
  ],

  // top/base colours are used for the little tray brownies.
  recipes: [
    { id: 'classic', name: 'Classic Fudge', short: 'CLASSIC FUDGE', price: 1, cost: 0, stars: 0, sprite: 'brownie_classic', top: '#7a4430', base: '#5a3020' },
    { id: 'blondie', name: 'Blondie', short: 'BLONDIE', price: 2, cost: 400, stars: 1, sprite: 'brownie_blondie', top: '#e3b56a', base: '#c98f48' },
    { id: 'mint', name: 'Mint Chip', short: 'MINT CHIP', price: 3, cost: 2000, stars: 2, sprite: 'brownie_mint', top: '#8fe0b0', base: '#5a3020' },
    { id: 'pb', name: 'Peanut Butter', short: 'PEANUT BUTTER', price: 5, cost: 8000, stars: 3, sprite: 'brownie_pb', top: '#e0b070', base: '#5a3020' },
    { id: 'caramel', name: 'Salted Caramel', short: 'SALTED CARAMEL', price: 8, cost: 25000, stars: 4, sprite: 'brownie_caramel', top: '#f0a030', base: '#5a3020' },
    { id: 'golden', name: 'Golden Brownie', hiddenName: '??? (missing page)', short: 'GOLDEN BROWNIE', price: 25, cost: 150000, stars: 5, sprite: 'brownie_golden', top: '#f5c94a', base: '#d9a020' },
    // `after`: needs that kitchen expansion first
    { id: 'smores', name: "S'mores Brownie", short: "S'MORES", price: 40, cost: 700000, stars: 5, after: 'upstairs', sprite: 'brownie_smores', top: '#fbf6ec', base: '#5a3020' },
    { id: 'rainbow', name: 'Rainbow Brownie', short: 'RAINBOW', price: 65, cost: 4000000, stars: 5, after: 'factory', sprite: 'brownie_rainbow', top: '#ff6a6a', base: '#5a3020' },
    { id: 'galaxy', name: 'Galaxy Brownie', short: 'GALAXY', price: 100, cost: 15000000, stars: 5, after: 'factory', sprite: 'brownie_galaxy', top: '#4a2a7a', base: '#2a1a4a' },
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

  // Goals run one at a time, in this order. Ids are stored in the save, so add new
  // goals anywhere but never rename an id. `have` returns [current, target].
  goals: [
    { id: 'bake25', text: 'Bake 25 brownies', reward: 15, have: s => [s.totalBaked, 25] },
    { id: 'coffee', text: 'Buy Morning Coffee', reward: 20, have: s => [s.helpers.coffee, 1] },
    { id: 'sell50', text: 'Sell 50 brownies', reward: 30, have: s => [s.totalSold, 50] },
    { id: 'sweep', text: 'Sweep the dust', reward: 40, have: s => [s.fix.sweep ? 1 : 0, 1] },
    { id: 'pet', text: 'Pet Fudge the cat', reward: 10, have: s => [s.flags.pet ? 1 : 0, 1] },
    { id: 'window', text: 'Buy a Window Display', reward: 40, have: s => [s.cust.window ? 1 : 0, 1] },
    { id: 'golden', text: 'Catch a golden brownie', reward: 50, have: s => [s.flags.golden ? 1 : 0, 1] },
    { id: 'mitts', text: 'Get Oven Mitts', reward: 60, have: s => [s.ups.mitts ? 1 : 0, 1] },
    { id: 'dave', text: 'Hire Dave', reward: 100, have: s => [s.helpers.dave, 1] },
    { id: 'star1', text: 'Reach 1 star', reward: 120, have: s => [s.stars, 1] },
    { id: 'blondie', text: 'Unlock Blondies', reward: 200, have: s => [s.recipes.blondie ? 1 : 0, 1] },
    { id: 'sign', text: 'Fix the sign', reward: 250, have: s => [s.fix.sign ? 1 : 0, 1] },
    { id: 'bike', text: 'Get a Delivery Bike', reward: 300, have: s => [s.helpers.bike, 1] },
    { id: 'sell1k', text: 'Sell 1,000 brownies', reward: 500, have: s => [s.totalSold, 1000] },
    { id: 'linda', text: 'Hire Linda', reward: 600, have: s => [s.helpers.linda, 1] },
    { id: 'tipjar', text: 'Put out a Tip Jar', reward: 700, have: s => [s.cust.tipjar ? 1 : 0, 1] },
    { id: 'backroom', text: 'Build the Back Room', reward: 1500, have: s => [s.fix.backroom ? 1 : 0, 1] },
    { id: 'star2', text: 'Reach 2 stars', reward: 800, have: s => [s.stars, 2] },
    { id: 'order5', text: 'Finish 5 special orders', reward: 1000, have: s => [s.ordersDone || 0, 5] },
    { id: 'mint', text: 'Unlock Mint Chip', reward: 1500, have: s => [s.recipes.mint ? 1 : 0, 1] },
    { id: 'shoes', text: 'Get Speed Shoes for Dave', reward: 2500, have: s => [s.ups.shoes ? 1 : 0, 1] },
    { id: 'sell10k', text: 'Sell 10,000 brownies', reward: 4000, have: s => [s.totalSold, 10000] },
    { id: 'star3', text: 'Reach 3 stars', reward: 5000, have: s => [s.stars, 3] },
    { id: 'pb', text: 'Unlock Peanut Butter', reward: 8000, have: s => [s.recipes.pb ? 1 : 0, 1] },
    { id: 'rush', text: 'Start a Lunch Rush', reward: 10000, have: s => [s.cust.rush ? 1 : 0, 1] },
    { id: 'caramel', text: 'Unlock Salted Caramel', reward: 20000, have: s => [s.recipes.caramel ? 1 : 0, 1] },
    { id: 'robot', text: 'Get a Brownie Robot', reward: 30000, have: s => [s.helpers.robot, 1] },
    { id: 'star5', text: 'Reach 5 stars', reward: 50000, have: s => [s.stars, 5] },
    { id: 'goldrecipe', text: 'Find the Golden Brownie', reward: 100000, have: s => [s.recipes.golden ? 1 : 0, 1] },
    { id: 'upstairs', text: 'Build the Second Floor', reward: 100000, have: s => [s.fix.upstairs ? 1 : 0, 1] },
    { id: 'sell100k', text: 'Sell 100,000 brownies', reward: 150000, have: s => [s.totalSold, 100000] },
    { id: 'truck', text: 'Get a Food Truck', reward: 150000, have: s => [s.helpers.truck, 1] },
    { id: 'tv', text: 'Get on TV', reward: 200000, have: s => [s.cust.tv ? 1 : 0, 1] },
    { id: 'smores', text: "Unlock S'mores Brownies", reward: 300000, have: s => [s.recipes.smores ? 1 : 0, 1] },
    { id: 'mega75', text: 'Fill the MegaMuffin bar to 75%', reward: 500000, have: s => [BB.megaProgress(s), 0.75] },
    { id: 'factory', text: 'Build the Brownie Factory', reward: 1000000, have: s => [s.fix.factory ? 1 : 0, 1] },
    { id: 'rainbow', text: 'Unlock Rainbow Brownies', reward: 2000000, have: s => [s.recipes.rainbow ? 1 : 0, 1] },
    { id: 'galaxy', text: 'Unlock Galaxy Brownies', reward: 5000000, have: s => [s.recipes.galaxy ? 1 : 0, 1] },
    { id: 'beat', text: 'Beat MegaMuffin!', reward: 0, have: s => [s.beaten ? 1 : 0, 1] },
  ],

  // The "Beat MegaMuffin" bar: four equal parts, each 0..1. It's full when the
  // bakery has sold a million brownies, has 5 stars, and owns every recipe and
  // every one-time upgrade.
  MEGA_SOLD: 1e6,
  REBIRTH_BOOST: 1.5, // per rebirth, stacking: customers and brownies
  // The first 19 goals of v1, in order: a v1 save's goal index means these are done.
  V1_GOALS: ['bake25', 'coffee', 'sell50', 'sweep', 'pet', 'golden', 'dave', 'star1', 'blondie', 'sign', 'sell1k',
    'linda', 'star2', 'mint', 'sell10k', 'star3', 'pb', 'star5', 'goldrecipe'],
  ALL_GOALS_DONE: "All goals done. You're a master baker!",
  ALL_GOALS_REBIRTH: 'You beat MegaMuffin! Keep baking, or tap the bar to rebirth.',
};
