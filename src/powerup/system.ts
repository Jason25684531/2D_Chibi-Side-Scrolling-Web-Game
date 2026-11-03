import type {PowerKind} from '../level/data';
// Planning v0.3: the attack item (laptop) and invincibility (ally) are independent and may be held together.
export class PowerUpSystem {
  armed=false;allyUntil=0;throwReady=0;version=0;
  get ally(){return this.allyUntil>0;}
  activate(kind:PowerKind,now:number){if(kind==='ally')this.allyUntil=now+10;else this.armed=true;this.version++;}
  disarm(){if(this.armed){this.armed=false;this.version++;}}
  clear(){this.armed=false;this.allyUntil=0;this.throwReady=0;this.version++;}
  update(now:number){if(this.allyUntil&&now>=this.allyUntil){this.allyUntil=0;this.version++;}}
  throw(now:number,cooldown:number){if(!this.armed||now<this.throwReady)return false;this.throwReady=now+cooldown;return true;}
}
