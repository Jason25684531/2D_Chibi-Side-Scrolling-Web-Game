import {test,expect} from '@playwright/test';
test('enemy lifecycle, safe fallback and Ally attraction use real runtime objects',async({page})=>{
  await page.goto('/');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const result=await page.evaluate(()=>{
    const s=(window as any).__gameplay;s.togglePause();
    s.respawner.safe={x:1070,y:776};const fallback=s.respawner.position(32,48);
    const melee=s.enemies.enemies.find((e:any)=>e.kind==='melee');
    const ranged=s.enemies.enemies.find((e:any)=>e.kind==='ranged');
    const drone=s.enemies.enemies.find((e:any)=>e.kind==='drone');
    s.body.reset(ranged.object.x-100,776);ranged.attackReady=0;s.enemies.update(1/24);
    const behavior={melee:melee.object.body.velocity.x,drone:drone.object.body.velocity.x,shots:s.enemies.shots.length};
    s.enemies.defeat(melee);s.enemies.update(1/24);const dead=!melee.object.body.enable;
    s.enemies.reset();const reset=s.enemies.enemies.every((e:any)=>e.object.body.enable&&!e.defeated)&&s.enemies.shots.length===0;
    s.body.reset(300,776);s.session.power.activate('ally',s.run.elapsed);
    s.badges.spawn({id:'near-fixture',x:400,y:776});s.badges.spawn({id:'far-fixture',x:500,y:776});
    s.badges.update(1/24);const near=s.badges.objects.get('near-fixture').x,far=s.badges.objects.get('far-fixture').x;
    const entries=s.terrain.entries;let invalidSpawn='';
    try{s.terrain.entries=[];s.respawner.position(32,48);}catch(error){invalidSpawn=(error as Error).message;}finally{s.terrain.entries=entries;}
    return{fallback,behavior,dead,reset,near,far,invalidSpawn};
  });
  expect(result.fallback).toEqual({x:120,y:776});expect(result.behavior.melee).not.toBe(0);expect(result.behavior.drone).not.toBe(0);expect(result.behavior.shots).toBeGreaterThan(0);expect(result.dead).toBe(true);expect(result.reset).toBe(true);expect(result.near).toBeLessThan(400);expect(result.far).toBe(500);
  expect(result.invalidSpawn).toBe('Level has no safe respawn position');
  await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  expect(await page.evaluate(()=>(window as any).__gameplay.inputAdapter.sample().move)).toBe(0);await page.keyboard.up('ArrowRight');
});
