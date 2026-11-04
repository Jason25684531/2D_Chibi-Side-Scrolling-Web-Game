import Phaser from 'phaser';
import {GameplayStateMachine,type Flow} from '../core/state';
import {InputAdapter,type Actions,type Pad} from '../input/adapter';
import type {GameplayScene} from '../scenes/gameplay';
import type {GameplayResult} from '../core/session';
import {TEST_PROFILE as P,ATTACK_ITEMS} from '../core/config';
import {characterName,characterIds,pose} from '../assets/catalog';
import {MockStation,titles,savedTier,saveTier} from './mock-station';
import {avatar,button,panel,escape,focus,text,time,chip,statRow,titleTag,rankRow} from './components';
import {readiness,readinessSteps,readyLabel,needsPhoto,look} from './readiness';
import {openCamera,closeCamera,cameraError,capturePhoto,dress} from './camera';
import './station.css';
import {hud,updateHud} from './hud';
const ATTRACT_IDLE=60000;
const NAV='<span><kbd>← →</kbd>選擇</span><span><kbd>Z / ENTER</kbd>確認</span><span><kbd>BACKSPACE</kbd>返回</span><span><kbd>H</kbd>選單</span>';
const HINTS:Record<string,string>={P0:'<span><kbd>Z / ENTER</kbd>PLAY</span><span><kbd>H</kbd>系統選單</span>',P3:'<span><kbd>← →</kbd>移動</span><span><kbd>Z</kbd>跳躍</span><span><kbd>X</kbd>衝刺</span><span><kbd>C</kbd>投擲</span><span><kbd>ENTER</kbd>開始遊戲</span><span><kbd>H</kbd>選單</span>'};
// Text wordmark only; the slashes are decoration, not the ROG eye (DESIGN.md §8.5).
const BRAND='<div class="brand"><svg class="logo" viewBox="0 0 70 56" aria-hidden="true"><polygon points="4,8 30,8 22,48 0,48"/><polygon points="36,8 70,8 50,48 28,48" opacity=".55"/></svg><div class="wordmark">ROG<span>FUTURE GAMER</span></div>';
/** Rarest three titles plus "+N"; no title shows 「超新星」 (planning v0.3 §3.3). */
const titleLine=(r:GameplayResult)=>{const t=titles(r);return t.length?t.slice(0,3).join(' · ')+(t.length>3?' +'+(t.length-3):''):'超新星';};

