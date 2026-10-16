export class FixedStepController {
  accumulator = 0;
  private clockPending = 0;
  constructor(readonly hz: number) { if (!Number.isFinite(hz) || hz <= 0) throw new Error('Invalid frequency'); }
  update(deltaSeconds: number, step: (dt: number, elapsed: number) => void) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new Error('Invalid delta');
    this.accumulator += deltaSeconds;
    this.clockPending += deltaSeconds;
    const count = Math.min(6, Math.floor((this.accumulator + 1e-9) * this.hz));
    const elapsed = count ? this.clockPending / count : 0;
    if (count) this.clockPending = 0;
    // ponytail: retain backlog, at most 6 catch-up steps/frame; revisit after kiosk latency measurement.
    for (let n = 0; n < count; n++) {
      this.accumulator -= 1 / this.hz; step(1 / this.hz, elapsed);
    }
  }
  reset() { this.accumulator = 0; this.clockPending = 0; }
}
