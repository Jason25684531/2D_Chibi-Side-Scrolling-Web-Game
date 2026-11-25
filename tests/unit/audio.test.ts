import {existsSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {SFX,loadSfx,listen} from '../../src/audio/sfx';
import {GameplayEventBus,type EventKind} from '../../src/core/events';

test('every sheet ID (音效清單, 39 rows) points at a file in /Audio',()=>{
  expect(Object.keys(SFX)).toHaveLength(39);
  for(const [id,[file]] of Object.entries(SFX))expect(existsSync('Audio/'+file),`${id} → ${file}`).toBe(true);
});

const played=(kind:EventKind)=>{
  const play=vi.fn(),sound={play,game:{cache:{audio:{exists:()=>true,get:()=>({duration:3.25})}}}};
  loadSfx({sound,load:{audio:()=>{}}} as never);
  const bus=new GameplayEventBus('r');listen(bus);
  bus.publish({kind,runId:'r',eventId:'e',tick:0,entityId:'player',cause:kind});
  return play.mock.calls.map(([id,o])=>[id,+o.delay.toFixed(2)]);
};
test('time up plays the whistle, the announcer and the jingle',()=>{
  expect(played('TIME_UP')).toEqual([['SYS-04',0],['ANN-04',.4],['SYS-03',.4]]);
});
test('goal plays the portal first, then the jingle and the announcer after it ends',()=>{
  expect(played('GOAL_REACHED')).toEqual([['ENV-03',0],['SYS-03',3.25],['ANN-03',4.05]]);
});
