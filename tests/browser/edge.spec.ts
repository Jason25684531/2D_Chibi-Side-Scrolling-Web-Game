import {test,expect} from '@playwright/test';
test('variable jump, spring bounce and zero-badge safe recovery',async({page})=>{
 await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
 async function jump(hold:number){await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(80,512);s.controller.reset();s.inputAdapter.clear();});await page.waitForTimeout(80);let peak=512;await page.keyboard.down('KeyZ');for(let t=0;t<600;t+=40){if(t===hold)await page.keyboard.up('KeyZ');await page.waitForTimeout(40);peak=Math.min(peak,await page.evaluate(()=>(window as any).__gameplay.player.y));}await page.keyboard.up('KeyZ');return peak;}
 const short=await jump(40),long=await jump(560);expect(long).toBeLessThan(short-20);
 // Spring e83 (80,40): 12-cell bounce (v = 960).
 await page.evaluate(()=>{const s=(window as any).__gameplay;const e=s.terrain.entries.find((t:any)=>t.data.id==='e83');s.body.reset(e.data.x,e.data.y-e.data.height/2-60);s.controller.reset();s.body.setVelocityY(200);});await page.waitForTimeout(300);
 const bounce=await page.evaluate(()=>{const s=(window as any).__gameplay;return{vy:s.body.velocity.y,bounces:s.session.stats.bounces,bouncedAt:s.terrain.entries.find((t:any)=>t.data.id==='e83').bouncedAt};});
 expect(bounce.vy,JSON.stringify(bounce)).toBeLessThan(-300);expect(bounce.bounces).toBe(1);
 await page.evaluate(()=>{const s=(window as any).__gameplay;s.session.badges.held=0;s.session.damage.immuneUntil=0;s.body.reset(1000,980);s.takeDamage('zero-badge-fixture');});
 expect(await page.evaluate(()=>(window as any).__gameplay.session.result)).toBeNull();expect(await page.evaluate(()=>(window as any).__gameplay.session.stats.respawns)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>(window as any).__gameplay.terrain.supports((window as any).__gameplay.player.x,(window as any).__gameplay.body.bottom,24))).toBe(true);
});
test('attack item modes: C hits one, B pierces two, A bursts; side contact hurts; Ally keeps the body size',async({page})=>{
 await page.goto('/?debug=1');await page.waitForFunction(()=>!!(window as any).__gameplay?.enemies);
 const kills=await page.evaluate(()=>{
   const s=(window as any).__gameplay,E=s.enemies,T=32,out:Record<string,{kills:number;burst:boolean}>={};s.togglePause();
   for(const src of ['C_ROG Chakram X Origin.png','B_ALLY.png','A_ROG CROSSHAIR X870E DARK HERO.png']){
     E.reset();for(const e of E.enemies)Object.assign(e,{x:-999,y:-999});
     E.enemies.slice(0,3).forEach((e:any,i:number)=>Object.assign(e,{x:400+i*30,y:17*T-e.h,state:'rest',t:99}));
     s.body.reset(300,17*T-32);E.throwItem(src,300,17*T,1);let burst=false;
     for(let i=0;i<40;i++){E.update(1/24);burst||=E.bursts.length>0;}
     out[src[0]]={kills:E.enemies.filter((e:any)=>e.defeated).length,burst};
   }
   E.reset();return out;
 });
 expect(kills).toEqual({C:{kills:1,burst:false},B:{kills:2,burst:false},A:{kills:2,burst:true}});
 // Thrown through the keyboard: C (planning key) with the selected item; cooldown from the mode.
 await page.evaluate(()=>{const s=(window as any).__gameplay;s.togglePause();s.session.activate('laptop','fixture');});
 await page.keyboard.press('KeyC');await page.waitForFunction(()=>(window as any).__gameplay.enemies.bolts.length>0||(window as any).__gameplay.session.power.throwReady>0);
 await page.evaluate(()=>{const s=(window as any).__gameplay;const e=s.enemies.enemies.find((x:any)=>x.id==='e76');s.session.pickup('fixture-badge');s.session.damage.immuneUntil=0;s.body.reset(e.x+e.w/2,e.y+e.h-32);});await page.waitForTimeout(150);
 expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return{damage:s.session.stats.damage,armed:s.session.power.armed};})).toEqual({damage:1,armed:false});
 await page.evaluate(()=>{const s=(window as any).__gameplay;s.session.activate('ally','fixture');});await page.waitForTimeout(100);
 expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return[s.body.width,s.body.height,s.session.power.ally];})).toEqual([24,64,true]);
});
