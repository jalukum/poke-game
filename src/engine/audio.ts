export class Sfx {
  private ctx: AudioContext | null = null;

  private context(): AudioContext | null {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, duration: number, delay = 0): void {
    const ctx = this.context();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.035, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  confirm(): void {
    this.tone(880, 0.06);
  }

  cancel(): void {
    this.tone(220, 0.07);
  }

  move(): void {
    this.tone(660, 0.03);
  }

  bump(): void {
    this.tone(140, 0.05);
  }

  save(): void {
    this.tone(523, 0.07);
    this.tone(659, 0.07, 0.08);
    this.tone(784, 0.1, 0.16);
  }
}
