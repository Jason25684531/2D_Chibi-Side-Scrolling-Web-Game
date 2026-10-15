import type Phaser from 'phaser';
import type {Actions} from '../input/adapter';
import {TEST_PROFILE as P} from '../core/config';
export type PlayerState='IDLE'|'RUN'|'JUMP'|'DOUBLE_JUMP'|'DASH'|'HURT'|'FALL'|'WIN';
export class PlayerController {
  state:PlayerState='IDLE'; facing=1; jumps=0; dashUntil=0; dashReady=0; hurtUntil=0; private jumpCuttable=false; private wasGrounded=false;
  constructor(readonly body:Phaser.Physics.Arcade.Body) {body.setMaxVelocity(P.dashSpeed,P.bounceSpeed);}
  update(a:Actions,now:number,dt:number) {
    const b=this.body,grounded=b.blocked.down||b.touching.down;
    if(grounded && b.velocity.y>=0) {this.jumps=0;this.jumpCuttable=false;}
    else if(this.wasGrounded && !this.jumps) this.jumps=1; // walking off a ledge spends the ground jump
    this.wasGrounded=grounded;
    if(a.move && now>=this.dashUntil) this.facing=a.move; // dash direction locks at start
    if(now<this.hurtUntil){this.state='HURT';b.allowGravity=true;return;}
    if(a.dash && now>=this.dashReady) {this.dashUntil=now+P.dashDuration;this.dashReady=now+P.dashCooldown;}
    if(now<this.dashUntil) {this.state='DASH';b.allowGravity=false;b.setVelocity(this.facing*P.dashSpeed,0);return;}
    b.allowGravity=true;
    const target=a.move*P.speed, amount=(a.move?P.acceleration:P.deceleration)*dt;
    b.setVelocityX(b.velocity.x+Math.max(-amount,Math.min(amount,target-b.velocity.x)));
    if(a.jump && this.jumps<2) {this.jumps++;this.jumpCuttable=true;b.setVelocityY(-P.jumpSpeed);}
    if(!a.jumpHeld && this.jumpCuttable) {if(b.velocity.y<-180)b.setVelocityY(-180);this.jumpCuttable=false;}
    this.state=b.velocity.y<0?(this.jumps===2?'DOUBLE_JUMP':'JUMP'):!grounded?'FALL':Math.abs(b.velocity.x)>1?'RUN':'IDLE';
  }
  bounce() {this.jumps=1;this.jumpCuttable=false;this.body.setVelocityY(-P.bounceSpeed);}
  reset() {this.jumps=0;this.jumpCuttable=false;this.wasGrounded=false;this.dashUntil=0;this.dashReady=0;this.hurtUntil=0;this.state='IDLE';this.body.allowGravity=true;this.body.setVelocity(0);}
}
