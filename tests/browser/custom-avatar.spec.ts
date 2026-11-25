import {test,expect,type Page,type Route} from '@playwright/test';
import {readFileSync} from 'node:fs';
test.use({viewport:{width:1920,height:1080}});

/** 1280×720 fake camera: left half red, right half blue, so a mirrored capture is detectable. Tracks every camera track. */
const fakeCamera=()=>{
  const live:MediaStreamTrack[]=[];(window as any).__tracks=live;
  navigator.mediaDevices.getUserMedia=async()=>{
    const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d')!;
    const paint=()=>{g.fillStyle='#f00';g.fillRect(0,0,640,720);g.fillStyle='#00f';g.fillRect(640,0,640,720);};paint();setInterval(paint,100);
    const s=c.captureStream(10);live.push(...s.getTracks());return s;
  };
};
const liveTracks=(page:Page)=>page.evaluate(()=>(window as any).__tracks.filter((t:MediaStreamTrack)=>t.readyState==='live').length);
const current=(page:Page)=>page.evaluate(()=>{const c=(window as any).__station.adapter.current;return c&&{state:c.generation.state,role:c.characterId,photo:!!c.photo};});

type Comfy={online:boolean;hang?:boolean;status:Record<string,'pending'|'success'|'error'>;uploads:number;prompts:any[];deleted:string[];interrupted:string[]};
/** Stands in for ComfyUI behind /comfy; results are served from assest/preset_<role> so the manifest and sheets are real. */
async function comfy(page:Page){
  const s:Comfy={online:true,status:{},uploads:0,prompts:[],deleted:[],interrupted:[]};
  await page.route(url=>url.pathname.startsWith('/comfy/'),async(route:Route)=>{
    const url=new URL(route.request().url()),path=url.pathname.replace('/comfy','');
    if(!s.online)return route.fulfill({status:502});
    if(path==='/system_stats')return route.fulfill({json:{system:{}}});
    if(path==='/upload/image'){s.uploads++;const name=/filename="([^"]+)"/.exec(route.request().postDataBuffer()!.toString('latin1'))![1];return route.fulfill({json:{name,subfolder:'station',type:'input'}});}
    if(path==='/prompt'){const id='prompt-'+(s.prompts.length+1);s.prompts.push(route.request().postDataJSON().prompt);s.status[id]='pending';return route.fulfill({json:{prompt_id:id,number:1,node_errors:{}}});}
    if(path.startsWith('/history/')&&s.hang)return; // ComfyUI that accepts the request and never answers
    if(path.startsWith('/history/')){const id=path.slice(9),st=s.status[id];return route.fulfill({json:!st||st==='pending'?{}:{[id]:{status:{status_str:st,completed:true}}}});}
    if(path==='/queue'){s.deleted.push(...route.request().postDataJSON().delete);return route.fulfill({json:{}});}
    if(path==='/interrupt'){s.interrupted.push(route.request().postDataJSON().prompt_id);return route.fulfill({json:{}});}
    if(path==='/view'){
      const sub=url.searchParams.get('subfolder')!,m=/^Taskforce_2028_Platformer\/P[0-9a-f]{12}_(S\w{3})(?:\/(.*))?$/.exec(sub)!;
      return route.fulfill({body:readFileSync(`assest/preset_${m[1]}/${m[2]}/${url.searchParams.get('filename')}`),contentType:sub.endsWith('manifest')?'application/json':'image/png'});
    }
    return route.fulfill({status:404});
  });
  return s;
}
/** P0 → P1, pick body `role` (also the ComfyUI template), then the photo step. */
async function toPhoto(page:Page,role='S2AM'){
  await page.goto('/');await page.keyboard.press('Enter');
  await page.locator(`[data-action=character-${role}]`).click();await expect(page.locator(`[data-action=character-${role}]`)).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-action=ready]').click();await expect(page.locator('.booth')).toBeVisible();
}
async function shoot(page:Page){
  await page.waitForFunction(()=>(document.querySelector('video.live') as HTMLVideoElement)?.videoWidth>0);
  await page.locator('[data-action=shoot]').click();await expect(page.locator('.viewfinder img')).toBeVisible();
}
/** Photo step → photo → submit → item → nickname → P3 sandbox running. */
async function submitAndEnterP3(page:Page,role='S2AM'){
  await toPhoto(page,role);await shoot(page);
  for(let i=0;i<3;i++)await page.locator('[data-action=ready]').click();
  await page.waitForFunction(()=>(window as any).__gameplay?.session?.tutorial&&(window as any).__station.flow.flow==='P3');
}

