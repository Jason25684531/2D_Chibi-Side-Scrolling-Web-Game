import { describe,it,expect } from 'vitest';
import { GameplayStateMachine,RunStateManager } from '../../src/core/state';
import { FixedStepController } from '../../src/core/fixed-step';
import { InputAdapter } from '../../src/input/adapter';
import { GameplayEventBus } from '../../src/core/events';
describe('Run and input foundation',()=>{
  it('does not repeat held gamepad Start after clearing pending input',()=>{const input=new InputAdapter();const pad={axes:[0],buttons:Array.from({length:10},(_,i)=>({pressed:i===9}))};expect(input.sample(pad).pause).toBe(true);input.clear();expect(input.sample(pad).pause).toBe(false);pad.buttons[9].pressed=false;input.sample(pad);pad.buttons[9].pressed=true;expect(input.sample(pad).pause).toBe(true);});
  it('validates flow and enters P4',()=>{const f=new GameplayStateMachine();expect(()=>f.transition('P6')).toThrow();f.enterGameplay();expect(f.flow).toBe('P4');});
  it('freezes pause and preserves ledger on respawn, clears replay',()=>{const r=new RunStateManager(60,'s');r.start();r.step(1);r.scoredEnemyIds.add('e');r.pause();r.step(5);expect(r.remaining).toBe(59);r.resume();r.respawn();r.recovered();expect(r.scoredEnemyIds.has('e')).toBe(true);const n=new RunStateManager(r.duration,r.sessionId);n.start();expect(n.runId).not.toBe(r.runId);expect(n.scoredEnemyIds.size).toBe(0);expect(n.timeTier).toBe('60');});
  it('retains fixed-step backlog and rejects invalid delta',()=>{const f=new FixedStepController(24);let count=0;f.update(.5,()=>count++);expect(count).toBe(6);f.update(0,()=>count++);expect(count).toBe(12);expect(()=>f.update(-1,()=>{})).toThrow();});
  it('maps keyboard and gamepad to identical actions and edges once',()=>{const k=new InputAdapter();k.codes.add('Space');k.codes.add('ArrowRight');const p=new InputAdapter();const pad={axes:[1],buttons:[{pressed:false},{pressed:true}]};expect(k.sample()).toEqual(p.sample(pad));expect(p.sample(pad).jump).toBe(false);k.codes.add('KeyA');expect(k.sample().move).toBe(0);});
  it('rejects duplicate and stale run events',()=>{const b=new GameplayEventBus('a');let hits=0;b.on('ENEMY_DEFEATED',()=>hits++);const e={kind:'ENEMY_DEFEATED' as const,runId:'a',eventId:'x',tick:1,entityId:'e',cause:'stomp'};b.publish(e);b.publish(e);b.publish({...e,eventId:'y',runId:'b'});expect(hits).toBe(1);b.dispose();expect(b.listenerCount('ENEMY_DEFEATED')).toBe(0);});
});
