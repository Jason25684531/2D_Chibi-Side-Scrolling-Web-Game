import {test,expect,type Page} from '@playwright/test';
import {comfyOffline} from './comfy-offline';
test.use({viewport:{width:1920,height:1080}});
test.beforeEach(comfyOffline);
const ready=async(page:Page)=>{await page.goto('/');await page.waitForFunction(()=>!!(window as any).__station?.game.registry.get('assetsReady'));};
const idleFor=(page:Page,ms:number)=>page.evaluate(ms=>{(window as any).__station.idleSince=performance.now()-ms;},ms);

test('a photo-locked player who walks away from P1 is sent home and the photo is released',async({page})=>{
  await ready(page);
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P1]')).toBeVisible();
  const photo=await page.evaluate(()=>{const c=(window as any).__station.adapter.current;c.photo=URL.createObjectURL(new Blob(['x']));c.captureStarted=true;return c.photo;});
  await idleFor(page,89000);await page.waitForTimeout(200);
  await expect(page.locator('.idle-warn')).toHaveCount(0);
  await idleFor(page,90001);
  await expect(page.locator('.idle-warn')).toBeVisible();await expect(page.locator('#idle-count')).toHaveText('10');
  await idleFor(page,100001);
  await expect(page.locator('[data-screen=P0]')).toBeVisible();
  const after=await page.evaluate(async url=>{const u=(window as any).__station;let revoked=false;try{await fetch(url);}catch{revoked=true;}return{queue:u.adapter.queue.length,stream:u.stream,revoked};},photo);
  expect(after).toEqual({queue:0,stream:null,revoked:true});
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P1]')).toBeVisible();
  expect(await page.evaluate(()=>{const c=(window as any).__station.adapter.current;return{photo:c.photo,lock:!!c.captureStarted};})).toEqual({photo:undefined,lock:false});
});

test('on P7 any input cancels the countdown and an open system menu pauses the idle clock',async({page})=>{
  await ready(page);
  await page.evaluate(()=>{const u=(window as any).__station;u.adapter.enqueue();u.go('P1');u.go('P2');u.go('P3');u.go('P4');u.start();});
  await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(()=>{const u=(window as any).__station;u.result=u.scene.session.finish('goal');u.adapter.save(u.result);u.go('P5');u.go('P6');u.go('P7');});
  await idleFor(page,95000);
  await expect(page.locator('.idle-warn')).toBeVisible();
  const focused=await page.evaluate(()=>(document.activeElement as HTMLElement).dataset.action);
  await page.keyboard.press('Enter');
  await expect(page.locator('.idle-warn')).toHaveCount(0);await expect(page.locator('[data-screen=P7]')).toBeVisible();
  expect(await page.evaluate(()=>(document.activeElement as HTMLElement).dataset.action)).toBe(focused);
  await page.keyboard.press('KeyH');await expect(page.locator('.modal.screen')).toBeVisible();
  const before=await page.evaluate(()=>performance.now()-(window as any).__station.idleSince);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(()=>performance.now()-(window as any).__station.idleSince)-before).toBeLessThan(300);
});

test('the P3 tutorial is exempt from idle recovery',async({page})=>{
  await ready(page);
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P1]')).toBeVisible();
  for(let i=0;i<6&&!(await page.locator('[data-screen=P3]').count());i++){await page.keyboard.press('Enter');await page.waitForTimeout(300);}
  await expect(page.locator('[data-screen=P3]')).toBeVisible();
  await idleFor(page,200000);await page.waitForTimeout(300);
  await expect(page.locator('[data-screen=P3]')).toBeVisible();await expect(page.locator('.idle-warn')).toHaveCount(0);
});
