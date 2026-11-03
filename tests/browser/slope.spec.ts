import {test,expect} from '@playwright/test';

test('24Hz Arcade slopes: ascent, descent, endpoints, jump, dash, moving transfer and respawn',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(async()=>{
    const path='/src/terrain/system.ts';const {TerrainSystem}=await import(path);
    const s=(window as any).__gameplay;
    for(const e of s.terrain.entries)e.object.destroy();
    const level={...s.terrain.level,terrain:[
      {id:'flat',kind:'ground',x:150,y:830,width:300,height:60},
      {id:'up',kind:'slope',x:400,y:750,width:200,height:100,rise:100},
      {id:'top',kind:'ground',x:600,y:730,width:200,height:60},
      {id:'down',kind:'slope',x:800,y:750,width:200,height:100,rise:-100},
      {id:'transfer',kind:'moving',x:1000,y:810,width:200,height:20,axis:'x',range:0,speed:0,pause:0}
    ]};
    s.terrain=new TerrainSystem(s,level,s.player,()=>s.run.elapsed,()=>{});
    const respawnPath='/src/respawn/manager.ts';const {RespawnManager}=await import(respawnPath);
    s.respawner=new RespawnManager(s.terrain,level);
    s.body.reset(250,768);s.controller.reset();
  });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(()=>(window as any).__gameplay.player.x>400);
  const up=await page.evaluate(()=>{const s=(window as any).__gameplay;return{x:s.player.x,bottom:s.body.bottom};});
  expect(up.bottom).toBeCloseTo(950-(up.x+12)/2,0); // leading foot = right edge (body 24 wide)
  await page.waitForFunction(()=>(window as any).__gameplay.player.x>550);
  expect(await page.evaluate(()=>(window as any).__gameplay.body.bottom)).toBeCloseTo(700,0);
  await page.waitForFunction(()=>(window as any).__gameplay.player.x>800);
  const down=await page.evaluate(()=>{const s=(window as any).__gameplay;return{x:s.player.x,bottom:s.body.bottom};});
  expect(Math.abs(down.bottom-(350+(down.x-12)/2))).toBeLessThan(8);
  await page.waitForFunction(()=>(window as any).__gameplay.player.x>970);
  await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(()=>(window as any).__gameplay.body.bottom)).toBeCloseTo(800,0);
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(400,700);s.controller.reset();});
  await page.waitForTimeout(150);await page.keyboard.down('KeyZ');await page.waitForTimeout(150);await page.keyboard.up('KeyZ');
  expect(await page.evaluate(()=>(window as any).__gameplay.body.bottom)).toBeLessThan(730);
  await page.waitForTimeout(1000);
  await page.keyboard.down('ArrowRight');await page.keyboard.press('KeyX');await page.waitForTimeout(250);await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(()=>(window as any).__gameplay.player.x)).toBeGreaterThan(470);
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.respawn('pit');});
  await page.waitForTimeout(100);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return s.run.phase==='running'&&s.body.bottom<=801&&s.body.width===24&&s.body.height===64;})).toBe(true);
});
