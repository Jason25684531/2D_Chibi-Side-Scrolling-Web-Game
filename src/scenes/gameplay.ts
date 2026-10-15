import Phaser from 'phaser';
import { TEST_PROFILE as P } from '../core/config';
import { FixedStepController } from '../core/fixed-step';
import { GameplayStateMachine, RunStateManager } from '../core/state';
import { InputAdapter, type Pad } from '../input/adapter';
import {PlayerController} from '../player/controller';
import {CharacterView} from '../assets/characters';
import {stepPhysics} from '../physics/step';
import {LEVEL,validateLevel} from '../level/data';
import {TerrainSystem} from '../terrain/system';
import {CameraManager} from '../camera/manager';
import {GameplaySession} from '../core/session';
import {BadgeWorld} from '../badge/world';
import {RespawnManager} from '../respawn/manager';
import {EnemySystem} from '../enemy/system';
export class GameplayScene extends Phaser.Scene {
  run!: RunStateManager;
  flow = new GameplayStateMachine();
  inputAdapter!: InputAdapter;
  fixed!: FixedStepController;
  player!: Phaser.GameObjects.Rectangle;
  body!: Phaser.Physics.Arcade.Body;
  hud!: Phaser.GameObjects.Text;
  testPad: Pad | null = null;
  controller!:PlayerController;
  presentation!:CharacterView;
  pending={jump:false,dash:false,throw:false};
  terrain!:TerrainSystem; cameraManager!:CameraManager;
  session!:GameplaySession;badges!:BadgeWorld;respawner!:RespawnManager;enemies!:EnemySystem;
  pickups:{id:string;kind:'laptop'|'ally';object:Phaser.GameObjects.Rectangle}[]=[];
  goal!:Phaser.GameObjects.Rectangle;powerVersion=0;sizeScale=1;sizeBlocked=false;
  constructor() { super('Gameplay'); }
  create() {
    const duration=Number((document.querySelector('#tier') as HTMLSelectElement).value);
    this.session=new GameplaySession(duration,sessionStorage.sessionId ??= crypto.randomUUID());this.run=this.session.run;
    this.flow=new GameplayStateMachine(); this.flow.enterGameplay();
    this.fixed=new FixedStepController(Number(new URLSearchParams(location.search).get('hz')) === 60 ? 60 : 24);
    this.physics.world.fixedStep=false;
    this.inputAdapter=new InputAdapter(P.deadzone); this.inputAdapter.attach();
    validateLevel(LEVEL);
    this.physics.world.setBounds(0,0,LEVEL.width,LEVEL.height,true,true,true,false);
    this.add.rectangle(LEVEL.width/2,LEVEL.height/2,LEVEL.width,LEVEL.height,0x253247);
    this.player=this.add.rectangle(LEVEL.start.x,LEVEL.start.y,P.bodyWidth,P.bodyHeight,0x4ed8b5).setDepth(5);
    this.physics.add.existing(this.player); this.body=this.player.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true);
    this.controller=new PlayerController(this.body);
    this.presentation=new CharacterView(this,this.player,(document.querySelector('#character') as HTMLSelectElement).value);
    this.pending={jump:false,dash:false,throw:false};
    this.terrain=new TerrainSystem(this,LEVEL,this.player,()=>this.run.elapsed,()=>this.controller.bounce());
    this.cameraManager=new CameraManager(this.cameras.main,LEVEL.width,LEVEL.height);this.cameraManager.reset(this.player.x,this.player.y);
    this.respawner=new RespawnManager(this.terrain,LEVEL);
    this.badges=new BadgeWorld(this,this.session,this.player,LEVEL.badges);
    this.enemies=new EnemySystem(this,this.session,this.player,LEVEL,this.terrain,cause=>this.takeDamage(cause));
    this.pickups=LEVEL.powerups.map(p=>{const object=this.add.rectangle(p.x,p.y,24,24,p.kind==='ally'?0xb98cff:0x5ed5f1).setDepth(3);this.add.text(p.x,p.y-30,p.kind,{fontSize:'11px'}).setOrigin(.5);return{...p,object};});
    this.goal=this.add.rectangle(LEVEL.goal.x,LEVEL.goal.y,45,120,0x82ec7b);this.add.text(LEVEL.goal.x,660,'GOAL',{fontSize:'22px'}).setOrigin(.5);
    this.powerVersion=this.session.power.version;this.sizeScale=1;this.sizeBlocked=false;
    document.querySelector('#result')!.textContent='';
    this.hud=this.add.text(16,14,'',{fontSize:'16px',color:'#ffffff'}).setScrollFactor(0).setDepth(100);
    this.events.once('shutdown',()=>{ this.inputAdapter.dispose(); this.session.dispose(); });
    (window as any).__gameplay=this;
  }
  togglePause() { if(this.run.phase==='paused') this.run.resume(); else this.run.pause(); this.fixed.reset(); this.inputAdapter.clear();this.pending={jump:false,dash:false,throw:false}; }
  home() { this.run.pause(); this.inputAdapter.clear(); this.flow.transition('P0'); this.scene.stop(); }
  takeDamage(cause:string){
    const hit=this.session.hit(cause);if(hit.kind==='immune')return;
    this.badges.scatter(hit.drops,this.player.x,this.player.y);
    if(hit.kind==='respawn')this.respawn(cause);
    else {this.controller.hurtUntil=this.run.elapsed+.25;this.body.setVelocity(-this.controller.facing*120,-150);}
  }
  respawn(cause:string){
    if(!this.session.respawn(cause))return;
    this.resizePlayer(1);const p=this.respawner.position(P.bodyWidth,P.bodyHeight);
    this.body.reset(p.x,p.y);this.controller.reset();this.inputAdapter.clear();this.pending={jump:false,dash:false,throw:false};
    this.enemies.reset();this.cameraManager.reset(p.x,p.y);this.session.recovered();
  }
  resizePlayer(scale:number){
    if(scale===this.sizeScale)return;const bottom=this.body.bottom;
    this.player.setScale(scale);this.body.updateFromGameObject();this.body.reset(this.player.x,bottom-this.body.height/2);this.sizeScale=scale;
  }
  syncPower(){
    if(this.powerVersion!==this.session.power.version){this.enemies.clearShots('player');this.powerVersion=this.session.power.version;}
    const scale=this.session.power.kind==='ally'?P.allyScale:1;
    this.sizeBlocked=scale>1&&!this.terrain.clear(this.player.x,this.body.bottom-P.bodyHeight*scale/2,P.bodyWidth*scale,P.bodyHeight*scale);
    this.resizePlayer(this.sizeBlocked?1:scale);
  }
  finalize(){
    if(!this.session.result)return;
    this.body.setVelocity(0);this.inputAdapter.clear();this.pending={jump:false,dash:false,throw:false};
    this.controller.state=this.session.result.endReason==='goal'?'WIN':'IDLE';
    this.session.power.clear();this.syncPower();this.enemies.clearShots();
    if(this.flow.flow==='P4'){this.flow.transition('P5');this.flow.transition('P6');}
    document.querySelector('#result')!.textContent=JSON.stringify(this.session.result,null,2);
  }
  update(_time: number,delta: number) {
    const pad=this.testPad ?? Array.from(navigator.getGamepads?.() ?? []).find(p=>p?.connected);
    const a=this.inputAdapter.sample(pad);
    if(a.home) { this.home(); return; }
    if(a.pause) this.togglePause();
    if(this.run.phase==='running')for(const k of ['jump','dash','throw'] as const)this.pending[k] ||= a[k];
    if(this.run.phase==='running') this.fixed.update(delta/1000,dt=>{
      if(this.run.phase!=='running')return;
      this.session.tick(dt);if(this.session.result){this.finalize();return;}
      this.syncPower();this.controller.update({...a,...this.pending},this.run.elapsed,dt);
      if(this.pending.throw&&this.session.power.throw(this.run.elapsed))this.enemies.shoot(this.player.x,this.player.y,this.controller.facing,'player');
      this.pending={jump:false,dash:false,throw:false};
      this.terrain.update(this.run.elapsed,dt);
      this.enemies.update(dt);
      stepPhysics(this.physics.world,this.run.elapsed,dt);
      this.badges.update(dt);
      const bounds=new Phaser.Geom.Rectangle(this.body.x,this.body.y,this.body.width,this.body.height);
      for(const p of this.pickups)if(p.object.active&&Phaser.Geom.Intersects.RectangleToRectangle(bounds,p.object.getBounds())){this.session.activate(p.kind,p.id);p.object.destroy();}
      this.respawner.track(this.player.x,this.player.y,this.body.width,this.body.height,this.body.blocked.down&&this.run.elapsed>=this.controller.dashUntil,this.enemies.dangerAt(this.player.x));
      if(this.player.y>1000)this.respawn('pit');
      if(Phaser.Geom.Intersects.RectangleToRectangle(bounds,this.goal.getBounds())){this.session.finish('goal');this.finalize();}
      this.cameraManager.update(this.player.x,this.player.y,dt);
    });
    this.presentation.update(this.controller.state,this.controller.facing,this.sizeScale);
    this.hud.setText(`TEST ONLY / ${this.fixed.hz}Hz\n${this.run.phase} · Timer ${this.run.remaining.toFixed(1)}\nBadge ${this.session.badges.held} · Score ${this.session.score.total} · Combo ${this.session.combo.count} ×${this.session.combo.multiplier}\nPower ${this.session.power.kind??'none'}${this.sizeBlocked?' (size blocked)':''}`);
  }
}
