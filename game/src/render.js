// Everything the eye sees: the Hollow's dark sky, the lantern-ship's glow, every
// creature drawn by kind, the HUD and the five screens. All art is drawn in code;
// nothing is loaded from a file.

import { FIELD, FONT, GAME_NAME, GAME_TAGLINE, PALETTE, PLAYER, WIN_WAVE } from './config.js';
import { KIND_HULK, KIND_SPINNER, KIND_SPLITTER, KIND_TITAN, KIND_WISP, POWER_MAGNET, POWER_RAPID, POWER_REPAIR, POWER_SHIELD, POWER_SPREAD } from './entities.js';
import { WAVE_STATE_BANNER } from './waves.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function powerupLabel(kind) {
  if (kind === POWER_SPREAD) return 'TRI-SHOT';
  if (kind === POWER_RAPID) return 'RAPID';
  if (kind === POWER_SHIELD) return 'AEGIS';
  if (kind === POWER_MAGNET) return 'MAGNET';
  return 'REPAIR';
}

function powerupGlyph(kind) {
  if (kind === POWER_SPREAD) return '⁂';
  if (kind === POWER_RAPID) return '»';
  if (kind === POWER_SHIELD) return '◯';
  if (kind === POWER_MAGNET) return 'U';
  return '+';
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const starRandom = mulberry32(1337);
  const stars = [];
  for (let i = 0; i < 150; i += 1) {
    stars.push({
      x: starRandom() * FIELD.width,
      y: starRandom() * FIELD.height,
      r: 0.6 + starRandom() * 1.6,
      phase: starRandom() * Math.PI * 2,
      speed: 0.4 + starRandom() * 1.2,
    });
  }
  const nebulae = [
    { x: 220, y: 150, r: 340, color: PALETTE.nebulaA },
    { x: 1050, y: 110, r: 300, color: PALETTE.nebulaB },
    { x: 980, y: 600, r: 320, color: PALETTE.nebulaC },
    { x: 180, y: 600, r: 260, color: PALETTE.nebulaB },
  ];
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dpr = 1;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  /** Canvas CSS pixels (relative to the canvas) into the 1280x720 logical field. */
  function toLogical(cssX, cssY) {
    return {
      x: (cssX * dpr - offsetX) / scale,
      y: (cssY * dpr - offsetY) / scale,
    };
  }

  function drawBackground(time) {
    const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, '#0d0d20');
    grad.addColorStop(0.55, PALETTE.backdrop);
    grad.addColorStop(1, '#0a0616');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const n of nebulae) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, n.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    for (const s of stars) {
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(time * s.speed + s.phase));
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = PALETTE.star;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawGlow(x, y, radius, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }

  function drawPlayer(player, time) {
    if (!player.alive) return;
    const flicker = 0.75 + 0.25 * Math.sin(time * 6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(player.x, player.y, 190 * flicker, 'rgba(255, 190, 80, 0.20)', 1);
    ctx.restore();
    const blink = player.invulnT > 0 && Math.floor(time * 14) % 2 === 0;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 18;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -12);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(2, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (player.shieldT > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(125, 255, 168, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 10 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (player.dashTime > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#9adcff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEnemy(e, time) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.flashT > 0;
    if (e.kind === KIND_WISP) {
      const pulse = 1 + 0.18 * Math.sin(time * 6 + e.wobble);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(0, 0, e.radius * 3.2, 'rgba(142, 241, 255, 0.30)', 1);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = flash ? '#ffffff' : PALETTE.wisp;
      ctx.shadowColor = PALETTE.wisp;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#eafcff';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === KIND_SPINNER) {
      ctx.rotate(time * 1.8 + e.wobble);
      const hot = e.shotT < 0.45;
      ctx.fillStyle = flash ? '#ffffff' : hot ? '#e9c6ff' : PALETTE.spinner;
      ctx.shadowColor = PALETTE.spinner;
      ctx.shadowBlur = hot ? 22 : 12;
      ctx.beginPath();
      ctx.moveTo(0, -e.radius);
      ctx.lineTo(e.radius, 0);
      ctx.lineTo(0, e.radius);
      ctx.lineTo(-e.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#2a1245';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === KIND_SPLITTER) {
      ctx.rotate(Math.sin(time + e.wobble) * 0.4);
      ctx.fillStyle = flash ? '#ffffff' : PALETTE.splitter;
      ctx.shadowColor = PALETTE.splitter;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
        else ctx.lineTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#0c2b16';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -e.radius * 0.5);
      ctx.lineTo(0, e.radius * 0.5);
      ctx.moveTo(-e.radius * 0.5, 0);
      ctx.lineTo(e.radius * 0.5, 0);
      ctx.stroke();
    } else if (e.kind === KIND_HULK) {
      ctx.rotate(Math.sin(time * 0.7 + e.wobble) * 0.15);
      ctx.fillStyle = flash ? '#ffffff' : PALETTE.hulk;
      ctx.shadowColor = PALETTE.hulk;
      ctx.shadowBlur = 12;
      roundRect(ctx, -e.radius, -e.radius, e.radius * 2, e.radius * 2, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#4a2410';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-e.radius * 0.5, -e.radius * 0.4);
      ctx.lineTo(0, 0);
      ctx.lineTo(e.radius * 0.5, -e.radius * 0.2);
      ctx.moveTo(-e.radius * 0.3, e.radius * 0.5);
      ctx.lineTo(e.radius * 0.2, e.radius * 0.1);
      ctx.stroke();
      ctx.fillStyle = '#fff1d6';
      ctx.beginPath();
      ctx.arc(-e.radius * 0.35, -e.radius * 0.3, 3, 0, Math.PI * 2);
      ctx.arc(e.radius * 0.35, -e.radius * 0.3, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === KIND_TITAN) {
      ctx.rotate(Math.sin(time * 0.5) * 0.1);
      ctx.fillStyle = flash ? '#ffffff' : PALETTE.titan;
      ctx.shadowColor = PALETTE.titan;
      ctx.shadowBlur = 26;
      ctx.beginPath();
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        const r = i % 2 === 0 ? e.radius + 12 : e.radius - 4;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#3d0a14';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd7de';
      ctx.beginPath();
      ctx.arc(-e.radius * 0.2, -e.radius * 0.15, 5, 0, Math.PI * 2);
      ctx.arc(e.radius * 0.2, -e.radius * 0.15, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (e.kind === KIND_TITAN) {
      const w = 110;
      const x = e.x - w / 2;
      const y = e.y - e.radius - 26;
      ctx.fillStyle = 'rgba(10, 10, 24, 0.8)';
      roundRect(ctx, x - 2, y - 2, w + 4, 10, 4);
      ctx.fill();
      ctx.fillStyle = PALETTE.titan;
      roundRect(ctx, x, y, Math.max(0, w * (e.hp / e.maxHp)), 6, 3);
      ctx.fill();
      ctx.fillStyle = '#ffd7de';
      ctx.font = `700 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('GLOOM TITAN', e.x, y - 6);
    }
  }

  function drawBullets(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of state.bullets) {
      ctx.strokeStyle = PALETTE.bullet;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of state.enemyBullets) {
      drawGlow(b.x, b.y, 16, 'rgba(255, 122, 217, 0.5)', 1);
      ctx.fillStyle = PALETTE.enemyBullet;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe3f6';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPickups(state, time) {
    for (const s of state.shards) {
      const pulse = 1 + 0.25 * Math.sin(time * 8 + s.x);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.PI / 4);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(0, 0, 18, 'rgba(255, 224, 102, 0.35)', 1);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = PALETTE.shard;
      ctx.shadowColor = PALETTE.shard;
      ctx.shadowBlur = 8;
      const r = s.radius * pulse;
      ctx.fillRect(-r / 1.4, -r / 1.4, r * 1.4, r * 1.4);
      ctx.restore();
    }
    for (const p of state.powerups) {
      const bob = Math.sin(p.bob) * 3;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(0, 0, 34, 'rgba(125, 255, 168, 0.35)', 1);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(10, 26, 16, 0.9)';
      ctx.strokeStyle = PALETTE.powerup;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PALETTE.powerup;
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(powerupGlyph(p.kind), 0, 1);
      ctx.restore();
    }
  }

  function drawParticles(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of state.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.ring) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + (1 - alpha) * 46, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * alpha + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    for (const f of state.floaters) {
      const alpha = Math.max(0, f.life / f.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.color;
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(view) {
    const state = view.state;
    const player = state.player;
    ctx.textBaseline = 'alphabetic';
    // Top-left: score, best, combo.
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    roundRect(ctx, 16, 14, 250, 84, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('SCORE', 30, 36);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText(String(state.score), 30, 68);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`BEST ${view.best}`, 30, 88);
    if (state.combo >= 2) {
      ctx.fillStyle = '#ffb347';
      ctx.font = `800 16px ${FONT}`;
      ctx.fillText(`COMBO x${Math.max(1, state.combo)}`, 180, 40);
    }
    // Top-centre: wave and foes left.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, FIELD.width / 2 - 130, 14, 260, 58, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${Math.max(1, state.wave)} / ${WIN_WAVE}`, FIELD.width / 2, 40);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`${view.remaining} foes left`, FIELD.width / 2, 60);
    // Top-right: hull and dash.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, FIELD.width - 266, 14, 250, 84, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('HULL', FIELD.width - 252, 36);
    ctx.fillStyle = player.hull <= 30 ? PALETTE.danger : PALETTE.heal;
    ctx.font = `800 20px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(player.hull)}`, FIELD.width - 30, 38);
    const barX = FIELD.width - 252;
    const barY = 46;
    const barW = 222;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, barX, barY, barW, 10, 5);
    ctx.fill();
    ctx.fillStyle = player.hull <= 30 ? PALETTE.danger : PALETTE.heal;
    roundRect(ctx, barX, barY, Math.max(0, barW * (player.hull / player.maxHull)), 10, 5);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('DASH', barX, 76);
    const dashFrac = player.dashCd <= 0 ? 1 : 1 - player.dashCd / PLAYER.dashCooldown;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, barX + 44, 66, barW - 44, 8, 4);
    ctx.fill();
    ctx.fillStyle = dashFrac >= 1 ? '#9adcff' : '#5a6b9e';
    roundRect(ctx, barX + 44, 66, Math.max(0, (barW - 44) * dashFrac), 8, 4);
    ctx.fill();
    // Power-up timers, bottom-left.
    const timers = [];
    if (player.spreadT > 0) timers.push(`TRI-SHOT ${Math.ceil(player.spreadT)}s`);
    if (player.rapidT > 0) timers.push(`RAPID ${Math.ceil(player.rapidT)}s`);
    if (player.shieldT > 0) timers.push(`AEGIS ${Math.ceil(player.shieldT)}s`);
    if (player.magnetT > 0) timers.push(`MAGNET ${Math.ceil(player.magnetT)}s`);
    timers.forEach((label, i) => {
      const y = FIELD.height - 24 - i * 26;
      ctx.fillStyle = 'rgba(125, 255, 168, 0.14)';
      ctx.strokeStyle = 'rgba(125, 255, 168, 0.5)';
      roundRect(ctx, 16, y - 16, 150, 22, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PALETTE.powerup;
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(label, 28, y);
    });
    // Wave banner.
    if (view.directorState === WAVE_STATE_BANNER && view.screen === SCREEN_PLAY) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ffd76a';
      ctx.shadowBlur = 24;
      ctx.fillText(`WAVE ${Math.max(1, state.wave)}`, FIELD.width / 2, 250);
      ctx.shadowBlur = 0;
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 18px ${FONT}`;
      ctx.fillText(state.wave === WIN_WAVE ? 'THE GLOOM TITAN WAKES' : 'THE HOLLOW STIRS', FIELD.width / 2, 282);
    }
    // First-wave hint.
    if (state.wave === 1 && state.time < 8 && view.screen === SCREEN_PLAY) {
      ctx.fillStyle = 'rgba(238, 241, 255, 0.85)';
      ctx.font = `600 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('WASD move · Mouse aim · Hold click to fire · Shift dash · P pause · M mute', FIELD.width / 2, FIELD.height - 18);
    }
  }

  function drawPanel(x, y, w, h) {
    ctx.fillStyle = 'rgba(8, 10, 26, 0.78)';
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.stroke();
  }

  function drawTitle(view) {
    ctx.fillStyle = 'rgba(5, 6, 18, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    drawPanel(FIELD.width / 2 - 330, 130, 660, 440);
    ctx.fillStyle = PALETTE.player;
    ctx.font = `800 64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 30;
    ctx.fillText(GAME_NAME, FIELD.width / 2, 220);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText(GAME_TAGLINE, FIELD.width / 2, 254);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 17px ${FONT}`;
    ctx.fillText('Survive 10 waves of the Hollow and light it again.', FIELD.width / 2, 300);
    ctx.fillText('Collect light shards. Grab power-ups. Mind the Titan.', FIELD.width / 2, 326);
    ctx.fillStyle = '#ffd76a';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO START', FIELD.width / 2, 392);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText('WASD / Arrows — move      Mouse — aim      Hold click — fire', FIELD.width / 2, 448);
    ctx.fillText('Shift / Space — dash      P — pause      M — mute', FIELD.width / 2, 474);
    if (view.best > 0) {
      ctx.fillStyle = PALETTE.player;
      ctx.font = `800 18px ${FONT}`;
      ctx.fillText(`BEST SCORE  ${view.best}`, FIELD.width / 2, 524);
    }
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(5, 6, 18, 0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 52px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', FIELD.width / 2, 330);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 18px ${FONT}`;
    ctx.fillText('P or ESC to resume · M to mute', FIELD.width / 2, 372);
  }

  function drawStats(view, lines) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 18px ${FONT}`;
    ctx.textAlign = 'center';
    lines.forEach((line, i) => {
      ctx.fillText(line, FIELD.width / 2, 348 + i * 30);
    });
  }

  function drawOver(view) {
    const state = view.state;
    ctx.fillStyle = 'rgba(20, 4, 10, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `800 56px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.shadowColor = PALETTE.danger;
    ctx.shadowBlur = 26;
    ctx.fillText('THE LIGHT FADES', FIELD.width / 2, 250);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(`SCORE  ${state.score}`, FIELD.width / 2, 306);
    const accuracy = state.stats.shotsFired > 0 ? Math.round((100 * state.stats.shotsHit) / state.stats.shotsFired) : 0;
    drawStats(view, [
      `BEST  ${Math.max(view.best, state.score)}`,
      `REACHED WAVE  ${Math.max(1, state.wave)}  ·  ${state.kills} FOES LIT  ·  ${formatTime(state.stats.timePlayed)}`,
      `ACCURACY  ${accuracy}%  ·  SHARDS  ${state.stats.shardsCollected}`,
    ]);
    ctx.fillStyle = '#ffd76a';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO TRY AGAIN', FIELD.width / 2, 480);
  }

  function drawWin(view) {
    const state = view.state;
    ctx.fillStyle = 'rgba(6, 14, 8, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = '#ffd76a';
    ctx.font = `800 56px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ffd76a';
    ctx.shadowBlur = 30;
    ctx.fillText('THE HOLLOW IS LIT', FIELD.width / 2, 250);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(`SCORE  ${state.score}`, FIELD.width / 2, 306);
    const accuracy = state.stats.shotsFired > 0 ? Math.round((100 * state.stats.shotsHit) / state.stats.shotsFired) : 0;
    drawStats(view, [
      `BEST  ${Math.max(view.best, state.score)}`,
      `ALL 10 WAVES CLEARED  ·  ${state.kills} FOES LIT  ·  ${formatTime(state.stats.timePlayed)}`,
      `ACCURACY  ${accuracy}%  ·  SHARDS  ${state.stats.shardsCollected}  ·  POWER-UPS  ${state.stats.powerupsCollected}`,
    ]);
    ctx.fillStyle = '#ffd76a';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO PLAY AGAIN', FIELD.width / 2, 480);
  }

  function draw(view) {
    const state = view.state;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 22 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 22 : 0;
    ctx.setTransform(scale, 0, 0, scale, offsetX + shakeX * scale, offsetY + shakeY * scale);
    drawBackground(state.time);
    for (const e of state.enemies) drawEnemy(e, state.time);
    drawPickups(state, state.time);
    drawBullets(state);
    drawPlayer(state.player, state.time);
    drawParticles(state);
    if (state.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 60, 80, ${state.hitFlash * 0.45})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    // Vignette: the Hollow is dark at its edges, bright where the lantern flies.
    const vg = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(2, 2, 10, 0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    if (view.screen === SCREEN_PLAY || view.screen === SCREEN_PAUSED) drawHud(view);
    if (view.screen === SCREEN_TITLE) drawTitle(view);
    else if (view.screen === SCREEN_PAUSED) drawPaused();
    else if (view.screen === SCREEN_OVER) drawOver(view);
    else if (view.screen === SCREEN_WIN) drawWin(view);
  }

  return { draw, resize, toLogical, get scale() { return scale; } };
}
