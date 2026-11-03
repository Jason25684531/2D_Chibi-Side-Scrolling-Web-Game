import {test,expect} from '@playwright/test';
test('beholder patrol/chase/laser, charger dash, reset, Ally attraction and safe fallback use real runtime objects',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const result=await page.evaluate(()=>{
    const s=(window as any).__gameplay,T=32,dt=1/24;s.togglePause();
    const E=s.enemies,step=(n:number)=>{for(let i=0;i<n;i++)E.update(dt);};
    s.respawner.safe={x:3000,y:776};const fallback=s.respawner.position(24,64);
    // e68 beholder (80,16) with laser on the cols 79-83 ledge; player 2 cells to its right, same ledge.
    const eye=E.enemies.find((e:any)=>e.id==='e68');const x0=eye.x;
    s.body.reset(99*T,100);step(12);const patrolled=eye.x!==x0&&eye.state==='patrol';
    s.body.reset(82.8*T,17*T-32);step(1);const chase=eye.state;
    eye.cd=0;step(2);const charge=eye.state;step(Math.ceil(.7/dt));const fire={state:eye.state,beam:!!eye.beam};
    step(Math.ceil(.4/dt));const cooled={state:eye.state,cd:eye.cd>0};
    // e76 charger (28,16): dashes at the player 5 cells away on the same floor, then rests.
    const spider=E.enemies.find((e:any)=>e.id==='e76'),sx=spider.x;
    s.body.reset(spider.x-5*T,17*T-32);step(6);const dashed={state:spider.state,moved:sx-spider.x};
    E.defeat(spider,'stomp');const dead=spider.defeated;
    E.reset();const reset=E.enemies.every((e:any)=>!e.defeated&&e.x===e.home.x)&&E.bolts.length===0;
    s.body.reset(300,500);s.session.power.activate('ally',s.run.elapsed);
    s.badges.spawn({id:'near-fixture',x:400,y:500});s.badges.spawn({id:'far-fixture',x:520,y:500});
    s.badges.update(dt);const near=s.badges.objects.get('near-fixture').x,far=s.badges.objects.get('far-fixture').x;
    const entries=s.terrain.entries;let invalidSpawn='';
    try{s.terrain.entries=[];s.respawner.position(24,64);}catch(error){invalidSpawn=(error as Error).message;}finally{s.terrain.entries=entries;}
    return{fallback,patrolled,chase,charge,fire,cooled,dashed,dead,reset,near,far,invalidSpawn};
  });
  expect(result.fallback).toEqual({x:80,y:512});
  expect(result).toMatchObject({patrolled:true,chase:'chase',charge:'charge',fire:{state:'fire',beam:true},cooled:{state:'chase',cd:true},dead:true,reset:true});
  expect(result.dashed.state).toBe('charge');expect(result.dashed.moved).toBeGreaterThan(30);
  expect(result.near).toBeLessThan(400);expect(result.far).toBe(520);
  expect(result.invalidSpawn).toBe('Level has no safe respawn position');
  await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  expect(await page.evaluate(()=>(window as any).__gameplay.inputAdapter.sample().move)).toBe(0);await page.keyboard.up('ArrowRight');
});
