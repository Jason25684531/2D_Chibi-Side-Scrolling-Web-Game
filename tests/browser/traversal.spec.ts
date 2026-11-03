import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {driveRoute} from './route';
test('full 1102 level traversal Start → zigzag → middle row → elevator → Goal with simulated pad, no teleport',async({page})=>{
  test.setTimeout(120000);const warnings:string[]=[];page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('[level-art]'))warnings.push(m.text());});
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(()=>{const f:number[]=(window as any).__frames=[];let last=performance.now();const tick=(now:number)=>{f.push(now-last);last=now;if(!(window as any).__gameplay.session.result)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  const trail:string[]=[];const timer=setInterval(()=>page.evaluate(()=>JSON.stringify((window as any).__route?.())).then(v=>trail.push(v)).catch(()=>{}),1000);
  await driveRoute(page,95000).catch(e=>{throw new Error(e.message+' TRAIL '+trail.join(' | '));}).finally(()=>clearInterval(timer));
  await page.screenshot({path:'docs/evidence/gameplay-goal.png'});
  const final=await page.evaluate(()=>{const s=(window as any).__gameplay,f=[...(window as any).__frames].sort((a:number,b:number)=>a-b);return{result:s.session.result,respawns:s.session.stats.respawns,frames:{count:f.length,median:f[f.length>>1],p95:f[Math.floor(f.length*.95)],max:f[f.length-1]}};});
  expect(final.result?.endReason,JSON.stringify({final,trail})).toBe('goal');
  await mkdir('docs/evidence',{recursive:true});
  await writeFile('docs/evidence/cyber-run-traversal.json',JSON.stringify({scope:'headless Chromium, ?debug=1, full 1102 level by simulated pad',playTime:final.result.duration-final.result.remainingTime,respawns:final.respawns,frameMs:final.frames,missingArtWarnings:warnings},null,2));
  expect(warnings).toEqual([]);
});
