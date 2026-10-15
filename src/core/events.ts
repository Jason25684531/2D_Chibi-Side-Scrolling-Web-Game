import EventEmitter from 'eventemitter3';
export type EventKind = 'PLAYER_DAMAGED'|'BADGE_COLLECTED'|'BADGE_SCATTERED'|'ENEMY_DEFEATED'|'PLAYER_RESPAWNED'|'POWERUP_ACTIVATED'|'GOAL_REACHED'|'TIME_UP'|'PLAYER_FELL';
export type GameplayEvent = { kind: EventKind; runId: string; eventId: string; tick: number; entityId: string; cause: string };
export class GameplayEventBus extends EventEmitter {
  private processed = new Set<string>();
  constructor(readonly runId: string) { super(); }
  publish(event: GameplayEvent) {
    if (event.runId !== this.runId || this.processed.has(event.eventId)) return false;
    this.processed.add(event.eventId); this.emit(event.kind, event); return true;
  }
  dispose() { this.removeAllListeners(); this.processed.clear(); }
}
