import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync('assets/badge-manifest.json','utf8'));
test('authentic single PNG, cap ten, moving drops, recovery and expiry',async({page})=>{
  expect(createHash('sha256').update(readFileSync(manifest.source)).digest('hex')).toBe(manifest.sha256);
  expect(createHash('sha256').update(readFileSync('public'+manifest.runtimeUrl)).digest('hex')).toBe(manifest.sha256);
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const start=await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(600,500);s.body.setAllowGravity(false);for(let i=0;i<15;i++)s.session.pickup('test-'+i);s.takeDamage('fixture');return{held:s.session.badges.held,count:s.badges.drops.size,texture:[...s.badges.objects.values()][0].texture.key,y:[...s.badges.objects.entries()].find(([id]:any)=>id.startsWith('drop-'))[1].y};});
  expect(start).toMatchObject({held:5,count:10,texture:'badge'});
  await page.waitForTimeout(130);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return [...s.badges.objects.entries()].find(([id]:any)=>id.startsWith('drop-'))[1].y;})).not.toBe(start.y);
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(120,200);});
  await page.waitForTimeout(5100);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return{s:s.session.badges.scattered.size,d:s.badges.drops.size,score:s.session.score.total};})).toEqual({s:0,d:0,score:0});
});
