import Phaser from 'phaser';
import type {LevelData,Terrain} from '../level/data';
import {TEST_PROFILE as P} from '../core/config';
export class TerrainSystem {
  entries:{data:Terrain;object:Phaser.GameObjects.Rectangle}[]=[];
  bounceReady=0;
  constructor(readonly scene:Phaser.Scene,readonly level:LevelData,player:Phaser.GameObjects.Rectangle,now:()=>number,bounce:()=>void) {
    for(const data of level.terrain) {
      const object=scene.add.rectangle(data.x,data.y,data.width,data.height,data.kind==='bounce'?0xc876e8:data.kind==='moving'?0x50a5d8:0x65788c);
      scene.physics.add.existing(object,data.kind!=='moving');
      if(data.kind==='moving'){const b=object.body as Phaser.Physics.Arcade.Body;b.setAllowGravity(false).setImmovable(true);b.friction.set(1,1);}
      this.entries.push({data,object});
      scene.physics.add.collider(player,object,()=>{
        const b=player.body as Phaser.Physics.Arcade.Body;
        if(data.kind==='bounce'&&b.blocked.down&&now()>=this.bounceReady){bounce();this.bounceReady=now()+.2;}
      },()=>{
        if(data.kind!=='one-way'&&data.kind!=='moving')return true;
        const b=player.body as Phaser.Physics.Arcade.Body,p=object.body as Phaser.Physics.Arcade.Body;
        return b.velocity.y>=p.velocity.y&&b.prev.y+b.height<=p.top+4;
      });
    }
    scene.add.text(70,860,'START → Jump → Double Jump → Moving platform / PIT → Enemies → Bounce → GOAL',{fontSize:'20px',color:'#b9cbde'});
  }
  update(now:number,dt:number) {
    for(const {data,object} of this.entries)if(data.kind==='moving'){
      const target=data.x+Math.sin(now*1.2)*(data.travel??0);
      const targetY=data.y+Math.sin(now*1.2)*(data.travelY??0);
      (object.body as Phaser.Physics.Arcade.Body).setVelocity((target-object.x)/dt,(targetY-object.y)/dt);
    }
  }
  supports(x:number,bottom:number,width:number) {
    return this.entries.some(({data,object})=>data.kind==='ground'&&x-width/2>object.x-data.width/2+4&&x+width/2<object.x+data.width/2-4&&Math.abs(bottom-(object.y-data.height/2))<4);
  }
  clear(x:number,y:number,w:number,h:number) {
    return this.entries.every(({object,data})=>{const b=object.body as Phaser.Physics.Arcade.Body;return x+w/2<=b.left||x-w/2>=b.right||y+h/2<=b.top+.1||y-h/2>=b.bottom||data.kind==='one-way';});
  }
}
