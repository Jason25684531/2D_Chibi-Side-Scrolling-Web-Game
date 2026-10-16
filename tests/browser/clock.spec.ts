import {test,expect} from '@playwright/test';
test('real main-thread stall consumes wall time despite six-step physics cap',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const before=await page.evaluate(()=>({remaining:(window as any).__gameplay.run.remaining,now:performance.now()}));
  await page.evaluate(()=>{const end=performance.now()+800;while(performance.now()<end){/* intentional stall fixture */}});
  await page.waitForTimeout(100);
  const after=await page.evaluate(()=>({remaining:(window as any).__gameplay.run.remaining,now:performance.now()}));
  expect(Math.abs((before.remaining-after.remaining)-(after.now-before.now)/1000)).toBeLessThan(.1);
});
