import Phaser from 'phaser';
import {TILE as T} from '../core/config';
import type {GameplayScene} from '../scenes/gameplay';
// Port of the 1102 editor drawDashFx / drawJumpFx. Presentation only: never touches bodies, input or score.
type G=Phaser.GameObjects.Graphics;
const S=T/64; // editor pixel sizes are for a 64 px cell
/** Editor hash: stable pseudo-random per 1/20 s slot. */
const hash=(n:number)=>{n=(n^61)^(n>>>16);n=n+(n<<3);n=n^(n>>>4);n=Math.imul(n,0x27d4eb2d);n=n^(n>>>15);return(n>>>0)/4294967296;};
/** Half ellipse (Graphics has no elliptic arc). */
function halfEllipse(g:G,x:number,y:number,rx:number,ry:number,d:number){
  g.beginPath();for(let i=0;i<=12;i++){const a=(d>0?-Math.PI/2:Math.PI/2)+Math.PI*i/12;g.lineTo(x+Math.cos(a)*rx,y+Math.sin(a)*ry);}g.strokePath();
}
const LIFE=.2; // dash afterimage life, s
export function playerFx(scene:GameplayScene){
  const g=scene.add.graphics().setDepth(4.5),add=scene.add.graphics().setDepth(4.5).setBlendMode(Phaser.BlendModes.ADD);
  const ghosts=Array.from({length:3},()=>({image:scene.add.image(0,0,'__DEFAULT').setOrigin(.5,1).setDepth(4.5).setVisible(false),t0:-9}));
  let k=0,last=-9,prev=0,next=0;
  const update=()=>{
    g.clear();add.clear();
    // Between 24 Hz steps the clock moves on with the accumulator so short effects do not stutter.
    const c=scene.controller,b=scene.body,sp=scene.presentation.sprite,now=scene.run.elapsed+(scene.run.phase==='running'?scene.fixed.accumulator:0);
    const dashing=scene.run.elapsed<c.dashUntil&&!scene.shockUntil,cx=b.center.x;
    k=dashing?1:Math.max(0,k-(now-prev)*7);prev=now; // fades ~0.15 s after the dash
    if(dashing&&now-last>=.045){last=now;const o=ghosts[next++%3];o.t0=now;o.image.setTexture(sp.texture.key).setPosition(sp.x,sp.y).setScale(sp.scaleX,sp.scaleY).setFlipX(sp.flipX).setAngle(sp.angle);}
    for(const o of ghosts){const a=(now-o.t0)/LIFE;o.image.setVisible(a<1&&Math.abs(o.image.x-cx)>=6*S).setAlpha(.32*(1-a));}
    const P=c.dashFx;
    if(now-P.t0<.2){ // foot gust: two half arcs blowing back, ground dust unless airborne
      const a=(now-P.t0)/.2,d=-P.dir,bx=P.x+d*T*(.3+.9*a),by=P.y-T*.08;
      for(let i=0;i<2;i++){g.lineStyle((5-i*2)*(1-a*.5)*S,i?0xffffff:0x9fdcff,.55*(1-a));halfEllipse(g,bx+d*i*T*.25,by-i*T*.1,T*(.35+.5*a)*(1-i*.35),T*(.12+.1*a)*(1-i*.3),d);}
      if(!P.air)g.fillStyle(0xcfe9ff,.25*(1-a)).fillEllipse(P.x+d*T*(.2+.6*a),P.y-3*S,T*(.3+.5*a)*2,T*.14);
    }
    if(k>.01){ // speed lines behind the player, reshuffled every 0.05 s
      const d=-c.facing,top=b.top+b.height*.18,hh=b.height*.7,slot=Math.floor(now*20);
      for(let i=0;i<4;i++){
        const r1=hash(slot*7+i*131),r2=hash(slot*13+i*71+5),y=top+hh*((i+.5)/4+(r1-.5)*.12),x0=cx+d*(b.width*.6+r2*T*.5),len=T*(.45+r1*.55);
        g.lineStyle((i%2?2.5:3.5)*S,i%2?0xffffff:0x8fd3ff,k*(.35+.3*r2)).lineBetween(x0,y,x0+d*len,y);
      }
    }
    const J=c.jumpFx;
    if(!J.dj&&now-J.t0<.14){ // take-off: two puffs and a flat ring at the feet
      const a=(now-J.t0)/.14;
      g.fillStyle(0xd6ecff,.55*(1-a));for(const s of [-1,1])g.fillEllipse(J.x+s*T*(.25+.45*a),J.y-T*.06,T*(.16+.14*a)*2,T*(.07+.03*a)*2);
      g.lineStyle((3*(1-a)+1)*S,0x9fdcff,.55*(1-a)).strokeEllipse(J.x,J.y-2*S,T*(.3+.4*a)*2,T*.12);
    }
    if(J.dj&&now-J.t0<.25){ // double jump: cyan energy ring spreading from the feet
      const a=(now-J.t0)/.25,rx=T*(.3+.8*a);
      add.lineStyle((5*(1-a)+1)*S,0x5ff2ff,.8*(1-a)).strokeEllipse(J.x,J.y,rx*2,rx*.64);
      add.lineStyle(2*S,0x5ff2ff,.4*(1-a)).strokeEllipse(J.x,J.y,rx*1.2,rx*.4);
    }
    const St=scene.stompFx;
    if(now-St.t0<.16){ // stomp: impact ring + four short rays at the contact point, glow under the feet
      const a=(now-St.t0)/.16,r=T*(.25+.6*a);
      add.lineStyle((4*(1-a)+1)*S,0xffffff,.85*(1-a)).strokeEllipse(St.x,St.y,r*2,r*.8);
      add.lineStyle(3*S,0xffe9a8,.85*(1-a));
      for(const an of [.35,1.2,1.94,2.79]){const co=Math.cos(an+Math.PI),sn=Math.sin(an+Math.PI);add.lineBetween(St.x+co*r*.6,St.y+sn*r*.5,St.x+co*r*1.15,St.y+sn*r*.95);}
      add.fillStyle(0xc8f5ff,.35*(1-a)).fillEllipse(cx,b.bottom,T,T*.36);
    }
  };
  scene.events.on('postupdate',update);
  scene.events.once('shutdown',()=>scene.events.off('postupdate',update));
}
