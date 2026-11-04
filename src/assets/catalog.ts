import assets from '../level/data/assets.json';
import charA from '../level/data/char-a.json';
import charB from '../level/data/char-b.json';
// Phaser-free lookups shared by the DOM UI and the scene.
/** Staged URL for a package path relative to game/ (see tools/stage-assets.py). */
export const asset=(key:string)=>(assets as Record<string,{url:string}>)[key]?.url??'';
export const CHARACTERS={a:charA,b:charB};
export const characterIds=['a','b'] as const;
export const characterName=(id?:string)=>id==='b'?'S2AM':'S3WW';
/** Character strings live here only; swap when planning supplies Chinese names. */
export const characterRole=(id?:string)=>id==='b'?'角色 B · CHARACTER B':'角色 A · CHARACTER A';
/** Custom avatar face circle per body and frame: centre x/y and diameter as fractions of the pose image. Calibration knobs. */
export const FACE={a:{idle1:{x:.5,y:.39,d:.26},attack1:{x:.63,y:.42,d:.24}},b:{idle1:{x:.51,y:.33,d:.28},attack1:{x:.48,y:.35,d:.26}}};
/** One existing frame: idle1 for cards/avatars, attack1 for hero, jump for GOAL (DESIGN.md decision 6). */
export const pose=(id?:string,frame:keyof typeof charA.frames='idle1')=>asset('chars/'+CHARACTERS[id==='b'?'b':'a'].frames[frame]);
