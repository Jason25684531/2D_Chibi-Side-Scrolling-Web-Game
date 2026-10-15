import Phaser from 'phaser';
import type {Spawn} from '../level/data';
import type {GameplaySession} from '../core/session';
import {TEST_PROFILE as P} from '../core/config';
export class BadgeWorld {
  objects=new Map<string,Phaser.GameObjects.Arc>();
  constructor(readonly scene:Phaser.Scene,readonly session:GameplaySession,readonly player:Phaser.GameObjects.Rectangle,spawns:Spawn[]){for(const item of spawns)this.spawn(item);}
  spawn(item:Spawn){
    const object=this.scene.add.circle(item.x,item.y,7,0xffd354).setDepth(4);this.objects.set(item.id,object);
  }
  scatter(ids:string[],x:number,y:number){ids.forEach((id,i)=>this.spawn({id,x:x+(i-(ids.length-1)/2)*20,y:y-15-(i%3)*12}));}
  update(dt:number){
    const b=this.player.body as Phaser.Physics.Arcade.Body;
    for(const [id,o] of this.objects){
      if(id.startsWith('drop-')&&!this.session.badges.scattered.has(id)){o.destroy();this.objects.delete(id);continue;}
      const distance=Phaser.Math.Distance.Between(o.x,o.y,this.player.x,this.player.y);
      if(this.session.power.kind==='ally'&&distance<3*P.H){const t=Math.min(1,dt*8);o.x+=(this.player.x-o.x)*t;o.y+=(this.player.y-o.y)*t;}
      if(o.x>=b.left-7&&o.x<=b.right+7&&o.y>=b.top-7&&o.y<=b.bottom+7&&this.session.pickup(id)){o.destroy();this.objects.delete(id);}
    }
  }
}
