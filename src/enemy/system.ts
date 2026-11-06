import Phaser from 'phaser';
import type {LevelData,EnemyKind,EnemySpawn} from '../level/data';
import type {GameplaySession} from '../core/session';
import {TILE as T,weaponMode,type Mode} from '../core/config';
import beholder from '../level/data/beholder.json';
import charger from '../level/data/charger.json';
import {sfx,type SfxId} from '../audio/sfx';
// Sheet rows 06 丟出, 07 踩擊, 10 ROG Logo: every defeat plays HIT-02 on top of its cause.
const DEFEAT:Record<'stomp'|'bolt'|'ally',SfxId[]>={stomp:['HIT-01','MOV-02','HIT-02'],bolt:['PWR-05','HIT-02'],ally:['HIT-04','HIT-02']};

type Rect={x:number;y:number;w:number;h:number}; // top-left, px
type Enemy=Rect&{id:string;kind:EnemyKind;spawn:EnemySpawn;home:Rect;dir:number;defeated:boolean;state:'patrol'|'chase'|'charge'|'fire'|'idle'|'rest';t:number;lost:number;cd:number;aim:number;anim:number;beam:{ax:number;ay:number;bx:number;by:number}|null;sprite:Phaser.GameObjects.Image};
type Bolt={x:number;y:number;vx:number;vy:number;t:number;m:Mode;hit:Set<Enemy>;hitE?:Enemy;image:Phaser.GameObjects.Image};
type G=Phaser.GameObjects.Graphics;
const overlap=(a:Rect,b:Rect)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const key=(file:string)=>'monsters/'+file;
/** One enemy kind: art config, spawn box, AI step, animation and its own extra drawing.
 *  EnemySystem never branches on the kind; it calls the behaviour in KINDS (one entry per monsters/*.json). */
