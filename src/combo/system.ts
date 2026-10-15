import {TEST_PROFILE as P} from '../core/config';
export class ComboSystem {
  count=0;expires=0;
  get multiplier(){return P.comboTiers[Math.min(Math.max(0,this.count-1),P.comboTiers.length-1)];}
  kill(now:number){this.update(now);this.count++;this.expires=now+4;}
  reset(){this.count=0;this.expires=0;}
  update(now:number){if(this.count&&now>=this.expires)this.reset();}
}
