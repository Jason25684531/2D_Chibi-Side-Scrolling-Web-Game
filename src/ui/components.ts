import level from '../level/data/level.json';
import {asset,pose,characterName} from '../assets/catalog';
import type {Ranking} from './mock-station';
export const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
// Editable SVG geometry, no icon font (manifest asset rule).
const ICONS:Record<string,string>={
  retry:'<path d="M20 12a8 8 0 11-2.3-5.7M20 3v5h-5"/>',next:'<path d="M5 5l7 7-7 7M13 5l7 7-7 7"/>',
  home:'<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>',exit:'<path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10"/>',list:'<path d="M4 6h16M4 12h16M4 18h10"/>',
  clock:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',badge:'<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 8l4 2.3v4.4L12 17l-4-2.3v-4.4z"/>',
  skull:'<path d="M4 11a8 8 0 0116 0v4a2 2 0 01-2 2v3H6v-3a2 2 0 01-2-2z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/>',
  combo:'<path d="M13 2L5 14h6l-1 8 9-13h-6z"/>',bounce:'<path d="M4 20c4-10 8-14 16-16M14 4h6v6"/>',bolt:'<path d="M3 12h9M12 12l4-4M12 12l4 4M17 6h4v12h-4z"/>',
  star:'<path d="M12 3l2.8 6 6.2.8-4.5 4.3 1.2 6.3L12 17.3 6.3 20.4l1.2-6.3L3 9.8 9.2 9z"/>',pencil:'<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M12 8l4 4"/>',
  camera:'<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="4"/>',lock:'<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 018 0v4"/>'
};
export const icon=(key:string)=>ICONS[key]?`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[key]}</svg>`:'';
export const avatar=(id='a',frame:Parameters<typeof pose>[1]='idle1',src=pose(id,frame))=>`<div class="avatar"><img src="${src}" alt="${escape(characterName(id))}"></div>`;
/** Icon + bilingual label + right-aligned value; `extra` is trusted markup after the value. */
export const statRow=(ic:string,zh:string,en:string,value:unknown,cls='',extra='')=>`<div class="stat">${icon(ic)}<span class="lbl">${zh}<small>${en}</small></span><strong class="val ${cls}">${escape(value)}${extra}</strong></div>`;
/** variant: '' secondary | primary | ghost. Same markup and CSS on every screen. */
export const button=(id:string,zh:string,en:string,disabled=false,variant='',ic='')=>`<button class="btn ${variant}" data-action="${id}" ${disabled?'disabled':''}>${icon(ic)}<span><strong>${zh}</strong><small>${en}</small></span></button>`;
export const chip=(html:string,dot='')=>`<span class="chip">${dot?`<i class="${dot}"></i>`:''}${html}</span>`;
export const titleTag=(text:string)=>`<span class="title-badge">${escape(text)}<small>TITLE</small></span>`;
export const rankRow=(rank:number,r:Ranking,you:boolean)=>`<div class="rank-row ${you?'you':''}" ${you?'aria-current="true"':''}><b>${String(rank).padStart(2,'0')}</b><img src="${pose(r.characterId)}" alt=""><span title="${escape(r.nickname)}">${escape(r.nickname)}</span><em>${r.score.toLocaleString()}</em></div>`;
export const panel=(title:string,body:string,style='')=>`<section class="panel ${style}"><h2>${title}</h2>${body}</section>`;
export const badgeIcon=()=>`<img class="badge-icon" src="${asset('items/'+level.itemArt.badge.art)}" alt="ROG Badge">`;
export const time=(seconds:number)=>`${Math.floor(Math.max(0,seconds)/60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,seconds)%60).toString().padStart(2,'0')}`;
export function focus(root:HTMLElement,direction=0,preferred?:string){
  const buttons=Array.from(root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
  (buttons.find(b=>b.dataset.action===preferred)??buttons[(Math.max(0,current)+direction+buttons.length)%buttons.length])?.focus();
}
export function text(root:HTMLElement,id:string,value:unknown){const node=root.querySelector('#'+id);if(node&&node.textContent!==String(value))node.textContent=String(value);}
