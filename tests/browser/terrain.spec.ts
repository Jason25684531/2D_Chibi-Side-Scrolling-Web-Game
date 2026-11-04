import {test,expect} from '@playwright/test';
const T=32;
for(const hz of [24,60])test(`D3: horizontal mover carry, hazard shock, pit recovery ${hz}Hz`,async({page})=>{
  await page.goto(`/?debug=1&hz=${hz}`);await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  // e3 (85,29): axis x, range 6 cells, 3 cells/s, no pause.
  await page.evaluate(()=>{const s=(window as any).__gameplay;const p=s.terrain.entries.find((e:any)=>e.data.id==='e3').object;s.body.reset(p.x,p.body.top-32);s.controller.reset();});
  await page.waitForTimeout(250);
  const sample=()=>page.evaluate(()=>{const s=(window as any).__gameplay;const p=s.terrain.entries.find((e:any)=>e.data.id==='e3').object;return{x:s.player.x,relative:s.player.x-p.x,gap:p.body.top-s.body.bottom};});
  const before=await sample();await page.waitForTimeout(500);const after=await sample();
  expect(Math.abs(after.relative-before.relative)).toBeLessThan(8);expect(Math.abs(after.x-before.x)).toBeGreaterThan(5);expect(Math.abs(after.gap)).toBeLessThan(2);
  // Hazard 'x' row 20 cols 65-68: one shock (0.6 s, frozen), then the last safe ground; PLAYER_FELL once.
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.respawner.safe={x:14.5*32,y:17*32-32};s.body.reset(66.5*32,20*32);});
  await page.waitForFunction(()=>(window as any).__gameplay.shockUntil>0);
  const frozen=await page.evaluate(()=>(window as any).__gameplay.player.y);await page.waitForTimeout(200);
  expect(await page.evaluate(()=>(window as any).__gameplay.player.y)).toBe(frozen);
  await page.waitForFunction(()=>(window as any).__gameplay.shockUntil===0);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return{x:s.player.x,respawns:s.session.stats.respawns};})).toEqual({x:14.5*T,respawns:1});
  // Falling below the map takes the same recovery path.
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(30*32,s.level.pitY+40);});await page.waitForTimeout(150);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return s.session.stats.respawns===2&&s.terrain.supports(s.player.x,s.body.bottom,24);})).toBe(true);
});

test('free camera: lead side, ignores jumps, looks down after 2 cells, segment and world clamp, goal zoom',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const r=await page.evaluate(()=>{
    const s=(window as any).__gameplay;s.togglePause();const m=s.cameraManager,c=s.cameras.main,dt=1/24,T=32;
    const run=(n:number,p:any)=>{for(let i=0;i<n;i++)m.update(p,dt);return{x:c.scrollX,y:c.scrollY};};
    const ground={x:30*T,top:17*T-64,bottom:17*T,vx:256,vy:0,grounded:true};
    m.reset(ground.x,ground.bottom);const settled=run(60,ground);
    const jump=run(6,{...ground,top:ground.top-100,bottom:ground.bottom-100,vy:-300,grounded:false});
    m.reset(ground.x,ground.bottom);run(30,ground);const fall=run(30,{...ground,top:30*T-64,bottom:30*T,vy:600,grounded:false});
    m.reset(99*T,17*T);const right=run(60,{...ground,x:99*T});
    m.reset(91*T,60*T);const zoom=(()=>{for(let i=0;i<60;i++)m.update({x:91.5*T,top:60*T-64,bottom:60*T,vx:0,vy:0,grounded:true},dt,1);return c.zoom;})();
    return{settled,jump,fall,right,zoom,hud:s.hud.scrollFactorX,segBottom:23*T-540};
  });
  expect(r.settled.x).toBeCloseTo(30*T-960*.4,0); // facing right: player at 40% of the width (10% lead)
  expect(r.settled.y).toBeLessThanOrEqual(r.segBottom); // clamped to segment 1 (rows 0-23)
  expect(r.jump.y).toBeCloseTo(r.settled.y,0); // jumps do not move the camera
  expect(r.fall.y).toBeGreaterThan(r.settled.y+100); // falling well below the last ground follows down
  expect(r.right.x).toBe(3200-960);expect(r.hud).toBe(0);
  expect(r.zoom).toBeGreaterThan(1.05);expect(r.zoom).toBeLessThanOrEqual(1.08);
});

