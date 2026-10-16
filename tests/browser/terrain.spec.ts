import {test,expect} from '@playwright/test';
for(const hz of [24,60])test(`D3: moving carry, pit recovery and camera ${hz}Hz`,async({page})=>{
  await page.goto(`/?debug=1&hz=${hz}`);await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(()=>{const s=(window as any).__gameplay;const p=s.terrain.entries.find((e:any)=>e.data.kind==='moving').object;s.body.reset(p.x,p.y-34);s.controller.reset();});
  await page.waitForTimeout(250);
  const before=await page.evaluate(()=>{const s=(window as any).__gameplay;const p=s.terrain.entries.find((e:any)=>e.data.kind==='moving').object;return{x:s.player.x,relative:s.player.x-p.x,y:s.body.bottom};});
  await page.waitForTimeout(500);
  const after=await page.evaluate(()=>{const s=(window as any).__gameplay;const p=s.terrain.entries.find((e:any)=>e.data.kind==='moving').object;return{x:s.player.x,relative:s.player.x-p.x,y:s.body.bottom};});
  expect(Math.abs(after.relative-before.relative)).toBeLessThan(8);expect(Math.abs(after.x-before.x)).toBeGreaterThan(5);expect(after.y).toBeCloseTo(730,0);
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(1070,1010);});await page.waitForTimeout(120);
  expect(await page.evaluate(()=>(window as any).__gameplay.player.x)).toBeLessThan(900);
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(1800,450);s.body.setVelocityY(-300);});await page.waitForTimeout(160);
  const cam=await page.evaluate(()=>{const s=(window as any).__gameplay;return{x:s.cameras.main.scrollX,y:s.cameras.main.scrollY,hud:s.hud.scrollFactorX};});
  expect(cam.x).toBeCloseTo(1480,0);expect(cam.y).toBeGreaterThanOrEqual(156);expect(cam.y).toBeLessThan(300);expect(cam.hud).toBe(0);
  const easing=await page.evaluate(()=>{const s=(window as any).__gameplay;s.togglePause();const m=s.cameraManager,c=s.cameras.main,dt=1/s.fixed.hz;m.reset(1800,776);m.update(1800,400,dt);const high=c.scrollY;m.update(1800,410,dt);const returning=c.scrollY;m.update(1800,390,dt);const interrupted=c.scrollY;for(let i=0;i<Math.ceil(.3/dt);i++)m.update(1800,800,dt);const returned=c.scrollY;m.update(99999,800,dt);const right=c.scrollX;m.reset(120,776);return{high,returning,interrupted,returned,right,resetX:c.scrollX,resetY:c.scrollY};});
  expect(easing.returning).toBeGreaterThan(easing.high);expect(easing.interrupted).toBeLessThan(easing.returning);expect(easing.returned).toBe(300);expect(easing.right).toBe(3040);expect(easing.resetX).toBe(0);expect(easing.resetY).toBe(300);
});
test('vertical moving platform carries through reversal and releases on jump',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(()=>{const s=(window as any).__gameplay;const p=s.terrain.entries.find((e:any)=>e.data.kind==='moving');p.data.travel=0;p.data.travelY=30;s.body.reset(p.object.x,p.object.y-34);s.controller.reset();});
  await page.waitForTimeout(200);
  const samples:{y:number;gap:number;vy:number}[]=[];
  for(let i=0;i<22;i++){await page.waitForTimeout(100);samples.push(await page.evaluate(()=>{const s=(window as any).__gameplay;const p=s.terrain.entries.find((e:any)=>e.data.kind==='moving');return{y:s.player.y,gap:p.object.body.top-s.body.bottom,vy:p.object.body.velocity.y};}));}
  expect(Math.max(...samples.map(s=>Math.abs(s.gap)))).toBeLessThan(4);expect(Math.max(...samples.map(s=>s.y))-Math.min(...samples.map(s=>s.y))).toBeGreaterThan(10);
  expect(samples.some(s=>s.vy>5)&&samples.some(s=>s.vy< -5)).toBe(true);
  await page.keyboard.down('Space');await page.waitForTimeout(150);await page.keyboard.up('Space');
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;const p=s.terrain.entries.find((e:any)=>e.data.kind==='moving');return p.object.body.top-s.body.bottom;})).toBeGreaterThan(20);
});

test('Scene pause freezes an active camera return and resume completes it',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(()=>{
    const s=(window as any).__gameplay;
    s.body.reset(1800,400);s.controller.reset();s.body.setVelocityY(-100);
    let previous=300;
    const pauseDuringReturn=()=>{
      const y=s.cameras.main.scrollY;
      if(y>previous&&y<299){s.events.off('postupdate',pauseDuringReturn);s.togglePause();s.cameraPause={y,elapsed:s.run.elapsed,playerY:s.player.y};}
      previous=y;
    };
    s.events.on('postupdate',pauseDuringReturn);
  });
  await page.waitForFunction(()=>!!(window as any).__gameplay.cameraPause);
  const paused=await page.evaluate(()=>(window as any).__gameplay.cameraPause);
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return{y:s.cameras.main.scrollY,elapsed:s.run.elapsed,playerY:s.player.y};})).toEqual(paused);
  await page.click('#pause');
  await page.waitForFunction(()=>(window as any).__gameplay.cameras.main.scrollY===300);
  const resumed=await page.evaluate(()=>{const s=(window as any).__gameplay;return{elapsed:s.run.elapsed,phase:s.run.phase};});
  expect(resumed.phase).toBe('running');expect(resumed.elapsed).toBeGreaterThan(paused.elapsed);
  expect(resumed.elapsed-paused.elapsed).toBeLessThanOrEqual(.3+2/24);
});
