import type {PowerKind} from '../level/data';
// Planning v0.3: the attack item (laptop) and invincibility (ally) are independent and may be held together.
export class PowerUpSystem {
  armed=false;allyAt=0;allyUntil=0;throwReady=0;
  get ally(){return this.allyUntil>0;}
  activate(kind:PowerKind,now:number){if(kind==='ally'){this.allyAt=now;this.allyUntil=now+10;}else this.armed=true;}
  disarm(){this.armed=false;}
  clear(){this.armed=false;this.allyUntil=0;this.throwReady=0;}
  update(now:number){if(this.allyUntil&&now>=this.allyUntil)this.allyUntil=0;}
  throw(now:number,cooldown:number){if(!this.armed||now<this.throwReady)return false;this.throwReady=now+cooldown;return true;}
}
