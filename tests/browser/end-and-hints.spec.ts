import {test,expect,type Page} from '@playwright/test';
import {comfyOffline} from './comfy-offline';
test.use({viewport:{width:1920,height:1080}});
test.beforeEach(comfyOffline);
const ready=async(page:Page)=>{await page.goto('/');await page.waitForFunction(()=>!!(window as any).__station?.game.registry.get('assetsReady'));};
const enterTutorial=async(page:Page)=>{
  await page.keyboard.press('Enter');
  for(let i=0;i<6&&!(await page.locator('[data-screen=P3]').count());i++){await page.keyboard.press('Enter');await page.waitForTimeout(300);}
  await expect(page.locator('[data-screen=P3]')).toBeVisible();
  await page.waitForFunction(()=>(window as any).__gameplay?.session?.tutorial);
};
const labels=(page:Page)=>page.locator('.lesson kbd, .hints kbd').evaluateAll(n=>n.map(k=>k.getAttribute('aria-label')??k.textContent??''));

test('the tutorial names gamepad buttons, never keyboard keys',async({page})=>{
  await ready(page);await enterTutorial(page);
  const names=await labels(page);
  for(const want of ['左搖桿','✕','R1','□','△','OPTIONS'])expect(names).toContain(want);
  for(const key of ['Z','X','C','ENTER','H','Z ×2','← →'])expect(names).not.toContain(key);
  expect(await page.locator('.lesson kbd svg, .hints kbd svg').count()).toBeGreaterThan(5);
});

test('a rebound pad button shows up in the tutorial',async({page})=>{
  await ready(page);await enterTutorial(page);
  await page.evaluate(()=>{
    const u=(window as any).__station,id='test-pad',buttons=Array.from({length:16},()=>({pressed:false}));
    u.scene.testPad={id,mapping:'standard',axes:[0,0],buttons};
    u.saveControls(id,{buttons:{jump:[0],back:[1],throw:[2],confirm:[3],dash:[4],home:[9],up:[12],down:[13],left:[14],right:[15]},axisX:0,axisY:1});
    u.render();
  });
  const dash=page.locator('[data-lesson=衝刺] kbd');
  await expect(dash).toHaveAttribute('aria-label','L1');
  await expect(page.locator('.hints kbd[aria-label=R1]')).toHaveCount(0);
});

test('a photo player pressing confirm on the result screen goes home instead of replaying',async({page})=>{
  await ready(page);
  await page.evaluate(()=>{const u=(window as any).__station;u.adapter.replayEnabled=true;u.adapter.enqueue();u.adapter.current.captureStarted=true;u.go('P1');u.go('P2');u.go('P3');u.go('P4');u.start();});
  await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(()=>{const u=(window as any).__station;u.result=u.scene.session.finish('goal');u.adapter.save(u.result);u.go('P5');});
  await expect(page.locator('[data-screen=P5] [data-action=exit]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen=P0]')).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__station.adapter.queue.length)).toBe(0);
});
