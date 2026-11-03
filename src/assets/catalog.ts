import assets from '../level/data/assets.json';
import charA from '../level/data/char-a.json';
import charB from '../level/data/char-b.json';
// Phaser-free lookups shared by the DOM UI and the scene.
/** Staged URL for a package path relative to game/ (see tools/stage-assets.py). */
export const asset=(key:string)=>(assets as Record<string,{url:string}>)[key]?.url??'';
export const CHARACTERS={a:charA,b:charB};
export const characterIds=['a','b'] as const;
export const characterName=(id?:string)=>id==='b'?'S2AM':'S3WW';
export const portrait=(id?:string)=>asset('chars/'+CHARACTERS[id==='b'?'b':'a'].frames.idle1);
