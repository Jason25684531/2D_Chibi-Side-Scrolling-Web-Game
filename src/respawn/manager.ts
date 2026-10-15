import type {TerrainSystem} from '../terrain/system';
import type {LevelData} from '../level/data';
export class RespawnManager {
  safe:{x:number;y:number};
  constructor(readonly terrain:TerrainSystem,readonly level:LevelData){this.safe={...level.start};}
  track(x:number,y:number,width:number,height:number,grounded:boolean,danger:boolean){if(grounded&&!danger&&this.terrain.supports(x,y+height/2,width)&&this.terrain.clear(x,y,width,height))this.safe={x,y};}
  position(width:number,height:number){
    for(const point of [this.safe,this.level.start])if(this.terrain.supports(point.x,point.y+height/2,width)&&this.terrain.clear(point.x,point.y,width,height))return point;
    throw new Error('Level has no safe respawn position');
  }
}
