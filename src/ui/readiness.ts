import {ATTACK_ITEMS,weaponMode} from '../core/config';
import {asset,characterName,characterIds,characterRole,pose} from '../assets/catalog';
import {button,escape,icon} from './components';
import type {Identity} from './mock-station';
// P1 markup only; StationUI owns state, input and the camera stream.
// UC02-1 → UC03-1 (CUSTOM only) → UC02-2 → UC04-1: [step chip, step chip EN, section title, section title EN].
const CHARACTER=['角色','CHARACTER','選擇角色','SELECT YOUR CHARACTER'],PHOTO=['拍照','PHOTO','拍攝頭像','TAKE YOUR PHOTO'];
const ITEM=['道具','ITEM','選擇攻擊道具','SELECT YOUR ATTACK ITEM'],NICKNAME=['暱稱','NICKNAME','輸入暱稱','ENTER YOUR NICKNAME'];
export const readinessSteps=(c?:Identity)=>c?.custom?[CHARACTER,PHOTO,ITEM,NICKNAME]:[CHARACTER,ITEM,NICKNAME];
export const needsPhoto=(c:Identity|undefined,step:number)=>readinessSteps(c)[step]===PHOTO&&!c?.photo;
export const readyLabel=(c:Identity|undefined,step:number)=>c?.assetState==='generating'?'角色準備中':step<readinessSteps(c).length-1?'下一步':'開始任務';
/** Body with the custom face when this player is custom, else the plain pose. */
export const look=(c:Identity|undefined,id=c?.characterId??'a',frame:'idle1'|'attack1'='idle1')=>(c?.custom&&c.looks?.[id]?.[frame])||pose(id,frame);

/** Layout A: cards + hero; every step defaults so repeated confirms start the run. The split CTA never moves. */
export function readiness(c:Identity|undefined,step:number,cameraError=''){
  const steps=readinessSteps(c),current=steps[step],[,en,title,titleEn]=current,character=c?.characterId??'a',last=step===steps.length-1;
  const item=ATTACK_ITEMS.find(i=>i.src===c?.attackItem)??ATTACK_ITEMS[0];
  const chips=`<ol class="steps">${steps.map(([zh,e],i)=>`<li data-state="${i<step?'done':i===step?'active':'todo'}"><b>0${i+1}</b>${zh}<small>${e}</small></li>`).join('')}</ol>`;
  const hero=`<div class="hero"><div class="plate"><span>ROG FUTURE GAMER</span></div><img src="${look(c,character,'attack1')}" alt="${escape(characterName(character))}"></div>`;
  const plate=(edit:boolean)=>`<div class="name-plate ${edit?'big':''}"><label ${edit?'for="nickname"':''}><em>PLAYER</em>玩家暱稱${edit?'（最多 8 字）':''}</label><div class="field">${edit?`<input id="nickname" maxlength="8" autocomplete="off" value="${escape(c?.nickname??'')}">`:`<span>${escape(c?.nickname??'')}</span>`}${icon('pencil')}</div><p class="hint">${edit?`預設暱稱已自動產生，可直接開始。<br>角色 ${characterName(character)}${c?.custom?'（客製化）':''} · 道具 ${escape(item.name)}`:'最後一步可修改暱稱'}</p></div>`;
  const card=(id:string,i:number,on:boolean,art:string,name:string,sub:string)=>`<button class="card character-card" aria-pressed="${on}" data-action="character-${id}"><span class="idx">0${i+1}</span><span class="art">${art}</span><span class="name"><strong>${name}</strong><small>${on?'已選擇 · SELECTED':sub}</small></span></button>`;
  // ponytail: two disabled slots reserved for executives (長官); unlock = add their id to characterIds and their art.
  const vip=(i:number)=>`<button class="card character-card locked" disabled data-action="character-vip-${i}"><span class="idx">0${i+1}</span><span class="art">${icon('lock')}</span><span class="name"><strong>VIP</strong><small>長官專用 · LOCKED</small></span></button>`;
  let body='';
  if(current===CHARACTER)body=`<div class="cards">${characterIds.map((id,i)=>card(id,i,!c?.custom&&character===id,`<img src="${pose(id)}" alt="">`,characterName(id),characterRole(id))).join('')}${card('custom',2,!!c?.custom,c?.photo?`<img class="photo" src="${c.photo}" alt="">`:icon('camera'),'CUSTOM','客製化 · 拍照頭像')}${vip(3)}${vip(4)}</div>${hero}${plate(false)}`;
  if(current===PHOTO)body=`<div class="booth"><div class="viewfinder">${c?.photo?`<img src="${c.photo}" alt="已拍攝的頭像">`:cameraError?`<p role="alert">${escape(cameraError)}<small>按「上一步」改選一般角色</small></p>`:'<video class="live" autoplay muted playsinline aria-label="攝影機預覽"></video>'}</div>${c?.photo?button('retake','重拍','RETAKE',false,'','retry'):button('shoot','拍照','TAKE PHOTO',!!cameraError,'primary','camera')}<p class="privacy">照片只在本機本次展示，不會保存</p></div><div class="cards bodies">${characterIds.map((id,i)=>card(id,i,character===id,`<img src="${look(c,id)}" alt="">`,characterName(id),'身體 · BODY')).join('')}</div>${hero}`;
  if(current===ITEM)body=`<div class="cards items">${ATTACK_ITEMS.map((it,i)=>{const m=weaponMode(it.src),on=c?.attackItem===it.src;return `<button class="card item-card" aria-pressed="${on}" data-action="item-${i}" style="--mode:${m.color??'#ffd54f'}"><span class="idx">0${i+1}</span><span class="art"><img src="${asset('items/攻擊道具/'+it.src)}" alt=""></span><span class="name"><strong>${escape(it.name)}</strong><small>${escape(it.feat)}</small><em>${m.tag??''}</em></span></button>`;}).join('')}</div>`;
  if(current===NICKNAME)body=hero+plate(true);
  const disabled=c?.assetState==='generating'||needsPhoto(c,step);
  return {classes:`readiness step-${en.toLowerCase()}`,html:`<p class="slogan">PLAY BEYOND<b>»</b>GAME FOR TOMORROW</p>${chips}<div class="section-title"><h2>${title}</h2><span>${titleEn}</span></div>${body}<div class="cta-pair"><span class="cta-wrap"><button class="cta prev" data-action="prev"><strong>上一步</strong><small>BACK</small></button></span><span class="cta-wrap"><button class="cta" data-action="ready" ${disabled?'disabled':''}><strong id="ready-label">${readyLabel(c,step)}</strong><small>${last?'START MISSION':'NEXT'}</small></button></span></div>`};
}
