import json from './data/level.json';
import {TILE as T,TEST_PROFILE as P} from '../core/config';
export type EnemyKind='beholder'|'charger';
export type PowerKind='laptop'|'ally';
export type Terrain={id:string;kind:'ground'|'one-way'|'moving'|'bounce'|'slope'|'hazard';x:number;y:number;width:number;height:number;rise?:number;axis?:'x'|'y';range?:number;speed?:number;pause?:number;art?:string};
export type Spawn={id:string;x:number;y:number};
export type EnemySpawn=Spawn&{kind:EnemyKind;laser:boolean;range:number;float:boolean};
export type Segment={name:string;left:number;right:number;top:number;bottom:number;dir:'right'|'left'|'down'};
export type LevelData={width:number;height:number;pitY:number;start:{x:number;y:number};goal:Spawn&{width:number;height:number};
  terrain:Terrain[];badges:Spawn[];enemies:EnemySpawn[];powerups:(Spawn&{kind:PowerKind})[];hints:Spawn[];segments:Segment[];grid:string[];targets?:Record<string,number>};
type Entity={id:string;type:string;c:number;r:number;props?:Record<string,unknown>};
export type Fg3Level={format:string;version:number;cols:number;rows:number;terrain:string[];entities:Entity[];segments:{name:string;start:number;end:number;top:number;bottom:number;dir:string}[];targets?:Record<string,number>};

/** Runs of `ch` per row: [c0,c1) half-open. */
function runs(row:string,ch:string){const out:[number,number][]=[];for(let c=0;c<row.length;){if(row[c]!==ch){c++;continue;}let e=c;while(row[e]===ch)e++;out.push([c,e]);c=e;}return out;}
const box=(id:string,kind:Terrain['kind'],c:number,r:number,w:number,h:number):Terrain=>({id,kind,x:(c+w/2)*T,y:(r+h/2)*T,width:w*T,height:h*T});

/** Planning editor `fg3-level` v1 JSON -> runtime LevelData (cells x TILE). Entity `r` is the bottom (feet) row. */
export function loadLevel(level:Fg3Level):LevelData{
  if(level.format!=='fg3-level'||level.version!==1)throw new Error(`Unsupported level format ${level.format} v${level.version}`);
  const g=level.terrain,terrain:Terrain[]=[];
  // '#': maximal row runs, merged down while the run below is identical (no shared-top seams).
  let open=new Map<string,{c:number;r:number;w:number;h:number}>();
  const close=(o:{c:number;r:number;w:number;h:number})=>terrain.push(box(`ground-${o.c}-${o.r}`,'ground',o.c,o.r,o.w,o.h));
  g.forEach((row,r)=>{const next=new Map<string,{c:number;r:number;w:number;h:number}>();
    for(const [c0,c1] of runs(row,'#')){const k=`${c0},${c1}`,o=open.get(k);if(o){o.h++;open.delete(k);next.set(k,o);}else next.set(k,{c:c0,r,w:c1-c0,h:1});}
    open.forEach(close);open=next;});
  open.forEach(close);
  g.forEach((row,r)=>{
    for(const [c0,c1] of runs(row,'='))terrain.push({...box(`oneway-${c0}-${r}`,'one-way',c0,r,c1-c0,.5)});
    for(const [c0,c1] of runs(row,'x'))terrain.push(box(`hazard-${c0}-${r}`,'hazard',c0,r,c1-c0,1));
    [...row].forEach((ch,c)=>{
      // Diagonal chains of '/' (up-right) or '\' (down-right) become one slope.
      if(ch==='/'&&g[r+1]?.[c-1]!=='/'){let n=1;while(g[r-n]?.[c+n]==='/')n++;terrain.push({...box(`slope-${c}-${r}`,'slope',c,r-n+1,n,n),rise:n*T});}
      if(ch==='\\'&&g[r-1]?.[c-1]!=='\\'){let n=1;while(g[r+n]?.[c+n]==='\\')n++;terrain.push({...box(`slope-${c}-${r}`,'slope',c,r,n,n),rise:-n*T});}
    });
  });
  const of=(type:string)=>level.entities.filter(e=>e.type===type);
  const center=(e:Entity)=>({id:e.id,x:(e.c+.5)*T,y:(e.r+.5)*T});
  for(const e of of('spring'))terrain.push({...box(e.id,'bounce',e.c,e.r+.5,1,.5)});
  for(const e of of('mover')){const p=e.props??{};terrain.push({...box(e.id,'moving',e.c,e.r,3,.32),axis:p.axis==='y'?'y':'x',range:Number(p.range??4)*T,speed:Number(p.speed??2)*T,pause:Number(p.pause??0),art:String(p.art??'')});}
  const start=of('start')[0],goal=of('goal')[0];
  if(!start||!goal)throw new Error('Level needs one start and one goal');
  return {width:level.cols*T,height:level.rows*T,pitY:(level.rows+2)*T,grid:g,targets:level.targets,
    start:{x:(start.c+.5)*T,y:(start.r+1)*T-P.bodyHeight/2},
    goal:{id:goal.id,x:(goal.c+1)*T,y:(goal.r-.5)*T,width:2*T,height:3*T},terrain,
    badges:of('badge').map(center),hints:of('hint').map(center),
    enemies:[...of('beholder'),...of('charger')].map(e=>({id:e.id,kind:e.type as EnemyKind,x:(e.c+.5)*T,y:(e.r+1)*T,laser:e.type==='beholder'&&e.props?.laser!==false,range:Number(e.props?.range??8)*T,float:!!e.props?.float})),
    powerups:[...of('laptop'),...of('ally')].map(e=>({id:e.id,kind:e.type as PowerKind,x:(e.c+(e.type==='laptop'?1:.5))*T,y:(e.r+.5)*T})),
    segments:level.segments.map(s=>({name:s.name,left:s.start*T,right:s.end*T,top:s.top*T,bottom:s.bottom*T,dir:s.dir==='left'||s.dir==='down'?s.dir:'right'}))};
}

