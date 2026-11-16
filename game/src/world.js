// The simulation: one fixed step moves the lantern-ship, its shots, the Hollow's
// creatures and everything they drop, then resolves every collision and scores it.
// The world knows nothing about the screen; it returns event flags and main.js turns
// them into sound and announcements.

import { COMBO_MAX, COMBO_WINDOW, ENEMY, FIELD, PLAYER, POWERUP, STEP, WAVE, WIN_WAVE } from './config.js';
import {
  KIND_HULK,
  KIND_SPINNER,
  KIND_SPLITTER,
  KIND_TITAN,
  KIND_WISP,
  POWER_MAGNET,
  POWER_RAPID,
  POWER_REPAIR,
  POWER_SHIELD,
  POWER_SPREAD,
  createPlayer,
  spawnBullet,
  spawnFloater,
  spawnParticles,
  spawnPowerup,
  spawnRing,
  spawnShard,
  stepBullets,
  stepFloaters,
  stepParticles,
  stepPowerups,
  stepShards,
} from './entities.js';
import { WAVE_STATE_CLEAR, createDirector, startWave, stepDirector, waveRemaining } from './waves.js';

export const EVENT_NONE = 0;
export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_KILL = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_WAVE_CLEAR = 32;
export const EVENT_WAVE_START = 64;
export const EVENT_PICKUP = 128;
export const EVENT_POWERUP = 256;
export const EVENT_DASH = 512;
export const EVENT_ENEMY_SHOT = 1024;

const NO_SFX = {
  shoot: () => {},
  enemyHit: () => {},
  explosion: () => {},
  pickup: () => {},
  powerup: () => {},
  hurt: () => {},
  dash: () => {},
  waveHorn: () => {},
  win: () => {},
  lose: () => {},
};

function clampToField(body, margin) {
  body.x = Math.min(FIELD.width - margin, Math.max(margin, body.x));
  body.y = Math.min(FIELD.height - margin, Math.max(margin, body.y));
}

function damagePlayer(world, amount) {
  const player = world.state.player;
  if (player.invulnT > 0 || player.dashTime > 0 || !player.alive) return EVENT_NONE;
  if (player.shieldT > 0) {
    player.shieldT = 0;
    player.invulnT = 0.6;
    spawnRing(world.state.particles, player.x, player.y, '#7dffa8');
    return EVENT_HIT;
  }
  player.hull -= amount;
  player.invulnT = PLAYER.invulnerableAfterHit;
  world.state.combo = 0;
  world.state.hitFlash = 0.35;
  world.state.shake = 0.45;
  spawnParticles(world.state.particles, world.random, player.x, player.y, '#ff5c6c', 18, 260, 0.5);
  if (player.hull <= 0) {
    player.hull = 0;
    player.alive = false;
    spawnParticles(world.state.particles, world.random, player.x, player.y, '#ffd76a', 60, 420, 1.1);
    spawnRing(world.state.particles, player.x, player.y, '#ffd76a');
    return EVENT_HIT | EVENT_OVER;
  }
  return EVENT_HIT;
}

function killEnemy(world, enemy, index) {
  const state = world.state;
  state.enemies.splice(index, 1);
  const multiplier = Math.max(1, state.combo);
  const gained = enemy.score * multiplier;
  state.score += gained;
  state.kills += 1;
  state.combo = Math.min(state.combo + 1, COMBO_MAX);
  state.comboTimer = COMBO_WINDOW;
  spawnFloater(state.floaters, enemy.x, enemy.y - enemy.radius, `+${gained}`, '#ffe066');
  const color = enemy.kind === KIND_TITAN ? '#ff5470' : '#8ef1ff';
  spawnParticles(state.particles, world.random, enemy.x, enemy.y, color, enemy.kind === KIND_TITAN ? 60 : 16, 300, 0.6);
  spawnRing(state.particles, enemy.x, enemy.y, color);
  for (let i = 0; i < enemy.shards; i += 1) spawnShard(state.shards, world.random, enemy.x, enemy.y);
  if (world.random.next() < POWERUP.dropChance) spawnPowerup(state.powerups, world.random, enemy.x, enemy.y);
  if (enemy.kind === KIND_SPLITTER) {
    for (let i = 0; i < 2; i += 1) {
      const wisp = {
        kind: KIND_WISP,
        x: enemy.x + (i === 0 ? -14 : 14),
        y: enemy.y,
        vx: 0,
        vy: 0,
        radius: ENEMY.wisp.radius,
        hp: ENEMY.wisp.hp,
        maxHp: ENEMY.wisp.hp,
        speed: ENEMY.wisp.speed * 1.2,
        touchDamage: ENEMY.wisp.touchDamage,
        score: ENEMY.wisp.score,
        shards: 0,
        shotT: 0,
        wobble: world.random.angle(),
        wobbleSpeed: 3,
        flashT: 0,
        active: true,
      };
      state.enemies.push(wisp);
    }
  }
  return EVENT_KILL;
}

