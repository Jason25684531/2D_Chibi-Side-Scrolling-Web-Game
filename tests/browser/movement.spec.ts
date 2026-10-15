import {test,expect} from '@playwright/test';
for(const hz of [24,60])test(`D2: jumps, landing, dash wall ${hz}Hz`,async({page})=>{
  await page.goto(`/?hz=${hz}`);await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const base=await page.evaluate(()=>(window as any).__gameplay.player.y);
  await page.keyboard.down('Space');await page.waitForTimeout(160);
  expect(await page.evaluate(()=>(window as any).__gameplay.player.y)).toBeLessThan(base-30);
  await page.keyboard.up('Space');await page.waitForTimeout(60);await page.keyboard.down('Space');await page.waitForTimeout(80);await page.keyboard.up('Space');
  expect(await page.evaluate(()=>(window as any).__gameplay.controller.jumps)).toBe(2);
  await page.keyboard.press('Space');await page.waitForTimeout(60);
  expect(await page.evaluate(()=>(window as any).__gameplay.controller.jumps)).toBe(2);
  await page.waitForFunction(()=>(window as any).__gameplay.body.blocked.down);
  await page.waitForTimeout(80);expect(await page.evaluate(()=>(window as any).__gameplay.controller.jumps)).toBe(0);
  await page.evaluate(()=>{const s=(window as any).__gameplay;const wall=s.add.rectangle(220,700,8,200,0xffffff);s.physics.add.existing(wall,true);s.physics.add.collider(s.player,wall);s.body.reset(170,776);});
  await page.keyboard.down('ArrowRight');await page.keyboard.press('Shift');await page.waitForTimeout(280);await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(()=>(window as any).__gameplay.body.right)).toBeLessThanOrEqual(216.1);
});

for(const hz of [24,60])test(`air dash under ceiling recovers to falling and walking ${hz}Hz`,async({page})=>{
  await page.goto(`/?hz=${hz}`);await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(()=>{
    const s=(window as any).__gameplay;
    const roof=s.add.rectangle(230,680,300,10,0xffffff);
    s.physics.add.existing(roof,true);
    s.physics.add.collider(s.player,roof,()=>{s.ceilingHit=true;s.ceilingTop=s.body.top;});
  });
  await page.keyboard.down('Space');await page.waitForFunction(()=>(window as any).__gameplay.ceilingHit===true);
  expect(await page.evaluate(()=>(window as any).__gameplay.ceilingTop)).toBeGreaterThanOrEqual(684.9);
  await page.keyboard.up('Space');await page.keyboard.down('ArrowRight');await page.keyboard.press('Shift');
  await page.waitForFunction(()=>(window as any).__gameplay.controller.state==='DASH');
  const dash=await page.evaluate(()=>{const s=(window as any).__gameplay;return{x:s.player.x,ground:s.body.blocked.down,gravity:s.body.allowGravity,top:s.body.top};});
  expect(dash.ground).toBe(false);expect(dash.gravity).toBe(false);expect(dash.top).toBeGreaterThanOrEqual(684.9);
  await page.waitForFunction(()=>{const s=(window as any).__gameplay;return s.controller.state!=='DASH'&&s.body.allowGravity&&s.body.velocity.y>0;});
  expect(await page.evaluate(()=>(window as any).__gameplay.player.x)).toBeGreaterThan(dash.x);
  await page.waitForFunction(()=>(window as any).__gameplay.body.blocked.down);
  await page.waitForFunction(()=>(window as any).__gameplay.controller.state==='RUN');
  await page.keyboard.up('ArrowRight');await page.waitForFunction(()=>(window as any).__gameplay.controller.state==='IDLE');
});
