export const FLOW = ['P0','P1','P2','P3','P4','P5','P6','P7'] as const;
export type Flow = typeof FLOW[number];
export class GameplayStateMachine {
  flow: Flow = 'P0';
  transition(next: Flow) {
    const legal = next === 'P0' || FLOW.indexOf(next) === FLOW.indexOf(this.flow) + 1 || (this.flow === 'P7' && next === 'P4');
    if (!legal) throw new Error(`Illegal flow transition ${this.flow} -> ${next}`);
    this.flow = next;
  }
  enterGameplay() { while (this.flow !== 'P4') this.transition(FLOW[FLOW.indexOf(this.flow) + 1]); }
}
export type Phase = 'new-run'|'running'|'paused'|'respawning'|'goal-reached'|'time-up'|'finished';
export class RunStateManager {
  readonly runId = crypto.randomUUID();
  readonly attemptId = crypto.randomUUID();
  phase: Phase = 'new-run';
  elapsed = 0;
  remaining: number;
  tick = 0;
  readonly scoredEnemyIds = new Set<string>();
  constructor(readonly duration: number, readonly sessionId: string, readonly timeTier = `${duration}`) {
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid time tier');
    this.remaining = duration;
  }
  start() { if (this.phase !== 'new-run') throw new Error('Run already started'); this.phase = 'running'; }
  pause() { if (this.phase === 'running') this.phase = 'paused'; }
  resume() { if (this.phase === 'paused') this.phase = 'running'; }
  step(dt: number) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Invalid delta');
    if (this.phase !== 'running') return;
    this.elapsed += dt; this.remaining = Math.max(0, this.duration - this.elapsed); this.tick++;
  }
  respawn() { if (this.phase === 'running') this.phase = 'respawning'; }
  recovered() { if (this.phase === 'respawning') this.phase = 'running'; }
  end(reason: 'goal'|'time-up') {
    if (this.phase !== 'running') return false;
    this.phase = reason === 'goal' ? 'goal-reached' : 'time-up'; return true;
  }
  finish() { if (this.phase === 'goal-reached' || this.phase === 'time-up') this.phase = 'finished'; }
  replay() { const next = new RunStateManager(this.duration, this.sessionId, this.timeTier); next.start(); return next; }
}