function stepPlayer(world, control, dt) {
  const player = world.state.player;
  if (!player.alive) return EVENT_NONE;
  let events = EVENT_NONE;
  player.fireCd -= dt;
  player.dashCd -= dt;
  player.invulnT -= dt;
  player.spreadT -= dt;
  player.rapidT -= dt;
  player.shieldT -= dt;
  player.magnetT -= dt;

  if (control.dash && player.dashCd <= 0 && (control.move.x !== 0 || control.move.y !== 0)) {
    const length = Math.hypot(control.move.x, control.move.y);
    player.dashX = control.move.x / length;
    player.dashY = control.move.y / length;
    player.dashTime = PLAYER.dashTime;
    player.dashCd = PLAYER.dashCooldown;
    player.invulnT = Math.max(player.invulnT, PLAYER.dashTime + 0.05);
    spawnParticles(world.state.particles, world.random, player.x, player.y, '#9adcff', 10, 180, 0.35);
    events |= EVENT_DASH;
  }

  if (player.dashTime > 0) {
    player.dashTime -= dt;
    player.vx = player.dashX * PLAYER.dashSpeed;
    player.vy = player.dashY * PLAYER.dashSpeed;
  } else {
    player.vx += control.move.x * PLAYER.accel * dt;
    player.vy += control.move.y * PLAYER.accel * dt;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.speed) {
      player.vx = (player.vx / speed) * PLAYER.speed;
      player.vy = (player.vy / speed) * PLAYER.speed;
    }
    player.vx *= 1 - PLAYER.friction * dt * 0.4;
    player.vy *= 1 - PLAYER.friction * dt * 0.4;
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  clampToField(player, player.radius + 4);
  player.angle = control.aimAngle;

  if (control.firing && player.fireCd <= 0) {
    const interval = player.rapidT > 0 ? PLAYER.fireInterval * 0.55 : PLAYER.fireInterval;
    player.fireCd = interval;
    world.state.stats.shotsFired += 1;
    const angles = player.spreadT > 0 ? [-0.16, 0, 0.16] : [0];
    for (const offset of angles) {
      spawnBullet(
        world.state.bullets,
        player.x + Math.cos(player.angle) * (player.radius + 6),
        player.y + Math.sin(player.angle) * (player.radius + 6),
        player.angle + offset,
        PLAYER.bulletSpeed,
        PLAYER.bulletDamage,
        true,
      );
    }
    events |= EVENT_SHOOT;
  }
  return events;
}

function stepEnemies(world, dt) {
  const state = world.state;
  const player = state.player;
  let events = EVENT_NONE;
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const e = state.enemies[i];
    e.flashT -= dt;
    e.wobble += e.wobbleSpeed * dt;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    if (e.kind === KIND_WISP) {
      const wob = Math.sin(e.wobble) * 0.5;
      e.vx = (nx - ny * wob) * e.speed;
      e.vy = (ny + nx * wob) * e.speed;
    } else if (e.kind === KIND_SPINNER) {
      const want = 260;
      const toward = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
      e.vx = nx * toward * e.speed + -ny * 40;
      e.vy = ny * toward * e.speed + nx * 40;
      e.shotT -= dt;
      if (e.shotT <= 0 && player.alive) {
        e.shotT = ENEMY.spinner.shotInterval * (0.85 + world.random.next() * 0.3);
        spawnBullet(state.enemyBullets, e.x, e.y, Math.atan2(dy, dx), ENEMY.spinner.bulletSpeed, 8, false);
        events |= EVENT_ENEMY_SHOT;
      }
    } else if (e.kind === KIND_SPLITTER || e.kind === KIND_HULK) {
      e.vx = nx * e.speed;
      e.vy = ny * e.speed;
    } else if (e.kind === KIND_TITAN) {
      e.vx = nx * e.speed;
      e.vy = ny * e.speed;
      e.shotT -= dt;
      if (e.shotT <= 0 && player.alive) {
        e.shotT = ENEMY.titan.shotInterval;
        for (let k = 0; k < 10; k += 1) {
          const angle = (k / 10) * Math.PI * 2 + e.wobble;
          spawnBullet(state.enemyBullets, e.x, e.y, angle, ENEMY.titan.bulletSpeed, 10, false);
        }
        events |= EVENT_ENEMY_SHOT;
      }
      state.titanSummonT -= dt;
      if (state.titanSummonT <= 0) {
        state.titanSummonT = 8;
        for (let k = 0; k < 2; k += 1) {
          const at = { x: e.x + (k === 0 ? -70 : 70), y: e.y };
          state.enemies.push({
            kind: KIND_WISP,
            x: at.x,
            y: at.y,
            vx: 0,
            vy: 0,
            radius: ENEMY.wisp.radius,
            hp: ENEMY.wisp.hp,
            maxHp: ENEMY.wisp.hp,
            speed: ENEMY.wisp.speed,
            touchDamage: ENEMY.wisp.touchDamage,
            score: ENEMY.wisp.score,
            shards: 0,
            shotT: 0,
            wobble: world.random.angle(),
            wobbleSpeed: 3,
            flashT: 0,
            active: true,
          });
        }
      }
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    clampToField(e, e.radius + 2);
  }
  return events;
}

