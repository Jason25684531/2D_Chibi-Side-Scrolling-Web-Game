import Phaser from 'phaser';
import {GameplayStateMachine,type Flow} from '../core/state';
import {InputAdapter,type Actions,type Pad} from '../input/adapter';
import type {GameplayScene} from '../scenes/gameplay';
import type {GameplayResult} from '../core/session';
import {TEST_PROFILE as P,ATTACK_ITEMS,weaponMode} from '../core/config';
import {asset,characterName,characterIds,characterRole,pose} from '../assets/catalog';
import {MockStation,titles} from './mock-station';
import {avatar,button,panel,escape,focus,text,time,stat,chip,icon,statRow,titleTag,rankRow} from './components';
import './station.css';
import {hud,updateHud} from './hud';
const STEPS=['UC02-1 選擇角色','UC02-2 選擇攻擊道具','UC04-1 輸入暱稱'];
const ATTRACT_IDLE=60000;
const NAV='<span><kbd>← →</kbd>選擇</span><span><kbd>Z / ENTER</kbd>確認</span><span><kbd>BACKSPACE</kbd>返回</span><span><kbd>H</kbd>選單</span>';
const HINTS:Record<string,string>={P0:'<span><kbd>Z / ENTER</kbd>加入示範佇列</span><span><kbd>H</kbd>系統選單</span>',P3:'<span><kbd>← →</kbd>移動</span><span><kbd>Z</kbd>跳躍</span><span><kbd>X</kbd>衝刺</span><span><kbd>C</kbd>投擲</span><span><kbd>H</kbd>選單</span>'};
// Text wordmark only; the slashes are decoration, not the ROG eye (DESIGN.md §8.5).
const BRAND='<div class="brand"><svg class="logo" viewBox="0 0 70 56" aria-hidden="true"><polygon points="4,8 30,8 22,48 0,48"/><polygon points="36,8 70,8 50,48 28,48" opacity=".55"/></svg><div class="wordmark">ROG<span>FUTURE GAMER</span></div>';
/** Rarest three titles plus "+N"; no title shows 「超新星」 (planning v0.3 §3.3). */
const titleLine=(r:GameplayResult)=>{const t=titles(r);return t.length?t.slice(0,3).join(' · ')+(t.length>3?' +'+(t.length-3):''):'超新星';};

