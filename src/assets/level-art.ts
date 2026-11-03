import level from '../level/data/level.json';
import {TILE as T} from '../core/config';
import type {GameplayScene} from '../scenes/gameplay';
const S=T/level.tile;
/** Presentation only: background, painted tiles and object art from the level JSON. Never touches bodies or score. */
export function levelArt(scene:GameplayScene,clip?:{cols:number;rows:number}){
  const bg=level.background;
  scene.add.image(bg.x*S,bg.y*S,bg.src).setOrigin(0).setDisplaySize(bg.w*S,bg.h*S).setScrollFactor(bg.parallax).setDepth(-50);
  scene.add.rectangle(0,0,scene.scale.width,scene.scale.height,0x000000,.35).setOrigin(0).setScrollFactor(0).setDepth(-49);
  const missing=new Set<string>();
  for(const a of level.art){
    if(clip&&(a.c>clip.cols||a.r>clip.rows))continue;
    const key='art/'+a.src;
    if(!scene.textures.exists(key)){missing.add(a.src);scene.add.rectangle(a.c*T,a.r*T,a.w*T,a.h*T,0x5f6878,.6).setOrigin(0).setDepth(-10);continue;}
    scene.add.image(a.c*T,a.r*T,key).setOrigin(0).setDisplaySize(a.w*T,a.h*T).setFlipX(a.flip).setDepth(-10);
  }
  if(missing.size)console.warn('[level-art] missing art',[...missing]);
  const sprung=level.springArt,moverArt=level.moverArt;
  const springs=scene.terrain.entries.filter(e=>e.data.kind==='bounce').map(e=>({e,image:scene.add.image(e.data.x,e.data.y+e.data.height/2,'art/'+sprung.normal).setOrigin(.5,1).setDepth(1)}));
  for(const s of springs)s.image.setDisplaySize(sprung.artW*T,sprung.artW*T*s.image.height/s.image.width);
  const movers=scene.terrain.entries.filter(e=>e.data.kind==='moving').map(e=>{const image=scene.add.image(0,0,'art/'+(e.data.art||moverArt.art)).setOrigin(0).setDepth(1);image.setDisplaySize(moverArt.artW*T,moverArt.artW*T*image.height/image.width);return{e,image};});
  const g=level.goalArt,goal=scene.add.image(scene.goal.x,scene.goal.y+scene.goal.height/2,'art/'+g.art).setOrigin(.5,1).setDepth(2);
  goal.setDisplaySize(g.startW*T,g.startW*T*goal.height/goal.width);
  const hints=scene.level.hints.map(h=>scene.add.triangle(h.x,h.y,-8,-5,8,-5,0,7,0xffd400).setDepth(3));
  const update=()=>{
    const now=scene.run.elapsed;
    for(const {e,image} of springs){const t=now-(e.bouncedAt??-9);image.setTexture('art/'+(t<.08?sprung.press:t<.25?sprung.bounce:sprung.normal));}
    for(const {e,image} of movers)image.setPosition(e.object.x-e.data.width/2,e.object.y-e.data.height/2+moverArt.artDy*T);
    for(const h of hints)h.setAlpha(.4+.6*Math.abs(Math.sin(now*4)));
  };
  scene.events.on('postupdate',update);
  scene.events.once('shutdown',()=>scene.events.off('postupdate',update));
  update();
}
