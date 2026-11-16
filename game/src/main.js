// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, game over and win.
//
// ?seed=N fixes the waves. ?shot=start|play|over|win (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { beginRun, createWorld, EVENT_DASH, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_POWERUP, EVENT_SHOOT, EVENT_WAVE_CLEAR, EVENT_WAVE_START, EVENT_WIN, stepWorld } from './world.js';
import { waveRemaining } from './waves.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed), audio);
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function viewFor(screen, best) {
  return {
    state: world.state,
    screen,
    best,
    directorState: world.director.state,
    remaining: world.state.over || world.state.won ? 0 : waveRemaining(world.director, world),
  };
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(viewFor(scene.screen, scene.best));
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    beginRun(world);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Playing. Survive 10 waves.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.stopMusic();
    if (won) audio.win();
    else audio.lose();
    announce(won ? `Victory. Score ${world.state.score}. Best ${best}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function playEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_HIT) {
      audio.hurt();
      if (world.state.player.alive) announce(`Hit. Hull ${Math.ceil(world.state.player.hull)}.`);
    }
    if (events & EVENT_KILL) audio.enemyHit();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_POWERUP) audio.powerup();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_WAVE_START) audio.waveHorn();
    if (events & EVENT_WAVE_CLEAR) {
      audio.waveHorn();
      announce(`Wave ${world.state.wave} cleared.`);
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.muted);
      announce(audio.muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      audio.click();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function controlForFrame() {
    const move = input.direction();
    let aimAngle = world.state.player.angle;
    const aim = input.aimPoint();
    if (aim) {
      const logical = renderer.toLogical(aim.x, aim.y);
      aimAngle = Math.atan2(logical.y - world.state.player.y, logical.x - world.state.player.x);
    }
    const actions = input.takeActions();
    return {
      move,
      aimAngle,
      firing: input.firing,
      dash: !!(actions & ACTION_DASH) || input.dashHeld,
    };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      stepWorld(world, STEP, null, true);
      return;
    }
    const control = controlForFrame();
    const events = stepWorld(world, STEP, control, false);
    playEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(viewFor(screen, best));
  }

  // Leaving the tab pauses a running game rather than letting the Hollow eat the ship unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lumen Drift. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
