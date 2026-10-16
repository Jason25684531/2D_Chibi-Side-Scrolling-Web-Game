import Phaser from 'phaser';
import {preloadCharacters} from '../assets/characters';
import badge from '../../assets/badge-manifest.json';
export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }
  preload() {preloadCharacters(this);this.load.on('progress',(value:number)=>this.registry.set('loadProgress',value));this.load.on('loaderror',()=>this.registry.set('loadError',true));this.load.image('badge',badge.runtimeUrl);}
  create() {this.registry.set('assetsReady',!this.registry.get('loadError'));if(new URLSearchParams(location.search).get('debug')==='1')this.scene.start('Gameplay');}
}