export class StationUI {
  flow=new GameplayStateMachine();adapter=new MockStation();inputAdapter=new InputAdapter();
  tier=P.timeTier;entered=performance.now();countdownAt=0;menu=false;lastMove=0;testPad:Pad|null=null;
  root:HTMLElement;ui:HTMLElement;progress=new Set<string>();private previous=performance.now();
  result:GameplayResult|null=null;standbyPage=-1;step=0;idleSince=performance.now();attract=false;
  boardOpen=false;rankPage=0;private returnFocus:string|undefined;
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
  go(next:Flow){this.flow.transition(next);this.entered=this.idleSince=performance.now();this.countdownAt=0;this.boardOpen=false;this.rankPage=0;this.attract=false;if(next==='P1')this.step=0;this.render();}
  start(tutorial=false){
    this.inputAdapter.dispose();this.progress.clear();
    const c=this.adapter.current!,data={duration:this.tier,sessionId:c.sessionId,characterId:c.characterId,attackItem:c.attackItem,tutorial,flow:this.flow};
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
      const id=action.slice(10);if(characterIds.includes(id as typeof characterIds[number])){c.characterId=id;this.render();focus(this.ui,0,action);}return;
    }
    if(action.startsWith('item-')&&this.flow.flow==='P1'){const item=ATTACK_ITEMS[Number(action.slice(5))];if(item){c.attackItem=item.src;this.render();focus(this.ui,0,action);}return;}
    if(action==='ready'&&this.flow.flow==='P1'&&c?.assetState!=='generating'){
      if(this.step<2){this.step++;this.render();return;}
      // UC04-1: 8 characters; P2 has no screen any more (single 100 s run).
      c.nickname=c.nickname.trim().slice(0,8)||c.nickname;this.go('P2');this.go('P3');if(this.game.registry.get('assetsReady'))this.start(true);
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
    if(action==='replay'&&this.adapter.replayEnabled&&this.flow.flow==='P7'){this.countdownAt=performance.now();this.render();}
  }
  input(a:Actions){
    if(document.activeElement instanceof HTMLInputElement)return true;
    if(this.flow.flow==='P0'&&(a.move||a.jump||a.confirm||a.back||a.dash||a.throw||a.home||a.pause)&&this.wake())return true;
    if(a.home||a.pause){if(!this.menu)this.returnFocus=(document.activeElement as HTMLElement)?.dataset.action;this.menu=!this.menu;if(this.menu)this.scene.run?.pause();else this.scene.run?.resume();this.scene.fixed?.reset();this.render();if(!this.menu)focus(this.ui,0,this.returnFocus);return true;}
    if(a.back&&this.menu){this.act('continue');return true;}
    if(a.back&&this.boardOpen){this.act('close-ranking');return true;}
    if(this.flow.flow==='P7'&&this.countdownAt&&!this.menu)return true;
    const gameplay=(this.flow.flow==='P3'||this.flow.flow==='P4')&&!this.menu;
    if(!gameplay){
      if(a.move&&(a.movePressed||a.move!==this.lastMove))focus(this.ui.querySelector<HTMLElement>('.modal.screen')??this.ui,a.move);
      if((a.confirm||a.jump)&&this.ui.contains(document.activeElement))(document.activeElement as HTMLButtonElement)?.click();
      if(a.back&&this.flow.flow==='P1'&&!this.menu&&this.step>0){this.step--;this.render();}
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
      const phase=(now-this.entered)%28000;const page=phase<20000?-1:0;if(page!==this.standbyPage){this.standbyPage=page;this.render();}const wall=this.ui.querySelector('.wall');if(wall)wall.scrollLeft=(phase/20000)*Math.max(0,wall.scrollWidth-wall.clientWidth);
    }
    if(this.flow.flow==='P1'){
      const state=this.adapter.current?.assetState;const b=this.ui.querySelector<HTMLButtonElement>('[data-action=ready]');
      if(b){const wasDisabled=b.disabled;b.disabled=state==='generating';if(wasDisabled&&!b.disabled&&!this.menu)b.focus();}text(this.ui,'readiness',state==='generating'?'角色準備中，請稍候…':state==='ready'?'已就緒':'角色備援模式');
    }
    if(this.flow.flow==='P3'&&!this.menu){
      const loaded=this.game.registry.get('assetsReady');
      if(loaded&&!this.game.scene.isActive('Gameplay'))this.start(true);
      const progress=this.ui.querySelector<HTMLProgressElement>('progress');if(progress)progress.value=this.game.registry.get('loadProgress')??0;
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
      if(loaded&&now-this.entered>=8000&&!this.countdownAt)this.countdownAt=now;
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
    return `${status}<div class="ranking ${full?'full-ranking':''}">${indices.map(i=>{const r=rows[i];return `<div class="rank-row ${r.runId===this.result?.runId?'you':''}" ${r.runId===this.result?.runId?'aria-current="true"':''}><b>${String(i+1).padStart(2,'0')}</b><span title="${escape(r.nickname)}">${escape(r.nickname)}</span><em>${r.score.toLocaleString()}</em></div>`;}).join('')||(this.adapter.storageStatus==='ready'?'<p class="empty-state">尚無成績<br><small>完成挑戰，留下你的第一筆紀錄。</small></p>':'')}</div>`;
  }
  leaderboard(){
    const rows=this.adapter.board(this.tier).slice(0,20);
    return `<div class="leaderboard-layout"><div class="podium">${rows.slice(0,3).map((r,i)=>`<section class="podium-card rank-${i+1}"><span class="podium-rank">0${i+1}</span>${avatar(r.characterId)}<h2 title="${escape(r.nickname)}">${escape(r.nickname)}</h2><strong>${r.score.toLocaleString()}</strong><small>POINTS / ${this.tier}s</small></section>`).join('')||'<div class="podium-empty">THE NEXT LEGEND<br><span>下一個紀錄，由你創造。</span></div>'}</div>${panel(`TOP 20 / ${this.tier} 秒`,this.ranking(true)+`<div class="pagination">${button('page-0','第 1 頁','01 — 10',this.rankPage===0)}${button('page-1','第 2 頁','11 — 20',rows.length<=10||this.rankPage===1)}</div>`,'leaderboard-table')}</div>`;
  }
  /** Shared v2 frame: brand + stage name + status chips on top, key hints at the bottom. */
  shell(title:string,en:string,body:string,classes='',chips=''){
    return `<div class="screen ${classes}" data-screen="${this.flow.flow}"><i class="floor"></i><header class="top">${BRAND}${title?`<div class="stage-name">${title}<small>${en}</small></div>`:''}</div><div class="status">${chips}</div></header>${body}<div class="hints">${HINTS[this.flow.flow]??NAV}</div><div class="hints-right">Republic of Gamers · 本機成績 · 示範排隊</div></div>`;
  }
  get item(){return ATTACK_ITEMS.find(i=>i.src===this.adapter.current?.attackItem)??ATTACK_ITEMS[0];}
  /** UC02-1 → UC02-2 → UC04-1; every step defaults so three confirms start the run. */
  readiness(){
    const c=this.adapter.current,character=c?.characterId??'a',steps=`<ol class="steps">${STEPS.map((s,i)=>`<li data-state="${i<this.step?'done':i===this.step?'active':'todo'}">${s}</li>`).join('')}</ol>`;
    const next=button('ready',this.step<2?'下一步':'開始任務',this.step<2?'NEXT':'START MISSION',c?.assetState==='generating');
    let body='';
    if(this.step===0)body=`<div class="selection-layout"><div class="character-grid">${characterIds.map((id,i)=>`<button class="character-card ${character===id?'selected':''}" aria-pressed="${character===id}" data-action="character-${id}"><span class="card-index">0${i+1}</span>${avatar(id)}<strong>${characterName(id)}</strong><small>${character===id?'已選擇 / SELECTED':'可用 / AVAILABLE'}</small></button>`).join('')}</div><div class="character-hero"><span class="hero-ring"></span>${avatar(character)}<div class="hero-name">${characterName(character)}</div><span class="hero-caption">YOUR NEXT CHAPTER STARTS HERE</span></div></div>`;
    if(this.step===1)body=`<div class="item-grid">${ATTACK_ITEMS.map((item,i)=>{const m=weaponMode(item.src),on=c?.attackItem===item.src;return `<button class="item-card ${on?'selected':''}" aria-pressed="${on}" data-action="item-${i}" style="--mode:${m.color??'#ffd54f'}"><img src="${asset('items/攻擊道具/'+item.src)}" alt=""><strong>${escape(item.name)}</strong><small>${escape(item.feat)}</small><em>${m.tag??''}</em></button>`;}).join('')}</div>`;
    if(this.step===2)body=`<div class="name-step">${avatar(character)}<div><label class="name-label" for="nickname">玩家暱稱 / NICKNAME（最多 8 字）</label><input id="nickname" maxlength="8" autocomplete="off" value="${escape(c?.nickname??'')}"><p>預設暱稱已自動產生，可直接開始。</p></div></div>`;
    return this.shell(['選擇你的角色','選擇攻擊道具','輸入暱稱'][this.step],STEPS[this.step],`${steps}${body}<p id="readiness">角色備援模式</p><div class="selection-action">${next}</div>`,'readiness');
  }
  render(){
    const nickname=escape(this.adapter.current?.nickname??'PLYR'),character=this.adapter.current?.characterId??'a';let body='';
    switch(this.flow.flow){
      case 'P0':body=this.shell('FOR THOSE WHO DARE','CYBER RUN / 電域狂奔',`${this.standbyPage<0?`<div class="wall">${[...this.adapter.wall.values()].map(r=>panel(escape(r.nickname),avatar(r.characterId)+`<p>${escape(r.titles[0]??'超新星')}</p>`)).join('')||panel('成為下一位 Future Gamer',avatar()+'<p>目前沒有玩家排隊</p>')}</div>`:panel(`TOP 20 / ${this.tier} 秒`,this.ranking(true))}<div class="actions">${button('demo','加入示範佇列','DEMO QUEUE')}</div>`)+(this.attract?`<video class="attract" src="${'/assets/cyber-run/attract.mp4'}" autoplay muted loop playsinline aria-label="首頁待機巡覽" onerror="this.remove()"></video>`:'');break;
      case 'P1':body=this.readiness();break;
      case 'P3':{const lessons=this.game.scene.isActive('Gameplay')&&this.scene.session?.tutorial?this.lessons():[];body=this.shell('新手訓練場','TRAINING / 框1 AIO・練習',`<div class="columns">${panel(nickname,avatar(character)+'<p id="loading" role="status">載入中</p><progress class="progress" aria-label="素材載入進度" max="1" value="0"></progress>')}<div class="tutorial-window"><span>LIVE TRAINING / 自由練習</span></div></div><div class="lesson-grid" style="grid-template-columns:repeat(${Math.max(1,lessons.length)},1fr)">${lessons.map(([zh,en,key])=>`<div class="lesson" data-lesson="${zh}"><b>${en}</b><span>${key}</span><small class="lesson-state">尚未開始</small></div>`).join('')}</div><p id="tutorial-progress"></p><div id="countdown" class="countdown"></div>`,'tutorial');break;}
      case 'P4':body=hud(this.adapter.current?.attackItem??ATTACK_ITEMS[0].src);break;
      case 'P5':body=this.shell('','',`<div class="mission-layout"><div class="mission-art">${avatar(character)}<h1 class="end-title">${this.result?.endReason==='goal'?'GOAL!':'TIME UP'}</h1><h2>${this.result?.endReason==='goal'?'MISSION CLEAR / 任務完成':'時間到！ / 挑戰結束'}</h2></div>${panel('MISSION REPORT',stat('分數',this.result?.score??0)+stat('持有徽章',this.result?.heldBadgeCount??0)+stat('最高連擊',this.result?.playerStatistics.maxCombo??0)+`<p class="gold">${this.result?escape(titles(this.result)[0]??'超新星'):''}</p><p>即將進入本場結果</p>`)}</div><div class="actions">${button('goal-retry','再挑戰','RETRY',!this.adapter.replayEnabled)}${button('next-stage','下一關','COMING SOON',true)}${button('exit','返回選單','BACK TO MENU')}</div>`,'mission');break;
      case 'P6':{
        const r=this.result!,s=r.playerStatistics;
        body=this.shell('本場結果','BATTLE RESULT / MISSION DEBRIEF',`<div class="result-columns">${panel('戰鬥數據 / STATISTICS',`<div class="result-avatar">${avatar(character)}<span>${nickname}</span></div>`+stat('持有徽章',r.heldBadgeCount)+stat('擊敗敵人',s.kills)+stat('最高連擊',s.maxCombo)+stat(r.endReason==='goal'?'通關時間':'遊玩時間',time(r.duration-r.remainingTime))+stat('彈跳次數',s.bounces)+stat('攻擊道具擊倒',s.bolts))}${panel('YOUR SCORE',`<div class="result-verdict">${r.endReason==='goal'?'CLEAR':'FINISHED'}</div><div class="big-score">${r.score}</div>${Object.entries(r.scoreBreakdown).map(([k,v])=>stat(({enemy:'敵人（含 Combo）',badges:'持有徽章 ×10',goal:'通關',time:'剩餘秒數 ×2',noDrop:'零掉落通關'} as Record<string,string>)[k],`+${v}`)).join('')}<p class="gold">${escape(titleLine(r))}</p>`,'red')}${panel(`排行榜 / ${this.tier} 秒`,this.ranking()+`<p>角色牆已更新 · ${this.adapter.wall.size} 位</p><small>本機成績</small>`)}</div><div class="actions">${button('ranking','完整排行','TOP 20')}${button('result','繼續','CONTINUE')}</div>`);break;
      }
      case 'P7':
        body=this.boardOpen?this.shell('榮耀排行榜','TOP 20 / LOCAL RECORDS',this.leaderboard()+`<div class="actions">${button('close-ranking','返回','BACK')}</div>`,'board-screen'):
          this.shell('再來一場？','PLAY AGAIN?',`<div class="replay-layout"><div class="replay-character">${avatar(character)}</div>${panel('YOUR NEXT RUN',`<div class="replay-title">突破你的<br><span>下一個紀錄。</span></div><p>${nickname} · ${this.tier} 秒挑戰</p><div class="actions">${button('replay','再玩一場','PLAY AGAIN',!this.adapter.replayEnabled||!!this.countdownAt)}${button('exit','結束','FINISH')}</div><div class="replay-secondary">${button('ranking','查看排行榜','TOP 20')}</div>`,'replay-panel')}</div><div class="next-player"><span>NEXT PLAYER / 下一位</span><strong>${escape(this.adapter.queue[1]?.nickname??'目前無玩家等待')}</strong></div>${this.countdownAt?'<div class="modal" role="status"><div id="countdown" class="countdown">3</div></div>':''}`,'replay-screen');break;
      default:body=`<div class="screen transparent" data-screen="${this.flow.flow}"></div>`;
    }
    if(this.menu)body+=`<div class="modal screen" role="dialog" aria-modal="true" aria-label="系統選單"><div class="panel"><h2>系統選單</h2>${['P3','P4','P5','P6','P7'].includes(this.flow.flow)?button('continue','繼續','CONTINUE'):''}${this.flow.flow==='P4'?button('restart','重新開始','RESTART'):''}${button('exit','回到主畫面','HOME')}${this.flow.flow==='P0'?button('settings-replay',`再挑戰：${this.adapter.replayEnabled?'開啟':'關閉'}`,'REPLAY SETTING'):''}</div></div>`;
    this.ui.innerHTML=body;focus(this.ui.querySelector<HTMLElement>('.modal.screen')??this.ui,0,this.menu?'continue':this.flow.flow==='P1'?'ready':this.flow.flow==='P6'?'result':this.flow.flow==='P7'?'exit':undefined);
  }
}