test('UC02-1 → UC03-1: no CUSTOM card; after the body the player may skip the photo and play that body without ComfyUI',async({page})=>{
  await page.addInitScript(fakeCamera);const s=await comfy(page);
  await page.goto('/');await page.keyboard.press('Enter');
  await expect(page.locator('.character-card')).toHaveCount(4);await expect(page.locator('[data-action=character-custom]')).toHaveCount(0);
  await expect(page.locator('.steps li')).toHaveCount(4);
  await page.locator('[data-action=character-S3WW]').click();await page.locator('[data-action=ready]').click();
  await expect(page.locator('.booth .prompt')).toContainText('要拍照生成專屬角色嗎？');
  await expect(page.locator('.cards')).toHaveCount(0);
  await expect(page.locator('[data-action=shoot]')).toBeFocused();
  await expect(page.locator('#ready-label')).toHaveText('跳過拍照');
  await page.locator('[data-action=ready]').click();await expect(page.locator('.item-card')).toHaveCount(5);
  expect(await liveTracks(page)).toBe(0);
  for(let i=0;i<2;i++)await page.locator('[data-action=ready]').click();
  await expect(page.locator('[data-screen=P3]')).toBeVisible();
  await expect(page.locator('[data-action=start-game]')).toBeEnabled({timeout:10000});
  expect(s.uploads+s.prompts.length).toBe(0);
  expect(await current(page)).toEqual({state:'none',role:'S3WW',photo:false});
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
  expect(await page.evaluate(()=>{const p=(window as any).__gameplay.presentation.skin;return{custom:p.custom,role:p.role};})).toEqual({custom:false,role:'S3WW'});
});

