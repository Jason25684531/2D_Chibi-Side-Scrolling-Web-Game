import Phaser from 'phaser';
import { TEST_PROFILE as P, TILE as T, ATTACK_ITEMS, weaponMode } from '../core/config';
import { FixedStepController } from '../core/fixed-step';
import { GameplayStateMachine, RunStateManager } from '../core/state';
import { InputAdapter, type Pad } from '../input/adapter';
import {PlayerController} from '../player/controller';
import {CharacterView} from '../assets/characters';
import {stepPhysics} from '../physics/step';
import {LEVEL,TUTORIAL_LEVEL,TUTORIAL_CLIP,validateLevel} from '../level/data';
import {TerrainSystem} from '../terrain/system';
import {CameraManager} from '../camera/manager';
import {GameplaySession} from '../core/session';
import {BadgeWorld} from '../badge/world';
import {RespawnManager} from '../respawn/manager';
import {EnemySystem} from '../enemy/system';
import {levelArt} from '../assets/level-art';
import level from '../level/data/level.json';
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
  goal!:Phaser.GameObjects.Rectangle;attackItem=ATTACK_ITEMS[0].src;shockUntil=0;
  menu=-1;lastMove=0;menuView!:Phaser.GameObjects.Text;menuMask!:Phaser.GameObjects.Rectangle;
  private frameTime=0;
  level=LEVEL;
  constructor() { super('Gameplay'); }
  create(data:{duration?:number;sessionId?:string;characterId?:string;attackItem?:string;photo?:string;tutorial?:boolean;flow?:GameplayStateMachine}={}) {
    const debug=new URLSearchParams(location.search).get('debug')==='1';
    this.frameTime=performance.now();this.shockUntil=0;
    this.level=data.tutorial?TUTORIAL_LEVEL:LEVEL;
    this.attackItem=ATTACK_ITEMS.find(i=>i.src===data.attackItem)?.src??ATTACK_ITEMS[0].src;
    this.session=new GameplaySession(data.duration??P.timeTier,data.sessionId??(sessionStorage.sessionId ??= crypto.randomUUID()),data.tutorial);this.run=this.session.run;
    this.flow=data.flow??new GameplayStateMachine();if(!data.flow)this.flow.enterGameplay();
    this.fixed=new FixedStepController(debug&&Number(new URLSearchParams(location.search).get('hz')) === 60 ? 60 : 24);
    this.physics.world.fixedStep=false;
    this.inputAdapter=new InputAdapter(P.deadzone); this.inputAdapter.attach();
    validateLevel(this.level);
    this.physics.world.setBounds(0,0,this.level.width,this.level.height,true,true,true,false);
    this.add.rectangle(this.level.width/2,this.level.height/2,this.level.width,this.level.height,0x05060a).setDepth(-100);
    this.player=this.add.rectangle(this.level.start.x,this.level.start.y,P.bodyWidth,P.bodyHeight,0x4ed8b5).setDepth(5);
    this.physics.add.existing(this.player); this.body=this.player.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true);
    this.controller=new PlayerController(this.body);
    this.presentation=new CharacterView(this,this.player,data.characterId??(document.querySelector('#character') as HTMLSelectElement)?.value??'a',debug,data.photo);
    this.clearInput();
    this.terrain=new TerrainSystem(this,this.level,this.player,()=>this.run.elapsed,()=>{this.controller.bounce();this.session.stats.bounces++;},()=>this.run.elapsed<this.controller.dropUntil,debug);
    this.cameraManager=new CameraManager(this.cameras.main,this.level);this.cameraManager.reset(this.player.x,this.body.bottom);
    if(data.tutorial)this.cameras.main.setViewport(290,140,620,240);
    this.respawner=new RespawnManager(this.terrain,this.level);
    this.badges=new BadgeWorld(this,this.session,this.player,this.terrain,this.level.badges);
    this.enemies=new EnemySystem(this,this.session,this.player,this.level,cause=>this.takeDamage(cause),()=>this.controller.bounce(P.jumpSpeed*P.stompBounce));
    this.pickups=this.level.powerups.map(p=>{
      const art=p.kind==='ally'?level.itemArt.ally:null,w=p.kind==='laptop'?2*T:T;
      const object=this.add.rectangle(p.x,p.y,w,T,p.kind==='ally'?0xb98cff:0x5ed5f1).setDepth(3).setAlpha(debug?.5:0);
      const image=this.add.image(p.x,p.y,art?'items/'+art.art:'items/攻擊道具/'+this.attackItem).setDepth(3);
      image.setDisplaySize((art?art.w:1.9)*T,(art?art.w:1.9)*T*image.height/image.width);
      return{...p,object,image};
    });
    const g=this.level.goal;this.goal=this.add.rectangle(g.x,g.y,g.width,g.height,0x82ec7b).setAlpha(debug?.4:0);
    levelArt(this,data.tutorial?TUTORIAL_CLIP:undefined);
    document.querySelector('#result')!.textContent='';
    this.hud=this.add.text(16,14,'',{fontSize:'16px',color:'#ffffff'}).setScrollFactor(0).setDepth(100);
    this.hud.setVisible(!this.registry.get('station'));
    this.menu=-1;this.lastMove=0;this.menuMask=this.add.rectangle(P.width/2,P.height/2,P.width,P.height,0x000000,.8).setScrollFactor(0).setDepth(200).setVisible(false);
    this.menuView=this.add.text(P.width/2,P.height/2,'',{fontSize:'28px',color:'#ffffff',align:'center'}).setOrigin(.5).setScrollFactor(0).setDepth(201);
    this.events.once('shutdown',()=>{ this.inputAdapter.dispose(); this.session.dispose(); });
    (window as any).__gameplay=this;
  }
  clearInput() { this.inputAdapter.clear(); this.pending={jump:false,dash:false,throw:false,down:false}; }
  togglePause() { if(this.run.phase==='paused') this.run.resume(); else this.run.pause(); this.fixed.reset(); this.clearInput(); }
  home() { this.run.pause(); this.clearInput(); this.flow.transition('P0'); this.scene.stop(); }
  // UX p14 Home menu: Restart only before the Result is settled. ponytail: confirm = Jump until B10 maps the arcade confirm button.
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
    const pad=this.testPad ?? Array.from(navigator.getGamepads?.() ?? []).find(p=>p?.connected);
    const a=this.inputAdapter.sample(pad);
    const station=this.registry.get('station');
    if(station?.input(a))return;
    const inMenu=this.updateMenu(a);this.lastMove=a.move;
    this.menuMask.setVisible(this.menu>=0);this.menuView.setText(this.menu<0?'':this.menuOptions().map((o,i)=>i===this.menu?`▶ ${o} ◀`:o).join('\n\n'));
    if(inMenu) return;
    if(a.pause) this.togglePause();
    if(this.run.phase==='running')for(const k of ['jump','dash','throw','down'] as const)this.pending[k] ||= a[k];
    if(this.run.phase==='running') this.fixed.update(delta/1000,(dt,elapsed)=>{
      if(this.run.phase!=='running')return;
      this.session.tick(elapsed,true);
      this.terrain.update(dt);
      if(this.shockUntil){ // planning: hazard shock 0.6 s, frozen, then back to the last safe ground
        this.pending={jump:false,dash:false,throw:false,down:false};
        if(this.run.elapsed>=this.shockUntil)this.respawn('pit');
        if(!this.session.result&&this.run.remaining===0){this.session.finish('time-up');this.finalize();}
        return;
      }
      this.controller.update({...a,...this.pending},this.run.elapsed,dt,this.session.power.ally?P.allySpeed:1);
      if(this.pending.throw&&this.session.power.throw(this.run.elapsed,weaponMode(this.attackItem).cooldown)){this.enemies.throwItem(this.attackItem,this.player.x,this.body.bottom,this.controller.facing);this.presentation.attack(this.run.elapsed);}
      this.pending={jump:false,dash:false,throw:false,down:false};
      this.enemies.update(dt);
      stepPhysics(this.physics.world,this.run.elapsed,dt,()=>this.terrain.resolveSlopes());
      this.badges.update(dt);
      const bounds=new Phaser.Geom.Rectangle(this.body.x,this.body.y,this.body.width,this.body.height);
      for(const p of this.pickups)if(p.object.active&&Phaser.Geom.Intersects.RectangleToRectangle(bounds,p.object.getBounds())){this.session.activate(p.kind,p.id);p.object.destroy();p.image.destroy();}
      this.respawner.track(this.player.x,this.player.y,this.body.width,this.body.height,this.body.blocked.down&&this.run.elapsed>=this.controller.dashUntil,this.enemies.dangerAt(this.player.x));
      if(this.player.y>this.level.pitY)this.respawn('pit');
      else if(this.terrain.hazardAt(this.body.left,this.body.top,this.body.right,this.body.bottom)){this.shockUntil=this.run.elapsed+P.shockTime;this.body.setVelocity(0);this.body.allowGravity=false;this.controller.state='HURT';}
      if(Phaser.Geom.Intersects.RectangleToRectangle(bounds,this.goal.getBounds())){this.session.finish('goal');this.finalize();}
      if(!this.session.result&&this.run.remaining===0){this.session.finish('time-up');this.finalize();}
      if(this.session.result)return;
      if(this.session.tutorial)this.cameras.main.setScroll(Math.max(0,this.player.x-200),Math.min(this.level.start.y-140,this.player.y-120));
      else this.cameraManager.update({x:this.player.x,top:this.body.top,bottom:this.body.bottom,vx:this.body.velocity.x,vy:this.body.velocity.y,grounded:this.body.blocked.down},dt,this.goalNear());
    });
    this.presentation.update(this.shockUntil?'HURT':this.controller.state,this.controller.facing,this.run.elapsed,this.session.power.ally);
    // Station mode hides the Phaser HUD; skip re-rasterising its text every frame.
    if(this.hud.visible)this.hud.setText(`TEST ONLY / ${this.fixed.hz}Hz\n${this.run.phase} · Timer ${this.run.remaining.toFixed(1)}\nBadge ${this.session.badges.held} · Score ${this.session.score.total} · Combo ${this.session.combo.count} ×${this.session.combo.multiplier}\nItem ${this.session.power.armed?weaponMode(this.attackItem).tag??'ON':'none'} · Ally ${this.session.power.ally?Math.ceil(this.session.power.allyUntil-this.run.elapsed):'-'}`);
  }
}
