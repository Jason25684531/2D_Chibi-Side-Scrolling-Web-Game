import {TEST_PROFILE as P} from '../core/config';
import type {ComboSystem} from '../combo/system';
export class ScoreEngine {
  breakdown={enemy:0,goal:0,time:0,noDrop:0,badges:0};private settled=false;
  constructor(readonly ledger:Set<string>){}
  get total(){return Object.values(this.breakdown).reduce((a,b)=>a+b,0);}
  // Planning v0.3: every kill (stomp, thrown item or invincible contact) joins the Combo.
  credit(id:string,combo:ComboSystem,now:number){
    if(this.settled||this.ledger.has(id))return false;
    this.ledger.add(id);combo.kill(now);this.breakdown.enemy+=Math.round(P.enemyPoints*combo.multiplier);return true;
  }
  settle(reason:'goal'|'time-up',remaining:number,held:number,dropped:boolean){
    if(this.settled)return;this.settled=true;this.breakdown.badges=held*P.badgePoints;
    if(reason==='goal'){this.breakdown.goal=50;this.breakdown.time=Math.ceil(remaining-1e-9)*2;this.breakdown.noDrop=dropped?0:100;}
  }
}
