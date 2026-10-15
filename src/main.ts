import Phaser from 'phaser';
import './style.css';
import { TEST_PROFILE as P } from './core/config';
import { PreloadScene } from './scenes/preload';
import { GameplayScene } from './scenes/gameplay';
const game=new Phaser.Game({ type:Phaser.AUTO, parent:'game', width:P.width, height:P.height, backgroundColor:'#253247',
  physics:{default:'arcade',arcade:{gravity:{x:0,y:P.gravity},customUpdate:true}},scene:[PreloadScene,GameplayScene] });
const scene=()=>game.scene.getScene('Gameplay') as GameplayScene;
document.querySelector('#start')!.addEventListener('click',()=>game.scene.isActive('Gameplay')?scene().scene.restart():game.scene.start('Gameplay'));
document.querySelector('#pause')!.addEventListener('click',()=>{if(game.scene.isActive('Gameplay'))scene().togglePause();});
document.querySelector('#replay')!.addEventListener('click',()=>{ const s=scene(); if(s.run)(document.querySelector('#tier') as HTMLSelectElement).value=s.run.timeTier; game.scene.isActive('Gameplay')?s.scene.restart():game.scene.start('Gameplay'); });
document.querySelector('#home')!.addEventListener('click',()=>{if(game.scene.isActive('Gameplay'))scene().home();});
window.addEventListener('blur',()=>{if(game.scene.isActive('Gameplay')&&scene().run?.phase==='running')scene().togglePause();});
(window as any).__game=game;
