import badge from '../../assets/badge-manifest.json';
export const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const characterIds=['aria','kael','riven'] as const;
export const avatar=(id='aria')=>`<div class="avatar"><img src="/assets/ui/${characterIds.includes(id as typeof characterIds[number])?id:'aria'}.png" alt="${escape(id.toUpperCase())}"></div>`;
export const stat=(label:string,value:unknown)=>`<div class="stat"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`;
export const button=(id:string,zh:string,en:string,disabled=false)=>`<button data-action="${id}" ${disabled?'disabled':''}><strong>${zh}</strong><small>${en}</small></button>`;
export const panel=(title:string,body:string,style='')=>`<section class="panel ${style}"><h2>${title}</h2>${body}</section>`;
export const badgeIcon=()=>`<img class="badge-icon" src="${badge.runtimeUrl}" alt="ROG Badge">`;
export const time=(seconds:number)=>`${Math.floor(Math.max(0,seconds)/60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,seconds)%60).toString().padStart(2,'0')}`;
export function focus(root:HTMLElement,direction=0,preferred?:string){
  const buttons=Array.from(root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
  (buttons.find(b=>b.dataset.action===preferred)??buttons[(Math.max(0,current)+direction+buttons.length)%buttons.length])?.focus();
}
export function text(root:HTMLElement,id:string,value:unknown){const node=root.querySelector('#'+id);if(node&&node.textContent!==String(value))node.textContent=String(value);}
