// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Survive this many waves and the Hollow is lit: the win screen. */
export const WIN_WAVE = 10;

export const PLAYER = {
  radius: 16,
  speed: 340,
  accel: 2600,
  friction: 6,
  hull: 100,
  maxHull: 100,
  fireInterval: 0.16,
  bulletSpeed: 760,
  bulletDamage: 10,
  bulletRadius: 4,
  dashSpeed: 980,
  dashTime: 0.18,
  dashCooldown: 1.6,
  invulnerableAfterHit: 1.0,
};

export const ENEMY = {
  wisp: { radius: 14, hp: 20, speed: 128, touchDamage: 10, score: 50, cost: 1, shards: 1 },
  spinner: { radius: 16, hp: 34, speed: 72, touchDamage: 10, score: 80, cost: 2, shards: 2, shotInterval: 2.4, bulletSpeed: 185 },
  splitter: { radius: 18, hp: 44, speed: 92, touchDamage: 12, score: 100, cost: 3, shards: 2 },
  hulk: { radius: 27, hp: 130, speed: 56, touchDamage: 18, score: 200, cost: 4, shards: 3 },
  titan: { radius: 56, hp: 950, speed: 46, touchDamage: 24, score: 1500, cost: 0, shards: 12, shotInterval: 2.6, bulletSpeed: 165 },
};

/** Seconds a kill keeps the combo alive; each kill inside it raises the multiplier. */
export const COMBO_WINDOW = 3;
export const COMBO_MAX = 8;

export const POWERUP = {
  dropChance: 0.12,
  spreadSeconds: 12,
  rapidSeconds: 10,
  shieldSeconds: 8,
  magnetSeconds: 10,
  repairHull: 30,
  magnetRadius: 260,
  shardScore: 10,
};

export const WAVE = {
  bannerSeconds: 2.2,
  clearBonus: 250,
  clearHeal: 10,
  /** Spawn budget in enemy-cost points: 6 + 3 per wave. */
  budgetBase: 6,
  budgetPerWave: 3,
  spawnInterval: 0.9,
  spawnIntervalMin: 0.35,
};

/** How many of each pool can exist at once; pools are allocated once, at boot. */
export const POOL = { bullets: 256, enemyBullets: 256, enemies: 96, shards: 256, powerups: 24, particles: 512, floaters: 64 };

export const PALETTE = {
  backdrop: '#0a0a18',
  nebulaA: '#1b1440',
  nebulaB: '#0e2a3d',
  nebulaC: '#33122e',
  star: '#cdd7ff',
  player: '#ffd76a',
  playerCore: '#fff3c4',
  bullet: '#ffe9a8',
  enemyBullet: '#ff7ad9',
  wisp: '#8ef1ff',
  spinner: '#c99aff',
  splitter: '#7dff9e',
  hulk: '#ff9a5c',
  titan: '#ff5470',
  shard: '#ffe066',
  powerup: '#7dffa8',
  panel: 'rgba(12, 14, 34, 0.72)',
  panelEdge: 'rgba(150, 170, 255, 0.35)',
  text: '#eef1ff',
  muted: '#9aa3c7',
  danger: '#ff5c6c',
  heal: '#7dffa8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumen-drift.best';

/** The game's name, shown on the title screen and the page tab. */
export const GAME_NAME = 'LUMEN DRIFT';
export const GAME_TAGLINE = 'a lantern-ship survival in the Hollow';
