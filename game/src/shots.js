// The screenshot scenes behind ?shot=start|play|over|win. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by an autopilot, so
// the frame is what a real game looks like and the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { beginRun, stepWorld } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { WAVE_STATE_ACTIVE } from './waves.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const LIMIT_SECONDS = 600;
const WIN_LIMIT_SECONDS = 420;
const SAMPLE = STEP;

/** The autopilot's control for one step: where to move, where to aim, whether to fire. */
function autopilot(world, skill) {
  const state = world.state;
  const player = state.player;
  if (!player.alive) return { move: { x: 0, y: 0 }, aimAngle: player.angle, firing: false, dash: false };

  let nearest = null;
  let nearestDist = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = e;
    }
  }
  let nearestShard = null;
  let nearestShardDist = Infinity;
  for (const s of state.shards) {
    const d = Math.hypot(s.x - player.x, s.y - player.y);
    if (d < nearestShardDist) {
      nearestShardDist = d;
      nearestShard = s;
    }
  }

  let aimAngle = player.angle;
  if (nearest) aimAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);

  let moveX = 0;
  let moveY = 0;
  let dash = false;
  if (skill === 'weak') {
    // A hurried player: fires at whatever is nearest but drifts toward the middle,
    // never dodges and never dashes, so it is caught out once the wave thickens.
    const dx = FIELD.width / 2 - player.x;
    const dy = FIELD.height / 2 - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 40) {
      moveX = dx / dist;
      moveY = dy / dist;
    }
    return { move: { x: moveX, y: moveY }, aimAngle, firing: !!nearest, dash: false };
  }

  // Strong play: keep a firing distance, back off when crowded, chase shards nearby.
  if (nearest && nearestDist < 150) {
    const dx = player.x - nearest.x;
    const dy = player.y - nearest.y;
    const dist = Math.hypot(dx, dy) || 1;
    moveX = dx / dist;
    moveY = dy / dist;
    if (nearestDist < 105 && player.dashCd <= 0) dash = true;
  } else if (nearestShard && nearestShardDist < 300 && (!nearest || nearestDist > 240)) {
    const dx = nearestShard.x - player.x;
    const dy = nearestShard.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    moveX = dx / dist;
    moveY = dy / dist;
  } else if (nearest && nearestDist > 330) {
    const dx = nearest.x - player.x;
    const dy = nearest.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    moveX = dx / dist;
    moveY = dy / dist;
  } else if (nearest) {
    // Strafe: circle the target while firing.
    const dx = nearest.x - player.x;
    const dy = nearest.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    moveX = -dy / dist;
    moveY = dx / dist;
  }
  // Never hug a wall while strafing: steer back inside.
  if (player.x < 90) moveX = Math.max(moveX, 0.6);
  if (player.x > FIELD.width - 90) moveX = Math.min(moveX, -0.6);
  if (player.y < 90) moveY = Math.max(moveY, 0.6);
  if (player.y > FIELD.height - 90) moveY = Math.min(moveY, -0.6);
  return { move: { x: moveX, y: moveY }, aimAngle, firing: !!nearest, dash };
}

/**
 * Set `world` to the named scene (start, play, over or win; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'over' && name !== 'win') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) stepWorld(world, STEP, null, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  beginRun(world);
  const skill = name === 'over' ? 'weak' : 'strong';
  const limit = name === 'win' ? WIN_LIMIT_SECONDS : name === 'over' ? LIMIT_SECONDS : PLAY_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    const control = autopilot(world, skill);
    stepWorld(world, STEP, control, false);
    if (world.state.over || world.state.won) break;
    void SAMPLE;
  }
  if (name === 'play' && !world.state.over && !world.state.won) {
    // A play shot must show the fight, not a wave banner: keep playing until a wave
    // is live with creatures on screen (at most 30 s more).
    let extra = 0;
    while (
      (world.director.state !== WAVE_STATE_ACTIVE || world.state.enemies.length < 4) &&
      extra < 30 / STEP
    ) {
      const control = autopilot(world, 'strong');
      stepWorld(world, STEP, control, false);
      if (world.state.over || world.state.won) break;
      extra += 1;
    }
  }
  if (world.state.won) return { screen: SCREEN_WIN, best: world.state.score };
  if (world.state.over) return { screen: SCREEN_OVER, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