function resolveCollisions(world) {
  const state = world.state;
  const player = state.player;
  let events = EVENT_NONE;

  // Player shots vs creatures.
  for (let bi = state.bullets.length - 1; bi >= 0; bi -= 1) {
    const b = state.bullets[bi];
    for (let ei = state.enemies.length - 1; ei >= 0; ei -= 1) {
      const e = state.enemies[ei];
      const rr = b.radius + e.radius;
      if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < rr * rr) {
        e.hp -= b.damage;
        e.flashT = 0.08;
        state.stats.shotsHit += 1;
        spawnParticles(state.particles, world.random, b.x, b.y, '#ffe9a8', 3, 140, 0.25);
        state.bullets.splice(bi, 1);
        if (e.hp <= 0) events |= killEnemy(world, e, ei);
        break;
      }
    }
  }

  if (!player.alive) return events;

  // Creature shots vs the ship.
  for (let bi = state.enemyBullets.length - 1; bi >= 0; bi -= 1) {
    const b = state.enemyBullets[bi];
    const rr = b.radius + player.radius - 2;
    if ((b.x - player.x) ** 2 + (b.y - player.y) ** 2 < rr * rr) {
      state.enemyBullets.splice(bi, 1);
      events |= damagePlayer(world, b.damage);
      if (!player.alive) return events | EVENT_OVER;
    }
  }

  // Touching a creature hurts.
  for (let ei = state.enemies.length - 1; ei >= 0; ei -= 1) {
    const e = state.enemies[ei];
    const rr = e.radius + player.radius - 2;
    if ((e.x - player.x) ** 2 + (e.y - player.y) ** 2 < rr * rr) {
      events |= damagePlayer(world, e.touchDamage);
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      e.x = player.x + (dx / dist) * rr;
      e.y = player.y + (dy / dist) * rr;
      if (!player.alive) return events | EVENT_OVER;
    }
  }

  // Light shards: pick them up.
  for (let si = state.shards.length - 1; si >= 0; si -= 1) {
    const s = state.shards[si];
    const rr = s.radius + player.radius + 6;
    if ((s.x - player.x) ** 2 + (s.y - player.y) ** 2 < rr * rr) {
      state.shards.splice(si, 1);
      state.score += s.value;
      state.stats.shardsCollected += 1;
      spawnParticles(state.particles, world.random, s.x, s.y, '#ffe066', 4, 120, 0.3);
      events |= EVENT_PICKUP;
    }
  }

  // Power-ups: apply them.
  for (let pi = state.powerups.length - 1; pi >= 0; pi -= 1) {
    const p = state.powerups[pi];
    const rr = p.radius + player.radius + 4;
    if ((p.x - player.x) ** 2 + (p.y - player.y) ** 2 < rr * rr) {
      state.powerups.splice(pi, 1);
      state.stats.powerupsCollected += 1;
      if (p.kind === POWER_SPREAD) player.spreadT = POWERUP.spreadSeconds;
      else if (p.kind === POWER_RAPID) player.rapidT = POWERUP.rapidSeconds;
      else if (p.kind === POWER_SHIELD) player.shieldT = POWERUP.shieldSeconds;
      else if (p.kind === POWER_MAGNET) player.magnetT = POWERUP.magnetSeconds;
      else if (p.kind === POWER_REPAIR) player.hull = Math.min(player.maxHull, player.hull + POWERUP.repairHull);
      spawnFloater(state.floaters, player.x, player.y - 30, p.kind.toUpperCase(), '#7dffa8');
      spawnRing(state.particles, player.x, player.y, '#7dffa8');
      events |= EVENT_POWERUP;
    }
  }
  return events;
}

