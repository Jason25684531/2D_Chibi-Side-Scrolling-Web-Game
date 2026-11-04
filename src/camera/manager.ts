import type Phaser from 'phaser';
import {TEST_PROFILE as P,TILE as T} from '../core/config';
import type {LevelData,Segment} from '../level/data';
// Planning editor `camera: "free"`: damped 2D follow that tracks the last ground, not jumps, clamped to segments.
const LEAD=.1,BAND=16*T,W=P.width,H=P.height;
type Velocity={x:number;y:number;f:number;l:number};
/** Unity-style SmoothDamp; velocity is kept in s[key] so motion stays continuous. */
function smoothDamp(cur:number,target:number,s:Velocity,key:keyof Velocity,st:number,dt:number){
  const w=2/st,x=w*dt,e=1/(1+x+.48*x*x+.235*x*x*x),ch=cur-target,tmp=(s[key]+w*ch)*dt;
  s[key]=(s[key]-w*tmp)*e;let out=target+(ch+tmp)*e;
  if((target-cur>0)===(out>target)){out=target;s[key]=0;}
  return out;
}
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
type Follow={x:number;bottom:number;top:number;vx:number;vy:number;grounded:boolean};
export class CameraManager {
  private v:Velocity={x:0,y:0,f:0,l:0};private face=1;private leadDir=1;private leadT=0;private look=0;private camFeet=0;private groundFeet=0;zoom=0;
  constructor(readonly camera:Phaser.Cameras.Scene2D.Camera,readonly level:LevelData){camera.setBounds(0,0,level.width,level.height);}
  segAt(x:number,y:number):Segment|undefined{return this.level.segments.find(s=>x>=s.left&&x<s.right&&y>=s.top&&y<s.bottom);}
  private exitsDown(s:Segment){return s.dir==='down'||(s.dir==='left'?!this.segAt(s.left-1,s.top):!this.segAt(s.right,s.top));}
  private inExit(s:Segment,x:number){return s.dir==='down'||(s.dir==='left'?x<s.left+BAND:x>=s.right-BAND);}
  private inEntry(s:Segment,x:number){return s.dir==='down'||(s.dir==='left'?x>=s.right-BAND:x<s.left+BAND);}
  target(cx:number,feet:number,face:number,look:number){
    const x=clamp(cx-W*(.5-LEAD*face),0,Math.max(0,this.level.width-W));
    let frame=.68-.33*look;const s=this.segAt(cx,feet-1);let lo=s?s.bottom-H:0;
    if(s){
      const below=this.segAt(cx,s.bottom),above=this.segAt(cx,s.top-1);
      // Leaving a segment downward: feet at 45% so the next segment is visible.
      if(below&&this.exitsDown(s)&&this.inExit(s,cx)&&this.inEntry(below,cx)){frame=Math.min(frame,.45);lo=below.bottom-H;}
      else if(above&&this.exitsDown(above)&&this.inExit(above,cx)&&this.inEntry(s,cx))frame=Math.min(frame,.45);
    }
    let y=feet-H*frame;
    if(s&&s.bottom-s.top>=H)y=clamp(y,s.top-6*T,lo);
    return{x,y:clamp(y,0,Math.max(0,this.level.height-H))};
  }
  reset(x:number,feet:number){
    this.v={x:0,y:0,f:0,l:0};this.face=this.leadDir=1;this.leadT=0;this.look=0;this.camFeet=this.groundFeet=feet;
    const t=this.target(x,feet,1,0);this.camera.setScroll(t.x,t.y);
  }
  update(p:Follow,dt:number,goalNear=0){
    if(!(dt>0))return;const c=this.camera,feet=p.bottom;
    if(p.grounded)this.camFeet=this.groundFeet=feet;
    else if(feet>this.camFeet)this.camFeet=feet;
    else if(feet<this.camFeet-5.5*T)this.camFeet=feet+5.5*T; // springs: follow only once the head nears the HUD
    this.look=smoothDamp(this.look,clamp((p.grounded?0:feet-this.groundFeet-2*T)/(3*T),0,1),this.v,'l',.35,dt);
    const d=Math.abs(p.vx)>P.speed*.3?Math.sign(p.vx):0;
    if(d&&d!==this.leadDir){this.leadT+=dt;if(this.leadT>.35){this.leadDir=d;this.leadT=0;}}else this.leadT=0;
    this.face=smoothDamp(this.face,this.leadDir,this.v,'f',.45,dt);
    const t=this.target(p.x,this.camFeet,this.face,this.look),oy=c.scrollY;
    c.scrollX=clamp(smoothDamp(c.scrollX,t.x,this.v,'x',.12,dt),0,Math.max(0,this.level.width-W));
    let y=smoothDamp(c.scrollY,t.y,this.v,'y',t.y>c.scrollY&&p.vy>150?.14:.3,dt);
    // Keep the head below the HUD band (y125) and the feet 45px above the bottom edge.
    const safe=clamp(y,feet-(H-45),p.top-125);if(safe!==y){y=safe;this.v.y=(y-oy)/dt;}
    c.scrollY=clamp(y,0,Math.max(0,this.level.height-H));
    // Near the portal the view zooms in up to +8% (planning editor goal approach).
    this.zoom+=(goalNear-this.zoom)*Math.min(1,dt*5);c.setZoom(1+.08*this.zoom);
  }
}
