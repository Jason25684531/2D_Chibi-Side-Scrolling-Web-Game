import Phaser from 'phaser';
import type {Spawn} from '../level/data';
import type {GameplaySession} from '../core/session';
import type {TerrainSystem} from '../terrain/system';
import {TEST_PROFILE as P,TILE as T} from '../core/config';
import level from '../level/data/level.json';
const BADGE='items/'+level.itemArt.badge.art,SIZE=level.itemArt.badge.w*T, // editor itemW('badge') cells, square art
  // ponytail: drops stay 0.75x (editor 0.8x) because the scatter physics and its wall/slope tests are tuned to this 24 px box.
  DROP=SIZE*.75;
// items/ROG徽章.json actions (editor): idle tilt/pulse/wave (float range 0 = no bobbing), scatter spin/scale, collect rise/scale.
const IDLE={tilt:4,pulse:.04,wave:.12},SCATTER={spin:8},COLLECT={dur:.35,rise:.8,scale:1.7};
type Drop={x:number;y:number;vx:number;vy:number;bounced:boolean;rest:boolean};
export class BadgeWorld {
  objects=new Map<string,Phaser.GameObjects.Image>();
  drops=new Map<string,Drop>();
  constructor(readonly scene:Phaser.Scene,readonly session:GameplaySession,readonly player:Phaser.GameObjects.Rectangle,readonly terrain:TerrainSystem,spawns:Spawn[]){for(const item of spawns)this.spawn(item);}
  spawn(item:Spawn){
    const size=item.id.startsWith('drop-')?DROP:SIZE;
    this.objects.set(item.id,this.scene.add.image(item.x,item.y,BADGE).setDisplaySize(size,size).setDepth(4));
  }
  scatter(ids:string[],x:number,y:number){ids.forEach((id,i)=>{this.spawn({id,x,y:y-15});this.drops.set(id,{x,y:y-15,vx:(i-(ids.length-1)/2)*P.scatterSpread,vy:-P.scatterLaunch,bounced:false,rest:false});});}
  /** One arc, one bounce on the first static surface below, then rest. Walls bounce it back, ceilings stop it,
   *  the electric net eats it (editor rule). Returns false when the drop is gone. No surface (pit) = falls until expiry. */
  fall(d:Drop,half:number,dt:number){
    const t=this.terrain,s=half*2-2; // 1 px inset so resting contact is not a hit
    d.vy+=P.gravity*dt;
    const x=Phaser.Math.Clamp(d.x+d.vx*dt,half,this.scene.physics.world.bounds.width-half);
    if(t.solidAt(x,d.y,s,s))d.vx*=-.3;else d.x=x;
    const bottom=d.y+half;d.y+=d.vy*dt;
    if(d.vy<0&&t.solidAt(d.x,d.y,s,s)){d.y-=d.vy*dt;d.vy=0;return true;}
    if(t.hazardAt(d.x-half,d.y-half,d.x+half,d.y+half))return false;
    // From the higher of the old feet and the new top: catches fast falls and slopes/ledges the badge dipped into.
    const floor=t.groundY(d.x,Math.min(bottom-2,d.y-half),half-1);
    if(floor===undefined||d.vy<=0||d.y+half<floor)return true;
    d.y=floor-half;
    if(d.bounced){d.rest=true;d.vx=d.vy=0;}else{d.bounced=true;d.vy*=-P.scatterBounce;d.vx*=.5;}
    return true;
  }
  update(dt:number){
    const b=this.player.body as Phaser.Physics.Arcade.Body;
    for(const [id,o] of this.objects){
      if(id.startsWith('drop-')&&!this.session.badges.scattered.has(id)){o.destroy();this.objects.delete(id);this.drops.delete(id);continue;}
      const drop=this.drops.get(id),p=drop??o;
      if(drop&&!drop.rest&&!this.fall(drop,DROP/2,dt)){o.destroy();this.objects.delete(id);this.drops.delete(id);continue;}
      const distance=Phaser.Math.Distance.Between(p.x,p.y,this.player.x,this.player.y);
      if(this.session.power.ally&&distance<P.allyAttract&&distance>1){const k=Math.min(distance,450*dt)/distance;p.x+=(this.player.x-p.x)*k;p.y+=(this.player.y-p.y)*k;} // planning: Ally pulls badges within 6 cells
      const now=this.session.run.elapsed,s=this.session.badges.scattered.get(id);
      if(drop&&s){const left=s.expires-now;o.setPosition(drop.x,drop.y).setRotation((5-left)*SCATTER.spin).setAlpha(left<1.5&&Math.sin(now*30)<=0?.3:1);} // spin; blink in the last 1.5 s
      else if(!drop){const t=now+o.x/T*IDLE.wave;o.setAngle(IDLE.tilt*Math.sin(t*2.1)).setScale(SIZE/o.width*(1+IDLE.pulse*Math.sin(t*3.3)));}
      if(o.x>=b.left-10&&o.x<=b.right+10&&o.y>=b.top-10&&o.y<=b.bottom+10&&this.session.pickup(id)){
        this.objects.delete(id);this.drops.delete(id);this.collect(o);
      }
    }
  }
  /** Editor collect: rises 0.8 cell, grows to 1.7x and fades in 0.35 s while a ring of ten red sparks bursts out. */
  collect(o:Phaser.GameObjects.Image){
    const x=o.x,y=o.y,scale=SIZE/o.width,sparks=this.scene.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.ADD);o.setRotation(0).setAlpha(1);
    this.scene.tweens.addCounter({from:0,to:1,duration:COLLECT.dur*1000,
      onUpdate:t=>{const k=t.getValue()??1,e=1-(1-k)**3,cy=y-COLLECT.rise*T*e,r=T*(.3+1.1*e),d=3*T/64;
        o.setPosition(x,cy).setScale(scale*(1+(COLLECT.scale-1)*e)).setAlpha(1-k);
        sparks.clear().fillStyle(0xff5064,1-k);for(let i=0;i<10;i++){const a=i/10*Math.PI*2;sparks.fillRect(x+Math.cos(a)*r-d,cy+Math.sin(a)*r*.7-d,d*2,d*2);}},
      onComplete:()=>{o.destroy();sparks.destroy();}});
  }
}
