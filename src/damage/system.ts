import type {BadgeSystem} from '../badge/system';
import type {PowerUpSystem} from '../powerup/system';
export class DamageSystem {
  immuneUntil=0;
  immune(now:number,power:PowerUpSystem){return now<this.immuneUntil||power.kind==='ally';}
  take(now:number,badges:BadgeSystem,power:PowerUpSystem):'immune'|'scatter'|'respawn' {
    if(this.immune(now,power))return 'immune';
    if(!badges.held)return 'respawn';
    this.immuneUntil=now+1.5;return 'scatter';
  }
}
