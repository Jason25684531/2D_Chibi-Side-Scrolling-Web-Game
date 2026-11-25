import {test,expect,type Page} from '@playwright/test';
// Running right on a long clear floor: how evenly do the camera and the character advance per rendered frame?
// A 24 Hz logic on a 60 Hz display without interpolation moves on ~40% of frames and holds still on the rest.
async function sampleMotion(page:Page,query:string){
  await page.goto('/?debug=1'+query);await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  // First 640 px of clear, supported floor past x 600, so neither a wall nor the left camera clamp ends the sample.
  await page.evaluate(()=>{
    const s=(window as any).__gameplay,w=s.body.width,h=s.body.height,ok=(x:number,y:number)=>s.terrain.supports(x,y+h/2,w)&&s.terrain.clear(x,y,w,h);
    for(let y=16;y<s.level.height;y+=16)for(let x=600;x<s.level.width-640;x+=16)
      if(Array.from({length:20},(_,i)=>ok(x+i*32,y)).every(Boolean)){s.session.damage.immuneUntil=1e9;s.body.reset(x,y);s.cameraManager.reset(x,y+h/2);return;}
    throw new Error('no flat stretch');
  });
  await page.waitForFunction(()=>(window as any).__gameplay.body.blocked.down);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);
  const r=await page.evaluate(()=>new Promise<{cam:number[];hero:number[];hits:number}>(done=>{
    const s=(window as any).__gameplay,cam:number[]=[],hero:number[]=[],hits=s.session.stats.damage+s.session.stats.respawns;
    const f=()=>{cam.push(s.cameras.main.scrollX);hero.push(s.presentation.sprite.x);cam.length<60?requestAnimationFrame(f):done({cam,hero,hits:s.session.stats.damage+s.session.stats.respawns-hits});};
    requestAnimationFrame(f);
  }));
  await page.keyboard.up('ArrowRight');
  const stats=(xs:number[])=>{const d=xs.slice(1).map((x,i)=>x-xs[i]),mean=d.reduce((a,b)=>a+b,0)/d.length;
    return{mean:+mean.toFixed(2),cv:+(Math.sqrt(d.reduce((a,b)=>a+(b-mean)**2,0)/d.length)/Math.abs(mean||1)).toFixed(2),still:+(d.filter(v=>Math.abs(v)<.01).length/d.length).toFixed(2)};};
  return{cam:stats(r.cam),hero:stats(r.hero),hits:r.hits};
}
test('the character and the camera advance on every rendered frame at the 24 Hz logic rate',async({page})=>{
  const m24=await sampleMotion(page,''),m60=await sampleMotion(page,'&hz=60');
  console.log('24Hz',JSON.stringify(m24),'| 60Hz',JSON.stringify(m60));
  expect(m24.hits).toBe(0);expect(m24.hero.mean).toBeGreaterThan(2);
  expect(m24.hero.still).toBeLessThan(.1);expect(m24.cam.still).toBeLessThan(.1);
});
test('a respawn is drawn as a cut: the first frame after it already shows the safe point',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(500);
  const r=await page.evaluate(()=>new Promise<{drawn:number;body:number;before:number}>(done=>{
    const s=(window as any).__gameplay,before=s.presentation.sprite.x;
    s.events.once('postupdate',()=>{s.respawner.safe={...s.level.start};s.respawn('pit');});
    requestAnimationFrame(()=>requestAnimationFrame(()=>done({drawn:s.presentation.sprite.x,body:s.player.x,before})));
  }));
  await page.keyboard.up('ArrowRight');
  expect(r.before-r.body).toBeGreaterThan(64);expect(Math.abs(r.drawn-r.body)).toBeLessThan(12);
});
test('a thrown item moves on every rendered frame, not only on logic steps',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.session.damage.immuneUntil=1e9;s.session.power.armed=true;});
  await page.keyboard.press('KeyC');await page.waitForFunction(()=>(window as any).__gameplay.enemies.bolts.length>0);
  const xs=await page.evaluate(()=>new Promise<number[]>(done=>{const s=(window as any).__gameplay,xs:number[]=[];
    const f=()=>{const b=s.enemies.bolts[0];if(b)xs.push(b.image.x);b&&xs.length<12?requestAnimationFrame(f):done(xs);};requestAnimationFrame(f);}));
  const d=xs.slice(1).map((x,i)=>x-xs[i]);
  expect(d.length).toBeGreaterThan(6);expect(d.filter(v=>Math.abs(v)<.01).length).toBe(0);
});
test('patrolling enemies and a badge pulled by the ROG logo move on every rendered frame',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const r=await page.evaluate(()=>new Promise<{ex:number[][];pull:number[]}>(done=>{
    const s=(window as any).__gameplay;s.session.damage.immuneUntil=1e9;
    const b=[...s.badges.objects.values()][0];s.body.reset(b.x-80,b.y);s.session.activate('ally','test');
    const ex:number[][]=s.enemies.enemies.map(()=>[]),pull:number[]=[];
    const f=()=>{s.enemies.enemies.forEach((e:any,i:number)=>ex[i].push(e.sprite.x));if(s.badges.objects.has([...s.badges.objects.keys()][0])&&s.badges.objects.get([...s.badges.objects.keys()][0])===b)pull.push(b.x);ex[0].length<60?requestAnimationFrame(f):done({ex,pull});};
    requestAnimationFrame(f);
  }));
  const still=(xs:number[])=>{const d=xs.slice(1).map((x,i)=>x-xs[i]);return d.filter(v=>Math.abs(v)<.01).length/d.length;};
  const moving=r.ex.map(still).filter(v=>v<.95);
  expect(moving.length).toBeGreaterThan(3);for(const v of moving)expect(v).toBeLessThan(.1);
  expect(r.pull.length).toBeGreaterThan(4);expect(still(r.pull)).toBeLessThan(.2);
});
