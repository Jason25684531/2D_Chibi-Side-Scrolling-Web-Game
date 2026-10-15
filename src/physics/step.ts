import type Phaser from 'phaser';
// Keep the selected logic rate; subdivide collision travel so thin walls cannot be skipped.
export function stepPhysics(world:Phaser.Physics.Arcade.World,time:number,dt:number) {
  let speed=0;
  for(const body of world.bodies.entries) if(body.enable)speed=Math.max(speed,Math.abs(body.velocity.x),Math.abs(body.velocity.y)+Math.abs(world.gravity.y)*dt);
  const steps=Math.max(1,Math.ceil(speed*dt/8));
  for(let i=0;i<steps;i++) {world.update(time*1000,dt*1000/steps);world.postUpdate();}
  return steps;
}
