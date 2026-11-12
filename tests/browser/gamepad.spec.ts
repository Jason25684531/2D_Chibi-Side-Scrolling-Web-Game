import {test,expect,type Page} from '@playwright/test';
test.use({viewport:{width:1920,height:1080}});
/**
 * Mock pad in the W3C standard layout (0 Cross, 1 Circle, 2 Square, 3 Triangle, 5 R1, 9 OPTIONS, 12-15 D-pad),
 * fed through the same InputAdapter path as real hardware. It stays "connected" between presses like a real stick.
 * These prove the mapping and integration logic only; the physical Qanba is HARDWARE PENDING.
 */
const setPad=(page:Page,pressed:number[]=[],axes:number[]=[0,0])=>page.evaluate(({pressed,axes})=>{
  const pad={id:'Mock Stick',mapping:'standard',axes,buttons:Array.from({length:16},(_,i)=>({pressed:pressed.includes(i)}))};
  (window as any).__station.testPad=pad;if((window as any).__gameplay)(window as any).__gameplay.testPad=pad;
},{pressed,axes});
const tap=async(page:Page,index:number)=>{await setPad(page,[index]);await page.waitForTimeout(80);await setPad(page);await page.waitForTimeout(80);};
/** Real hardware is visible before it is pressed; a pad that appears already pressed is latched (see InputAdapter.latch). */
const connect=async(page:Page)=>{await setPad(page);await page.waitForTimeout(100);};
const boot=async(page:Page)=>{await page.goto('/');await page.waitForFunction(()=>!!(window as any).__station?.game.registry.get('assetsReady'));};
const grounded=(page:Page)=>page.waitForFunction(()=>{const s=(window as any).__gameplay;return s?.run?.phase==='running'&&s.body.blocked.down&&s.controller.jumps===0;});
const startRun=async(page:Page)=>{
  await boot(page);await page.evaluate(()=>{const u=(window as any).__station;u.adapter.enqueue();u.go('P1');u.go('P2');u.go('P3');u.go('P4');u.start();});
  await page.waitForFunction(()=>!(window as any).__gameplay?.session?.tutorial);await grounded(page);await connect(page);
};
const focused=(page:Page)=>page.evaluate(()=>(document.activeElement as HTMLElement)?.dataset.action);

test('P3 Input: stick moves, Cross jumps and double jumps, R1 dashes, only Triangle starts the game',async({page})=>{
  await boot(page);await page.evaluate(()=>{const u=(window as any).__station;u.adapter.enqueue();u.go('P1');u.go('P2');u.go('P3');u.start(true);});
  await page.waitForFunction(()=>(window as any).__gameplay?.session?.tutorial);await grounded(page);await connect(page);
  await setPad(page,[],[1,0]);await page.waitForFunction(()=>(window as any).__gameplay.body.velocity.x>50);await setPad(page);
  await setPad(page,[0]);await page.waitForFunction(()=>(window as any).__gameplay.controller.jumps===1);
  await setPad(page);await page.waitForTimeout(50);await setPad(page,[0]);await page.waitForFunction(()=>(window as any).__gameplay.controller.jumps===2);await setPad(page);
  expect(await page.evaluate(()=>(window as any).__station.countdownAt)).toBe(0); // Cross never starts the countdown
  await grounded(page);
  await setPad(page,[5]);await page.waitForFunction(()=>(window as any).__gameplay.controller.state==='DASH');await setPad(page);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return{score:s.session.score.total,flow:(window as any).__station.flow.flow};})).toEqual({score:0,flow:'P3'});
  await grounded(page);await tap(page,3);await expect(page.locator('#countdown')).toHaveText(/^[123]$/);
  await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
});

