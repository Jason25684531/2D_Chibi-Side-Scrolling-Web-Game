import {ACTIONS,ROLES,SKIN_CELL,parseManifest,type CharacterSkin,type RoleCode} from './skin';
// Station ↔ local ComfyUI (Taskforce 2028 Platformer CAM workflow), same-origin through the /comfy proxy (vite.config.ts).
const BASE='/comfy';
const OUTPUT_ROOT='Taskforce_2028_Platformer';
/** Observed runs: 84–141 s in ComfyUI /history, 186 s in the 2026-11-17 end-to-end run. Calibration knobs. */
export const TIMEOUT=240_000,POLL=2_000;
const POSE_H=1024,ALPHA_CUT=32;
export type Generation=
  |{state:'none'}
  |{state:'generating';outputName:string;startedAt:number;promptId?:string}
  |{state:'ready';skin:CharacterSkin}
  |{state:'failed';reason:'offline'|'rejected'|'error'|'timeout'|'bad-output'};
type Workflow=Record<string,{class_type:string;inputs:Record<string,unknown>}>;
const JSON_HEADERS={'Content-Type':'application/json'};
const ok=async(r:Response)=>{if(!r.ok)throw new Error(`${r.url} ${r.status}`);return r;};
let workflow:Promise<Workflow|null>|undefined;
// ponytail: staged once per page load; reload the station after re-staging.
const loadWorkflow=()=>workflow??=fetch('/assets/comfy/workflow.api.json').then(r=>r.json()).catch(()=>null);

/** Node 1 = template index (1–4), node 2 = output folder name, node 3 = uploaded photo. */
export function fillWorkflow(wf:Workflow,role:RoleCode,outputName:string,image:string):Workflow{
  const out=structuredClone(wf);
  out['1'].inputs.value=ROLES.indexOf(role)+1;out['2'].inputs.String=outputName;out['3'].inputs.image=image;
  return out;
}
/** ComfyUI answers within 2 s and the workflow was staged. */
export async function probe(){
  try{const [stats,wf]=await Promise.all([fetch(BASE+'/system_stats',{signal:AbortSignal.timeout(2000)}),loadWorkflow()]);return stats.ok&&!!wf;}
  catch{return false;}
}
export const newOutputName=()=>'P'+crypto.randomUUID().replace(/-/g,'').slice(0,12);
/** Removes a queued job and stops it if it is running. Fire and forget. */
export function cancel(promptId:string){
  for(const [path,body] of [['/queue',{delete:[promptId]}],['/interrupt',{prompt_id:promptId}]] as const)
    void fetch(BASE+path,{method:'POST',headers:JSON_HEADERS,body:JSON.stringify(body)}).catch(()=>{});
}
async function submit(photo:string,role:RoleCode,outputName:string){
  const form=new FormData();
  form.append('image',await (await fetch(photo)).blob(),outputName+'.png');form.append('subfolder','station');form.append('type','input');form.append('overwrite','true');
  const up=await (await ok(await fetch(BASE+'/upload/image',{method:'POST',body:form}))).json() as {name:string;subfolder:string};
  const wf=await loadWorkflow();if(!wf)throw new Error('workflow not staged');
  const res=await fetch(BASE+'/prompt',{method:'POST',headers:JSON_HEADERS,body:JSON.stringify({prompt:fillWorkflow(wf,role,outputName,up.subfolder?`${up.subfolder}/${up.name}`:up.name)})});
  const body=await res.json().catch(()=>null) as {prompt_id?:string}|null;
  if(!res.ok||!body?.prompt_id)throw Object.assign(new Error('prompt rejected '+JSON.stringify(body)),{reason:'rejected'});
  return body.prompt_id;
}
/** History has an entry only once the prompt finished. */
async function poll(promptId:string){
  const h=await (await ok(await fetch(`${BASE}/history/${promptId}`))).json() as Record<string,{status?:{status_str?:string}}>;
  return !h[promptId]?'pending':h[promptId].status?.status_str==='success'?'success':'error';
}
const load=async(src:string)=>{const image=new Image();image.src=src;await image.decode();return image;};
const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
/** The default 'low' smoothing aliases a 4x downscale (2048 sheet to 512). */
const draw=(c:HTMLCanvasElement)=>{const g=c.getContext('2d')!;g.imageSmoothingQuality='high';return g;};
/** Cell 0 trimmed to its opaque pixels, at most POSE_H tall: the same rule the staging script uses for presets. */
function pose(image:HTMLImageElement,cols:number,rows:number){
  const cw=image.width/cols,ch=image.height/rows,cell=canvas(cw,ch),g=cell.getContext('2d',{willReadFrequently:true})!;
  g.drawImage(image,0,0,cw,ch,0,0,cw,ch);
  const a=g.getImageData(0,0,cw,ch).data;let l=cw,t=ch,r=-1,b=-1;
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(a[(y*cw+x)*4+3]>ALPHA_CUT){if(x<l)l=x;if(x>r)r=x;if(y<t)t=y;if(y>b)b=y;}
  if(r<0)throw new Error('empty pose cell');
  const w=r-l+1,h=b-t+1,k=Math.min(1,POSE_H/h),out=canvas(Math.round(w*k),Math.round(h*k));
  draw(out).drawImage(cell,l,t,w,h,0,0,out.width,out.height);
  return out.toDataURL('image/webp',.9);
}
/** Reads <output>/manifest/game_manifest.json and its sheets, downscaled to SKIN_CELL per cell like the staged presets. */
async function fetchSkin(outputName:string,role:RoleCode):Promise<CharacterSkin>{
  const dir=`${OUTPUT_ROOT}/${outputName}_${role}`;
  const view=(rel:string)=>{const i=rel.lastIndexOf('/');return `${BASE}/view?${new URLSearchParams({filename:rel.slice(i+1),subfolder:i<0?dir:`${dir}/${rel.slice(0,i)}`,type:'output'})}`;};
  const {actions}=parseManifest(await (await ok(await fetch(view('manifest/game_manifest.json')))).json(),role,view);
  const images=await Promise.all(ACTIONS.map(a=>load(actions[a].sheet)));
  ACTIONS.forEach((a,i)=>{const s=actions[a],c=canvas(s.cols*SKIN_CELL,s.rows*SKIN_CELL);draw(c).drawImage(images[i],0,0,c.width,c.height);s.sheet=c.toDataURL('image/webp',.9);});
  const at=(a:typeof ACTIONS[number])=>pose(images[ACTIONS.indexOf(a)],actions[a].cols,actions[a].rows);
  return {id:outputName,role,custom:true,actions,poses:{idle:at('idle'),attack:at('attack'),jump:at('jump')}};
}
/** Cancels whatever `who` is generating and resets it; returns the previous state so the caller can free a ready skin. */
export function drop(who:{generation:Generation}){
  const g=who.generation;if(g.state==='generating'&&g.promptId)cancel(g.promptId);
  who.generation={state:'none'};return g;
}
/**
 * One submission, driven to ready or failed on `who.generation`. Once that state is replaced (retake, preset, exit → drop())
 * the run stops and never writes again, so a late result cannot reach another player.
 */
