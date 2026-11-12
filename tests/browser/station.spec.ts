import {test,expect} from '@playwright/test';
import {driveRoute} from './route';
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
test('M5 three-step readiness (character → attack item → nickname), Back, no P2 screen and isolated tutorial',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('[data-screen=P0]')).toBeVisible();
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P1] .character-card')).toHaveCount(5);await expect(page.locator('.character-card.locked:disabled')).toHaveCount(2);await expect(page.locator('[data-action=ready]')).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.locator('.item-card')).toHaveCount(5);
  await page.keyboard.press('Backspace');await expect(page.locator('.character-card')).toHaveCount(5);
  await page.keyboard.press('KeyZ');await expect(page.locator('.item-card')).toHaveCount(5);
  await page.keyboard.press('Enter');await expect(page.locator('#nickname')).toHaveValue(/^PLYR\d{4}$/);await expect(page.locator('#nickname')).toHaveAttribute('maxlength','8');
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P3]')).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__station.flow.flow)).toBe('P3');
  await page.waitForFunction(()=>(window as any).__gameplay?.session?.tutorial);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.up('ArrowRight');await page.keyboard.press('KeyZ');
  const tutorialId=await page.evaluate(()=>{const s=(window as any).__gameplay;s.session.credit('tutorial');return s.run.runId;});
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return{score:s.session.score.total,combo:s.session.combo.count,time:s.run.remaining};})).toEqual({score:0,combo:0,time:120});
  // No time limit: a long stay never counts down; Enter starts one 3-2-1 and Z keeps jumping during it.
  await page.evaluate(()=>{(window as any).__station.entered=performance.now()-60000;});await page.waitForTimeout(500);
  await expect(page.locator('#countdown')).toHaveText('');expect(await page.evaluate(()=>(window as any).__station.flow.flow)).toBe('P3');
  await page.waitForFunction(()=>(window as any).__gameplay.body.blocked.down);
  await page.keyboard.press('Enter');await expect(page.locator('#countdown')).toHaveText(/^[123]$/);await expect(page.locator('[data-action=start-game]')).toBeDisabled();
  await page.keyboard.press('KeyZ');await page.waitForFunction(()=>(window as any).__gameplay.body.velocity.y<0);
  await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
  expect(await page.evaluate((old)=>{const s=(window as any).__gameplay;return s.run.runId!==old&&s.run.duration===120&&!s.session.tutorial&&s.session.score.total===0&&s.session.stats.kills===0;},tutorialId)).toBe(true);
  expect(errors).toEqual([]);
});

test('M6 full keyboard Goal flow, screenshots, result wait, replay resets and queue exit',async({page})=>{
  test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const external:string[]=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!=='http://127.0.0.1:5183')external.push(r.url());});
  const shot=async(name:string)=>{
    await page.screenshot({path:`docs/evidence/uiux-screens/${name}.png`});
    expect(await page.locator('.screen button,.screen .panel').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.height&&(r.left<90||r.right>1830||r.top<48||r.bottom>1032);}).map(n=>n.textContent?.slice(0,80))),name+' safe area').toEqual([]);
  };
  await page.goto('/');await expect(page.locator('[data-screen=P0]')).toBeVisible();await shot('P0');
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P1]')).toBeVisible();await shot('P1-character');
  await page.keyboard.press('Enter');await expect(page.locator('.item-card')).toHaveCount(5);await shot('P1-item');
  await page.keyboard.press('Enter');await expect(page.locator('#nickname')).toBeVisible();await shot('P1-nickname');
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P3]')).toBeVisible();await page.waitForFunction(()=>(window as any).__gameplay?.session?.tutorial);await page.waitForTimeout(1000);await shot('P3');
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});await page.waitForTimeout(100);await shot('P4');
  await driveRoute(page,80000);expect(await page.evaluate(()=>({result:(window as any).__gameplay.session.result,x:(window as any).__gameplay.player.x}))).toMatchObject({result:{endReason:'goal'}});await expect(page.locator('[data-screen=P5]')).toBeVisible();await shot('P5-goal');
  const r=await page.evaluate(()=>(window as any).__gameplay.session.result);expect(r.endReason).toBe('goal');
  await expect(page.locator('[data-screen=P6]')).toBeVisible({timeout:7000});await shot('P6');
  await page.waitForTimeout(500);await expect(page.locator('[data-screen=P6]')).toBeVisible();
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P7]')).toBeVisible();
  // Replay is on by default (PO 2026-11-04); focus still defaults to EXIT.
  await expect(page.locator('[data-action=exit]')).toBeFocused();await expect(page.locator('[data-action=replay]')).toBeEnabled();await shot('P7');
  await page.keyboard.press('ArrowLeft');await expect(page.locator('[data-action=replay]')).toBeFocused();await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
  const replay=await page.evaluate(()=>{const s=(window as any).__gameplay;return{id:s.run.runId,tier:s.run.duration,score:s.session.score.total,badges:s.session.badges.held,ledger:s.run.scoredEnemyIds.size};});
  expect(replay).toEqual({id:expect.any(String),tier:120,score:0,badges:0,ledger:0});expect(replay.id).not.toBe(r.runId);
  await page.keyboard.press('KeyH');await expect(page.locator('.modal')).toBeVisible();
  const paused=await page.evaluate(()=>(window as any).__gameplay.run.remaining);await page.waitForTimeout(200);expect(await page.evaluate(()=>(window as any).__gameplay.run.remaining)).toBe(paused);
  await page.keyboard.press('ArrowLeft');await expect(page.locator('.modal [data-action=controls]')).toBeFocused();await page.keyboard.press('ArrowLeft');await expect(page.locator('.modal [data-action=exit]')).toBeFocused();await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen=P0]')).toBeVisible();expect(await page.evaluate(()=>(window as any).__station.adapter.queue.length)).toBe(0);
  await expect(page.locator('[data-screen=P0] .wall')).toBeVisible();await expect(page.getByRole('heading',{name:'TOP 20 / 120 秒'})).toBeVisible();
  await page.screenshot({path:'docs/evidence/uiux-screens/P0-ranking.png'});
  expect(errors).toEqual([]);expect(external).toEqual([]);
});

