/* ==========================================================================
   SAND ALCHEMY — game
   Screen layout, drawing with finger or mouse, the material toolbar,
   discovery toasts, the discovery book and saving.
   ========================================================================== */
(function () {
  'use strict';
  const { M, MATS, COUNT } = window.SandMats;
  const { World, rnd, ri, KIND, K } = window.SandSim;
  /* The game is three script files that must come from the same update. If one is left over from an older
     update (easy to miss when uploading), say which one instead of quietly breaking. */
  const FILES = 63;
  const oldFiles = [window.SandMats.FILES !== FILES && 'js/materials.js', window.SandSim.FILES !== FILES && 'js/sim.js'].filter(Boolean);
  if (oldFiles.length) addEventListener('load', () => {
    const d = document.createElement('div');
    d.setAttribute('style', 'position:fixed;left:12px;right:12px;top:12px;z-index:99;padding:14px 16px;border-radius:14px;background:#5a1d2a;color:#fff;font:600 15px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)');
    d.textContent = 'Some game files are from an older update: ' + oldFiles.join(' and ') + '. Upload the new ' + (oldFiles.length > 1 ? 'ones' : 'one') + ' too, or some things (like brewing) won\u2019t work.';
    d.addEventListener('click', () => d.remove()); document.body.append(d);
  });
  const $ = (s) => document.querySelector(s);

  const SAVE_KEY = 'sandalchemy.save.v1';
  const ERASE = 65535, DROPPER = 65534, BLENDER = 65533; // tools (older saves used 255 and 254, before ids went past 255)
  const BLENDER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c0-3 2-5 5-5M12 12c3 0 5 2 5 5M12 12c0 3-2 5-5 5M12 12c-3 0-5-2-5-5" /><circle cx="12" cy="12" r="9.5" /></svg>';
  const blendR = () => Math.round(BRUSHES[brush].r * 1.25) + 3; // the blender reaches a bit further than the brush
  const DROPPER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4.5l5 5M17 7l2.2-2.2a1.8 1.8 0 0 0-2.5-2.5L14.5 4.5M16 8.5l-8.6 8.6L4 20l2.9-3.4L15.5 8" /></svg>';
  const BRUSHES = [{ r: 1, label: 'S', dot: 6 }, { r: 3, label: 'M', dot: 11 }, { r: 6, label: 'L', dot: 17 }, { r: 10, label: 'XL', dot: 24 }];
  const ORDER = [M.SAND, M.WATER, M.FIRE, M.STONE, M.STEAM, M.SMOKE, M.GLASS, M.LAVA, M.OBSIDIAN, M.SALT, M.CLOUD,
    M.SNOW, M.ICE, M.LIGHTNING, M.MUD, M.PLANT, M.WOOD, M.ASH, M.DIRT, M.OIL, M.GUNPOWDER, M.ACID, M.METAL, M.RUST, M.CRYSTAL,
    M.CAULDRON, M.ESSENCE, M.RAINBOW, M.STARDUST, M.GOLD, M.PHILO, M.COLDFIRE, M.SLIME, M.SKYSAND, M.MIRROR, M.VOID,
    M.FLOWER, M.SPIRIT, M.FAIRY, M.ETERNAL, M.BUBBLE, M.SEED,
    M.CLAY, M.BRICK, M.COAL, M.DIAMOND, M.SANDSTONE, M.MOSS, M.MUSHROOM, M.VINE, M.CACTUS, M.HONEY,
    M.SEAWATER, M.SWAMP, M.FOG, M.EMBER, M.CHARCOAL, M.FIREWORK, M.STORM, M.MOONDUST, M.STAR,
    M.POTION, M.GHOSTFIRE, M.FROSTCRYSTAL, M.CRYSTALSEED, M.FROSTBOMB, M.PLASMA,
    M.FISH, M.BIRD, M.WORM, M.FIREFLY, M.FROG, M.BEE, M.ANT, M.SNAIL, M.LIZARD, M.PENGUIN, M.CRAB,
    M.DRAGON, M.COW, M.SNAKE, M.RABBIT, M.JELLYFISH, M.GHOST, M.TADPOLE, M.CATERPILLAR, M.BUTTERFLY, M.EGG,
    M.GLOWSTONE, M.GLUE, M.BOUNCY, M.IRON, M.MAGNET, M.COPPER, M.BATTERY, M.DRYICE, M.NITRO, M.CHOCOLATE, M.MELTCHOC, M.CORAL,
    M.SUGAR, M.CARAMEL, M.CANDY, M.COTTONCANDY, M.WAX, M.MELTWAX, M.PAPER, M.TAR, M.SOAP, M.STEEL, M.GLITTER, M.NEON, M.PEARL,
    M.OWL, M.BAT, M.TURTLE, M.MOUSE, M.OCTOPUS, M.PHOENIX, M.UNICORN, M.DUCK, M.WALL, M.WEB,
    M.HYDROGEN, M.OXYGEN, M.LN2, M.SPONGE, M.VIRUS, M.CURE, M.TNT, M.C4, M.THERMITE, M.PLUTONIUM, M.ANTIMATTER,
    M.VACUUM, M.PORTALIN, M.PORTALOUT, M.BLACKHOLE, M.WHITEHOLE, M.GRAVBOMB, M.STICKMAN,
    M.QUICKSAND, M.PUMICE, M.SULFUR, M.MERCURY, M.FERROFLUID, M.MOLTENGOLD, M.RESIN, M.AMBER, M.AEROGEL, M.EXPLJELLY,
    M.METEORITE, M.GEODE, M.FIREFLOWER, M.FROSTFERN, M.ELECMUSH, M.GLOWMOSS, M.LIQLIGHT, M.INK, M.NEBULA, M.HEATCRYSTAL];
  const brewed = (m) => MATS[m].magic || MATS[m].crafted || MATS[m].creature || MATS[m].object || MATS[m].invented || MATS[m].science || MATS[m].space;
  const isCreature = (m) => m > 0 && m < COUNT && !!MATS[m].creature;
  const isObject = (m) => m > 0 && m < COUNT && !!MATS[m].object;
  const baseOf = (m) => (m > 0 && m < COUNT && MATS[m].like) || m; // inventions that act like a built-in element
  // Everything is shown in three labelled groups, A to Z inside each group.
  const byName = (a, b) => MATS[a].name.localeCompare(MATS[b].name);
  const GROUPS = [
    { label: 'Basics', items: ORDER.filter((m) => MATS[m].start && !MATS[m].wall).sort(byName) },
    { label: 'Wall', items: ORDER.filter((m) => MATS[m].wall).sort(byName) },
    { label: 'Elements', items: ORDER.filter((m) => !MATS[m].start && !brewed(m) && m !== M.CAULDRON).sort(byName) },
    { label: 'Crafted', items: ORDER.filter((m) => MATS[m].crafted).sort(byName) },
    { label: 'Magic', items: ORDER.filter((m) => MATS[m].magic).sort(byName) },
    { label: 'Science', items: ORDER.filter((m) => MATS[m].science).sort(byName) },
    { label: 'Space', items: ORDER.filter((m) => MATS[m].space).sort(byName) },
    { label: 'Creatures', items: ORDER.filter((m) => MATS[m].creature).sort(byName) },
  ];
  /* Big numbers in short form: 1.23K, 45.6M, 7B ... up to Uvg (10^66). */
  const NUM_UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Ocd', 'Nod', 'Vg', 'Uvg'];
  function shortNum(n) {
    n = Number(n) || 0;
    const neg = n < 0; n = Math.abs(n);
    if (Math.round(n) < 1000) return (neg ? '-' : '') + Math.round(n);
    let u = Math.floor(Math.log10(n) / 3);
    let v = n / 10 ** (u * 3);
    let txt = v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0);
    if (Number(txt) >= 1000) { u++; v = n / 10 ** (u * 3); txt = v.toFixed(2); } // 999.96K shows as 1.00M
    if (u >= NUM_UNITS.length) return (neg ? '-' : '') + n.toExponential(2);
    return (neg ? '-' : '') + txt.replace(/\.0+$|(\.\d*?)0+$/, '$1') + NUM_UNITS[u];
  }
  function groupLabel(text, cls) { const el = document.createElement(cls === 'grp' ? 'span' : 'h3'); el.className = cls; el.textContent = text; return el; }

  const canvas = $('#world'), ctx = canvas.getContext('2d');
  const stage = $('#stage');
  let world = null, image = null, px = null, cell = 3;
  let tool = M.SAND, brush = 1, paused = false;
  let unseen = new Set();   // discovered but not yet tapped in the toolbar
  let hinted = new Set();   // ??? cards whose hint has been shown
  let revealed = new Set(); // ??? cards you gave up on: they show the name and how to make it (still to be found)
  /* Favorites: things you pinned for easy access. They show first in the toolbar and in Search.
     Long-press (or right-click) a toolbar button, or tap the star on its card in the book. */
  const FAV_KEY = 'sandalchemy.favs.v1';
  let favs = [];
  try { const f = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); if (Array.isArray(f)) favs = f.filter((m) => m > 0 && m < COUNT); } catch (e) { /* ignore */ }
  const isFav = (m) => favs.includes(m);
  const favItems = () => favs.filter((m) => MATS[m] && !MATS[m].reserved && !MATS[m].hidden && world && world.discovered[m]);
  let favAt = 0, favLast = 0;
  function toggleFav(m) {
    if (!(m > 0 && m < COUNT)) return;
    if (m === favLast && performance.now() - favAt < 900) return; // one long-press is one toggle, even if the phone also sends a right-click
    favAt = performance.now(); favLast = m;
    if (isFav(m)) { favs = favs.filter((x) => x !== m); note('Removed ' + MATS[m].name + ' from Favorites'); }
    else { favs.push(m); note('\u2605 ' + MATS[m].name + ' added to Favorites'); }
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch (e) { /* ignore */ }
    renderPalette(); writeSaveSoon();
  }

  /* Recently used: the last few things you painted with, newest first, at the front of the toolbar. */
  const RECENT_KEY = 'sandalchemy.recent.v1', RECENT_MAX = 10;
  let recent = [];
  try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); if (Array.isArray(r)) recent = r.filter((m) => m > 0 && m < COUNT).slice(0, RECENT_MAX); } catch (e) { /* ignore */ }
  const recentItems = () => recent.filter((m) => MATS[m] && !MATS[m].reserved && !MATS[m].hidden && world && world.discovered[m]);
  function useRecent(m) {
    if (!(m > 0 && m < COUNT) || !MATS[m] || m === M.CAULDRON) return;
    if (recent[0] === m) return;
    recent = [m].concat(recent.filter((x) => x !== m)).slice(0, RECENT_MAX);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (e) { /* ignore */ }
    drawRecent(); writeSaveSoon();
  }
  // Only the Recent part of the toolbar is redrawn (the whole toolbar can hold thousands of buttons).
  function drawRecent() {
    const box = document.querySelector('#palette .recent-box'); if (!box) return;
    box.innerHTML = '';
    const items = recentItems(); if (!items.length) return;
    box.append(groupLabel('\u{1F552} Recent', 'grp recent'));
    items.forEach((m) => box.append(matButton(m, MATS[m].name)));
  }

  /* ---------------- Saving ---------------- */
  function loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
  }
  let restoring = false; // set while a restored backup is waiting for the reload
  function buildSave() {
    const disc = []; for (let m = 1; m < COUNT; m++) if (world.discovered[m]) disc.push(m);
    // The world is stored as compact strings: material, age and memory
    // (age keeps fires and growing trees going; memory is what a mirror copies).
    // Version 2 stores material, memory and paint as two bytes per cell (ids go past 255).
    return { v: 2, disc, unseen: [...unseen], hinted: [...hinted], revealed: [...revealed], favs, recent, tool, brush, inv: inventions, stats: ST,
      world: { w: world.w, h: world.h, zg: world.zeroG ? 1 : undefined, dt: world.dayT ? +world.dayT.toFixed(4) : undefined, t: pack16(world.exportT()), l: pack(world.life), f: pack16(world.fuel), p: world.hasTint ? pack16(world.tint) : undefined,
        c: world.creatures.map((c) => [c.k, Math.round(c.x), Math.round(c.y), c.dir, c.into || 0, c.s === 5 ? 5 : 0, Math.min(c.age || 0, 99999)]) } };
  }
  function writeSave() {
    if (!world || restoring) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(buildSave())); } catch (e) { /* storage full or blocked: the game still plays */ }
  }
  function pack(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 4096) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096));
    return btoa(s);
  }
  function unpack(str, into, max) {
    const bin = atob(str);
    for (let i = 0; i < bin.length && i < into.length; i++) { const v = bin.charCodeAt(i); into[i] = v < max ? v : 0; }
  }
  // Two bytes per cell (low byte first).
  function pack16(arr) { const b = new Uint8Array(arr.length * 2); for (let i = 0; i < arr.length; i++) { b[2 * i] = arr[i] & 255; b[2 * i + 1] = arr[i] >> 8; } return pack(b); }
  function unpack16(str, into, max) {
    const bin = atob(str);
    for (let i = 0, k = 0; k + 1 < bin.length && i < into.length; i++, k += 2) { const v = bin.charCodeAt(k) | (bin.charCodeAt(k + 1) << 8); into[i] = v < max ? v : 0; }
  }
  function restoreWorld(saved) {
    if (!saved || !saved.world) return null;
    try {
      const sw = saved.world, w = sw.w | 0, h = sw.h | 0;
      if (w < 1 || h < 1 || w * h > 4e6) return null;
      const old = new World(w, h), wide = saved.v >= 2, un = wide ? unpack16 : unpack;
      old.zeroG = !!sw.zg; old.dayT = +sw.dt || 0.1;
      un(sw.t, old.t, COUNT);
      for (let i = 0; i < old.t.length; i++) if (MATS[old.t[i]].reserved) old.t[i] = 0; // an invention that's gone
      try { if (sw.l) { unpack(sw.l, old.life, 256); old.hadLife = true; } if (sw.f) un(sw.f, old.fuel, 65536); if (sw.p) { un(sw.p, old.tint, COUNT); for (let i = 0; i < old.tint.length; i++) if (old.tint[i] && MATS[old.tint[i]].reserved) old.tint[i] = 0; old.hasTint = true; } } catch (e) { /* older saves: ages start fresh */ }
      if (Array.isArray(sw.c)) sw.c.slice(0, window.SandSim.MAX_CREATURES).forEach((a) => {
        if (!Array.isArray(a) || !isCreature(a[0])) return;
        const c = old.spawn(a[0], +a[1] || 0, +a[2] || 0, false); if (!c) return;
        if (a[3] === 1 || a[3] === -1) c.dir = a[3];
        if (isCreature(a[4])) c.into = a[4];
        if (a[5] === 5) c.s = 5;
        if (a[6] > 0) c.age = Math.min(+a[6] || 0, 99999);
      });
      return old;
    } catch (e) { return null; }
  }

  /* ---------------- World sizing ---------------- */
  function resize() {
    const r = stage.getBoundingClientRect();
    cell = r.width < 700 ? 3 : Math.max(3, Math.round(r.width / 320));
    const w = Math.max(40, Math.floor(r.width / cell)), h = Math.max(40, Math.floor(r.height / cell));
    if (world && world.w === w && world.h === h) { layoutView(); drawStars(); return; }
    const next = new World(w, h);
    if (world) next.copyFrom(world);
    else {
      const saved = loadSave(), old = restoreWorld(saved);
      if (old) next.copyFrom(old);
      // Older saves kept no ages: give restored fire and steam fresh lifetimes so they don't live forever.
      if (old && !old.hadLife) for (let i = 0; i < next.t.length; i++) if (next.t[i] && !next.life[i]) next.life[i] = next.defaultLife(next.t[i]);
      ORDER.forEach((m) => { if (MATS[m].start) next.discovered[m] = 1; });
      next.discovered[M.CAULDRON] = 1; // no need to find it any more: the Brew pot is always there
      if (saved && saved.disc) saved.disc.forEach((m) => { if (m > 0 && m < COUNT) next.discovered[m] = 1; });
      // Every invention you made counts as found (one could slip through if you changed picks while the AI was thinking).
      inventions.forEach((r) => { if (r && MATS[r.id] && !MATS[r.id].reserved) next.discovered[r.id] = 1; });
      if (saved) {
        unseen = new Set(saved.unseen || []); hinted = new Set(saved.hinted || []); revealed = new Set(saved.revealed || []);
        if (saved.stats && typeof saved.stats === 'object') { let had = null; try { had = localStorage.getItem(STATS_KEY); } catch (e) { /* fine */ } if (!had) { Object.assign(ST, saved.stats); saveStats(); } } // stats from a restored backup
        if (Array.isArray(saved.recent) && !recent.length) recent = saved.recent.filter((m) => m > 0 && m < COUNT).slice(0, RECENT_MAX);
        if (Array.isArray(saved.favs) && !favs.length) { favs = saved.favs.filter((m) => m > 0 && m < COUNT); try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch (e) { /* ignore */ } }
        if (!(saved.v >= 2)) { if (saved.tool === 255) saved.tool = ERASE; else if (saved.tool === 254) saved.tool = DROPPER; } // older saves
        if (saved.tool === ERASE || saved.tool === DROPPER || saved.tool === BLENDER || (saved.tool && saved.tool !== M.CAULDRON && next.discovered[saved.tool])) tool = saved.tool;
        if (saved.brush != null && BRUSHES[saved.brush]) brush = saved.brush;
        if (old) $('#tip').classList.add('gone');
      }
    }
    next.onDiscover = discovered;
    world = next;
    setZeroG(world.zeroG, true);
    canvas.width = w; canvas.height = h;
    image = ctx.createImageData(w, h);
    px = new Uint32Array(image.data.buffer);
    sizeGlow(w, h); sizeHeat(); layoutView(); drawStars(); skyShown = ''; updateSky();
    renderPalette(); renderCount();
  }

  /* ---------------- Toolbar ---------------- */
  // Creatures get a little picture of themselves on a soft round background.
  const ICONS = {};
  function creatureIcon(m) {
    if (ICONS[m]) return ICONS[m];
    const mat = MATS[m], st = Object.keys(mat.sprite)[0], fr = mat.sprite[st][0];
    const rows = fr.length, cols = fr[0].length, size = Math.max(rows, cols) + 1, cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d'), ox = Math.floor((size - cols) / 2), oy = Math.floor((size - rows) / 2);
    fr.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = mat.pal[ch]; g.fillRect(ox + x, oy + y, 1, 1); } }));
    return (ICONS[m] = cv.toDataURL());
  }
  function objectIcon(m) {
    if (ICONS[m]) return ICONS[m];
    const o = MATS[m], rows = o.rows, size = Math.max(rows.length, rows[0].length) + 2, cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d'), ox = Math.floor((size - rows[0].length) / 2), oy = Math.floor((size - rows.length) / 2);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { const mm = o.key2[ch]; if (mm) { g.fillStyle = MATS[mm].colors[0]; g.fillRect(ox + x, oy + y, 1, 1); } }));
    return (ICONS[m] = cv.toDataURL());
  }
  function swatchStyle(m) {
    const [a, b] = MATS[m].colors;
    if (isObject(m)) return `background: url(${objectIcon(m)}) center / 92% no-repeat, radial-gradient(circle at 35% 30%, #3a3f78, #1c1f45 75%); image-rendering: pixelated`;
    if (isCreature(m)) return `background: url(${creatureIcon(m)}) center / 86% no-repeat, radial-gradient(circle at 35% 30%, #3a3f78, #1c1f45 75%); image-rendering: pixelated`;
    const like = MATS[m].like; // inventions that act like something get that thing's icon shape in their own colours
    if (like === M.LIGHTNING) return `background: linear-gradient(135deg, #2b2e5c 0 40%, ${a} 40% 55%, ${b} 55% 60%, #2b2e5c 60%)`;
    if (like === M.FIRE || like === M.COLDFIRE || like === M.GHOSTFIRE) return `background: radial-gradient(circle at 50% 70%, #fff6d0 0 22%, ${a} 50%, ${b} 80%)`;
    if (m === M.FIRE) return 'background: radial-gradient(circle at 50% 70%, #fff1a0 0 25%, #ff9a2e 50%, #e8401c 80%)';
    if (m === M.LIGHTNING) return 'background: linear-gradient(135deg, #2b2e5c 0 40%, #fffbe0 40% 55%, #cdb8ff 55% 60%, #2b2e5c 60%)';
    if (m === M.CRYSTAL) return 'background: conic-gradient(#e07bff, #6fe6ff, #e07bff, #6fe6ff, #e07bff)';
    if (m === M.COLDFIRE) return 'background: radial-gradient(circle at 50% 70%, #e6fbff 0 25%, #6fc3ff 50%, #2f6bff 80%)';
    if (m === M.CAULDRON) return 'background: radial-gradient(circle at 50% 30%, #b98cff 0 22%, #3a3355 26%, #231f36 75%)';
    if (m === M.IRON) return 'background: radial-gradient(circle at 35% 30%, #9ab8e6 0 12%, #4a6488 40%, #25324a 80%)';
    if (m === M.VOID) return 'background: radial-gradient(circle, #000 0 45%, #2a0f4a 70%, #6b3fb0 100%)';
    if (MATS[m].ramp) return `background: conic-gradient(${MATS[m].ramp.join(', ')}, ${MATS[m].ramp[0]})`;
    return `background: radial-gradient(circle at 35% 30%, ${a}, ${b} 75%)`;
  }
  function renderPalette() {
    const pal = $('#palette');
    pal.innerHTML = '';
    $('#btn-pot').hidden = false; // the Cauldron is always there
    pal.append(matButton(ERASE, 'Eraser'));
    pal.append(matButton(DROPPER, 'Dropper'));
    pal.append(matButton(BLENDER, 'Blender'));
    const rb = document.createElement('div'); rb.className = 'recent-box'; pal.append(rb); drawRecent();
    const fv = favItems();
    if (fv.length) { pal.append(groupLabel('\u2605 Favorites', 'grp fav')); fv.forEach((m) => pal.append(matButton(m, MATS[m].name))); }
    GROUPS.forEach((grp) => {
      const items = grp.items.filter((m) => world.discovered[m]);
      if (!items.length) return;
      pal.append(groupLabel(grp.label, 'grp'));
      items.forEach((m) => pal.append(matButton(m, MATS[m].name)));
    });
    syncBrush();
  }
  function matButton(m, name) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mat' + (m === tool ? ' on' : '') + (unseen.has(m) ? ' new' : '');
    b.dataset.m = m; b.setAttribute('aria-label', name); b.setAttribute('aria-pressed', m === tool);
    if (m === ERASE) b.title = 'Eraser (C)'; else if (m === DROPPER) b.title = 'Dropper (E)'; else if (m === BLENDER) b.title = 'Blender (X)';
    const sw = document.createElement('i'); sw.className = 'sw' + (m === ERASE ? ' erase' : m === DROPPER ? ' dropper' : m === BLENDER ? ' dropper blender' : '');
    if (m === DROPPER) sw.innerHTML = DROPPER_ICON; else if (m === BLENDER) sw.innerHTML = BLENDER_ICON;
    else if (m !== ERASE) sw.setAttribute('style', swatchStyle(m));
    const label = document.createElement('span'); label.textContent = name;
    b.append(sw, label);
    if (m !== ERASE && m !== DROPPER && m !== BLENDER) {
      if (isFav(m)) b.classList.add('is-fav');
      // Long-press (phone) or right-click (computer) to add it to, or take it out of, Favorites.
      let timer = 0, sx = 0, sy = 0, held = false, touch = false;
      b.addEventListener('pointerdown', (e) => { held = false; touch = e.pointerType !== 'mouse'; sx = e.clientX; sy = e.clientY; clearTimeout(timer); timer = setTimeout(() => { held = true; toggleFav(m); }, 480); });
      b.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clearTimeout(timer); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, () => clearTimeout(timer)));
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (touch) return; clearTimeout(timer); toggleFav(m); }); // phones: the long-press timer does it
      b.addEventListener('click', (e) => { if (held) { held = false; e.preventDefault(); return; } pick(m); });
    } else b.addEventListener('click', () => pick(m));
    return b;
  }
  function pick(m) {
    tool = m;
    if (unseen.delete(m)) writeSaveSoon();
    document.querySelectorAll('.mat').forEach((b) => {
      const on = Number(b.dataset.m) === m;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
      if (on) b.classList.remove('new');
    });
    showCurrent();
  }
  /* The little badge in the corner of the world: what you're painting with. */
  function showCurrent() {
    const sw = $('#current-sw');
    sw.innerHTML = '';
    if (tool === ERASE) { sw.className = 'sw erase'; sw.removeAttribute('style'); $('#current-name').textContent = 'Eraser'; }
    else if (tool === BLENDER) { sw.className = 'sw dropper blender'; sw.removeAttribute('style'); sw.innerHTML = BLENDER_ICON; $('#current-name').textContent = 'Blender: hold to mix'; }
    else if (tool === DROPPER) { sw.className = 'sw dropper'; sw.removeAttribute('style'); sw.innerHTML = DROPPER_ICON; $('#current-name').textContent = 'Hold, aim, let go to copy'; }
    else { sw.className = 'sw'; sw.setAttribute('style', swatchStyle(tool)); $('#current-name').textContent = MATS[tool].name; }
    $('#current-size').textContent = BRUSHES[brush].label;
    $('#current-size').hidden = tool === DROPPER;
    if (typeof syncPortalBtn === 'function') syncPortalBtn();
  }
  function syncBrush() {
    const b = BRUSHES[brush];
    if ($('#current-size')) $('#current-size').textContent = b.label;
    $('#brush-dot').style.width = $('#brush-dot').style.height = b.dot + 'px';
    $('#brush-label').textContent = b.label;
  }
  $('#btn-brush').addEventListener('click', () => { brush = (brush + 1) % BRUSHES.length; syncBrush(); writeSaveSoon(); });
  function setPaused(v) {
    paused = v;
    $('#btn-pause').classList.toggle('is-paused', paused);
    $('#btn-pause').setAttribute('aria-label', paused ? 'Play' : 'Pause');
  }
  $('#btn-pause').addEventListener('click', () => setPaused(!paused));

  /* ---------------- World controls: speed, frame step, zero gravity ---------------- */
  const SPEEDS = [0.25, 0.5, 1, 2, 4];
  let speed = 1, stepAcc = 0;
  function setSpeed(v) {
    speed = v; stepAcc = 0;
    document.querySelectorAll('#wp-speed button').forEach((b) => b.classList.toggle('on', Number(b.dataset.s) === v));
    $('#world-btn-label').textContent = v === 0.25 ? '\u00bc\u00d7' : v === 0.5 ? '\u00bd\u00d7' : v + '\u00d7';
    $('#world-btn').classList.toggle('fast', v !== 1);
  }
  function stepOnce() { if (!paused) setPaused(true); world.step(); playWorldSounds(); }
  document.querySelectorAll('#wp-speed button').forEach((b) => b.addEventListener('click', () => setSpeed(Number(b.dataset.s))));
  $('#wp-step').addEventListener('click', stepOnce);
  $('#world-btn').addEventListener('click', (e) => {
    e.stopPropagation(); const p = $('#world-panel'); p.hidden = !p.hidden; $('#world-btn').setAttribute('aria-expanded', String(!p.hidden));
  });
  // Tapping the world (or anywhere else) tucks the panel away.
  addEventListener('pointerdown', (e) => { const p = $('#world-panel'); if (!p.hidden && !p.contains(e.target) && !$('#world-btn').contains(e.target)) { p.hidden = true; $('#world-btn').setAttribute('aria-expanded', 'false'); } }, true);
  setSpeed(1);
  function setZeroG(v, quiet) {
    if (v && !world.zeroG && !quiet) ST.zeroGUses++;
    world.zeroG = !!v; $('#wp-zerog').checked = world.zeroG; $('#world-btn-zg').hidden = !world.zeroG;
    if (!quiet) { note(world.zeroG ? 'Zero gravity: everything floats' : 'Gravity is back'); writeSaveSoon(); }
  }
  $('#wp-zerog').addEventListener('change', (e) => setZeroG(e.target.checked));

  /* ---------------- Zoom and pan ----------------
     zoom 1 = the whole world fits the screen. Zoomed in, (ox, oy) is where the world's top-left
     corner sits in the play area; it's kept so the world always fills the view (no empty edges). */
  let zoom = 1, ox = 0, oy = 0;
  const ZMAX = 8;
  function dc() { return cell * zoom; } // the on-screen size of one cell
  function layoutView() {
    if (!world) return;
    const r = stage.getBoundingClientRect(), W = world.w * dc(), H = world.h * dc();
    if (zoom <= 1.001) { zoom = 1; ox = Math.floor((r.width - world.w * cell) / 2); oy = Math.floor((r.height - world.h * cell) / 2); }
    else {
      ox = W <= r.width ? (r.width - W) / 2 : Math.min(0, Math.max(r.width - W, ox));
      oy = H <= r.height ? (r.height - H) / 2 : Math.min(0, Math.max(r.height - H, oy));
    }
    const Wd = world.w * dc(), Hd = world.h * dc();
    [canvas, glowCv].forEach((el) => { el.style.width = Wd + 'px'; el.style.height = Hd + 'px'; el.style.left = ox + 'px'; el.style.top = oy + 'px'; });
    const TBc = window.SandSim.TB * dc();
    heatCv.style.width = world.tw * TBc + 'px'; heatCv.style.height = world.th * TBc + 'px'; heatCv.style.left = ox + 'px'; heatCv.style.top = oy + 'px';
    const zl = zoom.toFixed(1).replace(/\.0$/, '') + '\u00d7';
    $('#wp-zfit').textContent = zoom > 1.001 ? 'Fit (' + zl + ')' : 'Fit';
    $('#world-btn-zoom').hidden = zoom <= 1.001; $('#world-btn-zoom').textContent = '\u2315 ' + zl;
    ring.hidden = true; if (typeof hideLoupe === 'function') hideLoupe();
  }
  // Zoom so that the point (sx, sy) in the play area stays under the finger / cursor.
  function zoomAt(z, sx, sy) {
    z = Math.max(1, Math.min(ZMAX, z));
    if (zoom <= 1.001 && z > 1.001) ST.zoomUses++;
    const u = (sx - ox) / dc(), v = (sy - oy) / dc();
    zoom = z; ox = sx - u * dc(); oy = sy - v * dc(); layoutView();
  }
  function zoomCentre(f) { const r = stage.getBoundingClientRect(); zoomAt(zoom * f, r.width / 2, r.height / 2); }
  function panBy(dx, dy) { if (zoom <= 1.001) return; ox += dx; oy += dy; layoutView(); }
  $('#wp-zin').addEventListener('click', () => zoomCentre(1.5));
  $('#wp-zout').addEventListener('click', () => zoomCentre(1 / 1.5));
  $('#wp-zfit').addEventListener('click', () => { zoom = 1; layoutView(); });
  const stagePt = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  // Mouse wheel / trackpad: pinch (or Ctrl + scroll) zooms; two-finger scrolling pans when zoomed in.
  stage.addEventListener('wheel', (e) => {
    if (e.target.closest && e.target.closest('.world-panel')) return;
    const [sx, sy] = stagePt(e);
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(zoom * Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.006), sx, sy); }
    else if (zoom > 1.001) { e.preventDefault(); panBy(-e.deltaX, -e.deltaY); }
  }, { passive: false });
  // Safari on the Mac sends trackpad pinches as gesture events.
  let gz = 1;
  stage.addEventListener('gesturestart', (e) => { e.preventDefault(); gz = zoom; });
  stage.addEventListener('gesturechange', (e) => { e.preventDefault(); const [sx, sy] = stagePt(e); zoomAt(gz * e.scale, sx, sy); });
  // Two fingers on a touch screen: pinch to zoom, drag to pan. A stroke the first finger just started is undone.
  const touches = new Map(); let pinch = null, pinchLock = false;
  const two = () => { const [a, b] = [...touches.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || e.target !== canvas) return;
    const [x, y] = stagePt(e); touches.set(e.pointerId, { x, y, t: performance.now() });
    if (touches.size === 2) {
      // Undo whatever the first finger just started (it was the start of a pinch, not a stroke).
      const first = [...touches.values()][0];
      if (drawing || portalDrag || dropping || line) {
        drawing = false; portalDrag = false; dropping = false; ghost.hidden = true; ring.hidden = true; hideLoupe(); if (line) endLine(false);
        if (performance.now() - first.t < 600 && undoStack.length) { const sn = undoStack.pop(); world.t.set(sn.t); world.life.set(sn.l); world.fuel.set(sn.f); world.creatures = sn.c; $('#btn-undo').disabled = !undoStack.length; }
      }
      const g = two(); pinch = { d: g.d, x: g.x, y: g.y, z: zoom, ox, oy }; pinchLock = true;
      e.stopImmediatePropagation(); e.preventDefault();
    } else if (pinchLock) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  stage.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    const [x, y] = stagePt(e); const p = touches.get(e.pointerId); p.x = x; p.y = y;
    if (pinch && touches.size >= 2) {
      const g = two(), z = Math.max(1, Math.min(ZMAX, pinch.z * g.d / pinch.d));
      const u = (pinch.x - pinch.ox) / (cell * pinch.z), v = (pinch.y - pinch.oy) / (cell * pinch.z); // the spot under the fingers when the pinch began
      zoom = z; ox = g.x - u * dc(); oy = g.y - v * dc(); layoutView();
      e.stopImmediatePropagation(); e.preventDefault();
    } else if (pinchLock) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  const lift = (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    if (pinchLock) { e.stopImmediatePropagation(); if (!touches.size) { pinchLock = false; writeSaveSoon(); } }
  };
  stage.addEventListener('pointerup', lift, true); stage.addEventListener('pointercancel', lift, true);
  // Tap the trash can to clear everything; press and hold it to pick one element to remove.
  const trash = $('#btn-clear');
  let holdTimer = 0, held = false;
  trash.addEventListener('pointerdown', () => {
    held = false; clearTimeout(holdTimer); trash.classList.add('holding');
    holdTimer = setTimeout(() => { held = true; trash.classList.remove('holding'); if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {} openInWorld(); }, 450);
  });
  const endHold = () => { clearTimeout(holdTimer); trash.classList.remove('holding'); };
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => trash.addEventListener(ev, endHold));
  trash.addEventListener('contextmenu', (e) => e.preventDefault());
  trash.addEventListener('click', (e) => { if (held) { held = false; e.preventDefault(); return; } $('#confirm').hidden = false; });

  const SHOW_AS = { [M.ROCKET]: M.FIREWORK }; // a firework in flight is listed (and removed) with fireworks
  function openInWorld() { renderInWorld(); $('#inworld').hidden = false; }
  function renderInWorld() {
    const counts = new Uint32Array(COUNT), t = world.t;
    for (let i = 0; i < t.length; i++) if (t[i]) { const v = world.matAt(i); counts[SHOW_AS[v] || v]++; }
    world.creatures.forEach((c) => { counts[c.k]++; });
    const list = $('#inworld-list'); list.innerHTML = '';
    const items = [];
    for (let m = 1; m < COUNT; m++) if (counts[m]) items.push(m);
    items.sort((a, b) => counts[b] - counts[a] || MATS[a].name.localeCompare(MATS[b].name));
    if (!items.length) { const p = document.createElement('p'); p.className = 'no-match'; p.textContent = 'Your world is empty.'; list.append(p); }
    items.forEach((m) => {
      const row = document.createElement('div'); row.className = 'iw-row';
      const sw = document.createElement('i'); sw.className = 'sw'; sw.setAttribute('style', swatchStyle(m));
      const nm = document.createElement('b'); nm.textContent = MATS[m].name;
      const ct = document.createElement('small'); ct.textContent = shortNum(counts[m]) + (isCreature(m) ? '' : counts[m] === 1 ? ' bit' : ' bits');
      const x = document.createElement('button'); x.type = 'button'; x.className = 'iw-x'; x.setAttribute('aria-label', 'Remove all ' + MATS[m].name); x.innerHTML = '&times;';
      x.addEventListener('click', () => { removeAll(m); row.classList.add('gone'); setTimeout(renderInWorld, 180); });
      row.append(sw, nm, ct, x); list.append(row);
    });
    $('#inworld-all').hidden = !items.length;
  }
  function removeAll(m) {
    snapshot();
    if (isCreature(m)) { world.creatures = world.creatures.filter((c) => c.k !== m); writeSaveSoon(); return; }
    const t = world.t, life = world.life, fuel = world.fuel;
    for (let i = 0; i < t.length; i++) {
      const v = world.matAt(i);
      // Burning fuel counts as the thing that's burning, so removing Wood also puts out burning wood.
      if (v === m || SHOW_AS[v] === m || (v === M.FIRE && fuel[i] === m)) { t[i] = 0; life[i] = 0; fuel[i] = 0; }
    }
    writeSaveSoon();
  }
  $('#inworld-close').addEventListener('click', () => { $('#inworld').hidden = true; });
  $('#inworld-all').addEventListener('click', () => { $('#inworld').hidden = true; $('#confirm').hidden = false; });
  $('#confirm-no').addEventListener('click', () => { $('#confirm').hidden = true; });
  $('#confirm-yes').addEventListener('click', () => {
    snapshot(); ST.clears++;
    world.t.fill(0); world.life.fill(0); world.fuel.fill(0); world.creatures = [];
    world.skin.fill(0); world.tint.fill(0); world.hasTint = false;
    world.flying = []; world.bhStore = []; world.pendingBlasts = []; world.pendingFrost = []; world.holes = null; world.portOut = []; // nothing left over from the old world
    if (world.au) { world.au.fill(0); world.av.fill(0); world.ap.fill(0); world.ap2.fill(0); world.airOn = false; }
    $('#confirm').hidden = true; writeSave();
  });

  /* ---------------- Saved worlds ----------------
     Each saved world is kept in the browser's IndexedDB (lots of room), squeezed
     with gzip when the browser can, plus a small picture for the list. If IndexedDB
     isn't available it falls back to localStorage (room for only a few worlds). */
  const WDB = (() => {
    let p = null;
    const open = () => p || (p = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('sandalchemy-worlds', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('worlds', { keyPath: 'id' });
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('no db'));
      } catch (e) { rej(e); }
    }));
    const LS = 'sandalchemy.worlds';
    const lsAll = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } };
    const lsSet = (a) => localStorage.setItem(LS, JSON.stringify(a)); // throws when full
    async function tx(mode, fn) {
      const d = await open();
      return new Promise((res, rej) => { const t = d.transaction('worlds', mode), r = fn(t.objectStore('worlds')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted')); });
    }
    return {
      all: () => tx('readonly', (s) => s.getAll()).catch(() => lsAll()),
      put: (rec) => tx('readwrite', (s) => s.put(rec)).catch(() => { const a = lsAll().filter((x) => x.id !== rec.id); a.push(rec); lsSet(a); }),
      del: (id) => tx('readwrite', (s) => s.delete(id)).catch(() => lsSet(lsAll().filter((x) => x.id !== id))),
    };
  })();
  async function squeeze(str) {
    if (typeof CompressionStream === 'undefined') return { z: 0, d: str };
    const buf = await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    return { z: 1, d: pack(new Uint8Array(buf)) };
  }
  async function unsqueeze(o) {
    if (!o.z) return o.d;
    const bin = atob(o.d), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  function worldThumb() {
    const tw = 240, th = Math.max(1, Math.round(tw * world.h / world.w)), c = document.createElement('canvas');
    c.width = tw; c.height = th; const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, th); sky.addColorStop(0, '#1d1f4a'); sky.addColorStop(1, '#0f1026');
    g.fillStyle = sky; g.fillRect(0, 0, tw, th);
    g.drawImage(canvas, 0, 0, tw, th);
    if (glowOn) { g.globalCompositeOperation = 'screen'; g.drawImage(glowCv, 0, 0, tw, th); }
    return c.toDataURL('image/jpeg', 0.82);
  }
  let worldList = [];
  async function renderWorlds() {
    try { worldList = (await WDB.all()) || []; } catch (e) { worldList = []; }
    worldList.sort((a, b) => b.at - a.at);
    const grid = $('#worlds-grid'); grid.textContent = '';
    $('#worlds-empty').hidden = worldList.length > 0;
    $('#worlds-count').textContent = worldList.length ? worldList.length + ' saved' : '';
    worldList.forEach((r) => {
      const card = document.createElement('div'); card.className = 'wcard';
      const img = document.createElement('img'); img.src = r.thumb; img.alt = ''; img.title = 'Load ' + r.name; img.addEventListener('click', () => loadWorld(r));
      const body = document.createElement('div'); body.className = 'wcard-body';
      const txt = document.createElement('div'); txt.className = 'wcard-text';
      const b = document.createElement('b'); b.textContent = r.name;
      const s = document.createElement('span'); s.textContent = new Date(r.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      txt.append(b, s);
      const load = document.createElement('button'); load.type = 'button'; load.className = 'wload'; load.textContent = 'Load'; load.addEventListener('click', () => loadWorld(r));
      const del = document.createElement('button'); del.type = 'button'; del.className = 'wdel'; del.textContent = '\u00d7'; del.setAttribute('aria-label', 'Delete ' + r.name);
      let armed = 0;
      del.addEventListener('click', async () => {
        if (Date.now() > armed) { armed = Date.now() + 3000; del.classList.add('armed'); del.textContent = 'Delete?'; setTimeout(() => { if (Date.now() > armed) { del.classList.remove('armed'); del.textContent = '\u00d7'; } }, 3100); return; }
        await WDB.del(r.id); note('Deleted \u201c' + r.name + '\u201d'); renderWorlds();
      });
      body.append(txt, load, del); card.append(img, body); grid.append(card);
    });
  }
  async function saveWorld() {
    const btn = $('#world-save'), input = $('#world-name');
    const name = input.value.trim().slice(0, 40) || 'World ' + (worldList.length + 1);
    btn.disabled = true; btn.textContent = 'Saving\u2026';
    try {
      const s = buildSave().world;
      s.bh = (world.bhStore || []).slice(0, 12000); // what the black holes have swallowed, so white holes keep going
      if (world.stickHome) s.home = world.stickHome;
      const rec = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, at: Date.now(), w: world.w, h: world.h, thumb: worldThumb(), data: await squeeze(JSON.stringify(s)) };
      await WDB.put(rec); ST.worldsSaved++;
      { let n = 0; const kinds = new Set(); for (let i = 0; i < world.t.length; i++) { const v = world.t[i]; if (v) { n++; kinds.add(v); } }
        if (!ST.bigWorld || n > ST.bigWorld.n) ST.bigWorld = { name, n }; if (!ST.divWorld || kinds.size > ST.divWorld.n) ST.divWorld = { name, n: kinds.size }; }
      saveStats();
      input.value = ''; note('Saved \u201c' + name + '\u201d'); renderWorlds();
    } catch (e) { note('Couldn\u2019t save it: this browser is out of room. Delete an old world and try again.'); }
    btn.disabled = false; btn.textContent = 'Save this world';
  }
  async function loadWorld(r) {
    let sw;
    try { sw = JSON.parse(await unsqueeze(r.data)); } catch (e) { note('That saved world couldn\u2019t be opened.'); return; }
    const old = restoreWorld({ v: 2, world: sw });
    if (!old) { note('That saved world couldn\u2019t be opened.'); return; }
    snapshot();
    world.t.fill(0); world.life.fill(0); world.fuel.fill(0); world.creatures = [];
    world.skin.fill(0); world.tint.fill(0); world.hasTint = false; if (world.heat) world.heat.fill(0);
    world.flying = []; world.pendingBlasts = []; world.pendingFrost = []; world.holes = null; world.portOut = [];
    if (world.au) { world.au.fill(0); world.av.fill(0); world.ap.fill(0); world.ap2.fill(0); world.airOn = false; }
    if (sw.home) old.stickHome = sw.home;
    old.discovered.set(world.discovered); // loading never changes what you've discovered
    world.copyFrom(old); setZeroG(world.zeroG, true);
    ST.worldsLoaded++; r.loads = (r.loads || 0) + 1; WDB.put(r).catch(() => {});
    world.bhStore = [];
    const ok = (m) => Number.isInteger(m) && m >= 0 && m < COUNT && !(m && MATS[m].reserved);
    if (Array.isArray(sw.bh)) for (let k = 0; k + 1 < sw.bh.length; k += 2) if (sw.bh[k] && ok(sw.bh[k]) && ok(sw.bh[k + 1])) world.bhStore.push(sw.bh[k], sw.bh[k + 1]); // (material, skin) pairs
    $('#worlds').hidden = true; writeSave();
    note('Loaded \u201c' + r.name + '\u201d' + (r.w !== world.w || r.h !== world.h ? ' (fitted to this screen)' : '') + '. Undo brings back what you had.');
  }
  $('#btn-worlds').addEventListener('click', () => { $('#worlds').hidden = false; renderWorlds(); });
  $('#worlds-close').addEventListener('click', () => { $('#worlds').hidden = true; });
  $('#world-save').addEventListener('click', saveWorld);
  $('#world-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveWorld(); } });

  /* ---------------- Discoveries ---------------- */
  const toastQueue = []; let toastBusy = false;
  function discovered(m) {
    statFind(m);
    if (m === M.PORTALIN && world && !world.discovered[M.PORTALOUT]) { world.discovered[M.PORTALOUT] = 1; setTimeout(() => discovered(M.PORTALOUT), 0); } // portals come as a pair
    unseen.add(m);
    toastQueue.push(m);
    if (!toastBusy) nextToast();
    renderPalette(); renderCount();
    const btn = m === M.CAULDRON ? $('#btn-pot') : $('#btn-book'); btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
    const nb = document.querySelector(`.mat[data-m="${m}"]`); if (nb) nb.classList.add('pop');
    writeSaveSoon();
  }
  function nextToast() {
    const m = toastQueue.shift();
    const t = $('#toast');
    if (m == null) { toastBusy = false; t.classList.remove('on'); $('#current').classList.remove('hide'); return; }
    toastBusy = true;
    t.innerHTML = '';
    const sw = document.createElement('i'); sw.className = 'sw'; sw.setAttribute('style', swatchStyle(m));
    const txt = document.createElement('div');
    txt.innerHTML = '<small>' + (MATS[m].invented ? '\u2728 New invention!' : 'New discovery!') + '</small><b></b><span></span>';
    txt.querySelector('b').textContent = MATS[m].name;
    txt.querySelector('span').textContent = MATS[m].creature ? 'It\u2019s alive! ' + MATS[m].desc : brewed(m) ? 'Brewed: ' + MATS[m].recipe : MATS[m].recipe || '';
    t.append(sw, txt);
    t.classList.add('on'); $('#current').classList.add('hide');
    if (MATS[m].invented) SND.sparkle(); else SND.chime();
    setTimeout(() => { t.classList.remove('on'); setTimeout(nextToast, 450); }, 2600);
  }
  function countFound() {
    let n = 0; ORDER.forEach((m) => { if (world.discovered[m]) n++; });
    for (let m = 1; m < COUNT; m++) if (MATS[m].invented && !MATS[m].hidden && world.discovered[m]) n++; // AI inventions count too
    return n;
  }
  function renderCount() {
    const n = countFound();
    $('#disc-count').textContent = n;
  }
  /* ---------------- Search ---------------- */
  const norm = (q) => q.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  function matches(m, q) {
    if (!q) return true;
    const n = norm(MATS[m].name);
    return n.includes(q) || n.replace(/ /g, '').includes(q.replace(/ /g, ''));
  }
  // Hide grid items that don't match, and any heading left with nothing under it.
  function filterGrid(grid, q, isHeader) {
    let head = null, any = false, total = 0;
    const flush = () => { if (head) head.hidden = !any; };
    [...grid.children].forEach((el) => {
      if (isHeader(el)) { flush(); head = el; any = false; return; }
      const m = Number(el.dataset.m), show = q ? !!el.dataset.m && !el.classList.contains('locked') && matches(m, q) : true;
      el.hidden = !show; if (show) { any = true; total++; }
    });
    flush();
    return total;
  }
  function hookSearch(input, run) {
    const x = input.parentNode.querySelector('.search-x');
    input.addEventListener('input', () => { x.hidden = !input.value; run(norm(input.value)); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; x.hidden = true; run(''); } });
    x.addEventListener('click', () => { input.value = ''; x.hidden = true; run(''); input.focus(); });
  }
  function resetSearch(input) { input.value = ''; input.parentNode.querySelector('.search-x').hidden = true; }
  const runBookSearch = (q) => { const n = filterGrid($('#book-grid'), q, (el) => el.tagName === 'H3'); $('#book .no-match').hidden = !q || n > 0; };
  hookSearch($('#book-search'), runBookSearch);

  // The toolbar's Search button: type a name, tap the result to start painting with it.
  function openFind() {
    const g = $('#find-grid'); g.innerHTML = '';
    [{ label: '\u{1F552} Recent', items: recentItems() }, { label: '\u2605 Favorites', items: favItems() }].concat(shelfGroups()).forEach((grp) => {
      const items = grp.items.filter((m) => world.discovered[m]);
      if (!items.length) return;
      g.append(groupLabel(grp.label, 'ing-section'));
      items.forEach((m) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'ing' + (m === tool ? ' picked' : ''); b.dataset.m = m;
        const sw = document.createElement('i'); sw.className = 'sw'; sw.setAttribute('style', swatchStyle(m));
        const t = document.createElement('span'); t.textContent = MATS[m].name; if (MATS[m].name.split(' ').some((p) => p.length > 10)) t.className = 'long';
        b.append(sw, t);
        b.addEventListener('click', () => { pick(m); $('#find').hidden = true; scrollToTool(m); });
        g.append(b);
      });
    });
    const none = document.createElement('p'); none.className = 'no-match'; none.hidden = true; none.textContent = 'Nothing you\u2019ve discovered matches that yet.'; g.append(none);
    resetSearch($('#find-search')); runFind('');
    $('#find').hidden = false;
    setTimeout(() => $('#find-search').focus(), 50);
  }
  function runFind(q) {
    const g = $('#find-grid'), none = g.querySelector('.no-match');
    const n = filterGrid(g, q, (el) => el.tagName === 'H3' || el === none);
    none.hidden = !q || n > 0;
  }
  hookSearch($('#find-search'), runFind);
  $('#find-search').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = [...$('#find-grid').querySelectorAll('.ing')].find((b) => !b.hidden);
    if (first) first.click();
  });
  $('#btn-find').addEventListener('click', openFind);
  $('#find-close').addEventListener('click', () => { $('#find').hidden = true; });

  function openBook() {
    const n = countFound();
    $('#book-count').textContent = `${n} found`;
    const g = $('#book-grid'); g.innerHTML = '';
    const bookOrder = [];
    GROUPS.forEach((grp) => {
      if (grp === INV_GROUP) { invShelves(grp.items).forEach((sh) => sh.items.forEach((m) => bookOrder.push([m, grp.label, sh.label]))); return; }
      (grp.label === 'Crafted' ? [M.CAULDRON].concat(grp.items) : grp.items).forEach((m) => bookOrder.push([m, grp.label]));
    });
    bookOrder.forEach(([m, label, shelf], k) => {
      if (k === 0 || bookOrder[k - 1][1] !== label) {
        const hd = groupLabel(label, 'book-section');
        const note = { Basics: 'What every world starts with', Elements: 'Found by making things happen in your world',
          Crafted: 'Brewed in the Cauldron from everyday things: tap the Brew pot next to your brush', Magic: 'Brewed in the Cauldron, with a touch of magic',
          Creatures: 'Brought to life with Life Essence, in the Cauldron or out in your world',
          Objects: 'Whole builds made of real materials. Tap to place one',
          Wall: 'Unbreakable walls. Only the eraser or the clear button removes them',
          Inventions: 'Dreamed up by the Cauldron spirit (AI). Mix them again to invent even more' }[label];
        const sm = document.createElement('small'); sm.textContent = note; hd.append(sm);
        g.append(hd);
      }
      if (shelf && (k === 0 || bookOrder[k - 1][2] !== shelf)) { // a themed shelf inside Inventions
        const sh = document.createElement('h4'); sh.className = 'book-shelf';
        const n = bookOrder.filter((e) => e[2] === shelf).length;
        sh.textContent = shelf; const c = document.createElement('span'); c.textContent = n; sh.append(c);
        g.append(sh);
      }
      const mat = MATS[m], found = world.discovered[m];
      const c = document.createElement('div'), shown = !found && revealed.has(m);
      c.className = 'card' + (found ? '' : ' locked' + (hinted.has(m) ? ' hinted' : '') + (shown ? ' revealed' : '')); c.dataset.m = m;
      const sw = document.createElement('i');
      const how = (mat.start ? 'Starting element' : brewed(m) ? 'Brew: ' + mat.recipe : mat.recipe) + (mat.also ? ' · ' + mat.also : '');
      const txt = document.createElement('div'), b = document.createElement('b'), s = document.createElement('span');
      const showReal = () => { sw.className = 'sw' + (found ? '' : ' faded'); sw.textContent = ''; sw.setAttribute('style', swatchStyle(m)); };
      if (found || shown) showReal(); else { sw.className = 'sw unknown'; sw.textContent = '?'; }
      b.textContent = found || shown ? mat.name : '???';
      s.textContent = found ? how + (mat.desc ? ' · ' + mat.desc : '') + (mat.fxText ? ' · Does: ' + mat.fxText : '')
        : shown ? how + ' (not found yet)' : hinted.has(m) ? mat.hint : 'Tap for a hint';
      txt.append(b, s); c.append(sw, txt);
      if (found) {
        const st = document.createElement('button'); st.type = 'button'; st.className = 'card-fav' + (isFav(m) ? ' on' : '');
        st.setAttribute('aria-label', (isFav(m) ? 'Remove ' : 'Add ') + mat.name + (isFav(m) ? ' from' : ' to') + ' Favorites'); st.title = 'Favorite';
        st.textContent = isFav(m) ? '\u2605' : '\u2606';
        st.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(m); const on = isFav(m); st.classList.toggle('on', on); st.textContent = on ? '\u2605' : '\u2606'; });
        c.classList.add('has-fav'); c.append(st);
      }
      if (found && label === 'Inventions') {
        const x = document.createElement('button'); x.type = 'button'; x.className = 'card-del';
        x.setAttribute('aria-label', 'Delete ' + mat.name); x.title = 'Delete';
        x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>';
        x.addEventListener('click', (e) => { e.stopPropagation(); askDelete(m); });
        c.classList.add('has-del'); c.append(x);
      }
      if (!found && !shown) {
        // Tap once for a hint; still stuck? The Reveal button shows what it is and how to make it.
        c.setAttribute('role', 'button'); c.tabIndex = 0;
        const rv = document.createElement('button'); rv.type = 'button'; rv.className = 'card-reveal'; rv.textContent = 'Reveal';
        rv.setAttribute('aria-label', 'Reveal what this is');
        rv.hidden = !hinted.has(m);
        rv.addEventListener('click', (e) => {
          e.stopPropagation(); revealed.add(m); hinted.add(m); writeSaveSoon(); ST.revealsUsed++;
          c.classList.add('revealed'); showReal(); b.textContent = mat.name; s.textContent = how + ' (not found yet)';
          c.removeAttribute('role'); c.tabIndex = -1; rv.remove();
        });
        const hint = () => { if (revealed.has(m)) return; if (!hinted.has(m)) ST.hintsUsed++; hinted.add(m); c.classList.add('hinted'); s.textContent = mat.hint; rv.hidden = false; writeSaveSoon(); };
        c.addEventListener('click', hint);
        c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hint(); } });
        txt.append(rv);
      }
      g.append(c);
    });
    resetSearch($('#book-search')); runBookSearch('');
    $('#book').hidden = false;
  }
  function openSettings() { renderAIBox(); $('#inv-count').textContent = `Inventions: ${invCount()}`; $('#settings').hidden = false; }
  $('#btn-settings').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', () => { $('#settings').hidden = true; });
  $('#btn-book').addEventListener('click', openBook);
  $('#book-close').addEventListener('click', () => { $('#book').hidden = true; });
  document.querySelectorAll('.overlay').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o) o.hidden = true; }));

  /* ---------------- Cauldron: the mixing panel ----------------
     Pick two discovered ingredients and brew. Magic results are discovered
     straight away and land in the toolbar. */
  const { MAGIC, magic, setMagic, rxOf, traitMix } = window.SandMats;
  /* ---------------- Inventions (the Cauldron spirit / AI) ----------------
     Pairs with no recipe of their own can ask the AI (a small Cloudflare
     Worker, see /worker) to invent something new. The AI only fills in a
     form; everything it says is checked here and turned into a material
     built from the game's own building blocks. */
  const AI_DEFAULT_URL = 'https://super-mode-0dd5.christers20.workers.dev';                 // paste your Worker address here to switch the AI on for everyone
  const INV_KEY = 'sandalchemy.inventions.v1', AI_KEY = 'sandalchemy.ai.v1';
  const { invent, isSlot } = window.SandMats;
  const isBuiltin = (m) => m > 0 && m < COUNT && !isSlot(m) && !MATS[m].spare;
  let inventions = [];                       // [{ id, a, b, spec }]
  let aiSettings = { on: true, url: '', mode: 'cloud', model: 'small' };
  try { const s = JSON.parse(localStorage.getItem(AI_KEY) || 'null'); if (s) aiSettings = Object.assign(aiSettings, s); } catch (e) { /* ignore */ }
  const aiUrl = () => (aiSettings.url || AI_DEFAULT_URL || '').trim().replace(/\/+$/, '');
  const hasGPU = () => !!(navigator.gpu) && window.isSecureContext !== false;
  // Before downloading anything, make sure this device's graphics chip can really run the model.
  // Phones often lack 16-bit maths (shader-f16), so they get the 32-bit build of the same model.
  let gpuInfo = null;
  /* A debug log for the on-device AI: what the phone's graphics chip reports, each step of starting
     the model, and every answer or error. Kept between visits, and shown (with Copy) in the book. */
  const AILOG_KEY = 'sandalchemy.ailog';
  let aiLogLines = []; try { aiLogLines = JSON.parse(localStorage.getItem(AILOG_KEY) || '[]'); } catch (e) { aiLogLines = []; }
  function aiLog(msg) {
    const t = new Date(); const stamp = t.toTimeString().slice(0, 8);
    aiLogLines.push(stamp + '  ' + String(msg).replace(/\s+/g, ' ').slice(0, 400));
    if (aiLogLines.length > 120) aiLogLines = aiLogLines.slice(-120);
    try { localStorage.setItem(AILOG_KEY, JSON.stringify(aiLogLines)); } catch (e) { /* full */ }
    const pre = document.getElementById('ai-log'); if (pre) { pre.textContent = aiLogLines.join('\n'); pre.scrollTop = pre.scrollHeight; }
  }
  function gpuCheck() {
    if (!gpuInfo) gpuInfo = (async () => {
      if (!hasGPU()) return { ok: false, why: 'This browser can\u2019t run AI on its graphics chip.' };
      if (!('caches' in window)) return { ok: false, why: 'This browser can\u2019t store the download. Open the game from its web page (like itch.io) instead of a saved file.' };
      const adapter = await Promise.race([navigator.gpu.requestAdapter().catch(() => null), new Promise((r) => setTimeout(() => r(null), 10000))]);
      if (!adapter) { aiLog('GPU: no adapter'); return { ok: false, why: 'This device\u2019s graphics chip isn\u2019t supported. Try Online, or a computer.' }; }
      try {
        const i = adapter.info || {}, L = adapter.limits || {};
        aiLog(`GPU: ${i.vendor || '?'} ${i.architecture || ''} ${i.device || ''} ${i.description || ''} | f16 ${adapter.features.has('shader-f16')} | maxBuffer ${Math.round((L.maxBufferSize || 0) / 1048576)}MB | maxStorageBinding ${Math.round((L.maxStorageBufferBindingSize || 0) / 1048576)}MB | memory ${navigator.deviceMemory || '?'}GB | ${navigator.userAgent}`);
      } catch (e) { aiLog('GPU info error: ' + e.message); }
      return { ok: true, f16: adapter.features.has('shader-f16') };
    })();
    return gpuInfo;
  }
  const aiReady = () => aiSettings.on && (aiSettings.mode === 'device' ? hasGPU() : /^(https:\/\/[^\s]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(aiUrl()));
  const INV_GROUP = { label: 'Inventions', items: [] };
  GROUPS.push(INV_GROUP);
  /* Inventions are sorted into themed shelves by what they're called, what they do and what they act like.
     The name counts most, then the effects and the element it acts like, then the description. */
  const INV_CATS = [
    ['Creatures', null],
    ['Explosive', /\b(bomb|boom|blast|explo\w*|nitro|tnt|dynamite|detonat\w*|kaboom|firework\w*|c4|gunpowder|grenade\w*)\b/],
    ['Fire & Heat', /\b(fire|flame\w*|blaze|burn\w*|ember\w*|lava|magma\w*|heat\w*|hot|inferno|pyro\w*|scorch\w*|solar|sun\w*|smoke|ash|molten|melt\w*|charcoal|coal|candle|torch|wax)\b/],
    ['Ice & Frost', /\b(ice|icy|frost\w*|snow\w*|cold|freez\w*|frozen|glaci\w*|chill\w*|winter|blizzard|polar|arctic|sleet|hail)\b/],
    ['Storm & Electric', /\b(lightning|thunder\w*|volt\w*|spark\w*|zap\w*|electr\w*|shock\w*|storm\w*|static|plasma|charge\w*|tesla|bolt)\b/],
    ['Water & Liquids', /\b(water|sea|ocean|tide\w*|tidal|aqua\w*|rain\w*|bubbl\w*|wave\w*|swamp|mud\w*|slime|goo|liquid|fountain|ink|puddle|pond|soap|steam|mist|fog|cloud\w*|mire|marsh|wet|sludge|toxic|acid\w*|poison\w*|oil|dew\w*)\b/],
    ['Plants & Nature', /\b(plant\w*|seed\w*|flower\w*|bloom\w*|tree\w*|moss\w*|vine\w*|leaf|leaves|petal\w*|root\w*|mushroom\w*|fung\w*|coral|garden|grow\w*|pollen|blossom\w*|sprout\w*|bio\w*|lum\w*|grass|herb\w*|weed\w*|wood\w*|forest|nature)\b/],
    ['Sweets', /\b(candy|sugar\w*|sweet\w*|chocolate|choco|honey\w*|hive|caramel|cake|gingerbread|cotton|syrup|jelly|cookie|toffee|lollipop|cupcake|frosting)\b/],
    ['Earth & Crystal', /\b(stone\w*|rock\w*|sand\w*|crystal\w*|gem\w*|dust|metal\w*|iron|gold\w*|geode|clay|dirt|obsidian|glass|diamond|pebble\w*|quartz|ore|mineral\w*|boulder|earth|granite|steel|copper)\b/],
    ['Magic & Space', /\b(magic\w*|star\w*|fairy|fairies|spirit\w*|ghost\w*|aurora|rainbow\w*|glow\w*|light\w*|cosmic|nebula|void|galax\w*|moon\w*|mystic\w*|wish\w*|potion\w*|essence|enchant\w*|arcane|shadow\w*|dark\w*|sparkl\w*|shimmer\w*|wormhole|portal|teleport\w*|astral|celestial|comet|meteor\w*)\b/],
    ['Odds & Ends', null],
  ];
  const invCatCache = new Map();
  function invCategory(m) {
    if (invCatCache.has(m)) return invCatCache.get(m);
    const mat = MATS[m]; let best = 'Odds & Ends';
    if (mat.creature) best = 'Creatures';
    else {
      const lower = (t) => String(t || '').toLowerCase();
      const parts = [[lower(mat.name), 4], [lower(mat.fxText), 2], [mat.like ? lower(MATS[mat.like].name) : '', 2], [lower(mat.desc), 1]];
      let top = 0;
      INV_CATS.forEach(([label, re]) => {
        if (!re) return;
        let score = 0;
        parts.forEach(([text, w]) => { const hits = text.match(new RegExp(re.source, 'g')); if (hits) score += w * hits.length; });
        if (score > top) { top = score; best = label; } // ties keep the earlier shelf
      });
    }
    invCatCache.set(m, best); return best;
  }
  // The inventions split into their shelves, in shelf order (empty shelves left out).
  function invShelves(items) {
    return INV_CATS.map(([label]) => ({ label, items: items.filter((m) => invCategory(m) === label) })).filter((g) => g.items.length);
  }
  // GROUPS, with Inventions split into its shelves (for the Cauldron and Search lists).
  const shelfGroups = () => GROUPS.flatMap((g) => (g === INV_GROUP ? invShelves(g.items).map((s) => ({ label: '\u2728 ' + s.label, items: s.items })) : [g]));

  const BAD_WORDS = /\b(ass|arse|bitch|bastard|crap|damn|dick|fuck|shit|piss|cock|cunt|slut|whore|nazi|porn|sex|kill|murder|gun|drug|weed|beer|wine|vodka|blood|gore)\w*/i;
  const MOVES = ['walk', 'climb', 'slither', 'wade', 'fly', 'swim', 'hop', 'leap', 'flutter', 'burrow', 'drift', 'egg', 'paddle', 'amphibian'];
  const STATES = ['powder', 'liquid', 'gas', 'solid'];
  const hexOk = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
  const normName = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  function cleanName(n) {
    n = String(n || '').replace(/[^A-Za-z0-9 '\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 22).trim();
    if (n.length < 2 || BAD_WORDS.test(n)) return '';
    return n.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  function cleanText(t, max) {
    t = String(t || '').replace(/[<>{}\[\]\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
    return BAD_WORDS.test(t) ? '' : t;
  }
  // Name lookups go through an index (with thousands of inventions, scanning every material each time was slow).
  let nameIndex = null;
  function findByName(name) {
    const k = normName(name); if (!k) return 0;
    if (!nameIndex) {
      nameIndex = new Map();
      for (let m = 1; m < COUNT; m++) if (MATS[m] && !MATS[m].reserved && !MATS[m].hidden) { const n = normName(MATS[m].name); if (!nameIndex.has(n)) nameIndex.set(n, m); }
    }
    return nameIndex.get(k) || 0;
  }
  const FALLBACK_SPRITES = {
    fly: ['a.a..', '.aaab', '.....'], flutter: ['a.a', '.b.', 'a.a'], swim: ['.aa..', 'aaaab', '.aa..'], drift: ['.aa.', 'aaaa', 'b.b.', '.b.b'],
    burrow: ['.....', 'aabab'], slither: ['..aa..ab', 'aa..aa..'], default: ['...aa', 'aaaab', 'a.a.a'],
  };
  /* ---- Drawing creatures the AI didn't draw well ----
     The AI likes to copy the example in its instructions, so lots of creatures came out
     as the same little pig. When that happens (or the drawing is broken) the game draws
     its own picture from the creature's name: the right kind of body, with small changes
     picked from the name so no two look quite the same. Letters: a body, b head or
     second colour, c legs and details, d eyes. */
  const OLD_EXAMPLES = [['.....aa', 'aaaaaab', 'aaaaaa.', '.c..c..'], ['...aa', 'aaaab', 'a.a.a']];
  const maskOf = (rows) => { const s = new Set(); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') s.add(y * 16 + x); })); return s; };
  function copiedExample(rows) {
    const m = maskOf(rows);
    return OLD_EXAMPLES.some((ex) => { const e = maskOf(ex); let both = 0; m.forEach((k) => { if (e.has(k)) both++; }); return both / (m.size + e.size - both) >= 0.7; });
  }
  function seeded(text) { let h = 2166136261; for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (n) => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % n); }; }
  /* Body shapes for invention creatures, picked from the words in the name. The LAST creature word in the
     name wins ("Toad Bot" is a robot, "Magma Crab" is a crab). Words are matched at the start of words. */
  const BODY_WORDS = [
    ['horse', /\b(horses?|pony|ponies|unicorns?|stallions?|mares?|steeds?|colts?|pegasus)/g],
    ['frog', /\b(frogs?|toads?|wogs?)\b/g],
    ['walker', /\b(dogs?|pup|puppy|cats?|kitten|kitty|fox|foxes|wolf|wolves|deer|cows?|pigs?|piglet|goats?|sheep|lamb|lions?|tigers?|bears?|cub|rabbits?|bunny|bunnies|mouse|mice|rats?|hamster|lizards?|dino\w*|camel|llama|elephant|rhino|hippo|yak|boar|otter|ferret|raccoon|skunk|hedgehog|turtle|tortoise|beasts?|critters?|hounds?|bull|ox)\b/g],
    ['serpent', /\b(snakes?|serpents?|worm\w*|eels?|wyrms?|naga|noodle|centipede|millipede)/g],
    ['octopus', /\b(octopus\w*|octo|squids?|kraken|cuttlefish)/g],
    ['jelly', /\b(jellyfish|medusa)/g],
    ['fish', /\b(fish\w*|sharks?|whales?|minnow|guppy|carp|trout|salmon|dolphins?|orca|piranha|goldfish|pollywog|tadpoles?)/g],
    ['crab', /\b(crabs?|lobsters?|scorpions?|shrimp)/g],
    ['spider', /\b(spiders?|tarantula|weavers?|spinners?|snares?)/g],
    ['bee', /\b(bees?|wasps?|hornets?|bumble\w*)\b/g],
    ['flutter', /\b(butterfly|butterflies|moths?|fairy|fairies|pixie|dragonfly|firefly|sprites?|wings?)\b/g],
    ['bat', /\b(bats?)\b/g],
    ['bird', /\b(birds?|owls?|crows?|ravens?|parrots?|eagles?|hawks?|ducks?|ducklings?|chicks?|chickens?|hens?|goose|geese|swans?|robin|sparrow|pigeon|flamingo|phoenix|griffin|roost|flyers?|falcons?|penguins?)\b/g],
    ['snail', /\b(snails?|slugs?|mudslug)\b/g],
    ['bug', /\b(bugs?|beetles?|ants?|ladybugs?|ticks?|mites?|crickets?|grasshoppers?|roach|weevils?|scarabs?|carriers?)\b/g],
    ['blob', /\b(slimes?|blobs?|jelly|goo|ooze|puddle|gel|mochi|pudding|marshmallow|glob|sludge|gloop)/g],
    ['ghost', /\b(ghosts?|wraiths?|spirits?|phantoms?|spect(er|re)s?|spook\w*|wisps?|haunt\w*|banshee)/g],
    ['biped', /\b(golems?|robots?|bots?|knights?|man|men|guards?|person|wizards?|witch|elf|elves|gnomes?|goblins?|trolls?|yeti|zombies?|skeletons?|ninja|king|queen|imp|monkeys?|apes?|gorilla|kid|soldiers?|pirates?|warriors?|giants?|ogres?|mummy|vampires?|aliens?|androids?|cyborgs?|sentinels?)\b/g],
    ['tree', /\b(trees?|groves?|bush|shrubs?|oaks?|willow)\b/g],
    ['mushroom', /\b(mushrooms?|shrooms?|fung\w*|toadstool)/g],
    ['flower', /\b(sprouts?|blooms?|blossoms?|flowers?|petals?|thorns?|vines?|ferns?|cactus|moss|buds?|lily|rose)\b/g],
    ['flame', /\b(flames?|blaze|embers?|inferno|flares?|pyro\w*|torch|candle|fires?)\b/g],
    ['cloud', /\b(clouds?|fog\w*|mists?|\w*storms?|nimbus|vapou?r|puffs?|tempest)\b/g],
    ['star', /\b(stars?|starfish|comets?|meteors?|nova|moon)\b/g],
    ['orb', /\b(bubbles?|orbs?|balls?|spheres?|pearl)\b/g],
    ['spiky', /\b(spark\w*|burst\w*|blasts?|glitter|crack\w*|thunder\w*|lightning|volt\w*|zap\w*|bolts?|shock\w*|static)/g],
  ];
  // The creature word that comes last in the text (or '' if there isn't one).
  function lastBodyAt(text) {
    let best = '', at = -1;
    for (const [k, re] of BODY_WORDS) { re.lastIndex = 0; let m; while ((m = re.exec(text))) { if (m.index >= at) { at = m.index; best = k; } } }
    return { kind: best, at };
  }
  const lastBody = (text) => lastBodyAt(text).kind;
  function bodyType(name, desc, move) {
    return lastBody(name.toLowerCase()) || lastBody(String(desc || '').toLowerCase())
      || { fly: 'bird', flutter: 'flutter', swim: 'fish', burrow: 'serpent', slither: 'serpent', drift: 'cloud', paddle: 'bird', hop: 'frog', leap: 'walker' }[move] || 'walker';
  }
  // Fixed little pictures (a = body colour, b = second colour, c = legs/details, d = eyes). Two or three of each, picked by name.
  const SHAPES = {
    crab: [['c...c', 'cc.cc', '.aaa.', 'adada', 'c.c.c'], ['c.....c', 'cc...cc', '.aaaaa.', 'aadadaa', '.c.c.c.']],
    octopus: [['.aaa.', 'aaaaa', 'adada', 'aaaaa', 'c.c.c'], ['..aaa..', '.aaaaa.', '.adada.', 'caaaaac', 'c.c.c.c']],
    jelly: [['.aaa.', 'aadaa', 'aaaaa', 'c.c.c', '.c.c.'], ['.bbb.', 'babab', 'aaaaa', 'c.c.c']],
    bat: [['a.....a', 'aa.d.aa', '.aaaaa.', '...a...'], ['aa...aa', '.aadaa.', '..aaa..']],
    ghost: [['.aaa.', 'adada', 'aaaaa', 'aaaaa', 'a.a.a'], ['.aaa.', 'aaaaa', 'adbda', 'aaaaa', '.a.a.']],
    frog: [['d...d', 'aa.aa', 'aaaaa', 'abbba', 'c...c'], ['.d.d.', 'aaaaa', 'aaaaa', 'c.a.c']],
    bee: [['.cc...', 'cc....', 'ababad', '.c.c..'], ['..cc..', '.cc...', 'babab.', 'ababad']],
    snail: [['..bb..', '.bbab.', '.babb.', 'aaaaad'], ['.bbb...', 'bbabb..', 'babbb.d', 'aaaaaaa']],
    tree: [['.bbb.', 'bbbbb', 'bdbdb', '.bab.', '..a..', '.c.c.'], ['..b..', '.bbb.', 'bbdbd', '.bbb.', '..a..', '..a..']],
    mushroom: [['.bbb.', 'bbabb', 'bbbbb', '.ada.', '.aaa.', '.c.c.'], ['bbbbb', 'babab', '.ada.', '.aaa.']],
    flower: [['.b.b.', 'bbabb', '.bdb.', '..c..', '.ccc.'], ['b.b.b', '.bab.', 'babab', '.bdb.', '..c..'], ['.bbb.', 'bbabb', 'bdbdb', '.bbb.', '..c..']],
    flame: [['..a..', '.aa..', '.aba.', 'abdba', '.aaa.'], ['.a...', '.aa.a', 'abaaa', 'adbda', '.aaa.']],
    cloud: [['.aa.aa.', 'aaaaaaa', 'aadaada', '.aaaaa.', '.c.c.c.'], ['..aaa..', '.aaaaa.', 'aadadaa', 'aaaaaaa']],
    star: [['..a..', 'aaaaa', '.ada.', '.a.a.'], ['..b..', '.aaa.', 'baaab', '.dad.', 'a...a']],
    orb: [['.aaa.', 'abaaa', 'adada', 'aaaaa', '.aaa.'], ['..aaa..', '.abaaa.', 'aadadaa', '.aaaaa.', '..aaa..']],
    spiky: [['c.a.c', '.aaa.', 'adada', '.aaa.', 'c.a.c'], ['..c..', 'c.a.c', '.ada.', 'caaac', '..c..']],
  };
  function drawCreature(name, desc, move) {
    const r = seeded(name), kind = bodyType(name, desc, move);
    const grid = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
    const out = (gr) => gr.map((row) => row.join(''));
    if (SHAPES[kind]) { const list = SHAPES[kind]; return list[r(list.length)]; }
    if (kind === 'horse') { // a long neck and a head held high (unicorns and pegasus get a horn)
      const horn = /unicorn|pegasus|horn/i.test(name), L = 5 + r(2), gr = grid(L + 2, 5);
      if (horn) gr[0][L + 1] = 'c';
      gr[1][L] = 'b'; gr[1][L + 1] = 'd'; gr[2][L] = 'a';
      for (let x = 0; x < L; x++) gr[3][x] = 'a'; gr[3][L] = 'a'; gr[2][0] = 'b'; // a swishy tail
      [1, 2, L - 2, L - 1].forEach((x) => { gr[4][x] = 'c'; });
      return out(gr);
    }
    if (kind === 'walker') { // four legs: long or short, tall or flat, maybe a tail, ears, a long neck or spots
      const L = 5 + r(3), H = 1 + r(2), ears = r(2), neck = r(5) === 0, tail = r(3) > 0, spots = r(3) === 0;
      const top = ears ? 1 : 0, bodyY = top + (neck ? 2 : 1), gr = grid(L + 2, bodyY + H + 1);
      if (ears) gr[0][L] = 'b';
      gr[top][L] = 'b'; gr[top][L + 1] = 'd';
      if (neck) gr[top + 1][L] = 'a';
      for (let y = bodyY; y < bodyY + H; y++) for (let x = 0; x < L; x++) gr[y][x] = spots && (x + y) % 3 === 0 ? 'b' : 'a';
      gr[bodyY][L] = 'a';
      if (tail) gr[bodyY - 1][0] = 'a';
      (L >= 6 ? [1, 3, L - 3, L - 1] : [0, L - 1]).forEach((x) => { gr[bodyY + H][x] = 'c'; });
      return out(gr);
    }
    if (kind === 'biped') { // stands up: head, arms, legs (robots are boxy with an antenna)
      const bot = /\b(robots?|bots?|android|cyborg|golem|sentinel|tech)\b/i.test(name);
      if (bot) return r(2) ? ['..c..', '.bdb.', '.aaa.', 'caaac', '.a.a.', '.c.c.'] : ['.c.c.', 'bdbdb', '.aaa.', 'caaac', '.c.c.'];
      const wide = r(2), tall = r(2), w = wide ? 5 : 4, gr = grid(w, tall ? 5 : 4), bw = wide ? 3 : 2;
      gr[0][1] = 'b'; gr[0][2] = 'd'; if (wide) gr[0][3] = 'b';
      (tall ? [1, 2, 3] : [1, 2]).forEach((y, k) => { for (let x = 1; x < 1 + bw; x++) gr[y][x] = 'a'; if (k === 0) { gr[y][0] = 'c'; gr[y][w - 1] = 'c'; } });
      const ly = gr.length - 1; gr[ly][1] = 'c'; gr[ly][bw] = 'c';
      return out(gr);
    }
    if (kind === 'bug') { // round shell, little legs, a head in front
      const L = 3 + r(3), gr = grid(L + 1, 3);
      for (let x = 1; x < L; x++) gr[0][x] = 'a';
      for (let x = 0; x < L; x++) gr[1][x] = r(3) === 0 ? 'b' : 'a';
      gr[1][L] = 'd'; if (r(2)) gr[0][L] = 'c';
      for (let x = 0; x < L; x += 2) gr[2][x] = 'c';
      return out(gr);
    }
    if (kind === 'spider') { // legs out on both sides
      const L = 3 + r(2), gr = grid(L + 3, 3);
      for (let x = 0; x < L + 3; x += 2) { gr[0][x] = 'c'; gr[2][x] = 'c'; }
      for (let x = 1; x <= L; x++) gr[1][x] = 'a';
      gr[1][L + 1] = 'd';
      return out(gr);
    }
    if (kind === 'serpent') { // long and wiggly
      const L = 6 + r(3), gr = grid(L + 1, 2);
      for (let x = 0; x < L; x++) { const k = Math.floor(x / 2) % 2; gr[k][x] = x % 4 === 0 && r(2) ? 'b' : 'a'; if (x % 2 === 1 && x < L - 1) gr[1 - k][x] = 'a'; } // joined-up wiggles
      gr[0][L] = 'd'; gr[0][L - 1] = 'a';
      return out(gr);
    }
    if (kind === 'fish') { // tail fin, body, eye
      const L = 3 + r(4), h = r(2) ? 4 : 3, gr = grid(L + 2, h);
      gr[0][0] = 'c'; gr[h - 1][0] = 'c'; gr[1][1] = 'c';
      for (let y = 0; y < h; y++) for (let x = 2; x < L + 2; x++) { const edge = y === 0 || y === h - 1; if (!edge || (x > 2 && x < L + 1)) gr[y][x] = 'a'; }
      gr[1][L] = 'd'; if (r(2)) gr[0][Math.floor(L / 2) + 1] = 'b';
      return out(gr);
    }
    if (kind === 'bird') { // wing on top, body, head and beak
      const L = 3 + r(3), gr = grid(L + 2, 3);
      for (let x = 1; x < Math.min(4, L); x++) gr[0][x] = 'b';
      for (let x = 0; x <= L; x++) gr[1][x] = 'a';
      gr[0][L] = 'a'; gr[0][L + 1] = 'c'; // head up front with a beak
      gr[2][Math.floor(L / 2)] = 'c';
      return out(gr);
    }
    if (kind === 'flutter') return r(2) ? ['aa.aa', 'abdba', '.a.a.'] : ['a.a', '.d.', 'a.a']; // big wings
    // A slime: a dome with eyes and a drip or two.
    return r(2) ? ['..aaa..', '.aaaaa.', 'aadadaa', 'aaaaaaa', '.b...b.'] : ['.aaaa.', 'aaaaaa', 'adaada', 'aaaaaa', 'b..b..'];
  }
  // Does the name say what kind of body it has? Then the game draws it, rather than trusting the AI's own sketch.
  const nameSaysBody = (name) => !!lastBody(name.toLowerCase());
  // Turn the AI's answer into a safe material entry (or null if it doesn't make sense).
  const NOT_LIKE = new Set([M.CAULDRON, M.SPARKLE, M.ROCKET, M.WALL, M.PORTALIN, M.PORTALOUT]);
  function likeOk(m) { return isBuiltin(m) && !MATS[m].creature && !MATS[m].object && !MATS[m].reserved && KIND[m] !== K.empty && !NOT_LIKE.has(m); }
  const LIKE_WORDS = [[/thunder ?storm|rain ?storm|storm ?cloud|thunder ?cloud|rain ?cloud/, M.STORM], [/lightning|thunder|\bbolt|\bzap/, M.LIGHTNING], [/plasma/, M.PLASMA],
    [/\blava|magma/, M.LAVA], [/firework/, M.FIREWORK], [/\b(fire|flames?|blaze|inferno)\b/, M.FIRE], [/\bembers?\b/, M.EMBER], [/\bacid/, M.ACID],
    [/bubbles?\b/, M.BUBBLE], [/\bseeds?\b/, M.SEED], [/\bvines?\b/, M.VINE], [/\bslime/, M.SLIME], [/\bhoney/, M.HONEY]];
  function likeFromName(name) { const n = String(name).toLowerCase(); for (const [re, m] of LIKE_WORDS) if (re.test(n)) return m; return 0; }
  const EGG_WORDS = /\b(eggs?|cocoons?|chrysalis|frogspawn)\b/i;
  const isCreatureMat = (m) => m > 0 && m < COUNT && MATS[m] && MATS[m].creature && !MATS[m].reserved && m !== M.EGG && MATS[m].move !== 'egg';
  // What an egg hatches into: what the AI said, else a creature named in the egg's name (Frog Egg -> Frog),
  // else a creature it was brewed from, else a surprise (0).
  function hatchTarget(spec, name, ing) {
    let m = findByName(spec.hatches_into); if (isCreatureMat(m)) return m;
    const n = ' ' + name.toLowerCase() + ' '; let best = 0, len = 0;
    for (let k = 1; k < COUNT; k++) {
      if (!isCreatureMat(k)) continue;
      const cn = MATS[k].name.toLowerCase();
      if (cn.length > len && n.includes(' ' + cn + ' ')) { best = k; len = cn.length; }
    }
    if (best) return best;
    return ing.find(isCreatureMat) || 0;
  }
  function eggEntry(spec, base, cols, name, ing) {
    const into = hatchTarget(spec, name, ing);
    const rows = ['.aa.', 'abaa', 'aaba', '.aa.'];
    const told = spec.movement === 'egg' && cleanText(spec.description, 90);
    const desc = told || (into ? `A little egg. Leave it be and it hatches into a ${MATS[into].name}!` : 'A little egg. Leave it be and see what hatches!');
    return Object.assign(base, { desc, kind: 'creature', density: 1, creature: true, colors: [cols[0], cols[1]], move: 'egg', traits: 'life',
      pal: { a: cols[0], b: cols[1], c: cols[2], d: cols[3] }, ax: 1, ay: 3, sprite: { walk: [rows, rows] }, abil: {}, hatches: into, layEgg: false });
  }
  const ZAP_WORDS = /\b(zap|shock|electr|volt|spark|thunder|lightning|static|tesla)/i;
  const BOOM_WORDS = /\b(explod|explosive|bomb|kaboom|boom|detonat|dynamite|tnt\b|nitro)/i;
  /* Inventions named after a built-in animal borrow its picture (recoloured) and movement. */
  const OLD_MOVES = { [M.FISH]: 'swim', [M.BIRD]: 'fly', [M.WORM]: 'burrow', [M.FIREFLY]: 'flutter', [M.BEE]: 'flutter', [M.FROG]: 'hop',
    [M.ANT]: 'walk', [M.SNAIL]: 'climb', [M.LIZARD]: 'walk', [M.PENGUIN]: 'amphibian', [M.CRAB]: 'wade', [M.DRAGON]: 'fly', [M.COW]: 'walk',
    [M.SNAKE]: 'slither', [M.RABBIT]: 'leap', [M.JELLYFISH]: 'drift', [M.TADPOLE]: 'swim', [M.CATERPILLAR]: 'climb', [M.BUTTERFLY]: 'flutter' };
  const KIN_WORDS = [[/\bslugs?\b/i, M.SNAIL], [/\brats?\b/i, M.MOUSE], [/\b(bull|ox|cattle)\b/i, M.COW], [/\bserpents?\b/i, M.SNAKE],
    [/\bmoths?\b/i, M.BUTTERFLY], [/\bsquids?\b/i, M.OCTOPUS], [/\b(hare|bunny|bunnies)\b/i, M.RABBIT], [/\b(sparrow|crow|raven|robin|finch)s?\b/i, M.BIRD],
    [/\b(toad)s?\b/i, M.FROG], [/\b(wyrm|drake)s?\b/i, M.DRAGON], [/\b(pony|ponies|horse)\b/i, M.UNICORN], [/\bbeetles?\b/i, M.ANT]];
  let KIN_LIST = null;
  function kinCreature(name) {
    if (!KIN_LIST) KIN_LIST = MATS.filter((m, i) => m && isBuiltin(i) && m.creature && m.sprite && m.id !== M.EGG && m.move !== 'egg')
      .sort((x, y) => y.name.length - x.name.length)
      .map((m) => [new RegExp('\\b' + m.name.toLowerCase().replace(/[^a-z ]/g, '') + '(s|es)?\\b', 'i'), m.id]);
    // Only when the animal is the last creature word: a "Toad Bot" is a robot, not a frog.
    const ok = (re) => { const g = new RegExp(re.source, 'gi'); let m, at = -1; while ((m = g.exec(name))) at = m.index; return at >= 0 && at >= lastBodyAt(name.toLowerCase()).at; };
    for (const [re, id] of KIN_LIST) if (re.test(name) && ok(re)) return id;
    for (const [re, id] of KIN_WORDS) if (MATS[id] && MATS[id].sprite && re.test(name) && ok(re)) return id;
    return 0;
  }
  const kinMove = (k) => MATS[k].move || OLD_MOVES[k] || 'walk';
  function borrowLook(k, cols) {
    const src = MATS[k], spr = src.sprite;
    const pose = spr.walk || spr.fly || spr.swim || spr.crawl || spr[Object.keys(spr)[0]];
    const frames = pose.length > 1 ? pose.slice(0, 2) : [pose[0], pose[0]];
    // The biggest patches of colour take the invention's colours; tiny details (eyes, beaks, feet) keep theirs.
    const count = {}; frames[0].join('').replace(/\./g, '').split('').forEach((ch) => { count[ch] = (count[ch] || 0) + 1; });
    const order = Object.keys(count).sort((x, y) => count[y] - count[x]);
    const pal = Object.assign({}, src.pal);
    order.forEach((ch, i) => { if (i < 3 && count[ch] > 2) pal[ch] = cols[i]; });
    return { pal, ax: src.ax, ay: src.ay, sprite: { walk: frames } };
  }
  /* Effects: things an invention does to the world around it, so it can live up to its description.
     The AI may list them; older inventions (and quieter AIs) get them from words in the name and description. */
  const FX_WORDS = {
    wind: /\b(storm|sandstorm|snowstorm|blizzard|tornado|twister|cyclone|hurricane|gales?|gusts?|gusty|whirl|whirlwind|whirling|windy|winds?|breeze|tempest|vortex|swirl|swirling)\b/,
    freeze: /\b(icy|ice|frost|frosty|frozen|freez\w*|glacial|glacier|arctic|polar|chill\w*|cold|frigid|wintry|winter)\b/,
    sparks: /\b(sparks?|electr\w*|lightning|zaps?|shock\w*|volt\w*|thunder\w*|crackl\w*|static|charged)\b/,
    fog: /\b(blind\w*|fog|foggy|mist|misty|haze|hazy|smok\w*|obscur\w*|murk\w*|steamy)\b/,
    burn: /\b(blaz\w*|burn\w*|fiery|flaming|flames|scorch\w*|inferno|ignit\w*|molten)\b/,
    melt: /\b(warm\w*|melts?|melting|heats?|thaw\w*)\b/,
    corrode: /\b(acid\w*|corros\w*|corrod\w*|erod\w*)\b/,
    rain: /\b(rain\w*|drizzl\w*|showers?|downpour|drip\w*)\b/,
    grow: /\b(grows?(?! (\w+ )?crystals?)|growing(?! (\w+ )?crystals?)|spread\w*|multipl\w*|creep\w*|overgrow\w*)\b/,
    plants: /\b(sprout\w*|plant life|(grows?|growing|brings?) (\w+ )?plants?|plants? grow\w*|vegetation|grass\w*|garden\w*|terraform\w*|foliage|greenery|jungle|forest|leafy|vines?)\b/,
    bloom: /\b(bloom\w*|blossom\w*|flowers?|petals?|pollen\w*)\b/,
    web: /\b(webs?|silk\w*|threads?|spins?|spinner|spinning|weav\w*)\b/,
    paint: /\b(paint\w*|colou?rs (the|everything|it)|dyes?|stain\w*|tints?)\b/,
    slime: /\b(slim(e|y)|gooey|ooz(e|es|ing))\b/,
    pull: /\b(pulls?|pulling|gravit\w*|black hole|vacuum\w*|suck\w*|draws? (things |everything )?in)\b/,
    push: /\b(push\w*|repel\w*|force ?field|shockwaves?|knocks? (things )?back|blows? (things )?away)\b/,
    levitate: /\b(levitat\w*|floats? up\w*|hover\w*|anti-?gravity|weightless|lifts? (things|everything))\b/,
    shake: /\b(shak\w*|quak\w*|tremor\w*|rumbl\w*|vibrat\w*|crumbl\w*)\b/,
    petrify: /\b(petrif\w*|turns? (things |everything )?(in)?to stone|fossil\w*|harden\w*|solidif\w*)\b/,
    crystal: /\b(crystalli[sz]\w*|grows? (\w+ )?crystals?|crystal growth|geodes?)\b/,
    rust: /\b(rust\w*|tarnish\w*|oxidi[sz]\w*)\b/,
    heat: /\b(boil\w*|scald\w*|hot springs?|sizzl\w*|heats? up|evaporat\w*|dries|drying)\b/,
    sponge: /\b(absorbs? water|soak\w*|spong\w*|thirsty|dries up)\b/,
    purify: /\b(purif\w*|cleans?\b|cleaning|cleanse\w*|filter\w*|heal\w*)\b/,
    bubbles: /\b(bubbl\w*|fizz\w*|froth\w*|foam\w*)\b/,
    teleport: /\b(teleport\w*|blink\w*|warp\w*|portals?|vanish\w*|disappear\w*|wormholes?)\b/,
    sparkles: /\b(sparkl\w*|glitter\w*|twinkl\w*|shimmer\w*|dazzl\w*)\b/,
    life: /\b(attracts? (bugs|insects|life|butterflies)|brings? life|teem\w*|full of life|life-giving|swarm\w*|fireflies|butterfl\w*)\b/,
    rainbow: /\b(rainbow\w*|prism\w*|colou?rful|multi-?colou?r\w*|aurora\w*|kaleidoscop\w*)\b/,
    vortex: /\b(vortex\w*|whirlpool\w*|spiral\w*|funnel\w*|swirl\w*)\b/,
    orbit: /\b(orbit\w*|circl\w*|revolv\w*|satellites?)\b/,
    bounce: /\b(bounc\w*|springy|boing\w*)\b/,
    pulse: /\b(puls\w*|throb\w*|waves of energy|heartbeat\w*)\b/,
    splash: /\b(splash\w*|spray\w*|splatter\w*|sprinkl\w*)\b/,
    erupt: /\b(erupt\w*|volcan\w*|spew\w*|geysers?)\b/,
    disintegrate: /\b(disintegrat\w*|crumbles? (things|everything)|turns? (things |everything )?(in)?to dust|pulveri[sz]\w*|grinds?)\b/,
    transmute: /\b(transmut\w*|transform\w* (things|everything|nearby)|changes? (things|everything)|alchem\w*)\b/,
    duplicate: /\b(duplicat\w*|cop(y|ies) (things|everything)|clon\w*|replicat\w*)\b/,
    absorb: /\b(absorbs?(?! water)\w*|consum\w*|devour\w*|engulf\w*|eats? (things|everything|anything))\b/,
    dissolve: /\b(dissolv\w*|soluble)\b/,
    liquefy: /\b(liquef\w*|turns? (things |everything )?(in)?to liquid|melts? (stone|rock|everything))\b/,
    contaminate: /\b(contamin\w*|pollut\w*|toxic\w*|poison\w*|taint\w*)\b/,
    decay: /\b(decay\w*|rot(s|ting|ten)?|compost\w*|wither\w*|decompos\w*)\b/,
    ferment: /\b(ferment\w*|yeast\w*)\b/,
    extinguish: /\b(extinguish\w*|douse\w*|puts? out (fire|fires|flames)|smother\w*|quench\w*)\b/,
    condense: /\b(condens\w*|dew\w*|droplets?|collects? water)\b/,
    fungus: /\b(fung\w*|mushroom\w*|mou?ld(y|s)?|spores?|toadstool\w*)\b/,
    regen: /\b(regenerat\w*|restor\w*|reviv\w*|renew\w*|rejuvenat\w*|grows? back|heals? the (land|earth|ground))\b/,
    germinate: /\b(germinat\w*|seedlings?|sow\w*)\b/,
    darkness: /(?<!(lights?|lit|lighting) up (the )?|illuminat\w* (the )?|brighten\w* (the )?|in the |at |by |of the |through the )\b(dark\w*|shadow\w*|gloom\w*|night\w*)\b/,
    magnetize: /\b(magnet\w*)\b/,
    chain: /\b(chain lightning|arc(s|ing)?|jumps? between|conduct\w*|currents?|wires?)\b/,
  };
  const FX_NAMES = Object.keys(FX_WORDS);
  const GLOW_WORDS = /\b(glow\w*|luminous|radiant|lights? up|shin(es|ing|y)|aurora|lamp)\b/;
  // Hand-picked fixes for inventions whose words don't tell the whole story (exact: ignore the word rules).
  const FX_FIXES = {
    'glacial storm': { state: 'powder', calm: true, effects: ['wind', 'freeze', 'sparks', 'fog'] },
    'honey bird': { effects: [], exact: true },          // it slides on ice; it doesn't freeze things
    'toxic sludge': { effects: ['corrode'] },
    'snow petal': { effects: ['freeze'] },
    'snow sand': { effects: ['freeze'] },
    'dewdrop': { effects: ['rain'] },
    'skyburst': { effects: ['sparks'] },
    'fire lizard': { effects: ['burn'] },
    'sweet smoke': { effects: ['fog', 'burn'] },
    'cloud crystal': { effects: ['rain'] },
    'water moss': { effects: ['rain'] },
  };
  const FX_LABEL = { wind: 'wind', freeze: 'frost', sparks: 'sparks', fog: 'fog', burn: 'burns', melt: 'melts ice', corrode: 'corrodes', rain: 'rain', grow: 'spreads', plants: 'sprouts plants', bloom: 'flowers', web: 'webs', paint: 'paints', slime: 'slime', pull: 'pulls things in', push: 'pushes things away', levitate: 'levitates', shake: 'shakes the ground', petrify: 'turns things to stone', crystal: 'grows crystals', rust: 'rusts metal', heat: 'boils water', sponge: 'soaks up water', purify: 'purifies', bubbles: 'bubbles', teleport: 'teleports', sparkles: 'sparkles', life: 'attracts life', rainbow: 'rainbow colours', vortex: 'vortex', orbit: 'orbits', bounce: 'bounces things', pulse: 'pulses', splash: 'splashes', erupt: 'erupts', disintegrate: 'disintegrates', transmute: 'transmutes', duplicate: 'duplicates', absorb: 'absorbs', dissolve: 'dissolves', liquefy: 'liquefies', contaminate: 'contaminates', decay: 'decays', ferment: 'ferments', extinguish: 'puts out fire', condense: 'condenses', fungus: 'mushrooms', regen: 'regenerates', germinate: 'germinates', darkness: 'darkness', magnetize: 'magnetic pull', chain: 'chain lightning', };
  function fxFor(spec, name, desc) {
    const said = (name + ' ' + desc).toLowerCase(), fx = {}, fix = FX_FIXES[String(name).trim().toLowerCase()];
    const listed = (Array.isArray(spec && spec.effects) ? spec.effects : []).concat(fix ? fix.effects : []).map((v) => String(v).toLowerCase());
    FX_NAMES.forEach((k) => { if (listed.includes(k) || (!(fix && fix.exact) && FX_WORDS[k].test(said))) fx[k] = 1; });
    return Object.keys(fx).length ? fx : null;
  }
  function buildEntry(spec, a, b, parts) {
    const fix = spec && FX_FIXES[String(spec.name || '').trim().toLowerCase()];
    if (fix && fix.state) spec = Object.assign({}, spec, { state: fix.state });
    if (fix && fix.calm) spec = Object.assign({}, spec, { properties: (Array.isArray(spec.properties) ? spec.properties : []).filter((p) => p !== 'explosive') });
    const e = buildEntry0(spec, a, b, parts);
    if (!e || e.object || e.kind === 'stamp' || e.move === 'egg') return e;
    const fx = fxFor(spec, e.name, e.desc || '');
    if (!fx) return e;
    // Explosives would set themselves off with their own sparks or flames: they only go off when you bring fire.
    const boomy = (e.props && e.props.volatile) || (e.like && MATS[e.like].props && MATS[e.like].props.volatile);
    if (boomy) { delete fx.sparks; delete fx.burn; delete fx.erupt; delete fx.chain; }
    // Spreading: only solids and powders, and not ones that already grow their own way (that would never stop).
    if (fx.grow && !e.creature) {
      const kind = e.like ? MATS[e.like].kind : e.kind, ownGrow = (e.props && e.props.grows) || (e.like && MATS[e.like].props && MATS[e.like].props.grows);
      if (ownGrow || (kind !== 'solid' && kind !== 'powder')) delete fx.grow;
    }
    if (!Object.keys(fx).length) return e;
    if (e.creature) { if (e.abil && e.abil.zaps) delete fx.sparks; delete fx.grow; if (!Object.keys(fx).length) return e; e.abil.fx = fx; } // creatures don't spread copies of themselves
    else e.fx = fx;
    e.fxText = Object.keys(fx).map((k) => FX_LABEL[k]).join(', ');
    return e;
  }
  function buildEntry0(spec, a, b, parts) {
    if (!spec || typeof spec !== 'object') return null;
    const name = cleanName(spec.name); if (!name) return null;
    const type = ['element', 'creature', 'object'].includes(spec.type) ? spec.type : 'element';
    const cols = (Array.isArray(spec.colors) ? spec.colors : []).filter(hexOk).slice(0, 4);
    while (cols.length < 4) cols.push(['#c8a0ff', '#7a5ad8', '#ffe066', '#2a2040'][cols.length]);
    const desc = cleanText(spec.description, 90) || 'Invented in the Cauldron.';
    const ing = parts && parts.length > 2 ? parts : [a, b];
    const recipe = ing.map((m) => MATS[m].name).join(' + ');
    const has = (list, x) => Array.isArray(list) && list.map((v) => String(v).toLowerCase()).includes(x);
    const base = { key: 'inv-' + normName(name), name, desc, recipe, hint: 'Invented by the Cauldron spirit.', invented: true };
    const rgb = window.SandMats.hex(cols[0]).slice(0, 3);
    // Eggs (and cocoons) sit still and hatch, whatever the AI said about how they move.
    if (spec.movement === 'egg' || (type !== 'object' && EGG_WORDS.test(name))) return eggEntry(spec, base, cols, name, ing);
    if (type === 'creature') {
      // Named after one of the game's own animals ("Frost Owl")? Then it looks and moves like that animal.
      const kin = kinCreature(name);
      const move = kin ? kinMove(kin) : MOVES.includes(spec.movement) ? spec.movement : 'walk';
      // Pixel picture: up to 7 wide and 5 tall, letters a-d are the four colours.
      let rows = Array.isArray(spec.sprite) ? spec.sprite.map((r) => String(r).replace(/[^abcd.]/g, '.').slice(0, 7)).filter((r) => r.length).slice(0, 5) : [];
      let width = Math.max(0, ...rows.map((r) => r.length));
      rows = rows.map((r) => r.padEnd(width, '.'));
      while (rows.length && !/[abcd]/.test(rows[0])) rows.shift();
      while (rows.length && !/[abcd]/.test(rows[rows.length - 1])) rows.pop();
      // A broken drawing, or a copy of the old example: draw it ourselves from the name.
      if (nameSaysBody(name) || rows.join('').replace(/\./g, '').length < 4 || copiedExample(rows)) rows = drawCreature(name, desc, move);
      width = Math.max(...rows.map((r) => r.length)); rows = rows.map((r) => r.padEnd(width, '.'));
      const ground = !['fly', 'flutter', 'swim', 'drift'].includes(move);
      const last = rows.length - 1, rot = (r) => r.slice(1) + r[0];
      const frameB = rows.map((r, i) => (ground ? i === last : i === 0) ? rot(r) : r);
      const ab = spec.abilities;
      const abil = {};
      if (has(ab, 'breathes_fire')) abil.breath = M.FIRE;
      if (has(ab, 'glows')) abil.glow = rgb;
      if (has(ab, 'fireproof') || has(ab, 'breathes_fire')) abil.fireproof = true;
      if (has(ab, 'grazes')) abil.graze = [M.PLANT, M.FLOWER, M.MOSS];
      if (has(ab, 'eats_bugs')) abil.eatsBugs = true;
      if (has(ab, 'eats_fish')) abil.eatsFish = true;
      if (has(ab, 'scared_of_fire')) abil.flee = [];
      if (has(ab, 'leaves_trail')) abil.trail = [has(ab, 'breathes_fire') ? M.SMOKE : M.SPARKLE, 0.04];
      if (has(ab, 'fast')) abil.speed = 1.8; else if (has(ab, 'slow')) abil.speed = 0.5;
      // Zapping and exploding, also when the AI only said so in the name or description.
      const said = name + ' ' + desc;
      if (has(ab, 'zaps') || ZAP_WORDS.test(said)) abil.zaps = true;
      if (has(ab, 'explodes') || BOOM_WORDS.test(said)) abil.explodes = true;
      const traits = ['life', move === 'fly' || move === 'flutter' ? 'air' : move === 'swim' || move === 'wade' ? 'wet' : move === 'burrow' ? 'earth' : '', abil.breath ? 'hot' : '', abil.glow ? 'magic' : '', abil.zaps ? 'metal' : '', abil.explodes ? 'boom' : ''].filter(Boolean).join(' ');
      const out = Object.assign(base, { kind: 'creature', density: 1, creature: true, colors: [cols[0], cols[1]], move, traits,
        pal: { a: cols[0], b: cols[1], c: cols[2], d: cols[3] }, ax: Math.floor(width / 2), ay: ground ? rows.length - 1 : Math.floor(rows.length / 2),
        sprite: { walk: [rows, frameB] }, abil, layEgg: has(ab, 'lays_eggs') });
      if (kin) {
        Object.assign(out, borrowLook(kin, cols));
        // It keeps its family's habits too (an owl still snaps up bugs), plus whatever the AI gave it.
        const fam = MATS[kin].abil || {};
        ['eatsBugs', 'eatsFish', 'graze', 'flee', 'fireproof', 'breath'].forEach((k) => { if (fam[k] !== undefined && out.abil[k] === undefined) out.abil[k] = fam[k]; });
        out.kin = kin;
      }
      return out;
    }
    if (type === 'object') {
      const parts = {};
      (Array.isArray(spec.parts) ? spec.parts : []).forEach((p) => {
        const L = String(p && p.letter || '').slice(0, 1); const m = findByName(p && p.material);
        if (/[a-zA-Z]/.test(L) && m && !MATS[m].creature && !MATS[m].object && KIND[m] !== K.empty) parts[L] = m;
      });
      let rows = (Array.isArray(spec.build) ? spec.build : []).map((r) => String(r).slice(0, 17).split('').map((ch) => (parts[ch] || ch === '_' ? ch : '.')).join('')).slice(0, 12);
      const width = Math.max(0, ...rows.map((r) => r.length)); rows = rows.map((r) => r.padEnd(width, '.'));
      const filled = rows.join('').replace(/[._]/g, '').length, bottom = (rows[rows.length - 1] || '').replace(/[._]/g, '').length;
      // A real build is reasonably wide, solid and stands on the ground. Thin scribbles (like letters) become an element instead.
      // Builds hold together in one piece; separate blobs (like letters of a word) don't count.
      let biggest = 0; const seen = new Set();
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.' || ch === '_' || seen.has(y * 64 + x)) return;
        let n = 0; const stack = [[x, y]]; seen.add(y * 64 + x);
        while (stack.length) { const [cx, cy] = stack.pop(); n++; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = cx + dx, ny = cy + dy, c = rows[ny] && rows[ny][nx]; if (c && c !== '.' && c !== '_' && !seen.has(ny * 64 + nx)) { seen.add(ny * 64 + nx); stack.push([nx, ny]); } }); }
        biggest = Math.max(biggest, n);
      }));
      if (rows.length < 3 || width < 5 || filled < 12 || bottom < 3 || filled / (width * rows.length) < 0.35 || biggest < filled * 0.85) return buildEntry(Object.assign({}, spec, { type: 'element', state: spec.state || 'solid' }), a, b, parts);
      return Object.assign(base, { kind: 'stamp', density: 1, object: true, colors: [cols[0], cols[1]], rows, key2: parts, traits: 'earth' });
    }
    // An element. If it acts like one of the game's own elements (Thunderbolt -> Lightning), it copies
    // that behaviour exactly and keeps its own colours. Older inventions and small models may not say,
    // so a strong word in the name decides.
    const raw = spec.behaves_like, saidNone = raw != null && /^\s*(none|nothing|no)?\s*$/i.test(String(raw));
    let like = raw != null && !saidNone ? findByName(raw) : 0;
    if (!likeOk(like)) like = 0;
    if (!like && raw == null) like = likeFromName(name);
    if (like) return Object.assign(base, { like, colors: [cols[0], cols[1]], hint: 'Invented by the Cauldron spirit. Acts like ' + MATS[like].name + '.',
      skinGlow: (Array.isArray(spec.properties) && spec.properties.includes('glows')) || GLOW_WORDS.test((name + ' ' + desc).toLowerCase()) ? rgb : undefined });
    // A plain element. Small models sometimes leave things out, so fill gaps from the name and description.
    const words = (name + ' ' + desc).toLowerCase();
    const guessState = /\b(gas|mist|fog|smoke|vapou?r|cloud|steam|air)\b/.test(words) ? 'gas' : /\b(liquid|goo|juice|water|syrup|slime|potion|lava|ooze|drip|flows?)\b/.test(words) ? 'liquid'
      : /\b(sand|dust|powder|grains?|crumbs?|ash|glitter|seeds?)\b/.test(words) ? 'powder' : /\b(stone|rock|crystal|crystalline|metal|wall|block|structure|brick|gem|ice)\b/.test(words) ? 'solid' : 'powder';
    const state = STATES.includes(spec.state) ? spec.state : guessState;
    const weight = Math.max(1, Math.min(10, Number(spec.weight) || 5));
    const pr = (Array.isArray(spec.properties) ? spec.properties.slice() : []), props = {};
    const hint = (re, p) => { if (re.test(words) && !pr.includes(p)) pr.push(p); };
    hint(/glow|shin|sparkl|light|lumin|radiant/, 'glows'); hint(/electr|crackl|spark|zap|shock|lightning|thunder/, 'conducts');
    hint(/sticky|glue|gooey/, 'sticky'); hint(/bounc/, 'bouncy'); hint(/explod|boom|blast|bang/, 'explosive'); hint(/magnet/, 'magnetic');
    hint(/burn|flammab|fuel/, 'flammable'); hint(/\bhot\b|blaz|scorch|molten|fiery/, 'hot'); hint(/\bcold\b|frost|freez|icy|chill/, 'cold');
    hint(/\bgrows?\b|sprout|spread/, 'grows'); hint(/melt/, 'melts'); hint(/evaporat|fades? away|vanish/, 'evaporates');
    if (has(pr, 'glows') || GLOW_WORDS.test((name + ' ' + desc).toLowerCase())) props.glow = rgb;
    if (has(pr, 'sticky') && state !== 'gas') props.sticky = true;
    if (has(pr, 'bouncy') && state === 'powder') props.bounce = true;
    if (has(pr, 'magnetic') && state === 'solid') props.magnet = true;
    if (has(pr, 'conducts') && state === 'solid') props.conducts = true;
    if (has(pr, 'explosive') || BOOM_WORDS.test(name + ' ' + desc) || /\bburst\b/i.test(name + ' ' + desc)) props.volatile = true; // bombs really go off
    if (has(pr, 'evaporates') && state !== 'gas') props.evaporates = [state === 'liquid' ? M.STEAM : M.SMOKE, 0.003];
    if (has(pr, 'melts') && (state === 'solid' || state === 'powder')) props.melts = [M.WATER, 0.06];
    if (has(pr, 'freezes') && state === 'liquid') props.freezes = [M.ICE, 0.06];
    if (has(pr, 'grows') && state === 'solid') props.grows = [[M.WATER, M.SEAWATER, 0], 0.012];
    if (has(pr, 'hot')) props.hot = true;
    if (has(pr, 'cold')) props.cold = true;
    const flammable = has(pr, 'flammable') || props.volatile;
    const density = state === 'solid' ? 9 : state === 'gas' ? 0.1 + weight * 0.03 : state === 'liquid' ? 0.6 + weight * 0.15 : 0.8 + weight * 0.6;
    const traits = [state === 'liquid' ? 'wet' : state === 'gas' ? 'air' : 'earth', state === 'powder' ? 'sandy' : '', props.hot ? 'hot' : '', props.cold ? 'cold' : '',
      flammable ? 'fuel' : '', props.volatile ? 'boom' : '', props.glow ? 'magic' : '', props.magnet || props.conducts ? 'metal' : '', props.grows ? 'life' : ''].filter(Boolean).join(' ');
    return Object.assign(base, { kind: state, density, slip: 0.75, spread: state === 'liquid' ? 3 : 0, flam: props.volatile ? 1 : flammable ? 0.3 : 0,
      burn: props.volatile ? 1 : flammable ? 80 : 0, alpha: state === 'liquid' ? 230 : state === 'gas' ? 170 : 255, colors: [cols[0], cols[1]], props, traits });
  }
  // Recipes for 3 and 4 ingredients (only ever made by the AI), keyed by the sorted ids.
  const MULTI = new Map();
  const multiKey = (ids) => ids.slice().sort((x, y) => x - y).join('+');
  const invMax = () => { let n = 0; for (let id = 1; id < COUNT; id++) if (isSlot(id)) n++; return n; };
  const invCount = () => { let n = 0; for (let id = 1; id < COUNT; id++) if (isSlot(id) && !MATS[id].reserved) n++; return n; };
  let slotHint = 1; // where the last free slot was found (slots fill up in order)
  function freeSlot() {
    for (let id = slotHint; id < COUNT; id++) if (isSlot(id) && MATS[id].reserved) { slotHint = id; return id; }
    for (let id = 1; id < slotHint; id++) if (isSlot(id) && MATS[id].reserved) { slotHint = id; return id; }
    return 0;
  }
  // Add an invention to the game (from the AI, or from storage / a backup).
  function registerInvention(rec) {
    const a = rec.a, b = rec.b;
    const parts = Array.isArray(rec.parts) && rec.parts.length > 2 ? rec.parts.slice(0, 4).map(Number) : null; // a 3 or 4 ingredient brew
    const ing = parts || [a, b];
    if (ing.some((m) => !(m > 0 && m < COUNT) || !MATS[m] || MATS[m].reserved)) return 0;
    const same = rec.id ? 0 : findByName(rec.spec && rec.spec.name); // (a saved invention keeps its place even if a built-in later gets the same name)
    if (same) { // the AI named something that already exists
      if (parts) MULTI.set(multiKey(parts), same); else setMagic(a, b, same);
      return same;
    }
    // Objects are out of the game: if the AI still dreams one up (or an old one comes back from the shared
    // store), it becomes a solid element of the same name instead.
    if (!rec.id && rec.spec && rec.spec.type === 'object') rec = Object.assign({}, rec, { spec: Object.assign({}, rec.spec, { type: 'element', state: 'solid', behaves_like: 'none' }) });
    const entry = buildEntry(rec.spec, a, b, parts); if (!entry) return 0;
    const id = isSlot(rec.id) && MATS[rec.id].reserved ? rec.id : freeSlot(); if (!id) return 0;
    if (entry.layEgg) entry.abil.lays = [id, 0.0005];
    invent(id, entry, parts ? 0 : a, parts ? 0 : b);
    if (nameIndex) { const n = normName(MATS[id].name); if (!nameIndex.has(n) || nameIndex.get(n) > id) nameIndex.set(n, id); }
    if (parts) MULTI.set(multiKey(parts), id);
    window.SandSim.refresh(id);
    inventions = inventions.filter((r) => r.id !== id).concat([parts ? { id, a, b, parts, spec: rec.spec } : { id, a, b, spec: rec.spec }]);
    if (entry.object) { // an object invented before they were taken out: kept hidden (things brewed from it still work), but gone from the game
      MATS[id].hidden = true; MATS[id].retired = true; nameIndex = null;
      if (parts) MULTI.delete(multiKey(parts)); else setMagic(a, b, 0);
      return id;
    }
    invCatCache.delete(id);
    // Keep the list in A-Z order by slotting the new one into place (sorting the whole list each time was slow).
    const list = INV_GROUP.items, at = list.indexOf(id); if (at >= 0) list.splice(at, 1);
    let lo = 0, hi = list.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (byName(list[mid], id) <= 0) lo = mid + 1; else hi = mid; }
    list.splice(lo, 0, id);
    return id;
  }
  /* Deleting an invention also deletes anything that was brewed from it,
     clears it out of the world, then reloads so every list is rebuilt. */
  function dependents(id) {
    const gone = new Set([id]);
    for (let grew = true; grew;) {
      grew = false;
      inventions.forEach((r) => {
        if (gone.has(r.id)) return;
        if ((Array.isArray(r.parts) ? r.parts : [r.a, r.b]).some((m) => gone.has(m))) { gone.add(r.id); grew = true; }
      });
    }
    return gone;
  }
  let pendingDelete = 0;
  function askDelete(id) {
    const gone = dependents(id), others = [...gone].filter((m) => m !== id && MATS[m]).map((m) => MATS[m].name);
    pendingDelete = id;
    $('#del-title').textContent = 'Delete ' + MATS[id].name + '?';
    $('#del-text').textContent = 'It will be removed from your book, your toolbar and your world.'
      + (others.length ? ' These were brewed from it, so they go too: ' + others.join(', ') + '.' : '');
    $('#del-confirm').hidden = false;
  }
  function deleteInvention(id) {
    const gone = dependents(id);
    ST.invDeleted += gone.size; saveStats();
    inventions = inventions.filter((r) => !gone.has(r.id));
    saveInventions();
    const w = world, n = w.w * w.h;
    for (let i = 0; i < n; i++) {
      if (gone.has(w.matAt(i)) || gone.has(w.t[i])) { w.t[i] = 0; w.life[i] = 0; w.fuel[i] = 0; if (w.skin) w.skin[i] = 0; }
    }
    w.creatures = w.creatures.filter((c) => !gone.has(c.k) && !gone.has(c.into));
    gone.forEach((m) => { w.discovered[m] = 0; unseen.delete(m); });
    if (gone.has(tool)) tool = M.SAND;
    writeSave();
    restoring = true; // nothing else may save before the reload
    location.reload();
  }
  $('#del-no').addEventListener('click', () => { $('#del-confirm').hidden = true; pendingDelete = 0; });
  $('#del-yes').addEventListener('click', () => { const id = pendingDelete; $('#del-confirm').hidden = true; if (id) deleteInvention(id); });
  function saveInventions() { try { localStorage.setItem(INV_KEY, JSON.stringify(inventions)); } catch (e) { /* storage full or blocked */ } }
  function loadInventions(list) {
    if (!Array.isArray(list)) return;
    // Inventions made from other inventions need their ingredients first, so go round a few times.
    let left = list.slice(0, COUNT);
    for (let pass = 0; pass < 8 && left.length; pass++) {
      const next = [];
      left.forEach((r) => {
        if (!r || typeof r !== 'object' || registerInvention(r)) return;
        if ((Array.isArray(r.parts) ? r.parts : [r.a, r.b]).some((m) => MATS[m] && MATS[m].reserved)) next.push(r);
      });
      if (next.length === left.length) break;
      left = next;
    }
  }
  try { loadInventions(JSON.parse(localStorage.getItem(INV_KEY) || '[]')); } catch (e) { /* ignore a broken list */ }

  // Ask the Worker. Resolves to { spec } or { error }.
  function describe(m) {
    const t = MATS[m];
    return { name: t.name, type: t.creature ? 'creature' : t.object ? 'object' : 'element', about: t.desc || '', kind: t.kind };
  }

  /* ---- Running the AI on this device's GPU (WebGPU + WebLLM) ----
     The model downloads once (cached by the browser) and runs in a background
     thread so the world keeps moving while it thinks. Same instructions and
     answer form as the Worker. */
  const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';
  const LOCAL_MODELS = {
    small: { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Small and quick', size: 'about 0.7 GB download' },
    middle: { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'In-between', size: 'about 1 GB download' },
    better: { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Smarter', size: '1.8 GB, for computers' },
    super: { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC', label: 'Super smart', size: 'about 4.5 GB, computers with 16 GB+' },
  };
  // Phones and tablets never get offered the giant one.
  const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  const AIP = (() => {
    const STATES = ['powder', 'liquid', 'gas', 'solid'];
    const PROPS = ['glows', 'sticky', 'bouncy', 'flammable', 'explosive', 'evaporates', 'melts', 'freezes', 'grows', 'magnetic', 'conducts', 'hot', 'cold'];
    const MOVES = ['walk', 'climb', 'slither', 'wade', 'fly', 'swim', 'hop', 'leap', 'flutter', 'burrow', 'drift', 'egg', 'paddle', 'amphibian'];
    const EFFECTS = ['wind', 'freeze', 'sparks', 'fog', 'burn', 'melt', 'corrode', 'rain', 'grow', 'plants', 'bloom', 'web', 'paint', 'slime', 'pull', 'push', 'levitate', 'shake', 'petrify', 'crystal', 'rust', 'heat', 'sponge', 'purify', 'bubbles', 'teleport', 'sparkles', 'life', 'rainbow', 'vortex', 'orbit', 'bounce', 'pulse', 'splash', 'erupt', 'disintegrate', 'transmute', 'duplicate', 'absorb', 'dissolve', 'liquefy', 'contaminate', 'decay', 'ferment', 'extinguish', 'condense', 'fungus', 'regen', 'germinate', 'darkness', 'magnetize', 'chain'];
    const ABILITIES = ['breathes_fire', 'glows', 'fireproof', 'grazes', 'lays_eggs', 'eats_bugs', 'eats_fish', 'scared_of_fire', 'leaves_trail', 'fast', 'slow', 'zaps', 'explodes'];
    // Built-in elements an invented element can act like.
    const LIKE_NAMES = MATS.filter((m, i) => isBuiltin(i)).filter((m) => m && likeOk(m.id) && !m.hidden).map((m) => m.name);

    const SCHEMA = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        type: { type: 'string', enum: ['element', 'creature'] },
        description: { type: 'string' },
        colors: { type: 'array', items: { type: 'string' } },
        behaves_like: { type: 'string', enum: ['none'].concat(LIKE_NAMES) },
        state: { type: 'string', enum: STATES },
        weight: { type: 'number' },
        properties: { type: 'array', items: { type: 'string', enum: PROPS } },
        movement: { type: 'string', enum: MOVES },
        hatches_into: { type: 'string' },
        abilities: { type: 'array', items: { type: 'string', enum: ABILITIES } },
        effects: { type: 'array', items: { type: 'string', enum: EFFECTS } },
        sprite: { type: 'array', items: { type: 'string' } },
      },
      required: ['name', 'type', 'description', 'colors'],
    };

    const SYSTEM = `You are the Cauldron spirit in Sand Alchemy, a cheerful, family-friendly falling-sand game.
    The player brews two ingredients together. Invent ONE new thing they make. Be playful and imaginative (think Little Alchemy and Infinite Craft),
    but make it feel like it really comes from those two ingredients. It must be something NEW, not just one of the two ingredients.

    Answer with JSON only. Fields:
    - name: 1 to 3 words, Title Case, max 22 characters. No real people, brands or anything scary, violent or rude.
    - type: "element" (a material: powder, liquid, gas or solid) or "creature" (an animal or being that moves).
    - description: one short, fun sentence (max 80 characters) saying what it does in the game. Only describe what it really does with the behaves_like, properties, movement, abilities and effects you pick. Never promise something the game can't do.
    - colors: 2 to 4 hex colours like "#ff8800" that suit it.
    - effects: what it does to the world around it, so the description comes true, from: ${EFFECTS.join(', ')}. (wind = stirs up gusts that blow sand about; freeze = freezes water and makes snow; sparks = crackles with little lightning sparks; fog = gives off fog; burn = sets things alight; melt = melts ice and snow; corrode = eats away nearby things; rain = drips water; grow = slowly spreads itself; plants = sprouts plant life from soil; bloom = makes flowers sprout; web = spins sticky webs; paint = colours what it touches; slime = leaves slime; pull = draws loose things and creatures towards it; push = shoves them away; levitate = makes nearby powders float up; shake = shakes the ground so piles slump and crumble; petrify = turns sand, mud and water to stone; crystal = grows crystals; rust = rusts metal; heat = boils water into steam; sponge = soaks up water; purify = turns acid and swamp into clean water; bubbles = gives off bubbles; teleport = blinks to nearby spots; sparkles = twinkles; life = fireflies, bees or butterflies appear near it; rainbow = paints things in rainbow colours; vortex = whirls the air round it; orbit = flings grains round it; bounce = makes nearby powders hop; pulse = sends out puffs of air; splash = flings nearby liquid; erupt = shoots out embers and lava; disintegrate = breaks solids into sand and dust; transmute = changes nearby things into random elements; duplicate = copies nearby things; absorb = eats nearby grains and grows; dissolve = salt and sugar melt away into water; liquefy = turns stone to lava and melts ice, wax and chocolate; contaminate = turns water to swamp and dirt to mud; decay = rots plants and wood into dirt; ferment = turns sugar, honey and plants into bubbly slime; extinguish = puts out fire; condense = turns steam and fog into water; fungus = grows mushrooms; regen = turns ash green again; germinate = makes seeds sprout; darkness = casts a shadow; magnetize = pulls metal; chain = sparks leap along metal). Use [] if none fit.
    For an element also give:
    - behaves_like: the game element it acts most like, so it really does that in the world (it keeps its own name and colours).
      Choose from: ${LIKE_NAMES.join(', ')}. Examples: Thunderbolt -> Lightning, Magma Goo -> Lava, Frost Flame -> Cold Fire,
      Glitter Sand -> Sand, Jelly Juice -> Slime. Use "none" only if it is a plain material that none of these fit.
    - state: powder (falls and piles), liquid (flows), gas (rises) or solid (stays put).
    - weight: 1 (very light) to 10 (very heavy).
    - properties: any that fit, from: ${PROPS.join(', ')}.
    For a creature also give:
    - movement: one of ${MOVES.join(', ')}. (wade = walks on land and underwater; drift = floats slowly; egg = an egg or cocoon that sits still and hatches; paddle = floats on water like a duck and waddles on land; amphibian = swims all through water like a turtle and walks on land)
    - hatches_into: only for movement "egg": the name of the creature that hatches out (like "Frog" for a Frog Egg).
    - abilities: any that fit, from: ${ABILITIES.join(', ')}.
    - sprite: a tiny side-view pixel picture facing RIGHT, 2 to 5 rows of up to 7 characters. Use letters a, b, c, d for the four colours and "." for empty.
      Draw THIS creature’s own shape (long, round, tall, winged, many-legged...); every creature should look different. Format examples, not to copy: a snail [".bb...", "bbba.d", "aaaaa."], a bat ["a...a", "aabaa", ".a.a."], a robot [".bd.", "caac", ".aa.", ".c.c"]

    Only make a creature when at least one ingredient is alive (an animal, an egg, a spirit or a fairy). Otherwise it is always an element.
    Only ever invent an element or a creature (never a building or object), even when the ingredients are objects or buildings.`;
    // The small on-device models draw builds badly, so they only invent elements and creatures.
    const LOCAL_SCHEMA = JSON.parse(JSON.stringify(SCHEMA));
    LOCAL_SCHEMA.properties.type.enum = ['element', 'creature'];
    // A short question for the on-device models: phones' graphics chips can't cope with a long one.
    const LIKE_SHORT = ['Sand', 'Water', 'Fire', 'Lava', 'Lightning', 'Slime', 'Ice', 'Snow', 'Steam', 'Smoke', 'Oil', 'Acid', 'Gunpowder',
      'Cold Fire', 'Plant', 'Mud', 'Honey', 'Stardust', 'Glowstone', 'Bouncy Balls'].filter((n) => LIKE_NAMES.includes(n));
    const LOCAL_SYSTEM = `You invent ONE new thing for a family-friendly falling-sand game, made from the ingredients. Reply with JSON only.
Element example: {"name":"Glow Moss","type":"element","description":"Moss that glows softly.","colors":["#6aff8a","#2a7a3a"],"state":"powder","weight":3,"properties":["glows","grows"],"behaves_like":"Sand"}
Creature example: {"name":"Ember Fox","type":"creature","description":"A fox with a fiery tail.","colors":["#ff7a2a","#ffd23a","#3a1a0a","#ffffff"],"movement":"walk","abilities":["fireproof"],"sprite":["a...a",".aaab","a.a.a"]}
Rules: name is 1-3 words and NOT one of the ingredients. Mostly elements. A creature only if an ingredient is alive. state: powder, liquid, gas or solid. weight 1-10.
properties from: ${PROPS.join(', ')}. behaves_like from: ${LIKE_SHORT.join(', ')}, none.
movement from: ${MOVES.join(', ')}. abilities from: ${ABILITIES.join(', ')}. effects (what it does to things nearby) from: ${EFFECTS.join(', ')}. sprite: 2-5 rows of up to 7 of a b c d . (a tiny side view).`;
    return { SCHEMA, SYSTEM, LOCAL_SCHEMA, LOCAL_SYSTEM };
  })();
  const local = { engine: null, model: null, loading: null, progress: 0, text: '', cached: {}, error: '' };
  // Phones: read the question in small pieces so the graphics chip never works long enough to be reset.
  const PHONE = /Android|Mobi|iPhone|iPad/i.test(navigator.userAgent) || (navigator.deviceMemory || 8) <= 4;
  local.chunk = PHONE ? 64 : 0;
  let webllm = null;
  async function webllmLib() { if (!webllm) webllm = await import(WEBLLM_URL); return webllm; }
  async function loadLocal() {
    const want = (LOCAL_MODELS[aiSettings.model] || LOCAL_MODELS.small).id;
    if (local.engine && local.model === want) return local.engine;
    if (local.loading) return local.loading;
    local.loading = (async () => {
      const gpu = await gpuCheck();
      if (!gpu.ok) throw new Error(gpu.why);
      useBuildFor(gpu);
      const want = (LOCAL_MODELS[aiSettings.model] || LOCAL_MODELS.small).id;
      if (local.engine && local.model === want) return local.engine;
      const lib = await webllmLib();
      if (local.engine) { try { await local.engine.unload(); } catch (e) { /* ignore */ } local.engine = null; }
      const code = `import * as w from '${WEBLLM_URL}'; const h = new w.WebWorkerMLCEngineHandler(); self.onmessage = (m) => h.onmessage(m);`;
      const thread = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })), { type: 'module' });
      thread.addEventListener('error', (e) => aiLog('Worker thread error: ' + (e.message || e.type)));
      local.thread = thread;
      local.progress = 0; local.error = '';
      aiLog('Starting ' + want + (local.cached[want] ? ' (already downloaded)' : '') + (local.chunk ? ', small pieces of ' + local.chunk : ''));
      let lastLogged = -1;
      // If nothing happens for a while (a phone running out of memory, a dropped connection), give up
      // with a clear message instead of sitting at the same percentage for ever.
      let last = Date.now();
      const watchdog = new Promise((_, fail) => {
        const tick = setInterval(() => {
          if (!local.loading) { clearInterval(tick); return; }
          if (Date.now() - last > 90000) {
            clearInterval(tick); try { thread.terminate(); } catch (e) { /* already gone */ }
            fail(new Error(aiSettings.model !== 'small' ? 'It got stuck. On a phone, try Small and quick (the bigger ones need lots of memory), or use Online.' : 'It got stuck. Check your connection and try again, or use Online.'));
          }
        }, 5000);
      });
      const eng = await Promise.race([lib.CreateWebWorkerMLCEngine(thread, want, {
        initProgressCallback: (r) => {
          last = Date.now(); local.progress = r.progress || 0; local.text = r.text || ''; localProgressUI();
          const step = Math.floor(local.progress * 4); if (step !== lastLogged) { lastLogged = step; aiLog('Loading ' + Math.round(local.progress * 100) + '%: ' + local.text); }
        },
      }, local.chunk ? { prefill_chunk_size: local.chunk, context_window_size: 2048 } : undefined), watchdog]);
      local.engine = eng; local.model = want; local.cached[want] = true; local.progress = 1;
      aiLog('Started OK');
      return eng;
    })();
    try { return await local.loading; }
    catch (e) { local.error = String(e && e.message || e); aiLog('Start FAILED: ' + local.error + (e && e.stack ? ' | ' + String(e.stack).split('\n').slice(0, 3).join(' | ') : '')); throw e; }
    finally { local.loading = null; localProgressUI(); }
  }
  // The question for the AI: every ingredient on its own line.
  function brewQuestion(ids) {
    return ids.map((m, k) => { const d = describe(m); return `Ingredient ${k + 1}: ${d.name} (${d.type}${d.about ? ': ' + d.about : ''})`; }).join('\n') +
      (ids.length > 2 ? `\nWhat ONE new thing do all ${ids.length} make together? Blend the ideas of every ingredient.` : '\nWhat new thing do they make together?') +
      (canMakeLife(ids) ? '' : '\nNone of these ingredients is alive, so it must be an ELEMENT (type "element"), not a creature.');
  }
  // A creature only comes out of the Cauldron when something alive goes in (an animal, an egg, a spirit or a fairy).
  const canMakeLife = (ids) => ids.some((m) => MATS[m] && (MATS[m].creature || m === M.SPIRIT || m === M.FAIRY || m === M.GHOST));
  // The AI made a creature anyway: turn it into an element with the same name, colours and powers.
  function noLifeFrom(spec, ids) {
    if (spec.type !== 'creature' || canMakeLife(ids)) return spec;
    const mv = spec.movement, airy = ['fly', 'flutter', 'drift'].includes(mv), wet = ['swim', 'paddle', 'amphibian', 'wade'].includes(mv);
    const props = [];
    const ab = Array.isArray(spec.abilities) ? spec.abilities : [];
    if (ab.includes('glows')) props.push('glows');
    if (ab.includes('explodes')) props.push('explosive');
    const out = Object.assign({}, spec, { type: 'element', state: airy ? 'gas' : wet ? 'liquid' : 'powder', weight: airy ? 1 : wet ? 4 : 5,
      properties: props, behaves_like: spec.behaves_like || 'none' });
    delete out.movement; delete out.sprite; delete out.abilities; delete out.hatches_into;
    aiLog('It made a creature from things that aren\u2019t alive, so it became an element instead');
    return out;
  }
  // Small models sometimes wrap their JSON in chatter, or run out of room half-way through.
  // Pull out the first {...} and, if it was cut off, close it up so the finished part still counts.
  function looseJSON(text) {
    let s = String(text || '').replace(/```(json)?/gi, '');
    const a = s.indexOf('{'); if (a < 0) return null;
    s = s.slice(a);
    try { return JSON.parse(s.slice(0, s.lastIndexOf('}') + 1)); } catch (e) { /* repair below */ }
    for (let cut = s.length; cut > 1; cut--) {
      let t = s.slice(0, cut).replace(/[\s,:]+$/, '');
      if (/"[^"]*$/.test(t.replace(/\\"/g, '')) && (t.replace(/\\"/g, '').match(/"/g) || []).length % 2) continue; // inside a string
      const stack = []; let inStr = false;
      for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
        if (c === '"') inStr = true; else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']'); else if (c === '}' || c === ']') stack.pop();
      }
      if (inStr) continue;
      try { const o = JSON.parse(t + stack.reverse().join('')); if (o && typeof o === 'object') return o; } catch (e) { /* cut a bit more */ }
      if (s.length - cut > 400) break;
    }
    return null;
  }
  async function askLocal(ids) {
    let eng;
    try { eng = await loadLocal(); } catch (e) { return { error: 'gpu', why: local.error }; }
    const user = brewQuestion(ids);
    aiLog('Brew: ' + ids.map((m) => MATS[m].name).join(' + '));
    // Three ways of asking, from strictest to loosest: some phones' models choke on the strict one.
    // Plain asking first: the strict JSON modes use extra machinery that breaks on some phones
    // ("Object has already been disposed"), and we can read a plain answer ourselves anyway.
    const ways = [
      {},
      { response_format: { type: 'json_object' } },
      { response_format: { type: 'json_object', schema: JSON.stringify(AIP.LOCAL_SCHEMA) } },
    ];
    let why = '', first = '', restarts = 0;
    for (let k = 0; k < ways.length; k++) {
      const way = ways[k];
      try {
        try { await eng.resetChat(); } catch (e) { /* older engines */ }
        const r = await eng.chat.completions.create(Object.assign({
          messages: [{ role: 'system', content: AIP.LOCAL_SYSTEM }, { role: 'user', content: user + '\nAnswer with one JSON object only.' }],
          temperature: 0.8, max_tokens: 700,
        }, way));
        const text = r && r.choices && r.choices[0] && r.choices[0].message ? r.choices[0].message.content : '';
        aiLog('Asked ' + (way.response_format ? (way.response_format.schema ? 'strict' : 'json') : 'plain') + ', got: ' + String(text).slice(0, 300));
        const spec = looseJSON(text);
        if (!spec) { why = 'its answer wasn’t readable'; continue; }
        if (typeof spec.name !== 'string' && typeof spec.Name === 'string') spec.name = spec.Name;
        const nm = normName(spec.name);
        if (!nm || !cleanName(spec.name)) { why = 'it didn’t give a name'; continue; }
        if (ids.some((m) => nm === normName(MATS[m].name))) { why = 'it just named one of the ingredients'; continue; }
        if (!spec.type) spec.type = spec.movement || spec.sprite ? 'creature' : 'element';
        return { spec };
      } catch (e) {
        why = String(e && e.message || e).slice(0, 120); if (!first) first = why;
        aiLog('Asked ' + (way.response_format ? (way.response_format.schema ? 'strict' : 'json') : 'plain') + ', ERROR: ' + String(e && e.message || e) + (e && e.stack ? ' | ' + String(e.stack).split('\n').slice(0, 3).join(' | ') : ''));
        // The phone shut the AI's graphics connection (switching apps, low memory): start it again from
        // the copy already on the phone (no download) and ask the same way once more.
        const crashed = /instance reference|device (was |is )?lost|mapAsync|dispos|destroy/i.test(why);
        if (crashed && restarts >= 1) { aiLog('The graphics chip crashed again; giving up on this phone for now'); return { error: 'gpucrash', why }; }
        if (restarts < 2 && (crashed || /device|webgpu|gpu|memory|abort|null|undefined/i.test(why))) {
          restarts++;
          if (crashed) local.chunk = Math.max(16, Math.floor((local.chunk || 256) / 4)); // even smaller pieces next time
          aiLog('Restarting the AI');
          try { await local.engine.unload(); } catch (e2) { /* already gone */ }
          try { if (local.thread) local.thread.terminate(); } catch (e2) { /* already gone */ }
          local.engine = null; local.model = null; local.thread = null;
          try { eng = await loadLocal(); } catch (e2) { return { error: 'gpu', why: local.error }; }
          k = -1; ways.length = 1; continue; // start again, plain asking only
        }
      }
    }
    return { error: 'failed', why: first && first !== why ? first + ' / ' + why : why };
  }
  // Progress shown both in the book and in the Cauldron while it wakes up.
  function localProgressUI() {
    const pct = Math.round((local.progress || 0) * 100);
    const bar = $('#ai-dl-bar'); if (bar) bar.style.width = pct + '%';
    const st = $('#ai-dl-status');
    if (st) {
      const id = (LOCAL_MODELS[aiSettings.model] || LOCAL_MODELS.small).id;
      st.textContent = local.loading ? `Downloading and starting up… ${pct}%` : local.engine && local.model === id ? 'Ready on this device.'
        : local.error ? 'Couldn’t start the AI on this device. ' + local.error.slice(0, 160) : local.cached[id] ? 'Downloaded. It starts up the first time you brew.' : 'Not downloaded yet.';
    }
    const rm = $('#ai-rm');
    if (rm) { const id = (LOCAL_MODELS[aiSettings.model] || LOCAL_MODELS.small).id; rm.hidden = !(local.cached[id] || (local.engine && local.model === id)) || !!local.loading; }
    const dl = $('#ai-dl'); if (dl) { const ready = !!(local.engine && local.model === (LOCAL_MODELS[aiSettings.model] || LOCAL_MODELS.small).id); dl.hidden = ready; dl.disabled = !!local.loading; dl.textContent = local.loading ? 'Downloading…' : 'Download now'; }
    const sp = document.querySelector('.res.thinking span'); if (sp && local.loading) sp.textContent = `Waking up the Cauldron spirit on your device… ${pct}% (the first time it has to download)`;
  }
  function useBuildFor(gpu) { if (gpu.ok && !gpu.f16) for (const k in LOCAL_MODELS) LOCAL_MODELS[k].id = LOCAL_MODELS[k].id.replace('q4f16_1', 'q4f32_1'); }
  async function checkCached() {
    if (!hasGPU()) return;
    useBuildFor(await gpuCheck());
    try { const lib = await webllmLib(); for (const k in LOCAL_MODELS) local.cached[LOCAL_MODELS[k].id] = await lib.hasModelInCache(LOCAL_MODELS[k].id); } catch (e) { /* offline */ }
    localProgressUI();
  }
  // Delete the selected model's download (asks for a second tap first).
  let rmArmed = 0;
  async function removeLocal() {
    const btn = $('#ai-rm'), m = LOCAL_MODELS[aiSettings.model] || LOCAL_MODELS.small;
    if (Date.now() > rmArmed) { rmArmed = Date.now() + 3000; btn.textContent = `Tap again to remove (${m.size.replace(' download', '')})`; setTimeout(() => { if (Date.now() > rmArmed) btn.textContent = 'Remove this download'; }, 3100); return; }
    rmArmed = 0; btn.textContent = 'Removing…'; btn.disabled = true;
    try {
      if (local.engine && local.model === m.id) { try { await local.engine.unload(); } catch (e) { /* ignore */ } local.engine = null; local.model = null; }
      const lib = await webllmLib(); await lib.deleteModelAllInfoInCache(m.id);
      local.cached[m.id] = false; local.progress = 0; note(`${m.label} model removed. Your game and inventions are untouched.`);
    } catch (e) { note('Couldn\u2019t remove it. Try again in a moment.'); }
    btn.textContent = 'Remove this download'; btn.disabled = false; localProgressUI();
  }
  async function askAI(ids) { return aiSettings.mode === 'device' ? askLocal(ids) : askCloud(ids); }

  // A memory warning under the model picker for the bigger downloads.
  const MEM_NOTES = {
    middle: 'It needs about 1.6 GB of memory while it thinks. It may work on newer phones; if your other apps start closing, use Small and quick or Online.',
    better: 'It needs about 2 GB of memory while it thinks, so it\u2019s for computers only, unless your phone or tablet has plenty of memory. On a phone, pick Small and quick or use Online.',
    super: 'The smartest one you can download. It needs about 5 GB of memory while it thinks, so use it on a computer with 16 GB or more. The first download takes a while, and each brew takes a little longer than the smaller ones.',
  };
  function memNote() { const n = $('#ai-mem-note'), t = MEM_NOTES[aiSettings.model]; n.hidden = !t; if (t) n.textContent = t; }
  // The "Cauldron spirit" box in the discovery book.
  function renderAIBox() {
    $('#ai-on').checked = !!aiSettings.on;
    document.querySelectorAll('input[name="ai-mode"]').forEach((r) => { r.checked = r.value === aiSettings.mode; });
    $('#ai-mode-device').disabled = !hasGPU();
    $('#ai-nogpu').hidden = hasGPU();
    if (window.isSecureContext === false) $('#ai-nogpu').textContent = 'AI on this device only works when the game is opened from its web page (like itch.io), not from a saved file. Online still works.';
    $('#ai-device').hidden = aiSettings.mode !== 'device';
    $('#ai-cloud').hidden = aiSettings.mode === 'device';
    if (IS_MOBILE) { const o = $('#ai-model').querySelector('option[value="super"]'); if (o) o.remove(); if (aiSettings.model === 'super') aiSettings.model = 'better'; }
    $('#ai-model').value = aiSettings.model;
    memNote();
    [...$('#ai-model').options].forEach((o) => { const m = LOCAL_MODELS[o.value]; o.textContent = `${m.label} (${m.size})`; });
    localProgressUI();
    if (aiSettings.mode === 'device' && !local.checked) { local.checked = true; checkCached(); }
    $('#ai-url').value = aiSettings.url || '';
    $('#ai-url').placeholder = AI_DEFAULT_URL || 'https://your-worker.workers.dev';
    const n = inventions.length;
    $('#ai-status').textContent = !aiSettings.on ? 'Switched off. Pairs without a recipe just mix by their traits.' : aiSettings.mode === 'device' ? `On, running on this device.${n ? ` You've invented ${n} thing${n === 1 ? '' : 's'} so far.` : ''}`
      : !aiUrl() ? 'Not connected yet. Add your Worker address below.'
      : `On. Pairs without a recipe invent something new.${n ? ` You've invented ${n} thing${n === 1 ? '' : 's'} so far.` : ''}`;
  }
  function saveAI() { try { localStorage.setItem(AI_KEY, JSON.stringify(aiSettings)); } catch (e) { /* ignore */ } renderAIBox(); }
  $('#ai-on').addEventListener('change', (e) => { aiSettings.on = e.target.checked; saveAI(); });
  document.querySelectorAll('input[name="ai-mode"]').forEach((r) => r.addEventListener('change', () => { if (r.checked) { aiSettings.mode = r.value; saveAI(); } }));
  $('#ai-model').addEventListener('change', (e) => { aiSettings.model = e.target.value; saveAI(); memNote(); });
  $('#ai-rm').addEventListener('click', removeLocal);
  $('#ai-model').addEventListener('change', () => localProgressUI());
  $('#ai-dl').addEventListener('click', () => { loadLocal().then(() => note('The Cauldron spirit is ready on this device!')).catch(() => note('Couldn\u2019t start the AI on this device.')); localProgressUI(); });
  $('#ai-url').addEventListener('change', (e) => { aiSettings.url = e.target.value.trim(); saveAI(); });
  $('#ai-test').addEventListener('click', async () => {
    aiSettings.url = $('#ai-url').value.trim(); saveAI();
    if (!/^https?:\/\//.test(aiUrl())) { note('The address should start with https://'); return; }
    try { const r = await fetch(aiUrl() + '/', { cache: 'no-store' }); const j = await r.json(); note(j && j.ok ? `Connected! ${j.left != null ? j.left + ' new inventions left today.' : ''}` : 'That address answered, but not like a Sand Alchemy Worker.'); }
    catch (e) { note('Couldn\u2019t reach that address.'); }
  });
  async function askCloud(ids) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 25000);
    try {
      const body = { v: 2, a: describe(ids[0]), b: describe(ids[1]), items: ids.map(describe) };
      const r = await fetch(aiUrl() + '/invent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return { error: j.error || 'busy' };
      if (ids.length > 2 && j.n !== ids.length) return { error: 'oldworker' }; // an older Worker only looked at the first two
      return { spec: j.spec };
    } catch (e) { return { error: 'offline' }; } finally { clearTimeout(timer); }
  }
  // Up to four ingredients. The first two always show; 3 and 4 add slots underneath.
  const KEYS = ['a', 'b', 'c', 'd'], NTH = ['first', 'second', 'third', 'fourth'];
  const slots = [0, 0, 0, 0], locks = [false, false, false, false];
  let nSlots = 2;
  try { nSlots = Math.max(2, Math.min(4, Number(localStorage.getItem('sandalchemy.brewn')) || 2)); } catch (e) { /* default */ }
  const used = () => slots.slice(0, nSlots);
  let keepResult = false; // an invention finished while the Cauldron was closed: show it when it opens again
  function openBrew() {
    // Still thinking, or an answer came back while it was closed: open it just as it was.
    if (thinking || keepResult) {
      keepResult = false;
      resetSearch($('#ing-search')); renderIngredients(); renderSlots();
      $('#brew').hidden = false; return;
    }
    // Locked ingredients stay in place between brews; unlocked ones start fresh.
    for (let k = 0; k < 4; k++) if (!locks[k]) slots[k] = 0;
    $('#brew-result').innerHTML = '';
    resetSearch($('#ing-search'));
    renderIngredients(); renderSlots();
    $('#brew').hidden = false;
  }
  function setCount(n) {
    nSlots = n; try { localStorage.setItem('sandalchemy.brewn', String(n)); } catch (e) { /* fine */ }
    for (let k = n; k < 4; k++) { slots[k] = 0; locks[k] = false; }
    $('#brew-result').innerHTML = '';
    renderSlots(); markPicked();
  }
  document.querySelectorAll('.count-btn').forEach((b) => b.addEventListener('click', () => { if (!thinking) setCount(Number(b.dataset.n)); }));
  function renderIngredients() {
    const g = $('#ing-grid'); g.innerHTML = '';
    shelfGroups().forEach((grp) => {
      const items = grp.items.filter((m) => world.discovered[m]);
      if (items.length) g.append(groupLabel(grp.label, 'ing-section'));
      items.forEach((m) => addIngredient(g, m));
    });
    const none = document.createElement('p'); none.className = 'no-match'; none.hidden = true; none.textContent = 'No ingredients match that.'; g.append(none);
    runIngSearch(norm($('#ing-search').value));
  }
  function runIngSearch(q) {
    const g = $('#ing-grid'), none = g.querySelector('.no-match');
    const n = filterGrid(g, q, (el) => el.tagName === 'H3' || el === none);
    if (none) none.hidden = !q || n > 0;
  }
  hookSearch($('#ing-search'), runIngSearch);
  function addIngredient(g, m) {
    {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ing' + (slots.slice(0, nSlots).includes(m) ? ' picked' : ''); b.dataset.m = m;
      const sw = document.createElement('i'); sw.className = 'sw'; sw.setAttribute('style', swatchStyle(m));
      const s = document.createElement('span'); s.textContent = MATS[m].name; if (MATS[m].name.split(' ').some((p) => p.length > 10)) s.className = 'long';
      b.append(sw, s);
      b.addEventListener('click', () => pickIngredient(m));
      g.append(b);
    }
  }
  function markPicked() { document.querySelectorAll('.ing').forEach((b) => b.classList.toggle('picked', used().includes(Number(b.dataset.m)))); }
  function pickIngredient(m) {
    const at = used().indexOf(m);
    if (at >= 0) { if (locks[at]) return nudgeLock(KEYS[at]); slots[at] = 0; } // tap again to take it out
    else {
      const empty = used().findIndex((v, k) => !v && !locks[k]);
      if (empty >= 0) slots[empty] = m;
      else {
        // All full: the unlocked ones shuffle along and the newest goes in the last free place.
        const open = []; for (let k = 0; k < nSlots; k++) if (!locks[k]) open.push(k);
        if (!open.length) return nudgeLock(...KEYS.slice(0, nSlots));
        for (let q = 0; q < open.length - 1; q++) slots[open[q]] = slots[open[q + 1]];
        slots[open[open.length - 1]] = m;
      }
    }
    $('#brew-result').innerHTML = '';
    renderSlots(); markPicked();
  }
  // The dice: fill the unlocked slots with random ingredients you've found.
  function randomPick() {
    if (thinking) return;
    ST.randoms++;
    const open = []; for (let k = 0; k < nSlots; k++) if (!locks[k]) open.push(k);
    if (!open.length) return nudgeLock(...KEYS.slice(0, nSlots));
    const pool = [...new Set(GROUPS.flatMap((grp) => grp.items))].filter((m) => world.discovered[m]);
    if (pool.length < nSlots) return;
    open.forEach((k) => { slots[k] = 0; });
    open.forEach((k) => { let m; do { m = pool[ri(pool.length)]; } while (used().includes(m)); slots[k] = m; });
    $('#brew-result').innerHTML = '';
    renderSlots(); markPicked();
    const d = $('#brew-random'); d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll');
    open.forEach((k) => { const s = $('#slot-' + KEYS[k]); s.classList.remove('rolled'); void s.offsetWidth; s.classList.add('rolled'); });
  }
  $('#brew-random').addEventListener('click', randomPick);
  function nudgeLock(...keys) {
    keys.forEach((k) => { const l = $('#lock-' + k); l.classList.remove('nudge'); void l.offsetWidth; l.classList.add('nudge'); });
  }
  function toggleLock(k) { if (!slots[k]) return; locks[k] = !locks[k]; renderSlots(); }
  function renderSlots() {
    $('#wrap-c').hidden = nSlots < 3; $('#wrap-d').hidden = nSlots < 4; $('#slot-grid').classList.toggle('big', nSlots > 2);
    document.querySelectorAll('.count-btn').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.n) === nSlots)));
    $('#brew-lede').textContent = nSlots === 2 ? 'Pick two ingredients, then press Brew. Tap a lock to keep one in place.'
      : `Pick ${nSlots === 3 ? 'three' : 'four'} ingredients, then press Brew. Bigger brews can turn out amazing\u2026 or a bit broken!`;
    const firstEmpty = used().findIndex((v) => !v);
    for (let k = 0; k < 4; k++) {
      if (!slots[k]) locks[k] = false;
      const key = KEYS[k], m = slots[k], on = locks[k], l = $('#lock-' + key), el = $('#slot-' + key);
      l.hidden = !m; l.classList.toggle('on', on); l.setAttribute('aria-pressed', String(on));
      l.setAttribute('aria-label', (on ? 'Unlock' : 'Lock') + ' the ' + NTH[k] + ' ingredient');
      el.classList.toggle('locked', on);
      el.innerHTML = '';
      el.classList.toggle('filled', !!m);
      el.classList.toggle('next', !m && k === firstEmpty);
      if (m) {
        const sw = document.createElement('i'); sw.className = 'sw'; sw.setAttribute('style', swatchStyle(m));
        const s = document.createElement('span'); s.textContent = MATS[m].name;
        el.append(sw, s);
      } else el.textContent = k === 0 ? 'Pick one' : k === 1 ? 'Pick another' : 'And another';
    }
    $('#brew-go').disabled = used().some((v) => !v) || thinking;
  }
  /* What two things make when they touch in the world. Most come straight
     from the reaction table; a few world behaviours are listed by hand. */
  const WORLD_PAIRS = [
    [M.SAND, M.WATER, M.MUD], [M.MUD, M.WATER, M.PLANT], [M.DIRT, M.WATER, M.PLANT],
    [M.PLANT, M.FIRE, M.ASH], [M.WOOD, M.FIRE, M.ASH], [M.PLANT, M.LAVA, M.ASH], [M.WOOD, M.LAVA, M.ASH],
    [M.OIL, M.FIRE, M.SMOKE], [M.PLANT, M.SAND, M.OIL], [M.PLANT, M.DIRT, M.OIL], [M.PLANT, M.MUD, M.OIL],
    [M.WOOD, M.SAND, M.OIL], [M.WOOD, M.DIRT, M.OIL], [M.WOOD, M.MUD, M.OIL], [M.STEAM, M.CLOUD, M.CLOUD],
  ];
  function worldProducts(a, b) {
    const out = new Set();
    [[a, b], [b, a]].forEach(([x, y]) => (rxOf(x, y) || []).forEach((r) => {
      [r.a, r.b, r.alt && r.alt.a].forEach((m) => { if (m > 0 && m !== x && m !== y) out.add(m); });
    }));
    WORLD_PAIRS.forEach(([x, y, m]) => { if ((x === a && y === b) || (x === b && y === a)) out.add(m); });
    return [...out];
  }
  function useButton(m) {
    const use = document.createElement('button'); use.type = 'button'; use.className = 'use'; use.textContent = 'Use it';
    use.addEventListener('click', () => { pick(m); $('#brew').hidden = true; scrollToTool(m); });
    return use;
  }
  let thinking = false;
  const listNames = (ids) => { const n = ids.map((m) => MATS[m].name); return n.length < 3 ? n.join(' and ') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1]; };
  /* Without the AI, a big brew mixes in order: the first two, then that result with the
     next one, and so on. Each step uses a recipe, then what they make in the world, then
     plain trait mixing. Returns the steps so the player can see how it went. */
  function chainMix(ids) {
    let cur = ids[0], fromRecipe = true; const steps = [];
    for (let k = 1; k < ids.length; k++) {
      const nx = ids[k];
      let out = magic(cur, nx), how = 'recipe';
      if (!out) { const wp = worldProducts(cur, nx); if (wp.length) { out = wp[0]; how = 'world'; } }
      if (!out) { const t = traitMix(cur, nx); if (t < 0) return { steps, end: 'void', at: nx }; if (t > 0) { out = t; how = 'mix'; } }
      if (!out) return { steps, end: 'fizzle', at: nx, cur };
      if (how !== 'recipe') fromRecipe = false;
      steps.push({ with: nx, out, how }); cur = out;
    }
    return { steps, end: 'ok', out: cur, fromRecipe: steps.length && steps[steps.length - 1].how === 'recipe' };
  }
  function brew(noAI) {
    if (used().some((v) => !v) || thinking) return;
    if (nSlots > 2) return brewMany(noAI);
    const slotA = slots[0], slotB = slots[1];
    const out = magic(slotA, slotB);
    // No recipe and nothing they make in the world: ask the Cauldron spirit to invent something.
    if (!out && noAI !== true && aiReady() && !worldProducts(slotA, slotB).length && traitMix(slotA, slotB) >= 0) { inventFor([slotA, slotB]); return; }
    const res = document.createElement('div'); res.className = 'res';
    const sw = document.createElement('i'); sw.className = 'sw';
    const txt = document.createElement('div');
    const small = document.createElement('small'), b = document.createElement('b'), s = document.createElement('span');
    txt.append(small, b, s);
    const A = MATS[slotA].name, B = MATS[slotB].name;
    if (out) {
      const isNew = !world.discovered[out];
      res.classList.add(isNew ? 'win' : 'known');
      sw.setAttribute('style', swatchStyle(out));
      small.textContent = isNew ? 'New discovery!' : 'Already discovered';
      b.textContent = MATS[out].name;
      s.textContent = isNew ? (MATS[out].desc || 'Added to your toolbar.') : `${A} + ${B} brews ${MATS[out].name}. It's already in your toolbar.`;
      if (MATS[out].invented) { small.textContent = isNew ? '\u2728 New invention!' : 'Already invented'; if (isNew) res.classList.add('invent'); else ST.invRepeat++; }
      if (isNew) { world.discovered[out] = 1; discovered(out); }
      res.append(sw, txt, useButton(out));
      renderIngredients();
    } else {
      const made = worldProducts(slotA, slotB);
      const known = made.filter((m) => world.discovered[m]);
      if (known.length) {
        // Show what this pair makes that's already found, and hint at any secret left.
        const secret = made.length - known.length;
        res.classList.add('known');
        sw.setAttribute('style', swatchStyle(known[0]));
        small.textContent = 'Already discovered';
        b.textContent = known.map((m) => MATS[m].name).join(' & ');
        s.textContent = `${A} and ${B} make ${known.length > 1 ? 'these' : 'this'} when they touch in the world.` +
          (secret ? ` They can make ${secret > 1 ? 'more things' : 'one more thing'} you haven't found yet. Keep experimenting!` : '');
        res.append(sw, txt, useButton(known[0]));
      } else if (made.length) {
        sw.className = 'sw unknown'; sw.textContent = '!';
        small.textContent = 'Not a brew';
        b.textContent = 'Try it in the world';
        s.textContent = `${A} and ${B} make something new when they touch. Mix them in your world!`;
        res.append(sw, txt);
      } else if (traitMix(slotA, slotB) > 0 && world.discovered[traitMix(slotA, slotB)]) {
        // No recipe of its own, but the two still mix into something sensible.
        const mix = traitMix(slotA, slotB);
        res.classList.add('known');
        sw.setAttribute('style', swatchStyle(mix));
        small.textContent = 'Mixed into';
        b.textContent = MATS[mix].name;
        s.textContent = `${A} and ${B} mix into ${MATS[mix].name}.`;
        res.append(sw, txt, useButton(mix));
      } else if (traitMix(slotA, slotB) > 0) {
        sw.className = 'sw unknown'; sw.textContent = '…';
        small.textContent = 'Something stirs…';
        b.textContent = 'Not yet';
        s.textContent = `${A} and ${B} would mix into something you haven't found yet. Keep exploring!`;
        res.append(sw, txt);
      } else if (traitMix(slotA, slotB) < 0) {
        sw.className = 'sw'; sw.setAttribute('style', swatchStyle(M.VOID));
        small.textContent = 'Swallowed';
        b.textContent = 'Into the Void';
        s.textContent = 'The Void swallowed it whole. Nothing comes back out.';
        res.append(sw, txt);
      } else {
        sw.className = 'sw unknown'; sw.textContent = '?';
        small.textContent = 'Nothing happened';
        b.textContent = 'Just a fizzle…';
        s.textContent = 'These two don\'t make anything new together. Try another pair.';
        res.append(sw, txt);
      }
    }
    const r = $('#brew-result'); r.innerHTML = ''; r.append(res);
    brewSound(res);
  }
  // A little sound for each kind of result (new discoveries get the chime from their pop-up).
  function brewSound(card) {
    if (!card) return;
    {
      const w = (card.querySelector('small') || {}).textContent || '';
      statBrew(card.classList.contains('win') ? 'new' : /Swallowed/.test(w) ? 'void' : /Nothing happened|Not a brew|Something stirs/.test(w) ? 'fizzle' : 'known', used());
    }
    if (card.classList.contains('win')) return;
    const what = (card.querySelector('small') || {}).textContent || '';
    if (/Swallowed/.test(what)) SND.swallowed(); else if (/Nothing happened/.test(what)) SND.fizzle(); else SND.brewed();
  }
  function resultCard(m, small, title, text, extra) {
    const res = document.createElement('div'); res.className = 'res';
    const sw = document.createElement('i'); sw.className = 'sw';
    const txt = document.createElement('div');
    const sm = document.createElement('small'), b = document.createElement('b'), s = document.createElement('span');
    sm.textContent = small; b.textContent = title; s.textContent = text; txt.append(sm, b, s);
    if (extra) { const c = document.createElement('span'); c.className = 'chain'; c.textContent = extra; txt.append(c); }
    if (m > 0) sw.setAttribute('style', swatchStyle(m)); else { sw.className = 'sw unknown'; sw.textContent = m === -1 ? '\u2026' : '?'; }
    res.append(sw, txt);
    if (m > 0 && world.discovered[m]) res.append(useButton(m));
    return res;
  }
  function brewMany(noAI) {
    const ids = used(), key = multiKey(ids);
    const known = MULTI.get(key);
    if (!known && noAI !== true && aiReady()) { inventFor(ids); return; }
    const r = $('#brew-result'); r.innerHTML = '';
    if (known) {
      const isNew = !world.discovered[known];
      if (isNew) { world.discovered[known] = 1; discovered(known); }
      const card = resultCard(known, isNew ? '\u2728 New invention!' : 'Already invented', MATS[known].name, isNew ? (MATS[known].desc || 'Added to your toolbar.') : `${listNames(ids)} brew ${MATS[known].name}.`);
      card.classList.add(isNew ? 'win' : 'known'); if (isNew) card.classList.add('invent');
      r.append(card); brewSound(card); renderIngredients(); return;
    }
    // Mix them in order and show how it went.
    const c = chainMix(ids);
    const trail = c.steps.map((st, k) => (k ? '+ ' : MATS[ids[0]].name + ' + ') + `${MATS[st.with].name} \u2192 ${MATS[st.out].name}`)
      .concat(c.end === 'ok' || !c.at ? [] : [`+ ${MATS[c.at].name} \u2192 ${c.end === 'void' ? 'swallowed!' : 'fizzle'}`]).join('\n');
    if (c.end === 'void') { const card = resultCard(M.VOID, 'Swallowed', 'Into the Void', `The Void swallowed the whole brew when ${MATS[c.at].name} went in.`, trail); r.append(card); brewSound(card); return; }
    if (c.end === 'fizzle') { const card = resultCard(0, 'Nothing happened', 'Just a fizzle\u2026', `It all fizzled out when ${MATS[c.at].name} went in.`, trail); r.append(card); brewSound(card); return; }
    const out = c.out, isNew = !world.discovered[out];
    if (isNew && !c.fromRecipe) { r.append(resultCard(-1, 'Something stirs\u2026', 'Not yet', `This brew is heading towards something you haven't found yet. Keep exploring!`, trail)); return; }
    if (isNew) { world.discovered[out] = 1; discovered(out); }
    const card = resultCard(out, isNew ? 'New discovery!' : 'Brewed into', MATS[out].name, isNew ? (MATS[out].desc || 'Added to your toolbar.') : `${listNames(ids)} brew into ${MATS[out].name}, one step at a time.`, trail);
    card.classList.add(isNew ? 'win' : 'known');
    r.append(card); brewSound(card); if (isNew) renderIngredients();
  }
  async function inventFor(ids) {
    const r = $('#brew-result');
    if (!freeSlot()) { // no room for another invention: say so, and don't spend one of today's AI inventions
      renderSlots(); brew(true);
      const n = document.createElement('p'); n.className = 'ai-note';
      n.textContent = `Your invention book is full (${invCount()} of ${invMax()}). Delete an invention with its \u00d7 in the book to make room. Here\u2019s a normal mix instead.`;
      r.append(n); return;
    }
    thinking = true; $('#brew-go').disabled = true; SND.bubbling(true);
    r.innerHTML = '<div class="res thinking"><i class="sw brewing"></i><div><small>The Cauldron bubbles\u2026</small><b>Inventing something new</b><span>The Cauldron spirit is dreaming up what ' +
      escapeHtml(listNames(ids)) + ' make together.</span></div></div>';
    const askedAt = performance.now(); ST.aiReq++;
    const got = await askAI(ids);
    let id = 0; const invBefore = inventions.length;
    if (got.spec) got.spec = noLifeFrom(got.spec, ids);
    if (got.spec) { id = registerInvention({ a: ids[0], b: ids[1], parts: ids.length > 2 ? ids.slice() : undefined, spec: got.spec }); if (id) { saveInventions(); renderPalette(); writeSaveSoon(); } }
    thinking = false; SND.bubbling(false);
    if (inventions.length > invBefore) { statInvention(); ST.aiOk++; ST.aiMs += performance.now() - askedAt; if (aiSettings.mode === 'device') ST.aiDevice++; else ST.aiOnline++; }
    if (multiKey(used()) !== multiKey(ids) || used().length !== ids.length) { // they picked something else meanwhile
      if (id && !world.discovered[id]) { world.discovered[id] = 1; discovered(id); }
      renderSlots(); return;
    }
    renderSlots();
    brew(true);
    if ($('#brew').hidden) keepResult = true; // they closed the Cauldron while it was thinking
    if (!id) {
      const why = got.error === 'limit' ? 'The Cauldron spirit is resting for today (daily limit reached). It wakes up again at ' + new Date(new Date().setUTCHours(24, 0, 0, 0)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.' : got.error === 'gpucrash' ? 'Your phone\u2019s graphics chip crashed while the AI was thinking, so the on-device AI may not work on this phone. Online works on every device.'
        : got.error === 'gpu' ? (/compatible GPU/i.test(got.why || '') ? 'The browser has switched off the graphics chip after a crash. Close the browser completely (swipe it away) and open the game again.' : 'Couldn\u2019t start the AI on this device' + (got.why ? ' (' + String(got.why).slice(0, 140) + ')' : '') + '. The Debug log in Settings has the details.')
        : got.error === 'offline' ? 'Couldn\u2019t reach the Cauldron spirit (offline?).' : got.error === 'oldworker' ? 'Your Worker needs updating to invent 3 or 4 ingredient brews.' : 'The Cauldron spirit couldn\u2019t think of anything this time' + (got.why ? ' (' + got.why + ')' : '') + '.';
      const n = document.createElement('p'); n.className = 'ai-note'; n.textContent = why + ' Here\u2019s a normal mix instead.';
      $('#brew-result').append(n);
    }
  }
  function escapeHtml(t) { return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function scrollToTool(m) {
    const b = document.querySelector(`.mat[data-m="${m}"]`);
    if (b) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
  $('#btn-pot').addEventListener('click', openBrew);
  $('#brew-close').addEventListener('click', () => { $('#brew').hidden = true; });
  $('#brew-go').addEventListener('click', () => brew());
  KEYS.forEach((key, k) => {
    $('#slot-' + key).addEventListener('click', () => { if (slots[k]) pickIngredient(slots[k]); });
    $('#lock-' + key).addEventListener('click', () => toggleLock(k));
  });

  /* ---------------- Backup & restore ----------------
     The whole save as one text code: "SAND1." + base64url(gzip(JSON)),
     or "SAND0." + base64url(JSON) where the browser can't compress. */
  const Backup = {
    toB64(bytes) {
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    fromB64(str) {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) str += '=';
      const bin = atob(str), out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    },
    async pipe(bytes, stream) {
      return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
    },
    async encode() {
      const raw = new TextEncoder().encode(JSON.stringify({ app: 'sandalchemy', savedAt: new Date().toISOString(), data: buildSave() }));
      if (window.CompressionStream) {
        try { return 'SAND1.' + this.toB64(await this.pipe(raw, new CompressionStream('gzip'))); } catch (e) { /* fall through */ }
      }
      return 'SAND0.' + this.toB64(raw);
    },
    async decode(code) {
      code = String(code || '').replace(/\s+/g, '');
      if (/^H4sI[A-Za-z0-9_-]+$/.test(code)) code = 'SAND1.' + code; // only the "SAND1." label went missing
      const m = /^SAND([01])\.([A-Za-z0-9_-]+)$/.exec(code);
      if (!m) throw new Error(/^[A-Za-z0-9_-]{40,}$/.test(code) ? 'The start of this backup code is missing (it should begin with SAND1.). Copy it again, or use Save backup file and Open backup file instead.' : 'That doesn\u2019t look like a Sand Alchemy backup. Make sure you copied all of it.');
      let bytes;
      try {
        bytes = this.fromB64(m[2]);
        if (m[1] === '1') {
          if (!window.DecompressionStream) throw new Error('old');
          bytes = await this.pipe(bytes, new DecompressionStream('gzip'));
        }
      } catch (e) {
        throw new Error(e.message === 'old' ? 'This browser is too old to read this backup. Try updating it.' : 'This backup is damaged. Make sure you copied all of it.');
      }
      let obj;
      try { obj = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { throw new Error('This backup is damaged. Make sure you copied all of it.'); }
      if (!obj || obj.app !== 'sandalchemy' || !obj.data || !Array.isArray(obj.data.disc)) throw new Error('This backup is damaged or from a different game.');
      return obj;
    },
    fileName() { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `sand-alchemy-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.txt`; },
  };
  function note(msg) { // a short message that shows above everything, even the book
    let n = $('#note'); if (!n) { n = document.createElement('div'); n.id = 'note'; n.className = 'note'; n.setAttribute('role', 'status'); document.body.append(n); }
    n.textContent = msg; n.classList.add('on');
    clearTimeout(note.t); note.t = setTimeout(() => n.classList.remove('on'), 3600);
  }
  $('#to-backup').addEventListener('click', () => { $('#book').hidden = true; openSettings(); });
  $('#backup-copy').addEventListener('click', async () => {
    const box = $('#backup-code');
    let code; try { code = await Backup.encode(); } catch (e) { note('Could not make a backup on this device.'); return; }
    box.value = code;
    const copied = () => { box.hidden = true; note('Backup code copied. Paste it into Notes or a message to yourself.'); };
    try { if (!navigator.clipboard) throw new Error('none'); await navigator.clipboard.writeText(code); copied(); return; } catch (e) { /* try the old way */ }
    // Pages opened as a saved file can't use the clipboard API, but the older copy command still works there.
    box.hidden = false; box.removeAttribute('readonly'); box.focus(); box.select(); box.setSelectionRange(0, code.length);
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    box.setAttribute('readonly', '');
    if (ok) copied(); else note('Copy ALL of this code (it starts with SAND), or use Save backup file instead.');
  });
  $('#backup-file').addEventListener('click', async () => {
    let code; try { code = await Backup.encode(); } catch (e) { note('Could not make a backup on this device.'); return; }
    const file = new File([code], Backup.fileName(), { type: 'text/plain' });
    try {
      // Phones: the share sheet offers Save to Files, AirDrop, Messages and so on.
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Sand Alchemy backup' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = Backup.fileName();
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    note('Backup file saved.');
  });
  let pendingRestore = null;
  async function restoreFrom(code) {
    let obj; try { obj = await Backup.decode(code); } catch (e) { note(e.message); return; }
    pendingRestore = obj.data;
    const n = obj.data.disc.filter((m) => m > 0 && m < COUNT && !MATS[m].hidden).length;
    const when = obj.savedAt ? new Date(obj.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'an unknown date';
    $('#restore-info').textContent = `Backup from ${when}: ${n} of ${ORDER.length} discovered${obj.data.world ? ', with its world' : ''}.`;
    $('#restore-confirm').hidden = false;
  }
  $('#restore-go').addEventListener('click', () => {
    const v = $('#restore-code').value.trim();
    if (!v) { note('Paste a backup code first.'); $('#restore-code').focus(); return; }
    restoreFrom(v);
  });
  $('#restore-file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 8e6) { note('That file is too big to be a backup.'); return; }
    restoreFrom(await f.text());
  });
  $('#restore-no').addEventListener('click', () => { pendingRestore = null; $('#restore-confirm').hidden = true; });
  $('#restore-yes').addEventListener('click', () => {
    if (!pendingRestore) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(pendingRestore));
      localStorage.setItem(INV_KEY, JSON.stringify(Array.isArray(pendingRestore.inv) ? pendingRestore.inv : []));
      localStorage.setItem(FAV_KEY, JSON.stringify(Array.isArray(pendingRestore.favs) ? pendingRestore.favs : favs)); // a backup brings its favorites
      localStorage.setItem(RECENT_KEY, JSON.stringify(Array.isArray(pendingRestore.recent) ? pendingRestore.recent : recent));
    }
    catch (e) { note('This browser won\u2019t let the game save, so it can\u2019t restore here.'); $('#restore-confirm').hidden = true; return; }
    restoring = true; // don't let the current world overwrite it on the way out
    location.reload();
  });

  /* ---------------- Undo ----------------
     A snapshot of the world is kept before each stroke, line, removal or
     clear (the last 15). Undo puts the world back as it was just before. */
  const undoStack = [];
  function snapshot() {
    undoStack.push({ w: world.w, h: world.h, t: world.exportT(), l: world.life.slice(), f: world.fuel.slice(),
      c: world.creatures.map((c) => Object.assign({}, c)) });
    if (undoStack.length > 15) undoStack.shift();
    $('#btn-undo').disabled = false;
  }
  function undo() {
    let s;
    ST.undos++; if (performance.now() - lastBoomAt < 2000) ST.oops++;
    while ((s = undoStack.pop()) && (s.w !== world.w || s.h !== world.h)) { /* skip snapshots from before a resize */ }
    $('#btn-undo').disabled = !undoStack.length;
    if (!s) { note('Nothing to undo.'); return; }
    world.t.set(s.t); world.life.set(s.l); world.fuel.set(s.f); world.creatures = s.c;
    writeSaveSoon(); note('Undone');
  }
  $('#btn-undo').addEventListener('click', undo);

  /* ---------------- Drawing ---------------- */
  let drawing = false, lastX = 0, lastY = 0, curX = 0, curY = 0, boltWait = 0;
  function toCell(e) {
    const r = canvas.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / dc()), Math.floor((e.clientY - r.top) / dc())];
  }
  // A ring shows exactly where the eraser will clear.
  const ring = $('#erase-ring');
  function moveRing(e, show) {
    if ((tool !== ERASE && tool !== BLENDER) || !show) { ring.hidden = true; return; }
    const r = canvas.getBoundingClientRect(), s = stage.getBoundingClientRect();
    const [cx, cy] = toCell(e), d = ((tool === BLENDER ? blendR() : BRUSHES[brush].r) * 2 + 1) * dc();
    ring.classList.toggle('spin', tool === BLENDER);
    ring.style.width = ring.style.height = d + 'px';
    ring.style.left = (r.left - s.left + (cx + 0.5) * dc()) + 'px';
    ring.style.top = (r.top - s.top + (cy + 0.5) * dc()) + 'px';
    ring.hidden = false;
  }
  /* ---------------- Portals: a ghost outline, and R (or the button) to turn them sideways ----------------
     The outline follows your finger (or the mouse); the portal goes down where you let go. */
  const ghost = $('#portal-ghost');
  let portalRot = 0, portalDrag = false;
  try { portalRot = localStorage.getItem('sandalchemy.portalrot') === '1' ? 1 : 0; } catch (e) { /* fine */ }
  const isPortal = () => tool === M.PORTALIN || tool === M.PORTALOUT;
  function portalBox(cx, cy) { // 2 cells thick; the brush sets how long (6 with the medium brush)
    const len = Math.max(2, BRUSHES[brush].r * 2);
    return portalRot ? { x0: cx - (len >> 1), y0: cy, w: len, h: 2 } : { x0: cx, y0: cy - (len >> 1), w: 2, h: len };
  }
  function placePortal(cx, cy) {
    const b = portalBox(cx, cy), w = world.w, h = world.h, t = world.t;
    for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) {
      const x = b.x0 + dx, y = b.y0 + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x, kb = KIND[t[i]];
      if (t[i] === 0 || kb === K.gas || kb === K.fire || kb === K.cloud || kb === K.spark || kb === K.liquid || kb === K.powder) world.put(i, tool);
    }
  }
  function showGhost(e, show) {
    if (!isPortal() || !show) { ghost.hidden = true; return; }
    const r = canvas.getBoundingClientRect(), s = stage.getBoundingClientRect(), [cx, cy] = toCell(e), b = portalBox(cx, cy);
    ghost.classList.toggle('out', tool === M.PORTALOUT);
    ghost.style.left = (r.left - s.left + b.x0 * dc()) + 'px'; ghost.style.top = (r.top - s.top + b.y0 * dc()) + 'px';
    ghost.style.width = (b.w * dc()) + 'px'; ghost.style.height = (b.h * dc()) + 'px';
    ghost.hidden = false; showGhost.last = e;
  }
  function rotatePortal() {
    portalRot ^= 1;
    try { localStorage.setItem('sandalchemy.portalrot', String(portalRot)); } catch (e) { /* fine */ }
    syncPortalBtn(); note(portalRot ? 'Portal: sideways' : 'Portal: upright');
    if (!ghost.hidden && showGhost.last) showGhost(showGhost.last, true);
  }
  function syncPortalBtn() { $('#portal-rot').hidden = !isPortal(); $('#portal-rot-label').textContent = portalRot ? 'Sideways' : 'Upright'; if (!isPortal()) ghost.hidden = true; }
  $('#portal-rot').addEventListener('click', rotatePortal);

  /* Eye dropper: press, aim with the magnifier, let go to start painting with what's under it. */
  const ALIAS = { [M.ROCKET]: M.FIREWORK };
  const loupe = $('#loupe'), lctx = $('#loupe-canvas').getContext('2d'), LZ = 13; // cells shown across the magnifier
  let loupeAt = null; // [cx, cy, clientX, clientY] while the magnifier is up
  function sampleAt(cx, cy) {
    const pet = world.creatureAt(cx, cy, 2.5);
    if (pet) return { best: pet.k, raw: pet.k };
    const w = world.w, h = world.h;
    let best = 0, bestD = 99, raw = 0;
    // Look in a small circle so tiny or moving things (a spark, a raindrop) are easy to catch.
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
      let m = world.matAt(y * w + x); m = ALIAS[m] || m;
      const d = dx * dx + dy * dy;
      if (m && d < bestD) { bestD = d; raw = m; if (document.querySelector(`.mat[data-m="${m}"]`)) best = m; }
    }
    return { best, raw };
  }
  function showLoupe(e) {
    const [cx, cy] = toCell(e);
    loupeAt = [cx, cy, e.clientX, e.clientY];
    loupe.hidden = false; $('#current').classList.add('under-loupe');
    drawLoupe();
  }
  function hideLoupe() { loupeAt = null; loupe.hidden = true; $('#current').classList.remove('under-loupe'); }
  function drawLoupe() {
    if (!loupeAt) return;
    const [cx, cy, X, Y] = loupeAt, z = 130 / LZ, half = (LZ - 1) / 2;
    lctx.imageSmoothingEnabled = false;
    lctx.fillStyle = '#0d0e22'; lctx.fillRect(0, 0, 130, 130);
    const sx = cx - half, sy = cy - half;
    const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(world.w, sx + LZ), y1 = Math.min(world.h, sy + LZ);
    if (x1 > x0 && y1 > y0) lctx.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, (x0 - sx) * z, (y0 - sy) * z, (x1 - x0) * z, (y1 - y0) * z);
    // Cross-hair box on the centre cell.
    lctx.lineWidth = 2; lctx.strokeStyle = 'rgba(0,0,0,0.6)'; lctx.strokeRect(half * z - 1, half * z - 1, z + 2, z + 2);
    lctx.lineWidth = 1.5; lctx.strokeStyle = '#fff'; lctx.strokeRect(half * z, half * z, z, z);
    const { best, raw } = sampleAt(cx, cy), name = $('#loupe-name');
    name.textContent = best ? MATS[best].name : raw ? '???' : 'Nothing here';
    name.classList.toggle('empty', !best);
    // Sit above the finger (or below it near the top), kept inside the world box.
    const st = stage.getBoundingClientRect(), size = 130, gap = 46;
    let left = X - st.left - size / 2, top = Y - st.top - size - gap;
    if (top < 34) top = Y - st.top + gap;
    left = Math.max(6, Math.min(st.width - size - 6, left));
    loupe.style.left = left + 'px'; loupe.style.top = top + 'px';
  }
  function pickFromLoupe() {
    if (!loupeAt) return;
    const { best } = sampleAt(loupeAt[0], loupeAt[1]), badge = $('#current');
    if (!best) { badge.classList.remove('nope'); void badge.offsetWidth; badge.classList.add('nope'); return; }
    pick(best); scrollToTool(best); writeSaveSoon(); ST.dropper++;
    badge.classList.remove('picked'); void badge.offsetWidth; badge.classList.add('picked');
  }
  let dropping = false;

  /* Straight lines: hold Shift (or double-tap and hold on a touch screen), drag,
     and let go. A preview shows where the line will go. */
  let line = null, lastTap = null, downAt = null;
  const lineSvg = $('#line-preview'), lineEl = lineSvg.querySelector('.lp-body'), lineMid = lineSvg.querySelector('.lp-mid');
  function lineEnd(e) {
    let [x, y] = toCell(e);
    // Snap to flat, upright and diagonal lines when close.
    const dx = x - line.x0, dy = y - line.y0, len = Math.hypot(dx, dy);
    if (len > 2) {
      const a = Math.atan2(dy, dx), snap = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
      if (Math.abs(a - snap) < 0.1) { x = Math.round(line.x0 + Math.cos(snap) * len); y = Math.round(line.y0 + Math.sin(snap) * len); }
    }
    line.x1 = x; line.y1 = y;
  }
  function drawLinePreview() {
    const r = canvas.getBoundingClientRect(), st = stage.getBoundingClientRect();
    lineSvg.style.left = (r.left - st.left) + 'px'; lineSvg.style.top = (r.top - st.top) + 'px';
    lineSvg.setAttribute('width', r.width); lineSvg.setAttribute('height', r.height);
    const c = (v) => (v + 0.5) * dc(), sw = (BRUSHES[brush].r * 2 + 1) * dc();
    [lineEl, lineMid].forEach((l) => { l.setAttribute('x1', c(line.x0)); l.setAttribute('y1', c(line.y0)); l.setAttribute('x2', c(line.x1)); l.setAttribute('y2', c(line.y1)); });
    lineEl.setAttribute('stroke-width', sw);
    lineEl.setAttribute('stroke', tool === ERASE ? 'rgba(255,255,255,0.25)' : MATS[tool].colors[0]);
    lineSvg.removeAttribute('hidden');
  }
  function startLine(e) {
    if (tool < COUNT) useRecent(tool);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    const [x, y] = toCell(e);
    line = { x0: x, y0: y, x1: x, y1: y };
    ring.hidden = true; $('#tip').classList.add('gone'); $('#current').classList.add('lining');
    drawLinePreview();
  }
  function endLine(commit) {
    if (!line) return;
    if (commit) { ST.lines++; snapshot(); straight = true; petX = petY = -99; paintLine(line.x0, line.y0, line.x1, line.y1); straight = false; writeSaveSoon(); }
    line = null; lineSvg.setAttribute('hidden', ''); $('#current').classList.remove('lining');
  }
  /* Keyboard shortcuts:  C eraser · E dropper · B brew · F search · Space pause
     · Ctrl/Cmd+Z undo · Esc closes a panel (or cancels a line). */
  const PANELS = ['#stats', '#world-panel', '#worlds', '#erase-confirm', '#settings', '#restore-confirm', '#confirm', '#inworld', '#find', '#brew', '#book'];
  let toolBefore = M.SAND;
  function toggleTool(m) {
    if (tool === m) pick(toolBefore !== m ? toolBefore : M.SAND);
    else { toolBefore = tool; pick(m); }
    scrollToTool(tool);
  }
  /* ---------------- The Stickman's controls ----------------
     Arrow keys (or A, D, W) and Space on a keyboard, or the on-screen buttons on a phone. While he's in
     the world, Space jumps instead of pausing. */
  const stickKeys = { left: false, right: false, jump: false };
  const hasStick = () => !!world && world.creatures.some((c) => c.k === M.STICKMAN);
  const STICK_KEYS = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'jump', w: 'jump', ' ': 'jump' };
  addEventListener('keydown', (e) => {
    const k = STICK_KEYS[e.key.toLowerCase()]; if (!k) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!hasStick() || PANELS.some((sel) => !$(sel).hidden)) return;
    stickKeys[k] = true; e.preventDefault(); e.stopImmediatePropagation();
  });
  addEventListener('keyup', (e) => { const k = STICK_KEYS[e.key.toLowerCase()]; if (k) stickKeys[k] = false; });
  addEventListener('blur', () => { stickKeys.left = stickKeys.right = stickKeys.jump = false; });
  document.querySelectorAll('#stick-pad .sp-btn').forEach((b) => {
    const k = b.dataset.k;
    const on = (e) => { e.preventDefault(); stickKeys[k] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } };
    const off = () => { stickKeys[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, off));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  let padShown = false;
  function updateStickPad() {
    const show = hasStick();
    if (show !== padShown) { padShown = show; $('#stick-pad').hidden = !show; if (!show) { stickKeys.left = stickKeys.right = stickKeys.jump = false; } }
    world.keys = stickKeys;
  }

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (line) { endLine(false); return; }
      const open = PANELS.find((sel) => !$(sel).hidden);
      if (open) { $(open).hidden = true; e.preventDefault(); }
      return;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      if (typing) return; // let text boxes undo their own typing
      e.preventDefault(); if (!line && !drawing) undo(); return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (!$('#brew').hidden && e.key.toLowerCase() === 'r') { randomPick(); return; } // roll the dice in the Cauldron
    if (PANELS.some((sel) => !$(sel).hidden)) return; // shortcuts only in the world view
    switch (e.key.toLowerCase()) {
      case 'c': toggleTool(ERASE); break;
      case 'x': toggleTool(BLENDER); break;
      case '[': setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(speed) - 1)]); note('Speed ' + $('#world-btn-label').textContent); break;
      case ']': setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + 1)]); note('Speed ' + $('#world-btn-label').textContent); break;
      case '.': stepOnce(); break;
      case 'g': setZeroG(!world.zeroG); break;
      case 't': setThermal(!thermal); break;
      case 'p': setPerf(!perfOn); break;
      case 'n': setSky(['classic', 'day', 'night', 'cycle'][(['classic', 'day', 'night', 'cycle'].indexOf(skyMode) + 1) % 4]); note('Sky: ' + skyMode); break;
      case '=': case '+': zoomCentre(1.5); break;
      case '-': case '_': zoomCentre(1 / 1.5); break;
      case '0': zoom = 1; layoutView(); break;
      case 'm': SND.set(!SND.on, SND.vol); $('#snd-on').checked = SND.on; if (!SND.on) { SND.ambient(null); ST.mutes++; } note(SND.on ? 'Sound on' : 'Sound off'); break;
      case 'e': toggleTool(DROPPER); break;
      case 'b': openBrew(); break;
      case 'r': if (isPortal()) rotatePortal(); else return; break;
      case 'f': e.preventDefault(); openFind(); break;
      case ' ': e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); $('#btn-pause').click(); break;
      default: return;
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    downAt = { t: performance.now(), x: e.clientX, y: e.clientY };
    const twoTaps = e.pointerType !== 'mouse' && lastTap && performance.now() - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40;
    if ((e.shiftKey || twoTaps) && tool !== DROPPER && tool !== BLENDER && baseOf(tool) !== M.LIGHTNING) { e.preventDefault(); lastTap = null; startLine(e); return; }
    if (tool !== DROPPER) snapshot();
    if (isPortal()) { // show where it'll go; it's placed when you let go
      e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } $('#tip').classList.add('gone');
      portalDrag = true; showGhost(e, true); return;
    }
    if (tool === DROPPER) {
      e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
      $('#tip').classList.add('gone'); dropping = true; showLoupe(e); return;
    }
    moveRing(e, true);
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    drawing = true; [curX, curY] = toCell(e); lastX = curX; lastY = curY; boltWait = 0; petX = petY = -99;
    if (tool < COUNT) useRecent(tool);
    add(ST.brushUse, brush); strokeWalls = 0;
    $('#tip').classList.add('gone');
    paintLine(lastX, lastY, curX, curY);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (line) { lineEnd(e); drawLinePreview(); return; }
    if (isPortal()) { showGhost(e, portalDrag || e.pointerType === 'mouse'); return; }
    if (tool === DROPPER) { if (dropping || e.pointerType === 'mouse') showLoupe(e); else hideLoupe(); return; }
    moveRing(e, drawing || e.pointerType === 'mouse');
    if (!drawing) return;
    [curX, curY] = toCell(e);
    paintLine(lastX, lastY, curX, curY);
    lastX = curX; lastY = curY;
  });
  const stop = (e) => {
    // Remember quick taps so a second tap right after can start a line.
    if (downAt && e.type === 'pointerup' && e.pointerType !== 'mouse' && performance.now() - downAt.t < 250 && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 12) lastTap = { t: performance.now(), x: e.clientX, y: e.clientY };
    if (line) { endLine(e.type === 'pointerup'); return; }
    if (portalDrag) {
      portalDrag = false;
      if (e.type === 'pointerup') { const [cx, cy] = toCell(e); placePortal(cx, cy); useRecent(tool); writeSaveSoon(); }
      if (e.pointerType !== 'mouse') ghost.hidden = true;
      return;
    }
    if (dropping) { dropping = false; pickFromLoupe(); if (e.pointerType !== 'mouse' || tool !== DROPPER) hideLoupe(); return; } if (e.pointerType !== 'mouse') ring.hidden = true; if (drawing) { drawing = false; writeSaveSoon(); if (strokeWalls > ST.longestWall) ST.longestWall = strokeWalls; } };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', (e) => { ring.hidden = true; dropping = false; hideLoupe(); endLine(false); stop(e); });
  canvas.addEventListener('pointerleave', () => { if (!portalDrag) ghost.hidden = true; if (!drawing) ring.hidden = true; if (!dropping) hideLoupe(); });

  function paintLine(x0, y0, x1, y1) {
    const r = BRUSHES[brush].r, d = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    const steps = Math.max(1, Math.ceil(d / Math.max(1, r * 0.6)));
    for (let s = 0; s <= steps; s++) dab(Math.round(x0 + (x1 - x0) * s / steps), Math.round(y0 + (y1 - y0) * s / steps));
  }
  /* The blender: everything inside the ring gets whirled round and jumbled together, creatures too.
     Walls and portals stay put. Mixed-up neighbours then react with each other as usual. */
  const NO_BLEND = new Set([M.WALL, M.PORTALIN, M.PORTALOUT]);
  let blendSpin = 0;
  function blend(cx, cy) {
    const w = world.w, h = world.h, t = world.t, R = blendR(), R2 = R * R;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x);
    const ok = (i) => i >= 0 && !NO_BLEND.has(t[i]);
    blendSpin += 0.35;
    const n = Math.round(R2 * 3);
    let moved = 0;
    for (let k = 0; k < n; k++) {
      const dx = ri(R * 2 + 1) - R, dy = ri(R * 2 + 1) - R, d2 = dx * dx + dy * dy;
      if (d2 > R2) continue;
      const i = at(cx + dx, cy + dy); if (!ok(i)) continue;
      let j;
      if (rnd() < 0.6) { // swirl: trade places with the spot a little way round the circle
        const a = 0.35 + rnd() * 0.5, c = Math.cos(a), s = Math.sin(a);
        j = at(cx + Math.round(dx * c - dy * s), cy + Math.round(dx * s + dy * c));
      } else { // jumble: trade with any spot inside the ring
        const ex = ri(R * 2 + 1) - R, ey = ri(R * 2 + 1) - R;
        if (ex * ex + ey * ey > R2) continue;
        j = at(cx + ex, cy + ey);
      }
      if (j === i || !ok(j) || (t[i] === 0 && t[j] === 0)) continue;
      world.swap(i, j); moved++;
    }
    // Creatures get flung round the ring too.
    for (const c of world.creatures) {
      const dx = c.x - cx, dy = c.y - cy, d2 = dx * dx + dy * dy;
      if (d2 > R2 || rnd() > 0.25) continue;
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * R;
      const nx = Math.round(cx + Math.cos(a) * rr), ny = Math.round(cy + Math.sin(a) * rr), j = at(nx, ny);
      if (j >= 0 && t[j] === 0) { c.x = nx; c.y = ny; }
    }
    if (moved) { ST.blended = (ST.blended || 0) + moved; world.userPaint = false; }
  }
  let petX = -99, petY = -99, straight = false, strokeWalls = 0;
  function dab(cx, cy) {
    const w = world.w, h = world.h, r = BRUSHES[brush].r, t = world.t;
    if (tool === BLENDER) { blend(cx, cy); return; }
    if (tool === ERASE) world.removeCreatures(cx, cy, r);
    if (isObject(tool)) {
      // Objects are placed whole, spaced out so they don't overlap along a stroke.
      const ow = MATS[tool].rows[0].length;
      if ((cx - petX) ** 2 + (cy - petY) ** 2 < ow * ow) return;
      petX = cx; petY = cy;
      world.placeStamp(tool, cx, cy);
      return;
    }
    if (tool === M.PORTALIN || tool === M.PORTALOUT) {
      // A portal is a bar 2 cells thick; the brush sets how long it is (6 for the medium brush), R turns it.
      const ph = Math.max(2, r * 2);
      if ((cx - petX) ** 2 + (cy - petY) ** 2 < ph * ph / 2) return;
      petX = cx; petY = cy;
      placePortal(cx, cy);
      return;
    }
    if (isCreature(tool)) {
      // Creatures are placed a few at a time, spaced out along the stroke.
      if ((cx - petX) ** 2 + (cy - petY) ** 2 < 25) return;
      petX = cx; petY = cy;
      if (tool === M.STICKMAN) { world.spawn(tool, cx, cy, false); return; } // just the one
      const n = [1, 1, 2, 3][brush];
      for (let k = 0; k < n; k++) world.spawn(tool, cx + (k ? ri(r * 2 + 1) - r : 0), cy + (k ? ri(r * 2 + 1) - r : 0), false);
      return;
    }
    if (baseOf(tool) === M.LIGHTNING) {
      if (boltWait-- > 0) return;
      boltWait = 6;
      if (cx >= 0 && cx < w) world.strike(cx, tool === M.LIGHTNING ? 0 : tool);
      return;
    }
    const kind = tool === ERASE ? -1 : KIND[tool];
    // Loose things are sprinkled so they pour; solids are painted solid.
    const fill = tool === ERASE ? 1 : baseOf(tool) === M.SEED ? 0.05 : straight || kind === K.solid ? 1 : kind === K.liquid ? 0.55 : kind === K.powder ? 0.45 : 0.35;
    let painted = 0, erased = 0;
    world.userPaint = true;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + r) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x, b = t[i];
      if (tool === ERASE) { if (b) erased++; t[i] = 0; continue; }
      if (rnd() > fill) continue;
      if (baseOf(tool) === M.FIRE && b && MATS[b].flam > 0) { world.ignite(i); continue; }
      const kb = KIND[b];
      if (b === 0 || ((kb === K.gas || kb === K.cloud) && kind !== K.gas && kind !== K.cloud)) { world.put(i, tool); painted++; }
    }
    world.userPaint = false;
    if (erased) ST.erased += erased;
    if (painted) {
      ST.painted += painted; sesBump('painted', painted); add(ST.paintBy, tool, painted);
      if (kind === K.liquid) ST.liquid += painted;
      if (tool === M.WALL) { ST.walls += painted; strokeWalls += painted; }
    }
  }

  /* ---------------- All-time stats ----------------
     Counted as you play and kept in this browser (and in backups). SES holds this session's counts,
     for the session records in the Hall of Fame. */
  const STATS_KEY = 'sandalchemy.stats.v1';
  const ST_DEFAULT = () => ({ since: Date.now(), playMs: 0, sessions: 0, dayList: [], curStreak: 0, bestStreakDays: 0, longestSession: 0,
    tod: { morning: 0, afternoon: 0, evening: 0, night: 0 }, device: { phone: 0, computer: 0 }, pausedMs: 0, simSteps: 0, speedMs: {}, mutes: 0,
    painted: 0, erased: 0, lines: 0, brushUse: {}, undos: 0, clears: 0, walls: 0, longestWall: 0, dropper: 0, paintBy: {}, liquid: 0,
    mostOnScreen: null, peakCells: 0, mostDiverse: 0, fell: 0, rx: 0, trans: 0, rxBy: {},
    tempHi: 20, tempLo: 20, fires: 0, longestFire: 0, ash: 0, melt: 0, boil: 0, cooled: 0, obs: 0,
    portalTrips: 0, portalMax: 0, loopMax: 0, bhMax: 0, whMax: 0, longestBH: 0, maxOrbit: 0, zeroGms: 0, grav: 0, zoomUses: 0, heatUses: 0, zeroGUses: 0,
    booms: 0, bigBoom: 0, bigBlast: 0, chainMax: 0, boomsMinuteMax: 0, boomsBySize: {}, crater: 0, launched: 0,
    sunrises: 0, lightning: 0, storms: 0, rain: 0, dayMs: 0, nightMs: 0, plants: 0, mostPlants: 0, seeds: 0,
    popMax: 0, born: 0, species: {}, hatched: 0, lost: 0, deaths: {}, oldest: 0, steps: 0, flyDist: 0, swimDist: 0, frogs: 0, bugs: 0, jumps: 0, falls: 0, kos: 0, stickDist: 0,
    brews: 0, brewNew: 0, brewKnown: 0, brewFizzle: 0, brewVoid: 0, streak: 0, bestStreak: 0, brew2: 0, brew3: 0, brew4: 0, randoms: 0, combos: {}, ingr: {},
    hintsUsed: 0, revealsUsed: 0, firstFind: null, lastFind: 0, lastFindName: '', discTimes: [], fastest5: 0, best5min: 0,
    invMade: 0, invDeleted: 0, invRepeat: 0, aiReq: 0, aiOk: 0, aiMs: 0, aiOnline: 0, aiDevice: 0, invDays: {}, bestDay: null,
    worldsSaved: 0, worldsLoaded: 0, bigWorld: null, divWorld: null, cows: 0, choc: 0, oops: 0, swallowed: 0, spat: 0, maxFlying: 0,
    rec: {} });
  const ST = (() => { const d = ST_DEFAULT(); let saved = {}; try { saved = JSON.parse(localStorage.getItem(STATS_KEY) || '{}'); } catch (e) { /* fresh */ }
    const out = Object.assign(d, saved); if (saved.days != null && !saved.sunrises) out.sunrises = saved.days; return out; })();
  const SES = { start: Date.now(), reactions: 0, newFinds: 0, booms: 0, plants: 0, fires: 0, painted: 0, ai: 0 };
  function saveStats() { try { localStorage.setItem(STATS_KEY, JSON.stringify(ST)); } catch (e) { /* fine */ } }
  setInterval(saveStats, 15000); addEventListener('pagehide', saveStats);
  const add = (map, k, n) => { map[k] = (map[k] || 0) + (n == null ? 1 : n); };
  // Session records (Hall of Fame): the best a single session has ever done.
  function sesBump(k, n) { SES[k] += n; if (SES[k] > (ST.rec[k] || 0)) ST.rec[k] = SES[k]; }
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  // A new session: count the day and the daily streak.
  (function newSession() {
    ST.sessions++;
    const d = today();
    if (!ST.dayList.includes(d)) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yd = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
      ST.curStreak = ST.dayList.includes(yd) ? ST.curStreak + 1 : 1;
      ST.dayList.push(d); if (ST.dayList.length > 1500) ST.dayList.shift();
      if (ST.curStreak > ST.bestStreakDays) ST.bestStreakDays = ST.curStreak;
    }
  })();
  const IS_PHONE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  // Every second: time played, when, on what, paused or not, at what speed.
  setInterval(() => {
    if (document.hidden || !world) return;
    ST.playMs += 1000;
    const hr = new Date().getHours(); add(ST.tod, hr < 5 ? 'night' : hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : hr < 22 ? 'evening' : 'night', 1000);
    add(ST.device, IS_PHONE ? 'phone' : 'computer', 1000);
    const sess = Date.now() - SES.start; if (sess > ST.longestSession) ST.longestSession = sess;
    if (paused) ST.pausedMs += 1000;
    else {
      add(ST.speedMs, String(speed), 1000);
      if (world.zeroG) ST.zeroGms += 1000;
      if (skyMode === 'cycle') { if (Math.sin(2 * Math.PI * (world.dayT || 0)) > 0) ST.dayMs += 1000; else ST.nightMs += 1000; }
    }
  }, 1000);
  // Every second or so: look over the whole world (biggest amounts, variety, plants, fires, black holes, orbiting dust).
  const hist = new Uint32Array(COUNT); let fireRun = 0, bhRun = 0;
  function scanWorld() {
    hist.fill(0); const t = world.t; let cells = 0;
    for (let i = 0; i < t.length; i++) { const m = world.matAt(i); if (m) { hist[m]++; cells++; } }
    let kinds = 0, best = 0, bestM = 0, plants = 0;
    for (let m = 1; m < COUNT; m++) { const n = hist[m]; if (!n) continue; kinds++; if (n > best && m !== M.WALL) { best = n; bestM = m; } if (m === M.PLANT || m === M.VINE || m === M.MOSS || m === M.FLOWER || m === M.GLOWMOSS) plants += n; }
    if (cells > ST.peakCells) ST.peakCells = cells;
    if (kinds > ST.mostDiverse) ST.mostDiverse = kinds;
    if (bestM && (!ST.mostOnScreen || best > ST.mostOnScreen.n)) ST.mostOnScreen = { m: bestM, n: best };
    if (plants > ST.mostPlants) ST.mostPlants = plants;
    fireRun = hist[M.FIRE] ? fireRun + 1 : 0; if (fireRun > ST.longestFire) ST.longestFire = fireRun;
    bhRun = hist[M.BLACKHOLE] ? bhRun + 1 : 0; if (bhRun > ST.longestBH) ST.longestBH = bhRun;
    if (world.holes && world.flying.length > ST.maxOrbit) ST.maxOrbit = world.flying.length;
    if (world.creatures.length > ST.popMax) ST.popMax = world.creatures.length;
    for (const c of world.creatures) if ((c.age || 0) > ST.oldest) ST.oldest = c.age;
    if (world.tempHi > ST.tempHi) ST.tempHi = Math.round(world.tempHi); if (world.tempLo < ST.tempLo) ST.tempLo = Math.round(world.tempLo);
  }
  // Collect what the simulation counted since last time.
  function drainTally() {
    const T = world.tally; if (!T) return;
    ['fell', 'rx', 'trans', 'ash', 'melt', 'boil', 'cooled', 'obs', 'choc', 'plants', 'seeds', 'storms', 'rain', 'fires', 'launched', 'grav', 'steps', 'flyDist', 'swimDist', 'frogs', 'bugs', 'cows', 'kos', 'falls', 'jumps', 'stickDist'].forEach((k) => { if (T[k]) ST[k] = (ST[k] || 0) + T[k]; });
    ST.crater += T.blastCells;
    ['portalMax', 'loopMax', 'bhMax', 'whMax', 'oldest', 'bigBlast'].forEach((k) => { if (T[k] > (ST[k] || 0)) ST[k] = T[k]; });
    for (const k in T.deaths) add(ST.deaths, k, T.deaths[k]);
    for (const k in T.species) add(ST.species, k, T.species[k]);
    for (const k in T.rxBy) add(ST.rxBy, k, T.rxBy[k]);
    if (T.rx) sesBump('reactions', T.rx); if (T.plants) sesBump('plants', T.plants); if (T.fires) sesBump('fires', T.fires);
    world.newTally();
  }
  // Explosions per second and per minute (for the chain-reaction records).
  const boomSec = new Array(60).fill(0); let boomNow = 0, boomStepN = 0, lastBoomAt = 0;
  function statBooms(n, power) {
    ST.booms += n; sesBump('booms', n); lastBoomAt = performance.now();
    if (power > ST.bigBoom) ST.bigBoom = +power.toFixed(2);
    add(ST.boomsBySize, power < 1.5 ? 'small' : power < 3 ? 'tnt' : power < 4.5 ? 'c4' : 'huge', n);
    boomNow += n;
  }
  function tickBooms() { // once per 60 world steps (about a second)
    if (boomNow > ST.chainMax) ST.chainMax = boomNow;
    boomSec.shift(); boomSec.push(boomNow); boomNow = 0;
    const minute = boomSec.reduce((a, b) => a + b, 0); if (minute > ST.boomsMinuteMax) ST.boomsMinuteMax = minute;
  }
  function statBrew(kind, ids) {
    ST.brews++; ids = (ids || []).filter(Boolean);
    if (kind === 'new') { ST.brewNew++; ST.streak++; if (ST.streak > ST.bestStreak) ST.bestStreak = ST.streak; }
    else { ST.streak = 0; if (kind === 'void') ST.brewVoid++; else if (kind === 'fizzle') ST.brewFizzle++; else ST.brewKnown++; }
    if (ids.length >= 4) ST.brew4++; else if (ids.length === 3) ST.brew3++; else ST.brew2++;
    ids.forEach((m) => add(ST.ingr, m));
    ST.combos[ids.slice().sort((a, b) => a - b).join('+')] = 1;
    saveStats();
  }
  function statInvention() {
    ST.invMade++; sesBump('ai', 1); const d = today(); add(ST.invDays, d);
    if (!ST.bestDay || ST.invDays[d] > ST.bestDay.n) ST.bestDay = { d, n: ST.invDays[d] };
    const keys = Object.keys(ST.invDays).sort(); while (keys.length > 60) delete ST.invDays[keys.shift()]; // only the last two months
    saveStats();
  }
  function statFind(m) {
    const now = Date.now(); ST.lastFind = now; ST.lastFindName = MATS[m] ? MATS[m].name : '';
    if (!ST.firstFind) ST.firstFind = { name: ST.lastFindName, at: now };
    ST.discTimes.push(now); if (ST.discTimes.length > 40) ST.discTimes.shift();
    const L = ST.discTimes.length;
    if (L >= 5) { const span = now - ST.discTimes[L - 5]; if (!ST.fastest5 || span < ST.fastest5) ST.fastest5 = span; }
    const in5 = ST.discTimes.filter((t) => now - t <= 300000).length; if (in5 > ST.best5min) ST.best5min = in5;
    sesBump('newFinds', 1);
  }
  const fmt = (n) => shortNum(n);
  const fmtTime = (ms) => { const s = Math.floor((ms || 0) / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60); return h ? `${h}h ${m % 60}m` : m ? `${m}m` : `${s}s`; };
  const fmtDate = (d) => { if (!d) return '—'; const x = typeof d === 'string' ? new Date(d + 'T12:00') : new Date(d); return x.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };
  const boomName = (p) => !p ? '—' : p < 1.5 ? 'Gunpowder-sized' : p < 3 ? 'TNT-sized' : p < 4.5 ? 'C4-sized' : 'Huge chain reaction';
  const nm = (m) => (MATS[m] && MATS[m].name) || '—';
  const topOf = (map, ok) => Object.entries(map || {}).filter(([k]) => !ok || ok(k)).sort((a, b) => b[1] - a[1]);
  const DEATH = { burn: 'burned', drown: 'drowned', void: 'swallowed by a black hole', freeze: 'frozen', crush: 'crushed', eaten: 'eaten', boom: 'blown up', dry: 'dried out', fall: 'fell' };
  // How many brewing steps each discovered thing is from the starting elements (for the rarest discovery).
  function recipeDepths() {
    const depth = new Map();
    ORDER.forEach((m) => { if (MATS[m].start) depth.set(m, 0); });
    const known = () => [...depth.keys()];
    for (let round = 0; round < 25; round++) {
      let grew = false; const got = [];
      MAGIC.forEach((out, key) => { // every recipe whose two ingredients are already reachable
        const a = Math.floor(key / COUNT), b = key % COUNT;
        if (depth.has(out) || !world.discovered[out] || !depth.has(a) || !depth.has(b)) return;
        got.push([out, Math.max(depth.get(a), depth.get(b)) + 1]);
      });
      got.forEach(([out, d]) => { if (!depth.has(out) || depth.get(out) > d) { depth.set(out, d); grew = true; } });
      if (!grew) break;
    }
    return depth;
  }
  function openStats() {
    const body = $('#stats-body'); body.innerHTML = '';
    const tile = (g, big, label, cls) => { const d = document.createElement('div'); d.className = 'stat' + (cls ? ' ' + cls : ''); const b = document.createElement('b'), sp = document.createElement('span'); b.textContent = big; sp.textContent = label; d.append(b, sp); g.append(d); return d; };
    const grid = (parent) => { const g = document.createElement('div'); g.className = 'stat-grid'; parent.append(g); return g; };
    const section = (title, open) => { const d = document.createElement('details'); d.className = 'stat-sec'; if (open) d.open = true; const s = document.createElement('summary'); s.textContent = title; d.append(s); body.append(d); return grid(d); };
    // Numbers worked out now.
    const builtIn = GROUPS.filter((g) => g !== INV_GROUP).map((grp) => ({ grp, items: grp.items.filter((m) => !MATS[m].hidden && !MATS[m].reserved) }));
    let found = 0, total = 0; builtIn.forEach(({ items }) => { total += items.length; found += items.filter((m) => world.discovered[m]).length; });
    const live = INV_GROUP.items.filter((m) => !MATS[m].hidden);
    const topPaint = topOf(ST.paintBy, (k) => MATS[k] && !MATS[k].hidden);
    const deaths = topOf(ST.deaths), species = topOf(ST.species, (k) => MATS[k]);
    const sesFind = ST.rec;
    // ⭐ Highlights
    const hi = section('⭐ Highlights', true);
    tile(hi, fmtTime(ST.playMs), 'total playtime');
    tile(hi, `${found + live.length}`, `total discoveries (${found} built-in + ${live.length} inventions)`);
    tile(hi, fmt(ST.painted), 'cells painted');
    tile(hi, topPaint.length ? nm(+topPaint[0][0]) : '—', 'most-used material');
    tile(hi, `${Math.round(ST.tempHi || 0).toLocaleString()}°`, 'hottest temperature');
    tile(hi, ST.portalMax ? ST.portalMax.toFixed(1) + ' cells/frame' : '—', 'fastest portal speed');
    tile(hi, fmt(ST.chainMax), 'biggest chain reaction (explosions in one second)');
    tile(hi, fmt(ST.sunrises), 'sunrises watched');
    tile(hi, fmt(ST.plants), 'plants grown');
    tile(hi, fmt(ST.popMax), 'biggest creature population');
    tile(hi, fmt(ST.best5min), 'most discoveries within 5 minutes');
    tile(hi, fmt(live.length), 'AI inventions in your book');
    tile(hi, ST.bigWorld ? fmt(ST.bigWorld.n) + ' cells' : '—', ST.bigWorld ? 'biggest saved world (' + ST.bigWorld.name + ')' : 'biggest saved world');
    tile(hi, fmt(ST.cows), 'cows swallowed by black holes 🐄');
    tile(hi, ST.bestDay ? String(ST.bestDay.n) : '—', ST.bestDay ? `most inventions in one day (${fmtDate(ST.bestDay.d)})` : 'most inventions in one day', 'gold');
    // 1. General
    const g1 = section('General & playtime');
    tile(g1, fmtTime(ST.playMs), 'total playtime'); tile(g1, fmt(ST.sessions), 'sessions played'); tile(g1, fmt(ST.dayList.length), 'days played');
    tile(g1, fmt(ST.curStreak) + (ST.curStreak === 1 ? ' day' : ' days'), 'current daily streak'); tile(g1, fmt(ST.bestStreakDays) + ' days', 'longest daily streak');
    tile(g1, fmtTime(ST.longestSession), 'longest session');
    const tod = topOf(ST.tod)[0]; tile(g1, tod && tod[1] ? tod[0][0].toUpperCase() + tod[0].slice(1) : '—', 'favorite time to play');
    tile(g1, `${fmtTime(ST.device.computer)} / ${fmtTime(ST.device.phone)}`, 'computer / phone playtime');
    tile(g1, fmtTime(ST.pausedMs), 'time paused'); tile(g1, fmtTime(ST.simSteps * 1000 / 60), 'simulated time');
    const sp = topOf(ST.speedMs)[0]; tile(g1, sp ? (sp[0] === '0.25' ? '¼' : sp[0] === '0.5' ? '½' : sp[0]) + '×' : '1×', 'most-used speed');
    tile(g1, fmt(ST.mutes), 'times sound was muted');
    // 2. Drawing
    const g2 = section('Drawing & building');
    tile(g2, fmt(ST.painted), 'cells painted'); tile(g2, fmt(ST.erased), 'cells erased'); tile(g2, fmt(ST.blended || 0), 'cells blended'); tile(g2, fmt(ST.lines), 'straight lines drawn');
    const bu = topOf(ST.brushUse)[0]; tile(g2, bu ? BRUSHES[+bu[0]].label : '—', 'favorite brush size');
    tile(g2, BRUSHES.map((b, k) => b.label + ' ' + fmt(ST.brushUse[k])).join(' · '), 'strokes per brush size');
    tile(g2, fmt(ST.undos), 'undos'); tile(g2, fmt(ST.clears), 'worlds cleared'); tile(g2, fmt(ST.walls), 'wall cells placed');
    tile(g2, fmt(ST.longestWall), 'longest wall (cells in one stroke)'); tile(g2, fmt(ST.dropper), 'dropper uses'); tile(g2, fmt(ST.rec.painted), 'most cells painted in one session');
    // 3. Elements
    const g3 = section('Elements & materials');
    tile(g3, topPaint.slice(0, 5).map(([m, n]) => nm(+m) + ' ' + fmt(n)).join(' · ') || '—', 'top 5 most-used materials', 'wide');
    const least = builtIn.flatMap((x) => x.items).filter((m) => world.discovered[m] && !MATS[m].creature).sort((a, b) => (ST.paintBy[a] || 0) - (ST.paintBy[b] || 0))[0];
    tile(g3, least ? nm(least) : '—', least ? `least-used element (painted ${fmt(ST.paintBy[least])}×)` : 'least-used element');
    tile(g3, ST.mostOnScreen ? fmt(ST.mostOnScreen.n) + ' ' + nm(ST.mostOnScreen.m) : '—', 'most of one material on screen');
    tile(g3, fmt(ST.fell), 'grains fallen (cells)'); tile(g3, fmt(ST.liquid), 'liquid cells poured');
    let now = 0; for (let i = 0; i < world.t.length; i++) if (world.t[i]) now++;
    tile(g3, fmt(now), 'cells filled right now'); tile(g3, fmt(ST.peakCells), 'most cells filled at once');
    tile(g3, fmt(ST.rx), 'reactions'); tile(g3, fmt(ST.trans), 'cells transformed');
    const rxTop = topOf(ST.rxBy, (k) => MATS[k])[0]; tile(g3, rxTop ? nm(+rxTop[0]) : '—', 'most reactive element');
    tile(g3, fmt(ST.mostDiverse), 'most different materials in one world');
    // 4. Fire & heat
    const g4 = section('Fire, heat & temperature');
    tile(g4, `${Math.round(ST.tempHi || 0).toLocaleString()}°`, 'hottest temperature'); tile(g4, `${Math.round(ST.tempLo || 0).toLocaleString()}°`, 'coldest temperature');
    tile(g4, fmt(ST.fires), 'fires started'); tile(g4, fmtTime(ST.longestFire * 1000), 'longest-burning fire');
    tile(g4, fmt(ST.ash), 'cells burned to ash'); tile(g4, fmt(ST.melt), 'ice melted'); tile(g4, fmt(ST.boil), 'water boiled to steam');
    tile(g4, fmt(ST.cooled), 'lava cooled into rock'); tile(g4, fmt(ST.obs), 'obsidian created');
    // 5. Space
    const g5 = section('Space, portals & gravity');
    tile(g5, ST.portalMax ? ST.portalMax.toFixed(1) + ' cells/frame' : '—', 'fastest portal speed'); tile(g5, fmt(ST.portalTrips), 'portal trips');
    tile(g5, fmt(ST.loopMax), 'longest portal loop (jumps by one grain)');
    tile(g5, fmt(ST.bhMax) + ' cells', 'biggest black hole'); tile(g5, fmt(ST.whMax) + ' cells', 'biggest white hole');
    tile(g5, fmtTime(ST.longestBH * 1000), 'longest-living black hole'); tile(g5, fmt(ST.maxOrbit), 'most pieces in orbit at once');
    tile(g5, fmtTime(ST.zeroGms), 'time in zero gravity'); tile(g5, fmt(ST.grav), 'gravity bombs triggered');
    tile(g5, fmt(ST.zoomUses), 'zoom uses'); tile(g5, fmt(ST.heatUses), 'heat view uses'); tile(g5, fmt(ST.zeroGUses), 'zero-gravity uses');
    // 6. Explosions
    const g6 = section('Explosions & destruction');
    tile(g6, fmt(ST.chainMax), 'biggest chain reaction (in one second)'); tile(g6, fmt(ST.booms), 'explosions');
    tile(g6, fmt(ST.bigBlast) + ' cells', 'biggest explosion (cells blown apart)'); tile(g6, boomName(ST.bigBoom), 'most powerful blast');
    tile(g6, fmt(ST.boomsMinuteMax), 'most explosions in one minute');
    const bs = ST.boomsBySize; tile(g6, `${fmt(bs.small)} · ${fmt(bs.tnt)} · ${fmt(bs.c4)} · ${fmt(bs.huge)}`, 'explosions by size: gunpowder · TNT · C4 · huge');
    tile(g6, fmt(ST.crater), 'cells blasted (craters dug)'); tile(g6, fmt(ST.launched), 'creatures caught in blasts'); tile(g6, fmt(ST.rec.booms), 'most explosions in one session');
    // 7. Weather
    const g7 = section('Weather & sky');
    tile(g7, fmt(ST.sunrises), 'sunrises watched'); tile(g7, fmt(ST.lightning), 'lightning strikes'); tile(g7, fmt(ST.storms), 'storms formed');
    tile(g7, fmt(ST.rain), 'raindrops and snowflakes'); tile(g7, fmtTime(ST.dayMs), 'daytime played'); tile(g7, fmtTime(ST.nightMs), 'nighttime played');
    // 8. Nature
    const g8 = section('Nature & plant life');
    tile(g8, fmt(ST.plants), 'plants grown'); tile(g8, fmt(ST.mostPlants), 'most plants in one world'); tile(g8, fmt(ST.seeds), 'seeds sprouted'); tile(g8, fmt(ST.rec.plants), 'most plant growth in one session');
    // 9. Creatures
    const g9 = section('Creatures & life');
    tile(g9, fmt(ST.popMax), 'biggest population'); tile(g9, fmt(ST.born), 'creatures spawned or born');
    const spFound = ORDER.filter((m) => MATS[m].creature && world.discovered[m]).length + live.filter((m) => MATS[m].creature).length;
    tile(g9, fmt(spFound), 'species discovered');
    tile(g9, species.slice(0, 5).map(([k, n]) => nm(+k) + ' ' + fmt(n)).join(' · ') || '—', 'population by species (top 5)', 'wide');
    tile(g9, species.length ? nm(+species[0][0]) : '—', 'most common species');
    tile(g9, fmt(ST.hatched), 'eggs hatched'); tile(g9, fmt(ST.lost), 'creatures lost');
    tile(g9, deaths.length ? DEATH[deaths[0][0]] || deaths[0][0] : '—', 'most common cause of death');
    tile(g9, fmtTime(ST.oldest * 1000 / 60), 'longest-living creature');
    tile(g9, fmt(ST.steps), 'creature steps'); tile(g9, fmt(ST.flyDist), 'flying distance (cells)'); tile(g9, fmt(ST.swimDist), 'swimming distance (cells)');
    tile(g9, fmt(ST.frogs), 'frogs raised'); tile(g9, fmt(ST.bugs), 'bugs eaten');
    tile(g9, `${fmt(ST.jumps)} · ${fmt(ST.falls)} · ${fmt(ST.kos)}`, 'Stickman jumps · falls · knockouts'); tile(g9, fmt(ST.stickDist), 'Stickman walking distance (cells)');
    // 10. Alchemy
    const g10 = section('Alchemy & discoveries');
    tile(g10, `${found + live.length}`, 'total discoveries'); tile(g10, `${found} / ${total}`, 'built-in discoveries'); tile(g10, Math.round(100 * found / Math.max(1, total)) + '%', 'discovery completion');
    const bars = document.createElement('div'); bars.className = 'stat wide';
    builtIn.forEach(({ grp, items }) => {
      if (!items.length) return; const f = items.filter((m) => world.discovered[m]).length;
      const row = document.createElement('div'); row.className = 'bar-row'; row.innerHTML = '<span></span><div class="bar"><i></i></div><em></em>';
      row.children[0].textContent = grp.label; row.querySelector('i').style.width = Math.round(100 * f / items.length) + '%'; row.children[2].textContent = f + ' / ' + items.length; bars.append(row);
    });
    g10.append(bars);
    tile(g10, fmt(ST.brews), 'brews'); tile(g10, fmt(ST.brewNew), 'successful brews (something new)'); tile(g10, fmt(ST.brewKnown), 'repeat brews'); tile(g10, fmt(ST.brewFizzle + ST.brewVoid), 'failed brews');
    tile(g10, fmt(Object.keys(ST.combos).length), 'different combinations tried');
    const fav = topOf(ST.ingr, (k) => MATS[k] && !MATS[k].hidden)[0]; tile(g10, fav ? nm(+fav[0]) : '—', fav ? `most-used ingredient (${fmt(fav[1])}×)` : 'most-used ingredient');
    tile(g10, ST.firstFind ? ST.firstFind.name : '—', ST.firstFind ? 'first discovery since stats began, ' + fmtDate(ST.firstFind.at) : 'first discovery');
    tile(g10, ST.lastFindName || '—', ST.lastFind ? 'latest discovery, ' + fmtDate(ST.lastFind) : 'latest discovery');
    tile(g10, fmt(ST.bestStreak), 'longest streak of new finds'); tile(g10, fmt(ST.streak), 'current streak');
    tile(g10, fmt(ST.best5min), 'most new discoveries within 5 minutes');
    const dep = recipeDepths(); let rare = 0, rareD = 0; dep.forEach((d, m) => { if (d > rareD) { rareD = d; rare = m; } });
    tile(g10, rare ? nm(rare) : '—', rare ? `rarest discovery (${rareD} brews from the start)` : 'rarest discovery');
    const complex = inventions.filter((r) => MATS[r.id] && !MATS[r.id].hidden).sort((a, b) => ((b.parts || []).length || 2) - ((a.parts || []).length || 2))[0];
    tile(g10, complex ? MATS[complex.id].name : '—', complex ? `most complex recipe (${(complex.parts || []).length || 2} ingredients)` : 'most complex recipe');
    tile(g10, `${fmt(ST.brew2)} · ${fmt(ST.brew3)} · ${fmt(ST.brew4)}`, '2 · 3 · 4-ingredient brews'); tile(g10, fmt(ST.randoms), 'random brews');
    tile(g10, fmt(ST.hintsUsed), 'hints used'); tile(g10, fmt(ST.revealsUsed), 'reveals used'); tile(g10, fmt(ST.rec.newFinds), 'most discoveries in one session');
    tile(g10, ST.fastest5 ? fmtTime(ST.fastest5) : '—', 'fastest five discoveries');
    // 11. AI
    const g11 = section('Cauldron spirit & AI inventions');
    tile(g11, fmt(live.length), 'AI inventions in your book'); tile(g11, fmt(Math.max(ST.invMade, live.length)), 'lifetime AI creations');
    tile(g11, fmt(invCount()), 'inventions made'); tile(g11, fmt(ST.invDeleted), 'inventions deleted'); tile(g11, fmt(ST.invRepeat), 'times a brew gave back an invention you had');
    const favInv = topOf(ST.paintBy, (k) => MATS[k] && MATS[k].invented && !MATS[k].hidden)[0]; tile(g11, favInv ? nm(+favInv[0]) : '—', 'favorite invention (most painted)');
    tile(g11, invShelves(live).map((sh) => sh.label + ' ' + sh.items.length).join(' · ') || '—', 'inventions by shelf', 'wide');
    tile(g11, `${fmt(ST.aiOnline)} · ${fmt(ST.aiDevice)}`, 'online · on-device inventions');
    tile(g11, fmt(ST.aiReq), 'requests to the Cauldron spirit'); tile(g11, ST.aiReq ? Math.round(100 * ST.aiOk / ST.aiReq) + '%' : '—', 'spirit success rate');
    tile(g11, ST.aiOk ? (ST.aiMs / ST.aiOk / 1000).toFixed(1) + 's' : '—', 'average thinking time'); tile(g11, fmt(ST.rec.ai), 'most AI inventions in one session');
    tile(g11, fmt(favs.length), 'favorites starred');
    // 12. Saved worlds (the list lives in another store, so it fills in a moment later)
    const g12 = section('Saved worlds');
    tile(g12, ST.bigWorld ? fmt(ST.bigWorld.n) + ' cells' : '—', ST.bigWorld ? 'biggest saved world: ' + ST.bigWorld.name : 'biggest saved world');
    tile(g12, fmt(ST.worldsSaved), 'worlds saved'); tile(g12, fmt(ST.worldsLoaded), 'worlds loaded');
    const mostLoaded = tile(g12, '…', 'most-loaded world'), oldest = tile(g12, '…', 'oldest saved world');
    tile(g12, ST.divWorld ? ST.divWorld.n + ' materials' : '—', ST.divWorld ? 'most varied saved world: ' + ST.divWorld.name : 'most varied saved world');
    WDB.all().then((list) => {
      list = list || []; const ml = list.slice().sort((a, b) => (b.loads || 0) - (a.loads || 0))[0], ol = list.slice().sort((a, b) => a.at - b.at)[0];
      mostLoaded.querySelector('b').textContent = ml && ml.loads ? `${ml.name} (${ml.loads}×)` : '—';
      oldest.querySelector('b').textContent = ol ? ol.name : '—'; if (ol) oldest.querySelector('span').textContent = 'oldest saved world, ' + fmtDate(ol.at);
    }).catch(() => {});
    // 13. Fun & Hall of Fame
    const g13 = section('Fun & silly');
    tile(g13, fmt(ST.cows), 'cows swallowed by black holes'); tile(g13, fmt(ST.choc), 'things turned into chocolate');
    tile(g13, fmt(ST.brewVoid), 'brews swallowed by the Void'); tile(g13, fmt(ST.oops), 'oops moments (undo right after an explosion)');
    const g14 = section('🏆 Hall of Fame (best single session)', true);
    const R = ST.rec;
    [['Mad Scientist', fmt(R.reactions), 'reactions'], ['Master Brewer', fmt(R.newFinds), 'new discoveries'], ['Chaos Creator', fmt(R.booms), 'explosions'],
      ['Green Thumb', fmt(R.plants), 'plants grown'], ['Firestarter', fmt(R.fires), 'fires started'], ['World Builder', fmt(R.painted), 'cells painted'],
      ['Creature Keeper', fmt(ST.popMax), 'creatures at once'], ['Element Collector', fmt(ST.mostDiverse), 'materials in one world'],
      ["Spirit's Favorite", fmt(R.ai), 'AI inventions'], ['Speed Alchemist', ST.fastest5 ? fmtTime(ST.fastest5) : '—', 'for 5 discoveries']].forEach(([t, v, l]) => tile(g14, v, t + ' · ' + l, 'gold'));
    $('#stats-since').textContent = 'since ' + fmtDate(ST.since);
    $('#stats').hidden = false;
  }
  $('#open-stats').addEventListener('click', () => { $('#settings').hidden = true; openStats(); });
  $('#to-stats').addEventListener('click', () => { $('#book').hidden = true; openStats(); });
  $('#stats-close').addEventListener('click', () => { $('#stats').hidden = true; });

  /* ---------------- Performance readout ---------------- */
  let perfOn = false, perfStep = 0, perfSteps = 0, perfFrames = 0, perfT0 = performance.now();
  try { perfOn = localStorage.getItem('sandalchemy.perf') === '1'; } catch (e) { /* fine */ }
  function setPerf(v) { perfOn = !!v; $('#perf').hidden = !perfOn; $('#wp-perf').checked = perfOn; try { localStorage.setItem('sandalchemy.perf', perfOn ? '1' : '0'); } catch (e) { /* fine */ } }
  $('#wp-perf').addEventListener('change', (e) => setPerf(e.target.checked));
  function tickPerf() {
    perfFrames++;
    const now = performance.now(), dt = now - perfT0; if (dt < 500) return;
    if (perfOn) {
      const fps = perfFrames * 1000 / dt, ms = perfSteps ? perfStep / perfSteps : 0;
      const cls = fps >= 50 ? 'ok' : fps >= 30 ? 'meh' : 'bad';
      $('#perf').innerHTML = `<span class="${cls}">${Math.round(fps)} fps</span> \u00b7 ${ms.toFixed(1)} ms/step \u00b7 ${fmt(world.flying.length)} flying \u00b7 ${world.creatures.length} creatures`;
    }
    perfFrames = 0; perfStep = 0; perfSteps = 0; perfT0 = now;
  }
  setPerf(perfOn);

  /* ---------------- Day and night ----------------
     Sky modes: classic (the original look), day, night, or a cycle that follows the world's clock
     (so fast-forward speeds it up and pausing stops the sun). world.dayT: 0 sunrise, 0.25 noon,
     0.5 sunset, 0.75 midnight. At night the world dims but the glow layer doesn't, so lights shine. */
  const SKY_KEY = 'sandalchemy.sky', DAYLEN = 60 * 180; // a whole day takes 3 minutes at normal speed
  let skyMode = 'classic', glowMul = 1, skyShown = '';
  try { skyMode = localStorage.getItem(SKY_KEY) || 'classic'; } catch (e) { /* fine */ }
  const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixC = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const SKY = { dayTop: hexRGB('#4f9be0'), dayMid: hexRGB('#86c0ef'), dayBot: hexRGB('#c4e4fb'),
    nightTop: hexRGB('#151838'), nightMid: hexRGB('#0d0f28'), nightBot: hexRGB('#06071a'),
    duskTop: hexRGB('#3d3a7e'), duskMid: hexRGB('#c0607a'), duskBot: hexRGB('#ffa25e') };
  function drawStars() {
    const c = $('#stars'), r = stage.getBoundingClientRect(); c.width = Math.max(1, r.width); c.height = Math.max(1, r.height);
    const g = c.getContext('2d'); let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let k = 0; k < Math.round(r.width * r.height / 2200); k++) {
      const x = rand() * r.width, y = rand() * r.height * 0.8, a = 0.3 + rand() * 0.7, sz = rand() < 0.1 ? 2 : 1;
      g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(x, y, sz, sz);
    }
  }
  let nightDim = 0;
  function updateSky() {
    const st = stage.style, wc = canvas.style;
    if (skyMode === 'classic') {
      if (skyShown !== 'classic') { st.background = ''; wc.filter = ''; nightDim = 0; $('#sky').hidden = true; glowMul = 1; $('#world-btn-sky').hidden = true; skyShown = 'classic'; }
      return;
    }
    skyShown = skyMode; $('#sky').hidden = false;
    const t = skyMode === 'day' ? 0.25 : skyMode === 'night' ? 0.75 : (world.dayT || 0);
    const d = Math.sin(2 * Math.PI * t); // 1 at noon, -1 at midnight
    const k = Math.min(1, Math.max(0, (d + 0.25) / 0.5)), light = k * k * (3 - 2 * k);
    const dusk = Math.max(0, 1 - Math.abs(d) / 0.32) * 0.85;
    const pick = (n) => mixC(mixC(SKY['night' + n], SKY['day' + n], light), SKY['dusk' + n], dusk);
    st.background = `linear-gradient(180deg, ${css(pick('Top'))} 0%, ${css(pick('Mid'))} 62%, ${css(pick('Bot'))} 100%)`;
    // The sun crosses the sky from sunrise to sunset, the moon from sunset to sunrise.
    const arc = (el, s) => { const on = s > -0.06 && s < 1.06; el.style.display = on ? '' : 'none'; if (on) { el.style.left = (6 + 88 * s) + '%'; el.style.top = (92 - 76 * Math.sin(Math.PI * Math.min(1, Math.max(0, s)))) + '%'; } };
    arc($('#sun'), t < 0.6 ? t / 0.5 : (t - 1) / 0.5);
    arc($('#moon'), ((t + 0.5) % 1) / 0.5);
    $('#stars').style.opacity = (1 - light) * 0.95;
    // Night darkens the world. Done on the canvas itself: a CSS filter on it made Safari flash dark squares
    // around anything animating on top (like the blender ring).
    wc.filter = ''; nightDim = light > 0.98 ? 0 : 0.55 * (1 - light);
    glowMul = 1.7 - 0.95 * light; // lights look brighter in the dark
    const badge = $('#world-btn-sky'); badge.hidden = false; badge.textContent = dusk > 0.45 ? '\u{1F305}' : light > 0.5 ? '\u2600' : '\u263E';
  }
  function setSky(m) {
    skyMode = m; try { localStorage.setItem(SKY_KEY, m); } catch (e) { /* fine */ }
    document.querySelectorAll('#wp-sky button').forEach((b) => b.classList.toggle('on', b.dataset.k === m));
    skyShown = ''; updateSky();
  }
  document.querySelectorAll('#wp-sky button').forEach((b) => b.addEventListener('click', () => setSky(b.dataset.k)));
  document.querySelectorAll('#wp-sky button').forEach((b) => b.classList.toggle('on', b.dataset.k === skyMode));

  /* ---------------- Heat view ----------------
     The temperature of each 4x4 block, tinted over the world: blue is cold, clear is room
     temperature, and orange, red, yellow and white get hotter and hotter. */
  const heatCv = $('#heat'), hctx = heatCv.getContext('2d');
  let thermal = false, hImg = null, hPx = null;
  function sizeHeat() {
    heatCv.width = world.tw; heatCv.height = world.th;
    hImg = hctx.createImageData(world.tw, world.th); hPx = new Uint32Array(hImg.data.buffer);
  }
  function heatColour(v) {
    let r, g, b, a;
    if (v < 20) { const k = Math.min(1, (20 - v) / 120); r = 60 - 40 * k; g = 160 - 60 * k; b = 255; a = 0.15 + 0.6 * k; if (v > 12) a *= (20 - v) / 8; }
    else if (v < 200) { const k = (v - 20) / 180; r = 255; g = 170 - 60 * k; b = 40; a = 0.12 + 0.45 * k; if (v < 28) a *= (v - 20) / 8; }
    else if (v < 1000) { const k = (v - 200) / 800; r = 255; g = 110 - 80 * k; b = 30; a = 0.6 + 0.2 * k; }
    else { const k = Math.min(1, (v - 1000) / 2000); r = 255; g = 220 + 35 * k; b = 90 + 165 * k; a = 0.85; }
    return ((Math.round(a * 255) << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
  }
  function drawHeat() {
    if (!thermal) return;
    const T = world.temp; if (!T || !hPx || hPx.length !== T.length) { sizeHeat(); }
    for (let b = 0; b < T.length; b++) hPx[b] = heatColour(T[b]);
    hctx.putImageData(hImg, 0, 0);
  }
  function setThermal(v) {
    if (v && !thermal) ST.heatUses++;
    thermal = !!v; heatCv.hidden = !thermal; $('#wp-thermal').checked = thermal; $('#world-btn-heat').hidden = !thermal;
    if (thermal) drawHeat();
  }
  $('#wp-thermal').addEventListener('change', (e) => setThermal(e.target.checked));

  /* ---------------- Glow (bloom) ----------------
     Everything that gives off light (lava, fire, lightning, glowing inventions,
     red-hot rock) is gathered at half size, blurred, and laid over the world
     as see-through light, so it reads as soft light spilling around it. */
  const glowCv = $('#glow'), gctx = glowCv.getContext('2d'), GLOW_KEY = 'sandalchemy.glow';
  let glowOn = true; try { glowOn = localStorage.getItem(GLOW_KEY) !== '0'; } catch (e) { /* ignore */ }
  const BD = 2; // one glow pixel covers 2x2 cells
  let bw = 0, bh = 0, gA = null, gB = null, gImg = null, gPx = null, glowShown = false;
  function sizeGlow(w, h) {
    bw = Math.ceil(w / BD); bh = Math.ceil(h / BD);
    glowCv.width = bw; glowCv.height = bh;
    gA = [0, 1, 2].map(() => new Float32Array(bw * bh)); gB = [0, 1, 2].map(() => new Float32Array(bw * bh));
    gImg = gctx.createImageData(bw, bh); gPx = new Uint32Array(gImg.data.buffer); glowShown = false;
  }
  // A box blur along rows (step 1) or columns (step bw), using a running sum.
  function boxBlur(src, dst, r, rows) {
    const len = rows ? bw : bh, lines = rows ? bh : bw, step = rows ? 1 : bw, d = 1 / (2 * r + 1);
    for (let l = 0; l < lines; l++) {
      const o = rows ? l * bw : l; let sum = 0;
      for (let k = 0; k <= r && k < len; k++) sum += src[o + k * step];
      for (let k = 0; k < len; k++) {
        dst[o + k * step] = sum * d;
        const add = k + r + 1, sub = k - r;
        if (add < len) sum += src[o + add * step];
        if (sub >= 0) sum -= src[o + sub * step];
      }
    }
  }
  function drawGlow() {
    const n = world.emitN | 0;
    if (!glowOn || !n) { if (glowShown) { gctx.clearRect(0, 0, bw, bh); glowShown = false; } return; }
    const [R, G, B] = gA, W = world.w, I = world.emitI, K = world.emitK, CC = world.emitC;
    R.fill(0); G.fill(0); B.fill(0);
    for (let k = 0; k < n; k++) {
      const i = I[k], x = i % W, y = (i / W) | 0, c = CC[k] || px[i], s = K[k] / (255 * BD * BD);
      const j = ((y / BD) | 0) * bw + ((x / BD) | 0);
      R[j] += (c & 255) * s; G[j] += ((c >> 8) & 255) * s; B[j] += ((c >> 16) & 255) * s;
    }
    for (let ch = 0; ch < 3; ch++) { // two rounds of box blur look close to a soft gaussian
      const a = gA[ch], b = gB[ch];
      boxBlur(a, b, 4, true); boxBlur(b, a, 4, false); boxBlur(a, b, 3, true); boxBlur(b, a, 3, false);
    }
    const gain = 3.2 * glowMul / 255;
    for (let j = 0; j < bw * bh; j++) {
      const r = R[j], g = G[j], b = B[j];
      if (r + g + b < 1) { gPx[j] = 0; continue; } // see-through where nothing glows
      // Soft roll-off so big lava lakes glow without turning into a white blob.
      const lr = 1 - Math.exp(-r * gain), lg = 1 - Math.exp(-g * gain), lb = 1 - Math.exp(-b * gain), m = Math.max(lr, lg, lb);
      if (m < 0.004) { gPx[j] = 0; continue; }
      // Stored as see-through light (strength = how bright it is), so the "screen" blend also lights the empty sky.
      const k = 255 / m;
      gPx[j] = (((255 * m) << 24) | (((lb * k) & 255) << 16) | (((lg * k) & 255) << 8) | ((lr * k) & 255)) >>> 0;
    }
    gctx.putImageData(gImg, 0, 0); glowShown = true;
  }
  $('#glow-on').checked = glowOn;
  $('#glow-on').addEventListener('change', (e) => { glowOn = e.target.checked; try { localStorage.setItem(GLOW_KEY, glowOn ? '1' : '0'); } catch (err) { /* ignore */ } });

  /* ---------------- Sound ----------------
     Every sound is made on the spot with the browser's Web Audio (no sound files).
     Browsers only allow sound after the first tap or key press, so it wakes up then. */
  const SND = (() => {
    const KEY = 'sandalchemy.sound';
    let on = true, vol = 0.6, amb = true;
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) { on = s.on !== false; amb = s.amb !== false; vol = Math.max(0, Math.min(1, +s.vol >= 0 ? +s.vol : 0.6)); } } catch (e) { /* defaults */ }
    let ctx = null, out = null, noise = null, brown = null, grit = null, voices = 0;
    const last = {};
    function wake() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
        try { ctx = new AC(); } catch (e) { return null; }
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(ctx.destination);
        out = ctx.createGain(); out.gain.value = on ? vol * vol : 0; out.connect(comp);
        noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        // Brown noise (deep, rumbly) for explosions.
        brown = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const bd = brown.getChannelData(0); let lastB = 0;
        for (let i = 0; i < bd.length; i++) { lastB = (lastB + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = lastB * 3.5; }
        // A soft clipper gives the rumble some grit.
        grit = ctx.createWaveShaper(); const curve = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.2); } grit.curve = curve; grit.connect(out);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    const ready = () => on && vol > 0 && ctx && ctx.state === 'running' && voices < 14;
    const often = (k, ms) => { const t = performance.now(); if (t - (last[k] || 0) < ms) return false; last[k] = t; return true; };
    function chain(pan) { // a gain (and a little stereo placement) feeding the master
      const g = ctx.createGain(); let head = g;
      if (pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(out); } else g.connect(out);
      return head;
    }
    function env(g, t, peak, a, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
    function track(node, end) { voices++; node.onended = () => { voices--; }; node.stop(end); }
    function tone(type, f0, f1, t, len, peak, pan) {
      const o = ctx.createOscillator(), g = chain(pan); o.type = type;
      o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + len);
      env(g, t, peak, 0.008, len); o.connect(g); o.start(t); track(o, t + len + 0.05);
    }
    function hiss(kind, f0, f1, q, t, len, peak, pan) {
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = kind; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + len);
      const g = chain(pan); env(g, t, peak, 0.004, len);
      s.connect(f); f.connect(g); s.start(t, Math.random() * 1.5); track(s, t + len + 0.05);
    }
    const S = {
      get on() { return on; }, get vol() { return vol; }, get amb() { return amb; },
      setAmb(a) { amb = a; try { localStorage.setItem(KEY, JSON.stringify({ on, vol, amb })); } catch (e) { /* fine */ } if (!a) S.ambient(null); },
      set(o, v) { on = o; vol = v; try { localStorage.setItem(KEY, JSON.stringify({ on, vol, amb })); } catch (e) { /* fine */ } if (out) out.gain.setTargetAtTime(on ? vol * vol : 0, ctx.currentTime, 0.05); if (on) wake(); },
      wake,
      sleep(s) { if (!ctx) return; if (s) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); },
      boom(power, x) { // a crack, a long rolling rumble and crackling debris; bigger blasts rumble longer
        if (!ready() || !often('boom', 90)) return;
        const t = ctx.currentTime, p = Math.min(4, power), pan = (x - 0.5) * 1.4, len = 0.9 + p * 0.45;
        hiss('bandpass', 1800, 700, 0.9, t, 0.07, Math.min(0.8, 0.35 + p * 0.12), pan); // the initial crack
        // The rumble: brown noise through a closing low-pass filter, roughed up a little.
        const s = ctx.createBufferSource(); s.buffer = brown; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.5;
        f.frequency.setValueAtTime(900 + p * 250, t); f.frequency.exponentialRampToValueAtTime(90, t + len);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.min(1, 0.55 + p * 0.15), t + 0.02);
        g.gain.setTargetAtTime(0.0001, t + 0.05, len / 3.2);
        let tail = g; if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(pn); tail = pn; }
        s.connect(f); f.connect(g); tail.connect(grit); s.start(t, Math.random() * 2); track(s, t + len + 0.3);
        // A very low push you feel more than hear (kept quiet so it isn't a drum).
        tone('sine', 55, 28, t, 0.5, Math.min(0.3, 0.1 + p * 0.05), pan);
        // Debris crackling for a moment afterwards.
        const n = 3 + Math.round(p * 2);
        for (let k = 0; k < n; k++) hiss('highpass', 1500 + Math.random() * 2500, 1200, 0.7, t + 0.08 + Math.random() * (0.25 + p * 0.12), 0.02 + Math.random() * 0.03, 0.06 + Math.random() * 0.08, pan + (Math.random() - 0.5) * 0.6);
      },
      bolt(x) { // a sharp crack, then a rumble
        if (!ready() || !often('bolt', 90)) return;
        const t = ctx.currentTime, pan = (x - 0.5) * 1.4;
        hiss('highpass', 2500, 1200, 0.8, t, 0.09, 0.55, pan);
        hiss('lowpass', 500, 70, 0.8, t + 0.03, 0.9, 0.35, pan);
      },
      portal() { if (!ready() || !often('portal', 110)) return; const t = ctx.currentTime; tone('sine', 220, 660, t, 0.16, 0.12); hiss('bandpass', 900, 2400, 3, t, 0.14, 0.05); },
      gulp() { if (!ready() || !often('gulp', 240)) return; const t = ctx.currentTime; tone('sine', 160, 55, t, 0.22, 0.09); },
      chime() { if (!ready()) return; const t = ctx.currentTime; [1046.5, 1318.5, 1568, 2093].forEach((f, k) => tone('triangle', f, f, t + k * 0.075, 0.45, 0.24)); },
      sparkle() { // a new AI invention: a bigger, shimmering run
        if (!ready()) return; const t = ctx.currentTime;
        [784, 988, 1175, 1568, 1976, 2349].forEach((f, k) => { tone('triangle', f, f, t + k * 0.06, 0.55, 0.18); tone('sine', f * 2, f * 2, t + k * 0.06 + 0.02, 0.3, 0.04); });
        hiss('highpass', 6000, 9000, 0.5, t, 0.6, 0.04);
      },
      fizzle() { if (!ready()) return; const t = ctx.currentTime; hiss('bandpass', 2200, 300, 2, t, 0.45, 0.35); },
      swallowed() { if (!ready()) return; const t = ctx.currentTime; tone('sine', 320, 38, t, 0.6, 0.3); hiss('lowpass', 400, 60, 1, t, 0.5, 0.1); },
      brewed() { if (!ready()) return; const t = ctx.currentTime; tone('triangle', 523, 523, t, 0.18, 0.1); tone('triangle', 784, 784, t + 0.08, 0.25, 0.1); },
      click() { if (!ready() || !often('click', 40)) return; tone('sine', 1500, 1100, ctx.currentTime, 0.035, 0.035); },
      /* Ambient world sounds: looping layers whose loudness follows what's on screen.
         lv = { fire, lava, water, sizzle, storm, bh, wh } (counts), or null to fade everything out. */
      layers: null,
      ambient(lv) {
        if (!ctx || ctx.state !== 'running') return;
        const now = ctx.currentTime, live = lv && amb && on;
        if (!S.layers) {
          if (!live) return;
          const loop = (buf, type, freq, q) => { const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(out); src.start(0, Math.random() * 1.5); return { f, g }; };
          const L = S.layers = {};
          L.fire = loop(noise, 'bandpass', 2600, 0.6);        // the soft roar of flames
          L.lava = loop(brown, 'lowpass', 170, 0.7);          // a deep molten rumble
          L.water = loop(noise, 'bandpass', 1100, 0.9);       // trickling and splashing
          L.sizzle = loop(noise, 'highpass', 5200, 0.7);      // water hitting something hot
          L.rain = loop(noise, 'highpass', 3200, 0.5);        // storms
          // Black holes: a deep, slowly pulsing hum.
          const bh = ctx.createGain(); bh.gain.value = 0; const bf = ctx.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 220; bf.connect(bh); bh.connect(out);
          const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator(); o1.type = 'sine'; o2.type = 'sine'; o3.type = 'sawtooth';
          [o1, o2, o3].forEach((o) => { o.connect(bf); o.start(); });
          const trem = ctx.createOscillator(), td = ctx.createGain(); trem.frequency.value = 0.35; td.gain.value = 0.35; trem.connect(td); td.connect(bh.gain); trem.start();
          L.bh = { g: bh, o: [o1, o2, o3], td };
          // White holes: a bright, shimmering chord.
          const wh = ctx.createGain(); wh.gain.value = 0; wh.connect(out);
          const shim = ctx.createOscillator(), sd = ctx.createGain(); shim.frequency.value = 5.5; sd.gain.value = 0; shim.connect(sd); sd.connect(wh.gain); shim.start();
          [880, 1318.5, 1760, 2217].forEach((f, k) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * (1 + (k - 1.5) * 0.002); const og = ctx.createGain(); og.gain.value = k === 0 ? 1 : 0.5; o.connect(og); og.connect(wh); o.start(); });
          L.wh = { g: wh, sd };
        }
        const L = S.layers, level = (n, full) => Math.min(1, Math.sqrt(Math.max(0, n) / full));
        const to = (param, v, tc) => param.setTargetAtTime(v, now, tc || 0.25);
        const z = live ? lv : { fire: 0, lava: 0, water: 0, sizzle: 0, storm: 0, bh: 0, wh: 0 };
        const fire = level(z.fire, 250), lava = level(z.lava, 900), water = level(z.water, 260), sz = level(z.sizzle, 30), rain = level(z.storm, 250);
        to(L.fire.g.gain, fire * 0.22); to(L.lava.g.gain, lava * 0.32); to(L.water.g.gain, water * 0.16); to(L.sizzle.g.gain, sz * 0.08, 0.1); to(L.rain.g.gain, rain * 0.06);
        if (water) to(L.water.f.frequency, 700 + Math.random() * 1100, 0.08); // the babble of moving water
        // Bigger black holes hum lower and louder.
        const bl = level(z.bh, 120), bf = 62 - 26 * Math.min(1, Math.sqrt(z.bh) / 25);
        to(L.bh.g.gain, bl * 0.07, 0.4); to(L.bh.td.gain, bl * 0.025, 0.4);
        L.bh.o[0].frequency.setTargetAtTime(bf, now, 0.5); L.bh.o[1].frequency.setTargetAtTime(bf * 1.503, now, 0.5); L.bh.o[2].frequency.setTargetAtTime(bf / 2, now, 0.5);
        const wl = level(z.wh, 120); to(L.wh.g.gain, wl * 0.018, 0.4); to(L.wh.sd.gain, wl * 0.008, 0.4);
        if (!live || voices > 20) return;
        // Little one-off pops on top: fire crackles and lava bubbles, more when there's more of it.
        for (let k = 0, n = Math.round(fire * 7 * Math.random()); k < n; k++) hiss('highpass', 1800 + Math.random() * 3500, 1500, 0.8, now + Math.random() * 0.12, 0.008 + Math.random() * 0.02, 0.08 + Math.random() * 0.2 * fire);
        for (let k = 0, n = Math.round(lava * 2.2 * Math.random()); k < n; k++) { const f = 70 + Math.random() * 120; tone('sine', f, f * 1.9, now + Math.random() * 0.12, 0.07 + Math.random() * 0.05, 0.08 + 0.12 * lava); }
      },
      bubbles: null,
      bubbling(onOff) { // the Cauldron bubbles while the spirit is thinking
        clearInterval(S.bubbles); S.bubbles = null;
        if (!onOff) return;
        S.bubbles = setInterval(() => { if (!ready()) return; const t = ctx.currentTime, f = 180 + Math.random() * 260; tone('sine', f, f * 2.2, t, 0.09, 0.06); }, 140);
      },
    };
    return S;
  })();
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, () => { if (SND.on) SND.wake(); }, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => SND.sleep(document.hidden));
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button') && !e.target.closest('#brew-go')) SND.click(); }, true);
  // A few times a second, see what's on screen and set the ambient sounds to match.
  let lastSteam = 0, quietNow = false, frameTick = 0;
  function sampleAmbient() {
    if (!SND.on || !SND.amb) return;
    const t = world.t, st = world.stamp, ck = world.clock, n = t.length;
    let fire = 0, lava = 0, water = 0, steam = 0, storm = 0;
    for (let i = 0; i < n; i++) {
      const m = t[i]; if (!m) continue;
      if (m === M.FIRE || m === M.COLDFIRE || m === M.GHOSTFIRE || m === M.ETERNAL) fire++;
      else if (m === M.LAVA || m === M.MOLTENGOLD) lava++;
      else if ((m === M.WATER || m === M.SEAWATER || m === M.SWAMP || m === M.ACID) && st[i] === ck) water++; // only water that's moving
      else if (m === M.STEAM) steam++;
      else if (m === M.STORM) storm++;
    }
    let bh = 0, wh = 0; const H = world.holes;
    if (H) { (H.bhC || []).forEach((c) => { bh += c.n; }); (H.whC || []).forEach((c) => { wh += c.n; }); }
    const sizzle = Math.max(0, steam - lastSteam); lastSteam = steam;
    SND.ambient({ fire, lava, water, sizzle, storm, bh, wh });
  }
  function playWorldSounds() {
    const s = world.sfx; if (!s) return;
    if (s.booms) SND.boom(s.boom + Math.min(1.5, (s.booms - 1) * 0.15), s.boomX);
    if (s.bolt) SND.bolt(s.boltX);
    if (s.portal) SND.portal();
    if (s.gulp) SND.gulp();
    if (s.booms) statBooms(s.booms, s.boom);
    ST.swallowed += s.gulp; ST.spat += s.spat || 0; ST.born += s.born || 0; ST.lost += s.lost || 0; ST.hatched += s.hatched || 0;
    ST.portalTrips += s.portal; ST.lightning += s.bolt;
    if (world.flying.length > ST.maxFlying) ST.maxFlying = world.flying.length;
    s.boom = 0; s.booms = 0; s.bolt = 0; s.portal = 0; s.gulp = 0; s.spat = 0; s.born = 0; s.lost = 0; s.hatched = 0;
  }
  $('#snd-on').checked = SND.on; $('#snd-vol').value = Math.round(SND.vol * 100);
  $('#snd-on').addEventListener('change', (e) => { SND.set(e.target.checked, SND.vol); if (!e.target.checked) { SND.ambient(null); ST.mutes++; } });
  $('#amb-on').checked = SND.amb;
  $('#amb-on').addEventListener('change', (e) => SND.setAmb(e.target.checked));
  $('#snd-vol').addEventListener('input', (e) => SND.set(SND.on, e.target.value / 100));

  /* ---------------- Main loop ---------------- */
  let saveTimer = 0;
  function writeSaveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(writeSave, 800); }
  setInterval(writeSave, 15000);
  addEventListener('pagehide', writeSave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) writeSave(); });

  function frame() {
    if (drawing && tool === BLENDER) blend(curX, curY); // keeps whirring while you hold it
    else if (drawing && tool !== ERASE && tool !== BLENDER) {
      // Holding still keeps pouring.
      const k = KIND[tool];
      if (k === K.powder || k === K.liquid || k === K.gas || k === K.fire || k === K.cloud || k === K.float || k === K.skypowder || baseOf(tool) === M.LIGHTNING) dab(curX, curY);
    }
    if ((world.frame & 7) === 0 || padShown) updateStickPad();
    if (!paused) {
      // Slow motion steps the world every few frames; fast forward steps it several times a frame.
      stepAcc += speed;
      for (let n = 0; stepAcc >= 1 && n < 4; n++, stepAcc--) {
        const t0 = performance.now(); world.step(); perfStep += performance.now() - t0; perfSteps++;
        playWorldSounds(); ST.simSteps++;
        if ((ST.simSteps % 60) === 0) tickBooms();
        if ((ST.simSteps % 30) === 0) drainTally();
        if (skyMode === 'cycle') { const was = world.dayT || 0; world.dayT = (was + 1 / DAYLEN) % 1; if (world.dayT < was) ST.sunrises++; }
      }
      if ((++frameTick & 7) === 0) sampleAmbient();
      quietNow = false;
    } else if (!quietNow) { quietNow = true; SND.ambient(null); } // paused: the world goes quiet
    world.render(px);
    ctx.putImageData(image, 0, 0);
    if (nightDim > 0) { ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(10, 12, 34, ${nightDim.toFixed(3)})`; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore(); }
    drawGlow();
    // The glow is blended into the world picture here (a CSS blend on a layer above made Safari flash dark squares).
    if (glowShown) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.imageSmoothingEnabled = true; ctx.drawImage(glowCv, 0, 0, bw * BD, bh * BD); ctx.restore(); }
    if (thermal && (frameTick & 3) === 0) drawHeat();
    if (skyMode !== 'classic' && (frameTick % 6) === 0) updateSky();
    if (!paused && (frameTick % 60) === 30) scanWorld();
    tickPerf();
    if (loupeAt) drawLoupe();
    requestAnimationFrame(frame);
  }

  addEventListener('resize', () => { clearTimeout(resize.t); resize.t = setTimeout(resize, 120); });
  resize();
  pick(tool);
  requestAnimationFrame(frame);

  /* ---------------- Install as an app ---------------- */
  (() => {
    const box = $('#install-box'), btn = $('#install-btn'), how = $('#install-how');
    const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const realSite = window.isSecureContext && /^https?:$/.test(location.protocol) && window.top === window; // not a saved file, not inside itch's frame
    if (!realSite) return;
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* no sw.js here (itch): fine */ });
    if (standalone()) return; // already installed and running as the app
    let deferred = null;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    how.textContent = ios ? 'On iPhone or iPad: tap the Share button, then \u201cAdd to Home Screen\u201d.'
      : 'Open your browser menu (\u22ee) and choose \u201cInstall app\u201d or \u201cAdd to Home screen\u201d.';
    box.hidden = false; how.hidden = false;
    addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; btn.hidden = false; how.hidden = true; });
    btn.addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      try { const r = await deferred.userChoice; if (r && r.outcome === 'accepted') box.hidden = true; } catch (e) { /* closed */ }
      deferred = null; btn.hidden = true; how.hidden = false;
    });
    addEventListener('appinstalled', () => { box.hidden = true; note('Installed! Find Sand Alchemy on your home screen.'); });
  })();

  (function debugLogUI() {
    const pre = $('#ai-log'); if (!pre) return;
    pre.textContent = aiLogLines.join('\n') || '(empty: try an on-device brew first)';
    $('#ai-log-copy').addEventListener('click', async () => {
      const text = 'Sand Alchemy ' + ($('#game-ver') ? $('#game-ver').textContent : '') + '\n' + aiLogLines.join('\n');
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { /* fall back */ }
      if (!ok) { const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); }
      note(ok ? 'Debug log copied. Paste it to Claude.' : 'Couldn\u2019t copy. Long-press the log to select it.');
    });
    $('#ai-log-clear').addEventListener('click', () => { aiLogLines = []; try { localStorage.removeItem(AILOG_KEY); } catch (e) { /* ignore */ } pre.textContent = '(empty)'; });
  })();
  /* ---------------- Start over ----------------
     Erases everything this game saved on this device (except the AI settings), then reloads fresh.
     The Erase button needs a second tap, so it can't happen by accident. */
  let eraseArmed = -1e9;
  $('#erase-btn').addEventListener('click', () => {
    const n = countFound(), inv = invCount();
    $('#erase-text').textContent = `You'll lose your world, ${n} discoveries` + (inv ? `, ${inv} inventions` : '') + (favs.length ? `, ${favs.length} favorite${favs.length === 1 ? '' : 's'}` : '') + ' and every hint and reveal.';
    eraseArmed = -1e9; $('#erase-yes').textContent = 'Erase everything'; $('#erase-yes').classList.remove('sure');
    $('#erase-confirm').hidden = false;
  });
  $('#erase-no').addEventListener('click', () => { $('#erase-confirm').hidden = true; });
  $('#erase-backup').addEventListener('click', () => { $('#backup-file').click(); });
  $('#erase-yes').addEventListener('click', () => {
    const btn = $('#erase-yes');
    if (performance.now() - eraseArmed > 4000) { // first tap: ask once more
      eraseArmed = performance.now(); btn.textContent = 'Tap again to erase'; btn.classList.remove('sure'); void btn.offsetWidth; btn.classList.add('sure'); return;
    }
    try {
      const gone = [];
      for (let k = 0; k < localStorage.length; k++) { const key = localStorage.key(k); if (key && key.startsWith('sandalchemy.') && key !== AI_KEY) gone.push(key); }
      gone.forEach((key) => localStorage.removeItem(key));
    } catch (e) { note('This browser won\u2019t let the game change its saved data.'); return; }
    restoring = true; // nothing may save the old world on the way out
    location.reload();
  });

  // The version lives here (not in index.html) so it updates with the game code.
  const GAME_VERSION = 'Oct 14, update 64';
  if ($('#game-ver')) $('#game-ver').textContent = 'Game version: ' + GAME_VERSION;
  window.SandGame = { get world() { return world; }, pick, M, writeSave, sound: SND };
})();
