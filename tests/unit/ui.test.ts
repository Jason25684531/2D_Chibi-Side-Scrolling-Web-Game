import {it,expect,vi} from 'vitest';
import {InputAdapter} from '../../src/input/adapter';
import {escape,button,time} from '../../src/ui/components';
import {MockStation,titles,validRanking,WALL_MAX} from '../../src/ui/mock-station';
import {GameplaySession} from '../../src/core/session';
it('escapes untrusted identity, supplies native disabled controls and formats timer',()=>{
  expect(escape('<script>"&')).toBe('&lt;script&gt;&quot;&amp;');
  expect(button('replay','再玩','REPLAY',true)).toContain('disabled');expect(time(100)).toBe('01:40');
  expect(escape("O'Neil")).toBe('O&#39;Neil');
  expect(button('exit','結束','EXIT')).toContain('class="btn "');expect(button('exit','結束','EXIT',false,'primary','exit')).toMatch(/class="btn primary".*<svg class="ic"/);
});
it('saves an attempt once and orders planning v0.3 titles by rarity',()=>{
  const a=new MockStation();a.enqueue('Player');expect(a.current).toMatchObject({characterId:'a',attackItem:'B_ALLY.png'});
  const s=new GameplaySession(100,a.current.sessionId);
  s.tick(40);s.stats.maxCombo=4;s.stats.stomps=5;s.stats.bolts=3;s.stats.bounces=4;
  for(let i=0;i<45;i++)s.pickup(String(i));
  const r=s.finish('goal')!;expect(titles(r)).toEqual(['零失誤大師','極速跑者','連段高手','閃電快手','踩擊達人','彈跳高手','徽章收藏家']);
  a.save(r);a.save(r);expect(a.board(100)).toHaveLength(1);expect(a.board(90)).toHaveLength(0);expect(a.wall.size).toBe(1);
  a.enqueue('Next');a.exit();expect(a.current.nickname).toBe('Next');
});
it('no earned title yields an empty list (shown as 超新星) and old records stay valid',()=>{
  const s=new GameplaySession(100,'s');s.tick(100);expect(titles(s.finish('time-up')!)).toEqual([]);
  expect(validRanking({runId:'old',nickname:'aria fan',score:1,tier:'90',titles:[],characterId:'aria'})).toBe(true);
  expect(validRanking({runId:'new',nickname:'PLYR0001',score:1,tier:'100',titles:[],characterId:'b'})).toBe(true);
});
it('maps planning keys Z X C ↓ and keeps Confirm/Back',()=>{
  const input=new InputAdapter();input.codes.add('Enter');expect(input.sample().confirm).toBe(true);expect(input.sample().confirm).toBe(false);
  input.codes.clear();input.codes.add('Backspace');expect(input.sample().back).toBe(true);
  for(const [code,action] of [['KeyZ','jump'],['KeyX','dash'],['KeyC','throw'],['ArrowDown','down']] as const){const k=new InputAdapter();k.codes.add(code);expect(k.sample()[action]).toBe(true);}
  const pad=new InputAdapter();expect(pad.sample({mapping:'standard',axes:[],buttons:[{pressed:false},{pressed:false},{pressed:false},{pressed:true}]}).confirm).toBe(true);
});
it('keeps the newest WALL_MAX players on the wall and lets the operator reset unreadable storage',()=>{
  const a=new MockStation(),run=(n:string)=>{a.enqueue(n);const s=new GameplaySession(100,a.current.sessionId);s.tick(100);a.save(s.finish('time-up')!);a.exit();};
  for(let i=0;i<=WALL_MAX;i++)run('P'+i);
  expect(a.wall.size).toBe(WALL_MAX);expect([...a.wall.values()].some(r=>r.nickname==='P0')).toBe(false);expect(a.records).toHaveLength(WALL_MAX+1);
  const store=new Map<string,string>([['rog-future-gamer.records.v1','{broken']]);
  vi.stubGlobal('window',{});vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)});
  try{
    const b=new MockStation();expect(b.storageStatus).toBe('error');
    b.clear();b.enqueue('After');const s=new GameplaySession(100,b.current.sessionId);s.tick(100);b.save(s.finish('time-up')!);
    expect(b.storageStatus).toBe('ready');expect(JSON.parse(store.get('rog-future-gamer.records.v1')!).records).toHaveLength(1);
  }finally{vi.unstubAllGlobals();}
});
