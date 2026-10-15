import Phaser from 'phaser';
import manifest from '../../assets/character-manifest.json';
export const characters=manifest.characters;
export function preloadCharacters(scene:Phaser.Scene) {
  if(new URLSearchParams(location.search).get('art')!=='1')return;
  for(const c of characters)scene.load.spritesheet(c.id,c.atlas.plannedBrowserUrl,{frameWidth:256,frameHeight:256});
}
export class CharacterView {
  label:Phaser.GameObjects.Text; sprite?:Phaser.GameObjects.Sprite;
  private character:typeof characters[number];
  constructor(scene:Phaser.Scene,private box:Phaser.GameObjects.Rectangle,id:string) {
    this.character=characters.find(c=>c.id===id)??characters[0];
    this.label=scene.add.text(0,0,'',{fontSize:'12px',color:'#ffffff'}).setOrigin(.5,1).setDepth(10);
    if(scene.textures.exists(this.character.id)) {
      this.sprite=scene.add.sprite(box.x,box.y,this.character.id).setOrigin(.5,1).setScale(.32);
      for(const [action,anim] of Object.entries(this.character.animations)) {
        const key=`${id}-${action}`;
        if(!scene.anims.exists(key))scene.anims.create({key,frames:anim.frames.map(f=>({key:id,frame:(f.y/256)*6+f.x/256})),frameRate:this.character.sourceFps,repeat:anim.loop?-1:0});
      }
    }
  }
  update(state:string,facing:number,scale:number) {
    this.label.setPosition(this.box.x,this.box.y-this.box.displayHeight/2-7).setText(`${this.character.id} · ${state}`);
    const action=this.character.stateBindings[state as keyof typeof this.character.stateBindings];
    this.box.setVisible(!this.sprite||!action);
    if(this.sprite) {
      this.sprite.setVisible(!!action).setPosition(this.box.x,this.box.y+this.box.displayHeight/2).setScale(.32*scale).setFlipX(facing<0);
      if(action)this.sprite.play(`${this.character.id}-${action}`,true);
    }
  }
}
