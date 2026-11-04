import Phaser from 'phaser';
import level from '../level/data/level.json';
import {TEST_PROFILE as P,TILE as T} from '../core/config';
import type {GameplayScene} from '../scenes/gameplay';
// Port of the 1102 editor play-mode electricity: drawShockNet (fall-zone net), drawLaserFx (雷射陷阱區 art), shocked player.
// Presentation only, redrawn every frame inside the camera view; clocks on run.elapsed so Pause freezes it like the editor.
type Line={y:number;x0:number;x1:number;t:number};
type G=Phaser.GameObjects.Graphics;
/** mulberry32, same seeds as the editor so each 1/14 s frame keeps one arc shape. */
const rng=(seed:number)=>{let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};
const stroke=(g:G,pts:number[][],width:number,color:number,alpha:number)=>{g.lineStyle(width,color,alpha);g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokePath();};
/** Editor drawBolt: jagged line, cyan halo + white core. */
function bolt(g:G,ax:number,ay:number,bx:number,by:number,rnd:()=>number,a=1){
  const len=Math.hypot(bx-ax,by-ay)||1,n=Math.max(2,Math.round(len/(T*.22))),nx=-(by-ay)/len,ny=(bx-ax)/len,pts=[[ax,ay]];
  for(let i=1;i<n;i++){const k=i/n,o=(rnd()-.5)*T*.36;pts.push([ax+(bx-ax)*k+nx*o,ay+(by-ay)*k+ny*o]);}
  pts.push([bx,by]);
  for(const [color,w,al] of [[0x38d9ff,.16,.35],[0xbff6ff,.06,.9],[0xffffff,.025,1]])stroke(g,pts,T*w,color,a*al);
}
/** Editor laserLines: long red horizontal runs in the art image, as 0..1 fractions. Cached per texture. */
const lineCache=new Map<string,Line[]>();
function laserLines(scene:Phaser.Scene,key:string){
  if(lineCache.has(key))return lineCache.get(key)!;
  const lines:Line[]=[];
  try{
    const img=scene.textures.get(key).getSourceImage() as HTMLImageElement,k=Math.min(1,512/img.width),w=Math.max(1,Math.round(img.width*k)),h=Math.max(1,Math.round(img.height*k));
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d',{willReadFrequently:true})!;c.drawImage(img,0,0,w,h);
    const d=c.getImageData(0,0,w,h).data,rows:{y:number;x0:number;x1:number}[]=[];
    for(let y=0;y<h;y++){
      let best=0,bs=0,run=0,st=0;
      for(let x=0;x<=w;x++){const i=(y*w+x)*4,red=x<w&&d[i+3]>120&&d[i]>170&&d[i]-Math.max(d[i+1],d[i+2])>70;if(red){if(!run)st=x;run++;}else{if(run>best){best=run;bs=st;}run=0;}}
      if(best>=w*.2)rows.push({y,x0:bs,x1:bs+best});
    }
    let cur:{ya:number;yb:number;x0:number;x1:number}|null=null;
    for(const r of rows){if(cur&&r.y-cur.yb<=Math.max(5,h*.012)){cur.yb=r.y;cur.x0=Math.min(cur.x0,r.x0);cur.x1=Math.max(cur.x1,r.x1);}else{if(cur)lines.push({y:(cur.ya+cur.yb+1)/2/h,x0:cur.x0/w,x1:cur.x1/w,t:(cur.yb-cur.ya+1)/h});cur={ya:r.y,yb:r.y,x0:r.x0,x1:r.x1};}}
    if(cur)lines.push({y:(cur.ya+cur.yb+1)/2/h,x0:cur.x0/w,x1:cur.x1/w,t:(cur.yb-cur.ya+1)/h});
  }catch{/* unreadable texture: no lines, art still shows */}
  lineCache.set(key,lines);return lines;
}
export function electricFx(scene:GameplayScene,clip?:{cols:number;rows:number}){
  const base=scene.add.graphics().setDepth(-9),glow=scene.add.graphics().setDepth(-9).setBlendMode(Phaser.BlendModes.ADD),over=scene.add.graphics().setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
  const nets=scene.terrain.hazards.map(h=>({x0:h.x-h.width/2,x1:h.x+h.width/2,y:h.y-h.height/2,c0:Math.round((h.x-h.width/2)/T),r:Math.round((h.y-h.height/2)/T)}));
  const fx=level.laserFx,K=fx.k??1.4;
  const lasers=fx.on===false?[]:level.art.filter(a=>/雷射/.test(a.src)&&!(clip&&(a.c>clip.cols||a.r>clip.rows))&&scene.textures.exists('art/'+a.src));
  const seen=(v:Phaser.Geom.Rectangle,x0:number,x1:number,y0:number,y1:number)=>x1>v.x-T&&x0<v.right+T&&y1>v.y-T&&y0<v.bottom+T;
  const shockNet=(n:typeof nets[number],clock:number)=>{
    const {x0,x1,y}=n,w=x1-x0,rnd=rng(Math.floor(clock*14)*7919+n.c0*131+n.r*17),flick=.75+.25*Math.sin(clock*37+n.c0),flash=rnd()<.08;
    for(let i=0;i<4;i++)glow.fillStyle(0x38d9ff,(flash?.45:.22)*flick*(i+1)/10).fillRect(x0,y-T*1.6+i*T*.4,w,T*.4+T*.3*+(i===3)); // ponytail: 4 bands stand in for the editor's vertical gradient
    const bx=x0-T+(clock*T*4)%(w+2*T);glow.fillStyle(0x78ebff,.25).fillRect(Math.max(x0,bx-T),y,Math.min(x1,bx+T)-Math.max(x0,bx-T),T);
    const tipY=y-T*.45;
    for(const px of [x0+T*.12,x1-T*.12]){base.fillStyle(0x5b6680,1).fillRect(px-T*.06,tipY,T*.12,T*.55);glow.fillStyle(0x96f0ff,.6+.4*flick).fillCircle(px,tipY,T*.09);}
    if(rnd()<.85)bolt(glow,x0+T*.12,tipY,x1-T*.12,tipY+(rnd()-.5)*T*.3,rnd,flash?1:.8);
    for(let i=0,c=Math.ceil(w/(T*1.6));i<c;i++){if(rnd()<.4)continue;const ax=x0+rnd()*w;bolt(glow,ax,y+T*.08,Phaser.Math.Clamp(ax+(rnd()-.5)*T*2.4,x0,x1),y-T*(.15+rnd()*.45),rnd,.9);}
    for(let k=0,c=Math.ceil(w/T);k<c;k++){const ph=(clock*1.4+k*.37)%1,sx=x0+((k*.618+Math.floor(clock*1.4+k*.37)*.29)%1)*w;glow.fillStyle(0xd9fbff,1-ph).fillRect(sx+(k%2?1:-1)*ph*T*.4,y-Math.sin(ph*Math.PI)*T*.9,2,2);}
  };
  const laser=(a:typeof lasers[number],clock:number)=>{
    const ls=laserLines(scene,'art/'+a.src),X=(f:number)=>a.flip?(a.c+a.w*(1-f))*T:(a.c+a.w*f)*T;
    ls.forEach((l,li)=>{
      const rnd=rng(Math.floor(clock*20)*9973+li*131+Math.round(a.c*7+a.r*13)),xa=Math.min(X(l.x0),X(l.x1)),xb=Math.max(X(l.x0),X(l.x1)),y=(a.r+a.h*l.y)*T,len=xb-xa;
      const flick=.7+.3*Math.sin(clock*41+li*2+a.c)+(rnd()<.12?.35:0),th=Math.max(T*.03,a.h*l.t*T*.9),amp=T*.11*K;
      glow.fillStyle(0xff3c50,Math.min(.9,.42*flick*K)*.5).fillRect(xa,y-T*.35,len,T*.7);
      const arc=(amp:number,lw:number,color:number,al:number)=>{const n=Math.max(6,Math.round(len/(T*.16))),pts=[[xa,y]];for(let i=1;i<n;i++){const e=Math.sin(i/n*Math.PI);pts.push([xa+len*i/n+(rnd()-.5)*T*.1,y+(rnd()-.5)*2*amp*(.35+.65*e)]);}pts.push([xb,y]);stroke(glow,pts,lw,color,Math.min(1,al*flick));};
      arc(amp,th*5*K,0xff1e3c,.2);arc(amp,th*2.4,0xff5a5a,.85);arc(amp*.8,th*1.1,0xfff0f0,1);if(rnd()<.7)arc(amp*1.9,th*1.2,0xff788c,.7);
      const dot=xa+((clock*.9+li*.33)%1)*len;glow.fillStyle(0xff5a64,.5).fillCircle(dot,y,T*.3).fillStyle(0xffffff,.9).fillCircle(dot,y,T*.1);
      for(const ex of [xa,xb])if(ex===xa||(l.x1<.98&&l.x0>.02))for(let i=0;i<3*K;i++){const ang=(rnd()-.5)*2.2,d=T*(.08+rnd()*.3);stroke(glow,[[ex,y],[ex+Math.cos(ang)*d*(ex===xa?1:-1),y+Math.sin(ang)*d]],Math.max(1.5,T*.025),0xffe6e6,rnd()*.9);}
      const nx=ls[li+1];if(nx&&rnd()<.35*K){const y2=(a.r+a.h*nx.y)*T,px=xa+(.1+rnd()*.8)*len,pts=[[px,y]];for(let i=1;i<5;i++)pts.push([px+(rnd()-.5)*T*.3,y+(y2-y)*i/5]);pts.push([px+(rnd()-.5)*T*.1,y2]);stroke(glow,pts,Math.max(1.5,T*.03),0xffc8d2,.9);}
    });
  };
  const update=()=>{
    base.clear();glow.clear();over.clear();
    const clock=scene.run.elapsed,v=scene.cameras.main.worldView;
    for(const n of nets)if(seen(v,n.x0,n.x1,n.y-T*2,n.y+T))shockNet(n,clock);
    for(const a of lasers)if(seen(v,a.c*T,(a.c+a.w)*T,a.r*T,(a.r+a.h)*T))laser(a,clock);
    if(scene.shockUntil){ // editor "shocked": arcs over the body, one into the net, cyan screen flash
      const rnd=rng(Math.floor(clock*20)*31+7),b=scene.body,mx=b.center.x,my=b.center.y;
      for(let i=0;i<4;i++){const ang=rnd()*Math.PI*2,r=T*(.8+rnd()*.6);bolt(over,mx,my,mx+Math.cos(ang)*r,my+Math.sin(ang)*r,rnd);}
      bolt(over,mx,b.y+b.height*.8,mx+(rnd()-.5)*T,b.bottom+T*.6,rnd);
      over.fillStyle(0x38d9ff,.25*Math.max(0,scene.shockUntil-clock)/P.shockTime).fillRect(v.x,v.y,v.width,v.height);
    }
  };
  scene.events.on('postupdate',update);
  scene.events.once('shutdown',()=>scene.events.off('postupdate',update));
}
