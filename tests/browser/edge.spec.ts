import {test,expect} from '@playwright/test';
test('variable jump, one-way underside/top, bounce and zero-badge safe recovery',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
 async function jump(hold:number){await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(120,776);s.controller.reset();s.inputAdapter.clear();});let peak=776;await page.keyboard.down('Space');for(let t=0;t<600;t+=40){if(t===hold)await page.keyboard.up('Space');await page.waitForTimeout(40);peak=Math.min(peak,await page.evaluate(()=>(window as any).__gameplay.player.y));}await page.keyboard.up('Space');return peak;}
 const short=await jump(40),long=await jump(560);expect(long).toBeLessThan(short-20);
 await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(570,776);s.controller.reset();});await page.keyboard.down('Space');await page.waitForTimeout(650);await page.keyboard.up('Space');
 expect(await page.evaluate(()=>(window as any).__gameplay.body.bottom)).toBeCloseTo(725,0);
 await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(885,730);s.controller.reset();s.body.setVelocityY(200);});await page.waitForTimeout(300);
 const bounce=await page.evaluate(()=>{const s=(window as any).__gameplay;return{y:s.player.y,vy:s.body.velocity.y,state:s.controller.state,now:s.run.elapsed,ready:s.terrain.bounceReady,ground:s.body.blocked.down,controller:{...s.controller,body:null}};});
 expect(bounce.vy,JSON.stringify(bounce)).toBeLessThan(-300);
 await page.evaluate(()=>{const s=(window as any).__gameplay;s.session.badges.held=0;s.session.damage.immuneUntil=0;s.body.reset(1000,980);s.takeDamage('zero-badge-fixture');});
 expect(await page.evaluate(()=>(window as any).__gameplay.session.result)).toBeNull();expect(await page.evaluate(()=>(window as any).__gameplay.session.stats.respawns)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>(window as any).__gameplay.terrain.supports((window as any).__gameplay.player.x,(window as any).__gameplay.body.bottom,32))).toBe(true);
});
test('Laptop paralysis, enemy side damage, Ally headroom and cleanup',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).__gameplay?.enemies);
 await page.evaluate(()=>{const s=(window as any).__gameplay;const e=s.enemies.enemies[0];s.body.reset(e.object.x-110,776);s.session.activate('laptop','fixture');});
 await page.keyboard.press('KeyJ');await page.waitForFunction(()=>(window as any).__gameplay.enemies.enemies[0].stunnedUntil>0);
 await page.evaluate(()=>{const s=(window as any).__gameplay;const e=s.enemies.enemies[0];e.stunnedUntil=0;s.session.power.clear();s.session.pickup('fixture-badge');s.body.reset(e.object.x,e.object.y);});await page.waitForTimeout(100);
 expect(await page.evaluate(()=>(window as any).__gameplay.session.stats.damage)).toBeGreaterThan(0);
 await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(320,776);s.controller.reset();const roof=s.add.rectangle(320,735,100,10,0xffffff);s.physics.add.existing(roof,true);s.terrain.entries.push({data:{id:'roof',kind:'platform',width:100,height:10},object:roof});s.session.activate('ally','fixture');});await page.waitForTimeout(100);
 expect(await page.evaluate(()=>(window as any).__gameplay.sizeBlocked)).toBe(true);expect(await page.evaluate(()=>(window as any).__gameplay.sizeScale)).toBe(1);
 await page.evaluate(()=>{const s=(window as any).__gameplay;s.session.activate('laptop','replacement');});await page.waitForTimeout(100);
 expect(await page.evaluate(()=>(window as any).__gameplay.sizeScale)).toBe(1);
});

