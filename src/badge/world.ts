import Phaser from 'phaser';
import type {Spawn} from '../level/data';
import type {GameplaySession} from '../core/session';
import {TEST_PROFILE as P,TILE as T} from '../core/config';
import level from '../level/data/level.json';
const BADGE='items/'+level.itemArt.badge.art;
export class BadgeWorld {
  objects=new Map<string,Phaser.GameObjects.Image>();
  drops=new Map<string,{x:number;y:number;born:number;vx:number}>();
  constructor(readonly scene:Phaser.Scene,readonly session:GameplaySession,readonly player:Phaser.GameObjects.Rectangle,spawns:Spawn[]){for(const item of spawns)this.spawn(item);}
  spawn(item:Spawn){
    const object=this.scene.add.image(item.x,item.y,BADGE).setDisplaySize(level.itemArt.badge.w*T*.75,level.itemArt.badge.w*T*.75).setDepth(4);this.objects.set(item.id,object);
    if(!item.id.startsWith('drop-'))this.scene.tweens.add({targets:object,y:item.y-3,duration:750,yoyo:true,repeat:-1});
  }
  scatter(ids:string[],x:number,y:number){ids.forEach((id,i)=>{this.spawn({id,x,y:y-15});this.drops.set(id,{x,y:y-15,born:this.session.run.elapsed,vx:(i-(ids.length-1)/2)*24});});}
  update(dt:number){
    const b=this.player.body as Phaser.Physics.Arcade.Body;
    for(const [id,o] of this.objects){
      if(id.startsWith('drop-')&&!this.session.badges.scattered.has(id)){o.destroy();this.objects.delete(id);this.drops.delete(id);continue;}
      const drop=this.drops.get(id);
      if(drop){const age=this.session.run.elapsed-drop.born;o.x=drop.x+drop.vx*age;o.y=drop.y-Math.abs(Math.sin(age*Math.PI*2))*32;}
      const distance=Phaser.Math.Distance.Between(o.x,o.y,this.player.x,this.player.y);
      if(this.session.power.ally&&distance<P.allyAttract&&distance>1){const k=Math.min(distance,450*dt)/distance;o.x+=(this.player.x-o.x)*k;o.y+=(this.player.y-o.y)*k;} // planning: Ally pulls badges within 6 cells
      if(o.x>=b.left-10&&o.x<=b.right+10&&o.y>=b.top-10&&o.y<=b.bottom+10&&this.session.pickup(id)){
        this.objects.delete(id);this.drops.delete(id);this.scene.tweens.killTweensOf(o);
        this.scene.tweens.add({targets:o,y:o.y-16,alpha:0,duration:200,onComplete:()=>o.destroy()});
      }
    }
  }
}
