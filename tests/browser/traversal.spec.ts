import {test,expect} from '@playwright/test';
test('full level keyboard traversal from Start to Goal without teleporting',async({page})=>{
 test.setTimeout(60000);await page.goto('/');await page.waitForFunction(()=>(window as any).__gameplay?.body?.blocked.down);
 await page.keyboard.down('ArrowRight');let done=false;
 for(let n=0;n<100;n++){
   await page.keyboard.down('Space');await page.waitForTimeout(330);await page.keyboard.up('Space');await page.waitForTimeout(80);
   done=await page.evaluate(()=>!!(window as any).__gameplay.session.result);
   if(done)break;
 }
 await page.keyboard.up('ArrowRight');
 await page.screenshot({path:'docs/evidence/gameplay-goal.png',fullPage:true});
 const final=await page.evaluate(()=>{const s=(window as any).__gameplay;return{result:s.session.result,x:s.player.x,y:s.player.y,stats:s.session.stats,state:s.controller.state};});expect(final.result?.endReason,JSON.stringify(final)).toBe('goal');
});
