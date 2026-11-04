import Phaser from 'phaser';
import type {LevelData,Terrain} from '../level/data';
type Mover={pos:number;dir:number;wait:number;x0:number;y0:number};
type Entry={data:Terrain;object:Phaser.GameObjects.Rectangle;mover?:Mover;bouncedAt?:number};
export class TerrainSystem {
  entries:Entry[]=[];
  hazards:Terrain[];
  bounceReady=0;
  private slopeGrounded=false;
  constructor(readonly scene:Phaser.Scene,readonly level:LevelData,readonly player:Phaser.GameObjects.Rectangle,now:()=>number,bounce:()=>void,dropping:()=>boolean=()=>false,debug=false) {
    this.hazards=level.terrain.filter(t=>t.kind==='hazard');
    for(const data of level.terrain) {
      const object=scene.add.rectangle(data.x,data.y,data.width,data.height,data.kind==='hazard'?0xff3355:data.kind==='bounce'?0xc876e8:data.kind==='moving'?0x50a5d8:0x65788c,data.kind==='hazard'?.5:.3).setVisible(debug).setDepth(-5);
      if(data.kind==='hazard')continue;
      if(data.kind==='slope'){object.setAlpha(0);this.entries.push({data,object});continue;}
      scene.physics.add.existing(object,data.kind!=='moving');
      const entry:Entry={data,object};
      if(data.kind==='moving'){const b=object.body as Phaser.Physics.Arcade.Body;b.setAllowGravity(false).setImmovable(true);b.friction.set(1,1);entry.mover={pos:0,dir:1,wait:0,x0:data.x,y0:data.y};}
      this.entries.push(entry);
      scene.physics.add.collider(player,object,()=>{
        const b=player.body as Phaser.Physics.Arcade.Body;
        if(data.kind==='bounce'&&b.blocked.down&&now()>=this.bounceReady){bounce();this.bounceReady=now()+.2;entry.bouncedAt=now();}
      },()=>{
        if(data.kind!=='one-way'&&data.kind!=='moving')return true;
        if(dropping())return false; // ↓ drop-through window
        const b=player.body as Phaser.Physics.Arcade.Body,p=object.body as Phaser.Physics.Arcade.Body;
        return b.velocity.y>=p.velocity.y&&b.prev.y+b.height<=p.top+4;
      });
    }
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
  /** Linear back-and-forth with endpoint pause (planning editor `mover`). */
  update(dt:number) {
    for(const {data,object,mover:m} of this.entries)if(m){
      if(m.wait>0)m.wait-=dt;
      else{m.pos+=m.dir*(data.speed??0)*dt;
        if(m.pos>=(data.range??0)){m.pos=data.range??0;m.dir=-1;m.wait=data.pause??0;}
        if(m.pos<=0){m.pos=0;m.dir=1;m.wait=data.pause??0;}}
      const tx=m.x0+(data.axis==='x'?m.pos:0),ty=m.y0+(data.axis==='y'?m.pos:0);
      (object.body as Phaser.Physics.Arcade.Body).setVelocity((tx-object.x)/dt,(ty-object.y)/dt);
    }
  }
  hazardAt(left:number,top:number,right:number,bottom:number){
    return this.hazards.some(h=>right-4>h.x-h.width/2&&left+4<h.x+h.width/2&&bottom-1>h.y-h.height/2&&top+4<h.y+h.height/2);
  }
  /** Highest static top surface under a box centred at x (half-width `half`) at or below fromY; movers skipped (badge scatter). */
  groundY(x:number,fromY:number,half=0){
    let best:number|undefined;
    for(const {data} of this.entries){
      if(data.kind==='moving'||x+half<=data.x-data.width/2||x-half>=data.x+data.width/2)continue;
      const top=data.kind==='slope'?this.slopeFootY(data,x,half*2):data.y-data.height/2;
      if(top>=fromY&&(best===undefined||top<best))best=top;
    }
    return best;
  }
  /** Centre-box overlaps a static solid block (ground or spring). Slopes, one-way and movers only support from above. */
  solidAt(x:number,y:number,w:number,h:number){
    return this.entries.some(({data})=>(data.kind==='ground'||data.kind==='bounce')&&x+w/2>data.x-data.width/2&&x-w/2<data.x+data.width/2&&y+h/2>data.y-data.height/2&&y-h/2<data.y+data.height/2);
  }
  supports(x:number,bottom:number,width:number) {
    return this.entries.some(({data,object})=>(data.kind==='ground'||data.kind==='slope')&&x-width/2>object.x-data.width/2+4&&x+width/2<object.x+data.width/2-4&&Math.abs(bottom-(data.kind==='slope'?this.slopeFootY(data,x,width):object.y-data.height/2))<4);
  }
  clear(x:number,y:number,w:number,h:number) {
    return this.entries.every(({object,data})=>{if(data.kind==='slope')return x+w/2<=object.x-data.width/2||x-w/2>=object.x+data.width/2||y+h/2<=this.slopeFootY(data,x,w)+.1;
      const b=object.body as Phaser.Physics.Arcade.Body;return x+w/2<=b.left||x-w/2>=b.right||y+h/2<=b.top+.1||y-h/2>=b.bottom||data.kind==='one-way';})
      &&!this.hazardAt(x-w/2,y-h/2,x+w/2,y+h/2);
  }
}
