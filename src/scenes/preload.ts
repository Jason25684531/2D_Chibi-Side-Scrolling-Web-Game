import Phaser from 'phaser';
import assets from '../level/data/assets.json';
export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }
  // Keys are package paths relative to game/; images were downscaled at staging (<=128 px per cell).
  preload() {
    this.load.on('progress',(value:number)=>this.registry.set('loadProgress',value));this.load.on('loaderror',()=>this.registry.set('loadError',true));
    for(const [key,a] of Object.entries(assets as Record<string,{url:string}>))this.load.image(key,a.url);
  }
  create() {this.registry.set('assetsReady',!this.registry.get('loadError'));if(new URLSearchParams(location.search).get('debug')==='1')this.scene.start('Gameplay');}
}
