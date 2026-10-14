/* ==========================================================================
   SAND ALCHEMY — simulation
   The world is a grid of cells, one byte per cell for the material plus a
   few side arrays (life, shade, fuel). Each frame every cell gets one turn,
   bottom row first, so falling things settle in a single pass.
   ========================================================================== */
(function () {
  'use strict';
  const { M, MATS, COUNT, RX, KEEP, IGNITERS, MAGIC } = window.SandMats;
  const TRUNK = 200; // fuel tag on wood that is still growing into a tree

  // Fast, small random number generator (xorshift32).
  let seed = (Date.now() ^ 0x9e3779b9) >>> 0 || 1;
  function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
  function ri(n) { return (rnd() * n) | 0; }

  // Per-material lookups as flat arrays (faster than objects in the hot loop).
  const KIND = new Uint8Array(COUNT), DENS = new Float32Array(COUNT), SLIP = new Float32Array(COUNT);
  const FLAM = new Float32Array(COUNT), BURN = new Uint16Array(COUNT), SPREAD = new Uint8Array(COUNT);
  const K = { empty: 0, powder: 1, liquid: 2, gas: 3, solid: 4, fire: 5, spark: 6, cloud: 7, float: 8, skypowder: 9, rocket: 10, creature: 11, stamp: 12 };
  const REACTIVE = new Uint8Array(COUNT);
  MATS.forEach((m) => {
    KIND[m.id] = K[m.kind]; DENS[m.id] = m.density; SLIP[m.id] = m.slip; FLAM[m.id] = m.flam;
    BURN[m.id] = m.burn; SPREAD[m.id] = m.spread || 0;
  });
  for (let a = 0; a < COUNT; a++) {
    if (IGNITERS.has(a)) REACTIVE[a] = 1;
    for (let b = 0; b < COUNT; b++) if (RX[a * COUNT + b]) REACTIVE[a] = 1;
  }

  // Creature lookups: what they can move through, swim in, dig through, and what kills them.
  const MAX_CREATURES = 500;
  const OPEN = new Uint8Array(COUNT), WATERY = new Uint8Array(COUNT), SOIL = new Uint8Array(COUNT);
  const DEADLY = new Uint8Array(COUNT), HOT = new Uint8Array(COUNT);
  for (let m = 0; m < COUNT; m++) {
    const k = KIND[m];
    if (k === K.gas || k === K.cloud || k === K.float || k === K.spark) OPEN[m] = 1;
  }
  [M.WATER, M.SEAWATER, M.SWAMP, M.POTION].forEach((m) => { WATERY[m] = 1; });
  [M.DIRT, M.MUD, M.SAND, M.ASH, M.CLAY].forEach((m) => { SOIL[m] = 1; });
  [M.FIRE, M.COLDFIRE, M.GHOSTFIRE, M.ETERNAL, M.LAVA, M.ACID, M.PLASMA, M.LIGHTNING, M.EMBER, M.VOID, M.ROCKET, M.VIRUS, M.ANTIMATTER, M.MOLTENGOLD].forEach((m) => { DEADLY[m] = 1; });
  [M.FIRE, M.GHOSTFIRE, M.ETERNAL, M.LAVA, M.PLASMA, M.LIGHTNING, M.EMBER].forEach((m) => { HOT[m] = 1; });
  const BUGS = new Uint8Array(COUNT), FISHY = new Uint8Array(COUNT);
  BUGS[M.FIREFLY] = BUGS[M.BEE] = BUGS[M.ANT] = BUGS[M.BUTTERFLY] = BUGS[M.CATERPILLAR] = 1; FISHY[M.FISH] = FISHY[M.TADPOLE] = 1;
  const SNAKE_FOOD = new Uint8Array(COUNT); [M.FROG, M.ANT, M.RABBIT, M.EGG, M.MOUSE].forEach((m) => { SNAKE_FOOD[m] = 1; });
  // Abilities per creature (see materials.js), and what counts as fire for the fireproof.
  const ABIL = []; MATS.forEach((m) => { if (m && m.abil) ABIL[m.id] = m.abil; });
  const FX = []; // effects an invented element has on the world around it (wind, frost, sparks...)
  // How hard each explosive goes off (gunpowder = 1). Other explosive inventions use 1.6.
  const BOOM = new Float32Array(COUNT); BOOM[M.GUNPOWDER] = 1; BOOM[M.NITRO] = 3; BOOM[M.TNT] = 2.2; BOOM[M.C4] = 3.6; BOOM[M.HYDROGEN] = 0.8; BOOM[M.EXPLJELLY] = 1.8;
  // Third wave: what each new thing can't touch.
  const PROOF = new Uint8Array(COUNT); // walls, holes and portals: nothing breaks, eats or infects them
  [M.WALL, M.BLACKHOLE, M.WHITEHOLE, M.PORTALIN, M.PORTALOUT, M.CAULDRON].forEach((m) => { PROOF[m] = 1; });
  const NOFADE = new Uint8Array(COUNT); [M.NEON, M.HYDROGEN, M.OXYGEN, M.ANTIMATTER].forEach((m) => { NOFADE[m] = 1; }); // gases that never fade away
  const MELTABLE = new Uint8Array(COUNT); // what white-hot thermite melts into lava
  [M.METAL, M.STEEL, M.IRON, M.COPPER, M.RUST, M.STONE, M.BRICK, M.OBSIDIAN, M.SANDSTONE, M.GLASS, M.DIAMOND, M.MAGNET, M.BATTERY,
    M.GOLD, M.CRYSTAL, M.VACUUM, M.CLAY].forEach((m) => { MELTABLE[m] = 1; });
  const boomOf = (m) => BOOM[m] || 1.6;
  const FIERY = new Uint8Array(COUNT);
  [M.FIRE, M.COLDFIRE, M.GHOSTFIRE, M.ETERNAL, M.LAVA, M.PLASMA, M.LIGHTNING, M.EMBER, M.ROCKET, M.HEATCRYSTAL, M.MOLTENGOLD].forEach((m) => { FIERY[m] = 1; });
  const blend = (under, over) => { // mix a see-through sprite pixel over what's below
    const a = (over >>> 24) / 255, b = 1 - a;
    const r = (over & 255) * a + (under & 255) * b, g = ((over >> 8) & 255) * a + ((under >> 8) & 255) * b, bl = ((over >> 16) & 255) * a + ((under >> 16) & 255) * b;
    const ua = under >>> 24, oa = over >>> 24;
    return ((Math.max(ua, oa) << 24) | ((bl & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
  };
  // Essence that touches these comes to life as a creature.
  const LIFE_FROM = new Uint8Array(COUNT);
  LIFE_FROM[M.SEAWATER] = M.FISH; LIFE_FROM[M.CLOUD] = M.BIRD; LIFE_FROM[M.STORM] = M.BIRD; LIFE_FROM[M.MUD] = M.WORM;
  LIFE_FROM[M.EMBER] = M.FIREFLY; LIFE_FROM[M.SWAMP] = M.FROG; LIFE_FROM[M.HONEY] = M.BEE;
  LIFE_FROM[M.MOSS] = M.SNAIL; LIFE_FROM[M.CACTUS] = M.LIZARD; LIFE_FROM[M.SNOW] = M.PENGUIN; LIFE_FROM[M.ICE] = M.PENGUIN;
  LIFE_FROM[M.SALT] = M.CRAB; LIFE_FROM[M.SAND] = M.ANT; // sand mostly grows sprouts; now and then an ant
  // Sprites as packed colours (-1 for see-through).
  const SPRITES = [];
  function buildSprite(m) {
    if (!m || !m.sprite) { if (m) SPRITES[m.id] = undefined; return; }
    const col = (ch) => { if (ch === '.' || !m.pal[ch]) return 0; const [r, g, b, a] = window.SandMats.hex(m.pal[ch]); return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0; };
    const out = { ax: m.ax, ay: m.ay };
    for (const st in m.sprite) out[st] = m.sprite[st].map((fr) => fr.map((row) => [...row].map(col)));
    SPRITES[m.id] = out;
  }
  MATS.forEach(buildSprite);

  // Element properties (see materials.js "props").
  const PROP = new Uint8Array(COUNT), STICKY = new Uint8Array(COUNT), BOUNCE = new Uint8Array(COUNT), ATTRACT = new Uint8Array(COUNT);
  const CONDUCT = new Uint8Array(COUNT), POWER = new Uint8Array(COUNT), VOLATILE = new Uint8Array(COUNT), MAGNETIC = new Uint8Array(COUNT);
  const EVAP = [], MELTS = [], FREEZES = [], SETS = [], GROWS = [], GLOWS = [];
  /* Glow (bloom): how brightly each material gives off light, 0-255. Fire-like
     things are worked out per cell from their age instead (bright when new, fading out). */
  const EMIT = new Uint8Array(COUNT);
  [[M.ETERNAL, 200], [M.LAVA, 205], [M.MOLTENGOLD, 200], [M.EMBER, 170], [M.PLASMA, 230], [M.LIGHTNING, 255], [M.FIREWORK, 220],
    [M.ROCKET, 210], [M.NEON, 150], [M.GLOWSTONE, 160], [M.STAR, 170], [M.LIQLIGHT, 180], [M.GLOWMOSS, 95], [M.HEATCRYSTAL, 150],
    [M.PLUTONIUM, 95], [M.FAIRY, 110], [M.SPARKLE, 130], [M.STARDUST, 55], [M.PORTALIN, 85], [M.PORTALOUT, 85], [M.WHITEHOLE, 130],
    [M.ANTIMATTER, 110], [M.FIREFLOWER, 70], [M.ELECMUSH, 85], [M.NEBULA, 60]].forEach(([m, k]) => { EMIT[m] = k; });
  // What lava (or melted gold) hardens into stays red-hot for a while, then cools down.
  const LAVA_GLOW = ((255 << 24) | (8 << 16) | (45 << 8) | 255) >>> 0; // lava lights things up red-orange
  const COOLS = new Uint8Array(COUNT); [M.STONE, M.OBSIDIAN, M.PUMICE, M.METAL, M.GOLD, M.GLASS].forEach((m) => { COOLS[m] = 1; });
  /* Temperature (°C) that a material holds its surroundings at. NaN = it just takes on the heat around it. */
  const TEMP = new Float32Array(COUNT).fill(NaN);
  [[M.FIRE, 700], [M.ETERNAL, 700], [M.EMBER, 600], [M.LAVA, 1100], [M.MOLTENGOLD, 1100], [M.PLASMA, 3000],
    [M.HEATCRYSTAL, 250], [M.STEAM, 105], [M.COLDFIRE, -60], [M.ICE, -10], [M.SNOW, -8], [M.FROSTCRYSTAL, -40],
    [M.DRYICE, -78], [M.LN2, -196]].forEach(([m, v]) => { TEMP[m] = v; });
  const ROOM = 20, TB = 4; // room temperature, and heat is tracked in blocks of 4x4 cells
  const PLANTISH = new Uint8Array(COUNT); [M.PLANT, M.VINE, M.MOSS, M.FLOWER, M.MUSHROOM, M.CACTUS, M.GLOWMOSS, M.FIREFLOWER, M.FROSTFERN, M.CORAL].forEach((m) => { if (m) PLANTISH[m] = 1; });
  const FLYMOVE = { fly: 1, flutter: 1 }, SWIMMOVE = { swim: 1, paddle: 1, drift: 1, amphibian: 1 };
  const COLD = new Uint8Array(COUNT); [M.ICE, M.SNOW, M.FROSTCRYSTAL, M.COLDFIRE, M.DRYICE, M.LN2].forEach((m) => { COLD[m] = 1; });
  function buildProps(mt) {
    const m = mt.id;
    STICKY[m] = BOUNCE[m] = ATTRACT[m] = MAGNETIC[m] = CONDUCT[m] = POWER[m] = VOLATILE[m] = PROP[m] = 0;
    EVAP[m] = MELTS[m] = FREEZES[m] = SETS[m] = GROWS[m] = GLOWS[m] = undefined;
    const p = mt.props; if (!p) return;
    if (p.sticky) STICKY[m] = 1; if (p.bounce) BOUNCE[m] = 1; if (p.attracted) ATTRACT[m] = 1; if (p.magnet) MAGNETIC[m] = 1;
    if (p.conducts) CONDUCT[m] = 1; if (p.power) POWER[m] = 1; if (p.volatile) VOLATILE[m] = 1;
    if (p.evaporates) EVAP[m] = p.evaporates; if (p.melts) MELTS[m] = p.melts; if (p.freezes) FREEZES[m] = p.freezes;
    if (p.sets) SETS[m] = p.sets; if (p.grows) GROWS[m] = p.grows; if (p.glow) GLOWS[m] = p.glow;
    if (EVAP[m] || MELTS[m] || FREEZES[m] || SETS[m] || GROWS[m] || CONDUCT[m] || POWER[m]) PROP[m] = 1;
    if (p.cold) COLD[m] = 1;
  }
  MATS.forEach(buildProps);

  /* Inventions: refresh every lookup for one material after the AI adds it. */
  let COLORVER = 1;
  const MOVE = []; MATS.forEach((m) => { if (m && m.move) MOVE[m.id] = m.move; }); // built-in creatures that use the shared movements
  // Inventions that act like a built-in element: the grid holds the built-in, and a
  // 'skin' layer remembers which invention it really is (for its colours and name).
  const LIKE = new Uint16Array(COUNT);
  function refresh(id) {
    const m = MATS[id];
    LIKE[id] = m.like || 0;
    KIND[id] = K[m.kind] || 0; DENS[id] = m.density; SLIP[id] = m.slip; FLAM[id] = m.flam; BURN[id] = m.burn; SPREAD[id] = m.spread || 0;
    REACTIVE[id] = IGNITERS.has(id) ? 1 : 0;
    for (let b = 0; b < COUNT; b++) { if (RX[id * COUNT + b]) REACTIVE[id] = 1; if (RX[b * COUNT + id]) REACTIVE[b] = 1; }
    const k = KIND[id]; OPEN[id] = (k === K.gas || k === K.cloud || k === K.float || k === K.spark) ? 1 : 0;
    if (IGNITERS.has(id)) { FIERY[id] = 1; HOT[id] = 1; }
    if (m.props && m.props.hot) DEADLY[id] = 1;
    buildProps(m); buildSprite(m);
    if (m.skinGlow) GLOWS[id] = m.skinGlow; // an invention that acts like something else can still glow
    ABIL[id] = m.abil; MOVE[id] = m.move; FX[id] = m.fx;
    COLORVER++;
  }
  const SPARK_RGB = ((255 << 24) | (255 << 16) | (250 << 8) | 170) >>> 0; // electricity in a wire

  // Neighbour offsets (dx, dy) for the 8 surrounding cells.
  const NX = [-1, 0, 1, -1, 1, -1, 0, 1], NY = [-1, -1, -1, 0, 0, 1, 1, 1];

  class World {
    constructor(w, h) {
      this.w = w; this.h = h; const n = w * h;
      this.t = new Uint16Array(n);      // material
      this.life = new Uint8Array(n);    // countdown / growth energy
      this.shade = new Uint8Array(n);   // colour variation
      this.fuel = new Uint16Array(n);   // for fire: what is burning
      this.stamp = new Uint8Array(n);   // moved-this-frame marker
      this.vx = new Float32Array(n); this.vy = new Float32Array(n); // bouncy-ball velocity
      this.fx = new Float32Array(n); this.fy = new Float32Array(n); // and sub-cell position
      this.skin = new Uint16Array(n);   // which invention a cell really is (see LIKE)
      this.tint = new Uint16Array(n);   // painted cells: whose colours they show (they still act like themselves)
      this.heat = new Uint8Array(n);    // freshly hardened lava: how hot it still is (glows, then cools)
      this.hasTint = false;
      this.hasSkins = false; this.curBase = 0; this.curSkin = 0;
      this.clock = 1;
      this.frame = 0;
      this.clouds = 0;
      this.discovered = new Uint8Array(COUNT);
      this.onDiscover = null;
      this.pendingBlasts = [];
      this.flying = [];         // grains thrown by explosions, flying through the air
      this.airOn = false;       // the air simulation sleeps until something stirs it
      this.blastsNow = 0;       // explosions this frame: a chain reaction throws things harder
      this.zeroG = false;       // zero gravity: grains and liquids float, only holes pull
      this.userPaint = false;   // set while you paint, so your own strokes don't count as 'grown' or 'transformed'
      this.newTally();
      this.dayT = 0.1;          // time of day (0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight)
      this.tw = Math.ceil(w / TB); this.th = Math.ceil(h / TB);
      this.temp = new Float32Array(this.tw * this.th).fill(ROOM); // temperature of each 4x4 block
      this.tempNext = new Float32Array(this.tw * this.th); this.tSum = new Float32Array(this.tw * this.th); this.tN = new Uint16Array(this.tw * this.th); this.tFull = new Uint16Array(this.tw * this.th);
      this.sfx = { boom: 0, boomX: 0.5, booms: 0, bolt: 0, boltX: 0.5, portal: 0, gulp: 0, spat: 0, born: 0, lost: 0, hatched: 0 }; // what happened since the game last looked (sounds and stats)
      this.creatures = [];
      this.magnets = []; this.hasSticky = false; this.hasBouncy = false;
      for (let i = 0; i < n; i++) this.shade[i] = ri(256);
      this.discovered[M.SPARKLE] = 1; // visual effects, not things to find
      this.discovered[M.ROCKET] = 1;
    }

    /* Put material m at cell i. Anything new to the player is discovered here,
       which is the only place natural reactions create materials. */
    put(i, m, life) {
      if (KIND[m] === K.stamp) { this.placeStamp(m, i % this.w, (i / this.w) | 0); return; }
      if (KIND[m] === K.creature) { this.spawn(m, i % this.w, (i / this.w) | 0); return; } // creatures live above the grid
      // An invention that acts like a built-in element is stored as that element plus its skin.
      // Copies a skinned cell makes of itself (spreading flames, a bolt's path) keep the skin.
      let sk = 0;
      if (LIKE[m]) { sk = m; m = LIKE[m]; this.hasSkins = true; if (!this.discovered[sk]) { this.discovered[sk] = 1; if (this.onDiscover) this.onDiscover(sk); } }
      else if (this.curSkin && m === this.curBase) { sk = this.curSkin; this.hasSkins = true; }
      this.skin[i] = sk;
      if (this.hasTint) this.tint[i] = 0;
      const was = this.t[i];
      this.heat[i] = (was === M.LAVA || was === M.MOLTENGOLD) && COOLS[m] ? 255 : 0;
      if (was !== m && !this.userPaint) {
        const T = this.tally; if (was) T.trans++;
        if (m === M.ASH) T.ash++; else if (m === M.OBSIDIAN) T.obs++; else if (m === M.CHOCOLATE || m === M.MELTCHOC) T.choc++; else if (m === M.STORM) T.storms++;
        else if (m === M.WATER) { if (was === M.ICE || was === M.SNOW) T.melt++; } else if (m === M.STEAM) { if (was === M.WATER || was === M.SEAWATER) T.boil++; }
        if ((was === M.LAVA || was === M.MOLTENGOLD) && COOLS[m]) T.cooled++;
        if (PLANTISH[m]) T.plants++;
        if (was === M.SEED) T.seeds++;
      }
      this.t[i] = m;
      this.life[i] = life != null ? life : this.defaultLife(m);
      this.fuel[i] = 0;
      this.shade[i] = ri(256);
      if (BOUNCE[m]) { this.vx[i] = this.vy[i] = this.fx[i] = this.fy[i] = 0; this.hasBouncy = true; }
      if (m && !sk && !this.discovered[m]) { this.discovered[m] = 1; if (this.onDiscover) this.onDiscover(m); }
    }
    defaultLife(m) {
      switch (m) {
        case M.FIRE: return 30 + ri(45);
        case M.COLDFIRE: return 40 + ri(50);
        case M.STEAM: return 120 + ri(110);
        case M.SMOKE: return 140 + ri(100); // counted down every 3rd frame
        case M.CLOUD: return 4 + ri(5);
        case M.LIGHTNING: return 4 + ri(5);
        case M.PLANT: return 0;
        case M.ESSENCE: return 150 + ri(100);  // counted down every 4th frame
        case M.SPIRIT: return 200 + ri(55);
        case M.BUBBLE: return 120 + ri(120);
        case M.VINE: return 20 + ri(16);          // growing energy
        case M.CACTUS: return 6 + ri(8);
        case M.EMBER: return 150 + ri(100);       // counted down every 3rd frame
        case M.FOG: return 180 + ri(75);          // counted down every 4th frame
        case M.PLASMA: return 30 + ri(30);
        case M.GHOSTFIRE: return 70 + ri(60);
        case M.STORM: return 10 + ri(8);          // how much rain it holds
        case M.ROCKET: return 14 + ri(12);        // how high it flies
        case M.CORAL: return 18 + ri(14);         // how far it can still grow
        default:
          if (MATS[m].invented) { if (KIND[m] === K.gas) return 150 + ri(100); if (GROWS[m]) return 16 + ri(12); }
          return 0;
      }
    }
    // Counters for the stats page. The game reads them now and then and starts a fresh tally.
    newTally() {
      this.tally = { fell: 0, rx: 0, trans: 0, ash: 0, melt: 0, boil: 0, cooled: 0, obs: 0, choc: 0, plants: 0, seeds: 0, storms: 0, rain: 0, fires: 0,
        blastCells: 0, bigBlast: 0, launched: 0, grav: 0, portalMax: 0, loopMax: 0, bhMax: 0, whMax: 0, steps: 0, flyDist: 0, swimDist: 0, frogs: 0, bugs: 0, cows: 0,
        kos: 0, falls: 0, jumps: 0, stickDist: 0, oldest: 0, deaths: {}, species: {}, rxBy: {} };
    }
    swap(i, j) {
      const t = this.t, l = this.life, s = this.shade, f = this.fuel;
      let v = t[i]; t[i] = t[j]; t[j] = v;
      v = l[i]; l[i] = l[j]; l[j] = v;
      v = s[i]; s[i] = s[j]; s[j] = v;
      v = f[i]; f[i] = f[j]; f[j] = v;
      const hh = this.heat; v = hh[i]; hh[i] = hh[j]; hh[j] = v;
      if (this.hasTint) { const p = this.tint; v = p[i]; p[i] = p[j]; p[j] = v; }
      if (this.hasBouncy && (BOUNCE[t[i]] || BOUNCE[t[j]])) {
        const X = this.vx, Y = this.vy, P = this.fx, Q = this.fy;
        v = X[i]; X[i] = X[j]; X[j] = v; v = Y[i]; Y[i] = Y[j]; Y[j] = v;
        v = P[i]; P[i] = P[j]; P[j] = v; v = Q[i]; Q[i] = Q[j]; Q[j] = v;
      }
      if (this.hasSkins) { const k = this.skin; v = k[i]; k[i] = k[j]; k[j] = v; }
      this.stamp[j] = this.clock;
    }

    /* Can material m move into cell j? Empty and gas always give way;
       lighter liquids give way to heavier powders and liquids. */
    yields(m, j) {
      const b = this.t[j];
      if (b === 0) return true;
      const kb = KIND[b];
      if (kb === K.gas || kb === K.fire || kb === K.cloud || kb === K.float || kb === K.spark) return KIND[m] !== K.gas && KIND[m] !== K.float;
      if (kb === K.liquid) return DENS[b] < DENS[m] && rnd() < 0.6;
      return false;
    }

    ignite(j) {
      const b = this.t[j];
      { const t = this.t, w = this.w; if (t[j - 1] !== M.FIRE && t[j + 1] !== M.FIRE && t[j - w] !== M.FIRE && t[j + w] !== M.FIRE) this.tally.fires++; }
      if (b === M.GUNPOWDER) { this.blast(j % this.w, (j / this.w) | 0, 1); return; }
      if (b === M.FIREWORK) { this.put(j, M.ROCKET); return; }
      if (b === M.FROSTBOMB) { this.frostBlast(j % this.w, (j / this.w) | 0); return; }
      if (b === M.TNT || b === M.THERMITE) { // a fuse: TNT fizzes then goes off; thermite burns white-hot for a while
        if (!this.fuel[j]) { this.fuel[j] = 1; this.life[j] = b === M.TNT ? 40 + ri(25) : 150 + ri(70); }
        return;
      }
      if (b === M.HYDROGEN) { // burns with a pop and leaves water; with oxygen about, it explodes
        const w = this.w, x = j % w, y = (j / w) | 0; let ox = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= this.h) continue;
          const q = yy * w + xx; if (this.t[q] === M.OXYGEN) { this.t[q] = 0; ox++; }
        }
        this.put(j, M.FIRE, ox ? 10 + ri(8) : 5 + ri(6)); this.fuel[j] = M.HYDROGEN;
        if (ox >= 2) this.pendingBlasts.push(x, y, Math.min(1.8, 0.5 + ox * 0.1));
        else if (ox) this.airPop(x, y, 1);
        return;
      }
      if (VOLATILE[b]) { this.t[j] = 0; this.blast(j % this.w, (j / this.w) | 0, boomOf(b)); return; }
      this.put(j, M.FIRE, Math.min(255, BURN[b] + ri(BURN[b] + 20)));
      this.fuel[j] = b;
    }

    blast(cx, cy, power) {
      power = power || 1;
      { const S = this.sfx; S.booms++; if (power > S.boom) { S.boom = power; S.boomX = cx / this.w; } }
      this.hurtCreatures(cx, cy, Math.round(8 * (0.7 + 0.3 * power)), 'burn');
      const r = Math.round((5 + ri(3)) * (0.75 + 0.25 * power)), w = this.w, h = this.h; // nitro digs a bigger crater
      this.t[cy * w + cx] = 0;
      { let n = 0; for (const c of this.creatures) if (!c.dead && (c.x - cx) ** 2 + (c.y - cy) ** 2 < (r * 1.6) ** 2) n++; this.tally.launched += n; }
      let crater = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const j = y * w + x, b = this.t[j];
        if (b === M.METAL || b === M.OBSIDIAN || b === M.DIAMOND || b === M.BRICK || b === M.STEEL || PROOF[b] || b === M.VACUUM) continue;
        if (b) { crater++; this.tally.blastCells++; }
        if (b === M.GUNPOWDER) { this.t[j] = 0; this.pendingBlasts.push(x, y, 1); continue; }
        if (b === M.GEODE) { this.put(j, rnd() < 0.75 ? M.CRYSTAL : M.STARDUST); continue; } // cracks open: crystals inside
        if (b === M.TNT || b === M.HYDROGEN) { this.t[j] = 0; this.pendingBlasts.push(x, y, BOOM[b]); continue; } // a blast sets TNT off straight away
        if (b === M.THERMITE) { if (!this.fuel[j]) { this.fuel[j] = 1; this.life[j] = 150 + ri(70); } continue; }
        if (b === M.GRAVBOMB) { this.fuel[j] = 1; this.life[j] = 1 + ri(3); continue; }
        if (b === M.PLUTONIUM) { this.t[j] = 0; if (power >= 3 && rnd() < 0.12) this.pendingBlasts.push(x, y, 3); continue; } // a chain reaction
        if (VOLATILE[b]) { this.t[j] = 0; this.pendingBlasts.push(x, y, boomOf(b)); continue; } // nitro caught in a blast goes off too
        if (b === M.GLASS) { this.put(j, M.SAND); continue; }
        if (b === M.STONE) { if (rnd() < 0.5) this.put(j, M.SAND); continue; }
        if (b === M.WATER) { if (rnd() < 0.5) this.put(j, M.STEAM); continue; }
        if (rnd() < 0.45) this.put(j, M.FIRE, 6 + ri(14)); else if (b !== M.CRYSTAL) this.t[j] = 0;
      }
      if (crater > (this.tally.bigBlast || 0)) this.tally.bigBlast = crater;
      this.shove(cx, cy, r, power);
    }
    /* ---------------- Air ----------------
       The air is a coarse grid (one air cell per 4x4 world cells) with pressure and wind. An explosion
       pushes the pressure up; it spreads out as a blast of wind, bounces off walls and squeezes through
       gaps, then calms down. Strong enough wind picks up loose things: light ash and snow first, sand
       and dirt in a real blast, heavy gold and iron only right next to it. */
    initAir() {
      const A = 4; this.A = A; this.aw = Math.ceil(this.w / A); this.ah = Math.ceil(this.h / A);
      const n = this.aw * this.ah;
      this.au = new Float32Array(n); this.av = new Float32Array(n); this.ap = new Float32Array(n); this.ap2 = new Float32Array(n);
      this.asolid = new Uint8Array(n); this.airOn = false; this.airAge = 0;
    }
    shove(cx, cy, r, power) {
      power = power || 1;
      if (!this.au) this.initAir();
      const A = this.A, ax = Math.min(this.aw - 1, (cx / A) | 0), ay = Math.min(this.ah - 1, (cy / A) | 0);
      if (!this.airOn) { this.airSolids(); this.airOn = true; }
      const add = (x, y, k) => { if (x < 0 || y < 0 || x >= this.aw || y >= this.ah) return; const i = y * this.aw + x; this.ap[i] += k * Math.max(0.15, 1 - this.ap[i] / 80); this.asolid[i] = 0; };
      add(ax, ay, 7 * power);
      add(ax - 1, ay, 3 * power); add(ax + 1, ay, 3 * power); add(ax, ay - 1, 3 * power); add(ax, ay + 1, 3 * power);
      if (power > 1.5) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [0, -2], [0, 2]]) add(ax + dx, ay + dy, 1.5 * power); // a big blast pushes a wider patch of air
      this.airAge = 0;
    }
    // Which air cells are blocked by walls (mostly solid things that don't move).
    airSolids() {
      const A = this.A, w = this.w, h = this.h, t = this.t, aw = this.aw;
      for (let ay = 0; ay < this.ah; ay++) for (let ax = 0; ax < aw; ax++) {
        let solid = 0, tot = 0;
        for (let y = ay * A; y < Math.min(h, ay * A + A); y++) for (let x = ax * A; x < Math.min(w, ax * A + A); x++) {
          tot++; const k = KIND[t[y * w + x]];
          if (k === K.solid || k === K.powder || k === K.liquid || k === K.skypowder) solid++;
        }
        this.asolid[ay * aw + ax] = solid * 4 >= tot * 3 ? 1 : 0; // packed sand counts as ground too
      }
    }
    stepAir() {
      const aw = this.aw, ah = this.ah, u = this.au, v = this.av, S = this.asolid;
      let p = this.ap, q = this.ap2;
      if (++this.airAge % 6 === 0) this.airSolids();
      const dt = 0.5;
      for (let sub = 0; sub < 2; sub++) {
        // Wind blows from high pressure to low.
        for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
          const i = y * aw + x; if (S[i]) { u[i] = v[i] = 0; continue; }
          const pc = p[i];
          const pl = x > 0 && !S[i - 1] ? p[i - 1] : pc, pr = x < aw - 1 && !S[i + 1] ? p[i + 1] : pc;
          const pt = y === 0 ? 0 : !S[i - aw] ? p[i - aw] : pc;       // the sky above is open
          const pb = y < ah - 1 && !S[i + aw] ? p[i + aw] : pc;
          u[i] -= dt * (pr - pl) * 0.5; v[i] -= dt * (pb - pt) * 0.5;
        }
        // Air that piles up raises the pressure; air that leaves lowers it.
        for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
          const i = y * aw + x; if (S[i]) { q[i] = 0; continue; }
          const ul = x > 0 && !S[i - 1] ? u[i - 1] : 0, ur = x < aw - 1 && !S[i + 1] ? u[i + 1] : 0;
          const vt = y === 0 ? v[i] : !S[i - aw] ? v[i - aw] : 0, vb = y < ah - 1 && !S[i + aw] ? v[i + aw] : 0;
          let np = p[i] - dt * ((ur - ul) * 0.5 + (vb - vt) * 0.5);
          // a touch of smoothing keeps it from going speckly
          const nl = x > 0 && !S[i - 1] ? p[i - 1] : p[i], nr = x < aw - 1 && !S[i + 1] ? p[i + 1] : p[i];
          const nt = y > 0 && !S[i - aw] ? p[i - aw] : p[i], nb = y < ah - 1 && !S[i + aw] ? p[i + aw] : p[i];
          np = np * 0.9 + (nl + nr + nt + nb) * 0.025;
          q[i] = np * 0.985;
        }
        const tmp = p; p = q; q = tmp;
      }
      this.ap = p; this.ap2 = q;
      let energy = 0;
      for (let i = 0; i < u.length; i++) { u[i] *= 0.975; v[i] *= 0.975; const e = Math.abs(p[i]) + Math.abs(u[i]) + Math.abs(v[i]); if (e > energy) energy = e; }
      if (energy < 0.03) { u.fill(0); v.fill(0); p.fill(0); q.fill(0); this.airOn = false; return; }
      this.windMoves();
    }
    windAt(x, y) { if (!this.airOn) return null; const ax = Math.min(this.aw - 1, Math.max(0, (x / this.A) | 0)), ay = Math.min(this.ah - 1, Math.max(0, (y / this.A) | 0)), i = ay * this.aw + ax; return [this.au[i], this.av[i]]; }
    // The wind picks up whatever it's strong enough to lift.
    windMoves() {
      const A = this.A, aw = this.aw, w = this.w, h = this.h, t = this.t, fly = this.flying, u = this.au, v = this.av;
      const open = (m) => m === 0 || KIND[m] === K.gas || KIND[m] === K.fire || KIND[m] === K.spark || KIND[m] === K.cloud;
      for (let ay = this.ah - 1; ay >= 0; ay--) for (let ax = 0; ax < aw; ax++) {
        let ai = ay * aw + ax;
        if (this.asolid[ai] && ay > 0 && !this.asolid[ai - aw]) ai -= aw; // the top of the ground feels the air just above it
        const raw = Math.sqrt(u[ai] * u[ai] + v[ai] * v[ai]);
        if (raw < 0.3) continue;
        const sp = Math.min(raw, 6), wu = u[ai] / raw * sp, wv = v[ai] / raw * sp; // even a huge blast tops out
        // also feel the wind from the cell next door, so the edge of the ground gets hit
        for (let y = Math.min(h, ay * A + A) - 1; y >= ay * A; y--) for (let x = ax * A; x < Math.min(w, ax * A + A); x++) {
          const j = y * w + x, m = t[j]; if (!m || BOUNCE[m]) continue;
          const k = KIND[m];
          if (k === K.gas || k === K.fire && m !== M.ETERNAL) {
            if (rnd() < sp * 1.5) { const nx = Math.round(x + wu * 3), ny = Math.round(y + wv * 3); if (nx >= 0 && ny >= 0 && nx < w && ny < h && t[ny * w + nx] === 0) this.swap(j, ny * w + nx); }
            continue;
          }
          if (k !== K.powder && k !== K.liquid && k !== K.skypowder) continue;
          // Only grains the air can actually reach (an open side) get picked up.
          if (!((y > 0 && open(t[j - w])) || (x > 0 && open(t[j - 1])) || (x < w - 1 && open(t[j + 1])) || (y < h - 1 && open(t[j + w])))) continue;
          const weight = DENS[m] * (k === K.liquid ? 1.6 : 1) * (STICKY[m] ? 3 : 1);
          const need = 0.25 + weight * 0.18 + weight * weight * 0.03; // ash ~0.37, sand ~0.9, gold ~3.6 (only right by a big blast)
          if (sp < need || rnd() > Math.min(0.7, (sp - need) / need)) continue;
          if (fly.length > 4000) return;
          const boost = 2.4 / (0.6 + weight * 0.25);      // light things are thrown faster
          fly.push({ m, sk: this.hasSkins ? this.skin[j] : 0, l: this.life[j], s: this.shade[j], x, y,
            vx: Math.max(-9, Math.min(9, wu * boost + (rnd() - 0.5) * 0.4)), vy: Math.max(-9, Math.min(6, wv * boost - 0.25 - rnd() * 0.3)), wt: weight });
          t[j] = 0; this.skin[j] = 0; this.life[j] = 0;
        }
      }
      // Creatures get blown about too.
      for (const c of this.creatures) {
        if (c.dead) continue;
        const wd = this.windAt(c.x, c.y); const sp = Math.hypot(wd[0], wd[1]); if (sp < 0.6) continue;
        const steps = Math.min(3, Math.ceil(sp * 2));
        for (let s2 = 0; s2 < steps; s2++) {
          const nx = c.x + wd[0] / sp, ny = c.y + wd[1] / sp * 0.6 - 0.2;
          if (!this.canBe(c.k, this.cellAt(nx, ny))) break;
          c.x = Math.max(1, Math.min(w - 2, nx)); c.y = Math.max(0, Math.min(h - 1, ny));
        }
      }
    }
    /* What an invention does to the cells around it. Each effect only fires now and then, so a big
       patch acts strongly and a single grain just a little. Returns true if the cell itself is used up. */
    effects(i, x, y, F, id) {
      const w = this.w, h = this.h, t = this.t;
      const near = () => { const d = ri(8), xx = x + NX[d], yy = y + NY[d]; return xx < 0 || yy < 0 || xx >= w || yy >= h ? -1 : yy * w + xx; };
      if (F.wind && rnd() < 0.12) this.gust(x, y, id);
      if (F.freeze && rnd() < 0.06) {
        const j = near();
        if (j >= 0) {
          const b = t[j], kb = KIND[b];
          if (b === M.WATER || b === M.SEAWATER || b === M.SWAMP) this.put(j, M.ICE);
          else if (b === M.LAVA) this.put(j, M.OBSIDIAN);
          else if (b === M.STEAM) this.put(j, M.WATER);
          else if (kb === K.fire && b !== M.ETERNAL) t[j] = rnd() < 0.5 ? M.SMOKE : 0;
          else if (b === 0 && j < i && rnd() < 0.12) this.put(j, M.SNOW); // flurries
        }
      }
      if (F.sparks && rnd() < 0.005) {
        const j = near();
        if (j >= 0) { const b = t[j]; if (b === 0 || KIND[b] === K.gas) this.put(j, M.LIGHTNING); else if (FLAM[b] > 0) this.ignite(j); else if (CONDUCT[b]) this.charge(j, j % w, (j / w) | 0); }
      }
      if (F.fog && rnd() < 0.012) { const j = y > 0 ? i - w + ri(3) - 1 : -1; if (j >= 0 && j < t.length && t[j] === 0) this.put(j, M.FOG); }
      if (F.burn && rnd() < 0.04) {
        const j = near();
        if (j >= 0) { const b = t[j]; if (FLAM[b] > 0 && b !== id) this.ignite(j); else if (b === M.ICE || b === M.SNOW) this.put(j, M.WATER); }
      }
      if (F.melt && rnd() < 0.05) { const j = near(); if (j >= 0 && (t[j] === M.ICE || t[j] === M.SNOW || t[j] === M.FROSTCRYSTAL)) this.put(j, M.WATER); }
      if (F.corrode && rnd() < 0.02) {
        const j = near();
        if (j >= 0) {
          const b = t[j], kb = KIND[b];
          if (b && b !== t[i] && b !== M.WALL && b !== M.STEEL && b !== M.DIAMOND && b !== M.GLASS && b !== M.OBSIDIAN && b !== M.CAULDRON && kb !== K.gas && kb !== K.fire) {
            t[j] = 0; this.skin[j] = 0;
            if (rnd() < 0.25) { t[i] = 0; this.skin[i] = 0; return true; } // it gets used up as it eats
          }
        }
      }
      if (F.rain && rnd() < 0.008) { const j = i + w; if (y < h - 1 && t[j] === 0) this.put(j, M.WATER); }
      // How many of material m are around cell j (keeps webs, slime and spreading thin instead of solid blobs).
      const around = (j, m) => { let n = 0; const jx = j % w, jy = (j / w) | 0; for (let d = 0; d < 8; d++) { const xx = jx + NX[d], yy = jy + NY[d]; if (xx >= 0 && yy >= 0 && xx < w && yy < h && t[yy * w + xx] === m) n++; } return n; };
      const solidBelow = (j) => j + w < t.length && t[j + w] !== 0 && KIND[t[j + w]] !== K.gas;
      // A head count of every material, refreshed now and then, so spreading and trails stop at a sensible size.
      if ((F.grow || F.bloom || F.web || F.slime || F.plants || F.crystal || F.bubbles || F.duplicate || F.absorb || F.fungus || F.regen || F.ferment) && (!this.matCount || this.frame - this.countedAt > 30)) {
        const mc = this.matCount || (this.matCount = new Uint32Array(COUNT)); mc.fill(0);
        for (let k = 0; k < t.length; k++) mc[t[k]]++;
        this.countedAt = this.frame;
      }
      const room = (m, cap) => this.matCount[m] < cap;
      if (F.grow && rnd() < 0.004 && this.fuel[i] < 14 && t[i] && room(t[i], 350)) {
        // Spreads a little at a time, along surfaces, and only so far from where it started.
        const j = near();
        if (j >= 0 && (t[j] === 0 || KIND[t[j]] === K.gas) && around(j, t[i]) <= 3 && (solidBelow(j) || around(j, t[i]) >= 1)) {
          const gen = this.fuel[i] + 1; this.put(j, id); this.fuel[j] = gen; this.stamp[j] = this.clock;
        }
      }
      if (F.plants && rnd() < 0.006 && room(M.PLANT, 400)) {
        // Plant life sprouts from soil it touches, or right on top of it.
        const SOIL = [M.DIRT, M.SAND, M.MUD, M.CLAY, M.MOSS];
        let j = near(), spot = -1;
        if (j >= 0 && SOIL.includes(t[j]) && j >= w && t[j - w] === 0) spot = j - w;
        else if (y > 0 && t[i - w] === 0) spot = i - w;
        if (spot >= 0 && around(spot, M.PLANT) <= 3) this.put(spot, M.PLANT);
      }
      if (F.bloom && rnd() < 0.004 && room(M.FLOWER, 300)) { const j = near(); if (j >= 0 && t[j] === 0 && solidBelow(j) && around(j, M.FLOWER) < 2) this.put(j, M.FLOWER); }
      if (F.web && rnd() < 0.012 && room(M.WEB, 300)) { const j = near(); if (j >= 0 && t[j] === 0 && around(j, M.WEB) <= 2) this.put(j, M.WEB); }
      if (F.slime && rnd() < 0.004 && room(M.SLIME, 300)) { const j = near(); if (j >= 0 && t[j] === 0 && around(j, M.SLIME) <= 2) this.put(j, M.SLIME); }
      // ---- movement: pull, push, levitate, shake (they act on loose things within a few cells) ----
      const loose = (m) => { const k = KIND[m]; return m && (k === K.powder || k === K.liquid || k === K.skypowder) && !BOUNCE[m]; };
      const openAt = (j) => t[j] === 0 || KIND[t[j]] === K.gas;
      const pick = (r) => { const xx = x + ri(2 * r + 1) - r, yy = y + ri(2 * r + 1) - r; return xx < 0 || yy < 0 || xx >= w || yy >= h || (xx === x && yy === y) ? -1 : yy * w + xx; };
      const nudge = (j, sx, sy) => { // move cell j one step towards (sx, sy) if there's room
        const jx = j % w, jy = (j / w) | 0, nx = jx + sx, ny = jy + sy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
        const k = ny * w + nx; if (openAt(k)) { this.swap(j, k); this.stamp[k] = this.clock; }
      };
      // Pull, push and levitate work through the air: low pressure sucks air (and loose grains) in,
      // high pressure blows it out, and an updraft lifts things. The wind does the moving, like a real storm.
      if (F.levitate && rnd() < 0.3) this.airForce(x, y, 0, true);
      if ((F.pull || F.push) && rnd() < 0.5) {
        // Toss loose grains it can reach towards it (pull) or outwards and up (push).
        for (let tries = 0; tries < 3; tries++) {
          const j = pick(10);
          if (j < 0 || !loose(t[j]) || t[j] === t[i] || this.flying.length > 4000) continue;
          const jx = j % w, jy = (j / w) | 0;
          if (!((jy > 0 && openAt(j - w)) || (jx > 0 && openAt(j - 1)) || (jx < w - 1 && openAt(j + 1)))) continue; // only what the force can reach
          const dx = x - jx, dy = y - jy, d = Math.hypot(dx, dy) || 1;
          let vx, vy;
          if (F.pull) { const sp = Math.min(2.8, 0.6 + d * 0.28); vx = dx / d * sp; vy = dy / d * sp - 0.8; }
          else { const sp = 1.6 + rnd() * 1.2; vx = (-dx / d || (rnd() < 0.5 ? -1 : 1)) * sp * 1.3; vy = -0.9 - rnd() * 0.9 - Math.max(0, dy / d) * sp; }
          this.flying.push({ m: t[j], sk: this.hasSkins ? this.skin[j] : 0, l: this.life[j], s: this.shade[j], x: jx, y: jy, vx, vy, wt: 1 });
          t[j] = 0; this.skin[j] = 0; this.life[j] = 0;
        }
        if (rnd() < 0.04) for (const c of this.creatures) { // creatures are drawn in or shoved away too
          const dx = c.x - x, dy = c.y - y, d2 = dx * dx + dy * dy; if (d2 > 196 || d2 < 2 || c.dead) continue;
          const d = Math.sqrt(d2), s = F.pull ? -0.8 : 0.8, nx = c.x + dx / d * s, ny = c.y + dy / d * s;
          if (this.canBe(c.k, this.cellAt(nx, ny))) { c.x = Math.max(1, Math.min(w - 2, nx)); c.y = Math.max(0, Math.min(h - 1, ny)); }
        }
      }
      if (F.shake && rnd() < 0.4) {
        const j = pick(7);
        if (j >= 0 && t[j]) {
          if (loose(t[j])) nudge(j, ri(3) - 1, ri(2)); // jiggle: piles slump
          else if ((t[j] === M.STONE || t[j] === M.SANDSTONE || t[j] === M.BRICK) && rnd() < 0.01) this.put(j, M.SAND); // and crumble
        }
      }
      // ---- transformations ----
      if (F.petrify && rnd() < 0.06) { const j = near(); if (j >= 0) { const b = t[j]; if (b === M.SAND || b === M.MUD || b === M.DIRT || b === M.CLAY || b === M.WATER || b === M.SEAWATER) this.put(j, M.STONE); else if (b === M.LAVA) this.put(j, M.OBSIDIAN); } }
      if (F.crystal && rnd() < 0.005) { const j = near(); if (j >= 0 && t[j] === 0 && around(j, 0) < 8 && room(M.CRYSTAL, 300)) this.put(j, M.CRYSTAL); }
      if (F.rust && rnd() < 0.03) { const j = near(); if (j >= 0 && (t[j] === M.METAL || t[j] === M.IRON)) this.put(j, M.RUST); }
      // ---- water and heat ----
      if (F.heat && rnd() < 0.12) { const j = near(); if (j >= 0) { const b = t[j]; if (b === M.WATER || b === M.SEAWATER) this.put(j, M.STEAM); else if (b === M.MUD) this.put(j, M.DIRT); else if (b === M.ICE || b === M.SNOW) this.put(j, M.WATER); } }
      if (F.sponge && rnd() < 0.25) { const j = pick(3); if (j >= 0 && (t[j] === M.WATER || t[j] === M.SEAWATER || t[j] === M.SWAMP)) { t[j] = 0; this.skin[j] = 0; } }
      if (F.purify && rnd() < 0.05) { const j = near(); if (j >= 0 && (t[j] === M.ACID || t[j] === M.SWAMP || t[j] === M.SLIME)) this.put(j, M.WATER); }
      if (F.bubbles && rnd() < 0.012 && room(M.BUBBLE, 200)) { const j = near(); if (j >= 0 && (t[j] === 0 || t[j] === M.WATER || t[j] === M.SEAWATER)) this.put(j, M.BUBBLE); }
      // ---- magic and life ----
      if (F.sparkles && rnd() < 0.02) { const j = pick(2); if (j >= 0 && t[j] === 0) { this.put(j, M.SPARKLE, 6 + ri(10)); this.stamp[j] = this.clock; } }
      if (F.life && rnd() < 0.0008 && this.creatures.length < 40) {
        const j = pick(4); if (j >= 0 && t[j] === 0) { const kinds = [M.FIREFLY, M.BEE, M.BUTTERFLY]; this.spawn(kinds[ri(3)], j % w, (j / w) | 0); }
      }
      if (F.rainbow && rnd() < 0.08) { const j = near(); if (j >= 0 && t[j] && t[j] !== t[i] && KIND[t[j]] !== K.gas && KIND[t[j]] !== K.fire) { this.tint[j] = M.RAINBOW; this.hasTint = true; } }
      if (F.teleport && rnd() < 0.003 && t[i]) { // blink to a free spot nearby
        for (let tries = 0; tries < 6; tries++) { const j = pick(12); if (j >= 0 && t[j] === 0) { this.swap(i, j); this.stamp[j] = this.clock; for (let k = 0; k < 3; k++) { const q = pick(2); if (q >= 0 && t[q] === 0) this.put(q, M.SPARKLE, 5 + ri(6)); } return true; } }
      }
      // ================= third batch =================
      const fling = (j, vx, vy) => { // send cell j flying (if there's room in the air)
        if (this.flying.length > 4000) return;
        this.flying.push({ m: t[j], sk: this.hasSkins ? this.skin[j] : 0, l: this.life[j], s: this.shade[j], x: j % w, y: (j / w) | 0, vx, vy, wt: 1 });
        t[j] = 0; this.skin[j] = 0; this.life[j] = 0;
      };
      const reach = (j) => { const jx = j % w, jy = (j / w) | 0; return (jy > 0 && openAt(j - w)) || (jx > 0 && openAt(j - 1)) || (jx < w - 1 && openAt(j + 1)); };
      const tough = (b) => b === M.WALL || b === M.STEEL || b === M.DIAMOND || b === M.CAULDRON || b === M.VOID;
      if (F.vortex && rnd() < 0.3) this.airSwirl(x, y, id);
      if (F.orbit && rnd() < 0.45) { const j = pick(8); if (j >= 0 && loose(t[j]) && t[j] !== t[i] && reach(j)) { const dx = (j % w) - x, dy = ((j / w) | 0) - y, d = Math.hypot(dx, dy) || 1, sp = 1.6; fling(j, -dy / d * sp - dx / d * 0.4, dx / d * sp - dy / d * 0.4 - 0.5); } }
      if (F.bounce && rnd() < 0.45) { const j = pick(6); if (j >= 0 && loose(t[j]) && t[j] !== t[i] && j >= w && openAt(j - w)) fling(j, (rnd() - 0.5) * 1.2, -1.6 - rnd() * 1.4); }
      if (F.pulse && ((this.frame + id * 13) % 100) === 0 && rnd() < 0.6) this.airPop(x, y, 1.4);
      if (F.splash && rnd() < 0.4) { const j = pick(5); if (j >= 0 && KIND[t[j]] === K.liquid && t[j] !== t[i] && j >= w && openAt(j - w)) fling(j, (rnd() - 0.5) * 3, -1.5 - rnd() * 1.8); }
      if (F.erupt && rnd() < 0.004 && y > 0 && openAt(i - w) && this.flying.length < 4000) {
        const n = 3 + ri(4); for (let k = 0; k < n; k++) this.flying.push({ m: rnd() < 0.3 ? M.LAVA : M.EMBER, sk: 0, l: 20 + ri(30), s: ri(256), x, y: y - 1, vx: (rnd() - 0.5) * 2.4, vy: -3 - rnd() * 2.5, wt: 2 });
      }
      if (F.disintegrate && rnd() < 0.02) { const j = near(); if (j >= 0) { const b = t[j]; if (b && b !== t[i] && !tough(b) && (KIND[b] === K.solid || KIND[b] === K.stamp)) this.put(j, FLAM[b] > 0 ? M.ASH : M.SAND); } }
      if (F.transmute && rnd() < 0.01) { const j = near(); if (j >= 0) { const b = t[j]; if (b && b !== t[i] && !tough(b) && KIND[b] !== K.fire) { const L = [M.SAND, M.WATER, M.STONE, M.DIRT, M.SALT, M.SNOW, M.ICE, M.MUD, M.GOLD, M.CRYSTAL, M.CLAY, M.STARDUST, M.SLIME, M.HONEY]; this.put(j, L[ri(L.length)]); } } }
      if (F.duplicate && rnd() < 0.01) { const j = near(); if (j >= 0) { const b = t[j]; if (b && b !== t[i] && !tough(b) && KIND[b] !== K.creature && room(b, 400)) { const jx = j % w, jy = (j / w) | 0; for (let k = 0; k < 4; k++) { const d = ri(8), xx = jx + NX[d], yy = jy + NY[d]; if (xx >= 0 && yy >= 0 && xx < w && yy < h && t[yy * w + xx] === 0) { this.put(yy * w + xx, b); break; } } } } }
      if (F.absorb && rnd() < 0.03) { const j = near(); if (j >= 0) { const b = t[j]; if (b && b !== t[i] && loose(b)) { t[j] = 0; this.skin[j] = 0; if (rnd() < 0.3 && t[i] && room(t[i], 350)) this.put(j, id); } } }
      if (F.dissolve && rnd() < 0.05) { const j = near(); if (j >= 0) { const b = t[j]; if (b === M.SALT || b === M.SUGAR || b === M.CANDY || b === M.COTTONCANDY || b === M.CARAMEL || b === M.SOAP) this.put(j, M.WATER); } }
      if (F.liquefy && rnd() < 0.03) { const j = near(); if (j >= 0) { const b = t[j]; const to = b === M.STONE || b === M.OBSIDIAN ? M.LAVA : b === M.ICE || b === M.SNOW ? M.WATER : b === M.WAX ? M.MELTWAX : b === M.CHOCOLATE ? M.MELTCHOC : b === M.CANDY ? M.CARAMEL : 0; if (to) this.put(j, to); } }
      if (F.contaminate && rnd() < 0.1) { const j = near(); if (j >= 0) { const b = t[j]; if (b === M.WATER || b === M.SEAWATER) this.put(j, M.SWAMP); else if (b === M.DIRT || b === M.SAND) this.put(j, M.MUD); } }
      if (F.decay && rnd() < 0.02) { const j = near(); if (j >= 0) { const b = t[j]; if (b === M.PLANT || b === M.FLOWER || b === M.WOOD || b === M.VINE || b === M.MOSS || b === M.MUSHROOM || b === M.SEED || b === M.PAPER) this.put(j, M.DIRT); } }
      if (F.ferment && rnd() < 0.02) { const j = near(); if (j >= 0) { const b = t[j]; if (b === M.SUGAR || b === M.HONEY || b === M.CANDY || b === M.PLANT || b === M.FLOWER) { this.put(j, M.SLIME); const q = near(); if (q >= 0 && t[q] === 0 && room(M.BUBBLE, 200)) this.put(q, M.BUBBLE); } } }
      if (F.extinguish && rnd() < 0.3) { const j = pick(3); if (j >= 0) { const b = t[j]; if (KIND[b] === K.fire && b !== M.ETERNAL) t[j] = rnd() < 0.5 ? M.SMOKE : 0; else if (b === M.EMBER) this.put(j, M.CHARCOAL); } }
      if (F.condense && rnd() < 0.15) { const j = pick(3); if (j >= 0 && (t[j] === M.STEAM || t[j] === M.FOG)) this.put(j, M.WATER); }
      if (F.fungus && rnd() < 0.006 && room(M.MUSHROOM, 300)) { const j = near(); if (j >= 0 && t[j] === 0 && solidBelow(j)) { const damp = around(j, M.WATER) + around(j, M.MUD) + around(j, M.MOSS) + around(j, M.SWAMP); if (damp || rnd() < 0.35) this.put(j, M.MUSHROOM); } }
      if (F.regen && rnd() < 0.02) { const j = pick(3); if (j >= 0) { const b = t[j]; if (b === M.ASH || b === M.CHARCOAL) this.put(j, M.DIRT); else if (b === M.DIRT && j >= w && t[j - w] === 0 && room(M.PLANT, 400)) this.put(j - w, M.PLANT); } }
      if (F.germinate && rnd() < 0.05) { const j = pick(4); if (j >= 0 && t[j] === M.SEED) this.put(j, M.PLANT); }
      if (F.darkness) this.darkAt = this.frame;
      if (F.magnetize && rnd() < 0.5) { const j = pick(10); if (j >= 0 && (ATTRACT[t[j]] || t[j] === M.IRON) && reach(j)) { const dx = x - (j % w), dy = y - ((j / w) | 0), d = Math.hypot(dx, dy) || 1, sp = Math.min(3, 0.8 + d * 0.3); fling(j, dx / d * sp, dy / d * sp - 0.6); } }
      if (F.chain && rnd() < 0.01) {
        const j = pick(7);
        if (j >= 0 && CONDUCT[t[j]]) { // a spark leaps to the nearest metal and runs along it
          const jx = j % w, jy = (j / w) | 0, n = Math.max(Math.abs(jx - x), Math.abs(jy - y));
          for (let k = 1; k < n; k++) { const px = Math.round(x + (jx - x) * k / n + (rnd() - 0.5)), py = Math.round(y + (jy - y) * k / n), q = py * w + px; if (px >= 0 && py >= 0 && px < w && py < h && openAt(q)) this.put(q, M.LIGHTNING); }
          this.charge(j, jx, jy);
        }
      }
      if (F.paint && rnd() < 0.08) { const j = near(); if (j >= 0 && t[j] && t[j] !== t[i] && KIND[t[j]] !== K.gas && KIND[t[j]] !== K.fire) { this.tint[j] = id; this.hasTint = true; } }
      return false;
    }
    /* Pressure pushed into (or pulled out of) the air around a cell; levitation adds an updraft. */
    airForce(x, y, sign, lift) {
      if (!this.au) this.initAir();
      if (!this.airOn) { this.airSolids(); this.airOn = true; }
      const A = this.A, aw = this.aw, ah = this.ah, ax0 = Math.min(aw - 1, (x / A) | 0), ay0 = Math.min(ah - 1, (y / A) | 0);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ax = ax0 + dx, ay = ay0 + dy; if (ax < 0 || ay < 0 || ax >= aw || ay >= ah) continue;
        const ai = ay * aw + ax; if (this.asolid[ai]) continue;
        if (sign) { const p = this.ap[ai] + sign * 0.12; this.ap[ai] = Math.max(-5, Math.min(5, p)); }
        if (lift && this.av[ai] > -2.2) this.av[ai] -= 0.06;
      }
      if (lift) { // the updraft reaches down to the ground below, so it lifts what's lying there
        for (let dy = 1; dy < 12 && ay0 + dy < ah; dy++) { const ai = (ay0 + dy) * aw + ax0; if (this.asolid[ai]) { const gi = ai - aw; if (this.av[gi] > -2.2) this.av[gi] -= 0.05; break; } }
      }
    }
    /* A whirl of air around a spot (vortex): the wind goes round it, with a little lift in the middle. */
    airSwirl(x, y, id) {
      if (!this.au) this.initAir();
      if (!this.airOn) { this.airSolids(); this.airOn = true; }
      const A = this.A, aw = this.aw, ah = this.ah, cx = (x / A) | 0, cy = (y / A) | 0, dir = id & 1 ? 1 : -1;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (!dx && !dy) continue;
        const ax = cx + dx, ay = cy + dy; if (ax < 0 || ay < 0 || ax >= aw || ay >= ah) continue;
        const ai = ay * aw + ax; if (this.asolid[ai]) continue;
        const d = Math.hypot(dx, dy), k = 0.05 / d;
        if (this.au[ai] * this.au[ai] + this.av[ai] * this.av[ai] < 6) { this.au[ai] += -dy * k * dir - dx * k * 0.25; this.av[ai] += dx * k * dir - dy * k * 0.25 - 0.01; }
      }
    }
    /* A puff of pressure (pulse): pushes the air out in a ring. */
    airPop(x, y, k) {
      if (!this.au) this.initAir();
      if (!this.airOn) { this.airSolids(); this.airOn = true; }
      const A = this.A, aw = this.aw, ax = Math.min(aw - 1, (x / A) | 0), ay = Math.min(this.ah - 1, (y / A) | 0);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const bx = ax + dx, by = ay + dy; if (bx < 0 || by < 0 || bx >= aw || by >= this.ah) continue;
        const ai = by * aw + bx; if (!this.asolid[ai]) this.ap[ai] = Math.min(10, this.ap[ai] + k * (dx || dy ? 0.5 : 1));
      }
    }
    /* A storm blows the air about: gusts swing back and forth with a little lift. */
    gust(x, y, id) {
      if (!this.au) this.initAir();
      if (!this.airOn) { this.airSolids(); this.airOn = true; }
      const A = this.A, aw = this.aw;
      let ax = Math.min(aw - 1, (x / A) | 0), ay = Math.min(this.ah - 1, (y / A) | 0), ai = ay * aw + ax;
      for (let up = 0; up < 3 && this.asolid[ai] && ay > 0; up++) { ay--; ai -= aw; } // blow the air just above a heap
      if (this.asolid[ai]) return;
      const dir = Math.sin(this.frame / 140 + id * 1.7) + 0.35 * Math.sin(this.frame / 37 + id);
      const u = this.au, v = this.av;
      if (u[ai] * u[ai] + v[ai] * v[ai] < 4) { u[ai] += dir * 0.09; v[ai] += (rnd() - 0.6) * 0.03; }
      // Storms reach down: the gust also hits the air near the ground below it.
      for (let dy = 1; dy < this.ah - ay; dy++) {
        const bi = ai + dy * aw; if (this.asolid[bi]) { const gi = bi - aw; if (gi !== ai && u[gi] * u[gi] < 4) u[gi] += dir * 0.06; break; }
      }
    }
    /* Move the thrown grains: gravity pulls them down, and they land on the first thing they hit. */
    stepFlying() {
      const w = this.w, h = this.h, t = this.t, list = this.flying, keep = [];
      const open = (m) => m === 0 || KIND[m] === K.gas || KIND[m] === K.fire || KIND[m] === K.spark || KIND[m] === K.cloud;
      const H = this.holes, bh = H ? H.bhC : null, wh = H ? H.whC : null;
      flight: for (const p of list) {
        if (p.zg > 0) p.zg--; // spat out of a white hole: floats like space dust for a while
        else if (this.zeroG) { p.vx *= 0.998; p.vy *= 0.998; } // drifting through space
        else { p.vy = Math.min(p.vy + 0.16, p.pz ? 9 : 6); p.vx *= 0.985; } // portal loops can go faster
        if (H) { // gravity: black holes pull grains in (they curve and orbit), white holes push them away
          for (const b of bh) { // pull grows with the hole's size
            const dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy + 1;
            if (d2 < (b.r + 1.6) ** 2) { this.swallowed(p.m, p.sk); continue flight; }
            if (d2 > b.R * b.R * 2.2) continue;
            const d = Math.sqrt(d2), a = Math.min(1 + b.s * 0.3, (p.zg ? 90 : 16) * b.n / d2); p.vx += dx / d * a; p.vy += dy / d * a;
          }
          for (const b of wh) {
            const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy + 1, d = Math.sqrt(d2), a = Math.min((p.zg ? 0.4 : 1) * Math.max(1, b.s), (p.zg ? 4 : 12) * b.n / d2);
            p.vx += dx / d * a; p.vy += dy / d * a;
          }
          if (p.vx > 9) p.vx = 9; else if (p.vx < -9) p.vx = -9; if (p.vy < -9) p.vy = -9;
        }
        if (this.airOn) { // grains in the air are carried along by the wind (light ones more), but only where it's really blowing
          const wd = this.windAt(p.x, p.y), k = 0.12 / (0.6 + (p.wt || 2) * 0.25), boost = 2.4 / (0.6 + (p.wt || 2) * 0.25), ws = Math.hypot(wd[0], wd[1]);
          if (ws > 0.3) {
            if (ws > 6) { wd[0] *= 6 / ws; wd[1] *= 6 / ws; }
            if (p.pz) { p.vx += wd[0] * boost * k * 0.5; p.vy += wd[1] * boost * k * 0.5; } // portal-speed grains get pushed, not slowed down
            else { p.vx += (wd[0] * boost - p.vx) * k; p.vy += (wd[1] * boost - p.vy) * k; }
            p.vx = Math.max(-9, Math.min(9, p.vx));
          }
        }
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy))));
        let landed = false;
        for (let k = 0; k < n; k++) {
          let nx = p.x + p.vx / n, ny = p.y + p.vy / n;
          if (nx < 0) { nx = 0; p.vx = -p.vx * 0.4; } else if (nx > w - 1) { nx = w - 1; p.vx = -p.vx * 0.4; }
          if (ny < 0) { ny = 0; p.vy = 0; }
          const cx = Math.round(nx), cy = Math.round(ny);
          if (cy >= h || !open(t[cy * w + cx])) {
            const b = cy < h ? t[cy * w + cx] : 0;
            if (b === M.BLACKHOLE) { this.swallowed(p.m, p.sk); continue flight; }
            if (b === M.VACUUM) continue flight;                                 // sucked away
            if (b === M.PORTALIN && this.portOut && this.portOut.length) {          // out of a Portal Out, keeping its speed (plus a little)
              const q = this.exitCell(p.vx, p.vy);
              if (q >= 0) {
                const sp = Math.min(9, Math.hypot(p.vx, p.vy) + 0.25), v0 = Math.hypot(p.vx, p.vy) || 1;
                p.x = q % w; p.y = (q / w) | 0; p.vx = p.vx / v0 * sp; p.vy = p.vy / v0 * sp; p.pz = 1; // same direction, a bit faster
                this.sfx.portal++; p.pj = (p.pj || 0) + 1;
                if (sp > this.tally.portalMax) this.tally.portalMax = sp; if (p.pj > this.tally.loopMax) this.tally.loopMax = p.pj;
                break;
              }
            }
            landed = true; break;
          }
          p.x = nx; p.y = ny;
        }
        if (landed) this.land(p); else keep.push(p);
      }
      this.flying = keep;
    }
    land(p) {
      const w = this.w, x = Math.round(p.x); let y = Math.min(this.h - 1, Math.round(p.y));
      // Find a free spot here or just above (gas, smoke and flames get pushed aside).
      for (let up = 0; up < 8 && y >= 0; up++, y--) {
        const i = y * w + x, b = this.t[i];
        if (b === 0 || KIND[b] === K.gas || KIND[b] === K.fire || KIND[b] === K.spark || KIND[b] === K.cloud) {
          this.t[i] = p.m; this.life[i] = p.l; this.shade[i] = p.s; this.fuel[i] = 0; this.skin[i] = p.sk; if (this.hasTint) this.tint[i] = 0;
          if (p.sk) this.hasSkins = true;
          this.stamp[i] = this.clock;
          return;
        }
        if (KIND[b] === K.solid || PROOF[b]) break; // never pop out through a wall, ceiling or solid block
      }
      // Nowhere to go (buried in a crowd): it's simply lost in the blast.
    }

    /* ---------------- Space: holes, portals and gravity bombs ---------------- */
    // Something a black hole swallowed: kept (up to a point) for white holes to spit out again.
    swallowed(m, sk) {
      const st = this.bhStore || (this.bhStore = []);
      if (m && st.length < 6000) st.push(m, sk || 0);
      this.sfx.gulp++;
    }
    swallow(j) { this.swallowed(this.t[j], this.hasSkins ? this.skin[j] : 0); this.t[j] = 0; this.skin[j] = 0; if (this.hasTint) this.tint[j] = 0; }
    // An empty cell right next to a random Portal Out (-1 if there isn't one).
    // With a direction (dx, dy), it picks the side that keeps things moving the same way (fall into a floor
    // portal, come out of a ceiling portal still falling). this.exitDir is the side it came out of.
    exitCell(dx, dy) {
      const L = this.portOut, w = this.w, h = this.h, t = this.t, aim = dx || dy;
      if (aim) { const n = Math.hypot(dx, dy); dx /= n; dy /= n; }
      let best = -1, bestScore = -9, bestD = 0;
      for (let tries = 0; tries < (aim ? 12 : 6); tries++) {
        const o = L[ri(L.length)]; if (t[o] !== M.PORTALOUT) continue;
        const ox = o % w, oy = (o / w) | 0, s0 = ri(8);
        for (let k = 0; k < 8; k++) {
          const d = (s0 + k) & 7, xx = ox + NX[d], yy = oy + NY[d];
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const q = yy * w + xx; if (t[q] !== 0) continue;
          if (!aim) { this.exitDir = d; return q; }
          const score = (NX[d] * dx + (NY[d] * dy) + NY[d] * 0.4) / Math.hypot(NX[d], NY[d]) + rnd() * 0.05; // (things fall, so lean downwards)
          if (score > bestScore) { bestScore = score; best = q; bestD = d; }
        }
        if (bestScore > 1.3) break; // found a side facing straight the right way
      }
      if (aim && bestScore < 0.3) return -1; // that side is blocked right now: wait rather than shoot out backwards
      if (best >= 0) this.exitDir = bestD;
      return best;
    }
    // Move cell j out of a Portal Out. (dx, dy) is the way it was going: grains and liquids come out
    // flying that way, so a floor portal under a ceiling portal makes them fall faster and faster.
    teleport(j, dx, dy) {
      const q = this.exitCell(dx, dy); if (q < 0) return false;
      this.sfx.portal++;
      const t = this.t, k = KIND[t[j]];
      if ((k === K.powder || k === K.liquid) && this.flying.length < 4000 && !BOUNCE[t[j]]) {
        const d = this.exitDir, n = (dx || dy) ? Math.hypot(dx, dy) : Math.hypot(NX[d], NY[d]), sp = 1.4;
        const ux = (dx || dy) ? dx / n : NX[d] / n, uy = (dx || dy) ? dy / n : NY[d] / n;
        this.flying.push({ m: t[j], sk: this.hasSkins ? this.skin[j] : 0, l: this.life[j], s: this.shade[j], x: q % this.w, y: (q / this.w) | 0, vx: ux * sp, vy: uy * sp, wt: 1, pz: 1 });
        t[j] = 0; this.skin[j] = 0; this.life[j] = 0; this.fuel[j] = 0; if (this.hasTint) this.tint[j] = 0;
        return true;
      }
      t[q] = t[j]; this.life[q] = this.life[j]; this.shade[q] = this.shade[j]; this.fuel[q] = this.fuel[j]; this.skin[q] = this.skin[j];
      if (this.hasTint) { this.tint[q] = this.tint[j]; this.tint[j] = 0; }
      t[j] = 0; this.skin[j] = 0; this.life[j] = 0; this.fuel[j] = 0;
      this.stamp[q] = this.clock;
      return true;
    }
    /* The separate blobs of material m: [{ x, y, n, r, s, R }] (centre, cells, radius, strength, reach), biggest first. */
    clusters(m) {
      const t = this.t, w = this.w, h = this.h, seen = this._seen && this._seen.length === t.length ? this._seen : (this._seen = new Uint8Array(t.length));
      const out = [], used = [], stack = [];
      for (let k = 0; k < t.length && out.length < 32; k++) {
        if (t[k] !== m || seen[k]) continue;
        let n = 0, sx = 0, sy = 0; stack.push(k); seen[k] = 1; used.push(k);
        while (stack.length) {
          const q = stack.pop(), qx = q % w, qy = (q / w) | 0; n++; sx += qx; sy += qy;
          if (qx > 0 && t[q - 1] === m && !seen[q - 1]) { seen[q - 1] = 1; used.push(q - 1); stack.push(q - 1); }
          if (qx < w - 1 && t[q + 1] === m && !seen[q + 1]) { seen[q + 1] = 1; used.push(q + 1); stack.push(q + 1); }
          if (qy > 0 && t[q - w] === m && !seen[q - w]) { seen[q - w] = 1; used.push(q - w); stack.push(q - w); }
          if (qy < h - 1 && t[q + w] === m && !seen[q + w]) { seen[q + w] = 1; used.push(q + w); stack.push(q + w); }
        }
        const s = Math.sqrt(n) / 3; // a 3x3 hole has strength 1
        out.push({ x: sx / n, y: sy / n, n, r: Math.sqrt(n / Math.PI), s, R: Math.min(130, 50 + 7 * Math.sqrt(n)) });
      }
      for (const q of used) seen[q] = 0;
      return out.sort((a, b) => b.n - a.n);
    }
    /* Every frame: black holes pull, white holes push (and spit out what was swallowed), vacuums suck. */
    forces() {
      const H = this.holes, w = this.w, h = this.h, t = this.t;
      const openAt = (j) => t[j] === 0 || KIND[t[j]] === K.gas || KIND[t[j]] === K.fire;
      const loose = (m) => { const k = KIND[m]; return m && (k === K.powder || k === K.liquid || k === K.gas || k === K.fire || k === K.float || k === K.skypowder) && !BOUNCE[m] && m !== M.GRAVBOMB; };
      const grab = (j, vx, vy) => {
        this.flying.push({ m: t[j], sk: this.hasSkins ? this.skin[j] : 0, l: this.life[j], s: this.shade[j], x: j % w, y: (j / w) | 0, vx, vy, wt: 1 });
        t[j] = 0; this.skin[j] = 0; this.life[j] = 0; if (this.hasTint) this.tint[j] = 0;
      };
      // Gravity reaches out along straight lines from the hole: whatever loose thing each line meets first
      // (the surface facing the hole) may get pulled in or pushed off, more often the closer it is.
      const pass = (list, n, R, sign, k0, self) => {
        if (!list.length) return;
        const rays = Math.min(10, 3 + Math.round(n / (list.length / 2)));  // bigger holes reach out more
        for (let e = 0; e < list.length; e += 2) {
          const x = list[e], y = list[e + 1];
          for (let k = 0; k < rays && this.flying.length < 4000; k++) {
            const a = rnd() * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
            let j = -1, d = 2;
            for (; d <= R; d++) {
              const xx = Math.round(x + ux * d), yy = Math.round(y + uy * d);
              if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
              const q = yy * w + xx, b = t[q];
              if (b === 0 || b === M.SPARKLE || b === self) continue; // its own body doesn't block it
              j = q; break;
            }
            if (j < 0 || !loose(t[j]) || rnd() > k0 * 14 / (d + 8)) continue; // weaker far away
            const dx = (j % w) - x, dy = ((j / w) | 0) - y;
            if (sign < 0) { const v = Math.min(3.4, 1.6 + d * 0.03); grab(j, -dx / d * v, Math.max(-9, -dy / d * v - 0.08 * d / v)); } // aimed so it arcs right into the hole
            else { const sp = Math.min(4.5, 1 + 30 * k0 / (d + 6)), sx = dx > 0 ? 1 : dx < 0 ? -1 : (rnd() < 0.5 ? -1 : 1); grab(j, dx / d * sp * 1.2 + sx * sp * 0.4, -(sp * 0.9 + 0.8) + (dy < 0 ? dy / d * sp * 0.6 : 0)); } // thrown outwards and up, clear of the ground
          }
        }
      };
      // Break a small chunk (a few connected solid cells) off whatever the ray hit, and send the pieces
      // flying towards the hole together. Bigger holes rip off bigger chunks.
      const tearChunk = (j, c, d) => {
        const size = 1 + ri(Math.min(6, 2 + Math.round(c.s))), dx = (j % w) - c.x, dy = ((j / w) | 0) - c.y;
        const v = Math.min(3.2 + c.s * 0.4, 1.4 + d * 0.03), vx = -dx / d * v, vy = Math.max(-9, -dy / d * v - 0.08 * d / v);
        const chunk = [j], seen = new Set(chunk);
        for (let q = 0; q < chunk.length && chunk.length < size; q++) {
          const i = chunk[q], ix = i % w, s0 = ri(4);
          for (let k = 0; k < 4 && chunk.length < size; k++) {
            const e = (s0 + k) & 3, nx = ix + (e === 0 ? -1 : e === 1 ? 1 : 0), nb = i + (e === 0 ? -1 : e === 1 ? 1 : e === 2 ? -w : w);
            if (nx < 0 || nx >= w || nb < 0 || nb >= t.length || seen.has(nb)) continue;
            const b = t[nb]; if (!b || KIND[b] !== K.solid || PROOF[b]) continue;
            seen.add(nb); chunk.push(nb);
          }
        }
        for (const i of chunk) { if (this.flying.length >= 4000) break; grab(i, vx + (rnd() - 0.5) * 0.2, vy + (rnd() - 0.5) * 0.2); this.fuel[i] = 0; }
      };
      // Holes: rays from the middle of each one; more rays, farther reach and a stronger grip the bigger it is.
      const holePass = (list, sign, self) => {
        for (const c of list) {
          const rays = Math.min(sign < 0 ? 240 : 120, Math.round(4 * c.n)), R = sign < 0 ? c.R : c.R * 0.65;
          for (let k = 0; k < rays && this.flying.length < 4000; k++) {
            const a = rnd() * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
            let j = -1, d = 1;
            for (; d <= R; d++) {
              const xx = Math.round(c.x + ux * d), yy = Math.round(c.y + uy * d);
              if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
              const q = yy * w + xx, b = t[q];
              if (b === 0 || b === M.SPARKLE || b === self) continue;
              j = q; break;
            }
            if (j < 0) continue;
            if (sign < 0 && KIND[t[j]] === K.solid && !PROOF[t[j]]) { // solids: a black hole tears off little chunks and drags them in
              if (rnd() < 0.14 * c.s * 14 / (Math.max(0, d - c.r) + 8)) tearChunk(j, c, d);
              continue;
            }
            if (!loose(t[j]) || rnd() > (sign < 0 ? 1 : 1.2) * c.s * 14 / (Math.max(0, d - c.r) + 8)) continue;
            const dx = (j % w) - c.x, dy = ((j / w) | 0) - c.y;
            if (sign < 0) {
              const v = Math.min(3.4 + c.s * 0.4, 1.6 + d * 0.03), vx = -dx / d * v, vy = Math.max(-9, -dy / d * v - 0.08 * d / v);
              grab(j, vx, vy); // aimed so it arcs right into the hole
              // A big hole takes a gulp: more of the pile behind it comes along too (a lake drains fast).
              for (let g = Math.floor(c.s), dd = d + 1; g > 0 && dd <= R + 6 && this.flying.length < 4000; g--, dd++) {
                const xx = Math.round(c.x + ux * dd), yy = Math.round(c.y + uy * dd);
                if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
                const q = yy * w + xx; if (!loose(t[q])) break;
                grab(q, vx * 0.95, vy * 0.95);
              }
            }
            else { const sp = Math.min(4.5, 1 + 30 * c.s / (d + 6)), sx = dx > 0 ? 1 : dx < 0 ? -1 : (rnd() < 0.5 ? -1 : 1); grab(j, dx / d * sp * 1.2 + sx * sp * 0.4, -(sp * 0.9 + 0.8) + (dy < 0 ? dy / d * sp * 0.6 : 0)); } // thrown outwards and up
          }
        }
      };
      holePass(H.bhC, -1, M.BLACKHOLE);
      holePass(H.whC, 1, M.WHITEHOLE);
      pass(H.vac, H.vacN, 16, -1, 0.9, M.VACUUM);
      for (let e = 0; e < H.vac.length; e += 2) if (rnd() < 0.5) this.airForce(H.vac[e], H.vac[e + 1], -1, false); // the air rushes in too
      // White holes spit out whatever the black holes swallowed, from all around their edge.
      // The bigger the white hole, the faster it pours out.
      const st = this.bhStore;
      if (H.whC.length && st && st.length) {
        for (const c of H.whC) {
          const tries = Math.round(8 + 3 * Math.sqrt(c.n));
          for (let k = 0; k < tries && st.length && this.flying.length < 5000; k++) {
            const a = rnd() * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
            let q = -1, xx = 0, yy = 0;
            for (let dd = Math.max(1, Math.floor(c.r)); dd <= c.r + 5; dd++) { // just outside the edge in that direction
              xx = Math.round(c.x + ux * dd); yy = Math.round(c.y + uy * dd);
              if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
              const b = t[yy * w + xx]; if (b === M.WHITEHOLE) continue;
              if (b === 0) q = yy * w + xx;
              break;
            }
            if (q < 0) continue;
            const sk = st.pop(), m = st.pop();
            if (sk === 0xFFFF) { const cr = this.spawn(m, xx, yy, false); if (cr) cr.vy = -0.5; continue; } // a creature it swallowed
            if (!MATS[m] || MATS[m].reserved) continue;
            const b = a + (rnd() - 0.5) * 1.2, v = 0.9 + rnd() * 0.6 + Math.min(0.8, c.s * 0.08);
            this.flying.push({ m, sk, l: this.defaultLife(m), s: ri(256), x: xx, y: yy, vx: Math.cos(b) * v, vy: Math.sin(b) * v, wt: 1, zg: 360 });
            this.sfx.spat++;
          }
        }
      }
      // Creatures are drawn in (and swallowed) or pushed away too.
      if (this.creatures.length) for (const c of this.creatures) {
        if (c.dead || c.s === 9) continue;
        const near = (list, R) => { let best = -1, bd = R * R; for (let e = 0; e < list.length; e += 2) { const d = (list[e] - c.x) ** 2 + (list[e + 1] - c.y) ** 2; if (d < bd) { bd = d; best = e; } } return best < 0 ? null : [list[best], list[best + 1], Math.sqrt(bd)]; };
        const move = (hx, hy, d, sp) => { const nx = c.x + (hx - c.x) / (d || 1) * sp, ny = c.y + (hy - c.y) / (d || 1) * sp; if (this.canBe(c.k, this.cellAt(nx, ny))) { c.x = Math.max(1, Math.min(w - 2, nx)); c.y = Math.max(0, Math.min(h - 1, ny)); } };
        let gone = false;
        for (const b of H.bhC) {
          const d = Math.hypot(b.x - c.x, b.y - c.y); if (d > b.R * 0.85) continue;
          if (d < b.r + 2.5) { c.dead = 'void'; if (c.k === M.COW) this.tally.cows++; if (c.k !== M.STICKMAN) this.swallowed(c.k, 0xFFFF); gone = true; break; }
          move(b.x, b.y, d, Math.min(1.4 + b.s * 0.3, 14 * b.s / (d - b.r + 6)));
        }
        if (gone) continue;
        let n = near(H.vac, 14);
        if (n) { if (n[2] < 2.5) { c.dead = 'void'; continue; } move(n[0], n[1], n[2], Math.min(1, 6 / (n[2] + 3))); }
        for (const b of H.whC) { const d = Math.hypot(b.x - c.x, b.y - c.y); if (d < b.R * 0.6) move(b.x, b.y, d, -Math.min(1.4 + b.s * 0.3, 14 * b.s / (d - b.r + 6))); }
      }
    }
    /* A gravity bomb goes off: no crater, just a huge push that flings everything loose outwards. */
    gravPush(cx, cy) {
      const w = this.w, h = this.h, t = this.t; let power = 1;
      this.tally.grav++;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { // nearby bombs join in
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const j = y * w + x; if (t[j] === M.GRAVBOMB) { t[j] = 0; power += 0.12; }
      }
      power = Math.min(power, 4);
      const R = Math.round(24 + 8 * power);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const d2 = dx * dx + dy * dy; if (d2 > R * R || d2 === 0) continue;
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const j = y * w + x, b = t[j]; if (!b) continue;
        const k = KIND[b]; if (!(k === K.powder || k === K.liquid || k === K.gas || k === K.fire || k === K.float || k === K.skypowder) || this.flying.length > 7000) continue;
        const d = Math.sqrt(d2), sp = Math.min(9, (4 + 2.5 * power) * (1 - d / R) + 1.5), sx = dx > 0 ? 1 : dx < 0 ? -1 : (rnd() < 0.5 ? -1 : 1);
        this.flying.push({ m: b, sk: this.hasSkins ? this.skin[j] : 0, l: this.life[j], s: this.shade[j], x, y, vx: dx / d * sp * 1.1 + sx * sp * 0.3, vy: -(sp * 0.8 + 0.6) + (dy < 0 ? dy / d * sp * 0.5 : 0), wt: 1 });
        t[j] = 0; this.skin[j] = 0; this.life[j] = 0; if (this.hasTint) this.tint[j] = 0;
      }
      for (const p of this.flying) { const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy); if (d < R && d > 0) { const k = (1 - d / R) * 4 * power; p.vx += dx / d * k; p.vy += dy / d * k; } }
      for (const c of this.creatures) { // creatures get thrown too
        const dx = c.x - cx, dy = c.y - cy, d = Math.hypot(dx, dy); if (d >= R || c.dead) continue;
        const n = Math.round((1 - d / R) * 10 * power);
        for (let s2 = 0; s2 < n; s2++) { const nx = c.x + dx / (d || 1), ny = c.y + dy / (d || 1) - 0.3; if (!this.canBe(c.k, this.cellAt(nx, ny))) break; c.x = Math.max(1, Math.min(w - 2, nx)); c.y = Math.max(0, Math.min(h - 1, ny)); }
        if (c.k === M.STICKMAN) c.vy = -1.2;
      }
      this.shove(cx, cy, 6, 1.5 + power); // and a rush of air
      for (let k = 0; k < 48; k++) { // a ring of light
        const a = k / 48 * Math.PI * 2, r = 4 + ri(3), x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        if (x >= 0 && y >= 0 && x < w && y < h && t[y * w + x] === 0) { this.put(y * w + x, M.SPARKLE, 8 + ri(12)); this.stamp[y * w + x] = this.clock; }
      }
    }
    /* Plutonium gone critical: a huge blast and a white-hot flash. */
    nuke(cx, cy) {
      const w = this.w, h = this.h;
      this.hurtCreatures(cx, cy, 30, 'burn');
      this.blast(cx, cy, 6);
      for (let k = 0; k < 160; k++) {
        const a = rnd() * Math.PI * 2, d = 18 * Math.sqrt(rnd()), x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const j = y * w + x, b = this.t[j];
        if (b === 0 || KIND[b] === K.gas) { this.put(j, rnd() < 0.4 ? M.PLASMA : M.FIRE, 20 + ri(30)); this.stamp[j] = this.clock; }
      }
    }

    /* A lightning bolt from (x, y) zig-zags down until it hits something. */
    bolt(x, y) {
      const w = this.w, h = this.h;
      this.sfx.bolt++; this.sfx.boltX = x / w;
      while (y < h - 1) {
        y++; x = Math.max(0, Math.min(w - 1, x + ri(3) - 1));
        const j = y * w + x, b = this.t[j], kb = KIND[b];
        if (b === 0 || kb === K.gas || kb === K.cloud || kb === K.fire || kb === K.spark) { this.put(j, M.LIGHTNING); continue; }
        // Impact: everything around the strike point feels it.
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const k = yy * w + xx, c = this.t[k];
          if (c === M.SAND) this.put(k, M.GLASS);
          else if (c === M.GLASS && Math.abs(dx) + Math.abs(dy) <= 2) this.put(k, M.CRYSTAL);
          else if (c === M.WATER && rnd() < 0.3) this.put(k, rnd() < 0.25 ? (rnd() < 0.6 ? M.HYDROGEN : M.OXYGEN) : M.STEAM); // now and then it splits water
          else if (c === M.ICE || c === M.SNOW) this.put(k, M.WATER);
          else if (FLAM[c] > 0) this.ignite(k);
          else if (CONDUCT[c] && this.life[k] === 0 && this.fuel[k] === 0) this.life[k] = 8; // a strike on a wire sends a spark along it
          else if (c === 0 && rnd() < 0.3) this.put(k, M.LIGHTNING);
        }
        break;
      }
    }

    /* Temperature, every 4th frame: hot and cold things set their block's temperature, heat spreads to
       the blocks around it and slowly settles back to room temperature, and things react to the heat:
       ice melts, water boils or freezes, burnable things catch fire, and rock near lava glows. */
    stepHeat() {
      const w = this.w, h = this.h, t = this.t, tw = this.tw, th = this.th, T = this.temp, N = this.tempNext;
      const sum = this.tSum, cnt = this.tN, full = this.tFull; sum.fill(0); cnt.fill(0); full.fill(0);
      const fuel = this.fuel, skins = this.hasSkins ? this.skin : null;
      for (let y = 0; y < h; y++) {
        const by = ((y / TB) | 0) * tw;
        for (let x = 0; x < w; x++) {
          const m = t[y * w + x]; if (!m) continue;
          const b = by + ((x / TB) | 0); full[b]++;
          let v = TEMP[m];
          if (m === M.THERMITE && fuel[y * w + x]) v = 2500;
          if (skins) { const sk = skins[y * w + x]; if (sk && FX[sk]) { if (FX[sk].frost) v = -30; else if (FX[sk].burn && v !== v) v = 450; } }
          if (v === v) { sum[b] += v; cnt[b]++; }
        }
      }
      for (let b = 0; b < tw * th; b++) {
        let v = T[b];
        if (cnt[b]) { const target = sum[b] / cnt[b], k = Math.min(1, (cnt[b] / (TB * TB)) * 1.6); v += (target - v) * k; }
        T[b] = v;
      }
      // Spread to the neighbours, and drift back towards room temperature (air loses heat faster than solid ground).
      for (let by = 0; by < th; by++) for (let bx = 0; bx < tw; bx++) {
        const b = by * tw + bx, v = T[b];
        const l = bx > 0 ? T[b - 1] : v, r = bx < tw - 1 ? T[b + 1] : v, u = by > 0 ? T[b - tw] : v, d = by < th - 1 ? T[b + tw] : v;
        let n = v + ((l + r + u + d) * 0.25 - v) * 0.22;
        n += (ROOM - n) * (full[b] > 8 ? 0.004 : 0.02);
        N[b] = n;
      }
      T.set(N);
      { let lo = 1e9, hi = -1e9; for (let b = 0; b < T.length; b++) { const v = T[b]; if (v < lo) lo = v; if (v > hi) hi = v; } this.tempLo = lo; this.tempHi = hi; }
      // Reactions to heat and cold.
      const life = this.life, heat = this.heat;
      for (let y = 0; y < h; y++) {
        const by = ((y / TB) | 0) * tw;
        for (let x = 0; x < w; x++) {
          const i = y * w + x, m = t[i]; if (!m) continue;
          const v = T[by + ((x / TB) | 0)];
          if (m !== M.STEAM && v > -15 && v < 25) continue; // nothing reacts at everyday temperatures
          if (m === M.ICE || m === M.SNOW) { if (v > 25 && rnd() < Math.min(0.15, (v - 25) / 500)) this.put(i, M.WATER); continue; }
          if (m === M.WATER || m === M.SEAWATER) {
            if (v > 100 && rnd() < Math.min(0.25, (v - 100) / 800)) { this.put(i, M.STEAM); continue; }
            if (v < -12 && rnd() < Math.min(0.08, (-12 - v) / 120)) this.put(i, M.ICE);
            continue;
          }
          if (m === M.STEAM) { if (v < 50 && rnd() < 0.004) this.put(i, M.WATER); continue; }
          if (FLAM[m] > 0) { if (v > 250 && rnd() < FLAM[m] * Math.min(1, (v - 250) / 500) * 0.25) this.ignite(i); continue; }
          if (m === M.WAX && v > 60 && rnd() < 0.05) { this.put(i, M.MELTWAX); continue; }
          if (m === M.CHOCOLATE && v > 45 && rnd() < 0.05) { this.put(i, M.MELTCHOC); continue; }
          if (COOLS[m]) {
            if (v > 1400 && (m === M.STONE || m === M.OBSIDIAN || m === M.METAL) && rnd() < 0.03) { this.put(i, M.LAVA); continue; } // only white-hot things melt rock
            if (v > 1300 && m === M.SAND && rnd() < 0.03) { this.put(i, M.GLASS); continue; }
            if (v > 380) { const g = Math.min(200, (v - 380) * 0.35) | 0; if (heat[i] < g) heat[i] = g; } // glowing hot from the heat around it
          }
        }
      }
      // Creatures get hurt in fierce heat.
      for (const c of this.creatures) {
        if (c.dead || c.k === M.STICKMAN && c.s === 9) continue;
        const bx = Math.max(0, Math.min(tw - 1, (c.x / TB) | 0)), byy = Math.max(0, Math.min(th - 1, (c.y / TB) | 0));
        if (c.k === M.FIREFLY || c.k === M.DRAGON || (ABIL[c.k] && (ABIL[c.k].fireproof || ABIL[c.k].breath))) continue; // creatures of fire don't mind the heat
        if (T[byy * tw + bx] > 420 && rnd() < 0.08) this.hurtCreatures(c.x, c.y, 1, 'burn');
      }
    }
    tempAt(x, y) { const bx = Math.max(0, Math.min(this.tw - 1, (x / TB) | 0)), by = Math.max(0, Math.min(this.th - 1, (y / TB) | 0)); return this.temp[by * this.tw + bx]; }
    step() {
      const w = this.w, h = this.h, t = this.t, life = this.life, stamp = this.stamp;
      this.clock = this.clock === 255 ? 1 : this.clock + 1;
      const clock = this.clock;
      this.frame++;
      let clouds = 0;
      if (this.frame % 20 === 1) { // where are the magnets, and is there any glue about?
        const mg = []; let sticky = false;
        const H = { bh: [], wh: [], vac: [], bhN: 0, whN: 0, vacN: 0 }, outs = [];
        const keep = (list, n, k) => { // a fair sample of up to 24 spots of each hole
          if (list.length < 48) list.push(k % w, (k / w) | 0);
          else { const r = ri(n); if (r < 24) { list[r * 2] = k % w; list[r * 2 + 1] = (k / w) | 0; } }
        };
        for (let k = 0, n = t.length; k < n; k++) {
          const v = t[k];
          if (MAGNETIC[v] && mg.length < 128) mg.push(k % w, (k / w) | 0); else if (STICKY[v]) sticky = true; else if (BOUNCE[v]) this.hasBouncy = true;
          else if (v === M.BLACKHOLE) keep(H.bh, ++H.bhN, k); else if (v === M.WHITEHOLE) keep(H.wh, ++H.whN, k);
          else if (v === M.VACUUM) keep(H.vac, ++H.vacN, k); else if (v === M.PORTALOUT && outs.length < 3000) outs.push(k);
        }
        this.magnets = mg; this.hasSticky = sticky;
        // Each separate black (or white) hole is one body: the bigger it is, the stronger and farther it pulls.
        H.bhC = H.bhN ? this.clusters(M.BLACKHOLE) : []; H.whC = H.whN ? this.clusters(M.WHITEHOLE) : [];
        if (H.bhC.length && H.bhC[0].n > this.tally.bhMax) this.tally.bhMax = H.bhC[0].n; if (H.whC.length && H.whC[0].n > this.tally.whMax) this.tally.whMax = H.whC[0].n;
        this.holes = H.bhN || H.whN || H.vacN ? H : null; this.portOut = outs;
      }
      this.blastsNow = 0;
      if ((this.frame & 3) === 0) this.stepHeat();
      if (this.airOn) this.stepAir();
      if (this.holes) this.forces();
      if (this.flying.length) this.stepFlying();
      // Explosions queued by the last frame's chain reactions.
      if (this.pendingFrost && this.pendingFrost.length) {
        const pf = this.pendingFrost; this.pendingFrost = [];
        for (let k = 0; k < pf.length && k < 60; k += 2) this.frostBlast(pf[k], pf[k + 1]);
      }
      if (this.pendingBlasts.length) {
        const pb = this.pendingBlasts; this.pendingBlasts = [];
        for (let k = 0; k < pb.length && k < 90; k += 3) this.blast(pb[k], pb[k + 1], pb[k + 2]);
      }
      for (let y = h - 1; y >= 0; y--) {
        const ltr = ((this.frame + y) & 1) === 0;
        for (let n = 0; n < w; n++) {
          const x = ltr ? n : w - 1 - n;
          const i = y * w + x;
          let m = t[i];
          if (m === 0 || stamp[i] === clock) continue;
          if (LIKE[m]) { this.skin[i] = m; m = t[i] = LIKE[m]; this.hasSkins = true; } // an invention loaded from a save
          if (this.hasSkins) { const sk = this.skin[i]; this.curBase = m; this.curSkin = sk && LIKE[sk] === m ? sk : 0; }
          if (m === M.CLOUD) clouds++;
          { const fxId = this.curSkin || m; if (FX[fxId] && this.effects(i, x, y, FX[fxId], fxId)) continue; }
          // 1) React with one random neighbour.
          if (REACTIVE[m] && this.react(i, x, y, m)) continue;
          // 2) Material-specific behaviour, then movement.
          switch (KIND[m]) {
            case K.powder: this.special(i, x, y, m); if (t[i] === m) this.powder(i, x, y, m); break;
            case K.liquid: this.special(i, x, y, m); if (t[i] === m) this.liquid(i, x, y, m); break;
            case K.gas: this.gas(i, x, y, m); break;
            case K.fire: this.fire(i, x, y, m); break;
            case K.spark:
              if (life[i]-- <= 1) { t[i] = 0; break; }
              if (m === M.SPARKLE && y > 0 && rnd() < 0.5) { const j = i - w + ri(3) - 1; if (j >= 0 && t[j] === 0) this.swap(i, j); }
              break;
            case K.float: this.float(i, x, y, m); break;
            case K.skypowder: this.special(i, x, y, m); if (t[i] === m) this.skypowder(i, x, y, m); break;
            case K.cloud: this.cloud(i, x, y, m); break;
            case K.rocket: this.rocket(i, x, y); break;
            default: this.special(i, x, y, m);
          }
        }
      }
      this.curBase = this.curSkin = 0;
      this.clouds = clouds;
      if (this.creatures.length) this.stepCreatures();
      // A big enough storm throws lightning.
      if (clouds > 120 && rnd() < Math.min(0.03, (clouds - 120) / 6000)) {
        for (let tries = 0; tries < 300; tries++) {
          const i = ri(w * h);
          if (t[i] === M.CLOUD) { this.bolt(i % w, (i / w) | 0); break; }
        }
      }
    }

    react(i, x, y, m) {
      const d = ri(8), xx = x + NX[d], yy = y + NY[d];
      if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) return false;
      const j = yy * this.w + xx, b = this.t[j];
      if (IGNITERS.has(m) && FLAM[b] > 0 && rnd() < FLAM[b]) { this.ignite(j); return false; }
      const list = RX[m * COUNT + b];
      if (!list) return false;
      for (let k = 0; k < list.length; k++) {
        const r = list[k];
        if (rnd() >= r.p) continue;
        let ta = r.a;
        if (r.alt && rnd() < r.alt.p) ta = r.alt.a;
        this.tally.rx++; this.tally.rxBy[m] = (this.tally.rxBy[m] || 0) + 1;
        if (r.b !== KEEP) { if (r.b === 0) this.t[j] = 0; else this.put(j, r.b); this.stamp[j] = this.clock; }
        if (m === M.ACID && r.b === 0 && rnd() < 0.35) ta = 0; // acid gets used up
        if (ta !== KEEP) { if (ta === 0) this.t[i] = 0; else this.put(i, ta); return true; }
        return false;
      }
      return false;
    }

    powder(i, x, y, m) {
      if (m === M.GRAVBOMB && this.fuel[i]) return; // stuck fast
      if (ATTRACT[m] && this.magnets.length && this.pull(i, x, y)) return;
      if (this.hasSticky && this.stuck(i, x, y)) return;
      if (this.zeroG) { this.drift(i, x, y, 0.03); return; } // floating in space
      if (BOUNCE[m] && this.bounce(i, x, y, m)) return;
      if (y >= this.h - 1) return;
      // Light, magical dusts drift down slowly.
      if (m === M.STARDUST && rnd() < 0.5) return;
      if (m === M.AEROGEL && rnd() < 0.88) { if (rnd() < 0.15) { const dx = rnd() < 0.5 ? -1 : 1, xx = x + dx; if (xx >= 0 && xx < this.w && this.t[i + dx] === 0) this.swap(i, i + dx); } return; } // floats down like a feather
      if (m === M.MOONDUST) {
        if (rnd() < 0.85) {
          if (rnd() < 0.2) { const dx = rnd() < 0.5 ? -1 : 1, xx = x + dx; if (xx >= 0 && xx < this.w && this.t[i + dx] === 0) this.swap(i, i + dx); }
          return;
        }
      }
      const below = i + this.w;
      if (this.yields(m, below)) { this.swap(i, below); this.tally.fell++; return; }
      if (rnd() > SLIP[m]) return;
      const dir = rnd() < 0.5 ? -1 : 1;
      for (let s = 0; s < 2; s++) {
        const dx = s ? -dir : dir, xx = x + dx;
        if (xx < 0 || xx >= this.w) continue;
        const j = below + dx;
        if (this.yields(m, j) && KIND[this.t[i + dx]] !== K.solid) { this.swap(i, j); return; }
      }
    }

    // Zero gravity: now and then nudge into a random empty neighbouring cell, so things slowly drift about.
    drift(i, x, y, p) {
      if (rnd() > p) return;
      const d = ri(8), xx = x + NX[d], yy = y + NY[d];
      if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) return;
      const j = yy * this.w + xx; if (this.t[j] === 0) this.swap(i, j);
    }
    liquid(i, x, y, m) {
      if (((m === M.LAVA || m === M.MOLTENGOLD) && rnd() < 0.6) || (m === M.QUICKSAND && rnd() < 0.92) || ((m === M.HONEY || m === M.MELTCHOC) && rnd() < 0.7) || (m === M.SWAMP && rnd() < 0.3)) return; // thick, slow liquids
      const w = this.w;
      if (STICKY[m] && this.clings(i, x, y, m)) return;
      if (ATTRACT[m] && this.magnets.length && this.pull(i, x, y)) return; // ferrofluid
      if (this.zeroG) { this.drift(i, x, y, 0.07); return; } // floating blobs
      if (this.hasSticky && !STICKY[m] && this.stuck(i, x, y)) return;
      // (Nitro no longer goes off from a fall: only fire, sparks and blasts set it off.)
      if (y < this.h - 1) {
        const below = i + w;
        if (this.yields(m, below)) { this.swap(i, below); return; }
        const dir = rnd() < 0.5 ? -1 : 1;
        for (let s = 0; s < 2; s++) {
          const dx = s ? -dir : dir, xx = x + dx;
          if (xx >= 0 && xx < w && this.yields(m, below + dx) && KIND[this.t[i + dx]] !== K.solid) { this.swap(i, below + dx); return; }
        }
      }
      // Spread sideways to the farthest open cell within reach.
      const reach = SPREAD[m] || 1, dir = rnd() < 0.5 ? -1 : 1;
      for (let s = 0; s < 2; s++) {
        const dx = s ? -dir : dir;
        let last = -1;
        for (let k = 1; k <= reach; k++) {
          const xx = x + dx * k;
          if (xx < 0 || xx >= w) break;
          const j = i + dx * k, b = this.t[j];
          if (b === 0 || KIND[b] === K.gas || (KIND[b] === K.liquid && DENS[b] < DENS[m])) last = j; else break;
        }
        if (last >= 0) { this.swap(i, last); return; }
      }
    }

    gas(i, x, y, m) {
      const t = this.t, life = this.life;
      if (m === M.SMOKE) { this.smoke(i, x, y); return; }
      if (m === M.ANTIMATTER || m === M.OXYGEN) {
        // Both drift about in every direction (no rising). Anti-matter wipes out whatever it touches, and itself.
        const d = ri(8), xx = x + NX[d], yy = y + NY[d];
        if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) return;
        const j = yy * this.w + xx, b = t[j];
        if (m === M.ANTIMATTER && b && b !== M.ANTIMATTER && !PROOF[b] && KIND[b] !== K.spark) {
          t[j] = 0; this.skin[j] = 0; if (this.hasTint) this.tint[j] = 0;
          this.put(i, M.SPARKLE, 4 + ri(6)); this.stamp[i] = this.clock;
          if (rnd() < 0.06) this.airPop(x, y, 0.8);
          return;
        }
        if (b === 0 && rnd() < (m === M.OXYGEN ? 0.6 : 0.7)) this.swap(i, j);
        return;
      }
      if (m === M.FOG) { this.fog(i, x, y); return; }
      if (m === M.PLASMA) {
        if (life[i]-- <= 1) { t[i] = 0; return; }
        const dx = ri(3) - 1, dy = rnd() < 0.6 ? -1 : ri(3) - 1, xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < this.w && yy < this.h && t[yy * this.w + xx] === 0) this.swap(i, yy * this.w + xx);
        return;
      }
      if (!NOFADE[m] && life[i]-- <= 1) { // neon and hydrogen never fade
        if (m === M.STEAM) {
          if (y < this.h * 0.3 && rnd() < 0.6) this.put(i, M.CLOUD);
          else if (rnd() < 0.4) this.put(i, M.WATER);
          else t[i] = 0;
        } else t[i] = 0;
        return;
      }
      const w = this.w;
      if (y > 0) {
        const up = i - w, b = t[up];
        // Rise through empty space, and bubble up through liquids.
        if (b === 0 || (KIND[b] === K.liquid && rnd() < 0.5)) { this.swap(i, up); return; }
        const dx = rnd() < 0.5 ? -1 : 1, xx = x + dx;
        if (xx >= 0 && xx < w && t[up + dx] === 0) { this.swap(i, up + dx); return; }
      }
      const dx = rnd() < 0.5 ? -1 : 1, xx = x + dx;
      if (xx >= 0 && xx < w && t[i + dx] === 0 && rnd() < 0.7) this.swap(i, i + dx);
    }

    /* Smoke lingers: it rises slowly, billows and curls to the side, and
       hangs around for several seconds before thinning out. */
    smoke(i, x, y) {
      const t = this.t, life = this.life, w = this.w;
      if (this.frame % 3 === 0 && life[i]-- <= 1) { t[i] = 0; return; }
      const r = rnd();
      // A gentle, gusty breeze that changes over time (and a little with height) makes the
      // plume sway. It only nudges the odds of drifting left or right, so wisps never pile
      // up into lines where the wind changes direction.
      const f = this.frame, breeze = 0.55 * Math.sin(f * 0.011) + 0.3 * Math.sin(f * 0.027 + y * 0.015);
      const lean = rnd() < 0.5 + 0.4 * breeze ? 1 : -1;
      if (r < 0.3 && y > 0) {
        const dx = rnd() < 0.5 ? 0 : lean, xx = x + dx;
        if (xx >= 0 && xx < w) {
          const j = i - w + dx, b = t[j];
          if (b === 0 || (KIND[b] === K.liquid && rnd() < 0.3)) { this.swap(i, j); return; }
        }
      }
      if (r < 0.48) {
        const dx = lean, xx = x + dx;
        if (xx >= 0 && xx < w && t[i + dx] === 0) this.swap(i, i + dx);
      }
    }

    fire(i, x, y, m) {
      const t = this.t, life = this.life, fuel = this.fuel, w = this.w;
      if (m === M.COLDFIRE || m === M.GHOSTFIRE) {
        if (life[i]-- <= 1) { t[i] = 0; return; }
        if (y > 0 && rnd() < (m === M.GHOSTFIRE ? 0.1 : 0.3)) { const dx = ri(3) - 1, xx = x + dx; if (xx >= 0 && xx < w && t[i - w + dx] === 0) this.swap(i, i - w + dx); }
        return;
      }
      if (life[i]-- <= 1) {
        const f = fuel[i];
        if (f === M.HYDROGEN) { if (rnd() < 0.5) this.put(i, M.WATER); else t[i] = 0; return; } // burnt hydrogen is water
        if (f === M.SULFUR) { this.put(i, M.SMOKE); return; } // thick smoke
        if ((f === M.PLANT || f === M.WOOD) && rnd() < 0.5) this.put(i, M.ASH);
        else if (rnd() < (f === M.OIL ? 0.5 : 0.22)) this.put(i, M.SMOKE);
        else t[i] = 0;
        return;
      }
      if (fuel[i] === M.SULFUR && y > 0 && t[i - w] === 0 && rnd() < 0.04) { this.put(i - w, M.SMOKE); this.stamp[i - w] = this.clock; }
      if (fuel[i]) {
        // Burning material stays put and sends flames up.
        if (y > 0 && t[i - w] === 0 && rnd() < 0.3) { this.put(i - w, M.FIRE, 6 + ri(14)); this.stamp[i - w] = this.clock; }
        return;
      }
      // Free flames flicker upward.
      if (y > 0 && rnd() < 0.3) {
        const dx = ri(3) - 1, xx = x + dx;
        if (xx >= 0 && xx < w && t[i - w + dx] === 0) this.swap(i, i - w + dx);
      }
    }

    cloud(i, x, y, m) {
      const t = this.t, w = this.w, h = this.h, storm = m === M.STORM;
      // Storm clouds throw their own lightning.
      if (storm && rnd() < 0.0004) { this.bolt(x, y); }
      // Rain (or snow when it's cold) from the cloud's underside.
      if (rnd() < 0.0003) { t[i] = 0; return; } // clouds slowly thin out
      if (y < h - 1 && t[i + w] === 0 && rnd() < (storm ? 0.012 : 0.004)) {
        const cold = y < h * 0.15 && rnd() < 0.3; // high clouds are cold enough to snow
        this.put(i + w, cold ? M.SNOW : M.WATER); this.tally.rain++;
        this.stamp[i + w] = this.clock;
        if (this.life[i]-- <= 1) { t[i] = 0; return; }
      }
      if (rnd() < 0.12) {
        const dx = ri(3) - 1, dy = rnd() < 0.3 ? -1 : 0, xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < w && yy >= 0) {
          const j = yy * w + xx, b = t[j];
          if (b === 0 || b === M.STEAM || b === M.SMOKE) this.swap(i, j);
        }
      }
    }

    /* Fog hugs the ground: it drifts sideways, barely rises, and slowly thins out. */
    fog(i, x, y) {
      const t = this.t, w = this.w, h = this.h;
      if ((this.frame & 3) === 0 && this.life[i]-- <= 1) { t[i] = 0; return; }
      if (rnd() > 0.35) return;
      const dx = ri(3) - 1, dy = rnd() < 0.15 ? -1 : rnd() < 0.3 ? 1 : 0, xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) return;
      const j = yy * w + xx;
      if (t[j] === 0) this.swap(i, j);
    }

    /* A firework in flight: climbs, trailing sparks, then bursts into colour. */
    rocket(i, x, y) {
      const t = this.t, w = this.w;
      const up = y > 0 ? i - w + (rnd() < 0.15 ? ri(3) - 1 : 0) : -1;
      if (this.life[i]-- <= 1 || up < 0) { this.burst(x, y); return; }
      const b = t[up], kb = KIND[b];
      // Wait behind other fireworks still in the stack; fly through flames, smoke and sparkles.
      if (b === M.FIREWORK || b === M.ROCKET) { if (this.life[i] < 4) this.burst(x, y); return; }
      if (b !== 0 && kb !== K.gas && kb !== K.fire && kb !== K.spark) { this.burst(x, y); return; }
      if (kb === K.fire || kb === K.spark) t[up] = 0;
      this.swap(i, up);
      if (rnd() < 0.6) { this.put(i, M.SPARKLE, 4 + ri(8)); this.stamp[i] = this.clock; }
    }
    burst(cx, cy) {
      const w = this.w, h = this.h, r = 4 + ri(4);
      this.t[cy * w + cx] = 0;
      for (let k = 0; k < 70; k++) {
        const a = rnd() * Math.PI * 2, d = r * (0.4 + rnd() * 0.6);
        const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const j = y * w + x;
        if (this.t[j] === 0 || KIND[this.t[j]] === K.gas) { this.put(j, M.SPARKLE, 15 + ri(30)); this.stamp[j] = this.clock; }
        else if (FLAM[this.t[j]] > 0 && rnd() < 0.3) this.ignite(j);
      }
    }

    /* A frost bomb: everything nearby freezes into ice and snow. */
    frostBlast(cx, cy) {
      this.hurtCreatures(cx, cy, 8, 'freeze');
      const r = 6 + ri(3), w = this.w, h = this.h;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const j = y * w + x, b = this.t[j], kb = KIND[b];
        if (b === M.FROSTBOMB && (dx || dy)) { this.t[j] = 0; this.pendingFrost = (this.pendingFrost || []).concat([x, y]); continue; }
        if (b === M.WATER || b === M.SEAWATER) this.put(j, M.ICE);
        else if (b === M.LAVA) this.put(j, M.OBSIDIAN);
        else if (kb === K.fire || b === M.STEAM) this.put(j, rnd() < 0.5 ? M.SNOW : 0);
        else if (b === 0) { const r2 = rnd(); if (r2 < 0.35) this.put(j, M.SNOW); else if (r2 < 0.45) this.put(j, M.ICE); }
      }
      this.t[cy * w + cx] = M.ICE;
    }

    /* Behaviours that aren't simple neighbour reactions. */
    special(i, x, y, m) {
      if (PROP[m] && this.props(i, x, y, m)) return;
      const t = this.t, w = this.w, h = this.h, life = this.life;
      switch (m) {
        case M.SAND:
          // Sand sitting under water slowly turns to mud.
          if (y > 0 && t[i - w] === M.WATER && rnd() < 0.0008) this.put(i, M.MUD);
          break;
        case M.MUD: case M.DIRT: {
          // Wet earth sprouts plants.
          if (y === 0) break;
          const up = t[i - w];
          const pr = up === 0 ? (m === M.DIRT ? 0.004 : 0.0012) : up === M.WATER ? 0.0002 : 0;
          if (pr && rnd() < pr && this.near(x, y, M.WATER)) {
            this.put(i - w, M.PLANT, 14 + ri(12)); this.stamp[i - w] = this.clock;
          }
          break;
        }
        case M.PLANT: {
          // Growth: life is the plant's remaining growing energy.
          if (life[i] > 0 && rnd() < 0.035) {
            const r = rnd();
            const dx = r < 0.55 ? 0 : r < 0.7 ? -1 : r < 0.85 ? 1 : r < 0.925 ? -1 : 1;
            const dy = r < 0.85 ? -1 : 0;
            const xx = x + dx, yy = y + dy;
            if (xx >= 0 && xx < w && yy >= 0) {
              const j = yy * w + xx, b = t[j];
              if (b === 0 || (b === M.WATER && rnd() < 0.15)) {
                const e = life[i] - 1;
                this.put(j, M.PLANT, e); this.stamp[j] = this.clock;
                if (rnd() > 0.08) life[i] = 0; // only the tips keep growing (with the odd branch)
              }
            }
          }
          // Drinking water gives more energy to grow.
          if (life[i] < 6 && rnd() < 0.008) {
            const d = ri(8), xx = x + NX[d], yy = y + NY[d];
            if (xx >= 0 && yy >= 0 && xx < w && yy < h && t[yy * w + xx] === M.WATER) {
              t[yy * w + xx] = 0; life[i] = Math.min(24, life[i] + 6);
            }
          }
          // Old stems turn to wood.
          if (life[i] === 0 && y > 0 && y < h - 1 && t[i - w] === M.PLANT && rnd() < 0.0015) {
            const below = t[i + w];
            if (below === M.PLANT || below === M.WOOD || below === M.MUD || below === M.DIRT) this.put(i, M.WOOD);
          }
          this.buried(i, y);
          break;
        }
        case M.WOOD:
          if (this.fuel[i] === TRUNK) this.growTree(i, x, y);
          else this.buried(i, y);
          break;
        case M.CAULDRON: this.cauldron(i, x, y); break;
        case M.PHILO: {
          // The philosopher's stone turns metal and stone it touches into gold.
          if (rnd() < 0.02) {
            const d = ri(8), xx = x + NX[d], yy = y + NY[d];
            if (xx >= 0 && yy >= 0 && xx < w && yy < h) {
              const j = yy * w + xx, b = t[j];
              if (b === M.METAL || b === M.STONE || b === M.RUST) this.put(j, M.GOLD);
            }
          }
          break;
        }
        case M.MIRROR: {
          // A mirror remembers the first thing that touches it and copies it forever.
          const d = ri(8), xx = x + NX[d], yy = y + NY[d];
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
          const j = yy * w + xx, b = t[j];
          if (!this.fuel[i]) {
            if (b && b !== M.MIRROR && b !== M.VOID && b !== M.CAULDRON && b !== M.SPARKLE && b !== M.LIGHTNING) this.fuel[i] = b;
          } else if (b === 0 && rnd() < 0.06) { this.put(j, this.fuel[i]); this.stamp[j] = this.clock; }
          break;
        }
        case M.VOID: {
          const d = ri(8), xx = x + NX[d], yy = y + NY[d];
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
          const j = yy * w + xx, b = t[j];
          if (b && b !== M.VOID && b !== M.CAULDRON && b !== M.WALL && rnd() < 0.6) t[j] = 0;
          break;
        }
        case M.ETERNAL:
          if (y > 0 && t[i - w] === 0 && rnd() < 0.35) { this.put(i - w, M.FIRE, 10 + ri(16)); this.stamp[i - w] = this.clock; }
          break;
        case M.SEED:
          // A seed resting on earth sprouts into a tree.
          if (y < h - 1 && (t[i + w] === M.DIRT || t[i + w] === M.MUD) && rnd() < 0.02) {
            // One tree per patch: nearby seeds are taken up by this one.
            for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
              const xx = x + dx, yy = y + dy;
              if (xx >= 0 && yy >= 0 && xx < w && yy < h && t[yy * w + xx] === M.SEED) t[yy * w + xx] = 0;
            }
            this.put(i, M.WOOD, 18 + ri(14)); this.fuel[i] = TRUNK;
          }
          break;
        case M.CRYSTAL:
          if (this.fuel[i] === TRUNK + 1) this.growCrystal(i, x, y);
          break;
        case M.CRYSTALSEED:
          if (y < h - 1) {
            const below = t[i + w];
            if ((below === M.DIRT || below === M.MUD || below === M.STONE || below === M.SAND) && rnd() < 0.02) {
              for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
                const xx = x + dx, yy = y + dy;
                if (xx >= 0 && yy >= 0 && xx < w && yy < h && t[yy * w + xx] === M.CRYSTALSEED && (dx || dy)) t[yy * w + xx] = 0;
              }
              this.put(i, M.CRYSTAL, 14 + ri(14)); this.fuel[i] = TRUNK + 1;
            }
          }
          break;
        case M.MOSS: case M.GLOWMOSS:
          // Moss creeps over stone, but only where it's damp.
          if (rnd() < 0.03) {
            const d = ri(8), xx = x + NX[d], yy = y + NY[d];
            if (xx >= 0 && yy >= 0 && xx < w && yy < h) {
              const j = yy * w + xx, b = t[j];
              if ((b === M.STONE || b === M.BRICK || b === M.SANDSTONE) && (this.near(xx, yy, M.WATER) || this.near(x, y, M.WATER))) this.put(j, m);
            }
          }
          break;
        case M.VINE:
          // Vines hang down and grow longer, swaying a little.
          if (life[i] > 0 && y < h - 1 && rnd() < 0.05) {
            const dx = rnd() < 0.2 ? ri(3) - 1 : 0, xx = Math.max(0, Math.min(w - 1, x + dx)), j = (y + 1) * w + xx;
            if (t[j] === 0) { this.put(j, M.VINE, life[i] - 1); this.stamp[j] = this.clock; if (rnd() > 0.06) life[i] = 0; }
          }
          break;
        case M.CACTUS:
          // Cacti grow straight up from sand, now and then sprouting an arm.
          if (life[i] > 0 && y > 0 && rnd() < 0.012) {
            const arm = life[i] % 4 === 2 && rnd() < 0.5, dx = arm ? (rnd() < 0.5 ? -1 : 1) : 0, xx = x + dx;
            if (xx >= 0 && xx < w) {
              const j = arm ? i + dx : i - w;
              if (t[j] === 0) { this.put(j, M.CACTUS, arm ? 2 : life[i] - 1); this.stamp[j] = this.clock; if (!arm) life[i] = 0; }
            }
          }
          break;
        case M.SWAMP:
          if (y > 0 && t[i - w] === 0 && rnd() < 0.0008 && this.discovered[M.BUBBLE]) { this.put(i - w, M.BUBBLE); this.stamp[i - w] = this.clock; }
          break;
        case M.EMBER:
          if (this.frame % 3 === 0 && life[i]-- <= 1) { this.put(i, rnd() < 0.7 ? M.ASH : 0); break; }
          if (y > 0 && t[i - w] === 0 && rnd() < 0.01) { this.put(i - w, M.FIRE, 5 + ri(8)); this.stamp[i - w] = this.clock; }
          break;
        case M.FROSTCRYSTAL: {
          // Frost reaches a few cells out, freezing water and cooling lava.
          if (rnd() < 0.15) {
            const xx = x + ri(9) - 4, yy = y + ri(9) - 4;
            if (xx >= 0 && yy >= 0 && xx < w && yy < h) {
              const j = yy * w + xx, b = t[j];
              if (b === M.WATER || b === M.SEAWATER) this.put(j, M.ICE);
              else if (b === M.LAVA) this.put(j, M.OBSIDIAN);
              else if (KIND[b] === K.fire && b !== M.COLDFIRE) t[j] = 0;
            }
          }
          break;
        }
        case M.STAR:
          if (rnd() < 0.01) {
            const d = ri(8), xx = x + NX[d], yy = y + NY[d];
            if (xx >= 0 && yy >= 0 && xx < w && yy < h && t[yy * w + xx] === 0) { this.put(yy * w + xx, M.SPARKLE, 10 + ri(20)); this.stamp[yy * w + xx] = this.clock; }
          }
          break;
        // ---------------- Third wave ----------------
        case M.LN2: {
          // Boils away slowly in open air, and fast against anything warmer, freezing it as it goes.
          if (y > 0 && t[i - w] === 0 && rnd() < 0.002) { this.put(i - w, M.FOG); this.stamp[i - w] = this.clock; t[i] = 0; break; }
          const d = ri(8), xx = x + NX[d], yy = y + NY[d];
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
          const j = yy * w + xx, b = t[j];
          if (!b || b === M.LN2 || COLD[b] || PROOF[b] || KIND[b] === K.gas) break;
          if (b === M.WATER || b === M.SEAWATER || b === M.SWAMP || b === M.POTION || b === M.CURE) this.put(j, M.ICE);
          else if (b === M.LAVA) this.put(j, M.OBSIDIAN);
          else if (b === M.STEAM || b === M.FOG || b === M.CLOUD) this.put(j, M.SNOW);
          else if (KIND[b] === K.fire && b !== M.ETERNAL) t[j] = 0;
          else if (b === M.MUD) this.put(j, M.DIRT);
          if (rnd() < 0.015) { if (rnd() < 0.4 && y > 0 && t[i - w] === 0) { this.put(i - w, M.FOG); this.stamp[i - w] = this.clock; } t[i] = 0; }
          break;
        }
        case M.SPONGE: {
          // life = how much water it holds (0..12). It soaks water up, shares it with drier sponge, and dries out near heat.
          for (let k = 0; k < 3; k++) {
            const d = ri(8), xx = x + NX[d], yy = y + NY[d];
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = yy * w + xx, b = t[j];
            if ((b === M.WATER || b === M.SEAWATER || b === M.SWAMP) && life[i] < 12 && rnd() < 0.6) { t[j] = 0; this.skin[j] = 0; life[i] = Math.min(12, life[i] + 2); }
            else if (b === M.SPONGE && life[j] < life[i] && rnd() < 0.5) { life[j]++; life[i]--; } // water spreads right through it
            else if ((FIERY[b] || HOT[b]) && life[i] > 0 && rnd() < 0.2) { life[i]--; if (y > 0 && t[i - w] === 0) { this.put(i - w, M.STEAM); this.stamp[i - w] = this.clock; } }
          }
          break;
        }
        case M.VIRUS: {
          // Infects whatever it touches; the cell remembers what it was (in fuel) so Cure can turn it back.
          if (rnd() > 0.15) break;
          const d = ri(8), xx = x + NX[d], yy = y + NY[d];
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
          const j = yy * w + xx, b = t[j];
          if (!b || b === M.VIRUS || b === M.CURE || PROOF[b] || b === M.ANTIMATTER || b === M.VACUUM) break;
          const kb = KIND[b]; if (kb === K.fire || kb === K.spark || kb === K.gas || kb === K.cloud) break;
          if (this.near(xx, yy, M.CURE)) break; // Cure protects what it's touching
          const was = this.matAt(j);
          this.put(j, M.VIRUS); this.fuel[j] = was; this.stamp[j] = this.clock;
          break;
        }
        case M.CURE: {
          for (let k = 0; k < 2; k++) {
            const d = ri(8), xx = x + NX[d], yy = y + NY[d];
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = yy * w + xx;
            if (t[j] === M.VIRUS) {
              const f = this.fuel[j];
              if (f && f !== M.VIRUS && MATS[f] && !MATS[f].reserved) this.put(j, f); else t[j] = 0;
              this.stamp[j] = this.clock;
              if (rnd() < 0.05) { t[i] = 0; break; } // it gets used up
            }
          }
          break;
        }
        case M.TNT:
          if (this.fuel[i]) { // lit: the fuse fizzes, then boom
            if (life[i]-- <= 1) { t[i] = 0; this.blast(x, y, BOOM[M.TNT]); break; }
            if (y > 0 && t[i - w] === 0 && rnd() < 0.35) { this.put(i - w, M.SPARKLE, 3 + ri(5)); this.stamp[i - w] = this.clock; }
          }
          break;
        case M.THERMITE: {
          if (!this.fuel[i]) break;
          // Lit: white-hot. Melts metal and stone into lava, boils water, lights anything that burns, and sinks through what it melts.
          if (life[i]-- <= 1) { this.put(i, rnd() < 0.5 ? M.LAVA : M.METAL); break; }
          for (let k = 0; k < 2; k++) {
            const d = ri(8), xx = x + NX[d], yy = y + NY[d];
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = yy * w + xx, b = t[j];
            if (b === 0) { if (NY[d] < 0 && rnd() < 0.25) { this.put(j, M.FIRE, 4 + ri(8)); this.stamp[j] = this.clock; } continue; }
            if (b === M.THERMITE) { if (!this.fuel[j]) { this.fuel[j] = 1; life[j] = 150 + ri(70); } continue; }
            if (PROOF[b]) continue;
            if (b === M.WATER || b === M.SEAWATER) this.put(j, M.STEAM);
            else if (b === M.ICE || b === M.SNOW) this.put(j, M.WATER);
            else if (b === M.SAND) { if (rnd() < 0.2) this.put(j, M.GLASS); }
            else if (MELTABLE[b]) { if (rnd() < 0.07) this.put(j, M.LAVA); }
            else if (FLAM[b] > 0) this.ignite(j);
            else if (KIND[b] === K.solid && rnd() < 0.02) this.put(j, M.LAVA);
          }
          break;
        }
        case M.PLUTONIUM: {
          if (rnd() < 0.02) { // warm: boils water, melts ice
            const d = ri(8), xx = x + NX[d], yy = y + NY[d];
            if (xx >= 0 && yy >= 0 && xx < w && yy < h) { const j = yy * w + xx, b = t[j]; if (b === M.WATER || b === M.SEAWATER) this.put(j, M.STEAM); else if (b === M.ICE || b === M.SNOW) this.put(j, M.WATER); }
          }
          if (rnd() < 0.002 && y > 0 && t[i - w] === 0) { this.put(i - w, M.SPARKLE, 3 + ri(4)); this.stamp[i - w] = this.clock; } // a flicker of radiation
          if (rnd() < 0.003) { // too much packed together goes critical
            let n = 0;
            for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && t[yy * w + xx] === M.PLUTONIUM) n++; }
            if (n >= 36 && rnd() < 0.01) { this.nuke(x, y); break; }
            if (n >= 30 && y > 0 && t[i - w] === 0 && rnd() < 0.3) { this.put(i - w, M.SPARKLE, 4 + ri(6)); this.stamp[i - w] = this.clock; } // getting dangerous: it fizzes
          }
          if (rnd() < 0.00002) this.put(i, M.STONE); // very slowly decays
          break;
        }
        case M.BLACKHOLE: case M.VACUUM: {
          // Swallow what touches it. A black hole eats anything (solids slowly); a vacuum only loose things.
          const d = ri(8), xx = x + NX[d], yy = y + NY[d];
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
          const j = yy * w + xx, b = t[j];
          if (!b || PROOF[b] || b === m) break;
          const soft = KIND[b] !== K.solid && KIND[b] !== K.stamp;
          if (m === M.VACUUM) { if (soft && b !== M.WHITEHOLE && rnd() < 0.8) { t[j] = 0; this.skin[j] = 0; } break; }
          if (soft || rnd() < 0.02) this.swallow(j);
          break;
        }
        case M.PORTALIN: {
          if (!this.portOut || !this.portOut.length) break;
          for (let k = 0; k < 2; k++) {
            const d = ri(8), xx = x + NX[d], yy = y + NY[d];
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = yy * w + xx, b = t[j], kb = KIND[b];
            if (!b) continue;
            if (kb === K.powder || kb === K.liquid) { // falling things go in from above (heading down) or from the side
              if (NY[d] > 0) continue;
              this.teleport(j, NY[d] < 0 ? 0 : -NX[d], NY[d] < 0 ? 1 : 0);
            } else if (kb === K.gas || kb === K.fire || kb === K.float || kb === K.skypowder || kb === K.spark) this.teleport(j, 0, 0);
          }
          break;
        }
        case M.GRAVBOMB:
          if (!this.fuel[i]) { // sticks to the first thing it touches
            let hit = y >= h - 1;
            for (let k = 0; k < 4 && !hit; k++) {
              const xx = x + [0, 0, -1, 1][k], yy = y + [1, -1, 0, 0][k];
              if (xx < 0 || yy < 0 || xx >= w || yy >= h) { hit = true; break; }
              const b = t[yy * w + xx], kb = KIND[b];
              if (b && kb !== K.gas && kb !== K.fire && kb !== K.spark && kb !== K.cloud && !(b === M.GRAVBOMB && !this.fuel[yy * w + xx])) hit = true;
            }
            if (hit) { this.fuel[i] = 1; life[i] = 40 + ri(16); }
          } else if (life[i]-- <= 1) this.gravPush(x, y);
          break;
        // ---------------- Fourth wave ----------------
        case M.METEORITE: {
          // Falls fast with a trail of sparks; the farther it falls, the bigger the crash (fuel counts the fall).
          if (y < h - 1 && this.yields(m, i + w)) {
            let j = i;
            for (let k = 0; k < 2 && ((j / w) | 0) < h - 1 && this.yields(m, j + w); k++) { this.swap(j, j + w); j += w; }
            this.fuel[j] = Math.min(250, this.fuel[j] + 2);
            if (t[i] === 0 && rnd() < 0.6) { this.put(i, M.SPARKLE, 4 + ri(5)); this.stamp[i] = this.clock; }
            break;
          }
          if (this.fuel[i] > 16) { // crash!
            const p = 1 + Math.min(this.fuel[i], 150) / 40; t[i] = 0; this.fuel[i] = 0;
            this.blast(x, y, p); this.put(i, M.IRON); this.stamp[i] = this.clock;
          } else this.fuel[i] = 0;
          break;
        }
        case M.FIREFLOWER:
          if (y > 0 && t[i - w] === 0 && rnd() < 0.008) { this.put(i - w, M.FIRE, 4 + ri(6)); this.stamp[i - w] = this.clock; } // a little spark
          break;
        case M.FROSTFERN: case M.HEATCRYSTAL: {
          if (rnd() > 0.15) break;
          const xx = x + ri(5) - 2, yy = y + ri(5) - 2; if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
          const j = yy * w + xx, b = t[j];
          if (m === M.FROSTFERN) { // freezes water, puts out flames
            if (b === M.WATER || b === M.SEAWATER) this.put(j, M.ICE); else if (b === M.STEAM) this.put(j, M.WATER);
            else if (KIND[b] === K.fire && b !== M.ETERNAL) t[j] = 0; else if (b === M.LAVA) this.put(j, M.OBSIDIAN);
          } else { // warms: boils water, melts ice (heat things like chocolate and wax melt by themselves)
            if (b === M.WATER || b === M.SEAWATER) this.put(j, M.STEAM); else if (b === M.ICE || b === M.SNOW) this.put(j, M.WATER); else if (b === M.MUD) this.put(j, M.DIRT);
          }
          break;
        }
        case M.INK: {
          if (rnd() > 0.06) break; // stains what it touches (the stain moves with water)
          const d = ri(8), xx = x + NX[d], yy = y + NY[d]; if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
          const j = yy * w + xx, b = t[j];
          if (b && b !== M.INK && KIND[b] !== K.gas && KIND[b] !== K.fire && !PROOF[b]) { this.tint[j] = M.INK; this.hasTint = true; }
          break;
        }
        case M.LAVA:
          // Lava throws sparks of fire, and slowly cools to stone (sometimes metal).
          if (y > 0 && t[i - w] === 0 && rnd() < 0.006) { this.put(i - w, M.FIRE, 8 + ri(12)); this.stamp[i - w] = this.clock; }
          if (rnd() < 0.00015) this.put(i, rnd() < 0.1 ? M.METAL : M.STONE);
          break;
      }
    }
    /* A growing trunk climbs one cell at a time, then bursts into leaves. */
    growTree(i, x, y) {
      const t = this.t, w = this.w, h = this.h, life = this.life;
      if (rnd() > 0.1) return;
      // Leaves, seeds and loose air don't stop a trunk; anything solid does.
      const open = (b) => b === 0 || KIND[b] === K.gas || KIND[b] === K.float || b === M.PLANT || b === M.SEED || b === M.SPARKLE;
      if (life[i] > 1 && y > 1) {
        let xx = x + (life[i] % 5 === 0 ? ri(3) - 1 : 0);
        if (xx < 0 || xx >= w) xx = x;
        let j = (y - 1) * w + xx;
        if (!open(t[j])) { j = i - w; xx = x; }
        if (open(t[j])) {
          this.put(j, M.WOOD, life[i] - 1); this.fuel[j] = TRUNK; this.stamp[j] = this.clock;
          // A second column of bark makes the trunk two cells thick.
          if (xx + 1 < w && open(t[j + 1]) && life[i] > 4) { this.put(j + 1, M.WOOD); this.stamp[j + 1] = this.clock; }
          this.fuel[i] = 0; life[i] = 0;
          return;
        }
      }
      // Top of the trunk: a big round canopy of leaves.
      const r = 5 + ri(4);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r - 3; dx <= r + 3; dx++) {
        if ((dx * dx) / ((r + 3) * (r + 3)) + (dy * dy) / (r * r) > 1 || rnd() < 0.12) continue;
        const xx = x + dx, yy = y + dy - 2;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (t[j] === 0 || KIND[t[j]] === K.gas) { this.put(j, M.PLANT, 0); this.stamp[j] = this.clock; }
      }
      this.fuel[i] = 0; life[i] = 0;
    }

    /* Crystal spires grow up from a crystal seed, branching now and then. */
    growCrystal(i, x, y) {
      const t = this.t, w = this.w, life = this.life;
      if (rnd() > 0.1) return;
      if (life[i] > 1 && y > 0) {
        const r = rnd(), dx = r < 0.6 ? 0 : r < 0.8 ? -1 : 1, xx = x + dx;
        if (xx >= 0 && xx < w) {
          const j = i - w + dx;
          if (t[j] === 0 || KIND[t[j]] === K.gas) {
            this.put(j, M.CRYSTAL, life[i] - 1); this.fuel[j] = TRUNK + 1; this.stamp[j] = this.clock;
            if (rnd() > 0.15) { this.fuel[i] = 0; life[i] = 0; } else life[i] = Math.max(2, life[i] >> 1); // the odd branch
            return;
          }
        }
      }
      this.fuel[i] = 0; life[i] = 0;
    }

    /* Cauldron: an ingredient touching the pot meets another one close by,
       and if the pair is a recipe they brew into something magical. */
    cauldron(i, x, y) {
      const t = this.t, w = this.w, h = this.h;
      if (y > 0 && t[i - w] === 0 && rnd() < 0.0006) this.sparkle(x, y - 1, 1);
      if (rnd() > 0.5) return;
      const d = ri(8), ax = x + NX[d], ay = y + NY[d];
      if (ax < 0 || ay < 0 || ax >= w || ay >= h) return;
      const a = ay * w + ax, A = t[a];
      if (!A || A === M.CAULDRON || A === M.SPARKLE) return;
      const bx = x + ri(7) - 3, by = y + ri(7) - 3;
      if (bx < 0 || by < 0 || bx >= w || by >= h) return;
      const b = by * w + bx, B = t[b];
      if (!B || b === a || B === A) return;
      const out = MAGIC[A * COUNT + B];
      if (!out) return;
      this.put(a, out); this.stamp[a] = this.clock;
      t[b] = 0;
      this.sparkle(ax, ay, 6);
    }
    sparkle(cx, cy, n) {
      for (let k = 0; k < n * 3 && n > 0; k++) {
        const x = cx + ri(5) - 2, y = cy + ri(5) - 3;
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        const j = y * this.w + x;
        if (this.t[j] === 0) { this.put(j, M.SPARKLE, 10 + ri(20)); this.stamp[j] = this.clock; n--; }
      }
    }

    /* Floaty magic things (essence, spirits, fairies, bubbles) drift around
       instead of falling. */
    float(i, x, y, m) {
      const t = this.t, w = this.w, h = this.h, life = this.life;
      if (m !== M.FAIRY && m !== M.NEBULA && (m === M.BUBBLE || (this.frame & 3) === 0) && life[i]-- <= 1) {
        if (m === M.BUBBLE && rnd() < 0.3) this.put(i, M.WATER); else t[i] = 0;
        return;
      }
      // Life essence brings things to life: fish in the sea, frogs in a swamp…
      if (m === M.ESSENCE) {
        const k = ri(8), xx = x + NX[k], yy = y + NY[k];
        const b = xx >= 0 && yy >= 0 && xx < w && yy < h ? t[yy * w + xx] : 0;
        const pet = LIFE_FROM[b];
        if (pet === M.ANT) { if (rnd() < 0.02) { t[i] = 0; this.spawn(pet, x, y, true); return; } }
        else if (pet && rnd() < 0.3) { t[i] = 0; if (rnd() < 0.15) this.spawn(pet, x, y, true); return; } // most of it just soaks in
      }
      // Life essence that settles on earth becomes a sprout with energy to grow.
      if (m === M.ESSENCE && y < h - 1) {
        const below = t[i + w];
        if ((below === M.DIRT || below === M.ASH || below === M.SAND) && rnd() < 0.25) {
          this.put(i, M.PLANT, 16 + ri(14));
          return;
        }
      }
      if (m === M.FAIRY && y < h - 1 && t[i + w] === 0 && rnd() < 0.0015) { this.put(i + w, M.STARDUST); this.stamp[i + w] = this.clock; }
      const move = m === M.FAIRY ? 0.6 : m === M.BUBBLE ? 0.5 : m === M.SPIRIT ? 0.35 : 0.45;
      if (rnd() > move) return;
      let dx = ri(3) - 1, dy = ri(3) - 1;
      if (m === M.BUBBLE) dy = rnd() < 0.8 ? -1 : 0;
      else if (m === M.ESSENCE && rnd() < 0.55) dy = 1; // drifts down gently, like pollen
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) return;
      const j = yy * w + xx, b = t[j];
      if (b === 0 || KIND[b] === K.gas) this.swap(i, j);
      else if (m === M.BUBBLE && KIND[b] !== K.liquid && rnd() < 0.15) { if (rnd() < 0.3) this.put(i, M.WATER); else t[i] = 0; }
    }

    /* Sky sand: a powder whose "down" is up. */
    skypowder(i, x, y, m) {
      if (y === 0) return;
      const w = this.w, up = i - w;
      if (this.yields(m, up)) { this.swap(i, up); return; }
      if (rnd() > SLIP[m]) return;
      const dir = rnd() < 0.5 ? -1 : 1;
      for (let s = 0; s < 2; s++) {
        const dx = s ? -dir : dir, xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        if (this.yields(m, up + dx) && KIND[this.t[i + dx]] !== K.solid) { this.swap(i, up + dx); return; }
      }
    }

    // Plants and wood buried under earth become oil.
    buried(i, y) {
      if (y === 0) return;
      const up = this.t[i - this.w];
      if ((up === M.SAND || up === M.MUD || up === M.DIRT || up === M.STONE) && rnd() < 0.0006) this.put(i, M.OIL);
    }
    near(x, y, m) {
      for (let d = 0; d < 8; d++) {
        const xx = x + NX[d], yy = y + NY[d];
        if (xx >= 0 && yy >= 0 && xx < this.w && yy < this.h && this.t[yy * this.w + xx] === m) return true;
      }
      return false;
    }


    /* ---------------- Creatures ----------------
       Little animals that live on top of the grid. Each has a position in
       cells (fractions allowed), a speed, a facing and a state; every frame it
       looks at the cells around it to decide what to do. */
    spawn(k, x, y, discover) {
      if (this.creatures.length >= MAX_CREATURES || x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
      if (k === M.STICKMAN) { // only ever one: placing him again moves him (and where he comes back)
        this.creatures = this.creatures.filter((o) => o.k !== M.STICKMAN);
        this.stickHome = { x, y };
      }
      const c = { k, x, y, vx: 0, vy: 0, dir: rnd() < 0.5 ? -1 : 1, s: 0, t: 30 + ri(90), a: 0, f: ri(1000), p: ri(90) };
      this.sfx.born++; this.tally.species[k] = (this.tally.species[k] || 0) + 1;
      this.creatures.push(c);
      if (discover !== false && !this.discovered[k]) { this.discovered[k] = 1; if (this.onDiscover) this.onDiscover(k); }
      return c;
    }
    cellAt(x, y) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || x >= this.w || y >= this.h) return M.STONE; // walls and floor
      if (y < 0) return 0; // open sky above the top
      return this.t[y * this.w + x];
    }
    // Remove creatures near (cx, cy); optionally only one kind. Returns how many.
    removeCreatures(cx, cy, r, k) {
      const before = this.creatures.length, r2 = r * r + r;
      this.creatures = this.creatures.filter((c) => (k && c.k !== k) || (c.x - cx) ** 2 + (c.y - cy) ** 2 > r2);
      return before - this.creatures.length;
    }
    hurtCreatures(cx, cy, r, how) {
      const r2 = r * r;
      this.creatures.forEach((c) => {
        if (c.k === M.GHOST || (how === 'burn' && ABIL[c.k] && ABIL[c.k].fireproof)) return;
        if ((c.x - cx) ** 2 + (c.y - cy) ** 2 <= r2) c.dead = how;
      });
    }
    creatureAt(x, y, r) {
      let best = null, bd = r * r + 0.01;
      this.creatures.forEach((c) => { const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = c; } });
      return best;
    }
    stepCreatures() {
      { // how far everything moved since last frame (for the stats), split into walking, flying and swimming
        const T = this.tally;
        for (const c of this.creatures) {
          if (c.lx !== undefined) {
            const d = Math.min(3, Math.abs(c.x - c.lx) + Math.abs(c.y - c.ly)), mv = MATS[c.k].move;
            if (c.k === M.STICKMAN) T.stickDist += Math.min(2, Math.abs(c.x - c.lx));
            else if (FLYMOVE[mv]) T.flyDist += d; else if (SWIMMOVE[mv]) T.swimDist += d; else T.steps += Math.min(2, Math.abs(c.x - c.lx));
          }
          c.lx = c.x; c.ly = c.y;
        }
      }
      const list = this.creatures;
      for (let n = 0; n < list.length; n++) {
        const c = list[n];
        if (c.dead) continue;
        c.f++; c.age = (c.age || 0) + 1;
        if (c.y < 0) c.y = 0;
        const here = this.cellAt(c.x, c.y), A = ABIL[c.k];
        if (c.k === M.GHOST) { if (here === M.VOID) c.dead = 'void'; else this.ghost(c); continue; } // ghosts pass through everything
        if (c.k === M.STICKMAN && c.s === 9) { this.player(c, here); continue; } // knocked out
        if ((here === M.QUICKSAND || (this.cellAt(c.x, c.y + 1) === M.QUICKSAND && !OPEN[here])) && c.k !== M.STICKMAN && c.k !== M.GHOST) { // stuck, and slowly swallowed
          c.y += 0.03; if (this.cellAt(c.x, c.y - 2) === M.QUICKSAND && rnd() < 0.01) c.dead = 'crush';
          continue;
        }
        if (here === M.LN2) { c.dead = 'freeze'; continue; }
        if (c.tv && c.k !== M.STICKMAN) { this.tumble(c, here); if (c.tv || c.dead) continue; } // flying out of a portal
        const proof = A && A.fireproof, zapper = A && A.zaps;
        // Fire, lava, acid and the like are deadly; so is being buried or frozen solid.
        // Creatures that zap are safe in their own lightning.
        if (DEADLY[here] && !(proof && FIERY[here]) && !(zapper && here === M.LIGHTNING)) { c.dead = 'burn'; continue; }
        if (!(c.f & 3) && c.k !== M.FIREFLY && !proof) { // fireflies are born from embers and dodge flames
          const k = ri(4), nb = this.cellAt(c.x + NX[k * 2 % 8], c.y + NY[k * 2 % 8]);
          if (HOT[nb] && !(zapper && nb === M.LIGHTNING) && rnd() < 0.35) { c.dead = 'burn'; continue; }
        }
        if (!this.canBe(c.k, here)) {
          // Something fell on it: try to wriggle up out of the way.
          if (this.canBe(c.k, this.cellAt(c.x, c.y - 1))) c.y -= 1;
          else if (this.canBe(c.k, this.cellAt(c.x, c.y - 2))) c.y -= 2;
          else { c.dead = here === M.ICE || here === M.SNOW ? 'freeze' : 'crush'; continue; }
        }
        switch (c.k) {
          case M.FISH: this.fish(c, here); break;
          case M.BIRD: this.bird(c, here); break;
          case M.WORM: this.worm(c, here); break;
          case M.FIREFLY: this.flutter(c, here, 0.28); break;
          case M.BEE: this.bee(c, here); break;
          case M.FROG: this.frog(c, here, list); break;
          case M.ANT: this.ant(c, here); break;
          case M.SNAIL: this.walk(c, here, { speed: 0.035, climb: true, drown: 1500, pause: 0.3 }); if (rnd() < 0.002) this.nibble(c); break;
          case M.LIZARD: this.eat(c, list, BUGS, 4.5); this.walk(c, here, { speed: 0.5, drown: 400, pause: 0.6 }); break;
          case M.PENGUIN: this.eat(c, list, FISHY, 2.5); this.penguin(c, here); break;
          case M.CRAB: this.walk(c, here, { speed: 0.14, waterWalk: true, pause: 0.35 }); break;
          case M.DRAGON: this.dragon(c, here); break;
          case M.COW: this.flee(c, list); this.graze(c); this.walk(c, here, { speed: 0.07, pause: 0.5, drown: 600 }); break;
          case M.SNAKE: this.eat(c, list, SNAKE_FOOD, 2.5); this.walk(c, here, { speed: 0.22, pause: 0.2, drown: 900 }); break;
          case M.RABBIT: this.flee(c, list); this.graze(c); this.leap(c, here); break;
          case M.JELLYFISH: this.jelly(c, here); break;
          case M.TADPOLE: this.fish(c, here); break;
          case M.CATERPILLAR: this.caterpillar(c, here); break;
          case M.BUTTERFLY: this.bee(c, here); break;
          case M.EGG: this.egg(c); break;
          case M.STICKMAN: this.player(c, here); break;
          default: if (MOVE[c.k]) this.custom(c, here, list);
        }
        if (A && !c.dead) this.abilities(c, A, here);
        // Creatures that wander into a Portal In come out of a Portal Out.
        if (this.portOut && this.portOut.length && !c.dead) {
          if (c.pcd > 0) c.pcd--;
          else {
            const tall = c.k === M.STICKMAN ? 6 : 1;
            let dx = 0, dy = this.cellAt(c.x, c.y + 1) === M.PORTALIN ? 1 : 0;
            for (let up = 0; up <= tall && !dy && !dx; up += 3) dx = this.cellAt(c.x + 1, c.y - up) === M.PORTALIN ? 1 : this.cellAt(c.x - 1, c.y - up) === M.PORTALIN ? -1 : 0;
            if (dx || dy) { // in it goes, and out it comes still moving the same way, a little faster
              const sp = c.tv ? Math.hypot(c.tv[0], c.tv[1]) : c.k === M.STICKMAN ? Math.hypot(c.vx || 0, c.vy || 0) : Math.abs(c.vy || 0);
              this.portalJump(c, dx, dy, Math.max(1, sp));
            }
          }
        }
      }
      // Clear out the dead, leaving a puff of smoke where something burned.
      if (list.some((c) => c.dead)) {
        const booms = [];
        this.creatures = list.filter((c) => {
          if (!c.dead) return true;
          if (c.k === M.STICKMAN) { this.knockOut(c, c.dead); c.dead = undefined; return true; } // he always comes back
          if (c.dead === 'hatched') this.sfx.hatched++; else { this.sfx.lost++; this.tally.deaths[c.dead] = (this.tally.deaths[c.dead] || 0) + 1; }
          if ((c.age || 0) > this.tally.oldest) this.tally.oldest = c.age;
          // Explosive creatures go off when they burn, get blown up, or their fuse runs out.
          if (ABIL[c.k] && ABIL[c.k].explodes && (c.dead === 'burn' || c.dead === 'boom')) { booms.push(Math.round(c.x), Math.round(c.y) - 1); return false; }
          if (c.dead === 'burn') { const x = Math.round(c.x), y = Math.round(c.y) - 1; if (x >= 0 && y >= 0 && x < this.w && y < this.h && this.t[y * this.w + x] === 0) this.put(y * this.w + x, M.SMOKE); }
          return false;
        });
        for (let k = 0; k < booms.length; k += 2) {
          const x = Math.max(0, Math.min(this.w - 1, booms[k])), y = Math.max(0, Math.min(this.h - 1, booms[k + 1]));
          this.blast(x, y, 1.2);
        }
      }
    }
    // Where each creature can be at all (anything else and it is buried).
    canBe(k, m) {
      if (m === 0 || OPEN[m]) return true;
      if (k === M.STICKMAN && KIND[m] === K.liquid) return true;
      if (m === M.QUICKSAND) return true; // (it sinks in: see stepCreatures) // he wades through any liquid (the nasty ones still hurt)
      if (WATERY[m]) return true; // flyers drown in it, but it isn't solid
      if ((k === M.WORM || MOVE[k] === 'burrow') && SOIL[m]) return true;
      if (FIERY[m] && ABIL[k] && ABIL[k].fireproof) return true;
      return false;
    }
    // Move by (dx, dy) if the cell there passes ok(); returns whether it moved.
    go(c, dx, dy, ok) {
      const m = this.cellAt(c.x + dx, c.y + dy);
      if (!ok(m)) return false;
      c.x += dx; c.y += dy; return true;
    }
    fall(c, ok) {
      c.vy = this.zeroG ? c.vy * 0.99 : Math.min(c.vy + 0.08, 1);
      if (!this.go(c, 0, c.vy, ok)) { c.vy = 0; c.y = Math.round(c.y); return false; }
      return true;
    }
    fish(c, here) {
      const water = (m) => WATERY[m];
      if (WATERY[here]) {
        c.a = 0;
        if (rnd() < 0.008) c.dir = -c.dir;
        c.vx += (c.dir * 0.22 - c.vx) * 0.1;
        c.vy = Math.max(-0.12, Math.min(0.12, c.vy * 0.92 + (rnd() - 0.5) * 0.05));
        if (!WATERY[this.cellAt(c.x + c.dir * 1.6, c.y)]) { c.dir = -c.dir; c.vx = 0; }
        if (!this.go(c, c.vx, 0, water)) c.vx = 0;
        if (!this.go(c, 0, c.vy, water)) c.vy = -c.vy;
        // Fish in roomy water slowly have little ones.
        if (c.k === M.FISH && rnd() < 0.0004 && this.count(M.FISH) < 60 && WATERY[this.cellAt(c.x - c.dir * 2, c.y)] && this.nearby(c, M.FISH, 6) < 3) {
          const b = this.spawn(M.FISH, c.x, c.y, false); if (b) b.dir = -c.dir;
        }
      } else {
        // Out of water: fall, flop, and give up after a while.
        const open = (m) => m === 0 || OPEN[m] || WATERY[m];
        if (!this.fall(c, open) && rnd() < 0.06) { c.vy = -0.5; c.dir = rnd() < 0.5 ? -1 : 1; this.go(c, c.dir * 0.6, 0, open); }
        if (++c.a > 360) c.dead = 'dry';
      }
    }
    bird(c, here) {
      // States: 0 flying, 1 perched, 3 coming down to land.
      const air = (m) => m === 0 || OPEN[m];
      if (WATERY[here]) { c.s = 0; c.vy = -0.4; this.go(c, 0, -0.5, (m) => air(m) || WATERY[m]); return; }
      if (c.s === 1) {
        if (air(this.cellAt(c.x, c.y + 1))) { c.s = 0; return; }
        if (--c.t <= 0) { c.s = 0; c.t = 300 + ri(700); c.vy = -0.45; if (rnd() < 0.5) c.dir = -c.dir; }
        else if (rnd() < 0.01) c.dir = -c.dir;
        return;
      }
      c.vx += (c.dir * 0.45 - c.vx) * 0.08;
      c.vy = Math.max(-0.35, Math.min(0.35, c.vy * 0.96 + (rnd() - 0.5) * 0.07));
      let clear = 0; while (clear < 5 && air(this.cellAt(c.x, c.y + clear + 1))) clear++;
      if (c.s === 3) {
        c.vy += 0.03; c.vx *= 0.96;
        if (clear === 0) { c.s = 1; c.t = 150 + ri(450); c.vx = c.vy = 0; c.y = Math.round(c.y); return; }
      } else {
        if (--c.t <= 0) c.s = 3; // time for a rest
        if (c.y < this.h * 0.12) c.vy += 0.03;
        if (clear < 5) c.vy -= 0.035; // keep off the ground while flying
      }
      if (!air(this.cellAt(c.x + c.dir * 2, c.y))) { if (rnd() < 0.5) c.dir = -c.dir; else c.vy = -0.35; }
      if (!this.go(c, c.vx, 0, air)) { c.dir = -c.dir; c.vx = 0; }
      if (!this.go(c, 0, c.vy, air)) c.vy = 0;
    }
    worm(c, here) {
      if (WATERY[here]) { if (++c.a > 900) c.dead = 'drown'; }
      else c.a = 0;
      const soil = (m) => SOIL[m];
      if (SOIL[here]) {
        // Slowly tunnel, mostly sideways. Worms turn sand and ash into rich dirt.
        if (rnd() < 0.002) { const i = Math.round(c.y) * this.w + Math.round(c.x); if (this.t[i] === M.SAND || this.t[i] === M.ASH) this.put(i, M.DIRT); }
        if (rnd() > 0.12) return;
        if (rnd() < 0.02) c.dir = -c.dir;
        const dy = rnd() < 0.25 ? (rnd() < 0.6 ? 1 : -1) : 0, dx = dy ? 0 : c.dir;
        if (!this.go(c, dx, dy, soil)) {
          // Peek out at the surface now and then; otherwise turn round.
          if (dy === 0 && this.cellAt(c.x + dx, c.y) === 0 && rnd() < 0.15) this.go(c, dx, 0, () => true);
          else if (dy === 0) c.dir = -c.dir;
        }
        return;
      }
      // Out in the open: drop, then crawl until there is soil to dig into.
      const open = (m) => m === 0 || OPEN[m] || WATERY[m];
      if (this.fall(c, (m) => open(m))) return;
      if (rnd() > 0.1) return;
      if (SOIL[this.cellAt(c.x, c.y + 1)] && rnd() < 0.3) { c.y += 1; return; }
      if (SOIL[this.cellAt(c.x + c.dir, c.y)]) { c.x += c.dir; return; }
      if (!this.go(c, c.dir, 0, open)) c.dir = -c.dir;
    }
    // Small flyers: a jittery drift that bounces off anything solid.
    flutter(c, here, speed) {
      if (WATERY[here]) { c.dead = 'drown'; return; }
      const air = (m) => m === 0 || OPEN[m];
      c.vx = Math.max(-speed, Math.min(speed, c.vx * 0.93 + (rnd() - 0.5) * 0.09));
      c.vy = Math.max(-speed, Math.min(speed, c.vy * 0.93 + (rnd() - 0.5) * 0.09));
      if (c.y < this.h * 0.2) c.vy += 0.01;
      if (!air(this.cellAt(c.x, c.y + 3))) c.vy -= 0.012;
      if (Math.abs(c.vx) > 0.02) c.dir = c.vx > 0 ? 1 : -1;
      if (!this.go(c, c.vx, 0, air)) c.vx = -c.vx;
      if (!this.go(c, 0, c.vy, air)) c.vy = -c.vy;
    }
    bee(c, here) {
      // Every so often look for the nearest flower and head for it.
      if (!(c.f % 40) || (c.tx == null && !(c.f % 10))) {
        c.tx = null; let bd = 1e9;
        // Bees can see a long way, mostly downwards (where flowers grow).
        const x0 = Math.max(0, Math.round(c.x) - 30), x1 = Math.min(this.w - 1, Math.round(c.x) + 30);
        const y0 = Math.max(0, Math.round(c.y) - 12), y1 = Math.min(this.h - 1, Math.round(c.y) + 50);
        for (let y = y0; y <= y1; y++) for (let x = x0, i = y * this.w + x0; x <= x1; x++, i++) {
          if (this.t[i] !== M.FLOWER) continue;
          const d = (x - c.x) ** 2 + (y - c.y) ** 2 + ri(40); if (d < bd) { bd = d; c.tx = x; c.ty = y - 1; }
        }
      }
      if (c.tx != null) {
        const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
        if (d < 1.5) {
          // Busy at a flower: hover, and now and then leave a drop of honey.
          c.vx *= 0.5; c.vy *= 0.5;
          if (c.k === M.BEE && rnd() < 0.0015) {
            for (let k = 0; k < 6; k++) { const x = Math.round(c.x) + ri(3) - 1, y = Math.round(c.y) + ri(2); if (x >= 0 && y >= 0 && x < this.w && y < this.h && this.t[y * this.w + x] === 0) { this.put(y * this.w + x, M.HONEY); break; } }
            c.tx = null; c.vy = -0.3; c.vx = (rnd() - 0.5) * 0.6;
          } else if (c.k !== M.BEE && rnd() < 0.004) { c.tx = null; c.vy = -0.3; c.vx = (rnd() - 0.5) * 0.6; } // butterflies flit on
        } else { c.vx += (dx / d) * 0.04; c.vy += (dy / d) * 0.04; }
      }
      this.flutter(c, here, 0.42);
    }
    frog(c, here, list) {
      // Snap up any bug within reach.
      this.eat(c, list, BUGS, 3);
      const open = (m) => m === 0 || OPEN[m];
      if (WATERY[here]) {
        c.s = 0;
        c.vy = Math.max(-0.2, c.vy - 0.01);
        if (!this.go(c, 0, c.vy, (m) => WATERY[m] || open(m))) c.vy = 0;
        if (!this.go(c, c.dir * 0.15, 0, (m) => WATERY[m] || open(m))) c.dir = -c.dir;
        if (open(this.cellAt(c.x, c.y - 1)) && rnd() < 0.02) { c.s = 2; c.vy = -1.0; c.vx = c.dir * 0.5; }
        return;
      }
      const footing = !open(this.cellAt(c.x, c.y + 1));
      if (c.s === 2 || !footing) {
        // In the air: arc under gravity.
        c.s = 2; c.vy = this.zeroG ? c.vy * 0.995 : Math.min(c.vy + 0.07, 1);
        if (!this.go(c, c.vx, 0, (m) => open(m) || WATERY[m])) { c.vx = -c.vx * 0.3; c.dir = -c.dir; }
        if (!this.go(c, 0, c.vy, (m) => open(m) || WATERY[m])) { if (c.vy > 0) { c.s = 0; c.vx = 0; c.y = Math.round(c.y); c.t = 50 + ri(120); } c.vy = 0; }
        return;
      }
      // Sitting: look around for bugs, then hop.
      if (!c.full && !((c.f + c.p) % 24)) {
        const bug = list.find((o) => BUGS[o.k] && !o.dead && Math.abs(o.x - c.x) < 10 && Math.abs(o.y - c.y) < 8);
        if (bug) { c.dir = bug.x > c.x ? 1 : -1; c.t = Math.min(c.t, 6); }
      }
      if (--c.t <= 0) {
        if (rnd() < 0.3) c.dir = -c.dir;
        c.s = 2; c.vy = -0.85 - rnd() * 0.35; c.vx = c.dir * (0.35 + rnd() * 0.3);
      }
    }

    // How many of kind k are within r cells of c.
    nearby(c, k, r) { let n = 0; for (const o of this.creatures) if (o !== c && o.k === k && Math.abs(o.x - c.x) < r && Math.abs(o.y - c.y) < r) n++; return n; }
    // Catch prey within reach (lizards and frogs eat bugs, penguins eat fish).
    eat(c, list, prey, reach) {
      if (c.full) { c.full--; return; } // still full from the last catch
      if (c.f & 3) return;
      for (const o of list) if (prey[o.k] && !o.dead && Math.abs(o.x - c.x) < reach && Math.abs(o.y - c.y) < reach) { o.dead = 'eaten'; c.full = 200; if (prey === BUGS) this.tally.bugs++; break; }
    }
    nibble(c) { // snails eat a bit of plant or moss right in front of them
      const x = Math.round(c.x + c.dir), y = Math.round(c.y);
      for (const yy of [y, y + 1]) { if (x < 0 || x >= this.w || yy < 0 || yy >= this.h) continue; const i = yy * this.w + x; if (this.t[i] === M.PLANT || this.t[i] === M.MOSS) { this.t[i] = 0; return; } }
    }
    /* Walkers. o: speed (cells a frame), climb (go up walls), waterWalk (walk
       about underwater without drowning), drown (frames it can stay under),
       pause (how much of the time it stands still), slide (faster on ice). */
    walk(c, here, o) {
      const pass = (m) => m === 0 || OPEN[m] || (o.waterWalk && WATERY[m]);
      if (WATERY[here] && !o.waterWalk) {
        // Struggle up to the surface; drown if stuck under too long.
        if (++c.a > (o.drown || 600)) { c.dead = 'drown'; return; }
        if (!this.go(c, 0, -0.15, (m) => WATERY[m] || pass(m))) this.go(c, c.dir * 0.1, 0, (m) => WATERY[m] || pass(m));
        c.s = 0; return;
      }
      c.a = 0;
      // Water isn't ground: walkers fall into it (and then swim, wade or struggle).
      const fallThru = (m) => pass(m) || WATERY[m];
      const below = this.cellAt(c.x, c.y + 1), wall = !fallThru(this.cellAt(c.x + c.dir, c.y));
      if (c.s === 2) { // climbing a wall
        if (!wall) { c.s = 0; } // wall ended
        else {
          c.m = (c.m || 0) + o.speed * 0.8;
          while (c.m >= 1) {
            c.m -= 1;
            if (c.y <= 1 || !pass(this.cellAt(c.x, c.y - 1))) { c.s = 0; c.dir = -c.dir; break; } // overhang or sky: let go
            c.y -= 1;
            if (pass(this.cellAt(c.x + c.dir, c.y))) { c.x += c.dir; c.s = 0; break; } // over the top
          }
          return;
        }
      }
      if (fallThru(below) && this.zeroG) { // nothing underfoot in space: float about, paddling slowly
        if (!c.zd || rnd() < 0.01) c.zd = [(rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12];
        if (!this.go(c, c.zd[0], 0, fallThru)) c.zd[0] = -c.zd[0];
        if (!this.go(c, 0, c.zd[1], fallThru)) c.zd[1] = -c.zd[1];
        if (c.zd[0]) c.dir = c.zd[0] > 0 ? 1 : -1;
        return;
      }
      if (fallThru(below)) { // nothing underfoot: fall
        c.vy = Math.min((c.vy || 0) + 0.08, 1);
        if (!this.go(c, 0, c.vy, fallThru)) { c.vy = 0; c.y = Math.round(c.y); }
        c.x = Math.round(c.x); return;
      }
      c.vy = 0; c.y = Math.round(c.y); c.x = Math.round(c.x);
      // Take breaks now and then.
      if (--c.t <= 0) {
        if (c.s === 1) { c.s = 0; c.t = 40 + ri(160); if (rnd() < 0.3) c.dir = -c.dir; }
        else if (rnd() < o.pause) { c.s = 1; c.t = 30 + ri(120); }
        else c.t = 40 + ri(160);
      }
      if (c.panic) { c.panic--; if (c.s === 1) c.s = 0; }
      if (c.s === 1) return;
      const sp = o.speed * (c.panic ? 2.5 : 1) * (o.slide && (below === M.ICE || below === M.SNOW) ? 3 : 1);
      c.m = (c.m || 0) + sp;
      while (c.m >= 1) {
        c.m -= 1;
        const ahead = this.cellAt(c.x + c.dir, c.y);
        if (fallThru(ahead)) {
          // Don't walk off a big drop (most of the time).
          const gap = o.dive ? pass : fallThru; // swimmers only count air: a pond isn't a cliff to them
          let drop = 0; while (drop < 6 && gap(this.cellAt(c.x + c.dir, c.y + drop + 1))) drop++;
          if (drop >= 6 && !o.climb && rnd() < 0.97) { c.dir = -c.dir; break; }
          if (!o.waterWalk && !o.dive && (WATERY[ahead] || WATERY[this.cellAt(c.x + c.dir, c.y + 1)]) && rnd() < 0.95) { c.dir = -c.dir; break; }
          c.x += c.dir;
          if (drop > 0) break; // stepped off a ledge: gravity takes over
        } else if (pass(this.cellAt(c.x, c.y - 1)) && pass(this.cellAt(c.x + c.dir, c.y - 1))) {
          c.x += c.dir; c.y -= 1; // step up a bump
        } else if (o.climb) { c.s = 2; break; }
        else { c.dir = -c.dir; break; }
      }
    }
    ant(c, here) {
      // Ants tunnel: pick up a grain in front, carry it, drop it somewhere else.
      if (!c.carry && c.s === 0 && rnd() < 0.02) {
        const x = Math.round(c.x + c.dir), y = Math.round(c.y);
        if (x >= 0 && x < this.w && y >= 0 && y < this.h) { const i = y * this.w + x; if (this.t[i] === M.SAND || this.t[i] === M.DIRT) { c.carry = this.t[i]; this.t[i] = 0; c.held = 150 + ri(400); } }
      } else if (c.carry && --c.held <= 0) {
        const x = Math.round(c.x - c.dir), y = Math.round(c.y) - 1;
        if (x >= 0 && x < this.w && y >= 0 && y < this.h && this.t[y * this.w + x] === 0) { this.put(y * this.w + x, c.carry); c.carry = 0; }
        else c.held = 20;
      }
      this.walk(c, here, { speed: 0.3, climb: true, drown: 300, pause: 0.25 });
    }
    penguin(c, here) {
      if (WATERY[here]) {
        // A fast swimmer that pops back out onto land now and then.
        c.s = 3;
        if (rnd() < 0.01) c.dir = -c.dir;
        c.vy = Math.max(-0.2, Math.min(0.2, (c.vy || 0) * 0.9 + (rnd() - 0.5) * 0.08));
        const sw = (m) => WATERY[m];
        if (!this.go(c, c.dir * 0.35, 0, sw)) { if (!this.go(c, c.dir, -1, (m) => m === 0 || OPEN[m]) || rnd() < 0.5) c.dir = -c.dir; }
        if (!this.go(c, 0, c.vy, sw)) c.vy = -c.vy;
        if (rnd() < 0.004 && !WATERY[this.cellAt(c.x, c.y - 1)]) { this.go(c, 0, -1, (m) => m === 0 || OPEN[m]); c.s = 0; }
        return;
      }
      if (c.s === 3) c.s = 0;
      this.walk(c, here, { speed: 0.12, slide: true, dive: true, drown: 1e9, pause: 0.4 });
    }

    /* Floats on the water like a duck: bobs up to the surface, paddles along it, dives
       now and then, and climbs out onto the bank to waddle about on land. */
    paddle(c, here, sp) {
      const sw = (m) => WATERY[m], air = (m) => m === 0 || OPEN[m];
      if (WATERY[here]) {
        c.a = 0; c.s = 3; c.lt = 0;
        if (c.dv > 0) { c.dv--; if (!this.go(c, c.dir * 0.15, 0.25, sw)) this.go(c, 0, 0.25, sw); return; } // diving
        const surface = !WATERY[this.cellAt(c.x, c.y - 1)];
        if (!surface) { if (!this.go(c, 0, -0.35, sw)) this.go(c, c.dir * 0.2, 0, sw); return; } // bob back up
        c.y = Math.round(c.y);
        if (rnd() < 0.006) c.dir = -c.dir;
        if (!this.go(c, c.dir * 0.18 * sp, 0, sw)) {
          // Reached the bank or a wall: hop out onto land if there's room, otherwise turn round.
          const x = Math.round(c.x + c.dir), y = Math.round(c.y) - 1;
          if (air(this.cellAt(x, y)) && !sw(this.cellAt(x, y + 1)) && rnd() < 0.5) { c.x = x; c.y = y; c.s = 0; }
          else c.dir = -c.dir;
        }
        if (rnd() < 0.002) c.dv = 25 + ri(40);
        return;
      }
      if (c.s === 3) c.s = 0;
      c.lt = (c.lt || 0) + 1; // after a good waddle, the next pond is too tempting
      this.walk(c, here, { speed: 0.13 * sp, drown: 1e9, pause: 0.4, dive: c.lt > 500 });
    }
    /* Swims all around the water like a turtle (slowly, never drowns) and walks on land. */
    amphibian(c, here, sp) {
      const sw = (m) => WATERY[m], air = (m) => m === 0 || OPEN[m];
      if (WATERY[here]) {
        c.a = 0; c.s = 3; c.lt = 0;
        if (!c.out && rnd() < 0.0007) c.out = true; // time for a walk: head up and find the bank
        if (rnd() < 0.008) c.dir = -c.dir;
        c.vy = c.out ? -0.12 : Math.max(-0.12, Math.min(0.12, (c.vy || 0) * 0.92 + (rnd() - 0.5) * 0.05));
        if (!this.go(c, c.dir * 0.2 * sp, 0, sw)) {
          const x = Math.round(c.x + c.dir), y = Math.round(c.y) - 1;
          if (c.out && air(this.cellAt(x, y)) && !sw(this.cellAt(x, y + 1))) { c.x = x; c.y = y; c.s = 0; c.out = false; return; } // up onto the bank
          c.dir = -c.dir; // a wall, not a bank: swim the other way
        }
        if (!this.go(c, 0, c.vy, sw)) c.vy = c.out ? 0 : -c.vy;
        return;
      }
      if (c.s === 3) c.s = 0;
      c.out = false; c.lt = (c.lt || 0) + 1;
      this.walk(c, here, { speed: 0.1 * sp, drown: 1e9, pause: 0.45, dive: c.lt > 600 });
    }

    /* ---- Abilities shared by any creature that has them ---- */
    discover(k) { if (!this.discovered[k]) { this.discovered[k] = 1; if (this.onDiscover) this.onDiscover(k); } }
    morph(c, k) { c.k = k; c.s = 0; c.t = 30 + ri(60); c.age = 0; c.vx = c.vy = 0; this.discover(k); }
    abilities(c, A, here) {
      const x = Math.round(c.x), y = Math.round(c.y), w = this.w;
      if (A.fx && x >= 0 && y >= 0 && x < w && y < this.h) for (let k = 0; k < 4; k++) this.effects(y * w + x, x, y, A.fx, c.k); // a creature's aura
      if (A.fx && A.fx.teleport && rnd() < 0.004) { // a creature that blinks about
        for (let tries = 0; tries < 8; tries++) {
          const nx = c.x + ri(31) - 15, ny = c.y + ri(21) - 10;
          if (nx > 1 && ny > 0 && nx < w - 2 && ny < this.h - 1 && this.canBe(c.k, this.cellAt(nx, ny))) {
            for (let k = 0; k < 4; k++) { const sx = Math.round(c.x) + ri(5) - 2, sy = Math.round(c.y) + ri(3) - 2; if (sx >= 0 && sy >= 0 && sx < w && sy < this.h && this.t[sy * w + sx] === 0) this.put(sy * w + sx, M.SPARKLE, 6 + ri(8)); }
            c.x = nx; c.y = ny; break;
          }
        }
      }
      // Zaps: every so often a short crackling arc of lightning jumps out of it.
      if (A.zaps) {
        if (!c.zt) c.zt = 90 + ri(150);
        if (--c.zt <= 0) {
          c.zt = 70 + ri(130);
          for (let arc = 0; arc < 2; arc++) {
          const ang = c.dir > 0 ? -0.9 + rnd() * 1.6 : Math.PI - 0.7 + rnd() * 1.6; // mostly forwards and up
          let ax = c.x, ay = c.y - 1;
          const len = 7 + ri(8);
          for (let n = 0; n < len; n++) {
            ax += Math.cos(ang) + (rnd() - 0.5) * 1.2; ay += Math.sin(ang) + (rnd() - 0.5) * 1.2;
            const bx = Math.round(ax), by = Math.round(ay);
            if (bx < 0 || by < 0 || bx >= w || by >= this.h) break;
            const j = by * w + bx, b = this.t[j], kb = KIND[b];
            if (b === 0 || kb === K.gas || kb === K.fire || kb === K.spark || kb === K.cloud) this.put(j, M.LIGHTNING);
            else { if (FLAM[b] > 0 && rnd() < 0.5) this.ignite(j); else if (CONDUCT[b]) this.charge(j, bx, by); break; }
          }
          }
          // Anything else close by gets a shock.
          this.creatures.forEach((o) => {
            if (o === c || o.dead || o.k === c.k || o.k === M.GHOST || (ABIL[o.k] && (ABIL[o.k].fireproof || ABIL[o.k].zaps))) return;
            if ((o.x - c.x) ** 2 + (o.y - c.y) ** 2 <= 16) o.dead = 'burn';
          });
        }
      }
      // Explodes: after a while it starts to fizz, then goes off.
      if (A.explodes) {
        if (!c.fuse && c.age > 500 && rnd() < 0.0015) c.fuse = 60;
        if (c.fuse > 0) {
          c.fuse--;
          if (rnd() < 0.5) { const fy = y - 2 - ri(2), fx = x + ri(3) - 1; if (fx >= 0 && fy >= 0 && fx < w && fy < this.h && this.t[fy * w + fx] === 0) this.put(fy * w + fx, M.SPARKLE); }
          if (c.fuse === 0) c.dead = 'boom';
        }
      }
      // Leaves a trail behind it.
      if (A.trail && rnd() < A.trail[1]) {
        const tx = x - c.dir * 2, ty = y; if (tx >= 0 && tx < w && ty >= 0 && ty < this.h && this.t[ty * w + tx] === 0) this.put(ty * w + tx, A.trail[0]);
      }
      // Breathes something out in front, in a short burst.
      if (A.breath) {
        if (!c.br && c.s !== 1 && rnd() < 0.004) c.br = 30;
        if (c.br > 0) {
          c.br--;
          const d = 3 + ri(9), bx = Math.round(c.x + c.dir * d), by = Math.round(c.y + 1 + d * 0.45 + ri(3) - 1);
          if (bx >= 0 && by >= 0 && bx < w && by < this.h) {
            const j = by * w + bx, b = this.t[j];
            if (b === 0 || KIND[b] === K.gas) { this.put(j, A.breath, 8 + ri(14)); this.stamp[j] = this.clock; }
            else if (FLAM[b] > 0 && rnd() < 0.3) this.ignite(j);
          }
        }
      }
      // Lays eggs when resting (birds and dragons perched, frogs in water).
      if (A.lays && rnd() < A.lays[1]) {
        const resting = c.k === M.FROG ? WATERY[here] : c.s === 1;
        const kid = A.lays[0], cap = kid === M.DRAGON ? 5 : 20;
        if (resting && this.count(kid) + this.creatures.filter((o) => o.k === M.EGG && o.into === kid).length + (kid === M.TADPOLE ? this.count(M.FROG) : 0) < cap) {
          const e = this.spawn(M.EGG, c.x - c.dir, c.y); if (e) e.into = kid;
        }
      }
      // Grows up into something else.
      if (A.grows && c.k === M.TADPOLE && c.age > A.grows[1]) { this.morph(c, A.grows[0]); this.tally.frogs++; }
    }
    // Run from scary creatures and from fire.
    flee(c, list) {
      const A = ABIL[c.k]; if (!A || ((c.f + c.p) % 8)) return;
      for (const o of list) {
        if (o.dead || !A.flee.includes(o.k)) continue;
        if (Math.abs(o.x - c.x) < 10 && Math.abs(o.y - c.y) < 8) { c.dir = o.x < c.x ? 1 : -1; c.panic = 50; return; }
      }
      for (let k = 0; k < 8; k++) {
        const dx = ri(13) - 6, dy = ri(9) - 5, m = this.cellAt(c.x + dx, c.y + dy);
        if (FIERY[m]) { c.dir = dx > 0 ? -1 : 1; c.panic = 50; return; }
      }
    }
    // Nibble food right in front or underfoot; some leave something behind.
    graze(c) {
      const A = ABIL[c.k]; if (!A || !A.graze || c.panic || rnd() > 0.02) return;
      const x = Math.round(c.x), y = Math.round(c.y), w = this.w;
      for (const [gx, gy] of [[x + c.dir, y], [x + c.dir, y + 1], [x, y + 1]]) {
        if (gx < 0 || gy < 0 || gx >= w || gy >= this.h) continue;
        const i = gy * w + gx;
        if (A.graze.includes(this.t[i])) {
          this.t[i] = 0; c.meals = (c.meals || 0) + 1; c.s = 1; c.t = 20 + ri(40);
          if (A.leaves && c.meals >= 3) {
            const bx = x - c.dir; if (bx >= 0 && bx < w && this.t[y * w + bx] === 0) { this.put(y * w + bx, A.leaves); c.meals = 0; }
          }
          return;
        }
      }
    }
    dragon(c, here) {
      // Bathing in lava is fine, but it climbs back out to fly.
      if (FIERY[here] && KIND[here] !== K.fire) { c.s = 0; this.go(c, 0, -0.5, (m) => m === 0 || OPEN[m] || FIERY[m]); return; }
      this.bird(c, here);
    }
    // Long leaps (rabbits).
    leap(c, here) {
      if (WATERY[here]) { this.walk(c, here, { speed: 0.1, drown: 400, pause: 0 }); return; }
      const open = (m) => m === 0 || OPEN[m] || WATERY[m];
      const footing = !open(this.cellAt(c.x, c.y + 1));
      if (c.s === 2 || !footing) {
        c.s = 2; c.vy = Math.min((c.vy || 0) + 0.07, 1);
        if (!this.go(c, c.vx, 0, open)) { c.vx = -c.vx * 0.3; c.dir = -c.dir; }
        if (!this.go(c, 0, c.vy, open)) { if (c.vy > 0) { c.s = 0; c.vx = 0; c.y = Math.round(c.y); c.x = Math.round(c.x); c.t = 30 + ri(140); } c.vy = 0; }
        return;
      }
      if (c.panic) { c.panic--; c.t = Math.min(c.t, 4); }
      if (--c.t <= 0) {
        if (!c.panic && rnd() < 0.3) c.dir = -c.dir;
        // Don't hop into water unless running for its life.
        if (!c.panic && WATERY[this.cellAt(c.x + c.dir * 4, c.y + 1)]) c.dir = -c.dir;
        const k = c.panic ? 1.35 : 1;
        c.s = 2; c.vy = -(0.9 + rnd() * 0.35) * k; c.vx = c.dir * (0.55 + rnd() * 0.3) * k;
      }
    }
    // Jellyfish: pulse upwards, then sink slowly.
    jelly(c, here) {
      if (!WATERY[here]) {
        const open = (m) => m === 0 || OPEN[m] || WATERY[m];
        this.fall(c, open); if (++c.a > 300) c.dead = 'dry'; return;
      }
      c.a = 0;
      if (!((c.f + c.p) % 80)) c.vy = -0.3; else c.vy = Math.min(0.08, (c.vy || 0) + 0.006);
      if (rnd() < 0.005) c.dir = -c.dir;
      const sw = (m) => WATERY[m];
      if (!this.go(c, c.dir * 0.05, 0, sw)) c.dir = -c.dir;
      if (!this.go(c, 0, c.vy, sw)) c.vy = 0;
    }
    // Ghosts drift wherever they like.
    ghost(c) {
      c.vx = Math.max(-0.15, Math.min(0.15, (c.vx || 0) * 0.98 + (rnd() - 0.5) * 0.03));
      c.vy = Math.max(-0.1, Math.min(0.1, (c.vy || 0) * 0.98 + (rnd() - 0.5) * 0.025));
      c.x += c.vx; c.y += c.vy;
      if (c.x < 3 || c.x > this.w - 4) { c.vx = -c.vx; c.x = Math.max(3, Math.min(this.w - 4, c.x)); }
      if (c.y < 6 || c.y > this.h - 3) { c.vy = -c.vy; c.y = Math.max(6, Math.min(this.h - 3, c.y)); }
      if (Math.abs(c.vx) > 0.02) c.dir = c.vx > 0 ? 1 : -1;
    }
    caterpillar(c, here) {
      const A = ABIL[c.k];
      if (c.s === 5) { // wrapped up in a cocoon
        this.fall(c, (m) => m === 0 || OPEN[m] || WATERY[m]);
        if (c.age > 1200) this.morph(c, M.BUTTERFLY);
        return;
      }
      if (c.age > A.grows[1] && !WATERY[here] && c.s !== 2) { c.s = 5; c.age = 0; return; }
      this.graze(c);
      this.walk(c, here, { speed: 0.05, climb: true, drown: 600, pause: 0.35 });
    }
    egg(c) {
      this.fall(c, (m) => m === 0 || OPEN[m] || WATERY[m]);
      if (!c.hatch) c.hatch = 1500 + ri(1200);
      if (c.age > c.hatch) {
        let k = c.into || (MATS[c.k].hatches > 0 && MATS[MATS[c.k].hatches] && MATS[MATS[c.k].hatches].creature ? MATS[c.k].hatches : 0);
        if (!k) { // a brewed egg: a surprise from the creatures you've found
          const known = []; for (let m = 0; m < COUNT; m++) if (MATS[m].creature && m !== M.EGG && MATS[m].move !== 'egg' && this.discovered[m]) known.push(m);
          k = known.length ? known[ri(known.length)] : M.BIRD;
        }
        c.dead = 'hatched';
        this.spawn(k, c.x, c.y);
      }
    }
    /* Objects: stamp a whole pixel build into the world. */
    placeStamp(id, cx, cy) {
      const o = MATS[id], rows = o.rows, w = this.w, h = this.h;
      const x0 = cx - (rows[0].length >> 1), y0 = cy - rows.length + 1;
      for (let r = 0; r < rows.length; r++) for (let q = 0; q < rows[r].length; q++) {
        const ch = rows[r][q]; if (ch === '.') continue;
        const x = x0 + q, y = y0 + r; if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x;
        if (this.t[i] === M.WALL) continue; // builds go around walls
        if (ch === '_') { this.t[i] = 0; this.life[i] = 0; this.fuel[i] = 0; continue; }
        const m = o.key2[ch]; this.t[i] = m; this.life[i] = this.defaultLife(m); this.fuel[i] = 0; this.shade[i] = ri(256);
      }
      return { w: rows[0].length, h: rows.length };
    }

    /* Invented creatures: move with one of the built-in movements, plus abilities. */
    custom(c, here, list) {
      const A = ABIL[c.k] || {};
      if (A.eatsBugs) this.eat(c, list, BUGS, 3);
      if (A.eatsFish) this.eat(c, list, FISHY, 2.5);
      if (A.flee) this.flee(c, list);
      if (A.graze) this.graze(c);
      const sp = A.speed || 1;
      switch (MOVE[c.k]) {
        case 'egg': this.egg(c); return;
        case 'paddle': this.paddle(c, here, sp); break;
        case 'amphibian': this.amphibian(c, here, sp); break;
        case 'fly': this.bird(c, here); break;
        case 'swim': this.fish(c, here); break;
        case 'hop': this.frog(c, here, list); break;
        case 'leap': this.leap(c, here); break;
        case 'flutter': this.flutter(c, here, 0.3 * sp); break;
        case 'burrow': this.worm(c, here); break;
        case 'drift': if (WATERY[here]) this.jelly(c, here); else this.flutter(c, here, 0.12); break;
        case 'climb': this.walk(c, here, { speed: 0.12 * sp, climb: true, pause: 0.3, drown: 600 }); break;
        case 'slither': this.walk(c, here, { speed: 0.22 * sp, pause: 0.15, drown: 900 }); break;
        case 'wade': this.walk(c, here, { speed: 0.14 * sp, waterWalk: true, pause: 0.35 }); break;
        default: this.walk(c, here, { speed: 0.15 * sp, pause: 0.35, drown: 600 });
      }
    }
    count(k) { let n = 0; for (const c of this.creatures) if (c.k === k) n++; return n; }

    /* ---------------- The Stickman ----------------
       The one creature you steer: this.keys = { left, right, jump } comes from the game (keyboard or the
       on-screen buttons). He walks, steps up little bumps, jumps, swims, and a long fall knocks him out;
       so do fire, lava, acid and blasts. After a moment he comes back where he was placed. */
    /* A creature goes through a portal: it comes out of a Portal Out moving the way it was going, a bit faster. */
    portalJump(c, dx, dy, speed) {
      const q = this.exitCell(dx, dy); if (q < 0) return false;
      const n = Math.hypot(dx, dy) || 1, sp = Math.min(9, speed + 0.25);
      c.x = q % this.w; c.y = (q / this.w) | 0; c.pcd = 4; c.fallFrom = c.y;
      this.sfx.portal++;
      if (c.k === M.STICKMAN) { c.vx = dx / n * sp; c.vy = dy / n * sp; c.pz = 1; c.air = true; }
      else { c.tv = [dx / n * sp, dy / n * sp]; c.tt = 0; }
      return true;
    }
    /* Flying through the air after a portal: gravity pulls it down until it lands (or swims, or flies off again). */
    tumble(c, here) {
      const v = c.tv, w = this.w, h = this.h;
      if (WATERY[here]) { c.tv = null; c.vy = 0; return; } // splash
      const flier = MOVE[c.k] === 'fly' || MOVE[c.k] === 'flutter' || MOVE[c.k] === 'drift' || c.k === M.BIRD || c.k === M.BEE || c.k === M.FIREFLY || c.k === M.BUTTERFLY || c.k === M.DRAGON;
      if (flier && ++c.tt > 25) { c.tv = null; return; } // it spreads its wings
      v[1] = Math.min(v[1] + 0.16, 9); v[0] *= 0.99;
      if (Math.abs(v[0]) > 0.01) c.dir = v[0] > 0 ? 1 : -1;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(v[0]), Math.abs(v[1]))));
      for (let k = 0; k < n; k++) {
        const nx = c.x + v[0] / n, ny = c.y + v[1] / n, m = this.cellAt(nx, ny);
        if (m === M.PORTALIN && this.portOut && this.portOut.length && this.portalJump(c, v[0], v[1], Math.hypot(v[0], v[1]))) return;
        if (!this.canBe(c.k, m)) { c.tv = null; c.vy = 0; c.y = Math.round(c.y); return; } // landed
        c.x = Math.max(1, Math.min(w - 2, nx)); c.y = Math.max(0, Math.min(h - 1, ny));
      }
    }
    player(c, here) {
      const keys = this.keys || {}, w = this.w;
      if (c.s === 9) { if (--c.ko <= 0) this.respawn(c); return; }
      const free = (m) => m === 0 || OPEN[m] || KIND[m] === K.liquid;
      const solidAt = (x, y) => !free(this.cellAt(x, y));
      const wet = KIND[here] === K.liquid;
      const ground = solidAt(c.x, c.y + 1);
      if (c.fallFrom === undefined) c.fallFrom = c.y;
      if (ground && c.vy > 0 && !(c.pcd > 0) && this.portOut && this.portOut.length && this.cellAt(c.x, c.y + 1) === M.PORTALIN && this.portalJump(c, 0, 1, c.vy)) return; // through, keeping his speed
      if (ground && !wet && c.vy >= 0) { // standing (or just landed)
        if (c.pz && c.vy > 6.5) { c.pz = 0; c.y = Math.round(c.y); c.vy = 0; c.air = false; this.knockOut(c, 'fall'); return; } // a portal-speed crash
        c.pz = 0;
        if (c.air && c.y - c.fallFrom > 22 && c.landed) { c.y = Math.round(c.y); c.air = false; this.knockOut(c, 'fall'); return; }
        c.y = Math.round(c.y); c.vy = 0; c.air = false; c.landed = true; // the first drop after you place him never hurts
      }
      if (ground || wet) c.fallFrom = c.y; else c.fallFrom = Math.min(c.fallFrom, c.y); // the highest point of a jump or fall
      const want = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (want) c.dir = want;
      c.vx += (want * (wet ? 0.3 : 0.55) - c.vx) * (ground ? 0.35 : c.pz ? 0.02 : 0.12); // out of a portal he keeps his momentum
      if (keys.jump && ground && !wet && c.vy >= 0) { c.vy = -1.55; this.tally.jumps++; }
      else if (keys.jump && wet) c.vy = Math.max(c.vy - 0.12, -0.6);
      if (wet) { c.vy = Math.min(c.vy + 0.03, 0.5) * 0.92; c.pz = 0; } else if (this.zeroG) c.vy *= 0.995; else if (!(ground && c.vy === 0)) c.vy = Math.min(c.vy + 0.12, c.pz ? 9 : 2.6);
      if (here === M.QUICKSAND) { // wading through it is slow, and he sinks unless he keeps jumping
        c.vx *= 0.25; c.vy = keys.jump && rnd() < 0.35 ? -0.6 : 0.06;
        if (this.cellAt(c.x, c.y - 6) === M.QUICKSAND) { this.knockOut(c, 'void'); return; }
      }
      // Sideways: blocked by anything as tall as him, but steps up bumps of 1 or 2 cells.
      const stepX = (dx) => {
        const nx = c.x + dx; if (nx < 1 || nx > w - 2) return false;
        const clear = (yy) => !solidAt(nx, yy) && !solidAt(nx, yy - 3) && !solidAt(nx, yy - 6);
        if (clear(c.y)) { c.x = nx; return true; }
        if (ground || wet) for (let up = 1; up <= 2; up++) if (clear(c.y - up)) { c.x = nx; c.y -= up; return true; }
        return false;
      };
      for (let left = c.vx; Math.abs(left) > 0.001;) { const d = Math.abs(left) > 1 ? Math.sign(left) : left; if (!stepX(d)) { c.vx = 0; break; } left -= d; }
      // Up and down.
      if (c.vy === 0 && solidAt(c.x, c.y + 1)) { c.air = false; return; }
      const n = Math.max(1, Math.ceil(Math.abs(c.vy))), dy = c.vy / n;
      c.air = true;
      for (let k = 0; k < n; k++) {
        const ny = c.y + dy;
        if (dy > 0 && Math.round(ny) !== Math.round(c.y) && solidAt(c.x, ny)) { // landed
          if (this.cellAt(c.x, ny) === M.PORTALIN && this.portOut && this.portOut.length && this.portalJump(c, 0, 1, c.vy)) return;
          if (c.pz && c.vy > 6.5) { c.pz = 0; c.y = Math.round(c.y); c.vy = 0; c.air = false; this.knockOut(c, 'fall'); return; }
          c.pz = 0;
          c.y = Math.round(c.y); c.vy = 0; c.air = false;
          if (!wet && c.y - c.fallFrom > 22 && c.landed) this.knockOut(c, 'fall');
          c.landed = true;
          return;
        }
        if (dy < 0 && solidAt(c.x, ny - 6)) { c.vy = 0; break; } // bumped his head
        c.y = Math.max(0, ny);
      }
    }
    knockOut(c, how) {
      if (c.s === 9) return;
      this.tally.kos++; if (how === 'fall') this.tally.falls++;
      c.s = 9; c.ko = 70; c.vx = c.vy = 0;
      if (how === 'burn' || how === 'boom') { const x = Math.round(c.x), y = Math.round(c.y) - 3; if (x >= 0 && y >= 0 && x < this.w && y < this.h && this.t[y * this.w + x] === 0) this.put(y * this.w + x, M.SMOKE); }
      if (how === 'void') c.ko = 40;
    }
    respawn(c) {
      const home = this.stickHome || { x: c.x, y: c.y }, w = this.w;
      let x = Math.max(1, Math.min(w - 2, Math.round(home.x))), y = Math.max(7, Math.min(this.h - 1, Math.round(home.y)));
      const free = (m) => m === 0 || OPEN[m];
      for (let up = 0; up < 60 && y > 7; up++, y--) if (free(this.cellAt(x, y)) && free(this.cellAt(x, y - 3)) && free(this.cellAt(x, y - 6))) break;
      while (y < this.h - 1 && free(this.cellAt(x, y + 1)) && !WATERY[this.cellAt(x, y + 1)]) y++; // stand on the ground below, so he doesn't fall again
      c.x = x; c.y = y; c.vx = c.vy = 0; c.s = 0; c.fallFrom = y; c.dead = undefined;
      this.sparkle(x, y - 3, 4);
    }
    renderCreatures(px) {
      const w = this.w, h = this.h, fr = this.frame;
      for (const c of this.creatures) {
        const S = SPRITES[c.k]; if (!S) continue;
        let frame;
        switch (c.k) {
          case M.FISH: frame = S.swim[(c.f >> (WATERY[this.cellAt(c.x, c.y)] ? 3 : 1)) & 1]; break;
          case M.BIRD: frame = c.s === 1 ? S.sit[0] : S.fly[(c.f >> 2) & 1]; break;
          case M.WORM: frame = S.crawl[(c.f >> 4) & 1]; break;
          case M.FIREFLY: frame = (fr + c.p) % 90 < 45 ? S.on[0] : S.off[0]; break;
          case M.FROG: frame = c.s === 2 ? S.jump[0] : S.sit[0]; break;
          case M.BEE: frame = S.fly[(c.f >> 1) & 1]; break;
          case M.PENGUIN: frame = c.s === 3 ? S.swim[0] : S.walk[c.s === 1 ? 0 : (c.f >> 3) & 1]; break;
          case M.DRAGON: frame = S.fly[c.s === 1 ? 1 : (c.f >> 3) & 1]; break;
          case M.RABBIT: frame = c.s === 2 ? S.jump[0] : S.sit[0]; break;
          case M.JELLYFISH: frame = S.swim[(c.f >> 4) & 1]; break;
          case M.GHOST: frame = S.fly[(c.f >> 4) & 1]; break;
          case M.TADPOLE: frame = S.swim[(c.f >> 2) & 1]; break;
          case M.CATERPILLAR: frame = c.s === 5 ? S.cocoon[0] : S.walk[c.s === 1 ? 0 : (c.f >> 4) & 1]; break;
          case M.BUTTERFLY: frame = S.fly[(c.f >> 2) & 1]; break;
          case M.EGG: frame = S.sit[0]; break;
          case M.STICKMAN: frame = c.s === 9 ? S.down[0] : c.air ? S.jump[0] : Math.abs(c.vx) > 0.05 ? S.walk[(c.f >> 2) & 1] : S.stand[0]; break;
          default: frame = S.walk[c.s === 1 ? 0 : (c.f >> (c.k === M.SNAIL ? 5 : 2)) & 1];
        }
        const cx = Math.round(c.x), cy = Math.round(c.y), rows = frame.length, cols = frame[0].length;
        const flip = c.dir < 0;
        if (c.k === M.FIREFLY && (fr + c.p) % 90 < 45) this.glow(px, cx, cy, 3);
        else if (ABIL[c.k] && ABIL[c.k].glow) this.glow(px, cx, cy - (S.ay >> 1), 4, ABIL[c.k].glow, 0.6 + 0.4 * Math.sin((fr + c.p) / 20));
        for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
          const col = frame[r][q]; if (!col) continue;
          const x = cx + (flip ? (S.ax - q) : (q - S.ax)), y = cy + r - S.ay;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = y * w + x;
          px[i] = (col >>> 24) < 255 && px[i] ? blend(px[i], col) : col;
        }
        if (c.carry) { const x = cx, y = cy - 2; if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = this.colors[c.carry * 16 + 6]; }
      }
    }
    // Remember a lit cell for the bloom pass (game.js blurs these into soft light).
    emit(i, k) {
      if (!this.emitI) { this.emitI = new Int32Array(60000); this.emitK = new Uint8Array(60000); this.emitC = new Uint32Array(60000); }
      const n = this.emitN; if (n >= 60000) return;
      this.emitI[n] = i; this.emitK[n] = k; this.emitC[n] = 0; this.emitN = n + 1;
    }
    // A soft halo, painted only over empty sky so it reads as light.
    glow(px, cx, cy, r, rgb, k) {
      if (cx >= 0 && cy >= 0 && cx < this.w && cy < this.h) { this.emit(cy * this.w + cx, Math.round(150 * (k || 1))); const [cr, cg, cb] = rgb || [216, 255, 90]; this.emitC[this.emitN - 1] = ((255 << 24) | (cb << 16) | (cg << 8) | cr) >>> 0; }
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const d = dx * dx + dy * dy; if (d > r * r + 1) continue;
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        const i = y * this.w + x; if (px[i] !== 0) continue;
        const a = Math.round(110 * (k || 1) * (1 - d / (r * r + 2)));
        const [cr, cg, cb] = rgb || [216, 255, 90];
        px[i] = ((a << 24) | (cb << 16) | (cg << 8) | cr) >>> 0;
      }
    }



    /* Bouncy grains move with real physics: each ball keeps a velocity (vx, vy)
       and a sub-cell position (fx, fy). Gravity speeds it up as it falls, so it
       flies in smooth curved arcs. Hitting the floor flips vy and keeps about 80%
       of the speed, walls flip vx, and liquids slow it down. Returns true if this
       frame was handled here (false = it's resting, let normal powder rules run). */
    bounce(i, x, y, m) {
      const w = this.w, h = this.h, t = this.t, VX = this.vx, VY = this.vy, FX = this.fx, FY = this.fy;
      const G = 0.14, MAXV = 3.5, E = 0.8;
      let vx = VX[i], vy = VY[i];
      const ground = (j, yy) => yy >= h - 1 || !this.passable(m, j + w);
      // Sitting still on the ground: nothing to do unless it can roll off.
      if (vx === 0 && vy === 0 && ground(i, y)) return false;
      vy = Math.min(MAXV, vy + G);
      let fx = FX[i] + vx, fy = FY[i] + vy, j = i, cx = x, cy = y, wet = false;
      // Walk cell by cell towards the new spot, bouncing off whatever it hits.
      for (let guard = 0; guard < 10 && (Math.abs(fx) >= 1 || Math.abs(fy) >= 1); guard++) {
        const stepY = Math.abs(fy) >= Math.abs(fx);
        if (stepY) {
          const dy = fy > 0 ? 1 : -1, ny = cy + dy, q = j + dy * w;
          if (ny < 0 || ny >= h || !this.passable(m, q)) {
            if (dy > 0) { // landed
              const up = vy * E;
              if (up < 0.75) { vy = 0; fy = 0; vx *= 0.8; if (Math.abs(vx) < 0.08) vx = 0; }
              else { vy = -up; fy = 0; vx = vx * 0.92 + (rnd() - 0.5) * 0.12; }
            } else { vy = -vy * 0.5; fy = 0; } // bumped its head
            break;
          }
          fy -= dy; wet = wet || KIND[t[q]] === K.liquid; this.swap(j, q); j = q; cy = ny;
        } else {
          const dx = fx > 0 ? 1 : -1, nx = cx + dx, q = j + dx;
          if (nx < 0 || nx >= w || !this.passable(m, q)) { vx = -vx * 0.7; fx = 0; continue; }
          fx -= dx; wet = wet || KIND[t[q]] === K.liquid; this.swap(j, q); j = q; cx = nx;
        }
      }
      if (wet) { vx *= 0.8; vy *= 0.8; }
      VX[j] = vx; VY[j] = vy; FX[j] = fx; FY[j] = fy;
      return true;
    }
    passable(m, q) {
      const b = this.t[q];
      if (b === 0) return true;
      const kb = KIND[b];
      if (kb === K.gas || kb === K.fire || kb === K.cloud || kb === K.float || kb === K.spark) return true;
      return kb === K.liquid && DENS[b] < DENS[m];
    }

    /* ---------------- Element properties ---------------- */
    // Handles evaporating, melting, freezing, setting, growing and electricity.
    // Returns true when the cell changed into something else.
    props(i, x, y, m) {
      const t = this.t, w = this.w, h = this.h, life = this.life, fuel = this.fuel;
      if (EVAP[m] && rnd() < EVAP[m][1]) { this.put(i, EVAP[m][0]); return true; }
      if (SETS[m] && rnd() < SETS[m][1]) { this.put(i, SETS[m][0]); return true; }
      if (MELTS[m] || FREEZES[m]) {
        const k = ri(8), xx = x + NX[k], yy = y + NY[k];
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) {
          const b = t[yy * w + xx];
          if (MELTS[m] && FIERY[b] && rnd() < MELTS[m][1] * 4) { this.put(i, MELTS[m][0]); return true; }
          if (FREEZES[m] && COLD[b] && rnd() < FREEZES[m][1] * 4) { this.put(i, FREEZES[m][0]); return true; }
        }
      }
      if (GROWS[m] && life[i] > 1 && rnd() < GROWS[m][1]) {
        // Grow a branch tip into the stuff around it (mostly upwards).
        const dy = rnd() < 0.65 ? -1 : 0, dx = dy ? ri(3) - 1 : (rnd() < 0.5 ? -1 : 1), xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) {
          const j = yy * w + xx;
          if (GROWS[m][0].includes(t[j])) { this.put(j, m, life[i] - 1 - ri(2)); this.stamp[j] = this.clock; if (rnd() < 0.75) life[i] = 1; }
        }
      }
      if (POWER[m] && (this.frame + i) % 50 === 0) this.charge(i, x, y);
      if (CONDUCT[m]) {
        if (fuel[i] > 0) fuel[i]--;
        if (life[i] === 0 && fuel[i] === 0) {
          // Lightning touching the wire charges it.
          if ((y > 0 && t[i - w] === M.LIGHTNING) || (y < h - 1 && t[i + w] === M.LIGHTNING) || (x > 0 && t[i - 1] === M.LIGHTNING) || (x < w - 1 && t[i + 1] === M.LIGHTNING)) life[i] = 8;
        }
        if (life[i] > 0) {
          if (life[i] === 8) this.charge(i, x, y);
          if (--life[i] === 0) fuel[i] = 10; // rest a moment so the spark only travels one way
        }
      }
      return false;
    }
    // Pass electricity to the four neighbours: wires carry it on; things that burn catch.
    charge(i, x, y) {
      const t = this.t, w = this.w, h = this.h;
      for (let k = 0; k < 4; k++) {
        const xx = x + [0, 0, -1, 1][k], yy = y + [-1, 1, 0, 0][k];
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx, b = t[j];
        if (CONDUCT[b]) { if (this.life[j] === 0 && this.fuel[j] === 0) { this.life[j] = 8; this.stamp[j] = this.clock; } }
        else if (FLAM[b] > 0 && rnd() < 0.6) this.ignite(j);
        else if ((b === M.WATER || b === M.SEAWATER) && rnd() < 0.05) this.put(j, M.STEAM);
      }
    }
    // Iron filings: drawn to the nearest magnet in range, and stick to it.
    pull(i, x, y) {
      const mg = this.magnets; let best = -1, bd = 32 * 32;
      for (let k = 0; k < mg.length; k += 2) { const d = (mg[k] - x) ** 2 + (mg[k + 1] - y) ** 2; if (d < bd) { bd = d; best = k; } }
      if (best < 0) return false;
      if (bd <= 2) return true; // touching a magnet: stay put
      // Something else already clinging next to us that's attached? Pile up on it.
      if (rnd() > 0.7) return true;
      const dx = Math.sign(mg[best] - x), dy = Math.sign(mg[best + 1] - y);
      for (const [ax, ay] of [[dx, dy], [dx, 0], [0, dy]]) {
        if (!ax && !ay) continue;
        const xx = x + ax, yy = y + ay; if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue;
        const j = yy * this.w + xx, b = this.t[j];
        if (b === 0 || KIND[b] === K.gas || KIND[b] === K.liquid) { this.swap(i, j); return true; }
        if (ATTRACT[b] || MAGNETIC[b]) return true; // part of the clump
      }
      return true;
    }
    // Loose grains and liquids touching glue stay stuck.
    stuck(i, x, y) {
      const t = this.t, w = this.w;
      if ((x > 0 && STICKY[t[i - 1]]) || (x < w - 1 && STICKY[t[i + 1]]) || (y > 0 && STICKY[t[i - w]]) || (y < this.h - 1 && STICKY[t[i + w]])) return rnd() < 0.997;
      return false;
    }
    // Glue holds on to anything solid; glue touching held glue holds on too,
    // up to a few cells away (fuel counts how far from something solid it is).
    clings(i, x, y, m) {
      const t = this.t, w = this.w, h = this.h, fuel = this.fuel;
      if ((i + this.frame) & 1 && fuel[i] > 1) return true; // re-check every other frame
      let best = 0;
      for (let k = 0; k < 4; k++) { // above, below, left, right
        const xx = x + (k === 2 ? -1 : k === 3 ? 1 : 0), yy = y + (k === 0 ? -1 : k === 1 ? 1 : 0);
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) { best = 12; break; }
        const j = yy * w + xx, b = t[j];
        if (b === m) { if (fuel[j] - 1 > best) best = fuel[j] - 1; }
        else if (b && KIND[b] !== K.gas && KIND[b] !== K.fire && KIND[b] !== K.spark && KIND[b] !== K.liquid) { best = 12; break; }
      }
      fuel[i] = best;
      return best > 0;
    }

    /* ---------------- Drawing ---------------- */
    buildColors() {
      // 16 shades per material, packed as 0xAABBGGRR for a Uint32 view.
      this.colors = new Uint32Array(COUNT * 16);
      MATS.forEach((m) => {
        const stops = m.rgb, segs = stops.length - 1;
        for (let s = 0; s < 16; s++) {
          // Walk along the colour stops (two for most materials, more for rainbows).
          const pos = (s / 15) * segs, k = Math.min(segs - 1, Math.floor(pos)), f = pos - k;
          const a = stops[k], b = stops[k + 1];
          const r = a[0] + (b[0] - a[0]) * f, g = a[1] + (b[1] - a[1]) * f, bl = a[2] + (b[2] - a[2]) * f;
          this.colors[m.id * 16 + s] = ((m.alpha & 255) << 24) | ((bl & 255) << 16) | ((g & 255) << 8) | (r & 255);
        }
      });
    }
    render(px) {
      if (!this.colors || this.colorVer !== COLORVER) { this.buildColors(); this.colorVer = COLORVER; }
      const t = this.t, sh = this.shade, life = this.life, C = this.colors, n = t.length, fr = this.frame;
      let glowN = 0; const glowList = this.glowList || (this.glowList = new Int32Array(4000));
      for (let i = 0; i < n; i++) {
        const m = t[i];
        if (m === 0) { px[i] = 0; continue; }
        if (glowN < 4000) { if (GLOWS[m]) glowList[glowN++] = i; else if (this.hasSkins && this.skin[i] && GLOWS[this.skin[i]] && LIKE[this.skin[i]] === m) glowList[glowN++] = i; }
        if (CONDUCT[m] && life[i] > 0) { px[i] = SPARK_RGB; continue; }
        let s = sh[i] >> 4, cm = m;
        if (this.hasSkins) { const sk = this.skin[i]; if (sk && LIKE[sk] === m) cm = sk; }
        if (m === M.FIRE) { s = Math.max(0, 15 - Math.min(15, life[i] >> 1)); if (this.fuel[i] === M.SULFUR) cm = M.COLDFIRE; } // sulfur burns blue
        else if (m === M.LAVA || m === M.MOLTENGOLD) s = (s + (fr >> 2)) & 15 ^ ((sh[i] & 1) ? 15 : 0);
        else if (m === M.MERCURY || m === M.GEODE) { if (((sh[i] + fr * 2) & 127) < 3) s = m === M.GEODE ? 0 : 2; }
        else if (m === M.CRYSTAL) { s = ((sh[i] >> 3) + (fr >> 2)) & 31; if (s > 15) s = 31 - s; }
        else if (m === M.LIGHTNING) s = (fr + i) & 1 ? 0 : 15;
        else if (m === M.COLDFIRE) s = Math.max(0, 15 - Math.min(15, life[i] >> 1));
        else if (m === M.RAINBOW) s = ((i % this.w) + ((i / this.w) | 0) + (fr >> 1)) & 15;
        else if (m === M.IRON) { s = (s * 2 / 3) | 0; if (((sh[i] + fr * 2) & 127) < 2) s = 15; } // steel blue with a little metallic glint
        else if (m === M.STARDUST || m === M.GOLD || m === M.FAIRY || m === M.SPARKLE || m === M.GLITTER || m === M.PEARL) { if (((sh[i] + fr * 3) & 63) < 5) s = m === M.GOLD ? 0 : (fr >> 2) & 15; }
        else if (m === M.ETERNAL) s = (s + (fr >> 1)) & 15;
        else if (m === M.VOID || m === M.MIRROR || m === M.CAULDRON) { if (((sh[i] + fr) & 127) < 3) s = m === M.CAULDRON ? 0 : 15 - s; }
        else if (m === M.DIAMOND || m === M.STAR || m === M.FROSTCRYSTAL) { s = ((sh[i] >> 3) + (fr >> 3)) & 31; if (s > 15) s = 31 - s; if (((sh[i] + fr * 2) & 63) < 3) s = 0; }
        else if (m === M.EMBER) s = ((sh[i] >> 4) + ((fr + i) >> 2)) & 15;
        else if (m === M.GHOSTFIRE) s = Math.max(0, 15 - Math.min(15, life[i] >> 2));
        else if (m === M.PLASMA || m === M.FIREWORK) s = (s + fr) & 15;
        else if (m === M.ROCKET) s = fr & 1 ? 0 : 6;
        else if (m >= M.GRAVBOMB && m <= M.WHITEHOLE) { // third wave
          const fu = this.fuel[i];
          if (m === M.THERMITE && fu) { px[i] = C[M.FIRE * 16 + ((fr + i) & 3)]; continue; }            // white-hot
          if (m === M.TNT && fu && (fr >> 2) & 1) { px[i] = C[M.FIRE * 16 + 2]; continue; }           // fuse blinking
          if (m === M.GRAVBOMB) { if (fu) { s = (fr * 2 + (sh[i] >> 5)) & 31; if (s > 15) s = 31 - s; } }
          else if (m === M.SPONGE) s = (sh[i] & 15) < 2 ? 15 : Math.min(14, (sh[i] >> 6) + life[i] * 2);  // pores, and darker when wet
          else if (m === M.VIRUS || m === M.WHITEHOLE) s = (s + (fr >> 2)) & 15;
          else if (m === M.ANTIMATTER) s = (fr + i * 7) & 15;
          else if (m === M.PORTALIN || m === M.PORTALOUT) { s = (((i / this.w) | 0) * 2 + (fr >> 1)) & 31; if (s > 15) s = 31 - s; }
          else if (m === M.BLACKHOLE) { if (((sh[i] + fr) & 31) < 2) s = 15; }
          else if (m === M.PLUTONIUM) { s = ((sh[i] >> 4) + (fr >> 3)) & 31; if (s > 15) s = 31 - s; }
        }
        else if (m === M.WALL) { const x = i % this.w, y = (i / this.w) | 0, row = (y / 3) | 0; s = (y % 3 === 2 || (x + (row & 1) * 3) % 6 === 5) ? 15 : (sh[i] >> 6); } // bricks and mortar
        px[i] = this.hasTint && this.tint[i] ? C[this.tint[i] * 16 + (this.tint[i] === M.RAINBOW ? ((i % this.w) + ((i / this.w) | 0) + (fr >> 1)) & 15 : s)] : C[cm * 16 + s];
      }
      // Light for the bloom pass, and freshly hardened lava that is still red-hot.
      this.emitN = 0;
      const heat = this.heat, fuel = this.fuel, cool = fr !== this._heatFr; this._heatFr = fr;
      for (let i = 0; i < n; i++) {
        const m = t[i];
        if (m === 0) { if (heat[i]) heat[i] = 0; continue; }
        let k = EMIT[m];
        if (m === M.FIRE || m === M.COLDFIRE) k = 70 + Math.min(185, life[i] * 7);  // bright when new, fading as it burns out
        else if (m === M.GHOSTFIRE) k = 45 + Math.min(120, life[i] * 3);
        else if (CONDUCT[m] && life[i] > 0) k = 200;                                 // electricity in a wire
        else if (m === M.THERMITE && fuel[i]) k = 255;
        else if (m === M.TNT && fuel[i]) k = 110;
        else if (!k && (GLOWS[m] || (this.hasSkins && this.skin[i] && GLOWS[this.skin[i]]))) k = 120;
        const hv = heat[i];
        if (hv) {
          if (!COOLS[m]) heat[i] = 0;
          else {
            const f = hv / 255, wgt = Math.min(1, f * 2.2), c = px[i];
            const hr = 255, hg = 22 + 190 * f * f, hb = 4 + 50 * f * f * f;     // yellow-white when fresh, deep red as it cools
            const r = (c & 255) + (hr - (c & 255)) * wgt, g = ((c >> 8) & 255) + (hg - ((c >> 8) & 255)) * wgt, b = ((c >> 16) & 255) + (hb - ((c >> 16) & 255)) * wgt;
            px[i] = ((255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
            const hk = (hv * 0.85) | 0; if (hk > k) k = hk;
            if (cool && ((fr + i) % 3) === 0) heat[i] = hv - 1;                    // about 13 seconds to cool
          }
        }
        if (k) { this.emit(i, k); if (m === M.LAVA && !(this.hasSkins && this.skin[i])) this.emitC[this.emitN - 1] = LAVA_GLOW; }
      }
      // Glowing elements light up the empty space around them.
      for (let k = 0; k < glowN; k++) {
        const i = glowList[k], gx = i % this.w, gy = (i / this.w) | 0, [cr, cg, cb] = GLOWS[t[i]] || GLOWS[this.skin[i]];
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const d = dx * dx + dy * dy; if (!d || d > 5) continue;
          const x = gx + dx, y = gy + dy; if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
          const j = y * this.w + x; const a = d <= 2 ? 70 : 34;
          if (px[j] === 0 || (px[j] >>> 24) < a && t[j] === 0) px[j] = ((a << 24) | (cb << 16) | (cg << 8) | cr) >>> 0;
        }
      }
      // The blast of air: a faint shimmer where the pressure is high.
      if (this.airOn) {
        const A = this.A, aw = this.aw, ww = this.w, hh = this.h;
        for (let ay = 0; ay < this.ah; ay++) for (let ax = 0; ax < aw; ax++) {
          const pr = this.ap[ay * aw + ax]; if (pr < 0.35) continue;
          const a = Math.min(45, Math.round(pr * 12)), col = ((a << 24) | (255 << 16) | (240 << 8) | 225) >>> 0;
          for (let y = ay * A; y < Math.min(hh, ay * A + A); y++) for (let x = ax * A; x < Math.min(ww, ax * A + A); x++) { const i = y * ww + x; if (t[i] === 0) px[i] = col; }
        }
      }
      // Grains flying through the air after an explosion.
      for (const p of this.flying) {
        const x = Math.round(p.x), y = Math.round(p.y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        const cm = p.sk && LIKE[p.sk] === p.m ? p.sk : p.m, col = C[cm * 16 + (p.s >> 4)];
        px[y * this.w + x] = col;
        if (EMIT[p.m] || p.m === M.FIRE) this.emit(y * this.w + x, EMIT[p.m] || 200); // flying embers and lava blobs glow too
        const sp = Math.abs(p.vx) + Math.abs(p.vy);
        if (sp > 3.5) { // going fast: a little streak behind it
          const n = Math.min(4, Math.floor(sp / 2)), ux = p.vx / sp, uy = p.vy / sp;
          for (let k = 1; k <= n; k++) { const tx = Math.round(p.x - ux * k * 1.5), ty = Math.round(p.y - uy * k * 1.5); if (tx >= 0 && ty >= 0 && tx < this.w && ty < this.h && this.t[ty * this.w + tx] === 0) px[ty * this.w + tx] = ((Math.max(40, 200 - k * 45) << 24) | (col & 0xffffff)) >>> 0; }
        }
      }
      // Darkness: a shadowy patch around anything with the darkness effect.
      if (this.darkAt && this.frame - this.darkAt < 6) {
        const W = this.w, H = this.h; let n = 0;
        for (let i = 0; i < t.length && n < 2500; i++) {
          const m = t[i]; if (!m) continue;
          const cm = this.hasSkins && this.skin[i] && LIKE[this.skin[i]] === m ? this.skin[i] : m;
          if (!FX[cm] || !FX[cm].darkness) continue;
          n++;
          const gx = i % W, gy = (i / W) | 0;
          for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
            const d = dx * dx + dy * dy; if (d > 16) continue;
            const x = gx + dx, y = gy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
            const j = y * W + x, a = d <= 4 ? 150 : d <= 9 ? 110 : 70;
            if (t[j] === 0) { if ((px[j] >>> 24) < a) px[j] = (a << 24) >>> 0; }
            else if (FX[t[j]] === undefined || t[j] !== m) { const c = px[j]; px[j] = ((c & 0xff000000) | (((c >> 17) & 0x7f) << 16) | (((c >> 9) & 0x7f) << 8) | ((c >> 1) & 0x7f)) >>> 0; }
          }
        }
      }
      if (this.creatures.length) this.renderCreatures(px);
    }

    /* ---------------- Saving / resizing ---------------- */
    /* What a cell really is, counting inventions that act like something else. */
    matAt(i) { const m = this.t[i]; if (this.hasSkins) { const sk = this.skin[i]; if (sk && LIKE[sk] === m) return sk; } return m; }
    /* The grid with inventions written back in (for saving and undo); step() turns them back into skins. */
    exportT() {
      const out = this.t.slice(); if (this.hasSkins) for (let i = 0; i < out.length; i++) out[i] = this.matAt(i);
      // Grains still in the air are saved where they are (they keep flying in the game itself).
      for (const p of this.flying) { const x = Math.round(p.x), y = Math.round(p.y), i = y * this.w + x; if (x >= 0 && y >= 0 && x < this.w && y < this.h && !out[i]) out[i] = p.sk || p.m; }
      return out;
    }
    /* A lightning strike at column x that looks like invention 'skin' (0 for plain lightning). */
    strike(x, skin) { this.curBase = M.LIGHTNING; this.curSkin = skin || 0; this.bolt(x, -1); this.curBase = this.curSkin = 0; }
    copyFrom(other) {
      const w = Math.min(this.w, other.w), h = Math.min(this.h, other.h);
      const ox = 0, oyThis = this.h - h, oyOther = other.h - h; // keep the ground lined up
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const a = (y + oyThis) * this.w + x + ox, b = (y + oyOther) * other.w + x;
        this.t[a] = other.matAt(b); this.life[a] = other.life[b]; this.fuel[a] = other.fuel[b];
        if (other.hasTint && other.tint[b]) { this.tint[a] = other.tint[b]; this.hasTint = true; }
      }
      this.discovered.set(other.discovered);
      this.zeroG = !!other.zeroG; this.dayT = other.dayT || 0.1;
      const dy = oyThis - oyOther;
      if (other.stickHome) this.stickHome = { x: other.stickHome.x, y: other.stickHome.y + dy };
      this.creatures = [];
      (other.creatures || []).forEach((c) => {
        const y = c.y + dy;
        if (c.x >= 0 && c.x < this.w && y >= 0 && y < this.h) this.creatures.push(Object.assign({}, c, { y }));
      });
    }
  }

  window.SandSim = { LIKE, World, rnd, ri, KIND, K, MAX_CREATURES, refresh, TB, ROOM };
})();
