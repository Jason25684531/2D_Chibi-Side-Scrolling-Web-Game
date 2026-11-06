import Phaser from 'phaser';
import level from '../level/data/level.json';
import {TILE as T} from '../core/config';
import {CHARACTERS,FACE} from './catalog';
type Action={frames:string[];fps?:number;dur?:number};
const FACE_KEY='player-face';
const ACTION:Record<string,string>={IDLE:'idle',RUN:'run',JUMP:'jump',DOUBLE_JUMP:'djump',FALL:'fall',HURT:'fall',DASH:'dash',WIN:'idle'};
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
// Planning v0.3 §6.1: 10 frames per character, drawn 2.5 cells tall with the image bottom on the collision-box bottom.
export class CharacterView {
  sprite:Phaser.GameObjects.Image;shield:Shield;face?:Phaser.GameObjects.Image;
  private c:typeof CHARACTERS.a;private f:typeof FACE.a.idle1;private action='';private since=0;private attackAt=-1;
  constructor(scene:Phaser.Scene,private box:Phaser.GameObjects.Rectangle,id:string,debug=false,photo?:string) {
    this.c=CHARACTERS[id==='b'?'b':'a'];this.f=FACE[id==='b'?'b':'a'].idle1;box.setAlpha(debug?.4:0);
    this.sprite=scene.add.image(box.x,box.y,'chars/'+this.c.frames.idle1).setOrigin(.5,1).setDepth(5);
    this.shield=new Shield(scene,6);
    if(photo){ // UC03-1 custom face; the texture lives exactly as long as this scene run
      if(scene.textures.exists(FACE_KEY))scene.textures.remove(FACE_KEY);
      scene.textures.once(Phaser.Textures.Events.ADD_KEY+FACE_KEY,()=>{if(this.sprite.active)this.face=scene.add.image(box.x,box.y,FACE_KEY).setDepth(5);});
      scene.textures.addBase64(FACE_KEY,photo);
      scene.events.once('shutdown',()=>{if(scene.textures.exists(FACE_KEY))scene.textures.remove(FACE_KEY);});
    }
  }
  attack(now:number){this.attackAt=now;}
  update(state:string,facing:number,now:number,power:PowerView={ally:0,since:0,hit:-9,blink:false}) {
    const a=this.c.actions as Record<string,Action>,attacking=this.attackAt>=0&&now-this.attackAt<(a.attack.dur??.3);
    const name=attacking?'attack':ACTION[state]??'idle';if(name!==this.action){this.action=name;this.since=now;}
    const act=a[name]??a.idle,t=now-this.since,i=act.fps?Math.floor(t*act.fps):0;
    const frame=attacking?act.frames[Math.min(i,act.frames.length-1)]:act.frames[i%act.frames.length];
    const bottom=this.box.y+this.box.displayHeight/2,big=power.ally?ALLY_SCALE:1;
    this.sprite.setTexture('chars/'+(this.c.frames as Record<string,string>)[frame]).setPosition(this.box.x,bottom);
    this.sprite.setScale(this.c.height*T/this.sprite.height*big).setFlipX(facing<0&&!this.c.noFlip.includes(frame)).setAngle(name==='dash'?facing*6:0);
    // Editor: after a hit / respawn (1.5 s protection) the player blinks; the shield blinks with it.
    const shown=!(power.blink&&Math.sin(now*40)>0);this.sprite.setVisible(shown);this.face?.setVisible(shown);
    const h=this.box.displayHeight*big;
    if(power.ally&&shown)this.shield.draw(this.box.x,bottom-h/2,h*level.itemArt.shield.w,now,{ph:power.since,left:power.ally,flash:Math.max(0,1-(now-power.hit)/.35)});
    else this.shield.hide();
    // ponytail: one idle1 head anchor for every frame; add per-frame offsets if run/dash frames drift visibly.
    const w=this.sprite.displayWidth,sh=this.sprite.displayHeight;
    this.face?.setPosition(this.sprite.x+(this.sprite.flipX?-1:1)*(this.f.x-.5)*w,bottom-sh*(1-this.f.y)).setDisplaySize(this.f.d*sh,this.f.d*sh).setAngle(this.sprite.angle);
  }
}
