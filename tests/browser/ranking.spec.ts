import {test,expect,type Page} from '@playwright/test';
const key='rog-future-gamer.records.v1';
test.use({viewport:{width:1920,height:1080}});
async function openBoard(page:Page){
  await page.waitForFunction(()=>!!(window as any).__station?.game.registry.get('assetsReady'));
  await page.evaluate(()=>{const u=(window as any).__station;u.adapter.enqueue('測試玩家');u.go('P1');u.go('P2');u.go('P3');u.go('P4');u.start();});
  await page.waitForFunction(()=>!!(window as any).__gameplay?.session);
  await page.evaluate(()=>{const u=(window as any).__station;u.result=u.scene.session.finish('goal');u.go('P5');u.go('P6');u.go('P7');u.act('ranking');});
}
for(const count of [0,3,11,21])test(`local ranking ${count} rows, pagination, escaped names and safe area`,async({page})=>{
  await page.addInitScript(({key,count})=>localStorage.setItem(key,JSON.stringify({schemaVersion:1,records:Array.from({length:count},(_,i)=>({runId:`fixture-${i}`,nickname:i===0?'<b>中文 & Player</b>':'玩家測試名字 Player '+i,score:1000-i,tier:'90',titles:[],characterId:'aria'}))})),{key,count});
  await page.goto('/');await openBoard(page);
  await expect(page.locator('.full-ranking .rank-row')).toHaveCount(Math.min(count,10));
  await expect(page.locator('.podium-card')).toHaveCount(Math.min(count,3));
  if(count){await expect(page.locator('.full-ranking .rank-row').first()).toContainText('<b>中文 & Player</b>');await expect(page.locator('.full-ranking .rank-row span b')).toHaveCount(0);}
  else await expect(page.locator('.empty-state')).toBeVisible();
  if(count>10){await page.locator('[data-action=page-1]').click();await expect(page.locator('.full-ranking .rank-row')).toHaveCount(Math.min(count-10,10));await expect(page.locator('.full-ranking .rank-row b').first()).toHaveText('11');}
  else await expect(page.locator('[data-action=page-1]')).toBeDisabled();
  for(const height of [1080,1200]){
    await page.setViewportSize({width:1920,height});
    expect(await page.locator('.leaderboard-table,.podium-card,.board-screen .actions button').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect();return r.left>=96&&r.right<=1824&&r.top>=54&&r.bottom<=innerHeight-54;}))).toBe(true);
    if(count===21)await page.screenshot({path:`docs/evidence/rog-uiux/ranking-${height}.png`});
  }
  await page.locator('[data-action=close-ranking]').click();await expect(page.locator('[data-action=ranking]')).toBeFocused();
  if(count===21)await page.screenshot({path:'docs/evidence/rog-uiux/replay.png'});
});
test('actual result persists once across reload; corrupt and denied storage preserve records',async({page})=>{
  await page.goto('/');await openBoard(page);
  await page.evaluate(()=>{const u=(window as any).__station;u.adapter.save(u.result);u.adapter.save(u.result);});
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).records.length,key)).toBe(1);
  await page.reload();await page.waitForFunction(()=>!!(window as any).__station);
  expect(await page.evaluate(()=>(window as any).__station.adapter.records.length)).toBe(1);
  await page.evaluate(key=>localStorage.setItem(key,'{broken'),key);
  await page.reload();await openBoard(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await page.evaluate(()=>{const u=(window as any).__station;u.adapter.save(u.result);});
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe('{broken');
  await page.evaluate(key=>localStorage.removeItem(key),key);
  await page.locator('[data-action=retry-storage]').click();await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).records.length,key)).toBe(1);
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Denied','QuotaExceededError');};const u=(window as any).__station;u.adapter.persist();u.render();});
  await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('.full-ranking .rank-row')).toHaveCount(1);
  await expect(page.locator('.rank-row[aria-current=true]')).toHaveCount(1);
  await page.screenshot({path:'docs/evidence/rog-uiux/storage-error.png'});
});
