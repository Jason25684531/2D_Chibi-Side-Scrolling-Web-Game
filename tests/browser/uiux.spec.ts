import {test,expect} from '@playwright/test';
test.use({viewport:{width:1920,height:1080}});

test('all nine tutorial lessons follow runtime actions and reset before the real run',async({page})=>{
  await page.goto('/');await page.locator('[data-action=demo]').click();await page.locator('[data-action=ready]').click();await page.locator('[data-action=tier-90]').click();
  await page.waitForFunction(()=>(window as any).__gameplay?.session?.tutorial);
  // Keep the sandbox open while testing each collision. Never set checklist flags.
  await page.evaluate(()=>{(window as any).__station.entered=performance.now()+30000;});
  await page.waitForFunction(()=>(window as any).__gameplay.body.blocked.down);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(120);await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Space');await page.waitForTimeout(100);await page.keyboard.press('Space');await page.waitForTimeout(100);await page.keyboard.press('ShiftLeft');await page.waitForTimeout(150);
  for(const lesson of ['移動','跳躍','雙段跳','衝刺'])await expect(page.locator(`[data-lesson="${lesson}"]`)).toHaveAttribute('data-state','completed');
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(180,776);s.body.setVelocity(0,0);});
  await expect(page.locator('[data-lesson=徽章]')).toHaveAttribute('data-state','completed');
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(400,776);s.body.setVelocity(0,0);});
  await expect(page.locator('[data-lesson=筆電]')).toHaveAttribute('data-state','completed');
  await page.keyboard.press('KeyJ');await expect(page.locator('[data-lesson=投擲]')).toHaveAttribute('data-state','completed');
  await page.evaluate(()=>{const s=(window as any).__gameplay;const e=s.enemies.enemies[0];s.body.reset(e.object.x,e.object.y-100);s.body.setVelocity(0,160);});
  await expect(page.locator('[data-lesson=踩擊]')).toHaveAttribute('data-state','completed');
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(870,710);s.body.setVelocity(0,180);});
  await expect(page.locator('[data-lesson=彈跳板]')).toHaveAttribute('data-state','completed');
  await expect(page.locator('[data-state=completed]')).toHaveCount(9);
  await page.screenshot({path:'docs/evidence/rog-uiux/tutorial-completed.png'});
  await page.evaluate(()=>{const u=(window as any).__station;u.entered=performance.now()-8001;u.countdownAt=performance.now()-3001;});
  await expect(page.locator('[data-screen=P4]')).toBeVisible();
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay.session;return{tutorial:s.tutorial,score:s.score.total,badges:s.badges.held,power:s.power.kind,bounces:s.stats.bounces};})).toEqual({tutorial:false,score:0,badges:0,power:null,bounces:0});
});

test('selection, name input, real tutorial actions and fixed authoritative HUD',async({page})=>{
  test.setTimeout(35000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.locator('[data-action=demo]').click();
  await page.locator('#nickname').fill('小雅 H J 空白');
  await page.locator('#nickname').press('Space');
  await expect(page.locator('[data-screen=P1]')).toBeVisible();
  await expect(page.locator('.modal.screen')).toHaveCount(0);
  await page.locator('[data-action=character-kael]').click();
  await expect(page.locator('[data-action=character-kael]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.locked')).toBeDisabled();
  await page.screenshot({path:'docs/evidence/rog-uiux/selection.png'});
  await page.locator('[data-action=ready]').click();await page.locator('[data-action=tier-90]').click();
  await page.waitForFunction(()=>!!(window as any).__gameplay?.session?.tutorial);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.up('ArrowRight');
  await expect(page.locator('[data-lesson=移動]')).toHaveAttribute('data-state','completed');
  await page.screenshot({path:'docs/evidence/rog-uiux/tutorial.png'});
  await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:15000});
  const before=await page.locator('.hud').boundingBox();
  await page.evaluate(()=>{
    const s=(window as any).__gameplay;
    s.session.pickup('ui-evidence');s.session.credit('ui-enemy','melee');
    s.session.activate('ally','ui-power');s.cameras.main.setScroll(600,150);s.run.pause();
  });
  await expect(page.locator('#hud-badges')).toHaveText('1');
  await expect(page.locator('#hud-score')).toHaveText('20');
  await expect(page.locator('#hud-total')).toHaveText('60');
  await expect(page.locator('#hud-power')).toHaveText('ROG ALLY');
  expect(await page.locator('.hud').boundingBox()).toEqual(before);
  await page.screenshot({path:'docs/evidence/rog-uiux/gameplay.png'});
  await page.setViewportSize({width:1920,height:1200});
  await page.screenshot({path:'docs/evidence/rog-uiux/gameplay-16x10.png'});
  expect(errors).toEqual([]);
});

test('shared HUD prototype states and 16:10 safe area',async({page})=>{
  await page.goto('/prototype.html');
  await page.getByRole('button',{name:'低時間',exact:true}).click();
  await expect(page.locator('#hud-warning')).toContainText('不足');
  await page.getByRole('button',{name:'Combo',exact:true}).click();
  await expect(page.locator('#combo-box')).toHaveAttribute('data-active','true');
  await page.getByRole('button',{name:'Ally',exact:true}).click();
  await expect(page.locator('#power-progress')).toBeVisible();
  await page.getByRole('button',{name:'Laptop',exact:true}).click();
  await expect(page.locator('#power-progress')).toBeHidden();
  await page.screenshot({path:'docs/evidence/rog-uiux/prototype.png'});
  await page.setViewportSize({width:1920,height:1200});
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.locator('.hud').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=96&&r.right<=1824&&r.top>=54;})).toBe(true);
  await page.screenshot({path:'docs/evidence/rog-uiux/prototype-16x10.png'});
});

test('confirmation belongs to the button focused at keydown, not the next render',async({page})=>{
  await page.goto('/');
  await page.waitForFunction(()=>!!(window as any).__station?.game.registry.get('assetsReady'));
  const result=await page.evaluate(()=>{
    const u=(window as any).__station;
    const calls:string[]=[];
    const act=u.act.bind(u);
    u.act=(action:string)=>{calls.push(action);act(action);};
    const button=document.querySelector<HTMLButtonElement>('[data-action=demo]')!;
    button.dispatchEvent(new KeyboardEvent('keydown',{code:'Enter',bubbles:true,cancelable:true}));
    // The event must be consumed before a render can change the focused action.
    u.menu=true;u.render();u.update();
    return {calls,flow:u.flow.flow};
  });
  expect(result).toEqual({calls:['demo'],flow:'P1'});
});

test('rapid keyboard confirmation starts one replay and preserves the queue',async({page})=>{
  await page.goto('/');
  await page.waitForFunction(()=>!!(window as any).__station?.game.registry.get('assetsReady'));
  await page.evaluate(()=>{
    const u=(window as any).__station;
    u.adapter.enqueue();u.go('P1');u.go('P2');u.go('P3');u.go('P4');u.start();
  });
  await page.waitForFunction(()=>!!(window as any).__gameplay?.session);
  for(let i=0;i<3;i++){
    await page.evaluate(()=>{
      const u=(window as any).__station;
      u.result=u.scene.session.finish('goal');u.go('P5');u.go('P6');u.go('P7');
      u.adapter.replayEnabled=true;u.render();
    });
    const old=await page.evaluate(()=>(window as any).__gameplay.run.runId);
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-action=replay]')).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
    expect(await page.evaluate(old=>{
      const u=(window as any).__station,s=u.scene.session;
      return u.adapter.queue.length===1&&s.run.runId!==old&&s.score.total===0;
    },old)).toBe(true);
  }
});