/** Keep only cells/entities inside [c0,c1] x [r0,r1]; the goal moves onto the ground at the right edge. */
export function sliceLevel(level:Fg3Level,[c0,c1]:[number,number],[r0,r1]:[number,number]):Fg3Level{
  const inside=(c:number,r:number)=>c>=c0&&c<=c1&&r>=r0&&r<=r1;
  const terrain=level.terrain.map((row,r)=>[...row].map((ch,c)=>inside(c,r)?ch:'.').join(''));
  const floor=terrain.findIndex((row,r)=>r>=r0&&row[c1]==='#');
  const goal={id:'tutorial-goal',type:'goal',c:c1-1,r:floor-1};
  return {...level,terrain,targets:undefined,segments:level.segments.filter(s=>s.start<=c1&&s.top<=r1),
    entities:[...level.entities.filter(e=>e.type!=='goal'&&inside(e.c,e.r)),goal]};
}

export const LEVEL=loadLevel(json as Fg3Level);
// P3 sandbox = the "框1 AIO・練習" practice segment of the real level (planning v0.3 §4).
export const TUTORIAL_CLIP={cols:40,rows:23};
export const TUTORIAL_LEVEL=loadLevel(sliceLevel(json as Fg3Level,[0,TUTORIAL_CLIP.cols],[0,TUTORIAL_CLIP.rows]));

export function validateLevel(level:LevelData) {
  const items=[...level.terrain,...level.badges,...level.enemies,...level.powerups,level.goal];
  if(!Number.isFinite(level.width)||!Number.isFinite(level.height)||level.width<=0||level.height<=0)throw new Error('Invalid bounds');
  if(new Set(items.map(i=>i.id)).size!==items.length)throw new Error('Duplicate level ID');
  for(const item of [...items,level.start])if(!Number.isFinite(item.x)||!Number.isFinite(item.y)||item.x<0||item.x>level.width||item.y<0||item.y>level.height)throw new Error('Out of bounds spawn');
  if(level.terrain.some(t=>!Number.isFinite(t.width)||!Number.isFinite(t.height)||t.width<=0||t.height<=0))throw new Error('Invalid terrain dimensions');
  if(level.terrain.some(t=>t.kind==='slope'&&(!Number.isFinite(t.rise??t.height)||Math.abs(t.rise??t.height)>t.height)))throw new Error('Invalid slope rise');
  const feet=level.start.y+P.bodyHeight/2;
  if(!level.terrain.some(t=>t.kind==='ground'&&Math.abs(feet-(t.y-t.height/2))<2&&level.start.x>t.x-t.width/2+P.bodyWidth/2&&level.start.x<t.x+t.width/2-P.bodyWidth/2))throw new Error('Unsafe start');
  const actual:Record<string,number>={badge:level.badges.length,enemy:level.enemies.length,laptop:level.powerups.filter(p=>p.kind==='laptop').length,ally:level.powerups.filter(p=>p.kind==='ally').length,spring:level.terrain.filter(t=>t.kind==='bounce').length};
  for(const [k,v] of Object.entries(level.targets??{}))if(actual[k]!==v)throw new Error(`targets.${k} expected ${v}, got ${actual[k]}`);
}
