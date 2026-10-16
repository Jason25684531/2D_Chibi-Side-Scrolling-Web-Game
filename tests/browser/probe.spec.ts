import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('24/60Hz real runtime probe: jump latency and high-speed collision',async({page})=>{
 const results=[];
 for(const hz of [24,60]){
  await page.goto(`/?debug=1&hz=${hz}`);await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(()=>{const s=(window as any).__gameplay;(window as any).__probe={start:performance.now(),tick:s.run.tick};s.events.on('postupdate',()=>{const p=(window as any).__probe;if(!p.latency&&s.body.velocity.y<0){p.latency=performance.now()-p.start;p.responseTick=s.run.tick;}});});
  await page.keyboard.down('Space');await page.waitForFunction(()=>(window as any).__probe.latency>0);await page.keyboard.up('Space');
  const response=await page.evaluate(()=>(window as any).__probe);expect(response.responseTick-response.tick).toBeLessThanOrEqual(3);
  await page.evaluate(()=>{const s=(window as any).__gameplay;const orb=s.add.rectangle(1500,350,16,16,0xffffff),wall=s.add.rectangle(1700,350,8,200,0xffffff);s.physics.add.existing(orb);s.physics.add.existing(wall,true);orb.body.setAllowGravity(false).setVelocityX(1800);s.physics.add.collider(orb,wall);(window as any).__orb=orb;});
  await page.waitForTimeout(250);const right=await page.evaluate(()=>(window as any).__orb.body.right);expect(right).toBeLessThanOrEqual(1696.1);
  results.push({hz,jumpResponseTicks:response.responseTick-response.tick,inputToMotionMs:response.latency,highSpeed:1800,thinWall:8,right,collisionTravelLimit:8});
 }
 await mkdir('docs/evidence',{recursive:true});await writeFile('docs/evidence/physics-probe.json',JSON.stringify(results,null,2));
});
