import './station.css';
import {GameplaySession} from '../core/session';
import {hud,updateHud} from './hud';
import {ATTACK_ITEMS} from '../core/config';
document.body.className='station';
document.body.innerHTML=`<div id="station-root" class="prototype-stage"><div id="station-ui">${hud(ATTACK_ITEMS[0].src)}</div><div class="prototype-controls"><strong>互動原型 · 範例狀態，不保存成績</strong><nav>${['一般','低時間','得分','Combo','無敵','攻擊道具','清空'].map((s,i)=>`<button data-state="${i}">${s}</button>`).join('')}</nav><p>鍵盤 Tab / Enter 或滑鼠切換；使用正式 HUD 元件。</p></div></div>`;
const root=document.querySelector<HTMLElement>('#station-root')!;
const resize=()=>root.style.transform=`translate(-50%,-50%) scale(${Math.min(innerWidth/1920,innerHeight/1080)})`;
resize();window.addEventListener('resize',resize);
root.addEventListener('click',event=>{
  const target=(event.target as HTMLElement).closest<HTMLElement>('[data-state]');
  if(target)show(Number(target.dataset.state));
});
function show(state:number){
  const s=new GameplaySession(100,'prototype');
  if(state!==6){s.pickup('fixture-badge');s.tick(state===1?90:4);}
  if(state===2)s.credit('fixture-enemy');
  if(state===3){s.credit('fixture-1');s.credit('fixture-2');s.credit('fixture-3');}
  if(state===4)s.activate('ally','fixture-ally');
  if(state===5)s.activate('laptop','fixture-laptop');
  updateHud(root,s,60);s.dispose();
}
show(0);
