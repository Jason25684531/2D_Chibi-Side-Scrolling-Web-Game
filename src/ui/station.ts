import Phaser from 'phaser';
import {GameplayStateMachine,type Flow} from '../core/state';
import {InputAdapter,type Actions,type Pad} from '../input/adapter';
import type {GameplayScene} from '../scenes/gameplay';
import type {GameplayResult} from '../core/session';
import {MockStation,titles} from './mock-station';
import {avatar,button,panel,escape,focus,text,badgeIcon,time} from './components';
import './station.css';

export class StationUI {
  flow=new GameplayStateMachine();adapter=new MockStation();inputAdapter=new InputAdapter();
  tier=90;entered=performance.now();countdownAt=0;menu=false;lastMove=0;testPad:Pad|null=null;
  root:HTMLElement;ui:HTMLElement;progress=new Set<string>();private previous=performance.now();
  result:GameplayResult|null=null;standbyPage=-1;
  constructor(readonly game:Phaser.Game){
    document.body.classList.add('station');
    this.root=document.createElement('div');this.root.id='station-root';
    this.ui=document.createElement('div');this.ui.id='station-ui';
    document.body.append(this.root);this.root.append(document.querySelector('#game')!,this.ui);
    game.registry.set('station',this);this.inputAdapter.attach();
    this.ui.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(b&&!b.disabled)this.act(b.dataset.action!);});
    const resize=()=>{this.root.style.transform=`translate(-50%,-50%) scale(${Math.min(innerWidth/1920,innerHeight/1080)})`;};resize();window.addEventListener('resize',resize);
    game.events.on('poststep',this.update,this);
    game.events.once('destroy',()=>{this.inputAdapter.dispose();window.removeEventListener('resize',resize);game.events.off('poststep',this.update,this);});
    this.render();(window as any).__station=this;
  }
  get scene(){return this.game.scene.getScene('Gameplay') as GameplayScene;}
  go(next:Flow){this.flow.transition(next);this.entered=performance.now();this.countdownAt=0;this.render();}
  start(tutorial=false){
    this.inputAdapter.dispose();this.progress.clear();
    const data={duration:this.tier,sessionId:this.adapter.current!.sessionId,tutorial,flow:this.flow};
    if(this.game.scene.isActive('Gameplay'))this.scene.scene.restart(data);else this.game.scene.start('Gameplay',data);
  }
  stop(){if(this.game.scene.isActive('Gameplay'))this.game.scene.stop('Gameplay');this.inputAdapter.attach();}
  exit(){this.menu=false;this.stop();this.adapter.exit();this.go('P0');if(this.adapter.current)this.go('P1');}
  act(action:string){
    if(this.countdownAt&&this.flow.flow==='P7'&&!this.menu)return;
    if(action==='demo'){this.adapter.enqueue();this.go('P1');}
    if(action==='ready'&&this.adapter.current?.assetState!=='generating'){this.tier=90;this.go('P2');}
    if(action.startsWith('tier-')){this.tier=Number(action.slice(5));this.go('P3');if(this.game.registry.get('assetsReady'))this.start(true);}
    if(action==='continue'){this.menu=false;this.scene.run?.resume();this.scene.fixed?.reset();this.render();}
    if(action==='restart'&&this.flow.flow==='P4'){this.menu=false;this.start();this.render();}
    if(action==='exit')this.exit();
    if(action==='result')this.go('P7');
    if(action==='replay'&&this.adapter.replayEnabled&&this.flow.flow==='P7'){this.countdownAt=performance.now();this.render();}
  }
  input(a:Actions){
    if(a.home||a.pause){this.menu=!this.menu;if(this.menu)this.scene.run?.pause();else this.scene.run?.resume();this.scene.fixed?.reset();this.render();return true;}
    if(a.back&&this.menu){this.menu=false;this.scene.run?.resume();this.scene.fixed?.reset();this.render();return true;}
    if(this.flow.flow==='P7'&&this.countdownAt&&!this.menu)return true;
    if(this.flow.flow==='P3'){
      if(a.move)this.progress.add('移動');if(a.jump)this.progress.add('跳躍');if(a.dash)this.progress.add('衝刺');if(a.throw)this.progress.add('投擲');
    }
    const gameplay=(this.flow.flow==='P3'||this.flow.flow==='P4')&&!this.menu;
    if(!gameplay){
      if(a.move&&(a.movePressed||a.move!==this.lastMove))focus(this.ui.querySelector<HTMLElement>('.modal.screen')??this.ui,a.move);
      if(a.confirm||a.jump)(document.activeElement as HTMLButtonElement)?.click();
      if(a.back&&this.flow.flow==='P2'&&!this.menu)this.go('P1');
    }
    this.lastMove=a.move;return !gameplay;
  }
  update(){
    const now=performance.now(),delta=now-this.previous;this.previous=now;
    if(this.menu){this.entered+=delta;if(this.countdownAt)this.countdownAt+=delta;}
    if(!this.game.scene.isActive('Gameplay'))this.input(this.inputAdapter.sample(this.testPad??Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected)));
    if(this.flow.flow==='P0'&&this.adapter.current)this.go('P1');
    if(this.flow.flow==='P0'){const phase=(now-this.entered)%44000;const page=phase<20000?-1:Math.floor((phase-20000)/8000);if(page!==this.standbyPage){this.standbyPage=page;this.render();}const wall=this.ui.querySelector('.wall');if(wall)wall.scrollLeft=(phase/20000)*Math.max(0,wall.scrollWidth-wall.clientWidth);}
    if(this.flow.flow==='P1'){
      const state=this.adapter.current?.assetState;const b=this.ui.querySelector<HTMLButtonElement>('[data-action=ready]');
      if(b){const wasDisabled=b.disabled;b.disabled=state==='generating';if(wasDisabled&&!b.disabled&&!this.menu)b.focus();}text(this.ui,'readiness',state==='generating'?'角色準備中，請稍候…':state==='ready'?'已就緒':'角色備援模式');
    }
    if(this.flow.flow==='P3'&&!this.menu){
      const loaded=this.game.registry.get('assetsReady');
      if(loaded&&!this.game.scene.isActive('Gameplay'))this.start(true);
      const progress=this.ui.querySelector<HTMLProgressElement>('progress');if(progress)progress.value=this.game.registry.get('loadProgress')??0;
      text(this.ui,'loading',loaded?'所需遊戲素材已載入':this.game.registry.get('loadError')?'素材載入失敗':'載入中');
      if(this.game.scene.isActive('Gameplay')){const s=this.scene;if(s.session.badges.held)this.progress.add('徽章');if(s.enemies.enemies.some(e=>e.defeated))this.progress.add('踩擊');if(s.session.power.kind==='laptop')this.progress.add('筆電');if(s.controller.jumps===2)this.progress.add('雙段跳');}
      text(this.ui,'tutorial-progress',[...this.progress].join(' · ')||'試試移動、跳躍與衝刺');
      if(loaded&&now-this.entered>=8000&&!this.countdownAt)this.countdownAt=now;
      if(this.countdownAt){text(this.ui,'countdown',Math.max(1,Math.ceil((3000-now+this.countdownAt)/1000)));if(now-this.countdownAt>=3000){this.go('P4');this.start();}}
    }
    if(this.flow.flow==='P4'){
      const s=this.scene.session;if(!s)return;
      text(this.ui,'hud-badges',s.badges.held);text(this.ui,'hud-time',time(s.run.remaining));text(this.ui,'hud-score',s.score.total);
      text(this.ui,'hud-combo',s.combo.count>=2?`COMBO ${s.combo.count} ×${s.combo.multiplier}`:'');
      text(this.ui,'hud-power',s.power.kind==='ally'?`ROG ALLY ${Math.ceil(Math.max(0,s.power.expires-s.run.elapsed))}s`:s.power.kind==='laptop'?'LAPTOP ⚡ J 投擲':'');
      if(s.result){
        this.result=s.result;this.adapter.save(s.result);this.scene.finalize();
        if(s.result.endReason==='time-up'&&!this.scene.body.blocked.down){const p=this.scene.respawner.position(this.scene.body.width,this.scene.body.height);this.scene.body.reset(p.x,p.y);this.scene.presentation.update('IDLE',1,1);}
        this.go('P5');
      }
    }
    if(this.flow.flow==='P5'&&!this.menu&&now-this.entered>=(this.result?.endReason==='goal'?5000:3000))this.go('P6');
    if(this.flow.flow==='P7'&&this.countdownAt&&!this.menu){text(this.ui,'countdown',Math.max(1,Math.ceil((3000-now+this.countdownAt)/1000)));if(now-this.countdownAt>=3000){this.go('P4');this.result=null;this.start();}}
  }
  ranking(full=false,tier=this.tier){
    const rows=this.adapter.board(tier),mine=rows.findIndex(r=>r.runId===this.result?.runId);
    const indices=full?Array.from({length:20},(_,i)=>i):[...new Set([0,1,2,3,4,...(mine>=0?[mine-1,mine,mine+1]:[])])].filter(i=>i>=0&&i<rows.length).sort((a,b)=>a-b);
    return `<div class="ranking ${full?'two':''}">${indices.map(i=>{const r=rows[i];return `<div class="rank-row ${r?.runId===this.result?.runId?'you':''}"><b>${i+1}</b><span>${r?escape(r.nickname):'—'}</span><em>${r?r.score:'—'}</em></div>`;}).join('')||'<p>此檔位尚無成績</p>'}</div>`;
  }
  shell(title:string,en:string,body:string,classes=''){
    return `<div class="screen ${classes}" data-screen="${this.flow.flow}"><div class="brand">ROG / FUTURE GAMER</div><h1>${title}</h1><div class="eyebrow">${en}</div>${body}<div class="footer"><span>← → 選擇　ENTER / SPACE 確認　BACKSPACE 返回　H 選單</span><span>本機示範資料 · MOCK</span></div></div>`;
  }
  render(){
    const nickname=escape(this.adapter.current?.nickname??'Future Gamer');let body='';
    switch(this.flow.flow){
      case 'P0':body=this.shell('FOR THOSE WHO DARE','FUTURE GAMER / 待機牆',`${this.standbyPage<0?`<div class="wall">${[...this.adapter.wall.values()].map(r=>panel(escape(r.nickname),avatar()+`<p>${escape(r.titles[0])}</p>`)).join('')||panel('成為下一位 Future Gamer',avatar()+'<p>目前沒有玩家排隊</p>')}</div>`:panel(`TOP 20 / ${[60,90,120][this.standbyPage]} 秒`,this.ranking(true,[60,90,120][this.standbyPage]))}<div class="actions">${button('demo','加入示範佇列','DEMO QUEUE')}</div>`);break;
      case 'P1':body=this.shell('準備開始','READY TO PLAY',`<div class="hero">${avatar()}<h2>${nickname}</h2><p id="readiness">角色備援模式</p>${button('ready','開始','START',this.adapter.current?.assetState==='generating')}</div>`);break;
      case 'P2':body=this.shell('選擇遊玩時間','SELECT YOUR TIME',`<div class="triple">${[60,90,120].map((t,i)=>`<button class="tier" data-action="tier-${t}"><strong>${['挑戰','標準','休閒'][i]}</strong><span>${['熟練玩家','一般玩家 · 預設','新手 · 親子'][i]}</span><span class="big-score">${t}<small>秒 / SECONDS</small></span></button>`).join('')}</div>`);break;
      case 'P3':body=this.shell('新手訓練場','TUTORIAL SANDBOX',`<div class="columns">${panel(nickname,avatar()+'<p id="loading">載入中</p><progress class="progress" max="1" value="0"></progress>')}<div class="tutorial-window"></div></div><div class="controls">← → 移動　 SPACE 跳躍／雙段跳　 SHIFT 衝刺　 J 閃電</div><p id="tutorial-progress"></p><div id="countdown" class="countdown"></div>`,'tutorial');break;
      case 'P4':body=`<div class="screen transparent" data-screen="P4"><div class="hud">${panel('BADGE / 徽章',badgeIcon()+' <strong id="hud-badges">0</strong>')}${panel('TIME LEFT / 剩餘時間','<strong id="hud-time"></strong>','timer')}${panel('SCORE / 分數','<strong id="hud-score">0</strong>')}</div><div class="hud-side" id="hud-combo"></div><div class="hud-side hud-power" id="hud-power"></div></div>`;break;
      case 'P5':body=this.shell('','',`<h1 class="end-title">${this.result?.endReason==='goal'?'通關！':'時間到！'}</h1><div class="hero"><h2>${this.result?.endReason==='goal'?'STAGE CLEAR':'TIME UP'}</h2>${avatar()}</div>`);break;
      case 'P6':{
        const r=this.result!,s=r.playerStatistics,t= titles(r);
        const stat=(label:string,value:unknown)=>`<div class="stat"><span>${label}</span><strong>${value}</strong></div>`;
        body=this.shell('本場結果','BATTLE RESULT',`<div class="result-columns">${panel('戰鬥數據 / STATISTICS',stat('持有徽章',r.heldBadgeCount)+stat('擊敗敵人',s.kills)+stat('最高連擊',s.maxCombo)+stat(r.endReason==='goal'?'通關時間':'遊玩時間',time(r.duration-r.remainingTime))+stat('彈跳次數',s.bounces)+stat('獨立麻痺敵人',s.paralyses))}${panel('YOUR SCORE',`<div class="big-score">${r.score}</div>${Object.entries(r.scoreBreakdown).map(([k,v])=>stat(({enemy:'敵人（含 Combo）',badges:'持有徽章 ×10',goal:'通關',time:'剩餘時間',noDrop:'零掉落通關'} as Record<string,string>)[k],`+${v}`)).join('')}<p class="gold">${t.slice(0,3).map(escape).join(' · ')}${t.length>3?' +'+(t.length-3):''}</p>`,'red')}${panel(`排行榜 / ${this.tier} 秒`,this.ranking()+`<p>角色牆已更新 · 今日第 ${this.adapter.wall.size} 位</p><small>本機示範資料</small>`)}</div><div class="actions">${button('result','繼續','CONTINUE')}</div>`);break;
      }
      case 'P7':body=this.shell('再來一場？','PLAY AGAIN?',panel(`TOP 20 / ${this.tier} 秒`,this.ranking(true))+`<div class="actions">${button('replay','再玩一場','PLAY AGAIN',!this.adapter.replayEnabled||!!this.countdownAt)}${button('exit','結束','FINISH')}</div><p>下一位：${escape(this.adapter.queue[1]?.nickname??'目前無玩家等待')}</p>${this.countdownAt?'<div class="modal"><div id="countdown" class="countdown">3</div></div>':''}`);break;
      default:body=this.shell('','', '', 'transparent');
    }
    if(this.menu)body+=`<div class="modal screen"><div class="panel"><h2>系統選單</h2>${['P3','P4','P5','P6','P7'].includes(this.flow.flow)?button('continue','繼續','CONTINUE'):''}${this.flow.flow==='P4'?button('restart','重新開始','RESTART'):''}${button('exit','回到主畫面','HOME')}</div></div>`;
    this.ui.innerHTML=body;focus(this.ui.querySelector<HTMLElement>('.modal.screen')??this.ui,0,this.menu?'continue':this.flow.flow==='P2'?'tier-90':this.flow.flow==='P7'?'exit':undefined);
  }
}
