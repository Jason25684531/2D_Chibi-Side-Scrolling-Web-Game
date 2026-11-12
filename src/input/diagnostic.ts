// Dev-only hardware page (/gamepad.html): raw Gamepad API state, per-device profile binding, JSON export.
import {ACTIONS,STANDARD,loadProfiles,saveProfile,profileFor,padActions,parseProfile,type Profile} from './gamepad';
import type {Action} from './adapter';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
const pads=()=>Array.from(navigator.getGamepads?.()??[]).filter((p):p is Gamepad=>!!p?.connected);
const source=(p:Gamepad)=>p.id in loadProfiles()?'SAVED':p.mapping==='standard'?'STANDARD DEFAULT':'NO PROFILE (device ignored by the game)';
const log:string[]=[];
const note=(message:string)=>{log.unshift(`${new Date().toISOString().slice(11,23)} ${message}`);log.length=Math.min(log.length,200);$('log').textContent=log.join('\n');};
window.addEventListener('gamepadconnected',e=>note(`CONNECTED index ${e.gamepad.index} · ${e.gamepad.id}`));
window.addEventListener('gamepaddisconnected',e=>note(`DISCONNECTED index ${e.gamepad.index} · ${e.gamepad.id}`));

/** Device id being configured, its unsaved profile, and the action waiting for a button press. */
let selected='',draft:Profile={buttons:{},axisX:0,axisY:1},binding:Action|null=null,signature='';
const previous=new Map<number,boolean[]>();

function select(pad:Gamepad|undefined){
  selected=pad?.id??'';binding=null;
  draft=structuredClone((pad&&profileFor(pad))??{buttons:{},axisX:0,axisY:1});
}
function controls(){
  const list=pads(),pad=list.find(p=>p.id===selected);
  if(!pad){$('controls').innerHTML='<p>沒有裝置可設定。</p>';return;}
  $('controls').innerHTML=`<div class="row"><label>裝置 <select id="device">${list.map(p=>`<option value="${esc(p.id)}"${p.id===selected?' selected':''}>#${p.index} ${esc(p.id)}</option>`).join('')}</select></label><span>目前來源：<b id="source">${source(pad)}</b></span></div>
    <table><tr><th>Action</th><th>Button index</th><th></th></tr>${ACTIONS.map(a=>`<tr><td>${a}</td><td data-indexes="${a}">${draft.buttons[a]?.join(', ')||'—'}</td><td><button data-bind="${a}" class="${binding===a?'wait':''}">${binding===a?'請按下按鍵…':'綁定'}</button> <button data-clear="${a}">清除</button></td></tr>`).join('')}</table>
    <div class="row"><label>X 軸 <input type="number" min="0" step="1" data-field="axisX" value="${draft.axisX}"></label><label>Y 軸 <input type="number" min="0" step="1" data-field="axisY" value="${draft.axisY}"></label><label>Deadzone <input type="number" min="0" max="0.99" step="0.01" data-field="deadzone" value="${draft.deadzone??''}" placeholder="預設"></label></div>
    <div class="row"><button id="save">儲存此裝置的 Profile</button><button id="forget">刪除已存 Profile</button>${pad.mapping==='standard'?'<button id="standard">載入 Standard 預設</button>':''}</div>`;
}
$('controls').addEventListener('click',event=>{
  const b=(event.target as HTMLElement).closest('button');if(!b)return;
  const pad=pads().find(p=>p.id===selected);
  if(b.dataset.bind)binding=binding===b.dataset.bind?null:b.dataset.bind as Action;
  else if(b.dataset.clear)delete draft.buttons[b.dataset.clear as Action];
  else if(b.id==='standard')draft=structuredClone(STANDARD);
  else if(b.id==='forget'&&selected){saveProfile(selected,null);note(`PROFILE DELETED · ${selected}`);select(pad);}
  else if(b.id==='save'&&selected){
    const valid=parseProfile(draft);
    if(!valid){note('PROFILE NOT SAVED · 軸必須是 0 以上的整數，deadzone 必須 ≥ 0 且 < 1');return;}
    try{saveProfile(selected,valid);note(`PROFILE SAVED · ${selected}`);}catch(error){note(`PROFILE NOT SAVED · ${String(error)}`);}
  }
  controls();
});
$('controls').addEventListener('change',event=>{
  const el=event.target as HTMLInputElement|HTMLSelectElement;
  if(el.id==='device'){select(pads().find(p=>p.id===el.value));controls();return;}
  const field=el.dataset.field;
  if(field==='deadzone'){if(el.value==='')delete draft.deadzone;else draft.deadzone=Number(el.value);}
  else if(field==='axisX'||field==='axisY')draft[field]=Number(el.value);
});
const report=()=>({generatedAt:new Date().toISOString(),userAgent:navigator.userAgent,note:$<HTMLInputElement>('note').value,
  gamepads:pads().map(p=>({id:p.id,index:p.index,mapping:p.mapping||'non-standard',connected:p.connected,buttonCount:p.buttons.length,axisCount:p.axes.length,
    buttons:p.buttons.map((b,index)=>({index,pressed:b.pressed,value:b.value})),axes:[...p.axes],profileSource:source(p),profile:profileFor(p)})),
  savedProfiles:loadProfiles(true),log});
$('export').addEventListener('click',()=>{
  const json=JSON.stringify(report(),null,2);$<HTMLTextAreaElement>('json').value=json;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([json],{type:'application/json'}));a.download=`gamepad-diagnostic-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});
