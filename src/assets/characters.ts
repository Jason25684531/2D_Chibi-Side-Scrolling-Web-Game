import Phaser from 'phaser';
import level from '../level/data/level.json';
import {TILE as T} from '../core/config';
import {CHARACTERS} from './catalog';
type Action={frames:string[];fps?:number;dur?:number};
const ACTION:Record<string,string>={IDLE:'idle',RUN:'run',JUMP:'jump',DOUBLE_JUMP:'djump',FALL:'fall',HURT:'fall',DASH:'dash',WIN:'idle'};
// Planning v0.3 §6.1: 10 frames per character, drawn 2.5 cells tall with the image bottom on the collision-box bottom.
export class CharacterView {
  sprite:Phaser.GameObjects.Image;shield:Phaser.GameObjects.Image;
  private c:typeof CHARACTERS.a;private action='';private since=0;private attackAt=-1;
  constructor(scene:Phaser.Scene,private box:Phaser.GameObjects.Rectangle,id:string,debug=false) {
    this.c=CHARACTERS[id==='b'?'b':'a'];box.setAlpha(debug?.4:0);
    this.sprite=scene.add.image(box.x,box.y,'chars/'+this.c.frames.idle1).setOrigin(.5,1).setDepth(5);
    const s=level.itemArt.shield;this.shield=scene.add.image(box.x,box.y,'items/'+s.art).setDepth(6).setVisible(false);
    this.shield.setDisplaySize(s.w*T,s.w*T);
  }
  attack(now:number){this.attackAt=now;}
  update(state:string,facing:number,now:number,ally=false) {
    const a=this.c.actions as Record<string,Action>,attacking=this.attackAt>=0&&now-this.attackAt<(a.attack.dur??.3);
    const name=attacking?'attack':ACTION[state]??'idle';if(name!==this.action){this.action=name;this.since=now;}
    const act=a[name]??a.idle,t=now-this.since,i=act.fps?Math.floor(t*act.fps):0;
    const frame=attacking?act.frames[Math.min(i,act.frames.length-1)]:act.frames[i%act.frames.length];
    const bottom=this.box.y+this.box.displayHeight/2;
    this.sprite.setTexture('chars/'+(this.c.frames as Record<string,string>)[frame]).setPosition(this.box.x,bottom);
    this.sprite.setScale(this.c.height*T/this.sprite.height).setFlipX(facing<0&&!this.c.noFlip.includes(frame)).setAngle(name==='dash'?facing*6:0);
    this.shield.setVisible(ally).setPosition(this.box.x,this.box.y).setAngle(now*90);
  }
}
