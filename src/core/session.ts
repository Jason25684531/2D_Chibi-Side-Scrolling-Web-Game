import {RunStateManager} from './state';
import {GameplayEventBus,type EventKind} from './events';
import {BadgeSystem} from '../badge/system';
import {DamageSystem} from '../damage/system';
import {PowerUpSystem} from '../powerup/system';
import {ComboSystem} from '../combo/system';
import {ScoreEngine} from '../score/engine';
import type {EnemyKind,PowerKind} from '../level/data';
import {TEST_PROFILE as P} from './config';
export type GameplayResult=Readonly<{schemaVersion:1;sessionId:string;attemptId:string;runId:string;timeTier:string;duration:number;endReason:'goal'|'time-up';remainingTime:number;heldBadgeCount:number;score:number;scoreBreakdown:Readonly<ScoreEngine['breakdown']>;badgeDropOccurred:boolean;playerStatistics:Readonly<GameplaySession['stats']>;rulesStatus:'test-only';unresolvedRuleIds:readonly string[]}>;
export class GameplaySession {
  run:RunStateManager;events:GameplayEventBus;
  badges=new BadgeSystem();damage=new DamageSystem();power=new PowerUpSystem();combo=new ComboSystem();score:ScoreEngine;
  stats={kills:0,stomps:0,damage:0,respawns:0,pickups:0,maxCombo:0,paralyses:0,bounces:0};result:GameplayResult|null=null;private serial=0;
  readonly paralyzedIds=new Set<string>();
  constructor(duration:number,sessionId:string,readonly tutorial=false){this.run=new RunStateManager(duration,sessionId);this.run.start();this.events=new GameplayEventBus(this.run.runId);this.score=new ScoreEngine(this.run.scoredEnemyIds);}
  emit(kind:EventKind,entityId:string,cause:string){this.events.publish({kind,entityId,cause,runId:this.run.runId,eventId:`${this.run.runId}:${this.serial++}`,tick:this.run.tick});}
  private deadlineThisTick=false;
  tick(dt:number,deferTerminal=false){
    if(this.run.phase!=='running'&&this.run.phase!=='respawning')return;
    const hadTime=this.run.remaining>0;
    this.run.step(dt);const now=this.run.elapsed;this.badges.update(now);this.power.update(now);this.combo.update(now);
    if(this.tutorial){this.run.remaining=this.run.duration;return;}
    this.deadlineThisTick=hadTime&&this.run.remaining<=1e-8;
    if(this.run.remaining<=1e-8){this.run.remaining=0;if(!deferTerminal)this.finish('time-up');}
  }
  pickup(id:string){if(this.run.phase!=='running'||!this.badges.pickup(id,this.run.elapsed))return false;this.stats.pickups++;this.emit('BADGE_COLLECTED',id,'overlap');return true;}
  credit(id:string,kind:EnemyKind,ally=false){if(this.tutorial||this.run.phase!=='running'||!this.score.credit(id,kind,this.combo,this.run.elapsed,ally))return false;this.stats.kills++;if(!ally)this.stats.stomps++;this.stats.maxCombo=Math.max(this.stats.maxCombo,this.combo.count);this.emit('ENEMY_DEFEATED',id,'first-credit');return true;}
  paralyze(id:string){if(!this.tutorial&&!this.paralyzedIds.has(id)){this.paralyzedIds.add(id);this.stats.paralyses++;}}
  activate(kind:PowerKind,id:string){if(this.run.phase!=='running')return;this.power.activate(kind,this.run.elapsed);this.emit('POWERUP_ACTIVATED',id,kind);}
  hit(cause:string){
    if(this.run.phase!=='running')return {kind:'immune',drops:[] as string[]};
    const kind=this.damage.take(this.run.elapsed,this.badges,this.power);if(kind==='immune')return {kind,drops:[] as string[]};
    this.stats.damage++;if(this.power.kind==='laptop')this.power.clear(); // UX p9: Laptop ends when touched
    this.emit('PLAYER_DAMAGED','player',cause);
    const drops=kind==='scatter'?this.badges.scatter(this.run.elapsed):[];
    if(drops.length){this.combo.reset();this.emit('BADGE_SCATTERED','player',cause);}return {kind,drops};
  }
  respawn(cause:string){
    if(this.run.phase!=='running')return false;
    const drops=cause==='pit'?this.badges.scatter(this.run.elapsed):[];
    this.run.respawn();this.power.clear();this.combo.reset();this.damage.immuneUntil=drops.length?this.run.elapsed+1.5:0;this.stats.respawns++;
    if(cause==='pit')this.emit('PLAYER_FELL','player',cause);
    if(drops.length)this.emit('BADGE_SCATTERED','player',cause);
    return drops;
  }
  recovered(){this.run.recovered();this.emit('PLAYER_RESPAWNED','player','safe-point');}
  finish(reason:'goal'|'time-up'){
    if(this.tutorial)return null;
    if(this.result||(this.run.phase!=='running'&&this.run.phase!=='respawning'))return this.result;
    if(this.run.remaining<=1e-8&&!this.deadlineThisTick)reason='time-up';
    if(this.run.phase==='respawning')this.run.recovered();
    this.run.end(reason);this.score.settle(reason,this.run.remaining,this.badges.held,this.badges.dropped);
    this.result=Object.freeze({schemaVersion:1,sessionId:this.run.sessionId,attemptId:this.run.attemptId,runId:this.run.runId,timeTier:this.run.timeTier,duration:this.run.duration,endReason:reason,remainingTime:this.run.remaining,heldBadgeCount:this.badges.held,badgeDropOccurred:this.badges.dropped,score:this.score.total,scoreBreakdown:Object.freeze({...this.score.breakdown}),playerStatistics:Object.freeze({...this.stats}),rulesStatus:P.rulesStatus,unresolvedRuleIds:Object.freeze([...P.unresolvedRuleIds])});
    this.emit(reason==='goal'?'GOAL_REACHED':'TIME_UP','player',reason);this.run.finish();return this.result;
  }
  dispose(){this.events.dispose();this.power.clear();}
}
