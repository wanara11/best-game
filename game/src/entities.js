// The things that move: the lantern-ship, its shots, the Hollow's creatures, the light
// shards they drop, power-ups, sparks and floating score text. Factories make them;
// the step functions move them one fixed step.

import { ENEMY, FIELD, PLAYER, POOL, POWERUP } from './config.js';

export const KIND_WISP = 'wisp';
export const KIND_SPINNER = 'spinner';
export const KIND_SPLITTER = 'splitter';
export const KIND_HULK = 'hulk';
export const KIND_TITAN = 'titan';

export const POWER_SPREAD = 'spread';
export const POWER_RAPID = 'rapid';
export const POWER_SHIELD = 'shield';
export const POWER_MAGNET = 'magnet';
export const POWER_REPAIR = 'repair';

const POWERUP_KINDS = [POWER_SPREAD, POWER_RAPID, POWER_SHIELD, POWER_MAGNET, POWER_REPAIR];

export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hull: PLAYER.hull,
    maxHull: PLAYER.maxHull,
    fireCd: 0,
    dashCd: 0,
    dashTime: 0,
    dashX: 0,
    dashY: 0,
    invulnT: 0,
    spreadT: 0,
    rapidT: 0,
    shieldT: 0,
    magnetT: 0,
    alive: true,
  };
}

export function spawnEnemy(random, kind, x, y, wave) {
  const spec = ENEMY[kind];
  const hpScale = 1 + (wave - 1) * 0.09;
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: spec.radius,
    hp: spec.hp * hpScale,
    maxHp: spec.hp * hpScale,
    speed: spec.speed * (1 + (wave - 1) * 0.03),
    touchDamage: spec.touchDamage,
    score: spec.score,
    shards: spec.shards,
    shotT: random.range(1, spec.shotInterval || 2),
    wobble: random.angle(),
    wobbleSpeed: random.range(1.5, 3),
    flashT: 0,
    active: true,
  };
}

/** A spawn point on the field's edge, away from the player. */
export function edgeSpawn(random, player) {
  for (let tries = 0; tries < 8; tries += 1) {
    const side = random.int(0, 3);
    let x;
    let y;
    if (side === 0) {
      x = random.range(40, FIELD.width - 40);
      y = 36;
    } else if (side === 1) {
      x = random.range(40, FIELD.width - 40);
      y = FIELD.height - 36;
    } else if (side === 2) {
      x = 36;
      y = random.range(40, FIELD.height - 40);
    } else {
      x = FIELD.width - 36;
      y = random.range(40, FIELD.height - 40);
    }
    if (Math.hypot(x - player.x, y - player.y) > 320) return { x, y };
  }
  return { x: 60, y: 60 };
}

export function spawnBullet(list, x, y, angle, speed, damage, friendly) {
  if (list.length >= POOL.bullets) return;
  list.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: friendly ? PLAYER.bulletRadius : 6,
    damage,
    friendly,
    life: 1.1,
    active: true,
  });
}

export function spawnShard(list, random, x, y) {
  if (list.length >= POOL.shards) return;
  const angle = random.angle();
  const speed = random.range(40, 140);
  list.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 6,
    value: POWERUP.shardScore,
    life: 9,
    active: true,
  });
}

export function spawnPowerup(list, random, x, y) {
  if (list.length >= POOL.powerups) return;
  list.push({ x, y, kind: random.pick(POWERUP_KINDS), radius: 14, life: 11, active: true, bob: random.angle() });
}

export function spawnParticles(list, random, x, y, color, count, speed, life) {
  for (let i = 0; i < count; i += 1) {
    if (list.length >= POOL.particles) return;
    const angle = random.next() * Math.PI * 2;
    const v = speed * (0.3 + random.next() * 0.7);
    list.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      radius: 1.5 + random.next() * 3,
      color,
      life: life * (0.5 + random.next() * 0.5),
      maxLife: life,
      active: true,
    });
  }
}

export function spawnRing(list, x, y, color) {
  if (list.length >= POOL.particles) return;
  list.push({ x, y, vx: 0, vy: 0, radius: 6, color, life: 0.45, maxLife: 0.45, ring: true, active: true });
}

export function spawnFloater(list, x, y, text, color) {
  if (list.length >= POOL.floaters) return;
  list.push({ x, y, text, color, life: 1.1, maxLife: 1.1, active: true });
}

function moveWithDrag(body, dt) {
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  body.vx *= 1 - 2.2 * dt;
  body.vy *= 1 - 2.2 * dt;
}

export function stepBullets(list, dt) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const b = list[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
      list.splice(i, 1);
    }
  }
}

export function stepShards(list, player, dt) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const s = list[i];
    const dx = player.x - s.x;
    const dy = player.y - s.y;
    const dist = Math.hypot(dx, dy);
    if (player.magnetT > 0 && dist < POWERUP.magnetRadius && dist > 1) {
      s.vx += (dx / dist) * 900 * dt;
      s.vy += (dy / dist) * 900 * dt;
    }
    moveWithDrag(s, dt);
    s.life -= dt;
    if (s.life <= 0) list.splice(i, 1);
  }
}

export function stepPowerups(list, dt, time) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.bob += dt * 2;
    p.life -= dt;
    if (p.life <= 0) list.splice(i, 1);
  }
  void time;
}

export function stepParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 3 * dt;
    p.vy *= 1 - 3 * dt;
    p.life -= dt;
    if (p.life <= 0) list.splice(i, 1);
  }
}

export function stepFloaters(list, dt) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const f = list[i];
    f.y -= 34 * dt;
    f.life -= dt;
    if (f.life <= 0) list.splice(i, 1);
  }
}
