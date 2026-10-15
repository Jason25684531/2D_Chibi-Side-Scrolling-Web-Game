import type {PowerKind} from '../level/data';
import {TEST_PROFILE as P} from '../core/config';
export class PowerUpSystem {
  kind:PowerKind|null=null; expires=0;throwReady=0;version=0;
  activate(kind:PowerKind,now:number){this.clear();this.kind=kind;this.expires=kind==='ally'?now+10:Infinity;}
  clear(){this.kind=null;this.expires=0;this.throwReady=0;this.version++;}
  update(now:number){if(this.kind&&now>=this.expires)this.clear();}
  throw(now:number){if(this.kind!=='laptop'||now<this.throwReady)return false;this.throwReady=now+P.throwCooldown;return true;}
}
