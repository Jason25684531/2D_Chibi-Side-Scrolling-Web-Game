import Phaser from 'phaser';
import {preloadCharacters} from '../assets/characters';
export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }
  preload() {preloadCharacters(this);}
  create() { this.scene.start('Gameplay'); }
}