test('P4 Input: one-frame press jumps exactly once at 24 Hz, hold does not re-jump, move / throw / Home menu work',async({page})=>{
  await startRun(page);
  expect(await page.evaluate(()=>(window as any).__gameplay.fixed.hz)).toBe(24);
  // Press Cross for a single render frame; record the highest jump count seen afterwards.
  await page.evaluate(()=>{
    const s=(window as any).__gameplay,mk=(pressed:number[])=>({id:'Mock Stick',mapping:'standard',axes:[0,0],buttons:Array.from({length:16},(_,i)=>({pressed:pressed.includes(i)}))});
    let frame=0;(window as any).__maxJumps=0;
    const press=()=>{frame++;s.testPad=mk(frame===1?[0]:[]);if(frame>1)s.events.off('preupdate',press);};
    s.events.on('preupdate',press);s.events.on('postupdate',()=>{(window as any).__maxJumps=Math.max((window as any).__maxJumps,s.controller.jumps);});
  });
  await page.waitForFunction(()=>(window as any).__maxJumps===1);await grounded(page);
  expect(await page.evaluate(()=>(window as any).__maxJumps)).toBe(1);
  await setPad(page,[0]);await page.waitForFunction(()=>(window as any).__gameplay.controller.jumps===1);
  await page.waitForFunction(()=>(window as any).__gameplay.body.blocked.down&&(window as any).__gameplay.body.velocity.y>=0);await page.waitForTimeout(300);
  expect(await page.evaluate(()=>({max:(window as any).__maxJumps,now:(window as any).__gameplay.controller.jumps}))).toEqual({max:1,now:0});
  await setPad(page);
  await setPad(page,[],[1,0]);await page.waitForFunction(()=>(window as any).__gameplay.body.velocity.x>50);await setPad(page);
  // Square throws only while the attack item is held.
  await tap(page,2);expect(await page.evaluate(()=>(window as any).__gameplay.session.power.throwReady)).toBe(0);
  await page.evaluate(()=>(window as any).__gameplay.session.activate('laptop','test'));
  await tap(page,2);expect(await page.evaluate(()=>(window as any).__gameplay.session.power.throwReady)).toBeGreaterThan(0);
  // OPTIONS opens the existing system menu; stick down / up moves focus inside it; Circle closes it.
  await tap(page,9);await expect(page.locator('.modal.screen [data-action=continue]')).toBeFocused();
  expect(await page.evaluate(()=>(window as any).__gameplay.run.phase)).toBe('paused');
  await tap(page,13);await expect(page.locator('.modal.screen [data-action=restart]')).toBeFocused();
  await tap(page,12);await expect(page.locator('.modal.screen [data-action=continue]')).toBeFocused();
  await setPad(page,[],[0,1]);await expect(page.locator('.modal.screen [data-action=restart]')).toBeFocused(); // LS mode: the same move on the axis
  await expect(page.locator('.modal.screen [data-action=controls]')).toBeFocused(); // still held: the repeat walks to the last row and stops there
  await setPad(page);
  await tap(page,1);await expect(page.locator('.modal.screen')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).__gameplay.run.phase)).toBe('running');
});

test('one press is consumed once: holding Cross on Restart does not jump, on Home does not start a new session',async({page})=>{
  await startRun(page);
  await tap(page,9);await tap(page,13);await expect(page.locator('.modal.screen [data-action=restart]')).toBeFocused();
  const before=await page.evaluate(()=>(window as any).__gameplay.run.runId);
  await setPad(page,[0]);await page.waitForFunction(old=>{const s=(window as any).__gameplay;return s.run.runId!==old&&s.run.phase==='running';},before);
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>{const c=(window as any).__gameplay.controller;return{jumps:c.jumps,state:c.state};})).toEqual({jumps:0,state:'IDLE'});
  await connect(page);await setPad(page,[0]);await page.waitForFunction(()=>(window as any).__gameplay.controller.jumps===1);await setPad(page); // released and pressed again: jumps
  await grounded(page);
  await tap(page,9);await tap(page,13);await tap(page,13);await expect(page.locator('.modal.screen [data-action=exit]')).toBeFocused();
  await setPad(page,[0]);await expect(page.locator('[data-screen=P0]')).toBeVisible();
  await page.waitForTimeout(600);
  expect(await page.evaluate(()=>{const u=(window as any).__station;return{flow:u.flow.flow,queue:u.adapter.queue.length};})).toEqual({flow:'P0',queue:0});
  await setPad(page);await tap(page,5);await tap(page,2);await tap(page,1); // Dash / Throw / Back never create a session on P0
  expect(await page.evaluate(()=>(window as any).__station.flow.flow)).toBe('P0');
  await tap(page,0);await expect(page.locator('[data-screen=P1]')).toBeVisible(); // a fresh confirm does
});

