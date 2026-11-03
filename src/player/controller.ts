import type Phaser from 'phaser';
import type {Actions} from '../input/adapter';
import {TEST_PROFILE as P} from '../core/config';
export type PlayerState='IDLE'|'RUN'|'JUMP'|'DOUBLE_JUMP'|'DASH'|'HURT'|'FALL'|'WIN';
// Planning v0.3 §3.1 controller: coyote time, jump cut x0.45, separate double-jump speed, terminal fall speed, ↓ drop-through.
export class PlayerController {
  state:PlayerState='IDLE'; facing=1; jumps=0; dashUntil=0; dashReady=0; hurtUntil=0; coyoteUntil=0; dropUntil=0; private cut=true;
  constructor(readonly body:Phaser.Physics.Arcade.Body) {body.setMaxVelocity(Math.max(P.dashSpeed,P.speed*P.allySpeed),P.bounceSpeed);}
  update(a:Actions,now:number,dt:number,speedScale=1) {
    const b=this.body,grounded=b.blocked.down||b.touching.down;
    if(grounded && b.velocity.y>=0) {this.jumps=0;this.cut=true;this.coyoteUntil=now+P.coyoteTime;}
    if(a.move && now>=this.dashUntil) this.facing=a.move; // dash direction locks at start
    if(now<this.hurtUntil){this.state='HURT';b.allowGravity=true;return;}
    if(a.dash && now>=this.dashReady) {this.dashUntil=now+P.dashDuration;this.dashReady=now+P.dashCooldown;}
    if(now<this.dashUntil) {this.state='DASH';b.allowGravity=false;b.setVelocity(this.facing*P.dashSpeed,0);return;}
    b.allowGravity=true;
    const target=a.move*P.speed*speedScale, amount=(grounded?P.groundAcceleration:P.airAcceleration)*dt;
    b.setVelocityX(b.velocity.x+Math.max(-amount,Math.min(amount,target-b.velocity.x)));
    if(a.down && grounded){this.dropUntil=now+.3;b.setVelocityY(Math.max(b.velocity.y,130));}
    if(a.jump){
      if(this.jumps===0&&now<this.coyoteUntil){this.jumps=1;this.cut=false;this.coyoteUntil=0;b.setVelocityY(-P.jumpSpeed);}
      else if(this.jumps<2){this.jumps=2;this.cut=false;b.setVelocityY(-P.doubleJumpSpeed);} // off a ledge: only the double jump remains
    }
    if(!a.jumpHeld && !this.cut && b.velocity.y<0) {b.setVelocityY(b.velocity.y*P.jumpCut);this.cut=true;}
    if(b.velocity.y>P.terminalSpeed)b.setVelocityY(P.terminalSpeed);
    this.state=b.velocity.y<0?(this.jumps===2?'DOUBLE_JUMP':'JUMP'):!grounded?'FALL':Math.abs(b.velocity.x)>1?'RUN':'IDLE';
  }
  bounce(speed=P.bounceSpeed) {this.jumps=1;this.cut=true;this.coyoteUntil=0;this.body.setVelocityY(-speed);}
  reset() {this.jumps=0;this.cut=true;this.coyoteUntil=0;this.dropUntil=0;this.dashUntil=0;this.dashReady=0;this.hurtUntil=0;this.state='IDLE';this.body.allowGravity=true;this.body.setVelocity(0);}
}