export async function generate(who:{generation:Generation},photo:string,role:RoleCode,prepare:(skin:CharacterSkin)=>Promise<void>,discard:(skin:CharacterSkin)=>void){
  const g:Extract<Generation,{state:'generating'}>={state:'generating',outputName:newOutputName(),startedAt:performance.now()};who.generation=g;
  const live=()=>who.generation===g;
  let reason:Extract<Generation,{state:'failed'}>['reason']='offline';
  // Its own clock, so a request ComfyUI never answers still ends in a fallback.
  const deadline=setInterval(()=>{if(live()&&performance.now()-g.startedAt>TIMEOUT){if(g.promptId)cancel(g.promptId);console.warn('[comfy] generation timed out');who.generation={state:'failed',reason:'timeout'};}},POLL);
  try{
    g.promptId=await submit(photo,role,g.outputName);
    if(!live())return cancel(g.promptId);
    for(;;){
      await new Promise(r=>setTimeout(r,POLL));
      if(!live())return;
      const status=await poll(g.promptId);
      if(status==='error'){reason='error';throw new Error('workflow error');}
      if(status==='success')break;
    }
    if(!live())return;
    reason='bad-output';
    const skin=await fetchSkin(g.outputName,role);await prepare(skin);
    if(live())who.generation={state:'ready',skin};else discard(skin);
  }catch(error){
    if(!live())return;
    console.warn('[comfy] generation failed',(error as {reason?:string}).reason??reason,error);
    who.generation={state:'failed',reason:(error as {reason?:typeof reason}).reason??reason};
  }finally{clearInterval(deadline);}
}
