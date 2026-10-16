interface ToneOptions {
  type?: OscillatorType;
  vol?: number;
  to?: number;
}

const VOLUME = 0.5;
const MARCH_NOTES = [98, 87, 78, 73];

/** Synthesised sound effects via Web Audio — no audio assets needed. */
export class Sound {
  muted = false;
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private ufoNodes: OscillatorNode[] | null = null;

  /** Browsers only allow audio after a user gesture, so call this from input handlers. */
  init(): void {
    if (!this.ac) {
      const AC =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = VOLUME;
      this.master.connect(this.ac.destination);
    }
    if (this.ac.state === 'suspended') void this.ac.resume();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : VOLUME;
  }

  shoot(): void { this.tone(880, 0.12, { to: 220, vol: 0.08 }); }
  fireball(): void {
    this.noise(0.3, 0.2, 1200);
    this.tone(300, 0.3, { to: 80, vol: 0.08, type: 'sawtooth' });
  }
  hit(): void { this.noise(0.18, 0.25, 3000); }
  death(): void { this.noise(0.9, 0.4, 900); }
  march(step: number): void { this.tone(MARCH_NOTES[step % MARCH_NOTES.length], 0.09, { vol: 0.2 }); }
  armorHit(): void { this.tone(1400, 0.06, { to: 700, vol: 0.1 }); }
  dive(): void { this.tone(1200, 0.6, { to: 300, vol: 0.06, type: 'triangle' }); }
  shieldBlock(): void { this.tone(1500, 0.1, { to: 600, vol: 0.1, type: 'triangle' }); }
  ufoHit(): void { this.tone(1200, 0.5, { to: 150, vol: 0.12, type: 'sawtooth' }); }
  bossAlarm(): void {
    [0, 1, 2, 3, 4, 5].forEach(i => setTimeout(() => this.tone(i % 2 ? 220 : 330, 0.3, { vol: 0.1 }), i * 320));
  }
  bossShot(): void { this.tone(420, 0.12, { to: 140, vol: 0.06, type: 'sawtooth' }); }
  bossHit(): void { this.tone(320, 0.05, { to: 180, vol: 0.06 }); }
  bossCharge(): void { this.tone(150, 1, { to: 1400, vol: 0.08, type: 'sawtooth' }); }
  bossBeam(seconds: number): void {
    this.tone(95, seconds, { to: 70, vol: 0.16, type: 'sawtooth' });
    this.noise(seconds, 0.12, 1800);
  }
  bossBlast(): void { this.noise(0.3, 0.3, 1400); }
  bossDeath(): void {
    this.noise(2.2, 0.7, 400);
    this.tone(220, 2, { to: 20, vol: 0.2, type: 'sawtooth' });
  }
  strafeAlarm(): void {
    [0, 1, 2, 3].forEach(i => setTimeout(() => this.tone(i % 2 ? 660 : 990, 0.15, { vol: 0.07 }), i * 160));
  }
  strafeShot(): void { this.tone(500, 0.06, { to: 250, vol: 0.035 }); }
  droneShot(): void { this.tone(1400, 0.07, { to: 500, vol: 0.04 }); }
  /** One buzz per laser damage tick; back-to-back they make a continuous hum. */
  laser(): void {
    this.tone(140, 0.09, { to: 110, vol: 0.06, type: 'sawtooth' });
    this.tone(1800, 0.05, { to: 1500, vol: 0.02, type: 'triangle' });
  }
  freeze(): void { this.arpeggio([2093, 1568, 2637, 1976], 40); }
  nuke(): void {
    this.noise(1.4, 0.6, 500);
    this.tone(120, 1.2, { to: 30, vol: 0.2, type: 'sawtooth' });
  }

  extraLife(): void { this.arpeggio([523, 659, 784, 1047], 90); }
  powerUp(): void { this.arpeggio([392, 523, 659, 784, 1047], 50); }

  private arpeggio(notes: number[], gapMs: number): void {
    notes.forEach((f, i) => setTimeout(() => this.tone(f, 0.12, { vol: 0.1 }), i * gapMs));
  }

  ufoStart(): void {
    const { ac, master } = this;
    if (!ac || !master || this.ufoNodes) return;
    const osc = ac.createOscillator();
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 520;
    lfo.frequency.value = 9;
    lfoGain.gain.value = 140;
    gain.gain.value = 0.04;
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(gain).connect(master);
    osc.start();
    lfo.start();
    this.ufoNodes = [osc, lfo];
  }

  ufoStop(): void {
    this.ufoNodes?.forEach(n => n.stop());
    this.ufoNodes = null;
  }

  private tone(freq: number, dur: number, { type = 'square', vol = 0.15, to }: ToneOptions = {}): void {
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
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
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
