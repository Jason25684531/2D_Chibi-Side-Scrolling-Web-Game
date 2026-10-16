import {it,expect} from 'vitest';
import {InputAdapter} from '../../src/input/adapter';
import {escape,button,time} from '../../src/ui/components';
import {MockStation,titles} from '../../src/ui/mock-station';
import {GameplaySession} from '../../src/core/session';
it('escapes untrusted identity, supplies native disabled controls and formats timer',()=>{
  expect(escape('<script>"&')).toBe('&lt;script&gt;&quot;&amp;');
  expect(button('replay','再玩','REPLAY',true)).toContain('disabled');expect(time(90)).toBe('01:30');
});
it('ranks by tier, saves an attempt once and orders GDD titles by rarity',()=>{
  const a=new MockStation();a.enqueue('Player');const s=new GameplaySession(90,a.current.sessionId);
  s.tick(40);s.stats.maxCombo=5;s.stats.stomps=8;s.stats.bounces=4;
  for(let i=0;i<8;i++){s.paralyze(String(i));s.paralyze(String(i));}
  expect(s.stats.paralyses).toBe(8);
  for(let i=0;i<50;i++)s.pickup(String(i));
  const r=s.finish('goal')!;expect(titles(r)).toHaveLength(8);expect(titles(r).slice(0,3)).toEqual(['零失誤大師','極速跑者','連段高手']);
  a.save(r);a.save(r);expect(a.board(90)).toHaveLength(1);expect(a.board(60)).toHaveLength(0);expect(a.wall.size).toBe(1);
  a.enqueue('Next');a.exit();expect(a.current.nickname).toBe('Next');
});
it('adds Confirm and Back without changing Jump mapping',()=>{
  const input=new InputAdapter();input.codes.add('Enter');expect(input.sample().confirm).toBe(true);expect(input.sample().confirm).toBe(false);
  input.codes.clear();input.codes.add('Backspace');expect(input.sample().back).toBe(true);
  const pad=new InputAdapter();expect(pad.sample({axes:[],buttons:[{pressed:true}]}).confirm).toBe(true);
});
