import {ATTACK_ITEMS,weaponMode} from '../core/config';
import {asset,characterName,characterIds,pose,PRESETS,roleOf} from '../assets/catalog';
import {button,escape,icon} from './components';
import type {Identity} from './mock-station';
// P1 markup only; StationUI owns state, input, the camera stream and the ComfyUI job.
// [step chip, step chip EN, section title, section title EN].
const CHARACTER=['角色','CHARACTER','選擇角色','SELECT YOUR CHARACTER'],PHOTO=['拍照','PHOTO','拍照客製化','TAKE YOUR PHOTO'];
const ITEM=['道具','ITEM','選擇攻擊道具','SELECT YOUR ATTACK ITEM'],NICKNAME=['暱稱','NICKNAME','輸入暱稱','ENTER YOUR NICKNAME'];
/** Kiosk has only a stick: an on-screen keypad types the nickname. */
const KEYS=['1234567890','QWERTYUIOP','ASDFGHJKL⌫','ZXCVBNM'];
const keypad=`<div class="keypad" role="group" aria-label="暱稱鍵盤">${KEYS.map(row=>`<div>${[...row].map(k=>k==='⌫'?'<button class="key del" data-action="key-del" aria-label="刪除">⌫</button>':`<button class="key" data-action="key-${k}">${k}</button>`).join('')}</div>`).join('')}</div>`;
/** CUSTOM inserts the photo step; a preset goes straight to the item. */
export const readinessSteps=(c?:Identity)=>c?.custom?[CHARACTER,PHOTO,ITEM,NICKNAME]:[CHARACTER,ITEM,NICKNAME];
const onPhoto=(c:Identity|undefined,step:number)=>readinessSteps(c)[step]===PHOTO;
/** On the photo step with nothing shot yet: NEXT stays off. */
export const needsPhoto=(c:Identity|undefined,step:number)=>onPhoto(c,step)&&!c?.photo;
/** Confirming this step sends the photo to ComfyUI (nothing in flight or delivered for it). */
export const willSubmit=(c:Identity|undefined,step:number)=>onPhoto(c,step)&&!!c?.photo&&['none','failed'].includes(c.generation.state);
export const readyLabel=(c:Identity|undefined,step:number)=>willSubmit(c,step)?'生成角色':step<readinessSteps(c).length-1?'下一步':'開始任務';
/** The custom skin once ComfyUI delivered it, else the chosen preset. */
export const skinOf=(c?:Identity)=>c?.generation.state==='ready'?c.generation.skin:PRESETS[roleOf(c?.characterId)];
export const genText=(c?:Identity)=>({none:'預設角色',generating:'專屬角色生成中',ready:'專屬角色完成',failed:'生成未完成，已改用原角色'})[c?.generation.state??'none'];