test('P5 Input Lock, P6 confirm goes to P7 only, P7 Replay Disabled cannot be focused or triggered',async({page})=>{
  await startRun(page);
  await page.evaluate(()=>{const u=(window as any).__station,s=(window as any).__gameplay;u.adapter.replayEnabled=false;s.run.elapsed=s.run.duration-.05;});
  await expect(page.locator('[data-screen=P5]')).toBeVisible();
  const x=await page.evaluate(()=>(window as any).__gameplay.player.x);
  // Dash + hard right during the end sequence: the player must not move and the sequence must run to P6 on its own.
  await setPad(page,[5],[1,0]);await page.waitForTimeout(500);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return{x:s.player.x,vx:s.body.velocity.x,state:s.controller.state,flow:(window as any).__station.flow.flow};})).toEqual({x,vx:0,state:'IDLE',flow:'P5'});
  await expect(page.locator('[data-action=goal-retry]')).toBeDisabled();expect(await focused(page)).toBe('exit');
  await setPad(page);
  await expect(page.locator('[data-screen=P6]')).toBeVisible({timeout:5000});await expect(page.locator('[data-action=result]')).toBeFocused();
  await tap(page,0);await expect(page.locator('[data-screen=P7]')).toBeVisible();
  await page.waitForTimeout(300);expect(await page.evaluate(()=>(window as any).__station.flow.flow)).toBe('P7'); // the same press did not also pick EXIT
  await expect(page.locator('[data-action=replay]')).toBeDisabled();expect(await focused(page)).toBe('exit');
  for(const direction of [14,14,15,12,13]){await tap(page,direction);expect(await focused(page)).not.toBe('replay');}
  await page.evaluate(()=>(window as any).__station.act('replay'));
  expect(await page.evaluate(()=>{const u=(window as any).__station;return{flow:u.flow.flow,countdown:u.countdownAt};})).toEqual({flow:'P7',countdown:0});
});