test('capture is the unmirrored centre square, retake is free, confirm submits once with the chosen template',async({page})=>{
  await page.addInitScript(fakeCamera);const s=await comfy(page);
  await toPhoto(page,'S1WM');await expect(page.locator('.steps li')).toHaveCount(4);
  await expect(page.locator('.privacy')).toContainText('照片將上傳至 AI 服務生成角色，並暫存於本站台電腦');
  await page.waitForFunction(()=>(document.querySelector('video.live') as HTMLVideoElement)?.videoWidth>0);
  await expect(page.locator('#ready-label')).toHaveText('跳過拍照');
  expect(await page.locator('video.live').evaluate(v=>getComputedStyle(v).transform)).toMatch(/^matrix\(-1/);
  await page.locator('[data-action=shoot]').click();await expect(page.locator('.viewfinder img')).toBeVisible();
  expect(await liveTracks(page)).toBe(0);
  const photo=await page.evaluate(async()=>{
    const img=new Image();img.src=(window as any).__station.adapter.current.photo;await img.decode();
    const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d')!;g.drawImage(img,0,0);
    const px=(x:number)=>Array.from(g.getImageData(x,512,1,1).data.slice(0,3));return{w:img.width,h:img.height,left:px(10),right:px(1013)};
  });
  expect(photo).toEqual({w:1024,h:1024,left:[255,0,0],right:[0,0,255]});
  await expect(page.locator('#ready-label')).toHaveText('生成角色');await expect(page.locator('.booth .prompt')).toContainText('這張可以嗎？');
  await page.locator('[data-action=retake]').click();await expect(page.locator('#ready-label')).toHaveText('跳過拍照');
  await shoot(page);await page.locator('[data-action=retake]').click();await shoot(page);
  expect(s.uploads+s.prompts.length).toBe(0);
  await page.locator('[data-action=ready]').click();await expect(page.locator('.item-card')).toHaveCount(5);
  await expect.poll(()=>s.prompts.length).toBe(1);expect(s.uploads).toBe(1);
  expect(s.prompts[0]['1'].inputs.value).toBe(3);
  expect(s.prompts[0]['2'].inputs.String).toMatch(/^P[0-9a-f]{12}$/);
  expect(s.prompts[0]['3'].inputs.image).toBe(`station/${s.prompts[0]['2'].inputs.String}.png`);
  expect((await current(page))?.state).toBe('generating');
});

test('P3 waits for the custom character, swaps it in place and carries it into the run',async({page})=>{
  test.setTimeout(60000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(fakeCamera);const s=await comfy(page);
  await submitAndEnterP3(page);
  await expect(page.locator('#gen-status')).toContainText('專屬角色生成中');
  await page.waitForFunction(()=>(window as any).__station.game.registry.get('assetsReady'));
  await expect(page.locator('[data-action=start-game]')).toBeDisabled();
  await page.keyboard.press('Enter');await page.waitForTimeout(500);
  await expect(page.locator('[data-screen=P3]')).toBeVisible();expect(await page.evaluate(()=>(window as any).__station.countdownAt)).toBe(0);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(400);await page.keyboard.up('ArrowRight');
  await expect(page.locator('[data-lesson=移動]')).toHaveAttribute('data-state','completed');
  const x=await page.evaluate(()=>(window as any).__gameplay.player.x);
  s.status['prompt-1']='success';
  await page.waitForFunction(()=>(window as any).__gameplay.presentation.skin.custom,null,{timeout:15000});
  await expect(page.locator('#gen-status')).toContainText('專屬角色完成');
  await expect(page.locator('[data-lesson=移動]')).toHaveAttribute('data-state','completed');
  expect(Math.abs(await page.evaluate(()=>(window as any).__gameplay.player.x)-x)).toBeLessThan(40);
  expect(await page.locator('.player .avatar img').getAttribute('src')).toMatch(/^data:image\/webp/);
  await expect(page.locator('[data-action=start-game]')).toBeEnabled();
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
  const run=await page.evaluate(()=>{const p=(window as any).__gameplay.presentation;return{custom:p.skin.custom,role:p.skin.role,key:p.sprite.texture.key};});
  expect(run.custom).toBe(true);expect(run.role).toBe('S2AM');expect(run.key).toMatch(/^P[0-9a-f]{12}\//);
  await page.evaluate(()=>{const u=(window as any).__station;u.result=u.scene.session.finish('goal');u.adapter.save(u.result);});
  const saved=await page.evaluate(()=>{const row=JSON.parse(localStorage.getItem('rog-future-gamer.records.v1')!).records[0];return{row};});
  expect(Object.keys(saved.row).some(k=>/photo|look|skin/.test(k))).toBe(false);expect(saved.row.characterId).toBe('S2AM');
  expect(errors).toEqual([]);
});

test('a failed generation falls back to the preset and unlocks start',async({page})=>{
  await page.addInitScript(fakeCamera);const s=await comfy(page);
  await submitAndEnterP3(page,'S3WW');
  s.status['prompt-1']='error';
  await expect(page.locator('#gen-status')).toContainText('生成未完成，已改用原角色',{timeout:8000});
  await expect(page.locator('[data-action=start-game]')).toBeEnabled();
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
  expect(await page.evaluate(()=>{const p=(window as any).__gameplay.presentation.skin;return{custom:p.custom,role:p.role};})).toEqual({custom:false,role:'S3WW'});
});

test('timeout cancels the job and falls back, even when ComfyUI stops answering',async({page})=>{
  await page.addInitScript(fakeCamera);const s=await comfy(page);
  await submitAndEnterP3(page);s.hang=true;await page.waitForTimeout(2500);
  await page.evaluate(()=>{(window as any).__station.adapter.current.generation.startedAt-=241000;});
  await expect(page.locator('#gen-status')).toContainText('生成未完成，已改用原角色',{timeout:8000});
  expect(s.deleted).toContain('prompt-1');
});

test('retake after submitting cancels the job and ignores its late result',async({page})=>{
  await page.addInitScript(fakeCamera);const s=await comfy(page);
  await toPhoto(page);await shoot(page);
  await page.locator('[data-action=ready]').click();await expect.poll(()=>s.prompts.length).toBe(1);
  await page.locator('[data-action=prev]').click();await page.locator('[data-action=retake]').click();
  expect(s.deleted).toEqual(['prompt-1']);expect(s.interrupted).toEqual(['prompt-1']);
  s.status['prompt-1']='success';await page.waitForTimeout(2500);
  expect((await current(page))?.state).toBe('none');
  await shoot(page);await page.locator('[data-action=ready]').click();
  await expect.poll(()=>s.prompts.length).toBe(2);
  expect(s.prompts[1]['2'].inputs.String).not.toBe(s.prompts[0]['2'].inputs.String);
});

test('capture locks home even after retaking and switching to a preset',async({page})=>{
  await page.addInitScript(fakeCamera);await comfy(page);
  await toPhoto(page);await shoot(page);
  await page.locator('[data-action=retake]').click();
  await page.keyboard.press('KeyH');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('[data-action=exit]')).toHaveCount(0);
  await page.locator('[data-action=continue]').click();
  await page.locator('[data-action=prev]').click();
  await page.locator('[data-action=character-S3WW]').click();
  await expect(page.locator('[data-action=prev]')).toBeDisabled();
  await page.keyboard.press('Backspace');
  await expect(page.locator('[data-screen=P1]')).toBeVisible();
  await expect(page.locator('.name-plate')).toHaveCount(0);
});

test('skip uses the assigned nickname and the generated character stays in training on Back',async({page})=>{
  await page.addInitScript(fakeCamera);const s=await comfy(page);
  await toPhoto(page);await shoot(page);
  await page.locator('[data-action=ready]').click();
  await page.locator('[data-action=ready]').click();
  const nickname=page.locator('#nickname'),assigned=await nickname.inputValue();
  await nickname.fill('draft');
  await page.getByRole('button',{name:'跳過 SKIP'}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen=P3] .who')).toContainText(assigned);
  await expect.poll(()=>s.prompts.length).toBe(1);
  s.status['prompt-1']='success';
  await expect(page.locator('#gen-status')).toContainText('專屬角色完成',{timeout:15000});
  await expect(page.locator('[data-action=exit]')).toHaveCount(0);
  await page.keyboard.press('Backspace');
  await expect(page.locator('[data-screen=P3]')).toBeVisible();
});

test('ComfyUI offline drops the photo step and the chosen body still plays',async({page})=>{
  await page.addInitScript(fakeCamera);const s=await comfy(page);s.online=false;
  await page.goto('/');await page.keyboard.press('Enter');
  await expect(page.locator('.steps li')).toHaveCount(3);
  for(let i=0;i<3;i++)await page.locator('[data-action=ready]').click();
  await expect(page.locator('[data-screen=P3]')).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__tracks.length)).toBe(0);
});

