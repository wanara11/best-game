// Every sound is synthesised with WebAudio: short oscillator blips and filtered noise,
// no audio files. The context starts only after the player's first gesture (a browser
// rule), and every call is a no-op until then, so shot scenes stay silent.

function createNoopAudio() {
  const noop = () => {};
  return {
    unlock: noop,
    setMuted: noop,
    muted: false,
    shoot: noop,
    enemyHit: noop,
    explosion: noop,
    pickup: noop,
    powerup: noop,
    hurt: noop,
    dash: noop,
    waveHorn: noop,
    win: noop,
    lose: noop,
    click: noop,
    startMusic: noop,
    stopMusic: noop,
  };
}

export function createAudio() {
  if (typeof window === 'undefined' || !window.AudioContext) return createNoopAudio();
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (context) return true;
    try {
      context = new window.AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  /** Call from a key or click handler: browsers only allow sound after a gesture. */
  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!context || muted) return;
    const t0 = context.currentTime + (delay || 0);
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq, delay) {
    if (!context || muted) return;
    const t0 = context.currentTime + (delay || 0);
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq || 1200;
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  // A slow four-note bass walk under the game, one note a beat, in A minor.
  const BASS_LINE = [110, 130.81, 98, 146.83];
  function scheduleMusic() {
    if (!context || muted) return;
    const freq = BASS_LINE[musicStep % BASS_LINE.length];
    musicStep += 1;
    const t0 = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.9, t0 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(t0);
    osc.stop(t0 + 0.6);
    tone(freq * 2, 0.3, 'sine', 0.05, null, 0);
  }

  return {
    unlock,
    setMuted(value) {
      muted = !!value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    get muted() {
      return muted;
    },
    shoot() {
      tone(720, 0.07, 'square', 0.08, 340);
    },
    enemyHit() {
      tone(220, 0.05, 'square', 0.06, 160);
    },
    explosion() {
      noise(0.35, 0.35, 900);
      tone(90, 0.3, 'sine', 0.25, 40);
    },
    pickup() {
      tone(880, 0.08, 'sine', 0.12, 1320);
    },
    powerup() {
      tone(523, 0.1, 'sine', 0.14);
      tone(659, 0.1, 'sine', 0.14, null, 0.09);
      tone(784, 0.16, 'sine', 0.14, null, 0.18);
    },
    hurt() {
      tone(160, 0.25, 'sawtooth', 0.2, 60);
      noise(0.15, 0.2, 500);
    },
    dash() {
      noise(0.18, 0.14, 2400);
    },
    waveHorn() {
      tone(196, 0.35, 'triangle', 0.18, 294);
      tone(294, 0.35, 'triangle', 0.12, null, 0.12);
    },
    win() {
      [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.35, 'sine', 0.15, null, i * 0.13));
    },
    lose() {
      [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.4, 'triangle', 0.14, null, i * 0.16));
    },
    click() {
      tone(660, 0.05, 'sine', 0.1);
    },
    startMusic() {
      if (!context) return;
      if (musicTimer) return;
      musicTimer = setInterval(scheduleMusic, 500);
    },
    stopMusic() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
