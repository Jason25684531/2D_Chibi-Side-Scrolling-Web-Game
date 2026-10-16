import Phaser from 'phaser';
import type {LevelData,Terrain} from '../level/data';
import {TEST_PROFILE as P} from '../core/config';
export class TerrainSystem {
  entries:{data:Terrain;object:Phaser.GameObjects.Rectangle}[]=[];
  bounceReady=0;
  private slopeGrounded=false;
  constructor(readonly scene:Phaser.Scene,readonly level:LevelData,readonly player:Phaser.GameObjects.Rectangle,now:()=>number,bounce:()=>void) {
    for(const data of level.terrain) {
      const object=scene.add.rectangle(data.x,data.y,data.width,data.height,data.kind==='bounce'?0xc876e8:data.kind==='moving'?0x50a5d8:0x65788c);
      scene.physics.add.existing(object,data.kind!=='moving');
      if(data.kind==='moving'){const b=object.body as Phaser.Physics.Arcade.Body;b.setAllowGravity(false).setImmovable(true);b.friction.set(1,1);}
      this.entries.push({data,object});
      if(data.kind==='slope'){
        object.setAlpha(0);
        const left=data.x-data.width/2,right=data.x+data.width/2;
        const g=scene.add.graphics().fillStyle(0x65788c);
        g.fillPoints([{x:left,y:this.slopeY(data,left)},{x:right,y:this.slopeY(data,right)},{x:right,y:data.y+data.height/2},{x:left,y:data.y+data.height/2}],true);
        continue;
      }
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
  slopeY(data:Terrain,x:number){return data.y-(data.rise??data.height)*(x-data.x)/data.width;}
  slopeFootY(data:Terrain,x:number,width:number){
    const foot=Phaser.Math.Clamp(x+Math.sign(data.rise??data.height)*width/2,data.x-data.width/2,data.x+data.width/2);
    return this.slopeY(data,foot);
  }
  resolveSlopes(){
    const b=this.player.body as Phaser.Physics.Arcade.Body;
    const previousX=b.prev.x+b.width/2,previousBottom=b.prev.y+b.height;
    const supported=this.slopeGrounded||b.wasTouching.down;
    this.slopeGrounded=false;
    if(b.velocity.y<0)return;
    for(const {data} of this.entries){
      if(data.kind!=='slope'||b.right<data.x-data.width/2||b.left>data.x+data.width/2)continue;
      const y=this.slopeFootY(data,b.center.x,b.width),oldY=this.slopeFootY(data,previousX,b.width);
      const travel=Math.abs((b.center.x-previousX)*(data.rise??data.height)/data.width);
      if(previousBottom<=oldY+3&&b.bottom>=y-(supported?travel+3:0)){
        b.position.y=y-b.height;b.setVelocityY(0);b.blocked.down=true;b.touching.down=true;
        this.slopeGrounded=true;return;
      }
    }
  }
  update(now:number,dt:number) {
    for(const {data,object} of this.entries)if(data.kind==='moving'){
      const target=data.x+Math.sin(now*1.2)*(data.travel??0);
      const targetY=data.y+Math.sin(now*1.2)*(data.travelY??0);
      (object.body as Phaser.Physics.Arcade.Body).setVelocity((target-object.x)/dt,(targetY-object.y)/dt);
    }
  }
  supports(x:number,bottom:number,width:number) {
    return this.entries.some(({data,object})=>(data.kind==='ground'||data.kind==='slope')&&x-width/2>object.x-data.width/2+4&&x+width/2<object.x+data.width/2-4&&Math.abs(bottom-(data.kind==='slope'?this.slopeFootY(data,x,width):object.y-data.height/2))<4);
  }
  clear(x:number,y:number,w:number,h:number) {
    return this.entries.every(({object,data})=>{const b=object.body as Phaser.Physics.Arcade.Body;return x+w/2<=b.left||x-w/2>=b.right||y+h/2<=(data.kind==='slope'?this.slopeFootY(data,x,w):b.top)+.1||y-h/2>=b.bottom||data.kind==='one-way';});
  }
}
