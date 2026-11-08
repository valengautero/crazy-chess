/** Todo el audio se sintetiza con WebAudio: sin archivos. */
import { loadSettings } from '../core/settings';

let ctx: AudioContext | null = null;
let sfxBus: GainNode;
let musicBus: GainNode;
let noiseBuf: AudioBuffer;

export type Sfx = 'move' | 'capture' | 'check' | 'mate' | 'castle' | 'promote' | 'click' | 'hover' | 'error';

/** Debe llamarse desde un gesto del usuario (los navegadores bloquean el audio antes). */
export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    musicBus.connect(lp);
    lp.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  applyAudioSettings();
}

// La música no debe seguir sonando si la pestaña queda en segundo plano o se cierra.
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend();
  else void ctx.resume();
});
window.addEventListener('pagehide', () => {
  stopMusic();
  void ctx?.close();
  ctx = null; // si la página vuelve del caché, el próximo clic crea un contexto nuevo
});

export function applyAudioSettings(): void {
  if (!ctx) return;
  const s = loadSettings();
  sfxBus.gain.setTargetAtTime(s.sfx ? 0.5 : 0, ctx.currentTime, 0.02);
  musicBus.gain.setTargetAtTime(s.music ? 0.55 : 0, ctx.currentTime, 0.3);
  if (s.music) startMusic();
  else stopMusic();
}

interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  slideTo?: number;
  delay?: number;
}

function tone(freq: number, dur: number, o: ToneOpts = {}): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
  const v = o.vol ?? 0.25;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(sfxBus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol: number, freq = 1200, delay = 0): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export function playSfx(name: Sfx): void {
  if (!ctx || !loadSettings().sfx) return;
  switch (name) {
    case 'move':
      tone(320, 0.09, { slideTo: 190, vol: 0.22 });
      noise(0.05, 0.12, 900);
      break;
    case 'capture':
      noise(0.18, 0.35, 700);
      tone(180, 0.18, { slideTo: 60, vol: 0.3 });
      tone(420, 0.06, { vol: 0.15 });
      break;
    case 'castle':
      tone(300, 0.08, { slideTo: 200 });
      tone(380, 0.08, { slideTo: 250, delay: 0.1 });
      break;
    case 'promote':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, { delay: i * 0.07, type: 'triangle', vol: 0.25 }));
      break;
    case 'check':
      tone(880, 0.1, { vol: 0.22 });
      tone(660, 0.14, { vol: 0.22, delay: 0.11 });
      break;
    case 'mate':
      [784, 659, 523, 392, 262].forEach((f, i) => tone(f, 0.22, { delay: i * 0.13, type: 'square', vol: 0.25 }));
      noise(0.5, 0.2, 500, 0.4);
      break;
    case 'click':
      tone(520, 0.05, { vol: 0.18 });
      break;
    case 'hover':
      tone(900, 0.025, { vol: 0.06, type: 'triangle' });
      break;
    case 'error':
      tone(140, 0.15, { vol: 0.25 });
      break;
  }
}

// ---------- música lo-fi procedural ----------
const BPM = 72;
const STEP = 60 / BPM / 2; // corchea
const CHORDS = [
  { root: 45, notes: [57, 60, 64, 67] }, // Am7
  { root: 41, notes: [53, 57, 60, 64] }, // Fmaj7
  { root: 48, notes: [55, 60, 64, 67] }, // Cmaj7
  { root: 43, notes: [55, 59, 62, 65] }, // G7
];
const MELODY = [69, 72, 74, 76, 79, 81];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

let timer: number | null = null;
let nextTime = 0;
let step = 0;

function startMusic(): void {
  if (!ctx || timer !== null) return;
  nextTime = ctx.currentTime + 0.1;
  timer = window.setInterval(() => {
    while (ctx && nextTime < ctx.currentTime + 0.3) {
      scheduleStep(step++, nextTime);
      nextTime += STEP;
    }
  }, 100);
}

function stopMusic(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

function mTone(freq: number, t0: number, dur: number, type: OscillatorType, vol: number, attack = 0.01): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(musicBus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function mNoise(t0: number, dur: number, vol: number, freq: number): void {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(musicBus);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function scheduleStep(n: number, t: number): void {
  const inBar = n % 8;
  const chord = CHORDS[Math.floor(n / 8) % CHORDS.length]!;
  // pad (suave, una vez por compás)
  if (inBar === 0) for (const note of chord.notes) mTone(midi(note), t, STEP * 8, 'triangle', 0.07, 0.4);
  // bajo
  if (inBar === 0 || inBar === 5) mTone(midi(chord.root), t, STEP * 3, 'sine', 0.3);
  // percusión lo-fi
  if (inBar === 0 || inBar === 3) mTone(60, t, 0.15, 'sine', 0.45);
  if (inBar === 4) mNoise(t, 0.12, 0.25, 1500);
  if (inBar % 2 === 1) mNoise(t, 0.03, 0.08, 6000);
  // melodía esporádica
  if (inBar % 2 === 0 && Math.random() < 0.3) {
    const note = MELODY[Math.floor(Math.random() * MELODY.length)]!;
    mTone(midi(note), t, STEP * 2.5, 'triangle', 0.09, 0.02);
  }
}