test('denied camera shows the reason and the preset choice still advances',async({page})=>{
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('denied','NotAllowedError'));});await comfy(page);
  await toPhoto(page);
  await expect(page.locator('.viewfinder [role=alert]')).toContainText('未取得攝影機權限');
  await expect(page.locator('[data-action=shoot]')).toBeDisabled();await expect(page.locator('[data-action=ready]')).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.locator('.item-card')).toHaveCount(5);
});

test('character art is never shown above its natural resolution, and the game renders at native 1920x1080',async({page})=>{
  test.setTimeout(45000);await comfy(page);
  await page.goto('/');await page.keyboard.press('Enter');await expect(page.locator('.hero img')).toBeVisible();
  const upscaled=()=>page.evaluate(()=>[...document.querySelectorAll<HTMLImageElement>('#station-ui img')].filter(i=>i.complete&&i.naturalHeight&&i.getBoundingClientRect().height>0)
    .map(i=>({src:i.src.slice(-40),ratio:i.getBoundingClientRect().height/i.naturalHeight})).filter(r=>r.ratio>1.01));
  await page.waitForFunction(()=>[...document.querySelectorAll<HTMLImageElement>('.readiness img')].every(i=>i.complete));
  expect(await upscaled()).toEqual([]);
  for(let i=0;i<4;i++)await page.locator('[data-action=ready]').click();
  await page.waitForFunction(()=>(window as any).__gameplay?.session?.tutorial);
  expect(await upscaled()).toEqual([]);
  expect(await page.evaluate(()=>{const g=(window as any).__gameplay,v=g.cameras.main.worldView;return{canvas:[g.game.canvas.width,g.game.canvas.height],view:[Math.round(v.width),Math.round(v.height)]};})).toEqual({canvas:[1920,1080],view:[620,240]});
  // worldView (used to cull lasers and lamps) must be the area actually drawn, in the sandbox and in the run.
  const drawn=()=>page.evaluate(()=>{const c=(window as any).__gameplay.cameras.main,a=c.getWorldPoint(c.x,c.y),b=c.getWorldPoint(c.x+c.width,c.y+c.height),v=c.worldView;
    return{dx:Math.round(v.x-a.x),dy:Math.round(v.y-a.y),dr:Math.round(v.right-b.x),db:Math.round(v.bottom-b.y)};});
  expect(await drawn()).toEqual({dx:0,dy:0,dr:0,db:0});
  // The sandbox view stops at the slice's right edge instead of showing empty space past it.
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(s.level.width-20,s.player.y);});await page.waitForTimeout(400);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return Math.round(s.cameras.main.worldView.right)<=s.level.width;})).toBe(true);
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
  await page.waitForFunction(()=>!(window as any).__gameplay.session.tutorial);await page.waitForTimeout(200);
  expect(await page.evaluate(()=>{const v=(window as any).__gameplay.cameras.main.worldView;return[Math.round(v.width),Math.round(v.height)];})).toEqual([960,540]);
  expect(await drawn()).toEqual({dx:0,dy:0,dr:0,db:0});
});