function stepDemo(world, dt) {
  // Attract mode behind the title screen: embers drift, a few wisps wander, nothing
  // can be hurt and nothing is scored.
  const state = world.state;
  state.time += dt;
  state.demoT -= dt;
  if (state.demoT <= 0) {
    state.demoT = 1.6;
    if (state.enemies.length < 5) {
      const angle = world.random.angle();
      state.enemies.push({
        kind: KIND_WISP,
        x: FIELD.width / 2 + Math.cos(angle) * 420,
        y: FIELD.height / 2 + Math.sin(angle) * 240,
        vx: 0,
        vy: 0,
        radius: ENEMY.wisp.radius,
        hp: 9999,
        maxHp: 9999,
        speed: 46,
        touchDamage: 0,
        score: 0,
        shards: 0,
        shotT: 0,
        wobble: world.random.angle(),
        wobbleSpeed: 1.4,
        flashT: 0,
        active: true,
      });
    }
  }
  for (const e of state.enemies) {
    e.wobble += e.wobbleSpeed * dt;
    e.x += Math.cos(e.wobble) * e.speed * dt;
    e.y += Math.sin(e.wobble * 0.7) * e.speed * dt;
    clampToField(e, e.radius + 4);
  }
  const player = state.player;
  const t = state.time * 0.35;
  player.x = FIELD.width / 2 + Math.cos(t) * 150;
  player.y = FIELD.height / 2 + Math.sin(t * 1.3) * 90;
  player.angle = t + Math.PI / 2;
  if (world.random.next() < dt * 6) {
    spawnParticles(state.particles, world.random, world.random.range(0, FIELD.width), FIELD.height + 10, '#ffd76a', 1, 30, 2.5);
  }
  stepParticles(state.particles, dt);
}

export function createWorld(random, sfx) {
  const world = {
    random,
    sfx: sfx || NO_SFX,
    state: null,
  };
  world.reset = function reset() {
    world.state = {
      time: 0,
      score: 0,
      combo: 0,
      comboTimer: 0,
      kills: 0,
      wave: 0,
      player: createPlayer(),
      bullets: [],
      enemyBullets: [],
      enemies: [],
      shards: [],
      powerups: [],
      particles: [],
      floaters: [],
      shake: 0,
      hitFlash: 0,
      over: false,
      won: false,
      demoT: 0,
      titanSummonT: 8,
      stats: { shotsFired: 0, shotsHit: 0, shardsCollected: 0, powerupsCollected: 0, timePlayed: 0 },
    };
    world.director = createDirector(random);
  };
  world.reset();
  return world;
}

/**
 * Advance the world one fixed step. `control` is { move, aimAngle, firing, dash };
 * `demo` runs the attract mode behind the title screen. Returns event flags.
 */
export function stepWorld(world, dt, control, demo) {
  const state = world.state;
  if (demo) {
    stepDemo(world, dt);
    return EVENT_NONE;
  }
  if (state.over || state.won) {
    stepParticles(state.particles, dt);
    stepFloaters(state.floaters, dt);
    return EVENT_NONE;
  }
  state.time += dt;
  state.stats.timePlayed += dt;
  state.shake = Math.max(0, state.shake - dt * 1.4);
  state.hitFlash = Math.max(0, state.hitFlash - dt);
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  let events = stepPlayer(world, control, dt);
  events |= stepEnemies(world, dt);
  if (stepDirector(world.director, world, dt)) events |= EVENT_WAVE_START;
  stepBullets(state.bullets, dt);
  stepBullets(state.enemyBullets, dt);
  stepShards(state.shards, state.player, dt);
  stepPowerups(state.powerups, dt, state.time);
  stepParticles(state.particles, dt);
  stepFloaters(state.floaters, dt);
  events |= resolveCollisions(world);

  if (world.director.state === WAVE_STATE_CLEAR && !state.over && !state.won) {
    if (world.director.wave >= WIN_WAVE) {
      state.won = true;
      events |= EVENT_WIN;
    } else {
      state.score += WAVE.clearBonus;
      state.player.hull = Math.min(state.player.maxHull, state.player.hull + WAVE.clearHeal);
      spawnFloater(state.floaters, state.player.x, state.player.y - 34, `WAVE BONUS +${WAVE.clearBonus}`, '#7dffa8');
      events |= EVENT_WAVE_CLEAR;
      startWave(world.director, world.random, world.director.wave + 1);
      state.wave = world.director.wave;
    }
  }
  if (events & EVENT_OVER) state.over = true;
  return events;
}

/** Start wave 1 (call once when a run begins). */
export function beginRun(world) {
  startWave(world.director, world.random, 1);
  world.state.wave = 1;
}

/** Enemies still standing or still to spawn in this wave. */
export function remainingInWave(world) {
  return waveRemaining(world.director, world);
}
