import Phaser from 'phaser';
import level from '../level/data/level.json';
import {TILE as T} from '../core/config';
import {CALIBRATION} from './catalog';
import {ACTIONS,sheetKey,type ActionId,type CharacterSkin} from '../comfy/skin';
/** DASH and WIN have no art of their own: run and idle stand in (exp3-asset-manifest). */
const ACTION:Record<string,ActionId>={IDLE:'idle',RUN:'run',JUMP:'jump',DOUBLE_JUMP:'djump',FALL:'fall',HURT:'fall',DASH:'run',WIN:'idle'};
/** Standing body height in cells (planning: about 2.25 cells). Calibration knob. */
const BODY_CELLS=2.25;
/** Editor `big`: the invincible player is drawn 1.25x. */
const ALLY_SCALE=1.25;
/** Editor easeBack (shield pop). */
const easeBack=(k:number)=>{k=Phaser.Math.Clamp(k,0,1);return 1+2.7*(k-1)**3+1.7*(k-1)**2;};
/** Editor drawShield: two counter-rotating layers (second additive), soft red fill, breathing, pop-in, blink when left < 2.5 s,
 *  brighter for 0.35 s after a kill. D = diameter px; ph = seconds since it appeared. */
export class Shield {
  a:Phaser.GameObjects.Image;b:Phaser.GameObjects.Image;g:Phaser.GameObjects.Graphics;
  constructor(scene:Phaser.Scene,depth:number){
    const key='items/'+level.itemArt.shield.art;
    this.g=scene.add.graphics().setDepth(depth);this.a=scene.add.image(0,0,key).setDepth(depth);this.b=scene.add.image(0,0,key).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
    this.hide();
  }
  draw(x:number,y:number,D:number,t:number,o:{ph?:number;left?:number;flash?:number}={}){
    const ph=o.ph??9,pop=Math.min(1,ph/.4),ez=pop>=1?1:easeBack(pop),flash=o.flash??0;
    let al=Math.min(1,ph/.25);if(o.left!==undefined&&o.left<2.5)al*=.6+.4*Math.sin(t*16);
    const R=Math.max(.01,D/2*ez*(1+.03*Math.sin(t*3)));
    // ponytail: one ring stands in for the editor's radial gradient (transparent at .4R → 16% red at R).
    this.g.clear().setVisible(true).lineStyle(R*.45,0xff5a6e,.1*al).strokeCircle(x,y,R*.78);
    this.a.setVisible(true).setPosition(x,y).setDisplaySize(R*2,R*2).setRotation(t*.7).setAlpha(al*Math.min(1,.85+.15*flash));
    this.b.setVisible(true).setPosition(x,y).setDisplaySize(R*1.92,R*1.92).setRotation(-t*1.1+2.1).setAlpha(al*(.3+.25*flash));
  }
  hide(){this.g.clear().setVisible(false);this.a.setVisible(false);this.b.setVisible(false);}
  destroy(){this.g.destroy();this.a.destroy();this.b.destroy();}
}
/** Power state for one frame: ally = seconds left (0 = none), since = seconds since it began, hit = run time of the last shield kill. */
export type PowerView={ally:number;since:number;hit:number;blink:boolean};
/** Registers a skin's sheets as Phaser spritesheets (presets are already loaded by PreloadScene). */
export async function addSheets(textures:Phaser.Textures.TextureManager,skin:CharacterSkin){
  for(const a of ACTIONS){
    const key=sheetKey(skin,a),s=skin.actions[a];if(textures.exists(key))continue;
    const image=new Image();image.src=s.sheet;await image.decode();
    if(!textures.exists(key))textures.addSpriteSheet(key,image,{frameWidth:image.width/s.cols,frameHeight:image.height/s.rows});
  }
}
export const removeSheets=(textures:Phaser.Textures.TextureManager,skin:CharacterSkin)=>{for(const a of ACTIONS)textures.remove(sheetKey(skin,a));};
// Sheet cells are padded squares; CALIBRATION puts the feet on the collision-box bottom and sizes the body to BODY_CELLS.
export class CharacterView {
  sprite:Phaser.GameObjects.Image;shield:Shield;
  private action:ActionId|'' ='';private since=0;private attackAt=-1;
  constructor(scene:Phaser.Scene,private box:Phaser.GameObjects.Rectangle,public skin:CharacterSkin,debug=false) {
    box.setAlpha(debug?.4:0);
    this.sprite=scene.add.image(box.x,box.y,sheetKey(skin,'idle'),0).setDepth(5);
    this.shield=new Shield(scene,6);
  }
  /** Swap art mid-run (the custom character arriving in P3); position, facing and the current action's clock carry over. */
  setSkin(skin:CharacterSkin){this.skin=skin;}
  attack(now:number){this.attackAt=now;}
  /** at: where to draw the body centre this frame (between logic steps); defaults to the collision box. */
  update(state:string,facing:number,now:number,power:PowerView={ally:0,since:0,hit:-9,blink:false},at:{x:number;y:number}=this.box) {
    const a=this.skin.actions,attacking=this.attackAt>=0&&now-this.attackAt<a.attack.frameCount/a.attack.fps;
    const name=attacking?'attack':ACTION[state]??'idle';if(name!==this.action){this.action=name;this.since=now;}
    const act=a[name],i=Math.floor((now-this.since)*act.fps),frame=attacking?Math.min(i,act.frameCount-1):i%act.frameCount;
    const cal=CALIBRATION[this.skin.role],bottom=at.y+this.box.displayHeight/2,big=power.ally?ALLY_SCALE:1;
    this.sprite.setTexture(sheetKey(this.skin,name),frame).setOrigin(cal.cx,cal.foot).setPosition(at.x,bottom);
    // Idle faces the camera: mirroring it would only flip the jacket print.
    this.sprite.setScale(BODY_CELLS*T/(cal.body*this.sprite.frame.height)*big).setFlipX(facing<0&&name!=='idle').setAngle(state==='DASH'?facing*6:0);
    // Editor: after a hit / respawn (1.5 s protection) the player blinks; the shield blinks with it.
    this.sprite.setVisible(!(power.blink&&Math.sin(now*40)>0));
    const h=this.box.displayHeight*big;
    if(power.ally&&this.sprite.visible)this.shield.draw(at.x,bottom-h/2,h*level.itemArt.shield.w,now,{ph:power.since,left:power.ally,flash:Math.max(0,1-(now-power.hit)/.35)});
    else this.shield.hide();
  }
}