test('captured player stays in the run, then any end-of-run exit returns to the start screen',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(fakeCamera);const s=await comfy(page);
  await submitAndEnterP3(page);s.status['prompt-1']='success';
  await page.waitForFunction(()=>(window as any).__gameplay?.presentation?.skin.custom,null,{timeout:15000});
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
  await page.waitForFunction(()=>!(window as any).__gameplay.session.tutorial);
  const pad=async(index:number)=>{await page.evaluate(i=>{(window as any).__gameplay.testPad={mapping:'standard',axes:[0],buttons:Array.from({length:16},(_,j)=>({pressed:j===i}))};},index);await page.waitForTimeout(90);await page.evaluate(()=>{const g=(window as any).__gameplay;if(g)g.testPad=null;(window as any).__station.testPad=null;});await page.waitForTimeout(90);};
  await pad(9);await expect(page.locator('.modal.screen')).toBeVisible();
  await expect(page.locator('.modal.screen [data-action=exit]')).toHaveCount(0);
  await pad(9);await pad(1);
  await expect(page.locator('[data-screen=P4]')).toBeVisible();
  await expect(page.locator('[data-action=exit]')).toHaveCount(0);
  await page.evaluate(()=>{const u=(window as any).__station;u.result=u.scene.session.finish('goal');u.go('P5');});
  await expect(page.locator('[data-action=exit]')).toBeVisible();
  await expect(page.locator('[data-screen=P6]')).toBeVisible({timeout:8000});
  await page.locator('[data-action=result]').click();
  await expect(page.locator('[data-action=exit]')).toContainText('回到主選單');await expect(page.locator('[data-action=exit]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen=P0]')).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__station.adapter.queue.length)).toBe(0);
  expect(errors).toEqual([]);
});
test('reference entry opens settings, ranking and preparation',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.mainvis')).toHaveJSProperty('naturalWidth',1920);
  await page.locator('[data-action=settings]').click();
  await expect(page.getByRole('dialog',{name:'系統選單'})).toBeVisible();
  await page.locator('[data-action=continue]').click();
  await page.locator('[data-action=ranking]').click();
  await page.locator('[data-action=close-ranking]').click();
  await page.locator('[data-action=demo]').click();
  await expect(page.locator('[data-screen=P1]')).toBeVisible();
});
