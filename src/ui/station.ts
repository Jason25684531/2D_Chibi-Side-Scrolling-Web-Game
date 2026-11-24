import Phaser from 'phaser';
import {GameplayStateMachine,type Flow} from '../core/state';
import {InputAdapter,type Actions,type Pad} from '../input/adapter';
import {activePad,profileFor,saveProfile,rebind,REBINDABLE} from '../input/gamepad';
import type {GameplayScene} from '../scenes/gameplay';
import type {GameplayResult} from '../core/session';
import {TEST_PROFILE as P,ATTACK_ITEMS} from '../core/config';
import {characterName,characterIds,pose} from '../assets/catalog';
import {addSheets,removeSheets} from '../assets/characters';
import {probe,generate,drop} from '../comfy/client';
import type {RoleCode} from '../comfy/skin';
import {MockStation,titles,savedTier,saveTier,type Identity} from './mock-station';
import {avatar,button,panel,escape,focus,focusY,text,time,chip,statRow,titleTag,rankRow} from './components';
import {readiness,readinessSteps,readyLabel,onPhoto,willSubmit,skinOf,genText} from './readiness';
import {openCamera,closeCamera,cameraError,capturePhoto} from './camera';
import './station.css';
import {hud,updateHud} from './hud';
import {sfx} from '../audio/sfx';
/** Buttons that go back a step play UI-03 (sheet: 返回上一頁／取消／重拍); every other button plays UI-02. */
const BACK=new Set(['prev','exit','close-ranking','records-back','retake']);
const ATTRACT_IDLE=60000;
// Temporary main visual (PO 2026-11-19) until the final key art lands.
const MAINVIS=new URL('./cyber-runner.webp',import.meta.url).href;
const HOME_HERO=new URL('./cyber-runner-hero.webp',import.meta.url).href;
// Controls panel (system menu → 按鍵設定). Names are the W3C standard positions, shown only for a standard-mapped pad.
const CONTROL_LABELS:Record<typeof REBINDABLE[number],string>={jump:'跳躍／選單確認',dash:'衝刺',throw:'投擲',confirm:'開始遊戲（訓練場）',back:'返回'};
const PAD_NAMES=['✕','○','□','△','L1','R1','L2','R2','SHARE','OPTIONS','L3','R3'];
// Never captured while binding: directions, OPTIONS, and the current back button (it cancels instead of silently swapping).
const FIXED=['home','pause','left','right','up','down','back'] as const;
const NAV='<span><kbd>← →</kbd>選擇</span><span><kbd>Z / ENTER</kbd>確認</span><span><kbd>BACKSPACE</kbd>返回</span><span><kbd>H</kbd>選單</span>';
const HINTS:Record<string,string>={P3:'<span><kbd>← →</kbd>移動</span><span><kbd>Z</kbd>跳躍</span><span><kbd>X</kbd>衝刺</span><span><kbd>C</kbd>投擲</span><span><kbd>ENTER</kbd>開始遊戲</span><span><kbd>H</kbd>選單</span>'};
// Text wordmark only; the slashes are decoration, not the ROG eye (DESIGN.md §8.5).
const BRAND='<div class="brand"><svg class="logo" viewBox="0 0 70 56" aria-hidden="true"><polygon points="4,8 30,8 22,48 0,48"/><polygon points="36,8 70,8 50,48 28,48" opacity=".55"/></svg><div class="wordmark">ROG<span>FUTURE GAMER</span></div>';
/** Rarest first; no title shows 「超新星」 (planning v0.3 §3.3). The badge CSS drops whatever does not fit. */
const titleLine=(r:GameplayResult)=>{const t=titles(r);return t.length?t:['超新星'];};

