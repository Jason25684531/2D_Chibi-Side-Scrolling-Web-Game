import {test,expect} from '@playwright/test';
const T=32;
test('D4/D5: physical pickup, stomp, scatter/recovery, respawn credit, coexisting items, goal and replay',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(T=>{(window as any).__gameplay.body.reset(9.5*T,14.5*T);},T); // badge e8 (9,14)
  await page.waitForFunction(()=>(window as any).__gameplay.session.badges.held>=1);
  const stomp=()=>page.evaluate(()=>{const s=(window as any).__gameplay;const e=s.enemies.enemies.find((x:any)=>x.id==='e66');s.body.reset(e.x+e.w/2,e.y-34);s.body.setVelocity(0,160);});
  await stomp();await page.waitForFunction(()=>(window as any).__gameplay.enemies.enemies.find((x:any)=>x.id==='e66').defeated);
  // Editor pop(): the credited points float up from the enemy.
  expect(await page.evaluate(()=>(window as any).__gameplay.children.list.some((o:any)=>o.type==='Text'&&o.text==='+20'))).toBe(true);
  const score=await page.evaluate(()=>(window as any).__gameplay.session.score.total);expect(score).toBe(20);
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(300,500);s.takeDamage('fixture');});
  expect(await page.evaluate(()=>(window as any).__gameplay.session.badges.dropped)).toBe(true);
  await page.waitForTimeout(300);
  await page.evaluate(()=>{const s=(window as any).__gameplay;const o=[...s.badges.objects.entries()].find(([id]:any)=>id.startsWith('drop-'))?.[1] as any;if(o)s.body.reset(o.x,o.y);});
  await page.waitForFunction(()=>(window as any).__gameplay.session.badges.held>0);
  await page.evaluate(()=>{(window as any).__gameplay.respawn('pit');});await stomp();
  await page.waitForFunction(()=>(window as any).__gameplay.enemies.enemies.find((x:any)=>x.id==='e66').defeated);
  expect(await page.evaluate(()=>(window as any).__gameplay.session.score.total)).toBe(score);
  expect(await page.evaluate(()=>(window as any).__gameplay.session.combo.count)).toBe(0);
  await page.evaluate(T=>{(window as any).__gameplay.body.reset(41*T,16.5*T);},T); // laptop e79 (40,16)
  await page.waitForFunction(()=>(window as any).__gameplay.session.power.armed);
  await page.keyboard.press('KeyC');await page.waitForTimeout(100);expect(await page.evaluate(()=>(window as any).__gameplay.enemies.bolts.length+(window as any).__gameplay.session.power.throwReady)).toBeGreaterThan(0);
  await page.evaluate(T=>{(window as any).__gameplay.body.reset(59.5*T,13.5*T);},T); // ally e80 (59,13)
  await page.waitForFunction(()=>(window as any).__gameplay.session.power.ally);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return[s.session.power.armed,s.body.width,s.body.height];})).toEqual([true,24,64]);
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.session.power.allyUntil=s.run.elapsed+.08;});await page.waitForTimeout(180);
  expect(await page.evaluate(()=>(window as any).__gameplay.session.power.ally)).toBe(false);
  await page.evaluate(T=>{(window as any).__gameplay.body.reset(92*T,58*T);},T); // portal e2 (91,59)
  await page.waitForFunction(()=>(window as any).__gameplay.session.result?.endReason==='goal');
  const result=await page.evaluate(()=>(window as any).__gameplay.session.result);expect(result.scoreBreakdown.goal).toBe(50);expect(result.scoreBreakdown.noDrop).toBe(0);
  await page.waitForTimeout(150);expect(await page.evaluate(()=>(window as any).__gameplay.run.remaining)).toBe(result.remainingTime);
  await page.click('#replay');await page.waitForFunction(id=>(window as any).__gameplay.run.runId!==id,result.runId);
  expect(await page.evaluate(()=>(window as any).__gameplay.run.timeTier)).toBe('120');expect(await page.evaluate(()=>(window as any).__gameplay.session.score.total)).toBe(0);
  expect(errors).toEqual([]);
});
test('D5: time-up locks result and rejects late score/pickup/goal',async({page})=>{
 await page.goto('/?debug=1');await page.waitForFunction(()=>!!(window as any).__gameplay?.session);
 await page.evaluate(()=>{const s=(window as any).__gameplay;s.run.elapsed=s.run.duration-.08;});
 await page.waitForFunction(()=>(window as any).__gameplay.session.result?.endReason==='time-up');
 const r=await page.evaluate(()=>{const s=(window as any).__gameplay;s.session.credit('late');s.session.pickup('late');s.session.finish('goal');return s.session.result;});
 expect(r.remainingTime).toBe(0);expect(r.scoreBreakdown.goal).toBe(0);expect(r.scoreBreakdown.noDrop).toBe(0);
});
test('package character frames keep the 0.75x2 cell body for both characters',async({page})=>{
 await page.goto('/?debug=1');await page.waitForFunction(()=>!!(window as any).__gameplay?.presentation?.sprite);
 await page.selectOption('#character','b');await page.click('#start');await page.waitForTimeout(200);
 expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return{texture:s.presentation.sprite.texture.key,width:s.body.width,height:s.body.height,drawn:Math.round(s.presentation.sprite.displayHeight),enemy:s.enemies.enemies[0].sprite.texture.key};})).toEqual({texture:'chars/S2AM-1(待機微動).png',width:24,height:64,drawn:80,enemy:'monsters/眼魔 BEHOLDER_0.png'});
 expect(await page.evaluate(()=>(window as any).__gameplay.controller.constructor.name)).toBe('PlayerController');
});
