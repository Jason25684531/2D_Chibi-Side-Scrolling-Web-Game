import {it,expect} from 'vitest';
import {PlayerController} from '../../src/player/controller';
const fakeBody=()=>{const b:any={blocked:{down:true},touching:{down:false},velocity:{x:0,y:0},allowGravity:true,
  setMaxVelocity(){},setVelocityX(x:number){b.velocity.x=x;},setVelocityY(y:number){b.velocity.y=y;},setVelocity(x:number,y=x){b.velocity.x=x;b.velocity.y=y;}};return b;};
const idle={move:0,jumpHeld:false,jump:false,dash:false,throw:false,pause:false,home:false};
it('walking off a ledge leaves only the double jump, and dash direction locks at start',()=>{
  const b=fakeBody(),c=new PlayerController(b);c.update(idle,0,1/24);
  b.blocked.down=false;b.velocity.y=10;c.update(idle,.1,1/24);
  c.update({...idle,jump:true,jumpHeld:true},.2,1/24);expect(c.jumps).toBe(2);
  b.velocity.y=10;c.update({...idle,jump:true,jumpHeld:true},.3,1/24);expect(b.velocity.y).toBe(10);
  c.update({...idle,move:1,dash:true},1,1/24);c.update({...idle,move:-1},1.05,1/24);expect(b.velocity.x).toBeGreaterThan(0);
});
