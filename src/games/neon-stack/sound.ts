const VOLUME = 0.45;
// A rising scale for consecutive combos (C major pentatonic).
const COMBO_NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];

/** Synthesised sound effects via Web Audio — no audio files. */
export class Sound {
  muted = false;
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;

  /** Browsers only allow audio after a user gesture, so call this from input handlers. */
  init(): void {
    if (!this.ac) {
      this.ac = new AudioContext();
      this.master = this.ac.createGain();
      this.master.gain.value = this.muted ? 0 : VOLUME;
      this.master.connect(this.ac.destination);
    }
    if (this.ac.state === 'suspended') void this.ac.resume();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : VOLUME;
  }

  move(): void { this.tone(220, 0.03, 'square', 0.03); }
  rotate(): void { this.tone(440, 0.05, 'triangle', 0.06, 660); }
  hold(): void { this.tone(330, 0.12, 'sine', 0.08, 165); }
  softLock(): void { this.tone(160, 0.06, 'square', 0.06); }
  hardDrop(): void {
    this.noise(0.12, 0.25, 900);
    this.tone(110, 0.15, 'sine', 0.2, 50);
  }
  clear(lines: number, combo: number): void {
    const base = COMBO_NOTES[Math.min(Math.max(combo, 0), COMBO_NOTES.length - 1)];
    for (let i = 0; i < lines; i++) setTimeout(() => this.tone(base * 2 ** (i * 4 / 12), 0.18, 'square', 0.07), i * 45);
    this.noise(0.25, 0.12, 4000);
  }
  quad(): void { this.arpeggio([523, 659, 784, 1047, 1319], 55, 'sawtooth'); }
  tSpin(): void { this.arpeggio([784, 1175, 1568, 2349], 40, 'triangle'); }
  allClear(): void { this.arpeggio([523, 659, 784, 1047, 1319, 1568, 2093], 70, 'square'); }
  levelUp(): void { this.arpeggio([392, 523, 659, 784], 80, 'square'); }
  gameOver(): void { this.arpeggio([392, 330, 262, 196, 131], 160, 'sawtooth'); }

  private arpeggio(notes: number[], gapMs: number, type: OscillatorType): void {
    notes.forEach((f, i) => setTimeout(() => this.tone(f, 0.16, type, 0.06), i * gapMs));
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, to?: number): void {
    const { ac, master } = this;
    if (!ac || !master) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur);
  }

  private noise(dur: number, vol: number, cutoff: number): void {
    const { ac, master } = this;
    if (!ac || !master) return;
    const t = ac.currentTime;
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
  }
}
