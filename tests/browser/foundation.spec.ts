import {test,expect} from '@playwright/test';
test('D1: real Phaser keyboard, simulated gamepad, pause, home and restart',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.waitForFunction(()=>!!(window as any).__gameplay?.body?.blocked.down);
  const x=await page.evaluate(()=>(window as any).__gameplay.player.x);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(()=>(window as any).__gameplay.player.x)).toBeGreaterThan(x+25);
  await page.click('#pause');const remaining=await page.evaluate(()=>(window as any).__gameplay.run.remaining);
  await page.waitForTimeout(250);expect(await page.evaluate(()=>(window as any).__gameplay.run.remaining)).toBe(remaining);
  await page.click('#pause');await page.evaluate(()=>{(window as any).__gameplay.testPad={axes:[-1],buttons:[]};});
  await page.waitForTimeout(250);await page.evaluate(()=>{(window as any).__gameplay.testPad=null;});
  const old=await page.evaluate(()=>(window as any).__gameplay.run.runId);await page.click('#home');
  await page.waitForFunction(()=>!(window as any).__game.scene.isActive('Gameplay'));
  await page.click('#start');await page.waitForFunction(old=>(window as any).__gameplay.run.runId!==old,old);
  expect(errors).toEqual([]);
});
test('Home key opens the UX p14 menu: pauses, Continue resumes, Restart starts a new Run',async({page})=>{
  await page.goto('/');await page.waitForFunction(()=>!!(window as any).__gameplay?.body?.blocked.down);
  await page.keyboard.press('KeyH');await page.waitForFunction(()=>(window as any).__gameplay.menu===0);
  expect(await page.evaluate(()=>(window as any).__gameplay.run.phase)).toBe('paused');
  await page.keyboard.press('Space');await page.waitForFunction(()=>(window as any).__gameplay.run.phase==='running');
  const old=await page.evaluate(()=>(window as any).__gameplay.run.runId);
  await page.keyboard.press('KeyH');await page.waitForFunction(()=>(window as any).__gameplay.menu===0);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(100);await page.keyboard.up('ArrowRight');await page.waitForFunction(()=>(window as any).__gameplay.menu===1);
  await page.keyboard.press('Space');await page.waitForFunction(old=>(window as any).__gameplay.run.runId!==old,old);
  expect(await page.evaluate(()=>(window as any).__gameplay.run.timeTier)).toBe('90');
});
