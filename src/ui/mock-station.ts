import type {GameplayResult} from '../core/session';
export type Identity={sessionId:string;nickname:string;characterId?:string;assetState:'ready'|'generating'|'fallback'};
export type Ranking={runId:string;nickname:string;score:number;tier:string;titles:string[];characterId?:string;completedAt?:string};
export const RECORDS_KEY='rog-future-gamer.records.v1';
export function validRanking(value:unknown):value is Ranking{
  if(!value||typeof value!=='object')return false;
  const r=value as Ranking;
  return typeof r.runId==='string'&&r.runId.length>0&&r.runId.length<=128
    &&typeof r.nickname==='string'&&r.nickname.trim().length>0&&r.nickname.length<=24
    &&Number.isFinite(r.score)&&r.score>=0&&['60','90','120'].includes(r.tier)
    &&Array.isArray(r.titles)&&r.titles.length<=8&&r.titles.every(t=>typeof t==='string'&&t.length<=80)
    &&(r.characterId===undefined||['aria','kael','riven'].includes(r.characterId))
    &&(r.completedAt===undefined||(typeof r.completedAt==='string'&&Number.isFinite(Date.parse(r.completedAt))));
}
export function titles(r:GameplayResult){
  const s=r.playerStatistics;
  return [r.endReason==='goal'&&!r.badgeDropOccurred?'零失誤大師':'',r.endReason==='goal'&&r.duration-r.remainingTime<=55?'極速跑者':'',s.maxCombo>=5?'連段高手':'',s.paralyses>=8?'閃電快手':'',s.stomps>=8?'踩擊達人':'',s.bounces>=4?'彈跳高手':'',r.heldBadgeCount>=50?'徽章收藏家':'','Future Gamer 超新星'].filter(Boolean);
}
// Queue simulation only. Rankings are real local completed runs, not fixtures.
export class MockStation {
  queue:Identity[]=[];replayEnabled=false;
  records:Ranking[]=[];wall=new Map<string,Ranking>();
  storageStatus:'loading'|'ready'|'error'='loading';storageError='';private writable=false;
  constructor(){this.load();}
  load(){
    this.storageStatus='loading';
    if(typeof window==='undefined'){this.storageStatus='ready';return;}
    try{
      const raw=localStorage.getItem(RECORDS_KEY);
      const data=raw?JSON.parse(raw):{schemaVersion:1,records:[]};
      if(data.schemaVersion!==1||!Array.isArray(data.records)||!data.records.every(validRanking))throw new Error('Invalid records');
      this.records=[...new Map<string,Ranking>([...data.records,...this.records].map((r:Ranking)=>[r.runId,r] as const)).values()];
      this.storageStatus='ready';this.storageError='';this.writable=true;
    }catch{this.storageStatus='error';this.storageError='無法讀取本機紀錄，原資料保留；可重新讀取。';this.writable=false;}
  }
  persist(){
    if(typeof window==='undefined')return;
    if(!this.writable)return;
    try{
      localStorage.setItem(RECORDS_KEY,JSON.stringify({schemaVersion:1,records:this.records}));
      this.storageStatus='ready';this.storageError='';
    }catch{this.storageStatus='error';this.storageError='本場成績尚未保存，請釋出儲存空間後重試。';}
  }
  retryStorage(){this.load();if(this.storageStatus==='ready')this.persist();}
  get current(){return this.queue[0];}
  enqueue(nickname='Demo Player'){this.queue.push({sessionId:crypto.randomUUID(),nickname,characterId:'aria',assetState:'fallback'});}
  exit(){this.queue.shift();}
  save(result:GameplayResult){
    if(!this.current||this.records.some(r=>r.runId===result.runId))return;
    const row={runId:result.runId,nickname:this.current.nickname.trim().slice(0,24)||'Future Gamer',score:result.score,tier:result.timeTier,titles:titles(result),characterId:this.current.characterId??'aria',completedAt:new Date().toISOString()};
    this.records.push(row);this.wall.set(this.current.sessionId,row);this.persist();
  }
  board(tier:number){return this.records.filter(r=>r.tier===String(tier)).sort((a,b)=>b.score-a.score);}
}
