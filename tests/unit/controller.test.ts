import {it,expect} from 'vitest';
import {PlayerController} from '../../src/player/controller';
import {TEST_PROFILE as P} from '../../src/core/config';
const fakeBody=()=>{const b:any={blocked:{down:true},touching:{down:false},velocity:{x:0,y:0},allowGravity:true,
  setMaxVelocity(){},setVelocityX(x:number){b.velocity.x=x;},setVelocityY(y:number){b.velocity.y=y;},setVelocity(x:number,y=x){b.velocity.x=x;b.velocity.y=y;}};return b;};
const idle={move:0,jumpHeld:false,jump:false,down:false,dash:false,throw:false,pause:false,home:false,confirm:false,back:false};
it('walking off a ledge after coyote time leaves only the double jump, and dash direction locks at start',()=>{
  const b=fakeBody(),c=new PlayerController(b);c.update(idle,0,1/24);
  b.blocked.down=false;b.velocity.y=10;c.update(idle,.15,1/24);
  c.update({...idle,jump:true,jumpHeld:true},.2,1/24);expect(c.jumps).toBe(2);expect(b.velocity.y).toBeCloseTo(-P.doubleJumpSpeed);
  b.velocity.y=10;c.update({...idle,jump:true,jumpHeld:true},.3,1/24);expect(b.velocity.y).toBe(10);
  c.update({...idle,move:1,dash:true},1,1/24);c.update({...idle,move:-1},1.05,1/24);expect(b.velocity.x).toBe(P.dashSpeed);
});
it('coyote time (0.1 s) still allows the ground jump, followed by a double jump',()=>{
  const b=fakeBody(),c=new PlayerController(b);c.update(idle,0,1/24);
  b.blocked.down=false;b.velocity.y=10;c.update({...idle,jump:true,jumpHeld:true},.08,1/24);
  expect(c.jumps).toBe(1);expect(b.velocity.y).toBeCloseTo(-P.jumpSpeed);
  c.update({...idle,jump:true,jumpHeld:true},.12,1/24);expect(c.jumps).toBe(2);
});
it('releasing jump multiplies rising speed by 0.45 once; falling speed is capped at terminal',()=>{
  const b=fakeBody(),c=new PlayerController(b);c.update({...idle,jump:true,jumpHeld:true},0,1/24);
  b.blocked.down=false;c.update(idle,.04,1/24);expect(b.velocity.y).toBeCloseTo(-P.jumpSpeed*P.jumpCut);
  c.update(idle,.08,1/24);expect(b.velocity.y).toBeCloseTo(-P.jumpSpeed*P.jumpCut);
  b.velocity.y=2000;c.update(idle,.5,1/24);expect(b.velocity.y).toBe(P.terminalSpeed);
});
it('down on the ground requests a 0.3 s drop-through window',()=>{
  const b=fakeBody(),c=new PlayerController(b);c.update({...idle,down:true},1,1/24);expect(c.dropUntil).toBeCloseTo(1.3);
});
