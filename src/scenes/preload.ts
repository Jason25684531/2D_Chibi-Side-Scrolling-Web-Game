import Phaser from 'phaser';
import assets from '../level/data/assets.json';
import {loadSfx} from '../audio/sfx';
export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }
  // Keys are package paths relative to game/; images were downscaled at staging (<=128 px per cell).
  preload() {
    this.load.on('progress',(value:number)=>this.registry.set('loadProgress',value));this.load.on('loaderror',(file:Phaser.Loader.File)=>{this.registry.set('loadError',true);console.warn('[preload] failed',file.key);});
    for(const [key,a] of Object.entries(assets as Record<string,{url:string}>))this.load.image(key,a.url);
    loadSfx(this);
  }
  // A failed file must not lock the kiosk: level-art and Phaser's __MISSING texture stand in (spec: missing art never stops the game).
  create() {this.registry.set('assetsReady',true);if(new URLSearchParams(location.search).get('debug')==='1')this.scene.start('Gameplay');}
}
