import {it,expect} from 'vitest';
import {GameplaySession} from '../../src/core/session';
it('credit -> damage -> recovery -> respawn -> rekill -> goal -> replay contract',()=>{
 const s=new GameplaySession(60,'session');s.pickup('b');s.credit('e','melee');const before=s.score.total;const drops=s.hit('enemy').drops;s.tick(.3);s.pickup(drops[0]);s.respawn('pit');s.recovered();expect(s.credit('e','melee')).toBe(false);expect(s.combo.count).toBe(0);expect(s.score.total).toBe(before);const r=s.finish('goal')!;expect(r.scoreBreakdown.noDrop).toBe(0);expect(r.heldBadgeCount).toBe(0);expect(r.playerStatistics.respawns).toBe(1);
 const replay=new GameplaySession(s.run.duration,s.run.sessionId);expect(replay.run.runId).not.toBe(s.run.runId);expect(replay.run.timeTier).toBe(s.run.timeTier);expect(replay.badges.held).toBe(0);expect(replay.credit('e','melee')).toBe(true);
});
