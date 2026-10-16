const VOLUME = 0.45;

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

  coin(): void {
    this.tone(988, 0.08, 'square', 0.06);
    setTimeout(() => this.tone(1319, 0.18, 'square', 0.06), 70);
  }
  jump(): void { this.tone(320, 0.22, 'triangle', 0.12, 640); }
  land(): void { this.noise(0.12, 0.18, 500); }
  slide(): void { this.noise(0.4, 0.14, 1600); }
  step(): void { this.noise(0.05, 0.05, 900); }
  crash(): void {
    this.noise(0.6, 0.45, 700);
    this.tone(140, 0.5, 'sawtooth', 0.12, 50);
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