function frame(){
  const list=pads();
  $('status').textContent=list.length?`${list.length} GAMEPAD CONNECTED`:'WAITING FOR GAMEPAD';$('status').dataset.state=list.length?'on':'waiting';
  let dirty=false;
  for(const p of list){
    const was=previous.get(p.index)??[];
    p.buttons.forEach((b,i)=>{
      if(b.pressed===!!was[i])return;
      note(`#${p.index} button ${i} ${b.pressed?'PRESSED':'RELEASED'}`);
      if(b.pressed&&binding&&p.id===selected){
        // ponytail: one button per action from this page; multi-button bindings need hand-edited JSON.
        const clash=ACTIONS.filter(a=>a!==binding&&draft.buttons[a]?.includes(i));
        if(clash.length)note(`WARNING button ${i} 也綁在 ${clash.join(', ')}：同一顆鍵會同時觸發（jump 與 confirm 同鍵會讓 P3 第一次跳躍就開始遊戲）`);
        draft.buttons[binding]=[i];binding=null;dirty=true;
      }
    });
    previous.set(p.index,p.buttons.map(b=>b.pressed));
  }
  for(const index of previous.keys())if(!list.some(p=>p.index===index))previous.delete(index);
  const next=list.map(p=>p.index+':'+p.id).join('|');
  if(next!==signature){signature=next;if(!list.some(p=>p.id===selected))select(list[0]);dirty=true;}
  if(dirty)controls();
  $('live').innerHTML=list.map(p=>`<section class="pad" data-pad="${p.index}"><dl><dt>Device ID</dt><dd>${esc(p.id)}</dd><dt>Gamepad Index</dt><dd>${p.index}</dd><dt>Mapping</dt><dd>${p.mapping==='standard'?'standard':`non-standard ("${esc(p.mapping)}")`}</dd><dt>Buttons / Axes</dt><dd>${p.buttons.length} / ${p.axes.length}</dd><dt>Profile</dt><dd>${source(p)}</dd><dt>Game actions</dt><dd data-actions>${[...padActions(p,.22)].join(' ')||'—'}</dd></dl>
    <div class="cells">${p.buttons.map((b,i)=>`<div class="cell${b.pressed?' on':''}" data-button="${i}">B${i}<br>${b.pressed?'PRESSED':b.value.toFixed(2)}</div>`).join('')}</div>
    <div class="cells" style="margin-top:6px">${p.axes.map((v,i)=>`<div class="cell${Math.abs(v)>.22?' on':''}" data-axis="${i}">AXIS ${i}<br>${v.toFixed(3)}</div>`).join('')}</div></section>`).join('');
  requestAnimationFrame(frame);
}
frame();
