import Phaser from 'phaser';
import { TEST_PROFILE as P, TILE as T, ATTACK_ITEMS, weaponMode, RENDER_SCALE as R } from '../core/config';
import { FixedStepController } from '../core/fixed-step';
import { GameplayStateMachine, RunStateManager } from '../core/state';
import { InputAdapter, type Pad } from '../input/adapter';
import { activePad } from '../input/gamepad';
import {PlayerController} from '../player/controller';
import {CharacterView} from '../assets/characters';
import {PRESETS,roleOf} from '../assets/catalog';
import type {CharacterSkin} from '../comfy/skin';
import {stepPhysics} from '../physics/step';
import {LEVEL,TUTORIAL_LEVEL,TUTORIAL_CLIP,validateLevel} from '../level/data';
import {TerrainSystem} from '../terrain/system';
import {CameraManager,renderOffset} from '../camera/manager';
import {GameplaySession} from '../core/session';
import {BadgeWorld} from '../badge/world';
import {RespawnManager} from '../respawn/manager';
import {EnemySystem} from '../enemy/system';
import {levelArt} from '../assets/level-art';
import {playerFx} from '../assets/player-fx';
import level from '../level/data/level.json';
import {sfx,hold,stopHeld,listen} from '../audio/sfx';
const pose=(o:Phaser.GameObjects.Image)=>[o.x,o.y,o.rotation];
export class GameplayScene extends Phaser.Scene {
  run!: RunStateManager;
  flow!: GameplayStateMachine;
  inputAdapter!: InputAdapter;
  fixed!: FixedStepController;
  player!: Phaser.GameObjects.Rectangle;
  body!: Phaser.Physics.Arcade.Body;
  hud!: Phaser.GameObjects.Text;
  testPad: Pad | null = null;
  controller!:PlayerController;
  presentation!:CharacterView;
  pending={jump:false,dash:false,throw:false,down:false};
  terrain!:TerrainSystem; cameraManager!:CameraManager;
  session!:GameplaySession;badges!:BadgeWorld;respawner!:RespawnManager;enemies!:EnemySystem;
  pickups:{id:string;kind:'laptop'|'ally';object:Phaser.GameObjects.Rectangle;image:Phaser.GameObjects.Image}[]=[];
  goal!:Phaser.GameObjects.Rectangle;attackItem=ATTACK_ITEMS[0].src;shockUntil=0;stompFx={x:0,y:0,t0:-9};
  menu=-1;lastMove=0;menuView!:Phaser.GameObjects.Text;menuMask!:Phaser.GameObjects.Rectangle;
  private frameTime=0;
  /** Logic state before / after the last step. Render draws between them (shown); collisions only ever read the body.
   *  A pause freezes what is shown; the resume draws on from there. */
  private from={x:0,y:0,cx:0,cy:0};private to=this.from;private shown=this.from;private lerped=false;private held=false;
  private mark(){const c=this.cameras.main;return{x:this.player.x,y:this.player.y,cx:c.scrollX,cy:c.scrollY};}
  /** Art the systems place once per logic step (enemies, badges, thrown items): pose before (f) and after (t) that step. */
  private movers=new Map<Phaser.GameObjects.Image,{f:number[];t:number[]}>();
  /** Where art spawned mid-step (a thrown item, a scattered badge) was created: its first step is drawn from there. */
  private born=new Map<Phaser.GameObjects.GameObject,number[]>();
  private onBorn=(o:Phaser.GameObjects.GameObject)=>{if(o instanceof Phaser.GameObjects.Image)this.born.set(o,pose(o));};
  private art(){return [...this.enemies.enemies.map(e=>e.sprite),...this.badges.objects.values(),...this.enemies.bolts.map(b=>b.image)];}
  level=LEVEL;
  constructor() { super('Gameplay'); }
  create(data:{duration?:number;sessionId?:string;skin?:CharacterSkin;attackItem?:string;tutorial?:boolean;flow?:GameplayStateMachine}={}) {
    const debug=new URLSearchParams(location.search).get('debug')==='1';
    this.frameTime=performance.now();this.shockUntil=0;this.stompFx={x:0,y:0,t0:-9};
    this.level=data.tutorial?TUTORIAL_LEVEL:LEVEL;
    this.attackItem=ATTACK_ITEMS.find(i=>i.src===data.attackItem)?.src??ATTACK_ITEMS[0].src;
    this.session=new GameplaySession(data.duration??P.timeTier,data.sessionId??(sessionStorage.sessionId ??= crypto.randomUUID()),data.tutorial);this.run=this.session.run;listen(this.session.events);
    this.flow=data.flow??new GameplayStateMachine();if(!data.flow)this.flow.enterGameplay();
    this.fixed=new FixedStepController(debug&&Number(new URLSearchParams(location.search).get('hz')) === 60 ? 60 : 24);
    this.physics.world.fixedStep=false;
    this.inputAdapter=new InputAdapter(P.deadzone); this.inputAdapter.attach();
    this.inputAdapter.latch=true; // the pad button that confirmed Start/Restart is still down: it must not also jump
    validateLevel(this.level);
    this.physics.world.setBounds(0,0,this.level.width,this.level.height,true,true,true,false);
    this.add.rectangle(this.level.width/2,this.level.height/2,this.level.width,this.level.height,0x05060a).setDepth(-100);
    this.player=this.add.rectangle(this.level.start.x,this.level.start.y,P.bodyWidth,P.bodyHeight,0x4ed8b5).setDepth(5);
    this.physics.add.existing(this.player); this.body=this.player.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true);
    this.controller=new PlayerController(this.body);
    this.presentation=new CharacterView(this,this.player,data.skin??PRESETS[roleOf((document.querySelector('#character') as HTMLSelectElement)?.value)],debug);
    this.clearInput();
    this.terrain=new TerrainSystem(this,this.level,this.player,()=>this.run.elapsed,()=>{this.controller.bounce();this.session.stats.bounces++;sfx('ENV-01');},()=>this.run.elapsed<this.controller.dropUntil,debug);
    this.cameraManager=new CameraManager(this.cameras.main,this.level);this.cameraManager.reset(this.player.x,this.body.bottom);
    if(data.tutorial)this.cameras.main.setViewport(290*R,140*R,620*R,240*R);
    this.respawner=new RespawnManager(this.terrain,this.level);
    this.badges=new BadgeWorld(this,this.session,this.player,this.terrain,this.level.badges);
    this.enemies=new EnemySystem(this,this.session,this.player,this.level,cause=>this.takeDamage(cause),y=>{this.controller.bounce(P.jumpSpeed*P.stompBounce);this.stompFx={x:this.player.x,y,t0:this.run.elapsed};});
    this.pickups=this.level.powerups.map(p=>{
      const art=p.kind==='ally'?level.itemArt.ally:null,w=p.kind==='laptop'?2*T:T;
      const object=this.add.rectangle(p.x,p.y,w,T,p.kind==='ally'?0xb98cff:0x5ed5f1).setDepth(3).setAlpha(debug?.5:0);
      const image=this.add.image(p.x,p.y,art?'items/'+art.art:'items/攻擊道具/'+this.attackItem).setDepth(3);
      image.setDisplaySize((art?art.w:1.9)*T,(art?art.w:1.9)*T*image.height/image.width);
      return{...p,object,image};
    });
    const g=this.level.goal;this.goal=this.add.rectangle(g.x,g.y,g.width,g.height,0x82ec7b).setAlpha(debug?.4:0);
    levelArt(this,data.tutorial?TUTORIAL_CLIP:undefined);playerFx(this);
    document.querySelector('#result')!.textContent='';
    this.hud=this.add.text(16,14,'',{fontSize:'16px',color:'#ffffff'}).setScrollFactor(0).setDepth(100);
    this.hud.setVisible(!this.registry.get('station'));
    this.menu=-1;this.lastMove=0;this.menuMask=this.add.rectangle(P.width/2,P.height/2,P.width,P.height,0x000000,.8).setScrollFactor(0).setDepth(200).setVisible(false);
    this.menuView=this.add.text(P.width/2,P.height/2,'',{fontSize:'28px',color:'#ffffff',align:'center'}).setOrigin(.5).setScrollFactor(0).setDepth(201);
    this.lerped=this.held=false;this.from=this.to=this.shown=this.mark();this.movers.clear();this.born.clear();this.events.on('addedtoscene',this.onBorn);
    this.events.once('shutdown',()=>{ this.events.off('addedtoscene',this.onBorn); this.inputAdapter.dispose(); this.session.dispose(); stopHeld(); });
    (window as any).__gameplay=this;
  }
  clearInput() { this.inputAdapter.clear(); this.pending={jump:false,dash:false,throw:false,down:false}; }
  togglePause() { if(this.run.phase==='paused') this.run.resume(); else this.run.pause(); this.fixed.reset(); this.clearInput(); }
  home() { this.run.pause(); this.clearInput(); this.flow.transition('P0'); this.scene.stop(); }
  // UX p14 Home menu (debug only): Restart only before the Result is settled; confirm = Jump.
  menuOptions() { return this.session.result ? ['繼續','回到主畫面'] : ['繼續','重新開始','回到主畫面']; }
  setMenu(open:boolean) { if(open){this.menu=0;this.run.pause();} else {this.menu=-1;this.run.resume();} this.fixed.reset(); this.clearInput(); }
  /** Returns true when the menu consumed this frame's input. */
  updateMenu(a:{move:number;jump:boolean;home:boolean}) {
    if(a.home) { this.setMenu(this.menu<0); return true; }
    if(this.menu<0) return false;
    const options=this.menuOptions();
    if(a.move && a.move!==this.lastMove) this.menu=(this.menu+a.move+options.length)%options.length;
    if(a.jump) { const choice=options[this.menu]; if(choice==='繼續') this.setMenu(false); else if(choice==='重新開始') this.scene.restart(); else this.home(); }
    return true;
  }
  takeDamage(cause:string){
    const hit=this.session.hit(cause);if(hit.kind==='immune')return;
    this.badges.scatter(hit.drops,this.player.x,this.player.y);
    if(hit.kind==='respawn')this.respawn(cause);
    else {this.controller.hurtUntil=this.run.elapsed+.25;this.body.setVelocity(-this.controller.facing*150,-250);}
  }
  respawn(cause:string){
    const drops=this.session.respawn(cause);if(!drops)return;
    this.shockUntil=0;const p=this.respawner.position(P.bodyWidth,P.bodyHeight);
    this.body.reset(p.x,p.y);this.controller.reset();this.clearInput();
    this.badges.scatter(drops,p.x,p.y);
    this.enemies.reset();this.cameraManager.reset(p.x,p.y+P.bodyHeight/2);this.session.recovered();
    this.from=this.mark(); // a respawn is a cut, not motion to draw
  }
  /** 0 beyond nearR cells from the portal, 1 within 1.5 cells, smoothstep (planning editor goalNear). */
  goalNear(){
    const R=level.goalArt.nearR,dx=(this.player.x-this.goal.x)/T,dy=(this.player.y-this.goal.y)/T*.6,n=Phaser.Math.Clamp((R-Math.hypot(dx,dy))/Math.max(.5,R-1.5),0,1);
    return n*n*(3-2*n);
  }
  finalize(){
    if(!this.session.result)return;
    this.body.setVelocity(0);this.clearInput();this.shockUntil=0;
    this.controller.state=this.session.result.endReason==='goal'?'WIN':'IDLE';
    this.session.power.clear();this.enemies.clearBolts();
    if(!this.registry.get('station')&&this.flow.flow==='P4'){this.flow.transition('P5');this.flow.transition('P6');}
    document.querySelector('#result')!.textContent=JSON.stringify(this.session.result,null,2);
  }
  update(_time: number,delta: number) {
    const now=performance.now();delta=now-this.frameTime;this.frameTime=now;
    // Logic reads the step's own poses (badges keep theirs on the image), never last frame's in-between ones.
    if(this.lerped&&this.run.phase!=='paused'){
      for(const [o,m] of this.movers){if(this.held)m.f=pose(o);if(o.active)o.setPosition(m.t[0],m.t[1]).setRotation(m.t[2]);}
      this.cameras.main.setScroll(this.to.cx,this.to.cy);this.lerped=false;
    }
    // Before the station/menu early returns: pause, Result and menus must silence these. SYS-01 is 9.0 s, so it ends at 0.
    const live=this.run.phase==='running',timed=live&&!this.session.tutorial;
    hold('ENV-04',+timed);hold('PWR-07',+(live&&this.session.power.ally));hold('ENV-02',live?this.goalNear():0);hold('SYS-01',+(timed&&this.run.remaining>0&&this.run.remaining<=9));
    const pad=this.testPad ?? activePad();
    const a=this.inputAdapter.sample(pad);
    const station=this.registry.get('station');
    if(station?.input(a))return;
    this.inputAdapter.navAt=Infinity; // a direction held through gameplay must not start scrolling the next menu
    const inMenu=this.updateMenu(a);this.lastMove=a.move;
    this.menuMask.setVisible(this.menu>=0);this.menuView.setText(this.menu<0?'':this.menuOptions().map((o,i)=>i===this.menu?`▶ ${o} ◀`:o).join('\n\n'));
    if(inMenu) return;
    if(a.pause) this.togglePause();
    if(this.run.phase==='running')for(const k of ['jump','dash','throw','down'] as const)this.pending[k] ||= a[k];
    if(this.run.phase==='running') this.fixed.update(delta/1000,(dt,elapsed)=>{
      if(this.run.phase!=='running')return;
      this.from=this.mark();for(const o of this.art())this.movers.set(o,{f:pose(o),t:pose(o)});
      this.session.tick(elapsed,true);
      this.terrain.update(dt);
      if(this.shockUntil){ // planning: hazard shock 0.6 s, frozen, then back to the last safe ground
        this.pending={jump:false,dash:false,throw:false,down:false};
        if(this.run.elapsed>=this.shockUntil)this.respawn('pit');
        if(!this.session.result&&this.run.remaining===0){this.session.finish('time-up');this.finalize();}
        return;
      }
      this.controller.update({...a,...this.pending},this.run.elapsed,dt,this.session.power.ally?P.allySpeed:1);
      if(this.pending.throw&&this.session.power.throw(this.run.elapsed,weaponMode(this.attackItem).cooldown)){this.enemies.throwItem(this.attackItem,this.player.x,this.body.bottom,this.controller.facing);this.presentation.attack(this.run.elapsed);sfx('PWR-04');}
      this.pending={jump:false,dash:false,throw:false,down:false};
      this.enemies.update(dt);
      stepPhysics(this.physics.world,this.run.elapsed,dt,()=>this.terrain.resolveSlopes());
      this.badges.update(dt);
      const bounds=new Phaser.Geom.Rectangle(this.body.x,this.body.y,this.body.width,this.body.height);
      for(const p of this.pickups)if(p.object.active&&Phaser.Geom.Intersects.RectangleToRectangle(bounds,p.object.getBounds())){this.session.activate(p.kind,p.id);p.object.destroy();p.image.destroy();}
      this.respawner.track(this.player.x,this.player.y,this.body.width,this.body.height,this.body.blocked.down&&this.run.elapsed>=this.controller.dashUntil,this.enemies.dangerAt(this.player.x));
      if(this.player.y>this.level.pitY){sfx('MOV-06');this.respawn('pit');}
      else if(this.terrain.hazardAt(this.body.left,this.body.top,this.body.right,this.body.bottom)){this.shockUntil=this.run.elapsed+P.shockTime;this.body.setVelocity(0);this.body.allowGravity=false;this.controller.state='HURT';sfx('MOV-06');}
      if(Phaser.Geom.Intersects.RectangleToRectangle(bounds,this.goal.getBounds())){this.session.finish('goal');this.finalize();}
      if(!this.session.result&&this.run.remaining===0){this.session.finish('time-up');this.finalize();}
      if(this.session.result)return;
      if(this.session.tutorial){const c=this.cameras.main,o=renderOffset(c);c.setScroll(Math.max(0,this.player.x-200)-o.x,Math.min(this.level.start.y-140,this.player.y-120)-o.y);}
      else this.cameraManager.update({x:this.player.x,top:this.body.top,bottom:this.body.bottom,vx:this.body.velocity.x,vy:this.body.velocity.y,grounded:this.body.blocked.down},dt,this.goalNear());
    });
    if(this.run.phase!=='paused'){
      this.to=this.mark();const live=new Set(this.art());
      for(const o of this.movers.keys())if(!live.has(o))this.movers.delete(o);
      for(const o of live){const m=this.movers.get(o),p=pose(o);if(m)m.t=p;else this.movers.set(o,{f:this.born.get(o)??p,t:p});}
      this.born.clear();
    }
    const moving=this.run.phase==='running'&&!this.shockUntil,frozen=this.run.phase==='paused'&&this.lerped;
    if(moving&&this.held)this.from=this.shown;this.held=frozen;
    const pw=this.session.power,t=this.run.elapsed,f=this.from,g=this.to,k=moving?Math.min(1,this.fixed.accumulator*this.fixed.hz):1;
    if(k<1){for(const [o,{f:a,t:b}] of this.movers)if(o.active)o.setPosition(a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k).setRotation(a[2]+Phaser.Math.Angle.Wrap(b[2]-a[2])*k);
      const s=this.shown={x:f.x+(g.x-f.x)*k,y:f.y+(g.y-f.y)*k,cx:f.cx+(g.cx-f.cx)*k,cy:f.cy+(g.cy-f.cy)*k};this.cameras.main.setScroll(s.cx,s.cy);this.lerped=true;}
    const at=frozen||k<1?this.shown:this.player;
    this.presentation.update(this.shockUntil?'HURT':this.controller.state,this.controller.facing,t,{ally:pw.ally?pw.allyUntil-t:0,since:t-pw.allyAt,hit:this.enemies.shieldHit,blink:!this.shockUntil&&t<this.session.damage.immuneUntil},at);
    // Station mode hides the Phaser HUD; skip re-rasterising its text every frame.
    if(this.hud.visible)this.hud.setText(`TEST ONLY / ${this.fixed.hz}Hz\n${this.run.phase} · Timer ${this.run.remaining.toFixed(1)}\nBadge ${this.session.badges.held} · Score ${this.session.score.total} · Combo ${this.session.combo.count} ×${this.session.combo.multiplier}\nItem ${this.session.power.armed?weaponMode(this.attackItem).tag??'ON':'none'} · Ally ${this.session.power.ally?Math.ceil(this.session.power.allyUntil-this.run.elapsed):'-'}`);
  }
}