test('vertical moving platform carries through reversal and releases on jump',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(()=>{const s=(window as any).__gameplay;const p=s.terrain.entries.find((e:any)=>e.data.axis==='y');p.data.range=30;p.data.speed=40;p.data.pause=0;p.mover.pos=0;p.object.body.reset(p.mover.x0,p.mover.y0);s.body.reset(p.object.x,p.object.body.top-32);s.controller.reset();});
  await page.waitForTimeout(200);
  const samples:{y:number;gap:number;vy:number}[]=[];
  for(let i=0;i<22;i++){await page.waitForTimeout(100);samples.push(await page.evaluate(()=>{const s=(window as any).__gameplay;const p=s.terrain.entries.find((e:any)=>e.data.axis==='y');return{y:s.player.y,gap:p.object.body.top-s.body.bottom,vy:p.object.body.velocity.y};}));}
  expect(Math.max(...samples.map(s=>Math.abs(s.gap)))).toBeLessThan(4);expect(Math.max(...samples.map(s=>s.y))-Math.min(...samples.map(s=>s.y))).toBeGreaterThan(10);
  expect(samples.some(s=>s.vy>5)&&samples.some(s=>s.vy< -5)).toBe(true);
  await page.keyboard.down('KeyZ');await page.waitForTimeout(150);await page.keyboard.up('KeyZ');
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;const p=s.terrain.entries.find((e:any)=>e.data.axis==='y');return p.object.body.top-s.body.bottom;})).toBeGreaterThan(20);
});

test('Scene pause freezes an active camera move and resume completes it',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(()=>{
    const s=(window as any).__gameplay;s.body.reset(20*32,512);s.controller.reset(); // 7+ cells from every enemy
    let previous=s.cameras.main.scrollX;
    const pauseDuringMove=()=>{const x=s.cameras.main.scrollX;if(x>previous+1){s.events.off('postupdate',pauseDuringMove);s.togglePause();s.cameraPause={x,elapsed:s.run.elapsed,playerY:s.player.y};}previous=x;};
    s.events.on('postupdate',pauseDuringMove);
  });
  await page.waitForFunction(()=>!!(window as any).__gameplay.cameraPause);
  const paused=await page.evaluate(()=>(window as any).__gameplay.cameraPause);
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return{x:s.cameras.main.scrollX,elapsed:s.run.elapsed,playerY:s.player.y};})).toEqual(paused);
  await page.click('#pause');
  await page.waitForFunction(()=>Math.abs((window as any).__gameplay.cameras.main.scrollX-(20*32-960*.4))<1);
  const resumed=await page.evaluate(()=>{const s=(window as any).__gameplay;return{elapsed:s.run.elapsed,phase:s.run.phase};});
  expect(resumed.phase).toBe('running');expect(resumed.elapsed).toBeGreaterThan(paused.elapsed);
});

test('fall-zone nets and laser-trap art carry live arcs; a shock adds arcs on the player',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const layers=()=>page.evaluate(()=>(window as any).__gameplay.children.list.filter((o:any)=>o.type==='Graphics'&&(o.depth===-9||o.depth===7)).map((o:any)=>o.commandBuffer.length));
  await page.evaluate(()=>{const s=(window as any).__gameplay,h=s.terrain.hazards[0];s.body.reset(h.x,h.y-140);s.body.setAllowGravity(false);s.cameraManager.reset(h.x,h.y-100);});
  await page.waitForTimeout(300);const near=await layers();expect(near).toHaveLength(3);expect(near[1]).toBeGreaterThan(0);
  const shock=await page.evaluate(()=>{const s=(window as any).__gameplay;s.shockUntil=s.run.elapsed+.6;return 1;});expect(shock).toBe(1);
  await page.waitForTimeout(100);expect((await layers())[2]).toBeGreaterThan(0);
});
