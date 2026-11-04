import {test,expect} from '@playwright/test';
test.use({viewport:{width:1920,height:1080},launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']},permissions:['camera']});
// Count live camera tracks without touching app internals.
const tracking=()=>{const live:MediaStreamTrack[]=[];const open=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=async c=>{const s=await open(c);live.push(...s.getTracks());return s;};(window as any).__tracks=live;};
const liveTracks=(page:import('@playwright/test').Page)=>page.evaluate(()=>(window as any).__tracks.filter((t:MediaStreamTrack)=>t.readyState==='live').length);

test('CUSTOM: camera, shoot, retake, S2AM body, face in game, camera released, record without photo',async({page})=>{
  test.setTimeout(45000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(tracking);
  await page.goto('/');await page.keyboard.press('Enter');
  await page.locator('[data-action=character-custom]').click();await expect(page.locator('[data-action=character-custom]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-action=ready]').click();await expect(page.locator('.steps li')).toHaveCount(4);
  await page.waitForFunction(()=>(document.querySelector('video.live') as HTMLVideoElement)?.videoWidth>0);
  await expect(page.locator('[data-action=ready]')).toBeDisabled();
  await page.locator('[data-action=shoot]').click();await expect(page.locator('.viewfinder img')).toBeVisible();
  await expect(page.locator('[data-action=ready]')).toBeEnabled();expect(await liveTracks(page)).toBe(0);
  const first=await page.evaluate(()=>(window as any).__station.adapter.current.photo);expect(first).toMatch(/^data:image\//);
  await page.locator('[data-action=retake]').click();await expect(page.locator('[data-action=ready]')).toBeDisabled();
  await page.waitForFunction(()=>(document.querySelector('video.live') as HTMLVideoElement)?.videoWidth>0);
  await page.locator('[data-action=shoot]').click();await page.waitForFunction(()=>!!(window as any).__station.adapter.current.looks);
  await page.locator('[data-action=character-b]').click();await expect(page.locator('[data-action=character-b]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>{const c=(window as any).__station.adapter.current;return{custom:c.custom,id:c.characterId};})).toEqual({custom:true,id:'b'});
  for(let i=0;i<3;i++)await page.locator('[data-action=ready]').click();
  await page.waitForFunction(()=>(window as any).__gameplay?.session?.tutorial&&(window as any).__gameplay.presentation.face);
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
  await page.waitForFunction(()=>{const s=(window as any).__gameplay;return !s.session.tutorial&&s.presentation.face?.active;});
  const face=await page.evaluate(()=>{const p=(window as any).__gameplay.presentation;return{body:p.sprite.texture.key.slice(0,10),dy:p.sprite.y-p.face.y,dx:Math.abs(p.sprite.x-p.face.x)};});
  expect(face.body).toBe('chars/S2AM');expect(face.dy).toBeGreaterThan(0);expect(face.dx).toBeLessThan(20);
  await page.evaluate(()=>{const u=(window as any).__station;u.result=u.scene.session.finish('goal');u.adapter.save(u.result);});
  const saved=await page.evaluate(()=>{const u=(window as any).__station,row=JSON.parse(localStorage.getItem('rog-future-gamer.records.v1')!).records[0];return{row,wall:!!u.adapter.wall.get(u.adapter.current.sessionId).look};});
  expect(Object.keys(saved.row).some(k=>/photo|look/.test(k))).toBe(false);expect(saved.row.characterId).toBe('b');expect(saved.wall).toBe(true);
  expect(errors).toEqual([]);
});

test('CUSTOM: denied camera shows the reason and BACK returns to a normal character',async({page})=>{
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('denied','NotAllowedError'));});
  await page.goto('/');await page.keyboard.press('Enter');
  await page.locator('[data-action=character-custom]').click();await page.locator('[data-action=ready]').click();
  await expect(page.locator('.viewfinder [role=alert]')).toContainText('未取得攝影機權限');
  await expect(page.locator('[data-action=shoot]')).toBeDisabled();await expect(page.locator('[data-action=ready]')).toBeDisabled();
  await page.locator('[data-action=prev]').click();await page.locator('[data-action=character-a]').click();
  await expect(page.locator('.steps li')).toHaveCount(3);await page.locator('[data-action=ready]').click();await expect(page.locator('.item-card')).toHaveCount(5);
});