test('P1: stick up / down jumps between the card row and the BACK / NEXT row instead of walking every card',async({page})=>{
  await boot(page);await page.evaluate(()=>(window as any).__station.adapter.enqueue());
  await expect(page.locator('[data-action=ready]')).toBeFocused();await connect(page);
  await tap(page,12);expect(await focused(page)).toMatch(/^character-/); // one move up: a card
  await tap(page,14);expect(await focused(page)).toMatch(/^character-/); // left / right stay within the cards
  await tap(page,13);expect(await focused(page)).toMatch(/^(prev|ready)$/); // one move down: straight to the step buttons
  await tap(page,13);expect(await focused(page)).toMatch(/^(prev|ready)$/); // nothing below: stays
  await page.locator('[data-action=character-a]').focus();await tap(page,13);await expect(page.locator('[data-action=prev]')).toBeFocused(); // the closest one underneath
  await page.locator('[data-action=character-custom]').focus();await tap(page,13);expect(await focused(page)).toMatch(/^(prev|ready)$/);
  // Buttons still work while the page has lost focus (camera prompt, address bar): a stick cannot click to refocus.
  await page.evaluate(()=>{Object.defineProperty(document,'hasFocus',{value:()=>false});});
  await page.locator('[data-action=ready]').focus();await tap(page,0);await expect(page.locator('.item-card')).toHaveCount(5);
});
test('controls panel: OPTIONS → 按鍵設定, stick picks the action, the next button pressed is bound, saved and used; reset restores',async({page})=>{
  await startRun(page);
  await tap(page,9);await page.locator('.modal.screen [data-action=controls]').waitFor();
  for(let i=0;i<4&&await focused(page)!=='controls';i++)await tap(page,13);
  expect(await focused(page)).toBe('controls');await tap(page,0);
  await expect(page.locator('[data-action=bind-jump]')).toBeFocused();await expect(page.locator('[data-action=bind-dash]')).toContainText('R1');
  await tap(page,13);await expect(page.locator('[data-action=bind-dash]')).toBeFocused();
  await tap(page,0);await expect(page.locator('[data-action=bind-dash]')).toContainText('請按下按鍵');
  await tap(page,13);await expect(page.locator('[data-action=bind-dash]')).toContainText('請按下按鍵'); // the stick is not bindable and does not move focus while listening
  await tap(page,4);await expect(page.locator('[data-action=bind-dash]')).toContainText('L1');await expect(page.locator('[data-action=bind-dash]')).toBeFocused();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gamepad-profiles')!)['Mock Stick'].buttons.dash)).toEqual([4]);
  // Swap: binding dash to the jump button gives jump the old dash button; the press itself triggers nothing.
  await tap(page,0);await expect(page.locator('[data-action=bind-dash]')).toContainText('請按下按鍵');
  await tap(page,9);await expect(page.locator('[data-action=bind-dash]')).toContainText('L1');await expect(page.locator('.modal.screen')).toHaveCount(1); // OPTIONS cancels, panel stays
  await tap(page,1);await expect(page.locator('.modal.screen [data-action=controls]')).toBeFocused();
  await tap(page,1);await expect(page.locator('.modal.screen')).toHaveCount(0);
  await grounded(page);
  await setPad(page,[5]);await page.waitForTimeout(200);expect(await page.evaluate(()=>(window as any).__gameplay.controller.state)).not.toBe('DASH');await setPad(page);await page.waitForTimeout(60);
  await setPad(page,[4]);await page.waitForFunction(()=>(window as any).__gameplay.controller.state==='DASH');await setPad(page);
  await tap(page,9);for(let i=0;i<4&&await focused(page)!=='controls';i++)await tap(page,13);await tap(page,0);
  for(let i=0;i<6&&await focused(page)!=='controls-reset';i++)await tap(page,13);
  await tap(page,0);await expect(page.locator('[data-action=bind-dash]')).toContainText('R1');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gamepad-profiles')!))).toEqual({});
});
test('focus lost to another window or a click on empty space comes back, so confirm and the controls panel keep working',async({page})=>{
  await boot(page);await expect(page.locator('[data-action=demo]')).toBeFocused();await connect(page);
  const lose=()=>page.evaluate(()=>{(document.activeElement as HTMLElement).blur();window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});
  await lose();await expect(page.locator('[data-action=demo]')).toBeFocused();
  await tap(page,9);await page.locator('.modal.screen [data-action=controls]').focus();await lose();
  await expect(page.locator('.modal.screen [data-action=controls]')).toBeFocused(); // same button, inside the panel
  await tap(page,0);await expect(page.locator('[data-action=bind-jump]')).toBeFocused();
  await page.mouse.click(5,5);await expect(page.locator('[data-action=bind-jump]')).toBeFocused();
  await tap(page,13);await tap(page,0);await expect(page.locator('[data-action=bind-dash]')).toContainText('請按下按鍵');
  await lose();await tap(page,4);await expect(page.locator('[data-action=bind-dash]')).toContainText('L1');
});
test('controls panel: the back button cancels a pending bind instead of swapping itself in; confirm still works after',async({page})=>{
  await boot(page);await connect(page);
  await tap(page,9);await page.locator('.modal.screen [data-action=controls]').focus();await tap(page,0);
  await expect(page.locator('[data-action=bind-jump]')).toBeFocused();await tap(page,0);await expect(page.locator('[data-action=bind-jump]')).toContainText('請按下按鍵');
  await tap(page,1);await expect(page.locator('[data-action=bind-jump]')).toContainText('✕');await expect(page.locator('[data-action=bind-back]')).toContainText('○');
  expect(await page.evaluate(()=>localStorage.getItem('gamepad-profiles'))).toBeNull();
  await tap(page,0);await expect(page.locator('[data-action=bind-jump]')).toContainText('請按下按鍵'); // confirm still confirms
  await tap(page,1);await tap(page,1);await expect(page.locator('.modal.screen [data-action=controls]')).toBeFocused(); // back leaves the panel
});
test('diagnostic page: WAITING FOR GAMEPAD without hardware',async({page})=>{
  await page.goto('/gamepad.html');
  await expect(page.locator('#status')).toHaveText('WAITING FOR GAMEPAD');await expect(page.locator('#live .pad')).toHaveCount(0);
});
test('diagnostic page: live state, binding, saved profile and JSON export for a non-standard device',async({page})=>{
  await page.addInitScript(()=>{(window as any).__pads=[];navigator.getGamepads=()=>(window as any).__pads;});
  await page.goto('/gamepad.html');await expect(page.locator('#status')).toHaveText('WAITING FOR GAMEPAD');
  const set=(pressed:number[])=>page.evaluate(pressed=>{(window as any).__pads=[null,{id:'Fake Arcade Stick (Vendor: 1234 Product: 5678)',index:1,mapping:'',connected:true,axes:[0,-1,0,0],buttons:Array.from({length:12},(_,i)=>({pressed:pressed.includes(i),value:pressed.includes(i)?1:0}))}];},pressed);
  await set([]);await expect(page.locator('#status')).toHaveText('1 GAMEPAD CONNECTED');
  await expect(page.locator('.pad dl')).toContainText('Fake Arcade Stick');await expect(page.locator('.pad dl')).toContainText('non-standard');await expect(page.locator('.pad dl')).toContainText('12 / 4');
  await expect(page.locator('.pad dl')).toContainText('NO PROFILE');await expect(page.locator('[data-axis="1"]')).toContainText('-1.000');
  await set([4]);await expect(page.locator('[data-button="4"]')).toHaveClass(/on/);await expect(page.locator('#log')).toContainText('#1 button 4 PRESSED');
  await set([]);await expect(page.locator('#log')).toContainText('#1 button 4 RELEASED');await expect(page.locator('[data-actions]')).toHaveText('—');
  await page.locator('[data-bind=jump]').click();await set([7]);await expect(page.locator('[data-indexes=jump]')).toHaveText('7');await set([]);
  await page.locator('#save').click();await expect(page.locator('#source')).toHaveText('SAVED');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gamepad-profiles')!))).toEqual({'Fake Arcade Stick (Vendor: 1234 Product: 5678)':{buttons:{jump:[7]},axisX:0,axisY:1}});
  await set([7]);await expect(page.locator('[data-actions]')).toContainText('jump');await expect(page.locator('[data-actions]')).toContainText('up'); // axis 1 = -1
  await page.locator('#note').fill('PC / DP / TURBO OFF');await page.locator('#export').click();
  const json=JSON.parse(await page.locator('#json').inputValue());
  expect(json).toMatchObject({note:'PC / DP / TURBO OFF',gamepads:[{index:1,mapping:'non-standard',buttonCount:12,axisCount:4,profileSource:'SAVED'}]});
  await set([]);await page.evaluate(()=>{(window as any).__pads=[];});await expect(page.locator('#status')).toHaveText('WAITING FOR GAMEPAD');
});