interface Kind {
  cfg:{frames:string[];size:number;actions:Record<string,{frames:number[];fps:number}>};
  start:Enemy['state'];
  box(spawn:EnemySpawn):Rect;
  step(s:EnemySystem,e:Enemy,p:Rect,dt:number):void;
  act(e:Enemy):string;
  spriteY(e:Enemy):number;
  draw(s:EnemySystem,e:Enemy,beams:G,dust:G):void;
}
const Z=beholder.laser;
/** Muzzle in world px from the beholder body centre (planning editor beholderMuzzle; the art faces left). */
const muzzle=(e:Enemy)=>({x:e.x+e.w/2+Z.origin[0]*beholder.size*T*-e.dir,y:e.y+e.h/2+Z.origin[1]*beholder.size*T});
const KINDS:Record<EnemyKind,Kind>={
  beholder:{
    cfg:beholder,start:'patrol',
    box(spawn){const w=beholder.hitbox[0]*T,h=beholder.hitbox[1]*T,cy=spawn.y-beholder.ai.contentBottom*beholder.size*T-(spawn.float?beholder.ai.hover*T:0);return{x:spawn.x-w/2,y:cy-h/2,w,h};},
    // patrol → chase (sees the player) → charge (aim follows until lock) → fire → chase; gives up when out of range or unseen.
    step(s,e,p,dt){
      const A=beholder.ai,cx=e.x+e.w/2,cy=e.y+e.h/2,px=p.x+p.w/2,py=p.y+p.h*.45,dist=Math.hypot(px-cx,py-cy);
      e.cd-=dt;
      if(e.state==='patrol'){
        if(!s.walk(e,A.patrol*T,dt))e.dir*=-1;
        if(dist<A.sight*T&&s.sees(cx,cy,px,py)){e.state='chase';e.anim=0;e.lost=0;}
      }else if(e.state==='chase'){
        e.dir=Math.sign(px-cx)||e.dir;e.lost=s.sees(cx,cy,px,py)?0:e.lost+dt;
        if(dist>A.lose*T||e.lost>A.giveUp){e.state='patrol';e.anim=0;return;}
        if(e.spawn.laser&&e.cd<=0&&dist<e.spawn.range&&e.lost===0){const m=muzzle(e);e.state='charge';e.t=Z.charge;e.aim=Math.atan2(py-m.y,px-m.x);return;} // PO 2026-11-05: no charge-up (蓄力) sound, ENM-03 unused
        if(Math.abs(px-cx)>Math.max(e.spawn.laser?e.spawn.range*Z.keepAway:0,T*.2))s.walk(e,A.chase*T,dt);
      }else if(e.state==='charge'){
        e.t-=dt;const m=muzzle(e);
        if(e.t>Z.lock){e.dir=Math.sign(px-cx)||e.dir;e.aim=Math.atan2(py-m.y,px-m.x);} // aim follows until locked
        if(e.t<=0){const end=s.ray(m.x,m.y,e.aim,e.spawn.range);e.state='fire';e.t=Z.fire;e.beam={ax:m.x,ay:m.y,bx:end.x,by:end.y};sfx('ENM-04');}
      }else if(e.state==='fire'){
        e.t-=dt;const b=e.beam!,r=Z.width*T/2,n=Math.ceil(Math.hypot(b.bx-b.ax,b.by-b.ay)/(T/8));
        for(let i=0;i<=n;i++){const x=b.ax+(b.bx-b.ax)*i/n,y=b.ay+(b.by-b.ay)*i/n;if(x>p.x+2-r&&x<p.x+p.w-2+r&&y>p.y+3-r&&y<p.y+p.h-1+r){s.hurt('laser');break;}}
        if(e.t<=0){e.state='chase';e.beam=null;e.cd=Z.cooldown;}
      }
    },
    act:e=>e.state==='rest'?'rest':e.state==='patrol'?'patrol':'chase',
    spriteY:e=>e.y+e.h/2,
    draw(s,e,beams){
      if(e.state==='charge'){const m=muzzle(e),end=s.ray(m.x,m.y,e.aim,e.spawn.range);beams.lineStyle(1,0xff3b6b,e.t<=Z.lock?.9:.4).lineBetween(m.x,m.y,end.x,end.y);}
      if(e.beam)beams.lineStyle(Z.width*T,0xff3b6b,.9).lineBetween(e.beam.ax,e.beam.ay,e.beam.bx,e.beam.by).lineStyle(2,0xffffff,1).lineBetween(e.beam.ax,e.beam.ay,e.beam.bx,e.beam.by);
    },
  },
  charger:{
    cfg:charger,start:'idle',
    box(spawn){const w=.9*T,h=T;return{x:spawn.x-w/2,y:spawn.y-h,w,h};},
    // idle → charge (player within 7 cells on about the same floor) for 1.4 s → rest; walls and ledges turn it round.
    step(s,e,p,dt){
      let sp=0;const dx=p.x+p.w/2-(e.x+e.w/2),dyf=Math.abs(p.y+p.h-(e.y+e.h));
      if(e.state==='idle'){if(Math.abs(dx)<7*T&&dyf<2*T){e.state='charge';e.dir=Math.sign(dx)||-1;e.t=1.4;e.anim=0;sfx('ENM-01');sfx('ENM-02');}}
      else if(e.state==='charge'){sp=7*T;e.t-=dt;if(e.t<=0){e.state='rest';e.t=1;e.anim=0;}}
      else{e.t-=dt;if(e.t<=0){e.state='idle';e.anim=0;}}
      if(sp){
        e.x+=e.dir*sp*dt;const fx=e.dir>0?e.x+e.w:e.x,fc=Math.floor(fx/T),fr=Math.floor((e.y+e.h-1)/T);
        if(s.tile(fc,fr)==='#'||!s.floor(fc,fr+1)||fx<0||fx>s.level.width){e.x-=e.dir*sp*dt;e.dir*=-1;if(e.state==='charge'){e.state='rest';e.t=.8;e.anim=0;}}
      }
    },
    act:e=>e.state==='rest'?'rest':e.state==='charge'?'charge':'idle',
    spriteY:e=>e.y+e.h-charger.size*T*(.855-.5),
    draw(s,e,_beams,dust){
      if(e.state!=='charge'||!charger.actions.charge.dust)return; // editor: rush dust behind the feet + three speed lines
      const cx=e.x+e.w/2,gy=e.y+e.h,now=s.session.run.elapsed,S=T/64;
      for(let i=0;i<4;i++){const k=(now*3+i/4)%1;dust.fillStyle(0xdce1eb,.35*(1-k)).fillCircle(cx-e.dir*(T*.6+k*T*1.4),gy-6*S-k*14*S,(8+k*22)*S);}
      dust.lineStyle(4*S,0xffffff,.55);for(let i=0;i<3;i++){const ly=gy-T*(.35+i*.22),x0=cx-e.dir*T*(1+(i%2)*.3);dust.lineBetween(x0,ly,x0-e.dir*T*(.6+.3*Math.sin(now*20+i)),ly);}
    },
  },
};

