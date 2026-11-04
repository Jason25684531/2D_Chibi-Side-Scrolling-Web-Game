import {test,expect} from '@playwright/test';
test.use({viewport:{width:1920,height:1080}});

test('tutorial lessons come from the practice slice, follow runtime actions and reset before the real run',async({page})=>{
  await page.goto('/');await page.locator('[data-action=demo]').click();for(let i=0;i<3;i++)await page.locator('[data-action=ready]').click();
  await page.waitForFunction(()=>(window as any).__gameplay?.session?.tutorial);
  // The sandbox has no time limit; never set checklist flags.
  await page.waitForFunction(()=>(window as any).__gameplay.body.blocked.down);
  await expect(page.locator('[data-lesson]')).toHaveCount(8); // slice cols 0-40 rows 0-23 has no spring
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(120);await page.keyboard.up('ArrowRight');
  await page.keyboard.press('KeyZ');await page.waitForTimeout(100);await page.keyboard.press('KeyZ');await page.waitForTimeout(100);await page.keyboard.press('KeyX');await page.waitForTimeout(150);
  for(const lesson of ['移動','跳躍','雙段跳','衝刺'])await expect(page.locator(`[data-lesson="${lesson}"]`)).toHaveAttribute('data-state','completed');
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(9.5*32,14.5*32);s.body.setVelocity(0,0);}); // badge e8
  await expect(page.locator('[data-lesson=徽章]')).toHaveAttribute('data-state','completed');
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(41*32,16.5*32);s.body.setVelocity(0,0);}); // attack item e79
  await expect(page.locator('[data-lesson=攻擊道具]')).toHaveAttribute('data-state','completed');
  await page.keyboard.press('KeyC');await expect(page.locator('[data-lesson=投擲]')).toHaveAttribute('data-state','completed');
  await page.evaluate(()=>{const s=(window as any).__gameplay;const e=s.enemies.enemies.find((x:any)=>x.kind==='beholder');s.body.reset(e.x+e.w/2,e.y-60);s.body.setVelocity(0,160);});
  await expect(page.locator('[data-lesson=踩擊]')).toHaveAttribute('data-state','completed');
  await expect(page.locator('[data-state=completed]')).toHaveCount(8);
  await page.screenshot({path:'docs/evidence/rog-uiux/tutorial-completed.png'});
  await page.locator('[data-action=start-game]').click();
  await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
  await page.waitForFunction(()=>(window as any).__gameplay.run.phase==='running'&&!(window as any).__gameplay.session.tutorial); // restart lands one frame after P4 renders
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay.session;return{tutorial:s.tutorial,score:s.score.total,badges:s.badges.held,armed:s.power.armed,ally:s.power.ally,bounces:s.stats.bounces};})).toEqual({tutorial:false,score:0,badges:0,armed:false,ally:false,bounces:0});
});

test('character B, attack item, nickname input, real tutorial actions and fixed authoritative HUD',async({page})=>{
  test.setTimeout(35000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.locator('[data-action=demo]').click();
  await page.locator('[data-action=character-b]').click();
  await expect(page.locator('[data-action=character-b]')).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:'docs/evidence/rog-uiux/selection.png'});
  await page.locator('[data-action=ready]').click();
  await page.locator('[data-action=item-1]').click();await expect(page.locator('[data-action=item-1]')).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:'docs/evidence/rog-uiux/attack-item.png'});
  await page.locator('[data-action=ready]').click();
  await page.locator('#nickname').fill('小雅 H J 空白');
  await page.locator('#nickname').press('Space');
  await expect(page.locator('#nickname')).toHaveValue('小雅 H J 空');
  await expect(page.locator('.modal.screen')).toHaveCount(0);
  await page.locator('[data-action=ready]').click();
  await page.waitForFunction(()=>!!(window as any).__gameplay?.session?.tutorial);
  expect(await page.evaluate(()=>{const s=(window as any).__gameplay;return{item:s.attackItem,char:s.presentation.sprite.texture.key.slice(0,10)};})).toEqual({item:'C_ROG Chakram X Origin.png',char:'chars/S2AM'});
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.up('ArrowRight');
  await expect(page.locator('[data-lesson=移動]')).toHaveAttribute('data-state','completed');
  await page.screenshot({path:'docs/evidence/rog-uiux/tutorial.png'});
  await page.keyboard.press('Enter');await expect(page.locator('[data-screen=P4]')).toBeVisible({timeout:5000});
  const before=await page.locator('.hud').boundingBox();
  await page.evaluate(()=>{
    const s=(window as any).__gameplay;
    s.session.pickup('ui-evidence');s.session.credit('ui-enemy');
    s.session.activate('ally','ui-power');s.session.activate('laptop','ui-item');s.cameras.main.setScroll(600,150);s.run.pause();
  });
  await expect(page.locator('#hud-badges')).toHaveText('1');
  await expect(page.locator('#hud-score')).toHaveText('20');
  await expect(page.locator('#hud-total')).toHaveText('60');
  await expect(page.locator('#hud-power')).toHaveText('無敵 INVINCIBLE');
  await expect(page.locator('#weapon-box')).toHaveAttribute('data-armed','true');await expect(page.locator('#weapon-tag')).toHaveText('RAPID');await expect(page.locator('#weapon-hint')).toHaveText('C THROW');
  expect(await page.locator('.hud').boundingBox()).toEqual(before);
  await page.screenshot({path:'docs/evidence/rog-uiux/gameplay.png'});
  await page.setViewportSize({width:1920,height:1200});
  await page.screenshot({path:'docs/evidence/rog-uiux/gameplay-16x10.png'});
  expect(errors).toEqual([]);
});

test('P0 idle 60 s plays the attract video and any input closes it',async({page})=>{
  await page.goto('/');await page.waitForFunction(()=>!!(window as any).__station);
  await page.evaluate(()=>{(window as any).__station.idleSince=performance.now()-60001;});
  await expect(page.locator('video.attract')).toHaveCount(1);
  expect(await page.locator('video.attract').evaluate((v:HTMLVideoElement)=>v.muted&&v.loop)).toBe(true);
  await page.keyboard.press('ArrowRight');await expect(page.locator('video.attract')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).__station.flow.flow)).toBe('P0');
});

test('shared HUD prototype states and 16:10 safe area',async({page})=>{
  await page.goto('/prototype.html');
  await page.getByRole('button',{name:'低時間',exact:true}).click();
  await expect(page.locator('#hud-warning')).toContainText('不足');
  await page.getByRole('button',{name:'Combo',exact:true}).click();
  await expect(page.locator('#combo-box')).toHaveAttribute('data-active','true');
  await page.getByRole('button',{name:'無敵',exact:true}).click();
  await expect(page.locator('#power-progress')).toBeVisible();
  await page.getByRole('button',{name:'攻擊道具',exact:true}).click();
  await expect(page.locator('#power-box')).toBeHidden();await expect(page.locator('#weapon-box')).toHaveAttribute('data-armed','true');
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