export class StationUI {
  flow=new GameplayStateMachine();adapter=new MockStation();inputAdapter=new InputAdapter();
  tier=typeof window==='undefined'?P.timeTier:savedTier();entered=performance.now();countdownAt=0;menu=false;lastMove=0;testPad:Pad|null=null;
  root:HTMLElement;ui:HTMLElement;progress=new Set<string>();private previous=performance.now();
  result:GameplayResult|null=null;step=0;idleSince=performance.now();attract=false;
  boardOpen=false;rankPage=0;private returnFocus:string|undefined;
  /** P0 menu → records panel; armed = the delete/reset action waiting for its confirming second press. */
  admin=false;armed='';
  /** Live camera for the P1 photo step; render() opens and closes it. */
  private stream:Promise<MediaStream>|null=null;camError='';
  constructor(readonly game:Phaser.Game){
    document.body.classList.add('station');
    this.root=document.createElement('div');this.root.id='station-root';
    this.ui=document.createElement('div');this.ui.id='station-ui';
    document.body.append(this.root);this.root.append(document.querySelector('#game')!,this.ui);
    game.registry.set('station',this);this.inputAdapter.attach();
    this.ui.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(b&&!b.disabled)this.act(b.dataset.action!);});
    this.ui.addEventListener('pointerdown',()=>this.wake());
    this.ui.addEventListener('input',event=>{const input=event.target as HTMLInputElement;if(input.id==='nickname'&&this.adapter.current)this.adapter.current.nickname=input.value;});
    this.ui.addEventListener('focusin',event=>{
      if(event.target instanceof HTMLInputElement)for(const a of [this.inputAdapter,this.scene.inputAdapter]){a?.codes.clear();a?.previous.clear();a?.clear();}
    });
    this.ui.addEventListener('keydown',event=>{
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
    this.render();(window as any).__station=this;
  }
  get scene(){return this.game.scene.getScene('Gameplay') as GameplayScene;}
  go(next:Flow){this.admin=false;this.armed='';this.flow.transition(next);this.entered=this.idleSince=performance.now();this.countdownAt=0;this.boardOpen=false;this.rankPage=0;this.attract=false;if(next==='P1')this.step=0;this.render();}
  start(tutorial=false){
    this.inputAdapter.dispose();this.progress.clear();
    const c=this.adapter.current!,data={duration:this.tier,sessionId:c.sessionId,characterId:c.characterId,attackItem:c.attackItem,photo:c.custom?c.photo:undefined,tutorial,flow:this.flow};
    if(this.game.scene.isActive('Gameplay'))this.scene.scene.restart(data);else this.game.scene.start('Gameplay',data);
  }
  stop(){if(this.game.scene.isActive('Gameplay'))this.game.scene.stop('Gameplay');this.inputAdapter.attach();}
  exit(){this.menu=false;this.stop();this.adapter.exit();this.go('P0');if(this.adapter.current)this.go('P1');}
  /** Any input on P0 resets the idle clock and closes the attract video. Returns true when it closed the video. */
  wake(){this.idleSince=performance.now();if(!this.attract)return false;this.attract=false;this.render();return true;}
  act(action:string){
    if(this.countdownAt&&this.flow.flow==='P7'&&!this.menu)return;
    if(action==='demo'&&this.flow.flow==='P0'){this.adapter.enqueue();this.go('P1');}
    const c=this.adapter.current;
    if(action.startsWith('character-')&&this.flow.flow==='P1'){
      // Step 1 picks a/b/custom; on the photo step a/b only picks the body under the face.
      const id=action.slice(10);
      if(id==='custom'){c.custom=true;this.camError='';}
      else if(characterIds.includes(id as typeof characterIds[number])){c.characterId=id;if(this.step===0)c.custom=false;}
      else return;
      this.render();focus(this.ui,0,action);return;
    }
    if(action==='shoot'&&this.flow.flow==='P1'&&c){
      const video=this.ui.querySelector<HTMLVideoElement>('video.live');if(!video?.videoWidth)return;
      const photo=c.photo=capturePhoto(video);c.looks=undefined;this.render();
      void dress(photo).then(looks=>{if(c.photo!==photo)return;c.looks=looks;if(this.flow.flow==='P1'){const at=(document.activeElement as HTMLElement)?.dataset.action;this.render();focus(this.ui,0,at);}});
      return;
    }
    if(action==='retake'&&this.flow.flow==='P1'&&c){c.photo=c.looks=undefined;this.render();return;}
    if(action==='prev'&&this.flow.flow==='P1'){this.camError='';if(this.step>0){this.step--;this.render();}else this.exit();return;}
    if(action.startsWith('item-')&&this.flow.flow==='P1'){const item=ATTACK_ITEMS[Number(action.slice(5))];if(item){c.attackItem=item.src;this.render();focus(this.ui,0,action);}return;}
    if(action==='ready'&&this.flow.flow==='P1'&&c?.assetState!=='generating'&&!needsPhoto(c,this.step)){
      this.camError='';
      if(this.step<readinessSteps(c).length-1){this.step++;this.render();return;}
      // UC04-1: 8 characters; P2 has no screen any more (single 100 s run).
      c.nickname=c.nickname.trim().slice(0,8)||c.nickname;this.go('P2');this.go('P3');if(this.game.registry.get('assetsReady'))this.start(true);
    }
    // P3 has no time limit (PO 2026-11-04): the player starts the 3-2-1 once the slice is running.
    if(action==='start-game'&&this.flow.flow==='P3'&&!this.countdownAt&&this.game.registry.get('assetsReady')&&this.game.scene.isActive('Gameplay')){
      this.countdownAt=performance.now();(document.activeElement as HTMLElement|null)?.blur(); // a focused button would swallow Z (jump)
    }
    if(action==='continue'){this.menu=false;this.scene.run?.resume();this.scene.fixed?.reset();this.render();focus(this.ui,0,this.returnFocus);}
    if(action==='restart'&&this.flow.flow==='P4'){this.menu=false;this.start();this.render();}
    if(action==='exit')this.exit();
    if(action==='result'&&this.flow.flow==='P6')this.go('P7');
    if(action==='goal-retry'&&this.flow.flow==='P5'&&this.adapter.replayEnabled){this.go('P6');this.go('P7');this.act('replay');return;}
    if(action==='ranking'&&['P6','P7'].includes(this.flow.flow)){if(this.flow.flow==='P6')this.go('P7');this.boardOpen=true;this.rankPage=0;this.render();return;}
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
    if(action==='settings-time'&&this.menu&&this.flow.flow==='P0'){this.tier=P.timeTiers[(P.timeTiers.indexOf(this.tier)+1)%P.timeTiers.length];saveTier(this.tier);this.rankPage=0;this.render();focus(this.ui,0,action);}
    if(action==='replay'&&this.adapter.replayEnabled&&this.flow.flow==='P7'){this.countdownAt=performance.now();this.render();}
  }
  input(a:Actions){
    if(document.activeElement instanceof HTMLInputElement)return true;
    if(this.flow.flow==='P0'&&(a.move||a.jump||a.confirm||a.back||a.dash||a.throw||a.home||a.pause)&&this.wake())return true;
    if(a.back&&this.admin){this.act('records-back');return true;}
    if(a.home||a.pause){this.admin=false;this.armed='';if(!this.menu)this.returnFocus=(document.activeElement as HTMLElement)?.dataset.action;this.menu=!this.menu;if(this.menu)this.scene.run?.pause();else this.scene.run?.resume();this.scene.fixed?.reset();this.render();if(!this.menu)focus(this.ui,0,this.returnFocus);return true;}
    if(a.back&&this.menu){this.act('continue');return true;}
    if(a.back&&this.boardOpen){this.act('close-ranking');return true;}
    if(this.flow.flow==='P7'&&this.countdownAt&&!this.menu)return true;
    if(a.confirm&&this.flow.flow==='P3'&&!this.menu)this.act('start-game');
    const gameplay=(this.flow.flow==='P3'||this.flow.flow==='P4')&&!this.menu;
    if(!gameplay){
      if(a.move&&(a.movePressed||a.move!==this.lastMove))focus(this.ui.querySelector<HTMLElement>('.modal.screen')??this.ui,a.move);
      if((a.confirm||a.jump)&&this.ui.contains(document.activeElement))(document.activeElement as HTMLButtonElement)?.click();
      if(a.back&&this.flow.flow==='P1'&&!this.menu)this.act('prev');
    }
    this.lastMove=a.move;return !gameplay;
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
    if(!this.game.scene.isActive('Gameplay'))this.input(this.inputAdapter.sample(this.testPad??Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected)));
    if(this.flow.flow==='P0'&&this.adapter.current)this.go('P1');
    if(this.flow.flow==='P0'){
      if(!this.attract&&!this.menu&&now-this.idleSince>=ATTRACT_IDLE){this.attract=true;this.render();}
      // Wall and TOP 20 share the screen: wall scrolls on a 20 s cycle, board flips page every 10 s when there is a second page.
      const t=now-this.entered,page=this.adapter.board(this.tier).length>10?Math.floor(t/10000)%2:0;
      if(page!==this.rankPage&&!this.menu){this.rankPage=page;this.render();}
      const wall=this.ui.querySelector('.wall');if(wall)wall.scrollLeft=(t%20000/20000)*Math.max(0,wall.scrollWidth-wall.clientWidth);
    }
    if(this.flow.flow==='P1'){
      const c=this.adapter.current,state=c?.assetState;const b=this.ui.querySelector<HTMLButtonElement>('[data-action=ready]');
      if(b){const wasDisabled=b.disabled;b.disabled=state==='generating'||needsPhoto(c,this.step);if(wasDisabled&&!b.disabled&&!this.menu)b.focus();}text(this.ui,'readiness',state==='generating'?'角色準備中，請稍候…':state==='ready'?'已就緒':'角色備援模式');text(this.ui,'ready-label',readyLabel(c,this.step));
    }
    if(this.flow.flow==='P3'&&!this.menu){
      const loaded=this.game.registry.get('assetsReady');
      if(loaded&&!this.game.scene.isActive('Gameplay'))this.start(true);
      const progress=this.ui.querySelector<HTMLProgressElement>('progress'),value=this.game.registry.get('loadProgress')??0;if(progress)progress.value=value;text(this.ui,'load-pct',Math.round(value*100)+'%');
      text(this.ui,'loading',loaded?'所需遊戲素材已載入':this.game.registry.get('loadError')?'素材載入失敗':'載入中');
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
      const go=this.ui.querySelector<HTMLButtonElement>('[data-action=start-game]');if(go)go.disabled=!loaded||!!this.countdownAt||!this.game.scene.isActive('Gameplay');
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
    if(this.flow.flow==='P5'&&!this.menu&&now-this.entered>=(this.result?.endReason==='goal'?5000:3000))this.go('P6');
    if(this.flow.flow==='P7'&&this.countdownAt&&!this.menu){text(this.ui,'countdown',Math.max(1,Math.ceil((3000-now+this.countdownAt)/1000)));if(now-this.countdownAt>=3000){this.go('P4');this.result=null;this.start();}}
  }
  ranking(full=false,tier=this.tier){
    const rows=this.adapter.board(tier),mine=rows.findIndex(r=>r.runId===this.result?.runId);
    const indices=full?Array.from({length:Math.max(0,Math.min(10,Math.min(rows.length,20)-this.rankPage*10))},(_,i)=>i+this.rankPage*10):[...new Set([0,1,2,3,4,...(mine>=0?[mine-1,mine,mine+1]:[])])].filter(i=>i>=0&&i<rows.length).sort((a,b)=>a-b);
    const status=this.adapter.storageStatus==='loading'?'<p role="status">載入本機成績中…</p>':this.adapter.storageStatus==='error'?`<div class="storage-error" role="alert">${escape(this.adapter.storageError)}${button('retry-storage','重試保存','RETRY')}</div>`:'';
    return `${status}<div class="ranking ${full?'full-ranking':''}">${indices.map(i=>rankRow(i+1,rows[i],rows[i].runId===this.result?.runId)).join('')||(this.adapter.storageStatus==='ready'?'<p class="empty-state">尚無成績<br><small>完成挑戰，留下你的第一筆紀錄。</small></p>':'')}</div>`;
  }
  leaderboard(){
    const rows=this.adapter.board(this.tier).slice(0,20);
    return `<div class="leaderboard-layout"><div class="podium">${rows.slice(0,3).map((r,i)=>`<section class="podium-card rank-${i+1}"><span class="podium-rank">0${i+1}</span>${avatar(r.characterId,'attack1')}<h2 title="${escape(r.nickname)}">${escape(r.nickname)}</h2><strong>${r.score.toLocaleString()}</strong><small>POINTS / ${this.tier} S</small></section>`).join('')||'<div class="podium-empty">THE NEXT LEGEND<span>下一個紀錄，由你創造。</span></div>'}</div>${panel(`TOP 20 / ${this.tier} 秒`,this.ranking(true)+`<div class="pagination">${button('page-0','第 1 頁','01 — 10',this.rankPage===0)}${button('page-1','第 2 頁','11 — 20',rows.length<=10||this.rankPage===1)}</div>`,'leaderboard-table blue')}</div>`;
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
        const wall=[...this.adapter.wall.values()],paged=this.adapter.board(this.tier).length>10;
        // ponytail: P0 only renders with an empty queue (update() jumps to P1 otherwise), so the notice is fixed copy.
        body=this.shell('','',`<div class="p0-title"><h1>CYBER <span>RUN</span></h1><p>電域狂奔<small>FOR THOSE WHO DARE</small></p></div><div class="wall">${wall.map((r,i)=>`<div class="wcard"><span class="idx">${String(i+1).padStart(2,'0')}</span><img src="${r.look??pose(r.characterId)}" alt=""><div class="name"><strong title="${escape(r.nickname)}">${escape(r.nickname)}</strong><span class="title">${escape(r.titles[0]??'超新星')}</span></div></div>`).join('')||'<div class="wcard empty"><p>成為下一位<br>Future Gamer<small>NEXT PLAYER WANTED</small></p></div>'}</div><section class="panel top20"><h2>TOP 20<small> / ${this.tier} 秒</small></h2>${this.ranking(true)}${paged?`<div class="page"><b>${this.rankPage+1}</b> / 2 · 每 10 秒換頁</div>`:''}</section><div class="notice"><i>i</i><div><strong>目前沒有玩家排隊，歡迎參觀 ROG FUTURE GAMER</strong><small>NO PLAYERS IN QUEUE · FEEL FREE TO EXPLORE</small></div></div><div class="demo">${button('demo','PLAY','開始遊戲',false,'primary','next')}</div>`,'standby',chip(`Replay ${this.adapter.replayEnabled?'開啟':'關閉'}`,'red'))+(this.attract?`<video class="attract" src="${'/assets/cyber-run/attract.mp4'}" autoplay muted loop playsinline aria-label="首頁待機巡覽" onerror="this.remove()"></video>`:'');break;
      }
      case 'P1':{const r=readiness(this.adapter.current,this.step,this.camError);body=this.shell('','',r.html,r.classes,chip('<span id="readiness">角色備援模式</span>','red'));break;}
      case 'P3':{
        const lessons=this.game.scene.isActive('Gameplay')&&this.scene.session?.tutorial?this.lessons():[];
        body=this.shell('新手訓練場','TUTORIAL SANDBOX',`<section class="panel player">${avatar(character,'idle1',look(this.adapter.current))}<div class="who">${nickname}<small>${characterName(character)} · ${escape(this.item.name)}</small></div><div class="load"><span><span id="loading" role="status">載入中</span><b id="load-pct">0%</b></span><progress class="progress" aria-label="素材載入進度" max="1" value="0"></progress></div><div class="go">${button('start-game','開始遊戲','START',true,'primary','next')}</div></section><div class="sandbox"><span class="label"><i></i>LIVE TRAINING · 自由練習</span><div id="countdown" class="cd"></div></div><div class="lessons"><div class="head"><b>新手訓練清單</b><small>TUTORIAL CHECKLIST</small><span id="tutorial-progress"></span></div><div class="lesson-grid" style="grid-template-columns:repeat(${Math.max(1,lessons.length)},1fr)">${lessons.map(([zh,en,key])=>`<div class="lesson" data-lesson="${zh}"><b>${zh}<small>${en}</small></b><kbd>${key}</kbd><small class="lesson-state">尚未開始</small></div>`).join('')}</div></div>`,'tutorial',who);break;
      }
      case 'P4':body=hud(this.adapter.current?.attackItem??ATTACK_ITEMS[0].src);break;
      case 'P5':{
        const r=this.result,goal=r?.endReason==='goal';
        // NEW RECORD above the best other run on this board, or the first run on an empty board (PO 2026-11-04); P6 does not repeat it.
        const best=r?this.adapter.board(this.tier).find(x=>x.runId!==r.runId)?.score:undefined,record=!!r&&(best===undefined||r.score>best);
        body=this.shell('實驗室 LABORATORY STAGE','SIDE SCROLLING MISSION',`<div class="goal-burst"></div><img class="goal-art" src="${pose(character,goal?'jump':'idle1')}" alt=""><h1 class="goal-title">${goal?'GOAL!':'TIME UP'}</h1><div class="goal-sub"><h2>${goal?'任務完成！':'時間到！'}</h2><small>${goal?'MISSION CLEAR':'CHALLENGE OVER'}</small></div>${panel('本次成績<small>MISSION REPORT</small>',statRow('star','分數','SCORE',(r?.score??0).toLocaleString(),'gold')+statRow('clock',goal?'通關時間':'遊玩時間',goal?'CLEAR TIME':'PLAY TIME',time(r?r.duration-r.remainingTime:0),'',record?'<span class="tag">NEW RECORD</span>':'')+statRow('badge','持有徽章','BADGES HELD',r?.heldBadgeCount??0,'',`<small> / ${this.scene?.level?.badges.length??'—'}</small>`)+statRow('combo','最高連擊','MAX COMBO',r?.playerStatistics.maxCombo??0)+`<div class="report-title">${titleTag((r&&titles(r)[0])||'超新星')}</div><div class="foot"><span>即將進入本場結果 · ${goal?5:3} 秒</span><small>AUTO →</small></div>`,'report')}<div class="actions">${button('goal-retry','再挑戰','RETRY',!this.adapter.replayEnabled,'','retry')}${button('next-stage','下一關','COMING SOON',true,'','next')}${button('exit','返回選單','BACK TO MENU',false,'primary','home')}</div>`,`mission ${goal?'goal':'time-up'}`,who);break;
      }
      case 'P6':{
        const r=this.result!,st=r.playerStatistics,goal=r.endReason==='goal';
        body=this.shell('本場結果','BATTLE RESULT',`<div class="result-columns">${panel('戰鬥數據<small>STATISTICS</small>',`<div class="who">${avatar(character,'idle1',look(this.adapter.current))}<div><strong>${nickname}</strong><small>${characterName(character)} · ${escape(this.item.name)}</small></div></div>`+statRow('badge','持有徽章','BADGES',r.heldBadgeCount)+statRow('skull','擊敗敵人','ENEMY KILLS',st.kills)+statRow('combo','最高連擊','MAX COMBO',st.maxCombo)+statRow('clock',goal?'通關時間':'遊玩時間',goal?'CLEAR TIME':'PLAY TIME',time(r.duration-r.remainingTime))+statRow('bounce','彈跳次數','BOUNCES',st.bounces)+statRow('bolt','攻擊道具擊倒','ITEM KNOCKOUTS',st.bolts),'blue')}${panel('本場結果<small>RESULT</small>',`<div class="verdict"><div class="word ${goal?'':'finished'}">${goal?'CLEAR!':'FINISHED'}<small>MISSION DEBRIEF</small></div>${avatar(character,'attack1',look(this.adapter.current,character,'attack1'))}${titleTag(titleLine(r))}</div><div class="breakdown">${Object.entries(r.scoreBreakdown).map(([k,v])=>statRow('',({enemy:'敵人（含 Combo）',badges:'持有徽章 ×10',goal:'通關',time:'剩餘秒數 ×2',noDrop:'零掉落通關'} as Record<string,string>)[k]??k,'',`+${v.toLocaleString()}`)).join('')}</div><div class="score-box"><span>YOUR SCORE</span><strong class="big-score">${r.score.toLocaleString()}</strong></div>`,'verdict-panel')}${panel(`排行榜<small>${this.tier} S · LOCAL</small>`,this.ranking()+`<div class="rank-foot"><span>角色牆已更新 · ${this.adapter.wall.size} 位</span><span>本機成績</span></div>`,'blue board-panel')}</div><div class="actions">${button('ranking','完整排行','TOP 20',false,'','list')}${button('result','繼續','CONTINUE',false,'primary','next')}</div>`,'',who);break;
      }
      case 'P7':{
        const on=this.adapter.replayEnabled,next=this.adapter.queue[1];
        body=this.boardOpen?this.shell('榮耀排行榜','TOP 20 · LOCAL RECORDS',this.leaderboard()+`<div class="actions">${button('close-ranking','返回','BACK',false,'','exit')}</div>`,'board-screen',who):
          this.shell('再來一場','PLAY AGAIN',`<img class="again-left" src="${look(this.adapter.current,character,'attack1')}" alt=""><img class="again-right" src="/assets/ui/enemy-dog.png" alt=""><section class="panel again"><h1>再來一場？<small>PLAY AGAIN?</small></h1><div class="actions">${button('replay','再玩一場','PLAY AGAIN',!on||!!this.countdownAt,on?'primary':'','retry')}${button('exit','結束','EXIT',false,on?'':'primary','exit')}</div><div class="secondary">${button('ranking','查看排行榜','TOP 20',false,'ghost')}</div></section><div class="next"><div class="lbl">下一位<small>NEXT PLAYER</small></div><span class="arr">»</span>${next?`<img src="${pose(next.characterId)}" alt="">`:''}<strong>${escape(next?.nickname??'目前無玩家等待')}</strong></div>${this.countdownAt?'<div class="modal countdown-layer" role="status"><b id="countdown">3</b></div>':''}`,'replay-screen',who);break;
      }
      default:body=`<div class="screen transparent" data-screen="${this.flow.flow}"></div>`;
    }
    if(this.menu&&this.admin){
      const rows=this.adapter.board(this.tier),day=(r:typeof rows[number])=>r.completedAt?new Date(r.completedAt).toLocaleString('zh-TW',{hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
      const row=(r:typeof rows[number],i:number)=>{const id='delete-'+escape(r.runId),on=this.armed==='delete-'+r.runId;return button(id,on?'再按一次刪除':`${String(i+1).padStart(2,'0')}　${escape(r.nickname)}`,on?'PRESS AGAIN TO DELETE':`${r.score.toLocaleString()} 分 · ${day(r)}`,false,on?'primary':'');};
      body+=`<div class="modal screen" role="dialog" aria-modal="true" aria-label="排行榜管理"><section class="panel menu records"><h2>排行榜管理<small>RECORDS · ${this.tier} 秒 · ${rows.length} 筆 · 本機永久保存</small></h2><div class="record-list">${rows.map(row).join('')||'<p class="empty-state">尚無成績</p>'}</div>${button('clear-records',this.armed==='clear-records'?'再按一次全部清除':'重置全部紀錄',this.armed==='clear-records'?'PRESS AGAIN TO RESET':'RESET ALL TIERS',false,this.armed==='clear-records'?'primary':'','retry')}${button('records-back','返回','BACK',false,'','exit')}</section></div>`;
    }
    else if(this.menu)body+=`<div class="modal screen" role="dialog" aria-modal="true" aria-label="系統選單"><section class="panel menu"><h2>系統選單<small>SYSTEM MENU</small></h2>${['P3','P4','P5','P6','P7'].includes(this.flow.flow)?button('continue','繼續','CONTINUE',false,'primary','next'):''}${this.flow.flow==='P4'?button('restart','重新開始','RESTART',false,'','retry'):''}${button('exit','回到主畫面','HOME',false,'','home')}${this.flow.flow==='P0'?button('settings-replay',`再挑戰：${this.adapter.replayEnabled?'開啟':'關閉'}`,'REPLAY SETTING',false,'','list')+button('settings-time',`遊戲時間：${this.tier} 秒`,'TIME SETTING',false,'','clock')+button('records','排行榜管理','RECORDS',false,'','list'):''}</section></div>`;
    this.ui.innerHTML=body;this.syncCamera();
    // Gameplay screens keep DOM focus off buttons so Z/Enter reach the game, not a focused START.
    if(this.menu||!['P3','P4'].includes(this.flow.flow))focus(this.ui.querySelector<HTMLElement>('.modal.screen')??this.ui,0,this.menu?'continue':this.flow.flow==='P1'?'ready':this.flow.flow==='P5'?'exit':this.flow.flow==='P6'?'result':this.flow.flow==='P7'?'exit':undefined);
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
