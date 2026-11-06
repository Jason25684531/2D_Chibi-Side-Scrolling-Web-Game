/// <reference types="vite/client" />
import type Phaser from 'phaser';
import type {EventKind,GameplayEventBus} from '../core/events';
// Audio/橫向卷軸_動作音效對照表.xlsx「音效清單」: ID → file in /Audio, volume. Volumes are the calibration knob
// (measured loudness differs by ~30 dB between files; station = 66" TV in a noisy hall).
export const SFX={
  'UI-01':['UI-01_cursor move.mp3',.4],'UI-02':['UI-02_confirm.mp3',1],'UI-03':['UI-03_cancel.mp3',.9],'UI-04':['UI-04_pause.mp3',.9],
  'ANN-01':['ANN-01_ready.mp3',.9],'ANN-02':['ANN-02_start.mp3',.9],'ANN-03':['ANN-03_complete.mp3',1],'ANN-04':['ANN-04_times Up.mp3',.9],
  'MOV-01':['MOV-01_move.mp3',.35],'MOV-02':['MOV-02_jump.mp3',.7],'MOV-03':['MOV-03_jump_double.mp3',.7],'MOV-04':['MOV-04_landing.wav',1],
  'MOV-05':['MOV-05_dash.wav',1],'MOV-06':['MOV-06_fall_electric.wav',.7],
  'HIT-01':['HIT-01_stomp.mp3',.6],'HIT-02':['HIT-02_enemy defeat.mp3',.8],'HIT-03':['HIT-03_hurt.mp3',.8],'HIT-04':['HIT-04_rog logo power bash.mp3',.6],
  'PWR-01':['PWR-01_crystal pickup.mp3',.5],'PWR-02':['PWR-02_crystal scatter.mp3',.9],'PWR-03':['PWR-03_accessory pickup.mp3',.6],
  'PWR-04':['PWR-04_accessory toss.mp3',.7],'PWR-05':['PWR-05_toss hit.mp3',.8],'PWR-06':['PWR-06_rog logo grow.mp3',1],'PWR-07':['PWR-07_rog logo duration.mp3',.5],
  // ponytail: the package names the rush file ENM-01 too; the sheet ID is ENM-02.
  'ENM-01':['ENM-01_charger alert.mp3',1],'ENM-02':['ENM-01_charger rush.mp3',.5],'ENM-03':['ENM-03_shooter alert.wav',.6],'ENM-04':['ENM-04_shooter laser.mp3',.5],
  'SYS-01':['SYS-01_countdown beeping.mp3',1],'SYS-02':['SYS-02_respawn.mp3',.7],'SYS-03':['SYS-03_stage clear jingle.mp3',.7],'SYS-04':['SYS-04_time whistle.mp3',1],
  'SYS-05':['SYS-05_score counting 01-2.mp3',1],'SYS-06':['SYS-06_title get.mp3',.9],
  'ENV-01':['ENV-01_spring.mp3',.8],'ENV-02':['ENV-02_portal loop.mp3',.8],'ENV-03':['ENV-03_portal entering.mp3',1],'ENV-04':['ENV-04_stage amb.mp3',.2],
} as const satisfies Record<string,readonly [string,number]>;
export type SfxId=keyof typeof SFX;
/** Sheet 播放類型 = Loop. */
const LOOP=new Set<SfxId>(['PWR-07','ENV-02','ENV-04']);
/** Gameplay events → [sound, delay s, counted from the end of this sound]. Sheet rows 08 拾取, 09/10 Power-up, 11 受傷, 13 跌倒, 18 Portal, 20 時間到. */
const ON:Partial<Record<EventKind,[SfxId,number,SfxId?][]>>={
  BADGE_COLLECTED:[['PWR-01',0]],BADGE_SCATTERED:[['PWR-02',0]],PLAYER_DAMAGED:[['HIT-03',0]],PLAYER_RESPAWNED:[['SYS-02',0]],
  GOAL_REACHED:[['ENV-03',0],['SYS-03',0,'ENV-03'],['ANN-03',.8,'ENV-03']], // PO 2026-11-05: portal first, then the clear jingleTIME_UP:[['SYS-04',0],['ANN-04',.4],['SYS-03',.4]],
};
const URLS=import.meta.glob('../../Audio/*.{mp3,wav}',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
let sound:Phaser.Sound.BaseSoundManager|null=null;
const held=new Map<SfxId,Phaser.Sound.BaseSound>();
export function loadSfx(scene:Phaser.Scene){sound=scene.sound;for(const [id,[file]] of Object.entries(SFX))scene.load.audio(id,URLS['../../Audio/'+file]);}
const ready=(id:SfxId)=>!!sound?.game.cache.audio.exists(id); // missing audio is silent, never an error (missing assets never stop the kiosk)
/** Clip length in s (Web Audio buffer); 0 when unknown, so a chained cue then plays at once. */
const length=(id:SfxId)=>ready(id)?(sound!.game.cache.audio.get(id) as AudioBuffer).duration??0:0;
export function sfx(id:SfxId,delay=0){if(ready(id))sound!.play(id,{volume:SFX[id][1],delay});}
/** Plays while level > 0 (level scales the table volume), pauses at 0 so a resume stays in sync. Call every frame.
 *  A one-shot that has finished stays silent until stopHeld(). */
export function hold(id:SfxId,level:number){
  if(!ready(id))return;
  let s=held.get(id) as Phaser.Sound.WebAudioSound|undefined;
  if(level<=0){if(s?.isPlaying)s.pause();return;}
  if(!s){held.set(id,s=sound!.add(id,{loop:LOOP.has(id),volume:level*SFX[id][1]}) as Phaser.Sound.WebAudioSound);s.play();}
  s.setVolume(level*SFX[id][1]);
  if(s.isPaused)s.resume();
}
/** End of a run: the next hold() starts every sound from the top. */
export function stopHeld(){for(const s of held.values())s.destroy();held.clear();}
export function listen(bus:GameplayEventBus){for(const [kind,list] of Object.entries(ON))bus.on(kind,()=>list.forEach(([id,delay,after])=>sfx(id,delay+(after?length(after):0))));
  bus.on('POWERUP_ACTIVATED',(e:{cause:string})=>sfx(e.cause==='ally'?'PWR-06':'PWR-03'));}
