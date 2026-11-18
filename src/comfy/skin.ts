// One character skin shape for both staged presets and ComfyUI output (taskforce_2028_sprite_manifest.v1). Phaser-free.
/** Order = ComfyUI workflow template index − 1. */
export const ROLES=['S2AM','S3WW','S1WM','S2WW'] as const;
export type RoleCode=typeof ROLES[number];
/** `turn` exists in the manifest but the controller has no turn state. */
export const ACTIONS=['idle','run','jump','djump','fall','attack'] as const;
export type ActionId=typeof ACTIONS[number];
/** px per runtime sheet cell; tools/stage-assets.py SKIN_CELL must match. */
export const SKIN_CELL=256;
export type Sheet={sheet:string;cols:number;rows:number;frameCount:number;fps:number};
export type CharacterSkin={id:string;role:RoleCode;custom:boolean;actions:Record<ActionId,Sheet>;poses:Record<'idle'|'attack'|'jump',string>};
export const sheetKey=(skin:CharacterSkin,action:ActionId)=>`${skin.id}/${action}`;
const count=(v:unknown):v is number=>Number.isInteger(v)&&(v as number)>0;
/** game_manifest.json → sheet geometry; throws on anything the renderer could not draw. `url` maps sprite_sheet paths. */
export function parseManifest(raw:unknown,role:RoleCode,url:(rel:string)=>string){
  const m=raw as {schema?:unknown;role_code?:unknown;actions?:unknown}|null;
  if(m?.schema!=='taskforce_2028_sprite_manifest.v1')throw new Error('manifest schema');
  if(m.role_code!==role)throw new Error(`manifest role ${String(m.role_code)} is not ${role}`);
  if(!Array.isArray(m.actions))throw new Error('manifest actions');
  const actions={} as Record<ActionId,Sheet>;
  for(const id of ACTIONS){
    const a=m.actions.find(x=>x?.id===id);
    if(!a||typeof a.sprite_sheet!=='string'||![a.rows,a.cols,a.frame_count,a.fps].every(count)||a.frame_count>a.rows*a.cols)throw new Error(`manifest action ${id}`);
    actions[id]={sheet:url(a.sprite_sheet),cols:a.cols,rows:a.rows,frameCount:a.frame_count,fps:a.fps};
  }
  return {role,actions};
}
