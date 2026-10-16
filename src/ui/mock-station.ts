import type {GameplayResult} from '../core/session';
export type Identity={sessionId:string;nickname:string;assetState:'ready'|'generating'|'fallback'};
export type Ranking={runId:string;nickname:string;score:number;tier:string;titles:string[]};
export function titles(r:GameplayResult){
  const s=r.playerStatistics;
  return [r.endReason==='goal'&&!r.badgeDropOccurred?'零失誤大師':'',r.endReason==='goal'&&r.duration-r.remainingTime<=55?'極速跑者':'',s.maxCombo>=5?'連段高手':'',s.paralyses>=8?'閃電快手':'',s.stomps>=8?'踩擊達人':'',s.bounces>=4?'彈跳高手':'',r.heldBadgeCount>=50?'徽章收藏家':'','Future Gamer 超新星'].filter(Boolean);
}
// Local station simulation; attempts and gameplay state remain in RunStateManager.
export class MockStation {
  queue:Identity[]=[];replayEnabled=false;
  records:Ranking[]=[];wall=new Map<string,Ranking>();
  get current(){return this.queue[0];}
  enqueue(nickname='Demo Player'){this.queue.push({sessionId:crypto.randomUUID(),nickname,assetState:'fallback'});}
  exit(){this.queue.shift();}
  save(result:GameplayResult){
    if(!this.current||this.records.some(r=>r.runId===result.runId))return;
    const row={runId:result.runId,nickname:this.current.nickname,score:result.score,tier:result.timeTier,titles:titles(result)};
    this.records.push(row);this.wall.set(this.current.sessionId,row);
  }
  board(tier:number){return this.records.filter(r=>r.tier===String(tier)).sort((a,b)=>b.score-a.score);}
}