test('Time Up presentation, generating readiness, simulated pad through three steps and once-only result',async({page})=>{
  test.setTimeout(30000);await page.goto('/');await expect(page.locator('[data-screen=P0]')).toBeVisible();
  await page.evaluate(()=>{const u=(window as any).__station;u.adapter.enqueue('測試玩家');u.adapter.current.assetState='generating';});
  await expect(page.locator('[data-screen=P1]')).toBeVisible();await expect(page.locator('[data-action=ready]')).toBeDisabled();
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P1]')).toBeVisible();
  await page.evaluate(()=>{(window as any).__station.adapter.current.assetState='fallback';});await expect(page.locator('[data-action=ready]')).toBeFocused();
  const press=async(index:number)=>{await page.evaluate(i=>{(window as any).__station.testPad={mapping:'standard',axes:[0],buttons:Array.from({length:16},(_,j)=>({pressed:j===i}))};},index);await page.waitForTimeout(70);await page.evaluate(()=>{(window as any).__station.testPad=null;});await page.waitForTimeout(70);};
  await press(0);await expect(page.locator('.item-card')).toHaveCount(5);await expect(page.locator('[data-action=ready]')).toBeFocused();await press(0);
  await expect(page.locator('#nickname')).toBeVisible();await press(0);
  await page.waitForFunction(()=>(window as any).__gameplay?.session?.tutorial);await page.keyboard.press('Enter');
  await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
  // P4 renders one frame before scene.restart() swaps the tutorial run for the real one; wait for the real run.
  await page.waitForFunction(()=>{const s=(window as any).__gameplay;return !s.session.tutorial&&s.run.phase==='running';});
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.run.elapsed=s.run.duration-.05;});
  await expect(page.locator('[data-screen=P5]')).toBeVisible();await expect(page.getByRole('heading',{name:'時間到！'})).toBeVisible();await page.screenshot({path:'docs/evidence/uiux-screens/P5-time-up.png'});
  await expect(page.locator('[data-screen=P6]')).toBeVisible({timeout:5000});
  expect(await page.evaluate(()=>{const u=(window as any).__station;u.adapter.save(u.result);return{count:u.adapter.records.length,tier:u.result.timeTier,goal:u.result.scoreBreakdown.goal};})).toEqual({count:1,tier:'120',goal:0});
});
test('split CTA: BACK steps back, then leaves the queue from step 1; PLAY re-enters with NEXT focused',async({page})=>{
  await page.goto('/');await expect(page.locator('[data-action=demo]')).toContainText('PLAY');
  await page.keyboard.press('Enter');await expect(page.locator('[data-action=ready]')).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.locator('.item-card')).toHaveCount(5);await expect(page.locator('[data-action=ready]')).toBeFocused();
  await page.keyboard.press('ArrowLeft');await expect(page.locator('[data-action=prev]')).toBeFocused();await page.keyboard.press('Enter');
  await expect(page.locator('.character-card')).toHaveCount(5);await expect(page.locator('[data-action=ready]')).toBeFocused();
  await page.locator('[data-action=prev]').click();
  await expect(page.locator('[data-screen=P0]')).toBeVisible();expect(await page.evaluate(()=>(window as any).__station.adapter.queue.length)).toBe(0);
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P1]')).toBeVisible();await page.keyboard.press('Backspace');await expect(page.locator('[data-screen=P0]')).toBeVisible();
});
test('window blur during a station run opens the system menu instead of a silent pause',async({page})=>{
  await page.goto('/');await page.waitForFunction(()=>!!(window as any).__station?.game.registry.get('assetsReady'));
  await page.evaluate(()=>{const u=(window as any).__station;u.adapter.enqueue();u.go('P1');u.go('P2');u.go('P3');u.go('P4');u.start();});
  await page.waitForFunction(()=>(window as any).__gameplay?.run?.phase==='running');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(page.locator('.modal.screen [data-action=continue]')).toBeFocused();
  expect(await page.evaluate(()=>(window as any).__gameplay.run.phase)).toBe('paused');
});

