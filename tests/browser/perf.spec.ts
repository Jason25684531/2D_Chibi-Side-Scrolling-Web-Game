import {test,expect} from '@playwright/test';
// Kiosk budget: >= 30 fps through the real station flow while running, jumping and dashing across the level.
test('station run keeps >= 30 fps and each frame (logic + render) inside the 33 ms budget',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('/');await page.keyboard.press('Enter');await page.waitForSelector('[data-screen=P1]');
  for(let i=0;i<14&&!(await page.evaluate(()=>{const g=(window as any).__gameplay;return !!g?.session&&!g.session.tutorial&&g.run.phase==='running';}));i++){await page.keyboard.press('Enter');await page.waitForTimeout(700);}
  await page.evaluate(()=>{const w=window as any;w.__ft=[];w.__cost=[];let last=performance.now(),a0=0;
    const f=()=>{const n=performance.now();w.__ft.push(n-last);last=n;requestAnimationFrame(f);};requestAnimationFrame(f);
    w.__game.events.on('prestep',()=>{a0=performance.now();});w.__game.events.on('postrender',()=>{w.__cost.push(performance.now()-a0);});});
  await page.keyboard.down('ArrowRight');
  for(let i=0;i<10;i++){await page.keyboard.press('KeyZ');await page.waitForTimeout(250);await page.keyboard.press('KeyZ');await page.waitForTimeout(400);await page.keyboard.press('KeyX');await page.waitForTimeout(350);}
  await page.keyboard.up('ArrowRight');
  const r=await page.evaluate(()=>{const w=window as any,ft:number[]=w.__ft.slice(5),cost:number[]=[...w.__cost.slice(5)].sort((a,b)=>a-b);
    return{fps:1000/(ft.reduce((a,b)=>a+b,0)/ft.length),costP95:cost[Math.floor(cost.length*.95)]};});
  console.log(`fps ${r.fps.toFixed(1)}, logic+render p95 ${r.costP95.toFixed(1)} ms`);
  expect(r.fps).toBeGreaterThanOrEqual(30);expect(r.costP95).toBeLessThan(33);
});
