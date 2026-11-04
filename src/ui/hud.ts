import {badgeIcon,time,text} from './components';
import {asset} from '../assets/catalog';
import {weaponMode} from '../core/config';
import type {GameplaySession} from '../core/session';

// Planning v0.3 §5 UC06-1: badges top-left, time top-centre, score top-right, Combo and invincibility at y240, attack item box.
// v2 cut-corner islands; ids are the updateHud() contract and must not change.
export function hud(attackItem:string){
  const m=weaponMode(attackItem);
  return `<div class="screen transparent" data-screen="P4">
    <div class="hud">
      <section class="island hud-badge">${badgeIcon()}<div><strong><span id="hud-badges">0</span><small class="hud-total"> / <span id="hud-total">—</span></small></strong><h2><b>徽章</b>BADGES</h2></div></section>
      <section class="island timer"><h2><b>剩餘時間</b>TIME LEFT</h2><strong id="hud-time">00:00</strong><small id="hud-warning">任務進行中</small></section>
      <section class="island hud-score"><h2><b>分數</b>SCORE</h2><strong id="hud-score">0</strong></section>
    </div>
    <div class="combo-indicator" id="combo-box" data-active="false"><strong id="hud-combo">0</strong><span>COMBO 連擊<small id="hud-multiplier"></small></span></div>
    <div class="power-indicator" id="power-box" hidden><span class="power-symbol">⌁</span><div><h2 id="hud-power">無敵 <small>INVINCIBLE</small></h2><small id="power-detail"></small><progress id="power-progress" max="1" value="0" aria-label="無敵剩餘進度"></progress></div></div>
    <div class="weapon-box" id="weapon-box" data-armed="false" style="--mode:${m.color??'#ffd54f'}"><img src="${asset('items/攻擊道具/'+attackItem)}" alt=""><div><b id="weapon-tag">${m.tag??'ATTACK'}</b><small id="weapon-hint">尚未取得</small></div><span class="pick-pop" id="pick-pop">${m.tag??''}!</span></div>
    <span class="hud-location" id="hud-segment"></span>
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
export function updateHud(root:HTMLElement,s:GameplaySession,total:number,segment=''){
  feedback(root,'hud-badges',s.badges.held);text(root,'hud-total',total);text(root,'hud-segment',segment);
  text(root,'hud-time',time(s.run.remaining));feedback(root,'hud-score',s.score.total);
  const low=s.run.remaining<=15;
  root.querySelector('.timer')?.classList.toggle('low-time',low);
  text(root,'hud-warning',low?'⚠ 剩餘時間不足':'任務進行中');
  const combo=root.querySelector<HTMLElement>('#combo-box')!;
  combo.dataset.active=String(s.combo.count>=2);
  feedback(root,'hud-combo',s.combo.count);text(root,'hud-multiplier',`×${s.combo.multiplier}`);
  const power=root.querySelector<HTMLElement>('#power-box')!,remaining=Math.max(0,s.power.allyUntil-s.run.elapsed);
  power.hidden=!s.power.ally;power.dataset.warn=String(s.power.ally&&remaining<=3);
  text(root,'power-detail',`${Math.ceil(remaining)} 秒 / 碰到敵人直接擊倒`);
  root.querySelector<HTMLProgressElement>('#power-progress')!.value=Math.min(1,remaining/10);
  const weapon=root.querySelector<HTMLElement>('#weapon-box')!,armed=String(s.power.armed);
  if(weapon.dataset.armed!==armed){weapon.dataset.armed=armed;if(s.power.armed&&!matchMedia('(prefers-reduced-motion: reduce)').matches)root.querySelector<HTMLElement>('#pick-pop')!.animate([{opacity:1,transform:'translateY(0) scale(1.3)'},{opacity:0,transform:'translateY(-30px) scale(1)'}],{duration:300});}
  text(root,'weapon-hint',s.power.armed?'C THROW':'尚未取得');
}
