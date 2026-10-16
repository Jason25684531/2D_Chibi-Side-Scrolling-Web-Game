import {test,expect} from '@playwright/test';
test.use({viewport:{width:1920,height:1080}});
test('Home traps focus before a run and above Replay countdown; Back restores flow',async({page})=>{
  await page.goto('/');await page.waitForFunction(()=>!!(window as any).__station?.game.registry.get('assetsReady'));
  await page.keyboard.press('KeyH');await expect(page.locator('.modal.screen [data-action=exit]')).toBeFocused();
  await page.keyboard.press('Backspace');await expect(page.locator('.modal.screen')).toHaveCount(0);
  await page.evaluate(()=>{const u=(window as any).__station;u.adapter.enqueue();u.go('P1');u.go('P2');u.go('P3');u.go('P4');u.start();});
  await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(()=>{const u=(window as any).__station;u.result=u.scene.session.finish('goal');u.go('P5');u.go('P6');u.go('P7');u.adapter.replayEnabled=true;u.act('replay');});
  await page.keyboard.press('KeyH');await expect(page.locator('.modal.screen [data-action=continue]')).toBeFocused();
  await page.keyboard.press('ArrowRight');await expect(page.locator('.modal.screen [data-action=exit]')).toBeFocused();
  await page.keyboard.press('Backspace');await expect(page.locator('.modal.screen')).toHaveCount(0);
  await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
});
test('M5 keyboard readiness, tier focus, Back and isolated minimum-duration tutorial',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('[data-screen=P0]')).toBeVisible();
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P1]')).toBeVisible();
  await page.keyboard.press('Enter');await expect(page.locator('[data-action=tier-90]')).toBeFocused();
  await page.keyboard.press('Backspace');await expect(page.locator('[data-screen=P1]')).toBeVisible();
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P2]')).toBeVisible();await page.keyboard.press('ArrowLeft');await expect(page.locator('[data-action=tier-60]')).toBeFocused();
  const entered=Date.now();await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P3]')).toBeVisible();
  await page.waitForFunction(()=>(window as any).__gameplay?.session?.tutorial);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.up('ArrowRight');await page.keyboard.press('Space');
  const tutorialId=await page.evaluate(()=>{const s=(window as any).__gameplay;s.session.credit('tutorial','melee');return s.run.runId;});
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return{score:s.session.score.total,combo:s.session.combo.count,time:s.run.remaining};})).toEqual({score:0,combo:0,time:60});
  await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:15000});expect(Date.now()-entered).toBeGreaterThanOrEqual(11000);
  expect(await page.evaluate((old)=>{const s=(window as any).__gameplay;return s.run.runId!==old&&s.run.duration===60&&!s.session.tutorial&&s.session.score.total===0&&s.session.stats.kills===0;},tutorialId)).toBe(true);
  expect(errors).toEqual([]);
});

