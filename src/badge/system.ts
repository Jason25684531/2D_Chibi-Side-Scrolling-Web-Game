import {TEST_PROFILE as P} from '../core/config';
export class BadgeSystem {
  held=0; dropped=false; private serial=0;
  readonly collected=new Set<string>();
  readonly scattered=new Map<string,{expires:number;available:number}>();
  pickup(id:string,now:number) {
    const drop=this.scattered.get(id);
    if(this.collected.has(id)||(id.startsWith('drop-')&&!drop)||(drop&&(now<drop.available||now>=drop.expires)))return false;
    this.collected.add(id);this.scattered.delete(id);this.held++;return true;
  }
  scatter(now:number) {
    const count=Math.min(this.held,P.scatterCap);this.held-=count;if(count)this.dropped=true;
    const ids=Array.from({length:count},()=>`drop-${this.serial++}`);
    for(const id of ids)this.scattered.set(id,{expires:now+5,available:now+P.scatterPickupDelay});return ids;
  }
  update(now:number){for(const [id,drop] of this.scattered)if(now>=drop.expires)this.scattered.delete(id);}
}
