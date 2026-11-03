import type {Page} from '@playwright/test';
/**
 * Closed-loop bot for the 1102 snake level. It only writes the simulated gamepad (same InputAdapter path
 * as a real pad); it never moves the body. Behaviour is chosen by region, re-evaluated whenever grounded,
 * so a hazard respawn simply resumes from wherever the player is:
 * top row → right; right shaft → hold col 90 and press ↓; middle row → left; elevator shaft → hop to the
 * col-11 wall top, ride the lift down, jump the 1-cell gap; bottom row → right to the portal.
 * Invincibility is re-armed so enemies cannot interrupt this terrain traversal check.
 */
export async function driveRoute(page:Page,timeout=80000){
  await page.evaluate(()=>{
    const s=(window as any).__gameplay,T=32,g:string[]=s.level.grid;
    const tile=(c:number,r:number)=>c<0||c>=g[0].length?'#':r<0||r>=g.length?'.':g[r][c];
    const stand=(c:number,r:number)=>'#=/\\'.includes(tile(c,r));
    const lift=s.terrain.entries.find((e:any)=>e.data.kind==='moving'&&e.data.axis==='y');
    const regionOf=(x:number,bottom:number)=>bottom<=21*T&&x<84*T?'top':x>=84*T&&bottom<38.5*T?'drop':bottom<46*T-2?'middle':x<11*T&&bottom<58*T||x<17*T&&bottom<50*T?'shaft':'bottom';
    let region='top',held=false,tick=0;
    const bot=()=>{
      if(s.session.result){s.testPad=null;s.events.off('preupdate',bot);return;}
      if(!s.session.power.ally&&s.run.phase==='running')s.session.power.activate('ally',s.run.elapsed);
      const b=s.body,p={x:b.center.x,bottom:b.bottom,grounded:b.blocked.down,vy:b.velocity.y};
      if(p.grounded)region=regionOf(p.x,p.bottom);
      const dir=region==='middle'?-1:1,c=Math.floor(p.x/T),r=Math.floor((p.bottom+1)/T),ahead=Math.floor((p.x+dir*(b.width/2+10))/T);
      const toward=(x:number,slack=6)=>Math.abs(p.x-x)>slack?Math.sign(x-p.x):0;
      let move=dir,jump=false,hop=false,down=false,auto=region==='top'||region==='bottom'||region==='middle';
      if(region==='drop'){move=toward(90.5*T);down=p.grounded&&++tick%4===0;}
      if(region==='middle'&&p.x<=18.5*T){move=toward(15.2*T,4);auto=false;} // walk off onto the landing block (cols 14-16)
      if(region==='shaft'){
        auto=false;const atTop=lift.mover.pos<4,atBottom=lift.mover.pos>lift.data.range-4;
        if(p.bottom>=50*T){move=atBottom||!p.grounded?1:toward(9.5*T);jump=hop=atBottom&&p.grounded;} // lift at the bottom: tap-hop the 1-cell gap below the row-53 grid
        else if(p.x>12.3*T){jump=p.grounded&&p.x<14.6*T;move=p.grounded||p.x>12.2*T?-1:0;}
        else if(p.x>10.8*T)move=atTop&&p.grounded?-1:0;
        else move=toward(9.5*T);
      }
      if(auto){
        const wall=[1,2].some(k=>'#'===tile(ahead,r-k)),gap=![0,1,2,3].some(k=>stand(ahead,r+k));
        const spring=s.terrain.entries.some((e:any)=>e.data.kind==='bounce'&&Math.abs(e.data.x-(p.x+dir*24))<20&&Math.abs(e.data.y-p.bottom)<20);
        jump=p.grounded&&(wall||gap||spring);
        if(!p.grounded&&s.controller.jumps===1&&p.vy>0&&![0,1,2,3].some(k=>stand(c,r+k)))jump=true; // double jump over a deep gap
      }
      const press=jump&&!held;held=hop?false:jump||(held&&p.vy<0);
      s.testPad={axes:[move,down?1:0],buttons:Array.from({length:16},(_,k)=>({pressed:k===1?press||held:false}))};
    };
    s.events.on('preupdate',bot);(window as any).__route=()=>({step:region,x:s.body.center.x/T,row:s.body.bottom/T});
  });
  await page.waitForFunction(()=>!!(window as any).__gameplay.session.result,null,{timeout,polling:250});
}
