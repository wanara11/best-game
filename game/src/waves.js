// The wave director: what each wave throws at the player, in what order, and when the
// wave is done. Waves grow in budget and speed; waves 5 and 10 bring a Gloom Titan,
// and clearing wave 10 lights the Hollow: the win.

import { ENEMY, WAVE, WIN_WAVE } from './config.js';
import { KIND_HULK, KIND_SPINNER, KIND_SPLITTER, KIND_TITAN, KIND_WISP, edgeSpawn, spawnEnemy } from './entities.js';

const WAVE_STATE_BANNER = 'banner';
const WAVE_STATE_ACTIVE = 'active';
const WAVE_STATE_CLEAR = 'clear';

export { WAVE_STATE_ACTIVE, WAVE_STATE_BANNER, WAVE_STATE_CLEAR };

/** The spawn queue for a wave: a list of kinds, cheapest first, shuffled. */
export function buildWaveQueue(random, wave) {
  const budget = WAVE.budgetBase + WAVE.budgetPerWave * wave;
  const queue = [];
  let spent = 0;
  const table = [
    { kind: KIND_WISP, cost: ENEMY.wisp.cost },
    { kind: KIND_SPINNER, cost: ENEMY.spinner.cost },
    { kind: KIND_SPLITTER, cost: ENEMY.splitter.cost },
    { kind: KIND_HULK, cost: ENEMY.hulk.cost },
  ];
  // Later waves may buy heavier creatures; wave 1 is wisps only.
  const unlocked = wave >= 2 ? (wave >= 3 ? (wave >= 4 ? table : table.slice(0, 3)) : table.slice(0, 2)) : table.slice(0, 1);
  while (spent < budget) {
    const entry = random.pick(unlocked);
    if (spent + entry.cost > budget + 2) break;
    queue.push(entry.kind);
    spent += entry.cost;
  }
  // Shuffle so the wave never arrives in cost order.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  if (wave === 5 || wave === WIN_WAVE) queue.unshift(KIND_TITAN);
  return queue;
}

export function createDirector(random) {
  return {
    wave: 0,
    state: WAVE_STATE_BANNER,
    timer: WAVE.bannerSeconds,
    queue: [],
    spawnT: 0,
    spawned: 0,
    total: 0,
  };
}

export function startWave(director, random, wave) {
  director.wave = wave;
  director.state = WAVE_STATE_BANNER;
  director.timer = WAVE.bannerSeconds;
  director.queue = buildWaveQueue(random, wave);
  director.spawnT = 0;
  director.spawned = 0;
  director.total = director.queue.length;
}

/**
 * Advance the director one step. Returns true on the step the wave's banner ends
 * (the horn sounds), so the caller can announce it.
 */
export function stepDirector(director, world, dt) {
  if (director.state === WAVE_STATE_BANNER) {
    director.timer -= dt;
    if (director.timer <= 0) {
      director.state = WAVE_STATE_ACTIVE;
      return true;
    }
    return false;
  }
  if (director.state !== WAVE_STATE_ACTIVE) return false;
  const interval = Math.max(WAVE.spawnIntervalMin, WAVE.spawnInterval - director.wave * 0.04);
  director.spawnT -= dt;
  if (director.queue.length > 0 && director.spawnT <= 0) {
    const kind = director.queue.shift();
    const at = edgeSpawn(world.random, world.state.player);
    world.state.enemies.push(spawnEnemy(world.random, kind, at.x, at.y, director.wave));
    director.spawned += 1;
    director.spawnT = interval;
  }
  if (director.queue.length === 0 && world.state.enemies.length === 0) {
    director.state = WAVE_STATE_CLEAR;
  }
  return false;
}

/** How many of the wave's creatures are still out there, counting the unspawned. */
export function waveRemaining(director, world) {
  return director.queue.length + world.state.enemies.length;
}