/** Layout A: cards + hero; every step defaults so repeated confirms start the run. The split CTA never moves. comfy: probe result, undefined while checking. */
export function readiness(c:Identity|undefined,step:number,cameraError='',comfy?:boolean){
  const steps=readinessSteps(c),current=steps[step],[,en,title,titleEn]=current,character=c?.characterId??characterIds[0],last=step===steps.length-1;
  const item=ATTACK_ITEMS.find(i=>i.src===c?.attackItem)??ATTACK_ITEMS[0];
  const chips=`<ol class="steps">${steps.map(([zh,e],i)=>`<li data-state="${i<step?'done':i===step?'active':'todo'}"><b>0${i+1}</b>${zh}<small>${e}</small></li>`).join('')}</ol>`;
  const hero=`<div class="hero"><div class="plate"><span>ROG FUTURE GAMER</span></div><img src="${skinOf(c).poses.attack}" alt="${escape(characterName(character))}"></div>`;
  const plate=(edit:boolean)=>`<div class="name-plate ${edit?'big':''}"><label ${edit?'for="nickname"':''}><em>PLAYER</em>玩家暱稱${edit?'（最多 8 字）':''}</label><div class="field">${edit?`<input id="nickname" maxlength="8" autocomplete="off" value="${escape(c?.nickname??'')}">`:`<span>${escape(c?.nickname??'')}</span>`}${icon('pencil')}</div>${edit?keypad:''}<p class="hint">${edit?`預設暱稱已自動產生，可直接開始。<br>角色 ${characterName(character)}${c?.custom?'（客製化）':''} · 道具 ${escape(item.name)}`:'最後一步可修改暱稱'}</p></div>`;
  const card=(id:string,i:number,on:boolean,art:string,name:string,sub:string,disabled=false)=>`<button class="card character-card" aria-pressed="${on}" data-action="character-${id}" ${disabled?'disabled':''}><span class="idx">0${i+1}</span><span class="art">${art}</span><span class="name"><strong>${name}</strong><small>${on?'已選擇 · SELECTED':sub}</small></span></button>`;
  const presets=(on:(id:string)=>boolean,sub:(i:number)=>string)=>characterIds.map((id,i)=>card(id,i,on(id),`<img src="${pose(id)}" alt="">`,characterName(id),sub(i))).join('');
  let body='';
  if(current===CHARACTER){
    const custom=!!c?.custom;
    body=`<div class="cards">${presets(id=>!custom&&character===id,i=>`CHARACTER 0${i+1}`)}${card('custom',characterIds.length,custom,c?.photo?`<img class="photo" src="${c.photo}" alt="">`:icon('camera'),'CUSTOM',comfy===false?'AI 角色生成暫時無法使用':comfy===undefined&&!custom?'檢查中…':'拍照 · AI 生成',comfy!==true&&!custom)}</div>${hero}${plate(false)}`;
  }
  if(current===PHOTO){
    // The preview and the shot are mirrored by CSS like a mirror; the uploaded photo is not.
    const viewfinder=c?.photo?`<img src="${c.photo}" alt="已拍攝的照片">`:cameraError?`<p role="alert">${escape(cameraError)}<small>按「上一步」改選預設角色</small></p>`:'<video class="live" autoplay muted playsinline aria-label="攝影機預覽"></video>';
    body=`<div class="booth"><div class="viewfinder">${viewfinder}</div>${c?.photo?button('retake','重拍','RETAKE',false,'','retry'):button('shoot','拍照','TAKE PHOTO',!!cameraError,'primary','camera')}<p class="privacy">照片將上傳至 AI 服務生成角色，並暫存於本站台電腦</p></div><div class="cards bodies">${presets(id=>character===id,()=>'身體 · BODY')}</div>${hero}`;
  }
  if(current===ITEM)body=`<div class="cards items">${ATTACK_ITEMS.map((it,i)=>{const m=weaponMode(it.src),on=c?.attackItem===it.src;return `<button class="card item-card" aria-pressed="${on}" data-action="item-${i}" style="--mode:${m.color??'#ffd54f'}"><span class="idx">0${i+1}</span><span class="art"><img src="${asset('items/攻擊道具/'+it.src)}" alt=""></span><span class="name"><strong>${escape(it.name)}</strong><small>${escape(it.feat)}</small><em>${m.tag??''}</em></span></button>`;}).join('')}</div>`;
  if(current===NICKNAME)body=hero+plate(true);
  return {classes:`readiness step-${en.toLowerCase()}`,html:`<p class="slogan">PLAY BEYOND<b>»</b>GAME FOR TOMORROW</p>${chips}<div class="section-title"><h2>${title}</h2><span>${titleEn}</span></div>${body}<div class="cta-pair"><span class="cta-wrap"><button class="cta prev" data-action="prev"><strong>上一步</strong><small>BACK</small></button></span><span class="cta-wrap"><button class="cta" data-action="ready" ${needsPhoto(c,step)?'disabled':''}><strong id="ready-label">${readyLabel(c,step)}</strong><small>${last?'START MISSION':'NEXT'}</small></button></span></div>`};
}
