export type EnemyKind='melee'|'ranged'|'drone';
export type PowerKind='laptop'|'ally';
export type Terrain={id:string;kind:'ground'|'platform'|'one-way'|'moving'|'bounce'|'slope';x:number;y:number;width:number;height:number;travel?:number;travelY?:number;rise?:number};
export type Spawn={id:string;x:number;y:number};
export type LevelData={width:number;height:number;pitY:number;start:{x:number;y:number};goal:Spawn;terrain:Terrain[];badges:Spawn[];enemies:(Spawn&{kind:EnemyKind})[];powerups:(Spawn&{kind:PowerKind})[]};
export const LEVEL:LevelData={width:4000,height:1100,pitY:1000,start:{x:120,y:776},goal:{id:'goal',x:3900,y:740},
  terrain:[
    {id:'start-ground',kind:'ground',x:475,y:830,width:950,height:60},
    {id:'slope-up',kind:'slope',x:250,y:775,width:100,height:50,rise:50},
    {id:'slope-down',kind:'slope',x:350,y:775,width:100,height:50,rise:-50},
    {id:'middle-ground',kind:'ground',x:1825,y:830,width:1350,height:60},
    {id:'end-ground',kind:'ground',x:3400,y:830,width:1200,height:60},
    {id:'jump-platform',kind:'one-way',x:570,y:735,width:140,height:20},
    {id:'double-platform',kind:'platform',x:780,y:590,width:150,height:20},
    {id:'moving-platform',kind:'moving',x:1040,y:740,width:150,height:20,travel:60},
    {id:'bounce-landing',kind:'one-way',x:2675,y:660,width:120,height:20},
    ...[870,1230,2250,2480,3100,3500].map((x,i)=>({id:`bounce-${i}`,kind:'bounce' as const,x,y:790,width:50,height:20}))
  ],
  badges:Array.from({length:60},(_,i)=>{let x=180+i*60;if(x>940&&x<1160)x=1200+(i-13)*20;if(x>2490&&x<2810)x=2840+(i-39)*20;return{id:`badge-${i}`,x,y:765};}),
  enemies:Array.from({length:14},(_,i)=>({id:`enemy-${i}`,x:1440+i*160>=2500&&1440+i*160<2800?2820+(i-7)*70:1440+i*160,y:i%3===2?660:778,kind:(['melee','ranged','drone'] as const)[i%3]})),
  powerups:[400,1300,1800,2200,2900,3300,3600].map((x,i)=>({id:`power-${i}`,x,y:770,kind:i%2===0?'laptop':'ally'}))
};
export const TUTORIAL_LEVEL:LevelData={...LEVEL,width:1600,goal:{id:'tutorial-goal',x:1550,y:740},
  terrain:[...LEVEL.terrain.filter(t=>['start-ground','jump-platform','double-platform','moving-platform'].includes(t.id)),{id:'tutorial-ground',kind:'ground',x:1375,y:830,width:450,height:60}],
  enemies:[{id:'tutorial-enemy',kind:'melee',x:650,y:778}],badges:LEVEL.badges.slice(0,8),powerups:[LEVEL.powerups[0]]};
export function validateLevel(level:LevelData) {
  const items=[...level.terrain,...level.badges,...level.enemies,...level.powerups,level.goal];
  if(!Number.isFinite(level.width)||!Number.isFinite(level.height)||level.width<=0||level.height<=0)throw new Error('Invalid bounds');
  if(new Set(items.map(i=>i.id)).size!==items.length)throw new Error('Duplicate level ID');
  for(const item of [...items,level.start])if(!Number.isFinite(item.x)||!Number.isFinite(item.y)||item.x<0||item.x>level.width||item.y<0||item.y>level.height)throw new Error('Out of bounds spawn');
  if(level.terrain.some(t=>!Number.isFinite(t.width)||!Number.isFinite(t.height)||t.width<=0||t.height<=0))throw new Error('Invalid terrain dimensions');
  if(level.terrain.some(t=>t.kind==='slope'&&(!Number.isFinite(t.rise??t.height)||Math.abs(t.rise??t.height)>t.height)))throw new Error('Invalid slope rise');
  if(!level.terrain.some(t=>t.kind==='ground'&&Math.abs(level.start.y+24-(t.y-t.height/2))<2&&level.start.x>t.x-t.width/2+16&&level.start.x<t.x+t.width/2-16))throw new Error('Unsafe start');
}
