import {it,expect} from 'vitest';
import {GameplaySession} from '../../src/core/session';
import {FixedStepController} from '../../src/core/fixed-step';

it('applies approved tiers to all enemy types and excludes Ally from Combo',()=>{
  const s=new GameplaySession(90,'s');
  const points=[20,24,30,40,50,50];
  points.forEach((points,i)=>{const before=s.score.total;s.credit(`${i}`,(['melee','ranged','drone'] as const)[i%3]);expect(s.score.total-before).toBe(points);});
  const count=s.combo.count,expires=s.combo.expires,before=s.score.total;
  s.credit('ally','melee',true);expect(s.score.total-before).toBe(20);
  expect(s.combo.count).toBe(count);expect(s.combo.expires).toBe(expires);
  s.respawn('pit');s.recovered();expect(s.credit('ally','melee',true)).toBe(false);
});
it('reproduces corrected UX p12 total 924 without extra bonus',()=>{
  const s=new GameplaySession(90,'s');
  // The illustration supplies an aggregate enemy subtotal, not a kill sequence.
  s.score.breakdown.enemy=276;
  for(let i=0;i<46;i++)s.pickup(`badge-${i}`);
  s.tick(71);expect(s.finish('goal')!.score).toBe(924);
});
it('floors remaining seconds strictly',()=>{
  const s=new GameplaySession(90,'s');s.tick(70.000000001);
  expect(s.finish('goal')!.scoreBreakdown.time).toBe(38);
});
it('gives Goal same-tick priority but rejects a later Goal and duplicate settlement',()=>{
  const s=new GameplaySession(1/24,'s');s.tick(1/24,true);
  const result=s.finish('goal')!;expect(result.endReason).toBe('goal');
  expect(s.finish('time-up')).toBe(result);
  const late=new GameplaySession(1/24,'s');late.tick(1/24);
  expect(late.finish('goal')!.endReason).toBe('time-up');
});
it('counts Respawn and render stalls independently of six physics catch-up steps',()=>{
  const s=new GameplaySession(90,'s'),f=new FixedStepController(24);let steps=0;
  f.update(2,(dt,elapsed)=>{expect(dt).toBe(1/24);steps++;s.tick(elapsed);});
  expect(steps).toBe(6);expect(s.run.remaining).toBeCloseTo(88);
  f.update(0,(_,elapsed)=>s.tick(elapsed));expect(s.run.remaining).toBeCloseTo(88);
  s.respawn('pit');s.tick(2);expect(s.run.remaining).toBeCloseTo(86);
  s.recovered();s.run.pause();s.tick(4);expect(s.run.remaining).toBeCloseTo(86);
});
it('GDD slide3 pit drops at most ten, preserves ledger and prevents no-drop bonus',()=>{
  const s=new GameplaySession(90,'s');for(let i=0;i<15;i++)s.pickup(String(i));s.credit('enemy','melee');
  const drops=s.respawn('pit');expect(drops&&drops.length).toBe(10);expect(s.badges.held).toBe(5);
  s.recovered();expect(s.credit('enemy','melee')).toBe(false);expect(s.damage.immuneUntil).toBe(1.5);
  expect(s.finish('goal')!.scoreBreakdown.noDrop).toBe(0);
});