test('M6 full keyboard Goal flow, screenshots, result wait, replay resets and queue exit',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const external:string[]=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!=='http://127.0.0.1:5183')external.push(r.url());});
  const shot=async(name:string)=>{
    await page.screenshot({path:`docs/evidence/uiux-screens/${name}.png`});
    expect(await page.locator('.screen button,.screen .panel').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.height&&(r.left<90||r.right>1830||r.top<48||r.bottom>1032);}).map(n=>n.textContent?.slice(0,80))),name+' safe area').toEqual([]);
  };
  await page.goto('/');await expect(page.locator('[data-screen=P0]')).toBeVisible();await shot('P0');
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P1]')).toBeVisible();await shot('P1');
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P2]')).toBeVisible();await shot('P2');
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P3]')).toBeVisible();await page.waitForTimeout(1000);await shot('P3');
  await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:15000});await page.waitForTimeout(100);await shot('P4');
  await page.keyboard.down('ArrowRight');
  for(let n=0;n<150;n++){
    if(n%2===0)await page.keyboard.press('ShiftLeft');
    await page.keyboard.down('Space');await page.waitForTimeout(330);await page.keyboard.up('Space');await page.waitForTimeout(80);
    if(await page.evaluate(()=>!!(window as any).__gameplay.session.result))break;
  }
  await page.keyboard.up('ArrowRight');expect(await page.evaluate(()=>({result:(window as any).__gameplay.session.result,x:(window as any).__gameplay.player.x}))).toMatchObject({result:{endReason:'goal'}});await expect(page.locator('[data-screen=P5]')).toBeVisible();await shot('P5-goal');
  const r=await page.evaluate(()=>(window as any).__gameplay.session.result);expect(r.endReason).toBe('goal');
  await expect(page.locator('[data-screen=P6]')).toBeVisible({timeout:7000});await shot('P6');
  await page.waitForTimeout(500);await expect(page.locator('[data-screen=P6]')).toBeVisible();
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P7]')).toBeVisible();
  await expect(page.locator('[data-action=exit]')).toBeFocused();await expect(page.locator('[data-action=replay]')).toBeDisabled();await shot('P7');
  await page.keyboard.press('ArrowLeft');await expect(page.locator('[data-action=exit]')).toBeFocused();
  await page.evaluate(()=>{const u=(window as any).__station;u.adapter.replayEnabled=true;u.render();});
  await page.keyboard.press('ArrowLeft');await expect(page.locator('[data-action=replay]')).toBeFocused();await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
  const replay=await page.evaluate(()=>{const s=(window as any).__gameplay;return{id:s.run.runId,tier:s.run.duration,score:s.session.score.total,badges:s.session.badges.held,ledger:s.run.scoredEnemyIds.size};});
  expect(replay).toEqual({id:expect.any(String),tier:90,score:0,badges:0,ledger:0});expect(replay.id).not.toBe(r.runId);
  await page.keyboard.press('KeyH');await expect(page.locator('.modal')).toBeVisible();
  const paused=await page.evaluate(()=>(window as any).__gameplay.run.remaining);await page.waitForTimeout(200);expect(await page.evaluate(()=>(window as any).__gameplay.run.remaining)).toBe(paused);
  await page.keyboard.press('ArrowLeft');await expect(page.locator('.modal [data-action=exit]')).toBeFocused();await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen=P0]')).toBeVisible();expect(await page.evaluate(()=>(window as any).__station.adapter.queue.length)).toBe(0);
  await page.evaluate(()=>{const u=(window as any).__station;u.entered=performance.now()-20500;});
  await expect(page.getByRole('heading',{name:'TOP 20 / 60 秒'})).toBeVisible();
  await page.screenshot({path:'docs/evidence/uiux-screens/P0-ranking.png'});
  expect(errors).toEqual([]);expect(external).toEqual([]);
});

test('Time Up presentation, generating readiness, simulated pad and tiered once-only results',async({page})=>{
  test.setTimeout(30000);await page.goto('/');await expect(page.locator('[data-screen=P0]')).toBeVisible();
  await page.evaluate(()=>{const u=(window as any).__station;u.adapter.enqueue('測試玩家');u.adapter.current.assetState='generating';});
  await expect(page.locator('[data-screen=P1]')).toBeVisible();await expect(page.locator('[data-action=ready]')).toBeDisabled();
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P1]')).toBeVisible();
  await page.evaluate(()=>{(window as any).__station.adapter.current.assetState='fallback';});await expect(page.locator('[data-action=ready]')).toBeFocused();
  const press=async(index:number)=>{await page.evaluate(i=>{(window as any).__station.testPad={axes:[0],buttons:Array.from({length:16},(_,j)=>({pressed:j===i}))};},index);await page.waitForTimeout(70);await page.evaluate(()=>{(window as any).__station.testPad=null;});await page.waitForTimeout(70);};
  await press(0);await expect(page.locator('[data-screen=P2]')).toBeVisible();await press(15);await expect(page.locator('[data-action=tier-120]')).toBeFocused();await press(0);
  await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:15000});
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.run.elapsed=s.run.duration-.05;});
  await expect(page.locator('[data-screen=P5]')).toBeVisible();await expect(page.getByRole('heading',{name:'時間到！'})).toBeVisible();await page.screenshot({path:'docs/evidence/uiux-screens/P5-time-up.png'});
  await expect(page.locator('[data-screen=P6]')).toBeVisible({timeout:5000});
  expect(await page.evaluate(()=>{const u=(window as any).__station;u.adapter.save(u.result);return{count:u.adapter.records.length,tier:u.result.timeTier,goal:u.result.scoreBreakdown.goal};})).toEqual({count:1,tier:'120',goal:0});
});
