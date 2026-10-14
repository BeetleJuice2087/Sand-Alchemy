/* ==========================================================================
   SAND ALCHEMY — materials
   Every material is one entry in MATS. Its "kind" decides how it moves
   (powder, liquid, gas, solid, fire, spark); its reactions decide what it
   turns into when it touches something else. Players start with the four
   `start: true` materials and discover the rest by making them happen.
   ========================================================================== */
(function () {
  'use strict';

  // Material ids. 0 is always empty space.
  const M = {
    EMPTY: 0,
    SAND: 1, WATER: 2, FIRE: 3, STONE: 4,
    STEAM: 5, SMOKE: 6, GLASS: 7, LAVA: 8, OBSIDIAN: 9, SALT: 10,
    CLOUD: 11, SNOW: 12, ICE: 13, LIGHTNING: 14, MUD: 15, PLANT: 16,
    WOOD: 17, ASH: 18, DIRT: 19, OIL: 20, GUNPOWDER: 21, ACID: 22,
    METAL: 23, RUST: 24, CRYSTAL: 25,
    // Magic: the Cauldron and what it brews.
    CAULDRON: 26, SPARKLE: 27, ESSENCE: 28, RAINBOW: 29, STARDUST: 30, GOLD: 31,
    PHILO: 32, COLDFIRE: 33, SLIME: 34, SKYSAND: 35, MIRROR: 36, VOID: 37,
    FLOWER: 38, SPIRIT: 39, FAIRY: 40, ETERNAL: 41, BUBBLE: 42, SEED: 43,
    // Crafted: everyday things brewed in the Cauldron.
    CLAY: 44, BRICK: 45, COAL: 46, DIAMOND: 47, SANDSTONE: 48,
    MOSS: 49, MUSHROOM: 50, VINE: 51, CACTUS: 52, HONEY: 53,
    SEAWATER: 54, SWAMP: 55, FOG: 56, EMBER: 57, CHARCOAL: 58, FIREWORK: 59,
    STORM: 60, MOONDUST: 61, STAR: 62,
    // More magic.
    POTION: 63, GHOSTFIRE: 64, FROSTCRYSTAL: 65, CRYSTALSEED: 66, FROSTBOMB: 67, PLASMA: 68,
    ROCKET: 69, // a firework in flight (an effect, not something to find)
    // Creatures: little animals brought to life with Life Essence. They live
    // on top of the grid (see sim.js), never inside it.
    FISH: 70, BIRD: 71, WORM: 72, FIREFLY: 73, FROG: 74, BEE: 75,
    ANT: 76, SNAIL: 77, LIZARD: 78, PENGUIN: 79, CRAB: 80,
    DRAGON: 81, COW: 82, SNAKE: 83, RABBIT: 84, JELLYFISH: 85, GHOST: 86,
    TADPOLE: 87, CATERPILLAR: 88, BUTTERFLY: 89, EGG: 90,
    // Objects: ready-made pixel builds ("stamps") made of real materials.
    HOUSE: 91, VOLCANO: 92, CHEST: 93, SNOWMAN: 94, CAMPFIRE: 95, CASTLE: 96,
    // Elements with special properties.
    GLOWSTONE: 97, GLUE: 98, BOUNCY: 99, IRON: 100, MAGNET: 101, COPPER: 102, BATTERY: 103,
    DRYICE: 104, NITRO: 105, CHOCOLATE: 106, MELTCHOC: 107, CORAL: 108,
    // Second wave of built-ins. They live at the top of the id range (EXTRA..253) so
    // inventions that players already saved (from 109 upwards) keep their ids.
    SUGAR: 227, CARAMEL: 228, CANDY: 229, COTTONCANDY: 230, WAX: 231, MELTWAX: 232, PAPER: 233,
    TAR: 234, SOAP: 235, GLITTER: 236, NEON: 237, STEEL: 238, PEARL: 239,
    OWL: 240, BAT: 241, TURTLE: 242, MOUSE: 243, OCTOPUS: 244, PHOENIX: 245, UNICORN: 246, DUCK: 247,
    LIGHTHOUSE: 248, PYRAMID: 249, IGLOO: 250, CANDLE: 251, FOUNTAIN: 252, GINGERBREAD: 253,
    WALL: 226, // took the last invention slot (saved inventions move to a free one)
    WEB: 225,
    // Third wave (Science and Space), past 255 now that the grid stores 16-bit ids.
    GRAVBOMB: 254, LN2: 255, SPONGE: 256, VIRUS: 257, CURE: 258, C4: 259, TNT: 260, THERMITE: 261,
    HYDROGEN: 262, OXYGEN: 263, PLUTONIUM: 264, ANTIMATTER: 265, VACUUM: 266, PORTALIN: 267, PORTALOUT: 268,
    BLACKHOLE: 269, WHITEHOLE: 270, STICKMAN: 271,
    // Fourth wave: earth, chemistry, magical plants and space dust.
    QUICKSAND: 272, PUMICE: 273, SULFUR: 274, MERCURY: 275, FERROFLUID: 276, MOLTENGOLD: 277, RESIN: 278, AMBER: 279,
    AEROGEL: 280, EXPLJELLY: 281, METEORITE: 282, GEODE: 283, FIREFLOWER: 284, FROSTFERN: 285, ELECMUSH: 286,
    GLOWMOSS: 287, LIQLIGHT: 288, INK: 289, NEBULA: 290, HEATCRYSTAL: 291,
  };
  // Ids from BUILTIN up to EXTRA-1, and from SLOTS2 up to COUNT-1, are kept free for things the AI
  // invents. The grid stores ids in 16 bits, so there's plenty of room: the third wave of built-ins
  // lives at 254..319 and the second block of invention slots starts at 320.
  const BUILTIN = 109, EXTRA = 225, SLOTS2 = 320, COUNT = 1024; // 820 invention slots
  const isSlot = (id) => (id >= BUILTIN && id < EXTRA) || (id >= SLOTS2 && id < COUNT);

  /* kind: how it moves.  density: heavier things sink through lighter
     liquids.  slip: how readily a powder slides off a pile (0..1).
     flam: chance per touch to catch fire.  burn: how long it burns.
     colors: two ends of a shade range (each grain gets a random shade).
     alpha: 0..255 for see-through things. */
  const MATS = [];
  function def(id, o) { MATS[id] = Object.assign({ id, kind: 'solid', density: 5, slip: 0.9, flam: 0, burn: 0, alpha: 255 }, o); }

  def(M.EMPTY, { key: 'empty', name: 'Empty', kind: 'empty', density: 0, colors: ['#000000', '#000000'], alpha: 0 });

  def(M.SAND, { key: 'sand', name: 'Sand', kind: 'powder', density: 2.5, start: true,
    colors: ['#f0d27a', '#d6a84e'], desc: 'Falls and piles up.' });
  def(M.WATER, { key: 'water', name: 'Water', kind: 'liquid', density: 1, spread: 5, start: true,
    colors: ['#3d86e6', '#2f6fcf'], alpha: 230, desc: 'Flows and fills.' });
  def(M.FIRE, { key: 'fire', name: 'Fire', kind: 'fire', density: 0, start: true,
    colors: ['#fff1a0', '#e8401c'], desc: 'Burns things. Rises and flickers.' });
  def(M.STONE, { key: 'stone', name: 'Stone', kind: 'solid', density: 9, start: true,
    colors: ['#767b8f', '#5a5e70'], desc: 'Solid walls and floors.' });

  def(M.STEAM, { key: 'steam', name: 'Steam', kind: 'gas', density: 0.2,
    colors: ['#dfe7f3', '#b9c6da'], alpha: 150,
    hint: 'Something hot meets something wet.', recipe: 'Water + Fire' });
  def(M.SMOKE, { key: 'smoke', name: 'Smoke', kind: 'gas', density: 0.3,
    colors: ['#a19db3', '#6e6a82'], alpha: 185,
    hint: 'What\'s left when a flame dies out?', recipe: 'Fire burning out' });
  def(M.GLASS, { key: 'glass', name: 'Glass', kind: 'solid', density: 6,
    colors: ['#b8eef7', '#8fd3e6'], alpha: 140,
    hint: 'Heat a pile of tiny grains.', recipe: 'Sand + Fire (or Lava)', desc: 'Acid can\'t eat through it.' });
  def(M.LAVA, { key: 'lava', name: 'Lava', kind: 'liquid', density: 3, spread: 1,
    colors: ['#ffb02e', '#ff4d1a'],
    hint: 'Keep the heat on something hard.', recipe: 'Stone + lots of Fire' });
  def(M.OBSIDIAN, { key: 'obsidian', name: 'Obsidian', kind: 'solid', density: 9,
    colors: ['#3d2d5c', '#251a3a'],
    hint: 'Cool something molten, fast.', recipe: 'Lava + Water', desc: 'Survives explosions.' });
  def(M.SALT, { key: 'salt', name: 'Salt', kind: 'powder', density: 2.1, slip: 0.8,
    colors: ['#fbf8f1', '#dcd6ca'],
    hint: 'Boil water away… what\'s left behind?', recipe: 'Water boiled by Fire', desc: 'Melts ice.' });
  def(M.CLOUD, { key: 'cloud', name: 'Cloud', kind: 'cloud', density: 0.1,
    colors: ['#f1f4fb', '#c9d1e2'], alpha: 210,
    hint: 'Let lots of vapor gather up high.', recipe: 'Steam rising to the sky', desc: 'Makes rain.' });
  def(M.SNOW, { key: 'snow', name: 'Snow', kind: 'powder', density: 0.5, slip: 0.4,
    colors: ['#ffffff', '#dfeaff'],
    hint: 'A cloud that gets very cold.', recipe: 'Clouds high up in the sky' });
  def(M.ICE, { key: 'ice', name: 'Ice', kind: 'solid', density: 0.9,
    colors: ['#c9efff', '#93d3f2'], alpha: 225,
    hint: 'Something cold falls into water.', recipe: 'Water + Snow', desc: 'Slowly freezes water.' });
  def(M.LIGHTNING, { key: 'lightning', name: 'Lightning', kind: 'spark', density: 0,
    colors: ['#fffbe0', '#cdb8ff'],
    hint: 'Build a big enough storm.', recipe: 'Lots of Clouds', desc: 'Strikes from the sky.' });
  def(M.MUD, { key: 'mud', name: 'Mud', kind: 'powder', density: 2.6, slip: 0.25,
    colors: ['#6e4b2c', '#553820'],
    hint: 'Leave grains underwater for a while.', recipe: 'Sand under Water' });
  def(M.PLANT, { key: 'plant', name: 'Plant', kind: 'solid', density: 4, flam: 0.08, burn: 40,
    colors: ['#7fd65c', '#3f9e45'],
    hint: 'Wet earth, given a little time…', recipe: 'Mud or Dirt + Water', desc: 'Grows when it drinks water.' });
  def(M.WOOD, { key: 'wood', name: 'Wood', kind: 'solid', density: 5, flam: 0.02, burn: 160,
    colors: ['#9a6634', '#6f4520'],
    hint: 'Let a plant grow up big.', recipe: 'A fully grown Plant', desc: 'Burns slowly.' });
  def(M.ASH, { key: 'ash', name: 'Ash', kind: 'powder', density: 0.6, slip: 0.6,
    colors: ['#c4c2c8', '#8e8b94'],
    hint: 'Burn something that was alive.', recipe: 'Plant or Wood + Fire' });
  def(M.DIRT, { key: 'dirt', name: 'Dirt', kind: 'powder', density: 2.2, slip: 0.45,
    colors: ['#93683f', '#6f4b2a'],
    hint: 'Mix the remains of a fire into wet earth.', recipe: 'Ash + Mud', desc: 'Plants love it.' });
  def(M.OIL, { key: 'oil', name: 'Oil', kind: 'liquid', density: 0.8, spread: 4, flam: 0.25, burn: 70,
    colors: ['#4a3a30', '#2f2520'],
    hint: 'Bury something that once grew.', recipe: 'Plant or Wood buried under earth', desc: 'Floats on water. Very flammable.' });
  def(M.GUNPOWDER, { key: 'gunpowder', name: 'Gunpowder', kind: 'powder', density: 1.7, slip: 0.7, flam: 1, burn: 1,
    colors: ['#55535c', '#2c2b31'],
    hint: 'Ashes plus crystals from the sea…', recipe: 'Ash + Salt', desc: 'Goes boom near fire.' });
  def(M.ACID, { key: 'acid', name: 'Acid', kind: 'liquid', density: 1.1, spread: 4,
    colors: ['#b6ff5c', '#6fe02a'], alpha: 235,
    hint: 'Dirty air meets water.', recipe: 'Smoke + Water, Steam or Clouds', desc: 'Eats almost anything, except glass.' });
  def(M.METAL, { key: 'metal', name: 'Metal', kind: 'solid', density: 9,
    colors: ['#c4ccd9', '#808a9c'],
    hint: 'Let molten rock cool slowly.', recipe: 'Lava cooling down', desc: 'Survives explosions.' });
  def(M.RUST, { key: 'rust', name: 'Rust', kind: 'powder', density: 3, slip: 0.5,
    colors: ['#c4622f', '#8a3b18'],
    hint: 'Leave metal in the wet.', recipe: 'Metal + Water' });
  def(M.CRYSTAL, { key: 'crystal', name: 'Crystal', kind: 'solid', density: 8,
    colors: ['#e07bff', '#6fe6ff'],
    hint: 'Strike glass with the power of the sky.', recipe: 'Lightning + Glass', desc: 'Shimmers.' });

  /* ---------------- Magic ----------------
     The Cauldron is found like any element. Everything below it is brewed:
     two ingredients that meet inside a cauldron become something new. */
  def(M.CAULDRON, { key: 'cauldron', name: 'Cauldron', kind: 'solid', density: 9,
    colors: ['#4a4166', '#231f36'],
    hint: 'Always in your toolbar.', recipe: 'Always available',
    desc: 'The Brew pot, next to your brush: mix things together into something new.' });
  def(M.SPARKLE, { key: 'sparkle', name: 'Sparkle', kind: 'spark', density: 0, hidden: true,
    ramp: ['#fff6c2', '#e9a8ff', '#ffd76b', '#b9a6ff'] });
  def(M.ESSENCE, { key: 'essence', name: 'Life Essence', kind: 'float', density: 0.1, magic: true,
    colors: ['#b8ff8a', '#3fd17a'], alpha: 220,
    hint: 'Brew something green with something wet.', recipe: 'Plant + Water',
    desc: 'Drifts down and sprouts plants wherever it lands on earth.' });
  def(M.RAINBOW, { key: 'rainbow', name: 'Rainbow', kind: 'liquid', density: 0.95, spread: 4, magic: true,
    ramp: ['#ff5b6e', '#ff9d4a', '#ffe14d', '#6fe36b', '#4ac6ff', '#7d7cff', '#d36bff', '#ff5b6e'], alpha: 235,
    hint: 'Brew water with something that shimmers.', recipe: 'Water + Crystal', desc: 'A liquid of every colour.' });
  def(M.STARDUST, { key: 'stardust', name: 'Stardust', kind: 'powder', density: 1.2, slip: 0.9, magic: true,
    ramp: ['#fffbe6', '#ffe28a', '#c8b6ff', '#8f86ff'],
    hint: 'Brew the crystals of the sea with a magic crystal.', recipe: 'Salt + Crystal', desc: 'Glittering, drifts down slowly.' });
  def(M.GOLD, { key: 'gold', name: 'Gold', kind: 'powder', density: 8, slip: 0.55, magic: true,
    colors: ['#ffe680', '#c98f1c'],
    hint: 'The alchemist\'s dream: brew metal with something from the stars.', recipe: 'Metal + Stardust' });
  def(M.PHILO, { key: 'philo', name: 'Philosopher\'s Stone', kind: 'solid', density: 9, magic: true,
    colors: ['#ff4f7b', '#8a1440'],
    hint: 'Brew gold with a magic crystal.', recipe: 'Gold + Crystal', desc: 'Turns metal and stone it touches into gold.' });
  def(M.COLDFIRE, { key: 'coldfire', name: 'Cold Fire', kind: 'fire', density: 0, magic: true,
    colors: ['#e6fbff', '#2f8bff'],
    hint: 'Brew something frozen with a flame.', recipe: 'Ice + Fire', desc: 'A blue flame that freezes instead of burns.' });
  def(M.SLIME, { key: 'slime', name: 'Slime', kind: 'liquid', density: 1.3, spread: 1, magic: true,
    colors: ['#a6f25a', '#4fb52b'], alpha: 235,
    hint: 'Brew wet earth with something that eats.', recipe: 'Mud + Acid', desc: 'Oozes slowly and soaks up water to grow.' });
  def(M.SKYSAND, { key: 'skysand', name: 'Sky Sand', kind: 'skypowder', density: 2.5, slip: 0.9, magic: true,
    colors: ['#c8e4ff', '#86b4f0'],
    hint: 'Brew what a beach is made of with something fluffy from the sky.', recipe: 'Sand + Cloud', desc: 'Falls up.' });
  def(M.MIRROR, { key: 'mirror', name: 'Mirror', kind: 'solid', density: 9, magic: true,
    colors: ['#f2f6ff', '#9aa6c4'],
    hint: 'Brew glass with every colour.', recipe: 'Glass + Rainbow', desc: 'Copies the first thing that touches it, forever.' });
  def(M.VOID, { key: 'void', name: 'Void', kind: 'solid', density: 9, magic: true,
    ramp: ['#000000', '#140a24', '#2a0f4a', '#06020c'],
    hint: 'Brew the darkest stone with stars.', recipe: 'Obsidian + Stardust', desc: 'Swallows anything that touches it.' });
  def(M.FLOWER, { key: 'flower', name: 'Flower', kind: 'solid', density: 4, flam: 0.1, burn: 30, magic: true,
    ramp: ['#ff7eb6', '#ffd84d', '#c58cff', '#ffffff', '#ff6b6b', '#7ee0ff'],
    hint: 'Brew something green with every colour.', recipe: 'Plant + Rainbow' });
  def(M.SPIRIT, { key: 'spirit', name: 'Spirit', kind: 'float', density: 0.1, magic: true,
    colors: ['#f4f8ff', '#9fc2ff'], alpha: 150,
    hint: 'Brew smoke with the essence of life.', recipe: 'Smoke + Life Essence', desc: 'Wanders wherever it likes.' });
  def(M.FAIRY, { key: 'fairy', name: 'Fairy', kind: 'float', density: 0.1, flam: 0.4, burn: 6, magic: true,
    ramp: ['#fff6c2', '#ffb8f2', '#b8fff4', '#ffffff'],
    hint: 'Brew the essence of life with stardust.', recipe: 'Life Essence + Stardust', desc: 'Flutters about turning plants into flowers.' });
  def(M.ETERNAL, { key: 'eternal', name: 'Eternal Flame', kind: 'solid', density: 9, magic: true,
    colors: ['#ffd36b', '#ff6a1f'],
    hint: 'Brew a flame with something precious.', recipe: 'Fire + Gold', desc: 'Burns forever.' });
  def(M.BUBBLE, { key: 'bubble', name: 'Bubble', kind: 'float', density: 0.1, magic: true,
    ramp: ['#e8fbff', '#ffd1f4', '#c7fff1', '#d9ccff'], alpha: 150,
    hint: 'Brew slime with every colour.', recipe: 'Slime + Rainbow', desc: 'Floats up and pops.' });
  def(M.SEED, { key: 'seed', name: 'Seed', kind: 'powder', density: 2, slip: 0.6, magic: true,
    colors: ['#d9a35c', '#8a5a2b'],
    hint: 'Brew wood with the essence of life.', recipe: 'Wood + Life Essence', desc: 'Drop it on dirt or mud to grow a tree.' });

  /* ---------------- Crafted ----------------
     Brewed in the Cauldron from everyday things; most then behave like
     ordinary materials in the world. */
  const C = (id, o) => def(id, Object.assign({ crafted: true }, o));
  C(M.CLAY, { key: 'clay', name: 'Clay', kind: 'powder', density: 2.4, slip: 0.12,
    colors: ['#c98a63', '#a3664a'], hint: 'Brew wet earth with beach grains.', recipe: 'Mud + Sand', desc: 'Sticky. Bakes into brick in fire.' });
  C(M.BRICK, { key: 'brick', name: 'Brick', kind: 'solid', density: 8,
    colors: ['#c4553a', '#8e3423'], hint: 'Bake something sticky and earthy.', recipe: 'Clay + Fire', desc: 'A sturdy building block.' });
  C(M.COAL, { key: 'coal', name: 'Coal', kind: 'powder', density: 2, slip: 0.5, flam: 0.1, burn: 230,
    colors: ['#3a3a40', '#18181c'], hint: 'Press old wood under heavy rock.', recipe: 'Wood + Stone', desc: 'Burns for a long time.' });
  C(M.DIAMOND, { key: 'diamond', name: 'Diamond', kind: 'solid', density: 9,
    ramp: ['#ffffff', '#c8f6ff', '#9fe8ff', '#e9f2ff'], hint: 'Squeeze coal with fierce heat.', recipe: 'Coal + Lava', desc: 'Sparkles. Nothing can break it.' });
  C(M.SANDSTONE, { key: 'sandstone', name: 'Sandstone', kind: 'solid', density: 8,
    colors: ['#e8c88a', '#c49c5c'], hint: 'Press beach grains into rock.', recipe: 'Sand + Stone' });
  C(M.MOSS, { key: 'moss', name: 'Moss', kind: 'solid', density: 4, flam: 0.05, burn: 25,
    colors: ['#5f9a3c', '#3b6b28'], hint: 'Something green that clings to rock.', recipe: 'Plant + Stone', desc: 'Creeps over stone near water.' });
  C(M.MUSHROOM, { key: 'mushroom', name: 'Mushroom', kind: 'solid', density: 4, flam: 0.08, burn: 30,
    ramp: ['#e8463c', '#ffffff', '#c7342b', '#f3e6d8'], hint: 'Grows on damp, rotting wood.', recipe: 'Mud + Wood' });
  C(M.VINE, { key: 'vine', name: 'Vine', kind: 'solid', density: 4, flam: 0.08, burn: 30,
    colors: ['#6fcf4b', '#2f8a3a'], hint: 'A plant that climbs a tree.', recipe: 'Plant + Wood', desc: 'Hangs down and grows longer.' });
  C(M.CACTUS, { key: 'cactus', name: 'Cactus', kind: 'solid', density: 4, flam: 0.01, burn: 40,
    colors: ['#58b86a', '#2e8045'], hint: 'A plant that lives in the desert.', recipe: 'Plant + Sand', desc: 'Grows tall on sand, needs no water.' });
  C(M.HONEY, { key: 'honey', name: 'Honey', kind: 'liquid', density: 1.4, spread: 1,
    colors: ['#ffc533', '#e08a00'], alpha: 240, hint: 'What bees make from flowers.', recipe: 'Flower + Life Essence', desc: 'Thick and slow.' });
  C(M.SEAWATER, { key: 'seawater', name: 'Sea Water', kind: 'liquid', density: 1.03, spread: 5,
    colors: ['#1f8ea8', '#156b86'], alpha: 230, hint: 'Water with the taste of the ocean.', recipe: 'Water + Salt', desc: 'Boils away into steam and salt.' });
  C(M.SWAMP, { key: 'swamp', name: 'Swamp', kind: 'liquid', density: 1.1, spread: 2,
    colors: ['#5c6b2e', '#3c4a1e'], alpha: 240, hint: 'Clingy green stuff in water.', recipe: 'Moss + Water', desc: 'Murky. Burps up bubbles.' });
  C(M.FOG, { key: 'fog', name: 'Fog', kind: 'gas', density: 0.15,
    colors: ['#d7dbe8', '#aab1c6'], alpha: 120, hint: 'A cloud that comes down to earth.', recipe: 'Cloud + Dirt', desc: 'Hangs low and drifts.' });
  C(M.EMBER, { key: 'ember', name: 'Ember', kind: 'powder', density: 1.5, slip: 0.6,
    colors: ['#ffb347', '#d2381c'], hint: 'Ashes that are still glowing.', recipe: 'Fire + Ash', desc: 'Glows hot and sets things alight.' });
  C(M.CHARCOAL, { key: 'charcoal', name: 'Charcoal', kind: 'powder', density: 1.6, slip: 0.5, flam: 0.03, burn: 255,
    colors: ['#4b4a52', '#26252b'], hint: 'Wood that smouldered in smoke.', recipe: 'Wood + Smoke', desc: 'Burns very slowly.' });
  C(M.FIREWORK, { key: 'firework', name: 'Firework', kind: 'powder', density: 1.7, slip: 0.7, flam: 1, burn: 1,
    ramp: ['#ff5b6e', '#ffd84d', '#6fe36b', '#4ac6ff', '#d36bff'], hint: 'Gunpowder with a sprinkle of stars.', recipe: 'Gunpowder + Stardust', desc: 'Light it and watch the sky.' });
  C(M.STORM, { key: 'storm', name: 'Storm', kind: 'cloud', density: 0.1,
    colors: ['#6b6f8a', '#3d4058'], alpha: 230, hint: 'A cloud full of lightning.', recipe: 'Cloud + Lightning', desc: 'Pours rain and throws lightning.' });
  C(M.MOONDUST, { key: 'moondust', name: 'Moon Dust', kind: 'powder', density: 0.9, slip: 0.95,
    colors: ['#e3e7f5', '#a9b0cc'], hint: 'Rock touched by the stars.', recipe: 'Stone + Stardust', desc: 'Floats down gently, as if there were no gravity.' });
  C(M.STAR, { key: 'star', name: 'Star', kind: 'solid', density: 9,
    ramp: ['#fffbe6', '#ffe58a', '#ffffff', '#ffd24d'], hint: 'Stardust set on fire.', recipe: 'Stardust + Fire', desc: 'Shines and sheds sparkles.' });

  // More magic.
  def(M.POTION, { key: 'potion', name: 'Potion', kind: 'liquid', density: 1.05, spread: 4, magic: true,
    ramp: ['#ff6fd8', '#b45cff', '#ff9bf0', '#8f4dff'], alpha: 235,
    hint: 'Water with the essence of life.', recipe: 'Water + Life Essence', desc: 'Heals: ash grows back, rust turns back to metal.' });
  def(M.GHOSTFIRE, { key: 'ghostfire', name: 'Ghost Fire', kind: 'fire', density: 0, magic: true,
    colors: ['#d9ffd2', '#2fd17a'], hint: 'A flame with a spirit in it.', recipe: 'Fire + Spirit', desc: 'A green flame that only burns living things.' });
  def(M.FROSTCRYSTAL, { key: 'frostcrystal', name: 'Frost Crystal', kind: 'solid', density: 9, magic: true,
    ramp: ['#e6fbff', '#9fe3ff', '#c9d4ff', '#ffffff'], hint: 'Ice with a magic crystal inside.', recipe: 'Ice + Crystal', desc: 'Freezes water and lava around it.' });
  def(M.CRYSTALSEED, { key: 'crystalseed', name: 'Crystal Seed', kind: 'powder', density: 2, slip: 0.6, magic: true,
    ramp: ['#e07bff', '#6fe6ff'], hint: 'A seed that grows something shiny.', recipe: 'Seed + Crystal', desc: 'Drop it on earth or stone to grow crystal spires.' });
  def(M.FROSTBOMB, { key: 'frostbomb', name: 'Frost Bomb', kind: 'powder', density: 1.7, slip: 0.7, flam: 1, burn: 1, magic: true,
    colors: ['#cfefff', '#6fb6e6'], hint: 'Gunpowder packed with snow.', recipe: 'Gunpowder + Snow', desc: 'Explodes into ice and snow.' });
  def(M.PLASMA, { key: 'plasma', name: 'Plasma', kind: 'gas', density: 0.1, magic: true,
    ramp: ['#ffffff', '#e2a6ff', '#9b5cff', '#ff7ae6'], alpha: 230, hint: 'Fire with lightning in it.', recipe: 'Fire + Lightning', desc: 'Crackling, glowing gas. Sets things alight.' });
  def(M.ROCKET, { key: 'rocket', name: 'Rocket', kind: 'rocket', density: 0, hidden: true, colors: ['#fff6c2', '#ffb347'] });

  /* Creatures. sprite: frames drawn facing right, one string per row ('.' is
     see-through); pal: the colour for each letter; ax/ay: which pixel sits on
     the creature's own cell. */
  function creature(id, o) { def(id, Object.assign({ kind: 'creature', density: 1, creature: true }, o)); }
  creature(M.FISH, { key: 'fish', name: 'Fish', colors: ['#ffb05a', '#e8662a'],
    hint: 'Life Essence + the sea.', recipe: 'Sea Water + Life Essence', desc: 'Swims in water. Flops on land.',
    pal: { o: '#ff9a3c', O: '#ffd27a', t: '#e8662a', e: '#1a1030' }, ax: 2, ay: 1,
    sprite: { swim: [['t.oO.', '.ooOe', 't.oo.'], ['..oO.', 'tooOe', '..oo.']] } });
  creature(M.BIRD, { key: 'bird', name: 'Bird', colors: ['#8cc4ff', '#3d7fd6'],
    hint: 'Life Essence + the sky.', recipe: 'Cloud + Life Essence', desc: 'Flies about and lands to rest.',
    pal: { b: '#5aa7ff', w: '#a9d6ff', k: '#ffb347', e: '#14102a' }, ax: 2, ay: 1,
    sprite: { fly: [['w.w..', '.bbek', '.....'], ['.....', '.bbek', 'w.w..']], sit: [['.....', '.bbek', '..k..']] },
    abil: { lays: [M.BIRD, 0.0008] } });
  creature(M.WORM, { key: 'worm', name: 'Worm', colors: ['#ffa3b8', '#c45f7a'],
    hint: 'Life Essence + wet earth.', recipe: 'Mud + Life Essence', desc: 'Digs through soil and turns sand into dirt.',
    pal: { p: '#f08aa3', P: '#c4607b', h: '#ffb8c8' }, ax: 2, ay: 1,
    sprite: { crawl: [['.....', 'pPpPh'], ['.pP..', 'p..ph']] } });
  creature(M.FIREFLY, { key: 'firefly', name: 'Firefly', colors: ['#e8ff7a', '#8aa82a'],
    hint: 'Life Essence + a glowing coal.', recipe: 'Ember + Life Essence', desc: 'Blinks and glows.',
    pal: { k: '#4a3d22', g: '#e4ff6a', d: '#7d8c35', w: '#d6ecff' }, ax: 0, ay: 1,
    sprite: { on: [['w.', 'kg']], off: [['w.', 'kd']] } });
  creature(M.FROG, { key: 'frog', name: 'Frog', colors: ['#6ee07a', '#2f8f3c'],
    hint: 'Life Essence + murky water.', recipe: 'Swamp + Life Essence', desc: 'Hops about and snaps up bugs.',
    pal: { g: '#4fc35a', G: '#2f8f3c', e: '#f4ff9c' }, ax: 2, ay: 2,
    sprite: { sit: [['...ge', '..ggg', '.GG.G']], jump: [['...ge', 'gggg.', 'G....']] },
    abil: { lays: [M.TADPOLE, 0.0006] } });
  creature(M.BEE, { key: 'bee', name: 'Bee', colors: ['#ffd84a', '#2a2010'],
    hint: 'Life Essence + something sweet.', recipe: 'Honey + Life Essence', desc: 'Visits flowers and makes honey.',
    pal: { y: '#ffd23a', k: '#2a2010', w: '#e6f4ff' }, ax: 1, ay: 1,
    sprite: { fly: [['.ww.', 'ykyk'], ['....', 'ykyk']] } });

  // Walkers: they stroll along the ground, step up over bumps, and some climb walls.
  creature(M.ANT, { key: 'ant', name: 'Ant', colors: ['#e05a3a', '#7a1f16'],
    hint: 'Life Essence + a grain of sand.', recipe: 'Sand + Life Essence', desc: 'Climbs walls and carries grains about.',
    pal: { k: '#c0392b', K: '#e8664a', l: '#7a1f16' }, ax: 2, ay: 1,
    sprite: { walk: [['kkKk', 'l.l.'], ['kkKk', '.l.l']] } });
  creature(M.SNAIL, { key: 'snail', name: 'Snail', colors: ['#d39a4a', '#8a5320'],
    hint: 'Life Essence + something green and damp.', recipe: 'Moss + Life Essence', desc: 'Slow. Climbs walls and nibbles plants.',
    pal: { s: '#d39a4a', S: '#8a5320', b: '#e3d3ae', e: '#3a2a1a' }, ax: 3, ay: 2,
    sprite: { walk: [['.ss..e', 'sSsbb.', 'bbbbb.'], ['.ss...', 'sSsbbe', 'bbbbb.']] } });
  creature(M.LIZARD, { key: 'lizard', name: 'Lizard', colors: ['#e8b04a', '#b77a22'],
    hint: 'Life Essence + a prickly desert plant.', recipe: 'Cactus + Life Essence', desc: 'Darts about and catches bugs.',
    pal: { t: '#b77a22', g: '#e8b04a', E: '#2a1a0a', l: '#a06818' }, ax: 3, ay: 1,
    sprite: { walk: [['ttgggE', '.l..l.'], ['ttgggE', 'l..l..']] } });
  creature(M.PENGUIN, { key: 'penguin', name: 'Penguin', colors: ['#3a4066', '#f2f4ff'],
    hint: 'Life Essence + something icy.', recipe: 'Snow + Life Essence', desc: 'Waddles, slides on ice and catches fish.',
    pal: { k: '#262b48', w: '#f2f4ff', y: '#ffb347' }, ax: 1, ay: 3,
    sprite: { walk: [['.kk.', 'kwwy', 'kww.', '.yy.'], ['.kk.', 'kwwy', 'kww.', 'y..y']], swim: [['....', '....', 'kkkky', '.www.']] } });
  creature(M.CRAB, { key: 'crab', name: 'Crab', colors: ['#ff7b5a', '#b33a28'],
    hint: 'Life Essence + something salty.', recipe: 'Salt + Life Essence', desc: 'Scuttles sideways, even underwater.',
    pal: { c: '#e2523a', C: '#ff8a66', e: '#1a1010', l: '#b33a28' }, ax: 2, ay: 2,
    sprite: { walk: [['.e.e.', 'CcccC', 'l.l.l'], ['.e.e.', 'CcccC', '.l.l.']] } });


  /* Creatures with abilities. Besides how they move, creatures can have:
     graze (eats these materials), leaves (drops this after a few meals),
     flee (creature kinds it runs from; it always runs from fire), fireproof,
     glow ([r, g, b]), breath (breathes this element), trail ([material, chance]),
     lays ([kind, chance]), grows ([kind, frames]). The AI can mix these later. */
  creature(M.DRAGON, { key: 'dragon', name: 'Dragon', colors: ['#ff6b4a', '#a01e2a'],
    hint: 'A lizard that swallowed a flame that never goes out.', recipe: 'Lizard + Eternal Flame', desc: 'Flies, breathes fire and is fireproof. Lays eggs.',
    pal: { r: '#d93a3a', h: '#ff6b4a', w: '#ffb347', e: '#ffe066', l: '#8a1a22' }, ax: 4, ay: 2,
    sprite: { fly: [['...ww..e.', '..wwwwhhh', '.rrrrrrh.', 'r..l..l..'], ['.......e.', '.rrrrrhhh', 'r.wwwwrh.', '...l..l..']] },
    abil: { fireproof: true, breath: M.FIRE, trail: [M.SMOKE, 0.04], lays: [M.DRAGON, 0.0003] } });
  creature(M.COW, { key: 'cow', name: 'Cow', colors: ['#f2f2f2', '#2a2a2a'],
    hint: 'Life Essence + grass.', recipe: 'Plant + Life Essence', desc: 'Grazes on plants and leaves dirt behind. Scared of fire.',
    pal: { w: '#f2f2f2', k: '#2a2a2a', h: '#e4e4e4', P: '#ff9db0', l: '#5a5a5a' }, ax: 3, ay: 3,
    sprite: { walk: [['.....hh', 'wkwwwhP', 'wwkwww.', '.l..l..'], ['.....hh', 'wkwwwhP', 'wwkwww.', 'l..l...']] },
    abil: { graze: [M.PLANT, M.FLOWER, M.MOSS], leaves: M.DIRT, flee: [M.DRAGON, M.GHOST] } });
  creature(M.SNAKE, { key: 'snake', name: 'Snake', colors: ['#7fd96a', '#2f7a2a'],
    hint: 'Life Essence + a long green climber.', recipe: 'Vine + Life Essence', desc: 'Slithers about and eats frogs, ants, rabbits and eggs.',
    pal: { s: '#5cbf4a', S: '#3a8f34', h: '#7fd96a' }, ax: 4, ay: 1,
    sprite: { walk: [['..sS..hh', 'sS..sS..'], ['sS..sShh', '..sS....']] } });
  creature(M.RABBIT, { key: 'rabbit', name: 'Rabbit', colors: ['#d8b88e', '#9a7650'],
    hint: 'Life Essence + a seed to nibble.', recipe: 'Seed + Life Essence', desc: 'Leaps about, nibbles plants and runs from snakes.',
    pal: { b: '#c8a27a', h: '#d8b88e', e: '#e8cfa8', t: '#ffffff', k: '#2a1a0a' }, ax: 2, ay: 3,
    sprite: { sit: [['...e.', '..bhk', 'tbbb.', '.b.b.']], jump: [['....e', 'bbbhk', 't..b.', '.....']] },
    abil: { graze: [M.PLANT, M.FLOWER], flee: [M.SNAKE, M.DRAGON, M.GHOST] } });
  creature(M.JELLYFISH, { key: 'jellyfish', name: 'Jellyfish', colors: ['#ff9ae0', '#b84aa8'],
    hint: 'Life Essence + something wobbly.', recipe: 'Slime + Life Essence', desc: 'Drifts and pulses through water. Glows.',
    pal: { j: '#ff8ad8d0', J: '#ffd0f0e0', t: '#ff8ad890' }, ax: 2, ay: 2,
    sprite: { swim: [['.JJJ.', 'jjjjj', 't.t.t', 't.t.t', '.t.t.'], ['.JJJ.', 'jjjjj', '.t.t.', 't.t.t', 't.t..']] },
    abil: { glow: [255, 138, 216] } });
  creature(M.GHOST, { key: 'ghost', name: 'Ghost', colors: ['#eef2ff', '#9aa4d8'],
    hint: 'Life Essence + a spirit.', recipe: 'Spirit + Life Essence', desc: 'Drifts through walls. Spooks animals. Nothing can hurt it but the Void.',
    pal: { g: '#eef2ffb8', G: '#ffffffd0', k: '#2a2a4ad0' }, ax: 2, ay: 3,
    sprite: { fly: [['.GGG.', 'GgggG', 'gkgkg', 'ggggg', 'ggggg', 'g.g.g'], ['.GGG.', 'GgggG', 'gkgkg', 'ggggg', 'ggggg', '.g.g.']] },
    abil: { glow: [200, 210, 255] } });
  creature(M.TADPOLE, { key: 'tadpole', name: 'Tadpole', colors: ['#5a5a3a', '#2a2a1a'],
    hint: 'What hatches from frog eggs.', recipe: 'Frog + Water', also: 'Also hatches from eggs that frogs lay in water.', desc: 'Swims, then grows into a frog.',
    pal: { k: '#3a3a2a', t: '#7a7a5a' }, ax: 1, ay: 1,
    sprite: { swim: [['kk..', 'kktt'], ['kk.t', 'kkt.']] }, abil: { grows: [M.FROG, 2400] } });
  creature(M.CATERPILLAR, { key: 'caterpillar', name: 'Caterpillar', colors: ['#9ae04a', '#3a7a1a'],
    hint: 'A wriggly thing + a flower.', recipe: 'Worm + Flower', desc: 'Munches plants, climbs, then wraps up in a cocoon.',
    pal: { g: '#7ccf3a', y: '#e8e05a', h: '#3a7a1a', l: '#3a7a1a', c: '#c8b080', C: '#8a7448' }, ax: 2, ay: 1,
    sprite: { walk: [['gygyh', 'l.l.l'], ['.gyg.', 'g...h']], cocoon: [['.c.', 'cCc', 'cCc', '.c.']] },
    abil: { graze: [M.PLANT, M.VINE, M.MOSS], grows: [M.BUTTERFLY, 2400] } });
  creature(M.BUTTERFLY, { key: 'butterfly', name: 'Butterfly', colors: ['#7ab8ff', '#ff7ae6'],
    hint: 'What comes out of a cocoon.', recipe: 'Caterpillar + Rainbow', also: 'Also grows from a caterpillar\\u2019s cocoon.', desc: 'Flutters from flower to flower.',
    pal: { p: '#7ab8ff', q: '#ff7ae6', b: '#2a1a3a' }, ax: 2, ay: 1,
    sprite: { fly: [['pq.qp', 'pqbqp', '.p.p.'], ['..q..', '.qbq.', '..b..']] } });
  creature(M.EGG, { key: 'egg', name: 'Egg', colors: ['#f6efe0', '#d8ccb0'],
    hint: 'A bird sitting on sand… or wait for one to be laid.', recipe: 'Bird + Sand', also: 'Birds, frogs and dragons lay them too. A brewed egg hatches into a surprise!', desc: 'Hatches after a while.',
    pal: { e: '#f6efe0', E: '#d8ccb0' }, ax: 1, ay: 3,
    sprite: { sit: [['.e.', 'eee', 'eEe', '.e.']] } });

  /* Objects ("stamps"): tap to place a whole build. Each letter is a material;
     '.' leaves what's there, '_' clears to empty space. The bottom row sits
     where you tap. */
  // Objects (ready-made builds) have been taken out of the game: they're kept here, hidden, only so
  // old saves still load. Nothing brews them any more.
  function stamp(id, o) { def(id, Object.assign({ kind: 'stamp', density: 1, object: true, hidden: true, retired: true }, o)); }
  stamp(M.HOUSE, { key: 'house', name: 'House', colors: ['#b5483a', '#7a5a3a'],
    hint: 'Bricks with windows.', recipe: 'Brick + Glass', desc: 'A little house with a door and windows. Made of real brick, glass and wood.',
    key2: { W: M.WOOD, B: M.BRICK, G: M.GLASS },
    rows: ['.......WWW.......', '.....WWWWWWW.....', '...WWWWWWWWWWW...', '.WWWWWWWWWWWWWWW.', '..BBBBBBBBBBBBB..', '..BGGGB___BGGGB..', '..BGGGB___BGGGB..', '..BBBBB___BBBBB..', '..BBBBB___BBBBB..'] });
  stamp(M.VOLCANO, { key: 'volcano', name: 'Volcano', colors: ['#767b8f', '#ff6a1a'],
    hint: 'A mountain with something hot inside.', recipe: 'Stone + Lava', desc: 'A stone mountain with a lava-filled crater.',
    key2: { S: M.STONE, L: M.LAVA, O: M.OBSIDIAN },
    rows: ['......SL_LS......', '.....SSLLLSS.....', '....SSSSLSSSS....', '...SSSSSLSSSSS...', '..SSSSSOLOSSSSS..', '.SSSSSSSLSSSSSSS.', 'SSSSSSSLLLSSSSSSS'] });
  stamp(M.CHEST, { key: 'chest', name: 'Treasure Chest', colors: ['#8a5a2a', '#ffd23a'],
    hint: 'Wood and riches.', recipe: 'Wood + Gold', desc: 'A wooden chest with a pile of gold on top.',
    key2: { W: M.WOOD, g: M.GOLD, M: M.METAL },
    rows: ['...g.gg.g..', '..ggggggg..', '.WWWWWWWWW.', 'WWWWWWWWWWW', 'MMMMMgMMMMM', 'WWWWWWWWWWW', 'WWWWWWWWWWW'] });
  stamp(M.SNOWMAN, { key: 'snowman', name: 'Snowman', colors: ['#f2f8ff', '#2a2a2a'],
    hint: 'Snow with a coal smile.', recipe: 'Snow + Coal', desc: 'Packed ice with coal eyes and buttons. Melts near fire.',
    key2: { n: M.ICE, c: M.COAL, o: M.RUST, W: M.WOOD },
    rows: ['....nnn....', '...ncncn...', '...nnonn...', '....nnn....', '..nnnnnnn..', 'W.nnncnnn.W', '.WnnnnnnnW.', '..nnncnnn..', '.nnnnnnnnn.', 'nnnnncnnnnn', 'nnnnnnnnnnn', '.nnnnnnnnn.'] });
  stamp(M.CAMPFIRE, { key: 'campfire', name: 'Campfire', colors: ['#ff9a2e', '#7a5a3a'],
    hint: 'Logs and a glowing coal.', recipe: 'Wood + Ember', desc: 'Logs, embers and a ring of stones. It really burns.',
    key2: { W: M.WOOD, E: M.EMBER, F: M.FIRE, S: M.STONE },
    rows: ['....F.F....', '...FFFFF...', '....EEE....', '..WWEEEWW..', 'SSWWWWWWWSS'] });
  stamp(M.CASTLE, { key: 'castle', name: 'Castle', colors: ['#8a8fa3', '#5a5e70'],
    hint: 'Stone walls built with bricks.', recipe: 'Brick + Stone', desc: 'Stone towers, windows and a big gate.',
    key2: { S: M.STONE, G: M.GLASS, B: M.BRICK },
    rows: ['S.S.S.......S.S.S', 'SSSSS.S.S.S.SSSSS', 'SSGSSSSSSSSSSSGSS', 'SSSSSSSSSSSSSSSSS', 'SSSSSSSGSGSSSSSSS', 'SSSSSSBBBBBSSSSSS', 'SSSSSB_____BSSSSS', 'SSSSSB_____BSSSSS', 'SSSSSB_____BSSSSS', 'SSSSSB_____BSSSSS'] });


  /* Elements with special properties ("props"). Any element can use these;
     the AI will be able to mix them later:
       glow [r,g,b]       lights up the dark around it
       sticky             clings to things, and loose grains stick to it
       bounce             grains bounce when they land
       magnet / attracted magnets pull attracted things towards them
       conducts / power   carries electricity / makes it
       evaporates [m, p]  slowly turns into m
       volatile           explodes when it lands hard or touches fire
       melts [m, p]       turns into m near heat;  freezes [m, p] near cold
       sets [m, p]        slowly turns into m on its own (cooling down)
       grows [into, p]    grows through these materials (with limited energy) */
  C(M.GLOWSTONE, { key: 'glowstone', name: 'Glowstone', kind: 'solid', density: 9, magic: true, crafted: false,
    colors: ['#fff6b0', '#e8c24a'], hint: 'A stone that swallowed a firefly.', recipe: 'Stone + Firefly', desc: 'Glows in the dark.',
    props: { glow: [255, 230, 140] } });
  C(M.GLUE, { key: 'glue', name: 'Glue', kind: 'liquid', density: 1.2, spread: 1,
    colors: ['#f4f1e6', '#d8d2bc'], alpha: 230, hint: 'Something sweet and something slimy.', recipe: 'Honey + Slime', desc: 'Sticks to walls. Anything loose that touches it gets stuck.',
    props: { sticky: true } });
  C(M.BOUNCY, { key: 'bouncy', name: 'Bouncy Balls', kind: 'powder', density: 2, slip: 0.9,
    ramp: ['#ff5a7a', '#ffd23a', '#5ad1ff', '#9b6bff'], hint: 'Slime blown into bubbles.', recipe: 'Slime + Bubble', desc: 'Bounce when they land.',
    props: { bounce: true } });
  C(M.IRON, { key: 'iron', name: 'Iron Filings', kind: 'powder', density: 7, slip: 0.6,
    ramp: ['#25324a', '#3e5679', '#5a76a0', '#eef6ff'], hint: 'Metal ground down like sand.', recipe: 'Metal + Sand', desc: 'Pulled towards magnets.',
    props: { attracted: true } });
  C(M.MAGNET, { key: 'magnet', name: 'Magnet', kind: 'solid', density: 9,
    ramp: ['#e8403c', '#b02a2a', '#d0d4dc', '#8a8f9c'], hint: 'Metal struck by lightning.', recipe: 'Metal + Lightning', desc: 'Pulls iron filings towards it.',
    props: { magnet: true } });
  C(M.COPPER, { key: 'copper', name: 'Copper', kind: 'solid', density: 9,
    colors: ['#e0915a', '#9a5a2e'], hint: 'Metal heated until it turns orange.', recipe: 'Metal + Fire', desc: 'Carries electricity. Lightning or a battery sends sparks along it.',
    props: { conducts: true } });
  C(M.BATTERY, { key: 'battery', name: 'Battery', kind: 'solid', density: 9,
    ramp: ['#3a3a44', '#ffd23a', '#2a2a30'], hint: 'Copper that holds a lightning bolt.', recipe: 'Copper + Lightning', desc: 'Sends a pulse of electricity into copper it touches.',
    props: { power: true } });
  C(M.DRYICE, { key: 'dryice', name: 'Dry Ice', kind: 'solid', density: 8,
    colors: ['#eef6ff', '#c4d4e6'], hint: 'Ice and smoke.', recipe: 'Ice + Smoke', desc: 'Slowly turns into fog. Freezes water.',
    props: { evaporates: [M.FOG, 0.004] } });
  C(M.NITRO, { key: 'nitro', name: 'Nitro', kind: 'liquid', density: 1.1, spread: 3, flam: 1, burn: 1,
    colors: ['#d8ff6a', '#9ac43a'], alpha: 230, hint: 'Oil and gunpowder. Handle with care!', recipe: 'Oil + Gunpowder', desc: 'Flows like any liquid, but explodes the moment fire, a spark or a blast touches it.',
    props: { volatile: true } });
  C(M.CHOCOLATE, { key: 'chocolate', name: 'Chocolate', kind: 'solid', density: 6,
    colors: ['#7a4a2a', '#4a2a16'], hint: 'Mud and honey (tastier than it sounds).', recipe: 'Mud + Honey', desc: 'Melts near heat.',
    props: { melts: [M.MELTCHOC, 0.08] } });
  def(M.MELTCHOC, { key: 'meltchoc', name: 'Melted Chocolate', kind: 'liquid', density: 1.3, spread: 1,
    colors: ['#8a5230', '#5a3018'], hint: 'Warm up some chocolate.', recipe: 'Chocolate + Fire', desc: 'Sets back into chocolate as it cools, or touches ice.',
    props: { freezes: [M.CHOCOLATE, 0.1], sets: [M.CHOCOLATE, 0.0006] } });
  C(M.CORAL, { key: 'coral', name: 'Coral', kind: 'solid', density: 9,
    ramp: ['#ff7a8a', '#ffb86a', '#c86aff', '#ff6ad0'], hint: 'A crystal seed planted in the sea.', recipe: 'Crystal Seed + Sea Water', desc: 'Grows in branches through sea water.',
    props: { grows: [[M.SEAWATER, M.WATER], 0.015] } });

  /* ---------------- Second wave ---------------- */
  // Sweets
  C(M.SUGAR, { key: 'sugar', name: 'Sugar', kind: 'powder', density: 1.6, slip: 0.85,
    colors: ['#ffffff', '#ece6f0'], hint: 'Something sweet dried out with grains.', recipe: 'Honey + Sand', desc: 'Dissolves in water. Melts into caramel near heat.',
    props: { melts: [M.CARAMEL, 0.06] } });
  C(M.CARAMEL, { key: 'caramel', name: 'Caramel', kind: 'liquid', density: 1.4, spread: 1,
    colors: ['#e8a24a', '#b86a1e'], alpha: 240, hint: 'Warm up some sugar.', recipe: 'Sugar + Fire', desc: 'Gooey. Cools into candy, or sets fast on ice.',
    props: { sets: [M.CANDY, 0.0008], freezes: [M.CANDY, 0.1] } });
  C(M.CANDY, { key: 'candy', name: 'Candy', kind: 'solid', density: 6,
    ramp: ['#ff5aa0', '#ffffff', '#ff5aa0', '#ffffff', '#7ad0ff'], hint: 'Caramel that cooled down.', recipe: 'Caramel + Ice', also: 'Caramel also cools into candy on its own.', desc: 'Stripy and sweet. Melts back into caramel near heat.',
    props: { melts: [M.CARAMEL, 0.05] } });
  C(M.COTTONCANDY, { key: 'cottoncandy', name: 'Cotton Candy', kind: 'powder', density: 0.35, slip: 0.45,
    ramp: ['#ffb0dc', '#ffd0ec', '#b0d8ff', '#d0e8ff'], hint: 'Spin sugar up into the clouds.', recipe: 'Sugar + Cloud', desc: 'Fluffy and light. Vanishes in water, melts into sugar near heat.',
    props: { melts: [M.SUGAR, 0.1] } });
  // Wax and candles
  C(M.WAX, { key: 'wax', name: 'Wax', kind: 'solid', density: 4,
    colors: ['#fff4d0', '#f0dca0'], hint: 'What bees build their honeycomb from.', recipe: 'Bee + Honey', desc: 'Melts near flames and sets again as it cools.',
    props: { melts: [M.MELTWAX, 0.06] } });
  def(M.MELTWAX, { key: 'meltwax', name: 'Melted Wax', kind: 'liquid', density: 1, spread: 2, crafted: true,
    colors: ['#fff8e0', '#f4e4b0'], alpha: 235, hint: 'Hold a flame to some wax.', recipe: 'Wax + Fire', desc: 'Drips and runs, then sets back into wax.',
    props: { sets: [M.WAX, 0.002], freezes: [M.WAX, 0.1] } });
  // Everyday stuff
  C(M.PAPER, { key: 'paper', name: 'Paper', kind: 'solid', density: 2, flam: 0.6, burn: 18,
    colors: ['#fbfaf4', '#e6e2d4'], hint: 'Soak wood and press it flat.', recipe: 'Wood + Water', desc: 'Burns up in a flash.' });
  C(M.TAR, { key: 'tar', name: 'Tar', kind: 'liquid', density: 1.6, spread: 1, flam: 0.04, burn: 250,
    colors: ['#2a2626', '#121010'], hint: 'Thick black oil mixed with coal.', recipe: 'Oil + Coal', desc: 'Thick, sticky and slow. Burns for a long time.',
    props: { sticky: true } });
  C(M.SOAP, { key: 'soap', name: 'Soap', kind: 'powder', density: 1.1, slip: 0.5,
    colors: ['#ffd6ec', '#f4b8d8'], hint: 'Old-fashioned: ashes and oil.', recipe: 'Ash + Oil', desc: 'Blows bubbles in water. Cleans away oil, tar and mud.' });
  C(M.STEEL, { key: 'steel', name: 'Steel', kind: 'solid', density: 9.5,
    ramp: ['#9aa6b8', '#7a8698', '#b8c4d4', '#5a6678'], hint: 'Metal made stronger with coal.', recipe: 'Metal + Coal', desc: 'Never rusts. Shrugs off acid and explosions.' });
  // Shiny magic
  def(M.GLITTER, { key: 'glitter', name: 'Glitter', kind: 'powder', density: 1.3, slip: 0.95, magic: true,
    ramp: ['#ff7ae6', '#ffd23a', '#7ae8ff', '#b07aff', '#ffffff'], hint: 'Stardust ground with glass.', recipe: 'Stardust + Glass', desc: 'Sparkles everywhere. Gets into everything.' });
  def(M.NEON, { key: 'neon', name: 'Neon', kind: 'gas', density: 0.05, magic: true,
    colors: ['#ff6ad8', '#ff3ab0'], alpha: 200, hint: 'Lightning trapped in vapor.', recipe: 'Lightning + Steam', desc: 'A glowing gas that floats up and never fades.',
    props: { glow: [255, 90, 210] } });
  def(M.PEARL, { key: 'pearl', name: 'Pearl', kind: 'powder', density: 3, slip: 0.7, magic: true,
    colors: ['#fffaf4', '#eadcf0'], hint: 'Something shiny from the bottom of the sea.', recipe: 'Sea Water + Stardust', desc: 'Shimmers softly.',
    props: { glow: [255, 240, 250] } });
  // Walls: always in the toolbox, and nothing in the world can break them.
  def(M.WALL, { key: 'wall', name: 'Wall', kind: 'solid', density: 99, start: true, wall: true,
    colors: ['#7a7f9e', '#4a4e68'], hint: 'Always in your toolbox.', recipe: 'Always available',
    desc: 'Unbreakable. Blasts, acid, lava and the void can\u2019t touch it. Only the eraser or the clear button removes it.' });

  // Webs: spun by web-making creatures and inventions. Light and sticky, and they burn in a flash.
  def(M.WEB, { key: 'web', name: 'Web', kind: 'solid', density: 0.5, flam: 0.7, burn: 6, alpha: 190,
    colors: ['#f4f0ff', '#bfb6dc'], hint: 'Some creatures spin these.', recipe: 'Spun by web makers', desc: 'Thin sticky threads. Burns in a flash.' });

  // New creatures. These use the same movements and abilities as invented ones.
  creature(M.OWL, { key: 'owl', name: 'Owl', colors: ['#a07850', '#f0e0c0'], move: 'fly',
    hint: 'A bird that loves the moon.', recipe: 'Bird + Moon Dust', desc: 'Flies at night-time speed and snaps up bugs.',
    pal: { b: '#8a6440', d: '#5a3e24', w: '#f0e0c0', e: '#ffd23a', y: '#ff9a2e' }, ax: 3, ay: 2,
    // Wings on each side beat up and down; the body and feet stay put.
    sprite: { walk: [['d.b.b.d', 'dbebebd', '.bbwbb.', '..bbb..', '..y.y..'],
                     ['..b.b..', '.bebeb.', 'dbbwbbd', 'd.bbb.d', '..y.y..']] }, abil: { eatsBugs: true } });
  creature(M.BAT, { key: 'bat', name: 'Bat', colors: ['#4a3a5a', '#ff5a5a'], move: 'flutter',
    hint: 'A bird that turned spooky.', recipe: 'Bird + Ghost', desc: 'Flaps about in a hurry.',
    pal: { k: '#3a2a4a', e: '#ff5a5a' }, ax: 2, ay: 1,
    sprite: { walk: [['k...k', 'kkekk', '.kkk.'], ['.....', 'kkekk', 'k.k.k']] }, abil: { speed: 1.6 } });
  creature(M.TURTLE, { key: 'turtle', name: 'Turtle', colors: ['#4a8a3a', '#9ad06a'], move: 'amphibian',
    hint: 'An egg laid in the sea.', recipe: 'Egg + Sea Water', desc: 'Swims all around the water and plods about on land.',
    pal: { g: '#4a8a3a', G: '#2f6a2a', s: '#9ad06a', e: '#1a1a1a' }, ax: 4, ay: 2,
    sprite: { walk: [['..gGg...', '.gGgGgse', '.s...s..'], ['..gGg...', '.gGgGgse', '..s...s.']] }, abil: { speed: 0.8 } });
  creature(M.MOUSE, { key: 'mouse', name: 'Mouse', colors: ['#b0a8a8', '#ffb0c0'], move: 'walk',
    hint: 'Life Essence + plain dirt.', recipe: 'Dirt + Life Essence', desc: 'Scurries about nibbling seeds and flowers. Runs from snakes and owls.',
    pal: { g: '#b0a8a8', p: '#ffb0c0', k: '#1a1a1a' }, ax: 2, ay: 2,
    sprite: { walk: [['...p.', 'pgggk', '.g.g.'], ['...p.', 'pgggk', 'g.g..']] },
    abil: { speed: 1.8, graze: [M.SEED, M.FLOWER], flee: [M.SNAKE, M.OWL] } });
  creature(M.OCTOPUS, { key: 'octopus', name: 'Octopus', colors: ['#c84ab8', '#e87ad8'], move: 'swim',
    hint: 'Something wobbly + something fishy.', recipe: 'Jellyfish + Fish', desc: 'Swims with eight wiggly arms. Flops on land.',
    pal: { p: '#c84ab8', P: '#e87ad8', e: '#ffffff' }, ax: 2, ay: 1,
    sprite: { walk: [['.PPP.', 'PePeP', 'ppppp', 'p.p.p'], ['.PPP.', 'PePeP', 'ppppp', '.p.p.']] } });
  creature(M.PHOENIX, { key: 'phoenix', name: 'Phoenix', colors: ['#ff6a1a', '#ffd23a'], move: 'fly',
    hint: 'A bird with a flame that never goes out.', recipe: 'Bird + Eternal Flame', desc: 'A fireproof firebird that glows and trails sparkles.',
    pal: { r: '#ff3a1a', o: '#ff9a2e', y: '#ffd23a', e: '#2a1408', b: '#fff0a0' }, ax: 4, ay: 2,
    // Wings in the middle beat up and down; the long tail trails behind, still.
    sprite: { walk: [['...yy....', '....yo...', 'rrrooooeb', 'rr.ooo...', '.........'],
                     ['.........', '.........', 'rrrooooeb', 'rr.oyo...', '....yy...']] },
    abil: { fireproof: true, glow: [255, 160, 60], trail: [M.SPARKLE, 0.15] } });
  creature(M.UNICORN, { key: 'unicorn', name: 'Unicorn', colors: ['#ffffff', '#ff7ae6'], move: 'walk',
    hint: 'A cow that drank a rainbow.', recipe: 'Cow + Rainbow', desc: 'Prances about leaving sparkles. Glows. Runs from dragons.',
    pal: { w: '#ffffff', h: '#ffd23a', m: '#ff7ae6', M: '#7ab8ff', l: '#d8d8e8', k: '#2a2a3a' }, ax: 3, ay: 4,
    sprite: { walk: [['......h', '....mwk', 'Mwwwww.', 'wwwwww.', '.l..l..'], ['......h', '....mwk', 'Mwwwww.', 'wwwwww.', 'l..l...']] },
    abil: { speed: 1.2, glow: [255, 200, 250], trail: [M.SPARKLE, 0.1], flee: [M.DRAGON], graze: [M.FLOWER, M.PLANT] } });
  creature(M.DUCK, { key: 'duck', name: 'Duck', colors: ['#f2f2f2', '#2f8f3c'], move: 'paddle',
    hint: 'A bird that loves a pond.', recipe: 'Bird + Water', desc: 'Floats and paddles on the water, dives now and then, and waddles about on land.',
    pal: { w: '#f2f2f2', g: '#2f8f3c', o: '#ff9a2e', k: '#1a1a1a' }, ax: 2, ay: 3,
    sprite: { walk: [['...gg.', '...gko', 'wwwww.', '.o.o..'], ['...gg.', '...gko', 'wwwww.', 'o.o...']] } });

  // New objects.
  stamp(M.LIGHTHOUSE, { key: 'lighthouse', name: 'Lighthouse', colors: ['#d84a3a', '#fff6b0'],
    hint: 'A brick tower with a light on top.', recipe: 'Glowstone + Brick', desc: 'A striped tower with a glowing lamp room.',
    key2: { M: M.METAL, G: M.GLASS, Y: M.GLOWSTONE, B: M.BRICK, S: M.STONE },
    rows: ['...MMM...', '..GGGGG..', '..GYYYG..', '..GGGGG..', '...BBB...', '...SSS...', '...BBB...', '...SSS...', '...BBB...', '..SSSSS..', '.BBBBBBB.'] });
  stamp(M.PYRAMID, { key: 'pyramid', name: 'Pyramid', colors: ['#e8c88a', '#fff6b0'],
    hint: 'Desert stone with treasure on top.', recipe: 'Sandstone + Gold', desc: 'A sandstone pyramid with a glowing capstone and a secret door.',
    key2: { D: M.SANDSTONE, G: M.GLOWSTONE },
    rows: ['........G........', '.......GGG.......', '......DDDDD......', '.....DDDDDDD.....', '....DDDDDDDDD....', '...DDDDDDDDDDD...', '..DDDDDDDDDDDDD..', '.DDDDDDD_DDDDDDD.', 'DDDDDDD___DDDDDDD'] });
  stamp(M.IGLOO, { key: 'igloo', name: 'Igloo', colors: ['#d8f2ff', '#93d3f2'],
    hint: 'A snowy house made of ice blocks.', recipe: 'Ice + Snow', desc: 'A dome of ice with a little doorway.',
    key2: { I: M.ICE },
    rows: ['....IIIII....', '..IIIIIIIII..', '.IIIIIIIIIII.', 'IIIIIIIIIIIII', 'IIII_____IIII', 'IIII_____IIII'] });
  stamp(M.CANDLE, { key: 'candle', name: 'Candle', colors: ['#fff4d0', '#ff9a2e'],
    hint: 'Wax with a glowing coal for a flame.', recipe: 'Wax + Ember', desc: 'A real wax candle. The flame melts the wax and it drips!',
    key2: { F: M.FIRE, E: M.EMBER, X: M.WAX, M: M.METAL },
    rows: ['..F..', '..E..', '.XXX.', '.XXX.', '.XXX.', '.XXX.', 'MMMMM'] });
  stamp(M.FOUNTAIN, { key: 'fountain', name: 'Fountain', colors: ['#767b8f', '#3d86e6'],
    hint: 'Stone and water, together at last.', recipe: 'Stone + Water', desc: 'A stone fountain with water spilling into its basin.',
    key2: { S: M.STONE, W: M.WATER },
    rows: ['.....WWW.....', '.....SSS.....', '......S......', '......S......', 'S.....S.....S', 'SWWWWWSWWWWWS', 'SSSSSSSSSSSSS'] });
  stamp(M.GINGERBREAD, { key: 'gingerbread', name: 'Gingerbread House', colors: ['#7a4a2a', '#ff5aa0'],
    hint: 'A house you could eat.', recipe: 'Chocolate + Candy', desc: 'Chocolate walls, a candy roof and sugar-glass windows.',
    key2: { C: M.CANDY, H: M.CHOCOLATE, G: M.GLASS },
    rows: ['......CCC......', '....CCCCCCC....', '..CCCCCCCCCCC..', 'CCCCCCCCCCCCCCC', '.HHHHHHHHHHHHH.', '.HGGHHH_HHHGGH.', '.HGGHHH_HHHGGH.', '.HHHHHH_HHHHHH.'] });

  /* ---------------- Third wave: Science and Space ---------------- */
  const SCI = (id, o) => def(id, Object.assign({ science: true }, o));
  const SPACE = (id, o) => def(id, Object.assign({ space: true }, o));
  SCI(M.HYDROGEN, { key: 'hydrogen', name: 'Hydrogen', kind: 'gas', density: 0.02, flam: 1, burn: 2,
    colors: ['#e6f2ff', '#bcd8ff'], alpha: 70, hint: 'Split water with a bolt from the sky.', recipe: 'Water + Lightning',
    desc: 'The lightest gas: it races upwards. Burns with a pop and leaves water behind. Mixed with Oxygen it explodes!' });
  SCI(M.OXYGEN, { key: 'oxygen', name: 'Oxygen', kind: 'gas', density: 0.15, flam: 1, burn: 3,
    colors: ['#d8f4ff', '#a8e0ff'], alpha: 60, hint: 'What plants breathe out into the clouds.', recipe: 'Plant + Cloud',
    desc: 'Drifts about in the air. Fire roars through it, and it makes Hydrogen explode.' });
  SCI(M.LN2, { key: 'ln2', name: 'Liquid Nitrogen', kind: 'liquid', density: 0.8, spread: 4,
    colors: ['#e8fbff', '#b6ecff'], alpha: 200, hint: 'Air so cold it turned into a liquid.', recipe: 'Dry Ice + Cloud',
    desc: 'Super cold. Freezes water and lava on the spot, and boils away whenever it touches anything warmer.' });
  SCI(M.SPONGE, { key: 'sponge', name: 'Sponge', kind: 'solid', density: 1, flam: 0.15, burn: 40,
    colors: ['#ffe066', '#7a5a12'], hint: 'A soft sea creature that loves soap.', recipe: 'Coral + Soap',
    desc: 'Stays put and soaks up water (it darkens as it fills). Water spreads right through it. Heat dries it out.' });
  SCI(M.VIRUS, { key: 'virus', name: 'Virus', kind: 'liquid', density: 1.15, spread: 2, flam: 0.35, burn: 12,
    ramp: ['#c050ff', '#7a1ab8', '#e08aff', '#5a0a90'], alpha: 235, hint: 'Germs brewed from two kinds of green gunk.', recipe: 'Slime + Swamp',
    desc: 'Turns everything it touches into more virus! Fire kills it, and Cure turns infected things back.' });
  SCI(M.CURE, { key: 'cure', name: 'Cure', kind: 'liquid', density: 1.25, spread: 3,
    colors: ['#b8fff0', '#4ae0c0'], alpha: 225, hint: 'A healing potion for a sickness.', recipe: 'Virus + Potion',
    desc: 'Turns virus back into whatever it was before it got infected.' });
  SCI(M.TNT, { key: 'tnt', name: 'TNT', kind: 'solid', density: 5, flam: 1, burn: 1,
    ramp: ['#e8402a', '#b82a1a', '#e8402a', '#3a1a12'], hint: 'Gunpowder wrapped in paper.', recipe: 'Gunpowder + Paper',
    desc: 'Light it and the fuse fizzes for a moment, then BOOM. A blast sets it off straight away.' });
  SCI(M.C4, { key: 'c4', name: 'C-4', kind: 'solid', density: 5, flam: 1, burn: 1,
    colors: ['#e8e0c8', '#bdb394'], hint: 'An explosive you can shape like clay.', recipe: 'TNT + Clay',
    desc: 'Stays exactly where you put it. The biggest ordinary explosive: fire, sparks, electricity or a blast set it off.',
    props: { volatile: true } });
  SCI(M.THERMITE, { key: 'thermite', name: 'Thermite', kind: 'powder', density: 3.5, slip: 0.6, flam: 0.3, burn: 1,
    colors: ['#a0705a', '#5a3e34'], hint: 'Rust and metal powder: burns hotter than fire.', recipe: 'Rust + Iron Filings',
    desc: 'Burns white-hot once lit. Melts metal, stone and glass, and water can\u2019t put it out.' });
  SCI(M.PLUTONIUM, { key: 'plutonium', name: 'Plutonium', kind: 'powder', density: 9.5, slip: 0.4,
    colors: ['#b8ff6a', '#3a8a2a'], hint: 'A glowing stone forged with metal.', recipe: 'Glowstone + Metal',
    desc: 'Heavy, glowing and warm (it boils water). Pile too much in one place and it goes critical!',
    props: { glow: [140, 255, 90] } });
  SCI(M.ANTIMATTER, { key: 'antimatter', name: 'Anti-Matter', kind: 'gas', density: 0.1,
    ramp: ['#ffe0ff', '#ff8ae8', '#ffffff', '#c08aff'], alpha: 210, hint: 'The opposite of everything: nothing meets plasma.', recipe: 'Void + Plasma',
    desc: 'Floats about. Anything it touches is wiped out together with it, in a flash.',
    props: { glow: [255, 170, 240] } });
  SPACE(M.VACUUM, { key: 'vacuum', name: 'Vacuum', kind: 'solid', density: 9,
    ramp: ['#4a5068', '#2a2e3e', '#6a7290', '#1a1c28'], hint: 'Emptiness that wants to be filled.', recipe: 'Void + Cloud',
    desc: 'Sucks the air and anything loose nearby into itself, and it\u2019s gone.' });
  SPACE(M.PORTALIN, { key: 'portalin', name: 'Portal In', kind: 'solid', density: 99,
    colors: ['#ffc070', '#ff7a1a'], hint: 'A mirror into the void.', recipe: 'Mirror + Void',
    desc: 'Anything that falls or flows into it, even creatures, comes out of a Portal Out. Bigger brush, taller portal.',
    props: { glow: [255, 150, 50] } });
  SPACE(M.PORTALOUT, { key: 'portalout', name: 'Portal Out', kind: 'solid', density: 99,
    colors: ['#8ad8ff', '#1a7aff'], hint: 'Found together with Portal In.', recipe: 'Mirror + Void',
    desc: 'Where everything that goes into a Portal In comes back out. Bigger brush, taller portal.',
    props: { glow: [60, 150, 255] } });
  SPACE(M.BLACKHOLE, { key: 'blackhole', name: 'Black Hole', kind: 'solid', density: 99,
    ramp: ['#000000', '#12041f', '#000000', '#2a0a4a'], hint: 'A star swallowed by the void.', recipe: 'Void + Star',
    desc: 'Its gravity pulls in everything loose from far away, even creatures, and swallows it. What it swallows comes out of White Holes.',
    props: { glow: [255, 120, 40] } });
  SPACE(M.WHITEHOLE, { key: 'whitehole', name: 'White Hole', kind: 'solid', density: 99,
    ramp: ['#ffffff', '#e8f0ff', '#fffbe0', '#d8e4ff'], hint: 'A black hole seen in a mirror.', recipe: 'Black Hole + Mirror',
    desc: 'Pushes everything away with gravity, and spits out whatever Black Holes have swallowed.',
    props: { glow: [220, 235, 255] } });
  SPACE(M.GRAVBOMB, { key: 'gravbomb', name: 'Gravity Bomb', kind: 'powder', density: 4, slip: 0.3,
    ramp: ['#6a3aff', '#2a1a6a', '#9a7aff', '#1a0a3a'], hint: 'A black hole packed into a bomb.', recipe: 'Black Hole + Gunpowder',
    desc: 'Falls until it touches something and sticks there. A moment later: a huge gravity push that flings everything loose away.' });
  creature(M.STICKMAN, { key: 'stickman', name: 'Stickman', colors: ['#ffffff', '#ff4a5a'], move: 'player', player: true,
    hint: 'A drawing that came to life.', recipe: 'Paper + Life Essence',
    desc: 'You control him: arrows or the on-screen buttons to walk, jump with Space or \u2191. A long fall knocks him out and he comes back where you placed him.',
    pal: { h: '#ffd23a', k: '#ffffff', s: '#ff4a5a' }, ax: 2, ay: 7,
    sprite: { walk: [['.hhh.', '.hhh.', '.sks.', 'k.k.k', '..k..', '..k..', '.k.k.', 'k...k'],
                     ['.hhh.', '.hhh.', '.sks.', '.kkk.', '..k..', '..k..', '..k..', '.k.k.']],
              stand: [['.hhh.', '.hhh.', '.sks.', '.kkk.', 'k.k.k', '..k..', '.k.k.', '.k.k.']],
              jump: [['.hhh.', '.hhh.', 'ksksk', '..k..', '..k..', '.k.k.', 'k...k', '.....']],
              down: [['.....', '.....', '.....', '.....', '.....', '.....', 'hh.k.', 'hhkkk']] } });

  /* ---------------- Fourth wave ---------------- */
  C(M.QUICKSAND, { key: 'quicksand', name: 'Quicksand', kind: 'liquid', density: 1.9, spread: 1,
    colors: ['#d8b860', '#a8843a'], hint: 'Sand that got far too wet and swampy.', recipe: 'Sand + Swamp',
    desc: 'Looks like sand, but anything heavy sinks into it, and creatures get slowly swallowed.' });
  C(M.PUMICE, { key: 'pumice', name: 'Pumice', kind: 'powder', density: 0.7, slip: 0.6,
    colors: ['#d8d0c4', '#a89c8c'], hint: 'Lava cooled in a hurry by water.', recipe: 'Lava + Water', also: 'Lava hitting water sometimes makes it too.',
    desc: 'A light, bubbly stone. It floats on water.' });
  C(M.SULFUR, { key: 'sulfur', name: 'Sulfur', kind: 'powder', density: 2, slip: 0.6, flam: 0.5, burn: 40,
    colors: ['#fff06a', '#d8b820'], hint: 'What a volcano leaves behind: ash and lava.', recipe: 'Ash + Lava',
    desc: 'Yellow powder that burns with a blue flame and gives off thick smoke.' });
  SCI(M.MERCURY, { key: 'mercury', name: 'Mercury', kind: 'liquid', density: 13.6, spread: 3,
    ramp: ['#e8eef4', '#9aa6b4', '#ffffff', '#6a7684'], hint: 'Liquid metal: metal that flows like water.', recipe: 'Metal + Water',
    desc: 'A super heavy liquid metal. It sinks under every other liquid, sand floats on it, and it carries electricity.',
    props: { conducts: true } });
  SCI(M.FERROFLUID, { key: 'ferrofluid', name: 'Ferrofluid', kind: 'liquid', density: 1.5, spread: 2,
    ramp: ['#1a1a24', '#2a2a3a', '#0a0a10', '#4a4a64'], hint: 'Iron so fine it dissolved in oil.', recipe: 'Iron Filings + Oil',
    desc: 'A black liquid that magnets pull into clumps.',
    props: { attracted: true } });
  SCI(M.MOLTENGOLD, { key: 'moltengold', name: 'Molten Gold', kind: 'liquid', density: 8, spread: 2,
    colors: ['#fff0a0', '#ffb020'], hint: 'Gold melted by something even hotter than fire.', recipe: 'Gold + Lava', also: 'Gold that touches lava melts too.',
    desc: 'Glowing liquid gold. It cools back into gold, fast on ice.',
    props: { glow: [255, 200, 80], sets: [M.GOLD, 0.0015], freezes: [M.GOLD, 0.1] } });
  SCI(M.RESIN, { key: 'resin', name: 'Resin', kind: 'liquid', density: 1.3, spread: 1, flam: 0.3, burn: 60,
    colors: ['#ffb040', '#c87010'], alpha: 230, hint: 'Sticky stuff that oozes from trees: wood and something sweet.', recipe: 'Wood + Honey',
    desc: 'Thick and sticky: grains that touch it get stuck. Slowly hardens into amber.',
    props: { sticky: true, sets: [M.AMBER, 0.0006] } });
  SCI(M.AMBER, { key: 'amber', name: 'Amber', kind: 'solid', density: 4,
    colors: ['#ffc860', '#d8801a'], alpha: 210, hint: 'Leave some resin to harden for a long time.', recipe: 'Resin hardening',
    desc: 'Golden, glassy and see-through. Hardened resin that glows softly.',
    props: { glow: [255, 170, 60] } });
  SCI(M.AEROGEL, { key: 'aerogel', name: 'Aerogel', kind: 'powder', density: 0.08, slip: 0.9,
    colors: ['#e8f4ff', '#b8d4f0'], alpha: 140, hint: 'Glass so light it\u2019s mostly cloud.', recipe: 'Glass + Cloud',
    desc: 'The lightest solid there is: it drifts down very slowly, like a feather.' });
  SCI(M.EXPLJELLY, { key: 'expljelly', name: 'Explosive Jelly', kind: 'liquid', density: 1.2, spread: 1, flam: 1, burn: 1,
    ramp: ['#ff6a8a', '#ff3a5a', '#ffa0b8', '#d81a3a'], alpha: 235, hint: 'Slime mixed with something that goes boom.', recipe: 'Slime + Gunpowder',
    desc: 'Wobbly jelly that sticks to walls, and explodes the moment fire or a spark touches it.',
    props: { sticky: true, volatile: true } });
  SPACE(M.METEORITE, { key: 'meteorite', name: 'Meteorite', kind: 'powder', density: 9, slip: 0.3,
    ramp: ['#5a4a42', '#3a302a', '#8a6a52', '#2a2220'], hint: 'A falling star that turned to stone.', recipe: 'Star + Stone',
    desc: 'A heavy space rock. It falls fast, trailing sparks, and the farther it falls the bigger the crash.' });
  C(M.GEODE, { key: 'geode', name: 'Geode', kind: 'solid', density: 8,
    colors: ['#8a8478', '#5e5a52'], hint: 'A stone with a crystal seed hidden inside.', recipe: 'Stone + Crystal Seed',
    desc: 'Looks like a plain rock, but blow it up and it breaks open into crystals.' });
  def(M.FIREFLOWER, { key: 'fireflower', name: 'Fire Flower', kind: 'solid', density: 4, magic: true,
    ramp: ['#ff5a1a', '#ffd23a', '#ff8a2a', '#ff3a1a'], hint: 'A flower that loves the heat.', recipe: 'Flower + Fire',
    desc: 'A glowing flower that never burns. Now and then it sends up little sparks of fire.',
    props: { glow: [255, 140, 60] } });
  def(M.FROSTFERN, { key: 'frostfern', name: 'Frost Fern', kind: 'solid', density: 4, magic: true, flam: 0.05, burn: 20,
    colors: ['#c8f4ff', '#5ab8d8'], hint: 'A plant that grew in the ice.', recipe: 'Plant + Ice',
    desc: 'A frosty plant that freezes water around it and puts out flames.',
    props: { cold: true } });
  def(M.ELECMUSH, { key: 'elecmush', name: 'Electric Mushroom', kind: 'solid', density: 4, magic: true,
    ramp: ['#6ab8ff', '#e8f4ff', '#3a6aff', '#a8d8ff'], hint: 'A mushroom struck by lightning.', recipe: 'Mushroom + Lightning',
    desc: 'Glows blue and sends a pulse of electricity into copper, metal or anything that burns next to it.',
    props: { power: true, glow: [120, 190, 255] } });
  def(M.GLOWMOSS, { key: 'glowmoss', name: 'Glow Moss', kind: 'solid', density: 4, magic: true, flam: 0.05, burn: 30,
    colors: ['#8affa0', '#2a9a4a'], hint: 'Moss that soaked up a glowing stone.', recipe: 'Moss + Glowstone',
    desc: 'Glowing moss. It creeps over damp stone like normal moss.',
    props: { glow: [120, 255, 150] } });
  def(M.LIQLIGHT, { key: 'liqlight', name: 'Liquid Light', kind: 'liquid', density: 0.9, spread: 4, magic: true,
    colors: ['#fffbe0', '#ffe88a'], alpha: 220, hint: 'Water that drank a glowing stone.', recipe: 'Water + Glowstone',
    desc: 'A glowing liquid that lights up everything around it.',
    props: { glow: [255, 245, 190] } });
  SCI(M.INK, { key: 'ink', name: 'Ink', kind: 'liquid', density: 1.05, spread: 4,
    colors: ['#2a2a5a', '#0a0a24'], alpha: 245, hint: 'Water mixed with black charcoal.', recipe: 'Water + Charcoal',
    desc: 'Dark blue ink. It stains water and whatever it touches.' });
  SPACE(M.NEBULA, { key: 'nebula', name: 'Nebula Dust', kind: 'float', density: 0.1,
    ramp: ['#ff7ad8', '#8a7aff', '#5ad8ff', '#d87aff'], alpha: 200, hint: 'Stardust spread out into a cloud.', recipe: 'Stardust + Cloud',
    desc: 'Colorful space dust that drifts about and never settles.',
    props: { glow: [200, 140, 255] } });
  def(M.HEATCRYSTAL, { key: 'heatcrystal', name: 'Heat Crystal', kind: 'solid', density: 8, magic: true,
    ramp: ['#ff8a4a', '#ffd08a', '#ff5a2a', '#ffb06a'], hint: 'A crystal soaked in lava.', recipe: 'Crystal + Lava',
    desc: 'Always warm: it boils water, melts ice, chocolate and wax around it, but never sets anything on fire.',
    props: { glow: [255, 130, 70] } });

  /* Cauldron recipes: unordered pairs of ingredients. */
  const MAGIC = new Uint16Array(COUNT * COUNT);
  function brew(a, b, out) { MAGIC[a * COUNT + b] = out; MAGIC[b * COUNT + a] = out; }
  brew(M.PLANT, M.WATER, M.ESSENCE);
  brew(M.WATER, M.CRYSTAL, M.RAINBOW);
  brew(M.SALT, M.CRYSTAL, M.STARDUST);
  brew(M.METAL, M.STARDUST, M.GOLD);
  brew(M.GOLD, M.CRYSTAL, M.PHILO);
  brew(M.ICE, M.FIRE, M.COLDFIRE);
  brew(M.MUD, M.ACID, M.SLIME);
  brew(M.SAND, M.CLOUD, M.SKYSAND);
  brew(M.GLASS, M.RAINBOW, M.MIRROR);
  brew(M.OBSIDIAN, M.STARDUST, M.VOID);
  brew(M.PLANT, M.RAINBOW, M.FLOWER);
  brew(M.SMOKE, M.ESSENCE, M.SPIRIT);
  brew(M.ESSENCE, M.STARDUST, M.FAIRY);
  brew(M.FIRE, M.GOLD, M.ETERNAL);
  brew(M.SLIME, M.RAINBOW, M.BUBBLE);
  brew(M.WOOD, M.ESSENCE, M.SEED);
  // Crafted
  brew(M.MUD, M.SAND, M.CLAY);
  brew(M.CLAY, M.FIRE, M.BRICK);
  brew(M.WOOD, M.STONE, M.COAL);
  brew(M.COAL, M.LAVA, M.DIAMOND);
  brew(M.SAND, M.STONE, M.SANDSTONE);
  brew(M.PLANT, M.STONE, M.MOSS);
  brew(M.MUD, M.WOOD, M.MUSHROOM);
  brew(M.PLANT, M.WOOD, M.VINE);
  brew(M.PLANT, M.SAND, M.CACTUS);
  brew(M.FLOWER, M.ESSENCE, M.HONEY);
  brew(M.WATER, M.SALT, M.SEAWATER);
  brew(M.MOSS, M.WATER, M.SWAMP);
  brew(M.CLOUD, M.DIRT, M.FOG);
  brew(M.FIRE, M.ASH, M.EMBER);
  brew(M.WOOD, M.SMOKE, M.CHARCOAL);
  brew(M.GUNPOWDER, M.STARDUST, M.FIREWORK);
  brew(M.CLOUD, M.LIGHTNING, M.STORM);
  brew(M.STONE, M.STARDUST, M.MOONDUST);
  brew(M.STARDUST, M.FIRE, M.STAR);
  // More magic
  brew(M.WATER, M.ESSENCE, M.POTION);
  brew(M.FIRE, M.SPIRIT, M.GHOSTFIRE);
  brew(M.ICE, M.CRYSTAL, M.FROSTCRYSTAL);
  brew(M.SEED, M.CRYSTAL, M.CRYSTALSEED);
  brew(M.GUNPOWDER, M.SNOW, M.FROSTBOMB);
  brew(M.FIRE, M.LIGHTNING, M.PLASMA);
  // Creatures: Life Essence brings things to life.
  brew(M.SEAWATER, M.ESSENCE, M.FISH);
  brew(M.CLOUD, M.ESSENCE, M.BIRD);
  brew(M.MUD, M.ESSENCE, M.WORM);
  brew(M.EMBER, M.ESSENCE, M.FIREFLY);
  brew(M.SWAMP, M.ESSENCE, M.FROG);
  brew(M.HONEY, M.ESSENCE, M.BEE);
  brew(M.SAND, M.ESSENCE, M.ANT);
  brew(M.MOSS, M.ESSENCE, M.SNAIL);
  brew(M.CACTUS, M.ESSENCE, M.LIZARD);
  brew(M.SNOW, M.ESSENCE, M.PENGUIN);
  brew(M.SALT, M.ESSENCE, M.CRAB);
  brew(M.LIZARD, M.ETERNAL, M.DRAGON);
  brew(M.PLANT, M.ESSENCE, M.COW);
  brew(M.VINE, M.ESSENCE, M.SNAKE);
  brew(M.SEED, M.ESSENCE, M.RABBIT);
  brew(M.SLIME, M.ESSENCE, M.JELLYFISH);
  brew(M.SPIRIT, M.ESSENCE, M.GHOST);
  brew(M.FROG, M.WATER, M.TADPOLE);
  brew(M.WORM, M.FLOWER, M.CATERPILLAR);
  brew(M.CATERPILLAR, M.RAINBOW, M.BUTTERFLY);
  brew(M.BIRD, M.SAND, M.EGG);
  // Objects
  // Elements with properties
  brew(M.STONE, M.FIREFLY, M.GLOWSTONE);
  brew(M.HONEY, M.SLIME, M.GLUE);
  brew(M.SLIME, M.BUBBLE, M.BOUNCY);
  brew(M.METAL, M.SAND, M.IRON);
  brew(M.METAL, M.LIGHTNING, M.MAGNET);
  brew(M.METAL, M.FIRE, M.COPPER);
  brew(M.COPPER, M.LIGHTNING, M.BATTERY);
  brew(M.ICE, M.SMOKE, M.DRYICE);
  brew(M.OIL, M.GUNPOWDER, M.NITRO);
  brew(M.MUD, M.HONEY, M.CHOCOLATE);
  brew(M.CRYSTALSEED, M.SEAWATER, M.CORAL);
  // Second wave
  brew(M.HONEY, M.SAND, M.SUGAR);
  brew(M.SUGAR, M.FIRE, M.CARAMEL);
  brew(M.CARAMEL, M.ICE, M.CANDY);
  brew(M.SUGAR, M.CLOUD, M.COTTONCANDY);
  brew(M.BEE, M.HONEY, M.WAX);
  brew(M.WAX, M.FIRE, M.MELTWAX);
  brew(M.WOOD, M.WATER, M.PAPER);
  brew(M.OIL, M.COAL, M.TAR);
  brew(M.ASH, M.OIL, M.SOAP);
  brew(M.METAL, M.COAL, M.STEEL);
  brew(M.STARDUST, M.GLASS, M.GLITTER);
  brew(M.LIGHTNING, M.STEAM, M.NEON);
  brew(M.SEAWATER, M.STARDUST, M.PEARL);
  brew(M.BIRD, M.MOONDUST, M.OWL);
  brew(M.BIRD, M.GHOST, M.BAT);
  brew(M.EGG, M.SEAWATER, M.TURTLE);
  brew(M.DIRT, M.ESSENCE, M.MOUSE);
  brew(M.JELLYFISH, M.FISH, M.OCTOPUS);
  brew(M.BIRD, M.ETERNAL, M.PHOENIX);
  brew(M.COW, M.RAINBOW, M.UNICORN);
  brew(M.BIRD, M.WATER, M.DUCK);
  // Third wave
  brew(M.WATER, M.LIGHTNING, M.HYDROGEN);
  brew(M.PLANT, M.CLOUD, M.OXYGEN);
  brew(M.DRYICE, M.CLOUD, M.LN2);
  brew(M.CORAL, M.SOAP, M.SPONGE);
  brew(M.SLIME, M.SWAMP, M.VIRUS);
  brew(M.VIRUS, M.POTION, M.CURE);
  brew(M.GUNPOWDER, M.PAPER, M.TNT);
  brew(M.TNT, M.CLAY, M.C4);
  brew(M.RUST, M.IRON, M.THERMITE);
  brew(M.GLOWSTONE, M.METAL, M.PLUTONIUM);
  brew(M.VOID, M.PLASMA, M.ANTIMATTER);
  brew(M.VOID, M.CLOUD, M.VACUUM);
  brew(M.MIRROR, M.VOID, M.PORTALIN);
  brew(M.VOID, M.STAR, M.BLACKHOLE);
  brew(M.BLACKHOLE, M.MIRROR, M.WHITEHOLE);
  brew(M.BLACKHOLE, M.GUNPOWDER, M.GRAVBOMB);
  brew(M.PAPER, M.ESSENCE, M.STICKMAN);
  // Fourth wave
  brew(M.SAND, M.SWAMP, M.QUICKSAND);
  brew(M.LAVA, M.WATER, M.PUMICE);
  brew(M.ASH, M.LAVA, M.SULFUR);
  brew(M.METAL, M.WATER, M.MERCURY);
  brew(M.IRON, M.OIL, M.FERROFLUID);
  brew(M.GOLD, M.LAVA, M.MOLTENGOLD);
  brew(M.WOOD, M.HONEY, M.RESIN);
  brew(M.GLASS, M.CLOUD, M.AEROGEL);
  brew(M.SLIME, M.GUNPOWDER, M.EXPLJELLY);
  brew(M.STAR, M.STONE, M.METEORITE);
  brew(M.STONE, M.CRYSTALSEED, M.GEODE);
  brew(M.FLOWER, M.FIRE, M.FIREFLOWER);
  brew(M.PLANT, M.ICE, M.FROSTFERN);
  brew(M.MUSHROOM, M.LIGHTNING, M.ELECMUSH);
  brew(M.MOSS, M.GLOWSTONE, M.GLOWMOSS);
  brew(M.WATER, M.GLOWSTONE, M.LIQLIGHT);
  brew(M.WATER, M.CHARCOAL, M.INK);
  brew(M.STARDUST, M.CLOUD, M.NEBULA);
  brew(M.CRYSTAL, M.LAVA, M.HEATCRYSTAL);

  /* ---------------- Mixing by traits ----------------
     Any pair without its own recipe still makes something sensible, worked
     out from what the two things are like (hot, wet, living…). These only
     ever give things that already exist, so recipes stay special. */
  const TRAITS = {
    [M.SAND]: 'earth sandy', [M.WATER]: 'wet', [M.FIRE]: 'hot', [M.STONE]: 'earth',
    [M.STEAM]: 'air wet', [M.SMOKE]: 'air', [M.GLASS]: 'earth', [M.LAVA]: 'hot earth', [M.OBSIDIAN]: 'earth',
    [M.SALT]: 'earth', [M.CLOUD]: 'air wet', [M.SNOW]: 'cold', [M.ICE]: 'cold', [M.LIGHTNING]: 'air hot',
    [M.MUD]: 'earth wet', [M.PLANT]: 'life', [M.WOOD]: 'life fuel', [M.ASH]: 'earth', [M.DIRT]: 'earth',
    [M.OIL]: 'wet fuel', [M.GUNPOWDER]: 'boom', [M.ACID]: 'wet', [M.METAL]: 'metal', [M.RUST]: 'metal earth',
    [M.CRYSTAL]: 'magic earth', [M.ESSENCE]: 'life magic', [M.RAINBOW]: 'magic wet', [M.STARDUST]: 'magic',
    [M.GOLD]: 'metal magic', [M.PHILO]: 'magic metal', [M.COLDFIRE]: 'cold magic', [M.SLIME]: 'wet life',
    [M.SKYSAND]: 'air earth sandy', [M.MIRROR]: 'magic metal', [M.VOID]: 'void', [M.FLOWER]: 'life',
    [M.SPIRIT]: 'air magic', [M.FAIRY]: 'magic life', [M.ETERNAL]: 'hot magic', [M.BUBBLE]: 'air wet',
    [M.SEED]: 'life', [M.CLAY]: 'earth wet', [M.BRICK]: 'earth', [M.COAL]: 'earth fuel', [M.DIAMOND]: 'earth magic',
    [M.SANDSTONE]: 'earth sandy', [M.MOSS]: 'life', [M.MUSHROOM]: 'life', [M.VINE]: 'life', [M.CACTUS]: 'life',
    [M.HONEY]: 'life wet', [M.SEAWATER]: 'wet', [M.SWAMP]: 'wet life', [M.FOG]: 'air wet', [M.EMBER]: 'hot',
    [M.CHARCOAL]: 'fuel', [M.FIREWORK]: 'boom', [M.STORM]: 'air wet', [M.MOONDUST]: 'magic earth sandy',
    [M.STAR]: 'hot magic', [M.POTION]: 'magic wet', [M.GHOSTFIRE]: 'hot magic', [M.FROSTCRYSTAL]: 'cold magic',
    [M.CRYSTALSEED]: 'magic life', [M.FROSTBOMB]: 'cold boom', [M.PLASMA]: 'hot air',
    [M.FISH]: 'life wet', [M.BIRD]: 'life air', [M.WORM]: 'life earth', [M.FIREFLY]: 'life hot',
    [M.FROG]: 'life wet', [M.BEE]: 'life air', [M.ANT]: 'life earth', [M.SNAIL]: 'life wet',
    [M.LIZARD]: 'life earth', [M.PENGUIN]: 'life cold', [M.CRAB]: 'life wet',
    [M.DRAGON]: 'life hot magic', [M.COW]: 'life earth', [M.SNAKE]: 'life earth', [M.RABBIT]: 'life earth',
    [M.JELLYFISH]: 'life wet', [M.GHOST]: 'air magic', [M.TADPOLE]: 'life wet', [M.CATERPILLAR]: 'life',
    [M.BUTTERFLY]: 'life air', [M.EGG]: 'life', [M.HOUSE]: 'earth', [M.VOLCANO]: 'hot earth', [M.CHEST]: 'metal magic',
    [M.SNOWMAN]: 'cold', [M.CAMPFIRE]: 'hot fuel', [M.CASTLE]: 'earth',
    [M.GLOWSTONE]: 'earth magic', [M.GLUE]: 'wet', [M.BOUNCY]: 'earth', [M.IRON]: 'metal earth sandy', [M.MAGNET]: 'metal',
    [M.COPPER]: 'metal', [M.BATTERY]: 'metal hot', [M.DRYICE]: 'cold air', [M.NITRO]: 'boom wet', [M.CHOCOLATE]: 'earth',
    [M.MELTCHOC]: 'wet', [M.CORAL]: 'life earth',
    [M.SUGAR]: 'earth sandy', [M.CARAMEL]: 'wet', [M.CANDY]: 'earth', [M.COTTONCANDY]: 'air', [M.WAX]: 'fuel', [M.MELTWAX]: 'wet fuel',
    [M.PAPER]: 'fuel life', [M.TAR]: 'wet fuel', [M.SOAP]: 'wet', [M.STEEL]: 'metal', [M.GLITTER]: 'magic sandy', [M.NEON]: 'air magic',
    [M.PEARL]: 'magic earth', [M.OWL]: 'life air', [M.BAT]: 'life air', [M.TURTLE]: 'life wet', [M.MOUSE]: 'life earth',
    [M.OCTOPUS]: 'life wet', [M.PHOENIX]: 'life hot magic', [M.UNICORN]: 'life magic', [M.DUCK]: 'life wet',
    [M.LIGHTHOUSE]: 'earth magic', [M.PYRAMID]: 'earth sandy', [M.IGLOO]: 'cold', [M.CANDLE]: 'hot fuel', [M.FOUNTAIN]: 'wet earth', [M.GINGERBREAD]: 'earth',
    [M.HYDROGEN]: 'air fuel', [M.OXYGEN]: 'air', [M.LN2]: 'cold wet', [M.SPONGE]: 'life wet', [M.VIRUS]: 'life wet', [M.CURE]: 'magic wet',
    [M.TNT]: 'boom', [M.C4]: 'boom earth', [M.THERMITE]: 'hot metal', [M.PLUTONIUM]: 'hot metal magic', [M.ANTIMATTER]: 'void',
    [M.VACUUM]: 'void', [M.PORTALIN]: 'magic void', [M.PORTALOUT]: 'magic', [M.BLACKHOLE]: 'void', [M.WHITEHOLE]: 'magic air',
    [M.GRAVBOMB]: 'boom magic', [M.STICKMAN]: 'life',
    [M.QUICKSAND]: 'earth sandy wet', [M.PUMICE]: 'earth', [M.SULFUR]: 'earth fuel', [M.MERCURY]: 'metal wet', [M.FERROFLUID]: 'metal wet',
    [M.MOLTENGOLD]: 'hot metal magic', [M.RESIN]: 'life wet fuel', [M.AMBER]: 'earth magic', [M.AEROGEL]: 'air earth', [M.EXPLJELLY]: 'boom wet',
    [M.METEORITE]: 'hot earth metal', [M.GEODE]: 'earth magic', [M.FIREFLOWER]: 'life hot magic', [M.FROSTFERN]: 'life cold', [M.ELECMUSH]: 'life magic',
    [M.GLOWMOSS]: 'life magic', [M.LIQLIGHT]: 'wet magic', [M.INK]: 'wet', [M.NEBULA]: 'air magic', [M.HEATCRYSTAL]: 'hot magic earth',
  };
  const T = {};
  for (const k in TRAITS) T[k] = new Set(TRAITS[k].split(' '));
  // Each rule: the two traits needed (one from each ingredient) and what they make.
  const RULES = [
    ['boom', 'hot', M.SMOKE], ['hot', 'cold', M.WATER], ['hot', 'wet', M.STEAM], ['hot', 'life', M.ASH],
    ['hot', 'metal', M.LAVA], ['hot', 'sandy', M.GLASS], ['hot', 'earth', M.LAVA], ['hot', 'air', M.SMOKE],
    ['hot', 'fuel', M.FIRE], ['cold', 'wet', M.ICE], ['cold', 'life', M.SNOW], ['cold', 'air', M.SNOW],
    ['cold', 'earth', M.SNOW], ['wet', 'earth', M.MUD], ['wet', 'life', M.PLANT], ['wet', 'metal', M.RUST],
    ['wet', 'air', M.CLOUD], ['earth', 'life', M.DIRT], ['air', 'earth', M.SAND], ['metal', 'earth', M.METAL],
    ['life', 'air', M.SEED], ['fuel', 'earth', M.COAL], ['boom', 'earth', M.SAND], ['magic', 'magic', M.STARDUST],
    ['magic', 'life', M.FLOWER], ['magic', 'earth', M.CRYSTAL], ['magic', 'wet', M.RAINBOW], ['magic', 'metal', M.GOLD],
    ['magic', 'air', M.SPIRIT], ['magic', 'hot', M.ETERNAL], ['magic', 'cold', M.FROSTCRYSTAL], ['magic', 'fuel', M.STARDUST],
    ['magic', 'boom', M.FIREWORK], ['life', 'life', M.PLANT], ['earth', 'earth', M.STONE], ['wet', 'wet', M.WATER],
    ['hot', 'hot', M.FIRE], ['cold', 'cold', M.ICE], ['metal', 'metal', M.METAL], ['air', 'air', M.CLOUD],
    ['fuel', 'fuel', M.COAL], ['boom', 'boom', M.GUNPOWDER], ['fuel', 'life', M.WOOD], ['boom', 'life', M.ASH],
    ['boom', 'wet', M.MUD], ['boom', 'metal', M.RUST], ['boom', 'air', M.SMOKE], ['boom', 'cold', M.SNOW],
    ['fuel', 'wet', M.OIL], ['fuel', 'metal', M.METAL], ['fuel', 'air', M.SMOKE], ['fuel', 'cold', M.COAL],
    ['metal', 'life', M.RUST], ['metal', 'air', M.RUST], ['metal', 'cold', M.METAL],
  ];
  /* What mixing a and b makes by their traits (0 if nothing). Results that
     are just one of the two ingredients are skipped. */
  function traitMix(a, b) {
    const ta = T[a], tb = T[b];
    if (!ta || !tb) return 0;
    if (ta.has('void') || tb.has('void')) return -1; // the Void swallows it
    for (const [x, y, out] of RULES) {
      if (out === a || out === b) continue;
      if ((ta.has(x) && tb.has(y)) || (ta.has(y) && tb.has(x))) return out;
    }
    return 0;
  }

  /* Cauldron recipes: unordered pairs of ingredients. */

  /* ---------------- Reactions ----------------
     When material A picks neighbour B: with chance p, A becomes `a` and
     B becomes `b` (-1 = unchanged). `alt` swaps A's result for another
     material a small share of the time. */
  const KEEP = -1;
  const RX = new Array(COUNT * COUNT);
  function rx(a, b, p, ta, tb, alt) {
    const k = a * COUNT + b;
    (RX[k] || (RX[k] = [])).push({ p, a: ta, b: tb, alt });
  }
  const E = M.EMPTY;

  // Water and heat
  rx(M.WATER, M.FIRE, 0.45, M.STEAM, E, { p: 0.05, a: M.SALT });
  rx(M.WATER, M.LAVA, 0.5, M.STEAM, M.OBSIDIAN);
  rx(M.LAVA, M.WATER, 0.5, M.OBSIDIAN, M.STEAM, { p: 0.1, a: M.PUMICE }); // now and then it cools into bubbly pumice
  rx(M.FIRE, M.WATER, 0.5, E, M.STEAM, null);
  // Melting and baking
  rx(M.FIRE, M.SAND, 0.012, KEEP, M.GLASS);
  rx(M.LAVA, M.SAND, 0.04, KEEP, M.GLASS);
  rx(M.FIRE, M.STONE, 0.004, KEEP, M.LAVA);
  rx(M.FIRE, M.ICE, 0.08, E, M.WATER);
  rx(M.LAVA, M.ICE, 0.2, KEEP, M.WATER);
  rx(M.STEAM, M.ICE, 0.02, M.WATER, M.WATER);
  rx(M.FIRE, M.SNOW, 0.2, E, M.WATER);
  rx(M.LAVA, M.SNOW, 0.4, KEEP, M.STEAM);
  rx(M.STEAM, M.SNOW, 0.05, M.WATER, M.WATER);
  rx(M.FIRE, M.MUD, 0.02, KEEP, M.DIRT);
  rx(M.LAVA, M.MUD, 0.05, KEEP, M.DIRT);
  // Cold
  rx(M.WATER, M.SNOW, 0.012, M.ICE, KEEP);
  rx(M.WATER, M.ICE, 0.0006, M.ICE, KEEP);
  rx(M.SALT, M.ICE, 0.05, E, M.WATER);
  rx(M.SALT, M.SNOW, 0.05, E, M.WATER);
  rx(M.SALT, M.WATER, 0.002, E, KEEP);
  // Sky
  rx(M.STEAM, M.CLOUD, 0.03, M.CLOUD, KEEP);
  rx(M.SMOKE, M.WATER, 0.01, E, M.ACID);
  rx(M.SMOKE, M.STEAM, 0.004, M.ACID, E);
  rx(M.WATER, M.SMOKE, 0.02, M.ACID, E);
  rx(M.SMOKE, M.CLOUD, 0.01, E, M.ACID); // acid rain
  // Earth and life
  rx(M.ASH, M.MUD, 0.05, E, M.DIRT);
  rx(M.ASH, M.SALT, 0.05, M.GUNPOWDER, E);
  rx(M.SALT, M.ASH, 0.05, E, M.GUNPOWDER);
  rx(M.METAL, M.WATER, 0.0005, M.RUST, KEEP);
  rx(M.ACID, M.WATER, 0.002, M.WATER, KEEP);
  // Lightning
  rx(M.LIGHTNING, M.SAND, 0.5, KEEP, M.GLASS);
  rx(M.LIGHTNING, M.GLASS, 0.35, KEEP, M.CRYSTAL);
  rx(M.LIGHTNING, M.WATER, 0.25, KEEP, M.STEAM);
  rx(M.LIGHTNING, M.ICE, 0.5, KEEP, M.WATER);
  rx(M.LIGHTNING, M.SNOW, 0.5, KEEP, M.WATER);
  // Acid eats nearly everything (glass and crystal resist it)
  [M.SAND, M.STONE, M.DIRT, M.MUD, M.PLANT, M.WOOD, M.METAL, M.RUST, M.ICE,
    M.SNOW, M.SALT, M.ASH, M.GUNPOWDER].forEach((b) => rx(M.ACID, b, 0.12, KEEP, E));
  rx(M.ACID, M.OBSIDIAN, 0.01, KEEP, E);
  // Crafted things in the world
  rx(M.FIRE, M.CLAY, 0.02, KEEP, M.BRICK);
  rx(M.LAVA, M.CLAY, 0.05, KEEP, M.BRICK);
  rx(M.LAVA, M.COAL, 0.002, KEEP, M.DIAMOND);
  rx(M.SEAWATER, M.FIRE, 0.45, M.STEAM, E, { p: 0.3, a: M.SALT });
  rx(M.SEAWATER, M.LAVA, 0.5, M.STEAM, M.OBSIDIAN);
  rx(M.FIRE, M.SEAWATER, 0.5, E, M.STEAM);
  rx(M.FIRE, M.FOG, 0.05, KEEP, E);
  rx(M.POTION, M.ASH, 0.15, KEEP, M.PLANT);
  rx(M.POTION, M.RUST, 0.15, KEEP, M.METAL);
  rx(M.POTION, M.DIRT, 0.02, KEEP, M.PLANT);
  rx(M.FROSTCRYSTAL, M.WATER, 0.06, KEEP, M.ICE);
  rx(M.FROSTCRYSTAL, M.SEAWATER, 0.03, KEEP, M.ICE);
  rx(M.FROSTCRYSTAL, M.LAVA, 0.08, KEEP, M.OBSIDIAN);
  rx(M.FROSTCRYSTAL, M.FIRE, 0.3, KEEP, E);
  [M.PLANT, M.WOOD, M.FLOWER, M.VINE, M.MOSS, M.MUSHROOM, M.CACTUS, M.SEED].forEach((b) => rx(M.GHOSTFIRE, b, 0.4, KEEP, M.GHOSTFIRE));
  rx(M.WATER, M.GHOSTFIRE, 0.3, KEEP, E);
  [M.CLAY, M.BRICK, M.COAL, M.SANDSTONE, M.MOSS, M.MUSHROOM, M.VINE, M.CACTUS, M.CHARCOAL, M.MOONDUST, M.HONEY]
    .forEach((b) => rx(M.ACID, b, 0.12, KEEP, E));
  // Magic in the wild
  rx(M.CRYSTAL, M.METAL, 0.03, KEEP, M.CAULDRON);
  rx(M.METAL, M.CRYSTAL, 0.03, M.CAULDRON, KEEP);
  rx(M.COLDFIRE, M.WATER, 0.3, KEEP, M.ICE);
  rx(M.COLDFIRE, M.LAVA, 0.3, KEEP, M.OBSIDIAN);
  rx(M.COLDFIRE, M.FIRE, 0.5, KEEP, E);
  rx(M.COLDFIRE, M.STEAM, 0.3, KEEP, M.WATER);
  rx(M.SLIME, M.WATER, 0.004, KEEP, M.SLIME);
  rx(M.FAIRY, M.PLANT, 0.1, KEEP, M.FLOWER);
  [M.ESSENCE, M.RAINBOW, M.STARDUST, M.GOLD, M.SLIME, M.SKYSAND, M.FLOWER, M.SEED].forEach((b) => rx(M.ACID, b, 0.12, KEEP, E));

  [M.FIRE, M.LAVA, M.EMBER, M.ETERNAL, M.PLASMA].forEach((h) => rx(h, M.CHOCOLATE, 0.08, KEEP, M.MELTCHOC));
  rx(M.DRYICE, M.WATER, 0.03, KEEP, M.ICE);
  rx(M.DRYICE, M.SEAWATER, 0.02, KEEP, M.ICE);
  [M.GLUE, M.IRON, M.MAGNET, M.COPPER, M.BATTERY, M.CHOCOLATE, M.MELTCHOC, M.CORAL, M.BOUNCY].forEach((b) => rx(M.ACID, b, 0.12, KEEP, E));
  // Second wave in the world
  rx(M.WATER, M.SUGAR, 0.03, KEEP, E);                         // sugar dissolves
  rx(M.COTTONCANDY, M.WATER, 0.25, E, KEEP);                   // cotton candy vanishes in water
  rx(M.SOAP, M.WATER, 0.04, KEEP, M.BUBBLE, { p: 0.25, a: E }); // bubbles (and the soap gets used up)
  rx(M.SOAP, M.OIL, 0.15, KEEP, E);
  rx(M.SOAP, M.TAR, 0.06, KEEP, E);
  rx(M.SOAP, M.MUD, 0.05, KEEP, M.WATER);
  [M.SUGAR, M.CARAMEL, M.CANDY, M.COTTONCANDY, M.WAX, M.MELTWAX, M.PAPER, M.TAR, M.SOAP, M.GLITTER, M.PEARL].forEach((b) => rx(M.ACID, b, 0.12, KEEP, E));
  // Third wave in the world
  [M.SPONGE, M.TNT, M.C4, M.THERMITE].forEach((b) => rx(M.ACID, b, 0.08, KEEP, E));
  rx(M.CURE, M.ACID, 0.05, KEEP, M.WATER);
  // Fourth wave in the world
  rx(M.LAVA, M.GOLD, 0.03, KEEP, M.MOLTENGOLD);   // gold melts in lava
  [M.SULFUR, M.RESIN, M.AMBER, M.GEODE, M.FERROFLUID, M.EXPLJELLY, M.PUMICE, M.FIREFLOWER, M.FROSTFERN, M.ELECMUSH, M.GLOWMOSS, M.AEROGEL].forEach((b) => rx(M.ACID, b, 0.08, KEEP, E));

  // Things that set flammable neighbours alight.
  const IGNITERS = new Set([M.FIRE, M.LAVA, M.LIGHTNING, M.ETERNAL, M.EMBER, M.PLASMA, M.ROCKET]);

  // Turn '#rrggbb' into [r, g, b].
  function hex(h) { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length > 7 ? parseInt(h.slice(7, 9), 16) : 255]; }
  // Empty slots waiting for inventions.
  for (let id = 1; id < COUNT; id++) if (!MATS[id] && !isSlot(id)) def(id, { key: 'spare' + id, name: '', kind: 'empty', density: 0, colors: ['#000000', '#000000'], alpha: 0, hidden: true, spare: true });
  for (let id = 1; id < COUNT; id++) if (isSlot(id) && !MATS[id]) def(id, { key: 'slot' + id, name: '', kind: 'empty', density: 0, colors: ['#000000', '#000000'], alpha: 0, reserved: true, hidden: true });
  MATS.forEach((m) => { m.rgb = (m.colors || m.ramp).map(hex); if (!m.colors) m.colors = [m.ramp[0], m.ramp[m.ramp.length - 1]]; });

  /* Register something the AI invented in slot `id`, brewed from a + b.
     `o` is an already-checked material entry (see game.js). */
  function invent(id, o, a, b) {
    if (o.like && MATS[o.like]) { // acts exactly like a built-in element, but keeps its own look and name
      const B = MATS[o.like];
      o = Object.assign({}, o, { kind: B.kind, density: B.density, slip: B.slip, spread: B.spread, flam: B.flam, burn: B.burn, alpha: B.alpha,
        props: B.props, traits: o.traits || TRAITS[o.like] });
    }
    def(id, Object.assign({ invented: true }, o));
    const m = MATS[id];
    m.rgb = (m.colors || m.ramp).map(hex); if (!m.colors) m.colors = [m.ramp[0], m.ramp[m.ramp.length - 1]];
    if (o.traits) { TRAITS[id] = o.traits; T[id] = new Set(o.traits.split(' ')); }
    if (a && b) brew(a, b, id);
    if (o.props && o.props.hot) IGNITERS.add(id);
    if (o.props && o.props.cold) { rx(id, M.WATER, 0.04, KEEP, M.ICE); rx(id, M.LAVA, 0.04, KEEP, M.OBSIDIAN); rx(id, M.FIRE, 0.2, KEEP, E); }
    if (m.kind !== 'creature' && m.kind !== 'stamp') rx(M.ACID, id, 0.08, KEEP, E);
    return m;
  }

  window.SandMats = { M, MATS, COUNT, BUILTIN, EXTRA, SLOTS2, isSlot, RX, KEEP, IGNITERS, MAGIC, traitMix, hex, invent };
})();
