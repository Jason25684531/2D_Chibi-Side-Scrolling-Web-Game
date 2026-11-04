import {it,expect} from 'vitest';
import {LEVEL,TUTORIAL_LEVEL,loadLevel,sliceLevel,validateLevel,type Fg3Level} from '../../src/level/data';
import {deriveProfile,TEST_PROFILE as P} from '../../src/core/config';
import json from '../../src/level/data/level.json';
const tiny=(terrain:string[],entities:Fg3Level['entities']=[]):Fg3Level=>({format:'fg3-level',version:1,cols:terrain[0].length,rows:terrain.length,terrain,segments:[],
  entities:[{id:'s',type:'start',c:0,r:terrain.length-2},{id:'g',type:'goal',c:terrain[0].length-2,r:terrain.length-2},...entities]});

it('loads the 1102 level with planning capacity, bounds and anchors',()=>{
  expect(()=>validateLevel(LEVEL)).not.toThrow();
  expect([LEVEL.width,LEVEL.height]).toEqual([3200,2176]);
  expect(LEVEL.start).toEqual({x:80,y:17*32-32});
  expect(LEVEL.goal).toMatchObject({x:92*32,y:58.5*32,width:64,height:96});
  expect(LEVEL.badges).toHaveLength(60);
  expect(LEVEL.enemies.filter(e=>e.kind==='beholder')).toHaveLength(11);expect(LEVEL.enemies.filter(e=>e.kind==='charger')).toHaveLength(3);
  expect(LEVEL.enemies.filter(e=>e.laser)).toHaveLength(9);
  expect(LEVEL.powerups.filter(p=>p.kind==='laptop')).toHaveLength(4);expect(LEVEL.powerups.filter(p=>p.kind==='ally')).toHaveLength(3);
  expect(LEVEL.terrain.filter(t=>t.kind==='bounce')).toHaveLength(6);expect(LEVEL.terrain.filter(t=>t.kind==='moving')).toHaveLength(6);
  expect(LEVEL.segments.map(s=>s.name)[0]).toBe('框1 AIO・練習');
  expect(loadLevel(json as Fg3Level).terrain.map(t=>t.id)).toEqual(LEVEL.terrain.map(t=>t.id));
});
it('merges solid blocks greedily and converts a mixed row',()=>{
  const level=loadLevel(tiny(['......','.###..','.###..','######']));
  expect(level.terrain.filter(t=>t.kind==='ground').map(t=>[t.id,t.width,t.height])).toEqual([['ground-1-1',96,64],['ground-0-3',192,32]]);
  const mixed=loadLevel(tiny(['.................','##..==../##\\..xxx','#################'])).terrain;
  expect(mixed.filter(t=>t.kind==='ground').length).toBe(3);
  expect(mixed.filter(t=>t.kind==='one-way').map(t=>t.width)).toEqual([64]);
  expect(mixed.filter(t=>t.kind==='slope').map(t=>t.rise)).toEqual([32,-32]);
  expect(mixed.filter(t=>t.kind==='hazard').map(t=>t.width)).toEqual([96]);
});
it('chains diagonal slope characters into one slope',()=>{
  const slopes=loadLevel(tiny(['...../.....','..../#.....','.../##.....','###########'])).terrain.filter(t=>t.kind==='slope');
  expect(slopes).toEqual([{id:'slope-3-2',kind:'slope',x:4.5*32,y:1.5*32,width:96,height:96,rise:96}]);
});
it('rejects unknown formats and target mismatches with explicit messages',()=>{
  expect(()=>loadLevel({...(json as Fg3Level),version:2})).toThrow('Unsupported level format fg3-level v2');
  const bad=structuredClone(LEVEL);bad.badges.pop();expect(()=>validateLevel(bad)).toThrow('targets.badge expected 60, got 59');
  const dup=structuredClone(LEVEL);dup.badges[1].id=dup.badges[0].id;expect(()=>validateLevel(dup)).toThrow('Duplicate');
  expect(()=>validateLevel({...LEVEL,start:{x:1000,y:776}})).toThrow('Unsafe');
});
it('slices the practice segment as the tutorial with a reachable goal',()=>{
  expect(()=>validateLevel(TUTORIAL_LEVEL)).not.toThrow();
  const items=[...TUTORIAL_LEVEL.badges,...TUTORIAL_LEVEL.enemies,...TUTORIAL_LEVEL.powerups];
  expect(items.every(i=>i.x<=41*32&&i.y<=24*32)).toBe(true);
  expect(TUTORIAL_LEVEL.start).toEqual(LEVEL.start);
  expect(TUTORIAL_LEVEL.goal).toMatchObject({x:40*32,y:15.5*32});
  expect(sliceLevel(json as Fg3Level,[0,40],[0,23]).entities.filter(e=>e.type==='goal')).toHaveLength(1);
});
it('derives the runtime profile from level physics (v = sqrt(2gh))',()=>{
  const p=deriveProfile({run:8,jump:3.5,djump:2.5,gravity:2400,dashMult:1.8,dashTime:.3,springH:12});
  expect(p.speed).toBe(256);expect(p.gravity).toBe(1200);expect(p.bounceSpeed).toBe(960);expect(p.dashDuration).toBe(.3);
  expect(p.jumpSpeed).toBeCloseTo(518.46,1);expect(p.doubleJumpSpeed).toBeCloseTo(438.18,1);expect(p.dashSpeed).toBeCloseTo(460.8,1);
  expect(p.terminalSpeed).toBe(800);expect([P.bodyWidth,P.bodyHeight,P.timeTier]).toEqual([24,64,120]);
});
