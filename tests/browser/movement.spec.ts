import {test,expect} from '@playwright/test';
// Start = cell (2,16): body centre (80,512), feet on the row-17 floor at y=544. Pit at cols 10-11 (x 320-384).
for(const hz of [24,60])test(`D2: jumps, landing, dash wall ${hz}Hz`,async({page})=>{
  await page.goto(`/?debug=1&hz=${hz}`);await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  const base=await page.evaluate(()=>(window as any).__gameplay.player.y);
  await page.keyboard.down('KeyZ');await page.waitForTimeout(160);
  expect(await page.evaluate(()=>(window as any).__gameplay.player.y)).toBeLessThan(base-30);
  await page.keyboard.up('KeyZ');await page.waitForTimeout(60);await page.keyboard.down('KeyZ');await page.waitForTimeout(80);await page.keyboard.up('KeyZ');
  expect(await page.evaluate(()=>(window as any).__gameplay.controller.jumps)).toBe(2);
  await page.keyboard.press('KeyZ');await page.waitForTimeout(60);
  expect(await page.evaluate(()=>(window as any).__gameplay.controller.jumps)).toBe(2);
  await page.waitForFunction(()=>(window as any).__gameplay.body.blocked.down);
  await page.waitForTimeout(80);expect(await page.evaluate(()=>(window as any).__gameplay.controller.jumps)).toBe(0);
  await page.evaluate(()=>{const s=(window as any).__gameplay;const wall=s.add.rectangle(220,450,8,200,0xffffff);s.physics.add.existing(wall,true);s.physics.add.collider(s.player,wall);s.body.reset(150,512);});
  await page.keyboard.down('ArrowRight');await page.keyboard.press('KeyX');await page.waitForTimeout(280);await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(()=>(window as any).__gameplay.body.right)).toBeLessThanOrEqual(216.1);
});

for(const hz of [24,60])test(`air dash under ceiling recovers to falling and walking ${hz}Hz`,async({page})=>{
  await page.goto(`/?debug=1&hz=${hz}`);await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  await page.evaluate(()=>{
    const s=(window as any).__gameplay;s.body.reset(40,512);
    const roof=s.add.rectangle(150,410,300,10,0xffffff);
    s.physics.add.existing(roof,true);
    s.physics.add.collider(s.player,roof,()=>{s.ceilingHit=true;s.ceilingTop=s.body.top;});
  });
  await page.keyboard.down('KeyZ');await page.waitForFunction(()=>(window as any).__gameplay.ceilingHit===true);
  expect(await page.evaluate(()=>(window as any).__gameplay.ceilingTop)).toBeGreaterThanOrEqual(414.9);
  await page.keyboard.up('KeyZ');await page.keyboard.down('ArrowRight');await page.keyboard.press('KeyX');
  await page.waitForFunction(()=>(window as any).__gameplay.controller.state==='DASH');
  const dash=await page.evaluate(()=>{const s=(window as any).__gameplay;return{x:s.player.x,ground:s.body.blocked.down,gravity:s.body.allowGravity,top:s.body.top};});
  expect(dash.ground).toBe(false);expect(dash.gravity).toBe(false);expect(dash.top).toBeGreaterThanOrEqual(414.9);
  await page.waitForFunction(()=>{const s=(window as any).__gameplay;return s.controller.state!=='DASH'&&s.body.allowGravity&&s.body.velocity.y>0;});
  expect(await page.evaluate(()=>(window as any).__gameplay.player.x)).toBeGreaterThan(dash.x);
  await page.waitForFunction(()=>(window as any).__gameplay.body.blocked.down);
  await page.waitForFunction(()=>(window as any).__gameplay.controller.state==='RUN');
  await page.keyboard.up('ArrowRight');await page.waitForFunction(()=>(window as any).__gameplay.controller.state==='IDLE');
});

test('coyote jump and ↓ drop-through on the row-12 one-way (cols 21-25)',async({page})=>{
  await page.goto('/?debug=1');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
  // Under the one-way: single jump (112 px) cannot reach y=384, the double jump passes through from below and lands on top.
  await page.evaluate(()=>{const s=(window as any).__gameplay;s.body.reset(23.5*32,512);s.controller.reset();});await page.waitForTimeout(150);
  await page.keyboard.down('KeyZ');await page.waitForTimeout(300);await page.keyboard.up('KeyZ');await page.waitForTimeout(40);
  await page.keyboard.down('KeyZ');await page.waitForTimeout(300);await page.keyboard.up('KeyZ');
  await page.waitForFunction(()=>(window as any).__gameplay.body.blocked.down);
  expect(await page.evaluate(()=>(window as any).__gameplay.body.bottom)).toBeCloseTo(384,0);
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(()=>{const s=(window as any).__gameplay;return s.body.blocked.down&&s.body.bottom>500;});
  expect(await page.evaluate(()=>(window as any).__gameplay.body.bottom)).toBeCloseTo(544,0);
  // ↓ on solid ground does nothing.
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(150);
  expect(await page.evaluate(()=>(window as any).__gameplay.body.bottom)).toBeCloseTo(544,0);
});
