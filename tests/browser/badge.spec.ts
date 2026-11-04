import {test,expect} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const assets=JSON.parse(readFileSync('src/level/data/assets.json','utf8'));
const level=JSON.parse(readFileSync('src/level/data/level.json','utf8'));
const key='items/'+level.itemArt.badge.art,source='1102_關卡編輯器/CYBER_RUN_1101_可直接開啟/game/'+key;
test('package badge art, cap twelve, moving drops, recovery and expiry',async({page})=>{
  if(existsSync(source))expect(createHash('sha256').update(readFileSync(source)).digest('hex')).toBe(assets[key].sha256);
  expect(existsSync('public'+assets[key].url)).toBe(true);
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const start=await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(300,300);s.body.setAllowGravity(false);for(let i=0;i<15;i++)s.session.pickup('test-'+i);s.takeDamage('fixture');return{held:s.session.badges.held,count:s.badges.drops.size,texture:[...s.badges.objects.values()][0].texture.key,y:[...s.badges.objects.entries()].find(([id]:any)=>id.startsWith('drop-'))[1].y};});
  expect(start).toMatchObject({held:3,count:12,texture:key});
  await page.waitForTimeout(130);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return [...s.badges.objects.entries()].find(([id]:any)=>id.startsWith('drop-'))[1].y;})).not.toBe(start.y);
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(1500,100);});
  // One arc, one bounce, then rest on the surface below: resting drops never move again.
  await page.waitForTimeout(1500);
  const rested=()=>page.evaluate(()=>{const s=(window as any).__gameplay;return [...s.badges.drops.entries()].filter(([,d]:any)=>d.rest).map(([id,d]:any)=>{const o=s.badges.objects.get(id);return{id,x:o.x,y:o.y,bounced:d.bounced,onGround:Math.abs(o.y+o.displayHeight/2-s.terrain.groundY(o.x,o.y))<1};});});
  const first=await rested();expect(first.length).toBeGreaterThan(0);expect(first.every(d=>d.bounced&&d.onGround)).toBe(true);
  await page.waitForTimeout(300);expect((await rested()).filter(d=>first.some(f=>f.id===d.id))).toEqual(first);
  await page.waitForTimeout(3300);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return{s:s.session.badges.scattered.size,d:s.badges.drops.size,score:s.session.score.total};})).toEqual({s:0,d:0,score:0});
});

test('Ally pulls a floating level badge straight in instead of dragging it along beside the player',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const id=await page.evaluate(()=>{const s=(window as any).__gameplay,b=s.level.badges[0];s.body.reset(b.x,b.y+120);s.body.setAllowGravity(false);s.session.power.activate('ally',s.run.elapsed);return b.id;});
  await page.waitForFunction(id=>(window as any).__gameplay.session.badges.collected.has(id),id,{timeout:3000});
});

test('scattered badges never enter walls, ceilings or slopes anywhere in the level; spawned badges, items and enemies are not inside walls',async({page})=>{
  test.setTimeout(60000);
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const r=await page.evaluate(()=>{
    const s=(window as any).__gameplay,t=s.terrain,w=s.badges,L=s.level,T=32,dt=1/24;
    s.run.pause();s.body.reset(L.width-40,40); // far from every spot: no pickups while we step by hand
    const sunk=(x:number,bottom:number)=>t.entries.some(({data:d}:any)=>d.kind==='slope'&&x>d.x-d.width/2+2&&x<d.x+d.width/2-2&&bottom>t.slopeY(d,x)+3&&bottom<d.y+d.height/2);
    const spots:number[][]=[];
    for(let c=1;c<L.width/T-1;c++)for(let row=2;row<L.height/T;row++){const x=c*T+T/2,b=row*T;
      if(t.supports(x,b,24)&&t.clear(x,b-32,24,64)&&(t.solidAt(x-2*T,b-T,4,4)||t.solidAt(x+2*T,b-T,4,4)||t.solidAt(x,b-3*T,4,4))&&Math.hypot(x-L.width,b)>300)spots.push([x,b]);}
    const bad:string[]=[];let rested=0,lost=0;
    for(const [x,b] of spots){
      s.session.badges.held=12;const ids=s.session.badges.scatter(s.run.elapsed);w.scatter(ids,x,b-32);
      for(let i=0;i<72;i++){w.update(dt);
        for(const id of ids){const d=w.drops.get(id),o=w.objects.get(id);if(!d||!o)continue;const h=o.displayHeight/2;
          if(t.solidAt(d.x,d.y,h*2-2,h*2-2))bad.push(`solid ${id} @${Math.round(d.x)},${Math.round(d.y)} from ${x},${b}`);
          if(sunk(d.x,d.y+h))bad.push(`slope ${id} @${Math.round(d.x)},${Math.round(d.y)} from ${x},${b}`);}}
      for(const id of ids){const d=w.drops.get(id);if(!d)lost++;else if(d.rest)rested++;w.objects.get(id)?.destroy();w.objects.delete(id);w.drops.delete(id);}
      s.session.badges.scattered.clear();
    }
    return{spots:spots.length,rested,lost,bad:[...new Set(bad)].slice(0,8),inside:[...L.badges,...L.powerups].filter((b:any)=>t.solidAt(b.x,b.y,16,16)).map((b:any)=>b.id).concat(s.enemies.enemies.filter((e:any)=>t.solidAt(e.x+e.w/2,e.y+e.h/2,e.w-4,e.h-4)).map((e:any)=>e.id))};
  });
  expect(r.spots).toBeGreaterThan(20);expect(r.bad).toEqual([]);expect(r.inside).toEqual([]);expect(r.rested).toBeGreaterThan(r.spots*6);
});
