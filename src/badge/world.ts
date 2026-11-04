import Phaser from 'phaser';
import type {Spawn} from '../level/data';
import type {GameplaySession} from '../core/session';
import type {TerrainSystem} from '../terrain/system';
import {TEST_PROFILE as P,TILE as T} from '../core/config';
import level from '../level/data/level.json';
const BADGE='items/'+level.itemArt.badge.art;
type Drop={x:number;y:number;vx:number;vy:number;bounced:boolean;rest:boolean};
export class BadgeWorld {
  objects=new Map<string,Phaser.GameObjects.Image>();
  drops=new Map<string,Drop>();
  constructor(readonly scene:Phaser.Scene,readonly session:GameplaySession,readonly player:Phaser.GameObjects.Rectangle,readonly terrain:TerrainSystem,spawns:Spawn[]){for(const item of spawns)this.spawn(item);}
  spawn(item:Spawn){
    const object=this.scene.add.image(item.x,item.y,BADGE).setDisplaySize(level.itemArt.badge.w*T*.75,level.itemArt.badge.w*T*.75).setDepth(4);this.objects.set(item.id,object);
    if(!item.id.startsWith('drop-'))this.scene.tweens.add({targets:object,y:item.y-3,duration:750,yoyo:true,repeat:-1});
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
      if(drop&&!drop.rest&&!this.fall(drop,o.displayHeight/2,dt)){o.destroy();this.objects.delete(id);this.drops.delete(id);continue;}
      const distance=Phaser.Math.Distance.Between(p.x,p.y,this.player.x,this.player.y);
      if(this.session.power.ally&&distance<P.allyAttract&&distance>1){if(!drop)this.scene.tweens.killTweensOf(o);const k=Math.min(distance,450*dt)/distance;p.x+=(this.player.x-p.x)*k;p.y+=(this.player.y-p.y)*k;} // planning: Ally pulls badges within 6 cells
      if(drop)o.setPosition(drop.x,drop.y);
      if(o.x>=b.left-10&&o.x<=b.right+10&&o.y>=b.top-10&&o.y<=b.bottom+10&&this.session.pickup(id)){
        this.objects.delete(id);this.drops.delete(id);this.scene.tweens.killTweensOf(o);this.absorb(o);
      }
    }
  }
  /** Pickup: the badge homes into the player's current centre, shrinking and fading. */
  absorb(o:Phaser.GameObjects.Image){
    const x=o.x,y=o.y,scale=o.scaleX;
    this.scene.tweens.addCounter({from:0,to:1,duration:220,ease:'Cubic.easeIn',
      onUpdate:t=>{const k=t.getValue()??1;o.setPosition(x+(this.player.x-x)*k,y+(this.player.y-y)*k).setScale(scale*(1-.65*k)).setAlpha(Math.min(1,(1-k)/.4));},
      onComplete:()=>o.destroy()});
  }
}