export class StationUI {
  flow=new GameplayStateMachine();adapter=new MockStation();inputAdapter=new InputAdapter();
  tier=typeof window==='undefined'?P.timeTier:savedTier();entered=performance.now();countdownAt=0;menu=false;testPad:Pad|null=null;
  root:HTMLElement;ui:HTMLElement;progress=new Set<string>();private previous=performance.now();
  result:GameplayResult|null=null;step=0;idleSince=performance.now();attract=false;
  boardOpen=false;rankPage=0;private returnFocus:string|undefined;
  /** P0 menu → records panel; armed = the delete/reset action waiting for its confirming second press. */
  admin=false;armed='';
  /** System menu → controls panel; binding = the action waiting for the next pad button. */
  private lastFocus:string|undefined;
  controls=false;binding:''|typeof REBINDABLE[number]='';private bindPrev:boolean[]|null=null;private bindAt=0;
  /** Live camera for the P1 photo step; render() opens and closes it. */
  private stream:Promise<MediaStream>|null=null;camError='';
  /** ComfyUI reachable with a staged workflow: probed at boot and on every P1 entry; undefined only before the first answer. */
  comfy:boolean|undefined;
  constructor(readonly game:Phaser.Game){
    document.body.classList.add('station');
    this.root=document.createElement('div');this.root.id='station-root';
    this.ui=document.createElement('div');this.ui.id='station-ui';
    document.body.append(this.root);this.root.append(document.querySelector('#game')!,this.ui);
    game.registry.set('station',this);this.inputAdapter.attach();
    this.ui.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(b&&!b.disabled){sfx(BACK.has(b.dataset.action!)?'UI-03':'UI-02');this.act(b.dataset.action!);}});
    this.ui.addEventListener('pointerdown',()=>this.wake());
    this.ui.addEventListener('input',event=>{const input=event.target as HTMLInputElement;if(input.id==='nickname'&&this.adapter.current)this.adapter.current.nickname=input.value;});
    this.ui.addEventListener('focusin',event=>{
      const action=(event.target as HTMLElement).dataset?.action;if(action)this.lastFocus=action;
      if(event.target instanceof HTMLInputElement)for(const a of [this.inputAdapter,this.scene.inputAdapter]){a?.codes.clear();a?.previous.clear();a?.clear();}
    });
    this.ui.addEventListener('keydown',event=>{
      if((event.target as HTMLElement).closest('.home-actions')&&['ArrowUp','ArrowDown'].includes(event.key)){
        event.preventDefault();event.stopPropagation();focus(this.ui,event.key==='ArrowDown'?1:-1);return;
      }
      if(event.key!=='Tab')return;
      const scope=this.ui.querySelector('.modal.screen')??this.ui;
      const nodes=Array.from(scope.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));
      if(!nodes.length)return;
      event.preventDefault();const i=nodes.indexOf(document.activeElement as HTMLElement);
      nodes[(i+(event.shiftKey?-1:1)+nodes.length)%nodes.length].focus();
    });
    const resize=()=>{this.root.style.transform=`translate(-50%,-50%) scale(${Math.min(innerWidth/1920,innerHeight/1080)})`;};resize();window.addEventListener('resize',resize);
    game.events.on('poststep',this.update,this);
    game.events.once('destroy',()=>{this.inputAdapter.dispose();window.removeEventListener('resize',resize);game.events.off('poststep',this.update,this);});
    this.render();this.checkComfy();(window as any).__station=this;
  }
  get scene(){return this.game.scene.getScene('Gameplay') as GameplayScene;}
  /** The pad feeding whichever adapter is live (the scene's during a run). */
  get pad(){return (this.game.scene.isActive('Gameplay')?this.scene.testPad:this.testPad)??activePad();}
  go(next:Flow){if(next==='P4')sfx('ANN-02');this.admin=false;this.armed='';this.controls=false;this.binding='';this.flow.transition(next);this.entered=this.idleSince=performance.now();this.countdownAt=0;this.boardOpen=false;this.rankPage=0;this.attract=false;if(next==='P1'){this.step=0;this.checkComfy();}this.render();}
  start(tutorial=false){
    this.inputAdapter.dispose();this.progress.clear();
    const c=this.adapter.current!,data={duration:this.tier,sessionId:c.sessionId,skin:skinOf(c),attackItem:c.attackItem,tutorial,flow:this.flow};
    if(this.game.scene.isActive('Gameplay'))this.scene.scene.restart(data);else this.game.scene.start('Gameplay',data);
  }
  stop(){if(this.game.scene.isActive('Gameplay'))this.game.scene.stop('Gameplay');this.inputAdapter.attach();}
  exit(finish=false){
    const player=this.adapter.current;
    if(player?.captureStarted&&!(finish&&this.flow.flow==='P7'))return;
    this.menu=false;this.stop();if(player)this.dropPhoto(player);this.adapter.exit();
    if(player?.captureStarted){
      if(!this.adapter.current)this.adapter.enqueue();
      this.go('P1');return;
    }
    this.go('P0');if(this.adapter.current)this.go('P1');
  }
  /** Any input on P0 resets the idle clock and closes the attract video. Returns true when it closed the video. */
  wake(){this.idleSince=performance.now();if(!this.attract)return false;this.attract=false;this.render();return true;}
  act(action:string){
    if(this.countdownAt&&this.flow.flow==='P7'&&!this.menu)return;
    if(action==='demo'&&this.flow.flow==='P0'){this.adapter.enqueue();this.go('P1');}
    if(action==='settings'&&this.flow.flow==='P0'){this.returnFocus='settings';this.menu=true;this.render();return;}
    const c=this.adapter.current;
    if(action.startsWith('character-')&&this.flow.flow==='P1'&&c){
      // The body is also the ComfyUI template: a job for the old one is useless, the photo is kept for the new one.
      const id=action.slice(10);if(!characterIds.includes(id as RoleCode))return;
      if(id!==c.characterId){this.dropGeneration(c);c.characterId=id as RoleCode;}
      this.render();focus(this.ui,0,action);return;
    }
    if(action==='shoot'&&this.flow.flow==='P1'&&c){
      const video=this.ui.querySelector<HTMLVideoElement>('video.live');if(!video?.videoWidth)return;
      void capturePhoto(video).then(url=>{
        if(this.adapter.current!==c||!onPhoto(c,this.step,this.comfy)||c.photo){URL.revokeObjectURL(url);return;} // a second press, or the player moved on
        c.photo=url;c.captureStarted=true;this.render();focus(this.ui,0,'ready');
      },error=>{this.camError=cameraError(error);this.render();});
      return;
    }
    if(action==='retake'&&this.flow.flow==='P1'&&c){this.dropPhoto(c);this.render();focus(this.ui,0,'shoot');return;}
    if(action==='prev'&&this.flow.flow==='P1'){this.camError='';if(this.step>0)this.setStep(this.step-1);else this.exit();return;}
    if(action.startsWith('key-')&&this.flow.flow==='P1'&&c){
      const k=action.slice(4);c.nickname=k==='del'?c.nickname.slice(0,-1):/^PLYR\d{4}$/.test(c.nickname)?k:(c.nickname+k).slice(0,8); // the auto name fills all 8: the first key starts a new one
      const input=this.ui.querySelector<HTMLInputElement>('#nickname');if(input)input.value=c.nickname; // no re-render: focus stays on the key
      return;
    }
    if(action.startsWith('item-')&&this.flow.flow==='P1'){const item=ATTACK_ITEMS[Number(action.slice(5))];if(item){c.attackItem=item.src;this.render();focus(this.ui,0,action);}return;}
    if(this.flow.flow==='P1'&&c&&(action==='ready'||action==='skip-nickname'&&this.step===readinessSteps(c,this.comfy).length-1)){
      this.camError='';
      // Generation runs in the background through the remaining steps and the P3 sandbox.
      if(willSubmit(c,this.step,this.comfy))void generate(c,c.photo!,c.characterId,skin=>addSheets(this.game.textures,skin),skin=>removeSheets(this.game.textures,skin));
      if(this.step<readinessSteps(c,this.comfy).length-1){this.setStep(this.step+1);return;}
      // UC04-1: 8 characters; P2 has no screen any more (single 100 s run).
      c.nickname=(action==='skip-nickname'?c.defaultNickname:c.nickname.trim()||c.defaultNickname).slice(0,8);
      this.go('P2');this.go('P3');if(this.game.registry.get('assetsReady'))this.start(true);
    }
    // P3 has no time limit (PO 2026-11-04): the player starts the 3-2-1 once the slice is running.
    if(action==='start-game'&&this.flow.flow==='P3'&&!this.countdownAt&&this.game.registry.get('assetsReady')&&this.game.scene.isActive('Gameplay')&&c?.generation.state!=='generating'){
      this.countdownAt=performance.now();sfx('ANN-01');(document.activeElement as HTMLElement|null)?.blur(); // a focused button would swallow Z (jump)
    }
    if(action==='continue'){this.menu=false;this.scene.run?.resume();this.scene.fixed?.reset();this.render();focus(this.ui,0,this.returnFocus);}
    if(action==='restart'&&this.flow.flow==='P4'){this.menu=false;this.start();this.render();}
    if(action==='exit')this.exit();
    if(action==='next-player'&&this.flow.flow==='P7')this.exit(true);
    if(action==='result'&&this.flow.flow==='P6')this.go('P7');
    if(action==='goal-retry'&&this.flow.flow==='P5'&&this.adapter.replayEnabled){this.go('P6');this.go('P7');this.act('replay');return;}
    if(action==='ranking'&&['P0','P6','P7'].includes(this.flow.flow)){if(this.flow.flow==='P6')this.go('P7');this.boardOpen=true;this.rankPage=0;this.render();return;}
    if(action==='close-ranking'){this.boardOpen=false;this.render();focus(this.ui,0,'ranking');}
    if(action.startsWith('page-')){this.rankPage=Number(action.slice(5))===1?1:0;this.render();focus(this.ui,0,action);}
    if(action==='retry-storage'){this.adapter.retryStorage();this.render();}
    if(action==='settings-replay'&&this.menu&&this.flow.flow==='P0'){this.adapter.replayEnabled=!this.adapter.replayEnabled;this.render();focus(this.ui,0,action);}
    if(this.menu&&this.flow.flow==='P0'&&(action==='records'||action==='records-back')){this.admin=action==='records';this.armed='';this.render();focus(this.ui.querySelector<HTMLElement>('.modal.screen')!,0,this.admin?'records-back':'records');}
    if(this.admin&&(action.startsWith('delete-')||action==='clear-records')){
      // Destructive: the first press arms the button, the second one deletes.
      if(this.armed!==action){this.armed=action;this.render();focus(this.ui.querySelector<HTMLElement>('.modal.screen')!,0,action);return;}
      if(action==='clear-records')this.adapter.clear();else this.adapter.remove(action.slice(7));
      this.armed='';this.render();focus(this.ui.querySelector<HTMLElement>('.modal.screen')!,0,'records-back');return;
    }
    if(this.menu&&(action==='controls'||action==='controls-back')){this.controls=action==='controls';this.binding='';this.render();focus(this.ui.querySelector<HTMLElement>('.modal.screen')!,0,this.controls?'bind-jump':'controls');return;}
    if(this.controls&&action.startsWith('bind-')){this.binding=action.slice(5) as typeof REBINDABLE[number];this.bindPrev=null;this.bindAt=performance.now();this.render();focus(this.ui.querySelector<HTMLElement>('.modal.screen')!,0,action);return;}
    if(this.controls&&action==='controls-reset'){const id=this.pad?.id;if(id!==undefined)this.saveControls(id,null);this.render();focus(this.ui.querySelector<HTMLElement>('.modal.screen')!,0,action);return;}
    if(action==='settings-time'&&this.menu&&this.flow.flow==='P0'){this.tier=P.timeTiers[(P.timeTiers.indexOf(this.tier)+1)%P.timeTiers.length];saveTier(this.tier);this.rankPage=0;this.render();focus(this.ui,0,action);}
    if(action==='replay'&&this.adapter.replayEnabled&&this.flow.flow==='P7'){this.countdownAt=performance.now();sfx('ANN-01');this.render();}
  }
  /** Cancel this player's ComfyUI job; a delivered skin's textures go once the scene using them has shut down. */
  private dropGeneration(c:Identity){const g=drop(c);if(g.state==='ready')this.game.events.once('poststep',()=>removeSheets(this.game.textures,g.skin));}
  private dropPhoto(c:Identity){this.dropGeneration(c);if(c.photo)URL.revokeObjectURL(c.photo);c.photo=undefined;}
  /** The photo step exists only while ComfyUI answers with the workflow staged; the last answer stands while a re-check runs. */
  private checkComfy(){
    void probe().then(ok=>{
      this.comfy=ok;const c=this.adapter.current;
      if(!ok&&c?.photo&&c.generation.state==='none')this.dropPhoto(c);
      if(this.flow.flow!=='P1')return;
      if(!ok&&this.step>1&&!c?.photo)this.step--; // a fast player already past the vanished photo step stays on the same screen
      // Keep whatever the player moved focus to while the probe was in flight.
      const at=(document.activeElement as HTMLElement)?.dataset.action;this.render();focus(this.ui,0,at);
    });
  }
  private setStep(step:number){
    this.step=step;if(step===0)this.checkComfy();
    this.render();
  }
  /** Persist, then latch both adapters: the button just pressed now maps to another action and must not fire as that action. */
  saveControls(id:string,profile:Parameters<typeof saveProfile>[1]){
    try{saveProfile(id,profile);}catch(error){console.warn('[controls] profile not saved',error);}
    this.inputAdapter.latch=true;if(this.scene?.inputAdapter)this.scene.inputAdapter.latch=true;
  }
  input(a:Actions){
    if(document.activeElement instanceof HTMLInputElement)return true;
    // Waiting for a button: nothing else may act on it. OPTIONS (home) cancels; update() captures the press.
    if(this.binding){if(a.home||a.pause||a.back){sfx('UI-03');this.binding='';this.render();focus(this.ui.querySelector<HTMLElement>('.modal.screen')!,0,'bind-jump');}return true;}
    if(this.flow.flow==='P0'&&(a.move||a.jump||a.confirm||a.back||a.dash||a.throw||a.home||a.pause)&&this.wake())return true;
    if(a.back&&this.admin){sfx('UI-03');this.act('records-back');return true;}
    if(a.back&&this.controls&&this.menu){sfx('UI-03');this.act('controls-back');return true;}
    if(a.home||a.pause){sfx('UI-04');this.admin=false;this.armed='';this.controls=false;if(!this.menu)this.returnFocus=(document.activeElement as HTMLElement)?.dataset.action;this.menu=!this.menu;if(this.menu)this.scene.run?.pause();else this.scene.run?.resume();this.scene.fixed?.reset();this.render();if(!this.menu)focus(this.ui,0,this.returnFocus);return true;}
    if(a.back&&this.menu){sfx('UI-03');this.act('continue');return true;}
    if(a.back&&this.boardOpen){sfx('UI-03');this.act('close-ranking');return true;}
    if(this.flow.flow==='P7'&&this.countdownAt&&!this.menu)return true;
    if(a.confirm&&this.flow.flow==='P3'&&!this.menu)this.act('start-game');
    const gameplay=(this.flow.flow==='P3'||this.flow.flow==='P4')&&!this.menu;
    if(!gameplay){
      if(a.nav||a.navY){sfx('UI-01');const root=this.ui.querySelector<HTMLElement>('.modal.screen')??this.ui;if(a.nav)focus(root,a.nav);else focusY(root,a.navY!);}
      if((a.confirm||a.jump)&&this.ui.contains(document.activeElement))(document.activeElement as HTMLButtonElement)?.click();
      if(a.back&&this.flow.flow==='P1'&&!this.menu){sfx('UI-03');this.act('prev');}
    }
    return !gameplay;
  }
  lessons(){
    const l=this.scene?.level,has=(k:string)=>!!l&&(k==='laptop'?l.powerups.some(p=>p.kind==='laptop'):k==='enemy'?l.enemies.length>0:k==='badge'?l.badges.length>0:l.terrain.some(t=>t.kind==='bounce'));
    return [['移動','MOVE','← →'],['跳躍','JUMP','Z'],['雙段跳','DOUBLE JUMP','Z ×2'],['衝刺','DASH','X'],
      ...(has('badge')?[['徽章','BADGE','接觸收集']]:[]),...(has('laptop')?[['攻擊道具','ITEM','接觸取得'],['投擲','THROW','C']]:[]),
      ...(has('enemy')?[['踩擊','STOMP','跳躍踩敵']]:[]),...(has('bounce')?[['彈跳板','BOUNCE PAD','站上彈起']]:[])];
  }
  update(){
    const now=performance.now(),delta=now-this.previous;this.previous=now;
    if(this.menu){this.entered+=delta;if(this.countdownAt)this.countdownAt+=delta;}
    // Clicking empty space, or clicking back in from another window, drops DOM focus. A stick cannot click it back and
    // confirm acts on the focused button, so put focus back (inside the open panel) whenever a menu screen has none.
    if(this.menu||!['P3','P4'].includes(this.flow.flow)){const root=this.ui.querySelector<HTMLElement>('.modal.screen')??this.ui;if(!root.contains(document.activeElement))focus(root,0,this.lastFocus);}
    if(this.binding){
      // The first pad button that goes down after listening started (the confirm press is still held on frame one) is bound.
      const pad=this.pad,p=pad?profileFor(pad):null,pressed=pad?.buttons.map(b=>b.pressed)??[],action=this.binding;
      const hit=this.bindPrev?pressed.findIndex((on,i)=>on&&!this.bindPrev![i]&&!FIXED.some(f=>p?.buttons[f]?.includes(i))):-1;
      this.bindPrev=pressed;
      if(p&&pad?.id!==undefined&&hit>=0){this.saveControls(pad.id,rebind(p,action,hit));sfx('UI-02');this.binding='';this.render();focus(this.ui.querySelector<HTMLElement>('.modal.screen')!,0,'bind-'+action);}
      else if(!p||now-this.bindAt>8000){this.binding='';this.render();}
    }
    if(!this.game.scene.isActive('Gameplay'))this.input(this.inputAdapter.sample(this.testPad??activePad()));
    if(this.flow.flow==='P0'&&this.adapter.current)this.go('P1');
    if(this.flow.flow==='P0'){
      if(!this.attract&&!this.menu&&!this.boardOpen&&now-this.idleSince>=ATTRACT_IDLE){this.attract=true;this.render();}
    }
    if(this.flow.flow==='P1'){
      const c=this.adapter.current;text(this.ui,'readiness',genText(c));text(this.ui,'ready-label',readyLabel(c,this.step,this.comfy));
    }
    if(this.flow.flow==='P3'&&!this.menu){
      const loaded=this.game.registry.get('assetsReady');
      if(loaded&&!this.game.scene.isActive('Gameplay'))this.start(true);
      const progress=this.ui.querySelector<HTMLProgressElement>('progress'),value=this.game.registry.get('loadProgress')??0;if(progress)progress.value=value;text(this.ui,'load-pct',Math.round(value*100)+'%');
      text(this.ui,'loading',loaded?'所需遊戲素材已載入':this.game.registry.get('loadError')?'素材載入失敗':'載入中');
      const c=this.adapter.current,g=c?.generation;
      if(g?.state==='generating'){const ms=now-g.startedAt;text(this.ui,'gen-status',`專屬角色生成中 · 已等待 ${Math.floor(ms/1000)} 秒`);const bar=this.ui.querySelector<HTMLProgressElement>('#gen-progress');if(bar)bar.value=Math.min(.95,ms/120000);}
      // The custom character arrives during practice: swap the art in place, keep position and lessons.
      const skin=skinOf(c);if(this.game.scene.isActive('Gameplay')&&this.scene.presentation&&this.scene.presentation.skin!==skin)this.scene.presentation.setSkin(skin);
      if(g&&g.state!=='none'&&this.ui.querySelector<HTMLElement>('.gen')?.dataset.state!==g.state)this.render();
      if(this.game.scene.isActive('Gameplay')&&this.scene.session){
        const s=this.scene;
        if(!this.ui.querySelector('[data-lesson]')&&s.session.tutorial)this.render();
        if(Math.abs(s.body.velocity.x)>1)this.progress.add('移動');
        if(s.controller.state==='JUMP')this.progress.add('跳躍');
        if(s.controller.state==='DASH')this.progress.add('衝刺');
        if(s.session.power.throwReady>0)this.progress.add('投擲');
        if(s.session.badges.held)this.progress.add('徽章');
        if(s.enemies.enemies.some(e=>e.defeated))this.progress.add('踩擊');
        if(s.session.power.armed)this.progress.add('攻擊道具');
        if(s.controller.jumps===2)this.progress.add('雙段跳');
        if(s.session.stats.bounces)this.progress.add('彈跳板');
      }
      let active=false;
      for(const node of this.ui.querySelectorAll<HTMLElement>('[data-lesson]')){
        const complete=this.progress.has(node.dataset.lesson!);
        const state=complete?'completed':!active?'active':'not-started';if(!complete)active=true;
        node.dataset.state=state;const label=node.querySelector('.lesson-state')!;label.textContent=complete?'✓ 完成':state==='active'?'練習中':'尚未開始';
      }
      text(this.ui,'tutorial-progress',[...this.progress].join(' · ')||'試試移動、跳躍與衝刺');
      const go=this.ui.querySelector<HTMLButtonElement>('[data-action=start-game]');if(go)go.disabled=!loaded||!!this.countdownAt||!this.game.scene.isActive('Gameplay')||g?.state==='generating';
      if(this.countdownAt){text(this.ui,'countdown',Math.max(1,Math.ceil((3000-now+this.countdownAt)/1000)));if(now-this.countdownAt>=3000){this.go('P4');this.start();}}
    }
    if(this.flow.flow==='P4'){
      const s=this.scene.session;if(!s)return;
      updateHud(this.ui,s,this.scene.level.badges.length,this.scene.cameraManager.segAt(this.scene.player.x,this.scene.body.bottom-1)?.name??'');
      if(s.result){
        this.result=s.result;this.adapter.save(s.result);this.scene.finalize();
        if(s.result.endReason==='time-up'&&!this.scene.body.blocked.down){const p=this.scene.respawner.position(this.scene.body.width,this.scene.body.height);this.scene.body.reset(p.x,p.y);this.scene.presentation.update('IDLE',1,s.run.elapsed);}
        this.go('P5');
      }
    }
    if(this.flow.flow==='P5'&&!this.menu&&now-this.entered>=(this.result?.endReason==='goal'?5000:3000)){this.go('P6');sfx('SYS-05');sfx('SYS-06',1.5);}
    if(this.flow.flow==='P7'&&this.countdownAt&&!this.menu){text(this.ui,'countdown',Math.max(1,Math.ceil((3000-now+this.countdownAt)/1000)));if(now-this.countdownAt>=3000){this.go('P4');this.result=null;this.start();}}
  }
  ranking(full=false,tier=this.tier){
    const rows=this.adapter.board(tier),mine=rows.findIndex(r=>r.runId===this.result?.runId);
    const indices=full?Array.from({length:Math.max(0,Math.min(10,Math.min(rows.length,20)-this.rankPage*10))},(_,i)=>i+this.rankPage*10):[...new Set([0,1,2,3,4,...(mine>=0?[mine-1,mine,mine+1]:[])])].filter(i=>i>=0&&i<rows.length).sort((a,b)=>a-b);
    for(let n=indices.length;n--;)if(!rows[indices[n]])indices.splice(n,1); // ponytail: a stale rankPage must never throw inside the poststep render
    const status=this.adapter.storageStatus==='loading'?'<p role="status">載入本機成績中…</p>':this.adapter.storageStatus==='error'?`<div class="storage-error" role="alert">${escape(this.adapter.storageError)}${button('retry-storage','重試保存','RETRY')}</div>`:'';
    return `${status}<div class="ranking ${full?'full-ranking':''}">${indices.map(i=>rankRow(i+1,rows[i],rows[i].runId===this.result?.runId)).join('')||(this.adapter.storageStatus==='ready'?'<p class="empty-state">尚無成績<br><small>完成挑戰，留下你的第一筆紀錄。</small></p>':'')}</div>`;
  }
  leaderboard(){
    const rows=this.adapter.board(this.tier).slice(0,20);
    return `<div class="leaderboard-layout"><div class="podium">${rows.slice(0,3).map((r,i)=>`<section class="podium-card rank-${i+1}"><span class="podium-rank">0${i+1}</span>${avatar(r.characterId,'attack')}<h2 title="${escape(r.nickname)}">${escape(r.nickname)}</h2><strong>${r.score.toLocaleString()}</strong><small>POINTS / ${this.tier} S</small></section>`).join('')||'<div class="podium-empty">THE NEXT LEGEND<span>下一個紀錄，由你創造。</span></div>'}</div>${panel(`TOP 20 / ${this.tier} 秒`,this.ranking(true)+`<div class="pagination">${button('page-0','第 1 頁','01 — 10',this.rankPage===0)}${button('page-1','第 2 頁','11 — 20',rows.length<=10||this.rankPage===1)}</div>`,'leaderboard-table blue')}</div>`;
  }
  /** Shared v2 frame: brand + stage name + status chips on top, key hints at the bottom. */
  shell(title:string,en:string,body:string,classes='',chips=''){
    return `<div class="screen ${classes}" data-screen="${this.flow.flow}"><i class="floor"></i><header class="top">${BRAND}${title?`<div class="stage-name">${title}<small>${en}</small></div>`:''}</div><div class="status">${chips}</div></header>${body}<div class="hints">${HINTS[this.flow.flow]??NAV}</div><div class="hints-right">Republic of Gamers · 本機成績 · 示範排隊</div></div>`;
  }
  get item(){return ATTACK_ITEMS.find(i=>i.src===this.adapter.current?.attackItem)??ATTACK_ITEMS[0];}
  render(){
    const nickname=escape(this.adapter.current?.nickname??'PLYR'),character=this.adapter.current?.characterId??'a',who=chip(`${nickname} · ${this.tier} s`);let body='';
    switch(this.flow.flow){
      case 'P0':{
        // UX v0.4 UC01-1: main visual and two buttons only. LEADERBOARD opens the same board as P7 (UC01-2).
        body=this.boardOpen?this.shell('榮耀排行榜','TOP 20 · LOCAL RECORDS',this.leaderboard()+`<div class="actions">${button('close-ranking','返回首頁','BACK',false,'','exit')}</div>`,'board-screen')
          :`<div class="screen standby" data-screen="P0"><img class="mainvis" src="${MAINVIS}" alt="ROG CYBER RUNNER — FOR THOSE WHO DARE"><img class="home-hero" src="${HOME_HERO}" alt=""><div class="home-actions">${button('demo','開始遊戲','START',false,'primary','next')}${button('ranking','排行榜','LEADERBOARD',false,'','list')}${button('settings','設定','SETTINGS',false,'','list')}</div></div>`;
        if(this.attract)body+=`<video class="attract" src="${'/assets/cyber-run/attract.mp4'}" autoplay muted loop playsinline aria-label="首頁待機巡覽" onerror="this.remove()"></video>`;
        break;
      }
      case 'P1':{const r=readiness(this.adapter.current,this.step,this.camError,this.comfy);body=this.shell('','',r.html,r.classes,chip(`<span id="readiness">${genText(this.adapter.current)}</span>`,'red'));break;}
      case 'P3':{
        const lessons=this.game.scene.isActive('Gameplay')&&this.scene.session?.tutorial?this.lessons():[];
        const g=this.adapter.current?.generation;
        const gen=g&&g.state!=='none'?`<div class="gen" data-state="${g.state}"><span id="gen-status" role="status">${genText(this.adapter.current)}</span><progress id="gen-progress" class="progress" aria-label="專屬角色生成進度" max="1" value="${g.state==='generating'?0:1}"></progress></div>`:'';
        body=this.shell('新手訓練場','TUTORIAL SANDBOX',`<section class="panel player">${avatar(character,'idle',skinOf(this.adapter.current).poses.idle)}<div class="who">${nickname}<small>${characterName(character)} · ${escape(this.item.name)}</small></div>${gen}<div class="load"><span><span id="loading" role="status">載入中</span><b id="load-pct">0%</b></span><progress class="progress" aria-label="素材載入進度" max="1" value="0"></progress></div><div class="go">${button('start-game','開始遊戲','START',true,'primary','next')}</div></section><div class="sandbox"><span class="label"><i></i>LIVE TRAINING · 自由練習</span><div id="countdown" class="cd"></div></div><div class="lessons"><div class="head"><b>新手訓練清單</b><small>TUTORIAL CHECKLIST</small><span id="tutorial-progress"></span></div><div class="lesson-grid" style="grid-template-columns:repeat(${Math.max(1,lessons.length)},1fr)">${lessons.map(([zh,en,key])=>`<div class="lesson" data-lesson="${zh}"><b>${zh}<small>${en}</small></b><kbd>${key}</kbd><small class="lesson-state">尚未開始</small></div>`).join('')}</div></div>`,'tutorial',who);break;
      }
      case 'P4':body=hud(this.adapter.current?.attackItem??ATTACK_ITEMS[0].src);break;
      case 'P5':{
        const r=this.result,goal=r?.endReason==='goal';
        // NEW RECORD above the best other run on this board, or the first run on an empty board (PO 2026-11-04); P6 does not repeat it.
        const best=r?this.adapter.board(this.tier).find(x=>x.runId!==r.runId)?.score:undefined,record=!!r&&(best===undefined||r.score>best);
        body=this.shell('實驗室 LABORATORY STAGE','SIDE SCROLLING MISSION',`<div class="goal-burst"></div><img class="goal-art" src="${skinOf(this.adapter.current).poses[goal?'jump':'idle']}" alt=""><h1 class="goal-title">${goal?'GOAL!':'TIME UP'}</h1><div class="goal-sub"><h2>${goal?'任務完成！':'時間到！'}</h2><small>${goal?'MISSION CLEAR':'CHALLENGE OVER'}</small></div>${panel('本次成績<small>MISSION REPORT</small>',statRow('star','分數','SCORE',(r?.score??0).toLocaleString(),'gold')+statRow('clock',goal?'通關時間':'遊玩時間',goal?'CLEAR TIME':'PLAY TIME',time(r?r.duration-r.remainingTime:0),'',record?'<span class="tag">NEW RECORD</span>':'')+statRow('badge','持有徽章','BADGES HELD',r?.heldBadgeCount??0,'',`<small> / ${this.scene?.level?.badges.length??'—'}</small>`)+statRow('combo','最高連擊','MAX COMBO',r?.playerStatistics.maxCombo??0)+`<div class="report-title">${titleTag([(r&&titles(r)[0])||'超新星'])}</div><div class="foot"><span>即將進入本場結果 · ${goal?5:3} 秒</span><small>AUTO →</small></div>`,'report')}<div class="actions">${button('goal-retry','再挑戰','RETRY',!this.adapter.replayEnabled,'','retry')}${button('next-stage','下一關','COMING SOON',true,'','next')}${this.adapter.current?.captureStarted?'':button('exit','返回選單','BACK TO MENU',false,'primary','home')}</div>`,`mission ${goal?'goal':'time-up'}`,who);break;
      }
      case 'P6':{
        const r=this.result!,st=r.playerStatistics,goal=r.endReason==='goal';
        body=this.shell('本場結果','BATTLE RESULT',`<div class="result-columns">${panel('戰鬥數據<small>STATISTICS</small>',`<div class="who">${avatar(character,'idle',skinOf(this.adapter.current).poses.idle)}<div><strong>${nickname}</strong><small>${characterName(character)} · ${escape(this.item.name)}</small></div></div>`+statRow('badge','持有徽章','BADGES',r.heldBadgeCount)+statRow('skull','擊敗敵人','ENEMY KILLS',st.kills)+statRow('combo','最高連擊','MAX COMBO',st.maxCombo)+statRow('clock',goal?'通關時間':'遊玩時間',goal?'CLEAR TIME':'PLAY TIME',time(r.duration-r.remainingTime))+statRow('bounce','彈跳次數','BOUNCES',st.bounces)+statRow('bolt','攻擊道具擊倒','ITEM KNOCKOUTS',st.bolts),'blue')}${panel('本場結果<small>RESULT</small>',`<div class="verdict"><div class="word ${goal?'':'finished'}">${goal?'CLEAR!':'FINISHED'}<small>MISSION DEBRIEF</small></div>${avatar(character,'attack',skinOf(this.adapter.current).poses.attack)}${titleTag(titleLine(r))}</div><div class="breakdown">${Object.entries(r.scoreBreakdown).map(([k,v])=>statRow('',({enemy:'敵人（含 Combo）',badges:'持有徽章 ×10',goal:'通關',time:'剩餘秒數 ×2',noDrop:'零掉落通關'} as Record<string,string>)[k]??k,'',`+${v.toLocaleString()}`)).join('')}</div><div class="score-box"><span>YOUR SCORE</span><strong class="big-score">${r.score.toLocaleString()}</strong></div>`,'verdict-panel')}${panel(`排行榜<small>${this.tier} S · LOCAL</small>`,this.ranking()+`<div class="rank-foot"><span>角色牆已更新 · ${this.adapter.wall.size} 位</span><span>本機成績</span></div>`,'blue board-panel')}</div><div class="actions">${button('ranking','完整排行','TOP 20',false,'','list')}${button('result','繼續','CONTINUE',false,'primary','next')}</div>`,'',who);break;
      }
      case 'P7':{
        const on=this.adapter.replayEnabled,next=this.adapter.queue[1];
        body=this.boardOpen?this.shell('榮耀排行榜','TOP 20 · LOCAL RECORDS',this.leaderboard()+`<div class="actions">${button('close-ranking','返回','BACK',false,'','exit')}</div>`,'board-screen',who):
          this.shell('再來一場','PLAY AGAIN',`<img class="again-left" src="${skinOf(this.adapter.current).poses.attack}" alt=""><img class="again-right" src="/assets/ui/enemy-dog.png" alt=""><section class="panel again"><h1>再來一場？<small>PLAY AGAIN?</small></h1><div class="actions">${button('replay','再玩一場','PLAY AGAIN',!on||!!this.countdownAt,on?'primary':'','retry')}${this.adapter.current?.captureStarted?button('next-player','下一位玩家','NEXT PLAYER',false,on?'':'primary','next'):button('exit','結束','EXIT',false,on?'':'primary','exit')}</div><div class="secondary">${button('ranking','查看排行榜','TOP 20',false,'ghost')}</div></section><div class="next"><div class="lbl">下一位<small>NEXT PLAYER</small></div><span class="arr">»</span>${next?`<img src="${pose(next.characterId)}" alt="">`:''}<strong>${escape(next?.nickname??'目前無玩家等待')}</strong></div>${this.countdownAt?'<div class="modal countdown-layer" role="status"><b id="countdown">3</b></div>':''}`,'replay-screen',who);break;
      }
      default:body=`<div class="screen transparent" data-screen="${this.flow.flow}"></div>`;
    }
    if(this.menu&&this.admin){
      const rows=this.adapter.board(this.tier),day=(r:typeof rows[number])=>r.completedAt?new Date(r.completedAt).toLocaleString('zh-TW',{hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
      const row=(r:typeof rows[number],i:number)=>{const id='delete-'+escape(r.runId),on=this.armed==='delete-'+r.runId;return button(id,on?'再按一次刪除':`${String(i+1).padStart(2,'0')}　${escape(r.nickname)}`,on?'PRESS AGAIN TO DELETE':`${r.score.toLocaleString()} 分 · ${day(r)}`,false,on?'primary':'');};
      body+=`<div class="modal screen" role="dialog" aria-modal="true" aria-label="排行榜管理"><section class="panel menu records"><h2>排行榜管理<small>RECORDS · ${this.tier} 秒 · ${rows.length} 筆 · 本機永久保存</small></h2><div class="record-list">${rows.map(row).join('')||'<p class="empty-state">尚無成績</p>'}</div>${button('clear-records',this.armed==='clear-records'?'再按一次全部清除':'重置全部紀錄',this.armed==='clear-records'?'PRESS AGAIN TO RESET':'RESET ALL TIERS',false,this.armed==='clear-records'?'primary':'','retry')}${button('records-back','返回','BACK',false,'','exit')}</section></div>`;
    }
    else if(this.menu&&this.controls){
      const pad=this.pad,p=pad?profileFor(pad):null,name=(i:number)=>(pad?.mapping==='standard'&&PAD_NAMES[i])||`按鍵 ${i}`;
      body+=`<div class="modal screen" role="dialog" aria-modal="true" aria-label="按鍵設定"><section class="panel menu"><h2>按鍵設定<small>CONTROLS · 搖桿上下選動作 → 確認 → 按下要用的按鍵</small></h2>${p?REBINDABLE.map(a=>this.binding===a?button('bind-'+a,'請按下按鍵…','PRESS A BUTTON · 返回／OPTIONS 取消',false,'primary'):button('bind-'+a,CONTROL_LABELS[a],p.buttons[a]?.map(name).join(' / ')||'未設定')).join(''):'<p class="empty-state">未偵測到搖桿<br><small>請先按一下搖桿上的任一按鍵</small></p>'}${button('controls-reset','恢復預設','RESET TO DEFAULT',!p,'','retry')}${button('controls-back','返回','BACK',false,'','exit')}</section></div>`;
    }
    else if(this.menu)body+=`<div class="modal screen" role="dialog" aria-modal="true" aria-label="系統選單"><section class="panel menu"><h2>系統選單<small>SYSTEM MENU</small></h2>${(this.adapter.current?.captureStarted||['P3','P4','P5','P6','P7'].includes(this.flow.flow)||this.flow.flow==='P0'&&this.returnFocus==='settings')?button('continue','繼續','CONTINUE',false,'primary','next'):''}${this.flow.flow==='P4'?button('restart','重新開始','RESTART',false,'','retry'):''}${this.adapter.current?.captureStarted?'':button('exit','回到主畫面','HOME',false,'','home')}${button('controls','按鍵設定','CONTROLS',false,'','list')}${this.flow.flow==='P0'?button('settings-replay',`再挑戰：${this.adapter.replayEnabled?'開啟':'關閉'}`,'REPLAY SETTING',false,'','list')+button('settings-time',`遊戲時間：${this.tier} 秒`,'TIME SETTING',false,'','clock')+button('records','排行榜管理','RECORDS',false,'','list'):''}</section></div>`;
    this.ui.innerHTML=body;this.syncCamera();
    // Gameplay screens keep DOM focus off buttons so Z/Enter reach the game, not a focused START.
    if(this.menu||!['P3','P4'].includes(this.flow.flow))focus(this.ui.querySelector<HTMLElement>('.modal.screen')??this.ui,0,this.menu?'continue':this.flow.flow==='P1'?(onPhoto(this.adapter.current,this.step,this.comfy)&&!this.adapter.current?.photo&&!this.camError?'shoot':'ready'):this.flow.flow==='P5'?'exit':this.flow.flow==='P6'?'result':this.flow.flow==='P7'?(this.adapter.current?.captureStarted?'next-player':'exit'):undefined);
  }
  /** Open the camera while a live viewfinder is on screen, release it as soon as none is. */
  syncCamera(){
    if(!this.ui.querySelector('video.live')){void this.stream?.then(closeCamera,()=>{});this.stream=null;return;}
    const pending=this.stream??=openCamera();
    pending.then(stream=>{
      if(this.stream!==pending)return closeCamera(stream);
      const video=this.ui.querySelector<HTMLVideoElement>('video.live');if(video&&video.srcObject!==stream)video.srcObject=stream;
    },error=>{if(this.stream!==pending)return;this.stream=null;this.camError=cameraError(error);this.render();});
  }
}