test('P0 shows the wall and TOP 20 together; the board flips page every 10 s',async({page})=>{
  await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({schemaVersion:1,records:Array.from({length:12},(_,i)=>({runId:`w-${i}`,nickname:'Player '+i,score:1000-i,tier:'120',titles:[],characterId:'a'}))})),'rog-future-gamer.records.v1');
  await page.goto('/');await expect(page.locator('[data-screen=P0] .wcard.empty')).toContainText('成為下一位');
  await expect(page.getByRole('heading',{name:'TOP 20 / 120 秒'})).toBeVisible();await expect(page.locator('.top20 .rank-row')).toHaveCount(10);
  await page.evaluate(()=>{(window as any).__station.entered=performance.now()-10100;});
  await expect(page.locator('.top20 .rank-row')).toHaveCount(2);await expect(page.locator('.top20 .rank-row b').first()).toHaveText('11');
  await expect(page.locator('[data-screen=P0] .wall')).toBeVisible();
  await page.evaluate(()=>{(window as any).__station.entered=performance.now()-20100;});
  await expect(page.locator('.top20 .rank-row b').first()).toHaveText('01');
});
test('operator time setting cycles in the P0 system menu, re-labels the board and survives a reload',async({page})=>{
  await page.goto('/');await expect(page.getByRole('heading',{name:'TOP 20 / 120 秒'})).toBeVisible();
  await page.keyboard.press('KeyH');await page.locator('[data-action=settings-time]').click();
  await expect(page.locator('[data-action=settings-time]')).toContainText('遊戲時間：60 秒');
  await page.keyboard.press('Backspace');await expect(page.getByRole('heading',{name:'TOP 20 / 60 秒'})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'TOP 20 / 60 秒'})).toBeVisible();
  await page.evaluate(()=>{const u=(window as any).__station;u.adapter.enqueue();u.go('P1');u.go('P2');u.go('P3');u.go('P4');u.start();});
  await page.waitForFunction(()=>(window as any).__gameplay?.run?.duration===60);
});
test('replay stays on by default; operator can turn it off, and the setting survives a reload',async({page})=>{
  await page.goto('/');await expect(page.locator('.chip').first()).toContainText('Replay 開啟');
  await page.keyboard.press('KeyH');await page.locator('[data-action=settings-replay]').click();await expect(page.locator('[data-action=settings-replay]')).toContainText('關閉');
  await page.reload();await expect(page.locator('.chip').first()).toContainText('Replay 關閉');
});
test('records panel: delete one row and reset all, each only on the second press',async({page})=>{
  await page.addInitScript(key=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({schemaVersion:1,records:[0,1,2].map(i=>({runId:`r-${i}`,nickname:'P'+i,score:300-i,tier:'120',titles:[],completedAt:'2026-11-04T10:00:00Z'}))}));},'rog-future-gamer.records.v1');
  await page.goto('/');await page.keyboard.press('KeyH');await page.locator('[data-action=records]').click();
  await expect(page.locator('.records .record-list .btn')).toHaveCount(3);
  await page.locator('[data-action=delete-r-1]').click();await expect(page.locator('.records .record-list .btn')).toHaveCount(3);
  await expect(page.locator('[data-action=delete-r-1]')).toContainText('再按一次刪除');await page.locator('[data-action=delete-r-1]').click();
  await expect(page.locator('.records .record-list .btn')).toHaveCount(2);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('rog-future-gamer.records.v1')!).records.map((r:any)=>r.runId))).toEqual(['r-0','r-2']);
  await page.locator('[data-action=clear-records]').click();await page.locator('[data-action=clear-records]').click();
  await expect(page.locator('.records .empty-state')).toBeVisible();
  await page.keyboard.press('Backspace');await expect(page.locator('[data-action=records]')).toBeFocused();
  await page.reload();await expect(page.locator('.top20 .empty-state')).toBeVisible();
});
