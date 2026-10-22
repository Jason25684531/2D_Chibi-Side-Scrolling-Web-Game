import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('repeated keyboard Restart retains one scene, stable entities and bounded heap',async({page})=>{
  test.setTimeout(30000);await page.goto('/');await page.waitForFunction(()=>!!(window as any).__station?.game.registry.get('assetsReady'));
  await page.evaluate(()=>{const u=(window as any).__station;u.adapter.enqueue();u.go('P1');u.go('P2');u.go('P3');u.go('P4');u.start();});
  await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const client=await page.context().newCDPSession(page);await client.send('Performance.enable');await client.send('HeapProfiler.collectGarbage');
  const heap=async()=>((await client.send('Performance.getMetrics')).metrics.find(m=>m.name==='JSHeapUsedSize')!.value);
  const beforeHeap=await heap();
  const snapshot=()=>page.evaluate(()=>{const s=(window as any).__gameplay;return{bodies:s.physics.world.bodies.size,staticBodies:s.physics.world.staticBodies.size,children:s.children.length,poststep:s.game.events.listenerCount('poststep'),events:s.session.events.eventNames().length};});
  const before=await snapshot();
  const frames=()=>page.evaluate(()=>new Promise<{median:number;p95:number}>(resolve=>{const values:number[]=[];let last=performance.now();const sample=(now:number)=>{values.push(now-last);last=now;if(values.length<120)requestAnimationFrame(sample);else{values.sort((a,b)=>a-b);resolve({median:values[60],p95:values[114]});}};requestAnimationFrame(sample);}));
  const beforeFrames=await frames();
  for(let i=0;i<5;i++){
    const id=await page.evaluate(()=>(window as any).__gameplay.run.runId);
    await page.keyboard.press('KeyH');await expect(page.locator('.modal [data-action=continue]')).toBeFocused();
    await page.keyboard.press('ArrowRight');await expect(page.locator('.modal [data-action=restart]')).toBeFocused();await page.keyboard.press('Enter');
    await page.waitForFunction(old=>(window as any).__gameplay.run.runId!==old,id);await page.waitForTimeout(70);
    expect(await snapshot()).toEqual(before);
  }
  await client.send('HeapProfiler.collectGarbage');const growth=await heap()-beforeHeap;
  expect(growth).toBeLessThan(5_000_000);
  test.info().annotations.push({type:'heap-growth-bytes',description:String(growth)});
  await mkdir('docs/evidence/rog-uiux',{recursive:true});
  await writeFile('docs/evidence/rog-uiux/lifecycle.json',JSON.stringify({before,after:await snapshot(),beforeFrames,afterFrames:await frames(),heapGrowthBytes:growth,scope:'Current integrated build before/after five restarts; not a pre-UI baseline'},null,2));
});