export class EnemySystem {
  enemies:Enemy[]=[];bolts:Bolt[]=[];shieldHit=-9;bursts:(Rect&{t:number})[]=[];private lastBottom=Infinity;
  private beams:Phaser.GameObjects.Graphics;private dust:Phaser.GameObjects.Graphics;
  constructor(readonly scene:Phaser.Scene,readonly session:GameplaySession,readonly player:Phaser.GameObjects.Rectangle,readonly level:LevelData,readonly hurt:(cause:string)=>void,readonly stomped:(enemyTop:number)=>void){
    this.beams=scene.add.graphics().setDepth(6);this.dust=scene.add.graphics().setDepth(3.9); // dust draws behind the spider
    for(const spawn of level.enemies){
      const k=KINDS[spawn.kind],home=k.box(spawn),sprite=scene.add.image(spawn.x,home.y+home.h/2,key(k.cfg.frames[0])).setDepth(4);
      sprite.setDisplaySize(k.cfg.size*T,k.cfg.size*T);
      this.enemies.push({...home,home,id:spawn.id,kind:spawn.kind,spawn,dir:-1,defeated:false,state:k.start,t:0,lost:0,cd:0,aim:0,anim:0,beam:null,sprite});
    }
    this.reset();
  }
  tile(c:number,r:number){const g=this.level.grid;if(c<0||c>=g[0].length)return '#';if(r<0||r>=g.length)return '.';return g[r][c];}
  solid(c:number,r:number){const t=this.tile(c,r);return t==='#'||t==='/'||t==='\\';}
  floor(c:number,r:number){const t=this.tile(c,r);return t==='#'||t==='=';}
  /** Point inside solid material: a full block, or under the diagonal of a slope cell. */
  inSolid(x:number,y:number){const c=Math.floor(x/T),r=Math.floor(y/T),t=this.tile(c,r),lx=x-c*T,ly=y-r*T;return t==='#'||(t==='/'&&ly>T-lx)||(t==='\\'&&ly>lx);}
  /** Ray from (ax,ay) toward ang, stopping before a solid cell. */
  ray(ax:number,ay:number,ang:number,len:number){const st=T/8,dx=Math.cos(ang)*st,dy=Math.sin(ang)*st;let x=ax,y=ay;
    for(let d=0;d<len;d+=st){if(this.solid(Math.floor((x+dx)/T),Math.floor((y+dy)/T)))break;x+=dx;y+=dy;}return{x,y};}
  sees(ax:number,ay:number,bx:number,by:number){const e=this.ray(ax,ay,Math.atan2(by-ay,bx-ax),Math.hypot(bx-ax,by-ay));return Math.hypot(e.x-bx,e.y-by)<T/4;}
  get body(){return this.player.body as Phaser.Physics.Arcade.Body;}
  defeat(e:Enemy,how:'stomp'|'bolt'|'ally'){
    if(e.defeated)return;e.defeated=true;e.beam=null;const before=this.session.score.total;
    if(this.session.credit(e.id,how))this.pop('+'+(this.session.score.total-before),e.x+e.w/2,e.y);DEFEAT[how].forEach(id=>sfx(id));
    if(how==='stomp'){e.sprite.setTintFill(0xffffff);this.scene.time.delayedCall(80,()=>e.sprite.clearTint());} // editor STOMP_FLASH 0.08 s
    this.scene.tweens.add({targets:e.sprite,alpha:0,scaleY:e.sprite.scaleY*.4,duration:180});
  }
  /** Editor pop(): score text rises 120 px/s (64 px cells) for 0.6 s, fading over the last 0.3 s. */
  pop(text:string,x:number,y:number){
    const t=this.scene.add.text(x,y,text,{fontFamily:'"Microsoft JhengHei",sans-serif',fontStyle:'800',fontSize:'20px',color:'#ffb74d'}).setOrigin(.5).setDepth(8);
    this.scene.tweens.add({targets:t,y:y-36,duration:600,onComplete:()=>t.destroy()});this.scene.tweens.add({targets:t,alpha:0,delay:300,duration:300});
  }
  /** Throw the selected attack item from `height` cells above the feet (planning v0.3 §3.2). */
  throwItem(src:string,x:number,feet:number,face:number){
    const m=weaponMode(src),image=this.scene.add.image(x,feet,'items/攻擊道具/'+src).setDepth(6);
    image.setDisplaySize(1.3*T,1.3*T*image.height/image.width);
    this.bolts.push({x,y:feet-m.height*T,vx:face*m.speed*T,vy:-m.lift*T,t:m.range/m.speed,m,hit:new Set(),image});
    return m;
  }
  /** Step along the floor row; false at a wall, a ledge or the level edge. */
  walk(e:Enemy,sp:number,dt:number){
    const fr=Math.round(e.spawn.y/T),nx=e.x+e.dir*sp*dt,fx=e.dir>0?nx+e.w:nx,fc=Math.floor(fx/T);
    if(fx<0||fx>this.level.width||this.solid(fc,fr-1)||this.solid(fc,fr-2)||(e.spawn.float&&this.solid(fc,fr-3))||!this.floor(fc,fr))return false;
    e.x=nx;return true;
  }
  update(dt:number){
    // Feet at the previous fixed step (planning editor p.prevBot) decide a stomp.
    const b=this.body,p={x:b.x,y:b.y,w:b.width,h:b.height},prevBottom=Math.min(this.lastBottom,b.bottom);this.lastBottom=b.bottom;
    for(const e of this.enemies){
      if(e.defeated)continue;e.anim+=dt;
      KINDS[e.kind].step(this,e,p,dt);
      if(e.defeated||!overlap(p,e))continue;
      if(this.session.power.ally){this.defeat(e,'ally');this.shieldHit=this.session.run.elapsed;}
      else if(b.velocity.y>0&&prevBottom<=e.y+e.h*.6){this.defeat(e,'stomp');this.stomped(e.y);}
      else this.hurt(e.id);
    }
    for(const bolt of this.bolts){
      const m=bolt.m,hw=m.hitbox[0]*T/2,hh=m.hitbox[1]*T/2;
      bolt.vy+=m.gravity*T*dt;bolt.x+=bolt.vx*dt;bolt.y+=bolt.vy*dt;bolt.t-=dt;
      if(this.inSolid(bolt.x,bolt.y))bolt.t=0; // editor checked '#' only, so items flew through slopes
      else if(m.burst&&bolt.vy>0){const gr=Math.floor((bolt.y+hh)/T),gt=this.tile(Math.floor(bolt.x/T),gr);if(gt==='#'||gt==='/'||gt==='\\'||gt==='='){bolt.y=gr*T-hh;bolt.t=0;}} // A lands
      for(const e of this.enemies)if(!e.defeated&&bolt.t>0&&!bolt.hit.has(e)&&overlap({x:bolt.x-hw,y:bolt.y-hh,w:hw*2,h:hh*2},e)){
        bolt.hit.add(e);bolt.hitE=e;this.defeat(e,'bolt');if(bolt.hit.size>=(m.pierce??1))bolt.t=0;
      }
      if(bolt.t<=0&&m.burst){const s=m.burst.size,cx=bolt.hitE?bolt.hitE.x+bolt.hitE.w/2:bolt.x,hwb=s[0]*T/2*m.burst.scale,hhb=s[1]*T/2*m.burst.scale;this.bursts.push({x:cx-hwb,y:bolt.y-hhb,w:hwb*2,h:hhb*2,t:m.burst.time});}
      bolt.image.setPosition(bolt.x,bolt.y).setAngle(bolt.image.angle+m.spin*dt*Math.sign(bolt.vx));
      if(bolt.t<=0)bolt.image.destroy();
    }
    this.bolts=this.bolts.filter(x=>x.t>0);
    for(const u of this.bursts){u.t-=dt;for(const e of this.enemies)if(!e.defeated&&overlap(u,e))this.defeat(e,'bolt');}
    this.bursts=this.bursts.filter(u=>u.t>0);
    this.draw();
  }
  private draw(){
    const g=this.beams.clear(),dust=this.dust.clear();
    for(const e of this.enemies){
      if(e.defeated)continue;
      const k=KINDS[e.kind],act=k.cfg.actions[k.act(e)]??k.cfg.actions.idle,frame=act.frames[Math.floor(e.anim*act.fps)%act.frames.length]??act.frames[0];
      k.draw(this,e,g,dust);
      e.sprite.setTexture(key(k.cfg.frames[frame])).setDisplaySize(k.cfg.size*T,k.cfg.size*T).setPosition(e.x+e.w/2,k.spriteY(e)).setFlipX(e.dir>0);
    }
    for(const u of this.bursts)g.lineStyle(3,0xffb347,u.t*4).strokeEllipse(u.x+u.w/2,u.y+u.h/2,u.w,u.h);
  }
  clearBolts(){for(const b of this.bolts)b.image.destroy();this.bolts=[];this.bursts=[];}
  /** Back to the safe point: every enemy returns home; lasers wait one cooldown (planning editor fallReset). */
  reset(){this.clearBolts();for(const e of this.enemies){Object.assign(e,e.home,{defeated:false,dir:-1,t:0,lost:0,anim:0,beam:null,state:KINDS[e.kind].start,cd:Z.cooldown});e.sprite.setAlpha(1).setVisible(true).clearTint();}this.draw();}
  dangerAt(x:number){return this.enemies.some(e=>!e.defeated&&Math.abs(e.x+e.w/2-x)<3.5*T);}
}
