import {it,expect} from 'vitest';
import {GameplaySession} from '../../src/core/session';
import {FixedStepController} from '../../src/core/fixed-step';

it('planning v0.3 Combo: 20 x [1,1.5,2,2.5] for every kill kind, Ally included',()=>{
  const s=new GameplaySession(100,'s');
  const points=[20,30,40,50,50];
  (['stomp','bolt','ally','stomp','bolt'] as const).forEach((how,i)=>{const before=s.score.total;s.credit(`${i}`,how);expect(s.score.total-before).toBe(points[i]);});
  expect(s.combo.count).toBe(5);expect(s.stats).toMatchObject({kills:5,stomps:2,bolts:2,maxCombo:5});
  s.respawn('pit');s.recovered();expect(s.credit('2','ally')).toBe(false);
});
it('planning v0.3 worked example: 5-kill Combo, 25 badges, 37.2 s left, no drop',()=>{
  const s=new GameplaySession(100,'s');
  for(let i=0;i<5;i++)s.credit(`e${i}`);
  for(let i=0;i<25;i++)s.pickup(`badge-${i}`);
  s.tick(62.8);const r=s.finish('goal')!;
  // enemy 20*(1+1.5+2+2.5+2.5)=190, badges 25*10, goal 50, time ceil(37.2)*2=76, no-drop 100
  expect(r.scoreBreakdown).toEqual({enemy:190,badges:250,goal:50,time:76,noDrop:100});expect(r.score).toBe(666);
});
it('rounds remaining seconds up (planning v0.3), whole seconds unchanged',()=>{
  const at=(elapsed:number)=>{const s=new GameplaySession(100,'s');s.tick(elapsed);return s.finish('goal')!.scoreBreakdown.time;};
  expect(at(70)).toBe(60);expect(at(70.000000001)).toBe(60);expect(at(70.5)).toBe(60);expect(at(69.5)).toBe(62);
});
it('gives Goal same-tick priority but rejects a later Goal and duplicate settlement',()=>{
  const s=new GameplaySession(1/24,'s');s.tick(1/24,true);
  const result=s.finish('goal')!;expect(result.endReason).toBe('goal');
  expect(s.finish('time-up')).toBe(result);
  const late=new GameplaySession(1/24,'s');late.tick(1/24);
  expect(late.finish('goal')!.endReason).toBe('time-up');
});
it('counts Respawn and render stalls independently of six physics catch-up steps',()=>{
  const s=new GameplaySession(100,'s'),f=new FixedStepController(24);let steps=0;
  f.update(2,(dt,elapsed)=>{expect(dt).toBe(1/24);steps++;s.tick(elapsed);});
  expect(steps).toBe(6);expect(s.run.remaining).toBeCloseTo(98);
  f.update(0,(_,elapsed)=>s.tick(elapsed));expect(s.run.remaining).toBeCloseTo(98);
  s.respawn('pit');s.tick(2);expect(s.run.remaining).toBeCloseTo(96);
  s.recovered();s.run.pause();s.tick(4);expect(s.run.remaining).toBeCloseTo(96);
});
it('pit drops at most twelve, preserves ledger and prevents no-drop bonus',()=>{
  const s=new GameplaySession(100,'s');for(let i=0;i<15;i++)s.pickup(String(i));s.credit('enemy');
  const drops=s.respawn('pit');expect(drops&&drops.length).toBe(12);expect(s.badges.held).toBe(3);
  s.recovered();expect(s.credit('enemy')).toBe(false);expect(s.damage.immuneUntil).toBe(1.5);
  expect(s.finish('goal')!.scoreBreakdown.noDrop).toBe(0);
});
