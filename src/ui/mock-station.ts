import type {GameplayResult} from '../core/session';
import {ATTACK_ITEMS} from '../core/config';
export type Identity={sessionId:string;nickname:string;characterId?:string;attackItem:string;photo?:string;assetState:'ready'|'generating'|'fallback'};
export type Ranking={runId:string;nickname:string;score:number;tier:string;titles:string[];characterId?:string;completedAt?:string};
export const RECORDS_KEY='rog-future-gamer.records.v1';
const SEQ_KEY='fg3-plyr-seq';
/** UC04-1 default nickname PLYR#### from a local sequence (planning v0.3). */
export function nextNickname(){let n=1;try{n=(Number(localStorage.getItem(SEQ_KEY))||0)+1;localStorage.setItem(SEQ_KEY,String(n));}catch{/* storage denied: keep 1 */}return 'PLYR'+String(n%10000).padStart(4,'0');}
export function validRanking(value:unknown):value is Ranking{
  if(!value||typeof value!=='object')return false;
  const r=value as Ranking;
  return typeof r.runId==='string'&&r.runId.length>0&&r.runId.length<=128
    &&typeof r.nickname==='string'&&r.nickname.trim().length>0&&r.nickname.length<=24
    &&Number.isFinite(r.score)&&r.score>=0&&['60','90','100','120'].includes(r.tier)
    &&Array.isArray(r.titles)&&r.titles.length<=8&&r.titles.every(t=>typeof t==='string'&&t.length<=80)
    &&(r.characterId===undefined||['a','b','aria','kael','riven'].includes(r.characterId))
    &&(r.completedAt===undefined||(typeof r.completedAt==='string'&&Number.isFinite(Date.parse(r.completedAt))));
}
// Planning v0.3 TITLES, rarest first. An empty list is shown as 「超新星」.
export function titles(r:GameplayResult){
  const s=r.playerStatistics,clear=r.endReason==='goal';
  return [clear&&!r.badgeDropOccurred?'零失誤大師':'',clear&&r.duration-r.remainingTime<=55?'極速跑者':'',s.maxCombo>=4?'連段高手':'',s.bolts>=3?'閃電快手':'',s.stomps>=5?'踩擊達人':'',s.bounces>=4?'彈跳高手':'',r.heldBadgeCount>=45?'徽章收藏家':''].filter(Boolean);
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
  enqueue(nickname=typeof window==='undefined'?'PLYR0001':nextNickname()){this.queue.push({sessionId:crypto.randomUUID(),nickname,characterId:'a',attackItem:ATTACK_ITEMS[0].src,assetState:'fallback'});}
  exit(){this.queue.shift();}
  save(result:GameplayResult){
    if(!this.current||this.records.some(r=>r.runId===result.runId))return;
    const row={runId:result.runId,nickname:this.current.nickname.trim().slice(0,24)||'Future Gamer',score:result.score,tier:result.timeTier,titles:titles(result),characterId:this.current.characterId??'a',completedAt:new Date().toISOString()};
    this.records.push(row);this.wall.set(this.current.sessionId,row);this.persist();
  }
  board(tier:number){return this.records.filter(r=>r.tier===String(tier)).sort((a,b)=>b.score-a.score);}
}
