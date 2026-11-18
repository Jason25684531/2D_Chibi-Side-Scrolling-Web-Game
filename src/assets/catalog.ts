import assets from '../level/data/assets.json';
import skins from '../level/data/skins.json';
import {ROLES,parseManifest,type CharacterSkin,type RoleCode} from '../comfy/skin';
// Phaser-free lookups shared by the DOM UI and the scene.
/** Staged URL for a package path relative to game/ (see tools/stage-assets.py). */
export const asset=(key:string)=>(assets as Record<string,{url:string}>)[key]?.url??'';
export const characterIds=ROLES;
/** The four Taskforce presets, staged from assest/ by tools/stage-assets.py. */
export const PRESETS=Object.fromEntries(ROLES.map(r=>[r,{...parseManifest(skins[r].manifest,r,u=>u),id:r,custom:false,poses:skins[r].poses}])) as Record<RoleCode,CharacterSkin>;
/** Feet line, body height and horizontal centre as fractions of a sheet cell. Custom skins reuse their role's (same alignment reference). */
export const CALIBRATION=Object.fromEntries(ROLES.map(r=>[r,{foot:skins[r].foot,body:skins[r].body,cx:skins[r].cx}])) as Record<RoleCode,{foot:number;body:number;cx:number}>;
/** Records written before the Taskforce roster stored a / b. */
export const roleOf=(id?:string):RoleCode=>id==='b'?'S2AM':ROLES.includes(id as RoleCode)?id as RoleCode:'S3WW';
export const characterName=(id?:string)=>roleOf(id);
export const pose=(id?:string,frame:keyof CharacterSkin['poses']='idle')=>PRESETS[roleOf(id)].poses[frame];
