import Phaser from 'phaser';
import type {LevelData,EnemyKind} from '../level/data';
import type {GameplaySession} from '../core/session';
import type {TerrainSystem} from '../terrain/system';
import {TEST_PROFILE as P} from '../core/config';
export type Enemy={id:string;kind:EnemyKind;x:number;y:number;object:Phaser.GameObjects.Rectangle;defeated:boolean;stunnedUntil:number;attackReady:number};
export class EnemySystem {
  enemies:Enemy[]=[];
  shots:{object:Phaser.GameObjects.Rectangle;expires:number;owner:'player'|'enemy';colliders:Phaser.Physics.Arcade.Collider[]}[]=[];
  constructor(readonly scene:Phaser.Scene,readonly session:GameplaySession,readonly player:Phaser.GameObjects.Rectangle,level:LevelData,terrain:TerrainSystem,readonly hurt:(cause:string)=>void){
    for(const data of level.enemies){
      const object=scene.add.rectangle(data.x,data.y,34,44,data.kind==='drone'?0xe9a85a:data.kind==='ranged'?0xf29dba:0xe36f6b).setDepth(3);
      scene.physics.add.existing(object);const body=object.body as Phaser.Physics.Arcade.Body;body.setAllowGravity(data.kind!=='drone');
      for(const t of terrain.entries)if(t.data.kind==='ground')scene.physics.add.collider(object,t.object);
      const e={...data,object,defeated:false,stunnedUntil:0,attackReady:1};this.enemies.push(e);
      scene.physics.add.overlap(player,object,()=>{
        if(e.defeated||session.run.phase!=='running')return;
        const p=player.body as Phaser.Physics.Arcade.Body,b=object.body as Phaser.Physics.Arcade.Body;
        if(session.power.kind==='ally'||(p.velocity.y>0&&p.prev.y+p.height<=b.top+10)){this.defeat(e);p.setVelocityY(-260);}
        else if(session.run.elapsed>=e.stunnedUntil)hurt(e.id);
      });
    }
  }
  defeat(e:Enemy){if(e.defeated)return;e.defeated=true;e.object.setVisible(false);(e.object.body as Phaser.Physics.Arcade.Body).enable=false;this.session.credit(e.id,e.kind);}
  shoot(x:number,y:number,direction:number,owner:'player'|'enemy'){
    const object=this.scene.add.rectangle(x,y,14,8,owner==='player'?0x8ff7ff:0xff715c).setDepth(6);this.scene.physics.add.existing(object);
    const body=object.body as Phaser.Physics.Arcade.Body;body.setAllowGravity(false).setVelocityX(direction*(owner==='player'?500:230));
    const colliders:Phaser.Physics.Arcade.Collider[]=[];
    this.shots.push({object,expires:this.session.run.elapsed+1.5,owner,colliders});
    if(owner==='enemy')colliders.push(this.scene.physics.add.overlap(object,this.player,()=>{if(object.active){this.hurt('ranged-shot');object.destroy();}}));
    else for(const e of this.enemies)colliders.push(this.scene.physics.add.overlap(object,e.object,()=>{if(object.active&&!e.defeated){e.stunnedUntil=this.session.run.elapsed+P.paralysisDuration;object.destroy();}}));
  }
  update(dt:number){
    const now=this.session.run.elapsed;
    for(const e of this.enemies){
      if(e.defeated)continue;const b=e.object.body as Phaser.Physics.Arcade.Body;
      e.object.setFillStyle(now<e.stunnedUntil?0x8ff7ff:e.kind==='drone'?0xe9a85a:e.kind==='ranged'?0xf29dba:0xe36f6b);
      if(now<e.stunnedUntil){b.setVelocityX(0);if(e.kind==='drone')b.setVelocityY(0);continue;}
      if(e.kind==='melee')b.setVelocityX(e.object.x>e.x+45?-45:e.object.x<e.x-45?45:b.velocity.x||45);
      if(e.kind==='drone')b.setVelocity(40*Math.cos(now),(e.y+Math.sin(now*2)*28-e.object.y)/dt);
      if(e.kind==='ranged'&&now>=e.attackReady&&Math.abs(this.player.x-e.object.x)<420){e.attackReady=now+1.8;this.shoot(e.object.x,e.object.y,Math.sign(this.player.x-e.object.x)||1,'enemy');}
      if(e.object.y>1000)this.resetEnemy(e);
    }
    for(const shot of this.shots){if(shot.object.active&&now>=shot.expires)shot.object.destroy();if(!shot.object.active)for(const collider of shot.colliders)collider.destroy();}
    this.shots=this.shots.filter(s=>s.object.active);
  }
  clearShots(owner?:'player'|'enemy'){for(const shot of this.shots)if(!owner||shot.owner===owner){shot.object.destroy();for(const collider of shot.colliders)collider.destroy();}this.shots=this.shots.filter(s=>s.object.active);}
  resetEnemy(e:Enemy){e.defeated=false;e.stunnedUntil=0;e.attackReady=this.session.run.elapsed+1;e.object.setVisible(true);const b=e.object.body as Phaser.Physics.Arcade.Body;b.enable=true;b.reset(e.x,e.y);b.setVelocity(0);}
  reset(){this.clearShots();for(const e of this.enemies)this.resetEnemy(e);}
  dangerAt(x:number){return this.enemies.some(e=>!e.defeated&&Math.abs(e.object.x-x)<110);}
}
