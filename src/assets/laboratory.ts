import Phaser from 'phaser';
import type {GameplayScene} from '../scenes/gameplay';

// Editable temporary laboratory art. Every object here is presentation-only.
export function laboratory(scene:GameplayScene){
  for(let layer=0;layer<3;layer++){
    const key=`lab-layer-${layer}`;
    if(scene.textures.exists(key))continue;
    const g=scene.add.graphics();
    if(layer===0){
      g.fillStyle(0x080e20).fillRect(0,0,960,1100);
      for(let x=0;x<960;x+=160){
        g.fillStyle(0x101e33).fillRect(x+8,140,130,900);
        g.lineStyle(2,0x21354b).strokeRect(x+18,160,110,860);
        for(let y=180;y<980;y+=70){
          g.fillStyle(0x1a354b).fillRect(x+32,y,70,20);
          g.fillStyle(0x28536a).fillRect(x+32,y,5,20);
        }
      }
    }else if(layer===1){
      for(let x=80;x<960;x+=320){
        g.fillStyle(0x142035).fillRect(x,0,28,1100);
        g.fillStyle(0x29415b).fillRect(x+5,0,3,1100);
        g.lineStyle(14,0x101a2c).lineBetween(x+14,280,x+170,440).lineBetween(x+170,440,x+90,570);
        g.lineStyle(3,0x344b63).lineBetween(x+14,280,x+170,440).lineBetween(x+170,440,x+90,570);
        g.fillStyle(0x293a51).fillCircle(x+170,440,22);
        g.lineStyle(3,0x496178).strokeCircle(x+170,440,14);
        g.lineStyle(4,0x854052).lineBetween(x+25,302,x+145,425);
        g.lineStyle(6,0x344b63).lineBetween(x+90,570,x+65,600).lineBetween(x+90,570,x+115,600);
        for(let y=100;y<1100;y+=320){
          g.fillStyle(0x21344a).fillRect(x+25,y,200,7);
          g.fillStyle(0x2a5a75).fillRect(x+40,y+2,140,2);
        }
      }
    }else{
      for(let x=0;x<960;x+=480){
        g.fillStyle(0x121d2f).fillRect(x+8,0,36,1100);
        g.lineStyle(2,0x354359).strokeRect(x+8,0,36,1100);
        for(let y=90;y<1100;y+=270){
          g.fillStyle(0xc53250).fillRect(x+20,y,3,75);
          g.fillStyle(0x1c2d43).fillRect(x+50,y+130,200,80);
          g.lineStyle(1,0x36566e).strokeRect(x+58,y+138,184,64);
          g.fillStyle(0x24628a).fillRect(x+70,y+154,110,3);
          for(let j=0;j<4;j++)g.fillStyle(0x33465c).fillRect(x+70+j*35,y+170,25,16);
        }
      }
    }
    g.generateTexture(key,960,1100);g.destroy();
  }
  [.15,.35,.6].forEach((factor,i)=>scene.add.tileSprite(0,0,scene.level.width,1100,`lab-layer-${i}`).setOrigin(0).setScrollFactor(factor).setDepth(-30+i).setAlpha(i===0?1:.55));
  // Exact terrain geometry; moving trim follows its existing physics rectangle.
  const trims=scene.terrain.entries.map(({data,object})=>{
    object.setFillStyle(data.kind==='bounce'?0x4a254e:0x17273b);
    const g=scene.add.graphics().setDepth(1);
    g.lineStyle(2,data.kind==='bounce'?0xad54ff:data.kind==='moving'?0x35b6ff:0x6e9bb6);
    if(data.kind==='slope'){
      const rise=data.rise??data.height;
      g.lineBetween(-data.width/2,rise/2,data.width/2,-rise/2);
    }else{
      g.lineBetween(-data.width/2,-data.height/2,data.width/2,-data.height/2);
      g.lineStyle(1,0x32475d).strokeRect(-data.width/2,-data.height/2,data.width,data.height);
      for(let x=-data.width/2+8;x<data.width/2-8;x+=28){
        g.lineStyle(2,data.kind==='bounce'?0xffc75a:0x314962).lineBetween(x,Math.min(7,data.height/2-2),x+8,-Math.min(5,data.height/2-2));
      }
    }
    g.setPosition(object.x,object.y);return{g,object};
  });
  const dogs=scene.enemies.enemies.map(e=>({e,image:scene.add.image(e.object.x,e.object.y,'enemy-dog').setDisplaySize(56,56).setDepth(4)}));
  const powers=scene.pickups.map(p=>{
    const g=scene.add.graphics().setPosition(p.object.x,p.object.y).setDepth(4);
    const color=p.kind==='laptop'?0x35b6ff:0xad54ff;
    g.fillStyle(0x101a30).fillRoundedRect(-16,-15,32,26,3).lineStyle(2,color).strokeRoundedRect(-16,-15,32,26,3);
    if(p.kind==='laptop'){g.fillStyle(0x1d4f69).fillRect(-11,-10,22,14);g.lineStyle(3,0xa7c4dc).lineBetween(-20,15,20,15);}
    else{g.fillStyle(color).fillCircle(-9,-2,3).fillCircle(9,-2,3);g.lineStyle(2,0xffc75a).lineBetween(0,-7,0,6);}
    p.object.setAlpha(0);return{g,object:p.object};
  });
  scene.goal.setAlpha(0);
  const portal=scene.add.graphics().setPosition(scene.goal.x,scene.goal.y).setDepth(2);
  portal.fillStyle(0x35b6ff,.12).fillRect(-22,-60,44,120);
  portal.lineStyle(6,0x3b556e).strokeRect(-28,-65,56,130);
  portal.lineStyle(2,0x35b6ff).strokeRect(-22,-60,44,120);
  portal.lineStyle(4,0xff284b).lineBetween(-26,-62,26,-62);
  const update=()=>{
    for(const {g,object} of trims)g.setPosition(object.x,object.y);
    for(const {g,object} of powers)g.setVisible(object.active);
    for(const {e,image} of dogs){
      e.visual.setVisible(false);e.label.setVisible(false);
      image.setVisible(!e.defeated).setPosition(e.object.x,e.object.y+2).setFlipX((e.object.body as Phaser.Physics.Arcade.Body).velocity.x>0);
      image.setAlpha(scene.run.elapsed<e.stunnedUntil ? .5 : 1);
    }
  };
  scene.events.on('postupdate',update);
  scene.events.once('shutdown',()=>scene.events.off('postupdate',update));
  update();
}
