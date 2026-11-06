import Phaser from 'phaser';
import level from '../level/data/level.json';
import {TILE as T} from '../core/config';
import type {GameplayScene} from '../scenes/gameplay';
import {electricFx,scanLines} from './electric';
import {Shield} from './characters';
const S=T/level.tile;
type Art=typeof level.art[number];
type Glow={a:number;hold:number};
// Editor 平台亮燈: art whose name has 燈 (not 彈簧) is a lamp, dark until the player stands on it.
const isLamp=(k:string)=>/燈/.test(k)&&!/彈簧/.test(k),isLaser=(k:string)=>/雷射/.test(k)&&!isLamp(k);
/** Editor lampInfo: the name body without number prefix, brackets, 燈/裝飾/無 and spaces, plus its (左)/(右) side. */
const lampInfo=(n:string)=>{const b=n.replace(/\.[^./]+$/,'').split('/').pop()!;return{side:(/[(（](左|右)[)）]/.exec(b)??[])[1]??'',base:b.replace(/^\d+\./,'').replace(/[(（][^)）]*[)）]/g,'').replace(/燈|裝飾|無|\s/g,'')};};
/** Editor computeLampPairs: platform art → lamp art with the same name body, side and pixel size; level.lampMap wins ('-' = none). */
function lampPairs(scene:Phaser.Scene){
  const size=(k:string)=>{const i=scene.textures.get('art/'+k).getSourceImage();return i.width+'x'+i.height;};
  const lights=scene.textures.getTextureKeys().filter(k=>k.startsWith('art/')&&isLamp(k)).map(k=>({k:k.slice(4),...lampInfo(k),size:size(k.slice(4))}));
  const manual=level.lampMap as Record<string,string>,map=new Map<string,string>();
  for(const src of new Set(level.art.map(a=>a.src).filter(k=>!isLamp(k)))){
    if(manual[src]==='-')continue;if(manual[src]){map.set(src,manual[src]);continue;}
    if(/裝飾/.test(src)||!scene.textures.exists('art/'+src))continue; // 裝飾 platforms already have their bars painted
    const inf=lampInfo(src),c=lights.filter(l=>l.base===inf.base&&(!l.side||l.side===inf.side)&&l.size===size(src));
    if(c.length)map.set(src,(c.find(l=>l.side&&l.side===inf.side)??c[0]).k);
  }
  return map;
}
/** Editor lampBars: cream rounded bars painted on platform art. */
const barLines=(scene:Phaser.Scene,key:string)=>scanLines(scene,key,'lamp',(r,g,b,a)=>a>200&&r>215&&g>195&&b>140&&r-b>28&&r-b<120,.08,()=>3);
/** Editor: on → full in 0.12 s; off → stays lit 1 s, then fades over 0.8 s. */
const glowStep=(s:Glow,on:boolean,dt:number)=>{if(on){s.a=Math.min(1,s.a+dt/.12);s.hold=1;}else if((s.hold-=dt)<=0)s.a=Math.max(0,s.a-dt/.8);};
/** Presentation only: background, painted tiles and object art from the level JSON. Never touches bodies or score. */
export function levelArt(scene:GameplayScene,clip?:{cols:number;rows:number}){
  const bg=level.background;
  scene.add.image(bg.x*S,bg.y*S,bg.src).setOrigin(0).setDisplaySize(bg.w*S,bg.h*S).setScrollFactor(bg.parallax).setDepth(-50);
  scene.add.rectangle(0,0,scene.scale.width,scene.scale.height,0x000000,.35).setOrigin(0).setScrollFactor(0).setDepth(-49);
  const missing=new Set<string>(),inClip=(a:Art)=>!(clip&&(a.c>clip.cols||a.r>clip.rows));
  // Lamp brightness lampBr > 1: the editor draws the lamp once, then adds (lighter) the remainder in passes of at most 1.
  const br=level.lampBr??1.6,passes=[Math.min(1,br)];for(let r=br-1;r>.01;r-=1)passes.push(Math.min(1,r));
  const lamps:(Glow&{o:Art;images:Phaser.GameObjects.Image[]})[]=[];
  const lamp=(o:Art)=>lamps.push({o,a:0,hold:0,images:passes.map((_,i)=>scene.add.image(o.c*T,o.r*T,'art/'+o.src).setOrigin(0).setDisplaySize(o.w*T,o.h*T).setFlipX(o.flip).setDepth(-10).setBlendMode(i?Phaser.BlendModes.ADD:Phaser.BlendModes.NORMAL).setVisible(false))});
  for(const a of level.art){
    if(!inClip(a))continue;
    const key='art/'+a.src;
    if(!scene.textures.exists(key)){missing.add(a.src);scene.add.rectangle(a.c*T,a.r*T,a.w*T,a.h*T,0x5f6878,.6).setOrigin(0).setDepth(-10);continue;}
    if(isLamp(a.src)){lamp(a);continue;}
    scene.add.image(a.c*T,a.r*T,key).setOrigin(0).setDisplaySize(a.w*T,a.h*T).setFlipX(a.flip).setDepth(-10);
  }
  if(missing.size)console.warn('[level-art] missing art',[...missing]);
  // ponytail: paired lamps share the platform's cell box; the editor's rescale for a different-size manual pair is skipped (no such pair in the level).
  const pairs=lampPairs(scene),placed=new Set(lamps.map(l=>l.o.c+','+l.o.r));
  for(const a of level.art)if(inClip(a)&&pairs.has(a.src)&&!placed.has(a.c+','+a.r)&&scene.textures.exists('art/'+pairs.get(a.src)))lamp({...a,src:pairs.get(a.src)!});
  const bars=level.lampBars===false?[]:level.art.filter(a=>inClip(a)&&!isLamp(a.src)&&!isLaser(a.src)&&!pairs.has(a.src)&&scene.textures.exists('art/'+a.src))
    .map(o=>({o,a:0,hold:0,lines:barLines(scene,'art/'+o.src)})).filter(b=>b.lines.length);
  const sprung=level.springArt,moverArt=level.moverArt;
  const springs=scene.terrain.entries.filter(e=>e.data.kind==='bounce').map(e=>({e,image:scene.add.image(e.data.x,e.data.y+e.data.height/2,'art/'+sprung.normal).setOrigin(.5,1).setDepth(1)}));
  for(const s of springs)s.image.setDisplaySize(sprung.artW*T,sprung.artW*T*s.image.height/s.image.width);
  const movers=scene.terrain.entries.filter(e=>e.data.kind==='moving').map(e=>{const key='art/'+(e.data.art||moverArt.art),image=scene.add.image(0,0,key).setOrigin(0).setDepth(1);image.setDisplaySize(moverArt.artW*T,moverArt.artW*T*image.height/image.width);return{e,image,a:0,hold:0,lines:level.lampBars===false?[]:barLines(scene,key)};});
  const g=level.goalArt,goal=scene.add.image(scene.goal.x,scene.goal.y+scene.goal.height/2,'art/'+g.art).setOrigin(.5,1).setDepth(2);
  goal.setDisplaySize(g.startW*T,g.startW*T*goal.height/goal.width);
  const hints=scene.level.hints.map(h=>scene.add.triangle(h.x,h.y,-8,-5,8,-5,0,7,0xffd400).setDepth(3));
  // Editor pickups: bob 5 px; the attack item sways, the invincibility item breathes inside its shield (drawInvincible).
  const pickups=scene.pickups.map(p=>({p,scale:p.image.scaleX,shield:p.kind==='ally'?new Shield(scene,2.9):null}));
  const dark=scene.add.graphics().setDepth(1.5),glow=scene.add.graphics().setDepth(1.5).setBlendMode(Phaser.BlendModes.ADD);
  /** Editor drawBarGlow: bars dimmed blue while off, warm additive glow (two halo sizes) while lit. */
  const drawBars=(x:number,y:number,w:number,h:number,flip:boolean,lines:{x0:number;x1:number;y:number;t:number}[],k:number)=>{
    for(const l of lines){
      const bh=Math.max(h*l.t*2.1,T*.1),bw=w*(l.x1-l.x0)+bh*.4,bx=(flip?x+w*(1-l.x1):x+w*l.x0)-bh*.2,by=y+h*l.y-bh/2;
      if(k<.98)dark.fillStyle(0x102460,.55*(1-k)).fillRoundedRect(bx,by,bw,bh,bh/2);
      // ponytail: a wider faint rounded rect stands in for canvas shadowBlur.
      if(k>.02)for(const [bl,al] of [[bh*2.6,.5],[bh*1.1,.8]])glow.fillStyle(0xffecaa,al*k*.25).fillRoundedRect(bx-bl/2,by-bl/2,bw+bl,bh+bl,(bh+bl)/2).fillStyle(0xfff4cd,Math.min(1,al*k*br/1.6)).fillRoundedRect(bx,by,bw,bh,bh/2);
    }
  };
  let last=scene.run.elapsed;
  const update=()=>{
    const now=scene.run.elapsed,dt=Math.max(0,now-last),b=scene.body,cx=scene.player.x,foot=b.bottom,grounded=b.blocked.down,grid=scene.level.grid;last=now;
    for(const {e,image} of springs){const t=now-(e.bouncedAt??-9);image.setTexture('art/'+(t<.08?sprung.press:t<.25?sprung.bounce:sprung.normal));}
    for(const {e,image} of movers)image.setPosition(e.object.x-e.data.width/2,e.object.y-e.data.height/2+moverArt.artDy*T);
    for(const h of hints)h.setAlpha(.4+.6*Math.abs(Math.sin(now*4)));
    for(const q of pickups){
      const {p,shield}=q;if(!p.image.active){shield?.destroy();q.shield=null;continue;}
      const {x,y:y0}=p.object,bob=Math.sin(now*4)*5*S;
      if(!shield){p.image.setPosition(x,y0+bob).setRotation(Math.sin(now*2.2)*.06);continue;}
      const t=now+x/T*.13,size=level.itemArt.ally.w*T,y=y0+bob+Math.sin(t*2.4)*size*.05;
      shield.draw(x,y,size*1.5,t);p.image.setPosition(x,y).setScale(q.scale*(1+.04*Math.sin(t*3.6)));
    }
    // Editor updateArtLamps: lit while the player stands on the art (feet within its rows), or on solid blocks stacked right on top of it.
    const on=(o:Art)=>{
      if(!grounded||cx<o.c*T||cx>=(o.c+o.w)*T)return false;
      if(foot>=o.r*T-6*S&&foot<=(o.r+o.h)*T+6*S)return true;
      if(foot>o.r*T)return false;
      const cc=Math.floor(cx/T),end=Math.floor(o.r+.001);let r=Math.floor((foot+2*S)/T);if(end-r>14)return false;
      for(;r<end;r++)if((grid[r]?.[cc]??'#')!=='#')return false;return true;
    };
    for(const l of lamps){glowStep(l,on(l.o),dt);l.images.forEach((im,i)=>im.setVisible(l.a>.01).setAlpha(l.a*passes[i]));}
    dark.clear();glow.clear();const v=scene.cameras.main.worldView;
    for(const l of bars){glowStep(l,on(l.o),dt);const {c,r,w,h,flip}=l.o;if(c*T<v.right&&(c+w)*T>v.x&&r*T<v.bottom&&(r+h)*T>v.y)drawBars(c*T,r*T,w*T,h*T,flip,l.lines,l.a);}
    for(const m of movers){
      const o=m.e.object,ride=grounded&&Math.abs(foot-(o.y-m.e.data.height/2))<4&&b.right>o.x-m.e.data.width/2&&b.left<o.x+m.e.data.width/2;
      glowStep(m,ride,dt);if(m.lines.length)drawBars(m.image.x,m.image.y,m.image.displayWidth,m.image.displayHeight,false,m.lines,m.a);
    }
  };
  scene.events.on('postupdate',update);
  scene.events.once('shutdown',()=>scene.events.off('postupdate',update));
  update();
  electricFx(scene,clip);
}
