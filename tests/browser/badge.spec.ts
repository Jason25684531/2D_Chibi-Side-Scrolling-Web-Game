import {test,expect} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const assets=JSON.parse(readFileSync('src/level/data/assets.json','utf8'));
const level=JSON.parse(readFileSync('src/level/data/level.json','utf8'));
const key='items/'+level.itemArt.badge.art,source='1102_關卡編輯器/CYBER_RUN_1101_可直接開啟/game/'+key;
test('package badge art, cap twelve, moving drops, recovery and expiry',async({page})=>{
  if(existsSync(source))expect(createHash('sha256').update(readFileSync(source)).digest('hex')).toBe(assets[key].sha256);
  expect(existsSync('public'+assets[key].url)).toBe(true);
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const start=await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(300,300);s.body.setAllowGravity(false);for(let i=0;i<15;i++)s.session.pickup('test-'+i);s.takeDamage('fixture');return{held:s.session.badges.held,count:s.badges.drops.size,texture:[...s.badges.objects.values()][0].texture.key,y:[...s.badges.objects.entries()].find(([id]:any)=>id.startsWith('drop-'))[1].y};});
  expect(start).toMatchObject({held:3,count:12,texture:key});
  await page.waitForTimeout(130);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return [...s.badges.objects.entries()].find(([id]:any)=>id.startsWith('drop-'))[1].y;})).not.toBe(start.y);
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(1500,100);});
  await page.waitForTimeout(5100);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return{s:s.session.badges.scattered.size,d:s.badges.drops.size,score:s.session.score.total};})).toEqual({s:0,d:0,score:0});
});
