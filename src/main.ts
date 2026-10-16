import Phaser from 'phaser';
import './style.css';
import { TEST_PROFILE as P } from './core/config';
import { PreloadScene } from './scenes/preload';
import { GameplayScene } from './scenes/gameplay';
import {StationUI} from './ui/station';
const game=new Phaser.Game({ type:Phaser.CANVAS, parent:'game', width:P.width, height:P.height, backgroundColor:'#253247',
  physics:{default:'arcade',arcade:{gravity:{x:0,y:P.gravity},customUpdate:true}},scene:[PreloadScene,GameplayScene] });
const scene=()=>game.scene.getScene('Gameplay') as GameplayScene;
const debug=new URLSearchParams(location.search).get('debug')==='1';
if(!debug)new StationUI(game);
// Fixed 90s tier, so Start/Restart and Replay are the same new-Run command.
const newRun=()=>game.scene.isActive('Gameplay')?scene().scene.restart():game.scene.start('Gameplay');
for(const id of ['#start','#replay'])document.querySelector(id)!.addEventListener('click',newRun);
document.querySelector('#pause')!.addEventListener('click',()=>{if(game.scene.isActive('Gameplay'))scene().togglePause();});
document.querySelector('#home')!.addEventListener('click',()=>{if(game.scene.isActive('Gameplay'))scene().home();});
window.addEventListener('blur',()=>{if(game.scene.isActive('Gameplay')&&scene().run?.phase==='running')scene().togglePause();});
(window as any).__game=game;
