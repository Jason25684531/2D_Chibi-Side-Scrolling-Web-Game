export class FixedStepController {
  accumulator = 0;
  constructor(readonly hz: number) { if (!Number.isFinite(hz) || hz <= 0) throw new Error('Invalid frequency'); }
  update(deltaSeconds: number, step: (dt: number) => void) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new Error('Invalid delta');
    this.accumulator += deltaSeconds;
    // ponytail: retain backlog, at most 6 catch-up steps/frame; revisit after kiosk latency measurement.
    for (let n = 0; n < 6 && this.accumulator + 1e-9 >= 1 / this.hz; n++) {
      this.accumulator -= 1 / this.hz; step(1 / this.hz);
    }
  }
  reset() { this.accumulator = 0; }
}
