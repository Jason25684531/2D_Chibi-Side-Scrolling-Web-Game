import {badgeIcon,time,text} from './components';
import type {GameplaySession} from '../core/session';

export function hud(){
  return `<div class="screen transparent" data-screen="P4">
    <div class="hud">
      <section class="panel hud-badge"><h2>COLLECTED / 徽章</h2><div>${badgeIcon()} <strong id="hud-badges">0</strong><span class="hud-total"> / <span id="hud-total">—</span></span></div></section>
      <section class="panel timer"><h2>◷ TIME LEFT</h2><strong id="hud-time">00:00</strong><small id="hud-warning">任務進行中</small></section>
      <section class="panel hud-score"><h2>SCORE / 分數</h2><strong id="hud-score">0</strong><small>FUTURE LAB / 01</small></section>
    </div>
    <div class="combo-indicator" id="combo-box" data-active="false"><strong id="hud-combo">0</strong><span>COMBO<br><small id="hud-multiplier"></small></span></div>
    <div class="power-indicator" id="power-box" hidden><span class="power-symbol">⌁</span><div><h2 id="hud-power"></h2><small id="power-detail"></small><progress id="power-progress" max="1" value="0" aria-label="強化狀態剩餘進度"></progress></div></div>
    <span class="hud-location">ROG FUTURE LAB <span>／ SECTOR 01</span></span>
  </div>`;
}

function feedback(root:HTMLElement,id:string,value:number){
  const node=root.querySelector<HTMLElement>('#'+id);
  if(!node||node.textContent===String(value))return;
  const previous=Number(node.textContent);node.textContent=String(value);
  if(value>previous&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    node.getAnimations().forEach(a=>a.cancel());
    node.animate([{transform:'translateY(0)',color:'#fff'},{transform:'translateY(-5px)',color:'#ffc75a'},{transform:'translateY(0)',color:'#fff'}],{duration:240});
  }
}

// Presentation reads the same session as gameplay. No UI timers or score rules.
export function updateHud(root:HTMLElement,s:GameplaySession,total:number){
  text(root,'hud-badges',s.badges.held);text(root,'hud-total',total);
  text(root,'hud-time',time(s.run.remaining));feedback(root,'hud-score',s.score.total);
  const low=s.run.remaining<=15;
  root.querySelector('.timer')?.classList.toggle('low-time',low);
  text(root,'hud-warning',low?'⚠ 剩餘時間不足':'任務進行中');
  const combo=root.querySelector<HTMLElement>('#combo-box')!;
  combo.dataset.active=String(s.combo.count>=2);
  feedback(root,'hud-combo',s.combo.count);text(root,'hud-multiplier',`×${s.combo.multiplier}`);
  const power=root.querySelector<HTMLElement>('#power-box')!;
  power.hidden=!s.power.kind;
  const progress=root.querySelector<HTMLProgressElement>('#power-progress')!;
  if(s.power.kind==='ally'){
    const remaining=Math.max(0,s.power.expires-s.run.elapsed);
    text(root,'hud-power','ROG ALLY');text(root,'power-detail',`${Math.ceil(remaining)} 秒 / 強化中`);
    progress.value=Math.min(1,remaining/10);progress.hidden=false;
  }else if(s.power.kind==='laptop'){
    const ready=s.run.elapsed>=s.power.throwReady;
    text(root,'hud-power','LAPTOP');text(root,'power-detail',ready?'J 投擲閃電 / READY':'閃電充能中');
    progress.hidden=true;
  }
}
