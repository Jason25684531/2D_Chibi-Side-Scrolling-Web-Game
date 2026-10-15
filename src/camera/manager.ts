import type Phaser from 'phaser';
import {TEST_PROFILE as P} from '../core/config';
const RETURN=.3;
export class CameraManager {
  readonly baseline=300; private returnFrom=300;private returnElapsed=RETURN;private lastY=0;
  constructor(readonly camera:Phaser.Cameras.Scene2D.Camera,width:number,height:number){camera.setBounds(0,0,width,height);}
  reset(x:number,y:number) {this.camera.setScroll(Math.max(0,Math.min(this.camera.getBounds().width-P.width,x-P.width/3)),this.baseline);this.lastY=y;this.returnElapsed=RETURN;}
  update(x:number,y:number,dt:number) {
    const c=this.camera;
    c.scrollX=Math.max(0,Math.min(c.getBounds().width-P.width,x-P.width/3));
    const target=Math.max(this.baseline-3*P.H,Math.min(this.baseline,y-P.height/3));
    if(y<this.lastY&&target<c.scrollY){c.scrollY=target;this.returnElapsed=0;this.returnFrom=target;}
    else if(this.returnElapsed<RETURN){this.returnElapsed=Math.min(RETURN,this.returnElapsed+dt);const t=this.returnElapsed/RETURN;c.scrollY=this.returnFrom+(this.baseline-this.returnFrom)*(1-(1-t)**3);}
    this.lastY=y;
  }
}
