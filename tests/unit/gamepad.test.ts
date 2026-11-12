import {it,expect,vi,afterEach,describe} from 'vitest';
import {InputAdapter} from '../../src/input/adapter';
import {FixedStepController} from '../../src/core/fixed-step';
import {rebind,STANDARD,PROFILE_KEY,loadProfiles,saveProfile,profileFor,parseProfile,activePad,type Pad} from '../../src/input/gamepad';

/** Mock pad in the W3C standard layout: 0 Cross, 1 Circle, 2 Square, 3 Triangle, 5 R1, 9 OPTIONS, 12-15 D-pad. */
const pad=(pressed:number[]=[],axes:number[]=[0,0],extra:Partial<Pad>={}):Pad=>({id:'Mock Stick',mapping:'standard',axes,buttons:Array.from({length:16},(_,i)=>({pressed:pressed.includes(i)})),...extra});
const store=(initial?:string)=>{
  const data=new Map<string,string>();if(initial!==undefined)data.set(PROFILE_KEY,initial);
  vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>void data.set(k,v)});loadProfiles(true);return data;
};
afterEach(()=>{vi.unstubAllGlobals();loadProfiles(true);});

describe('keyboard (unchanged)',()=>{
  it('Keyboard Move',()=>{
    const k=new InputAdapter();k.codes.add('ArrowRight');expect(k.sample().move).toBe(1);expect(k.sample().move).toBe(1);
    k.codes.add('KeyA');expect(k.sample().move).toBe(0);k.codes.delete('ArrowRight');expect(k.sample().move).toBe(-1);
  });
  it('Keyboard Jump / Dash',()=>{
    const k=new InputAdapter();k.codes.add('KeyZ');k.codes.add('KeyX');
    expect(k.sample()).toMatchObject({jump:true,dash:true,jumpHeld:true});expect(k.sample()).toMatchObject({jump:false,dash:false,jumpHeld:true});
  });
});
describe('mock gamepad',()=>{
  it('Mock Gamepad Move: D-pad (DP mode), stick axis (LS mode), deadzone, hold',()=>{
    const g=new InputAdapter(.22);
    expect(g.sample(pad([15])).move).toBe(1);expect(g.sample(pad([15])).move).toBe(1);expect(g.sample(pad([14])).move).toBe(-1);
    expect(g.sample(pad([],[-1,0])).move).toBe(-1);expect(g.sample(pad([],[.9,0])).move).toBe(1);
    expect(g.sample(pad([],[.2,0])).move).toBe(0);expect(g.sample(pad([],[-.2,0])).move).toBe(0);
    expect(g.sample(pad([13])).down).toBe(true);expect(new InputAdapter().sample(pad([],[0,1])).down).toBe(true);
  });
  it('Mock Gamepad Jump / Dash and the rest of the default layout match the keyboard',()=>{
    const g=new InputAdapter(),k=new InputAdapter();
    for(const code of ['KeyZ','KeyX','KeyC','Backspace','KeyH','Enter','ArrowRight'])k.codes.add(code);
    const a=g.sample(pad([0,5,2,1,9,3,15]),0);
    expect(a).toMatchObject({jump:true,dash:true,throw:true,back:true,home:true,confirm:true,move:1,jumpHeld:true});
    expect(a).toEqual(k.sample(null,0));
    // Cross must not be confirm: in P3 confirm starts the game.
    expect(new InputAdapter().sample(pad([0])).confirm).toBe(false);
  });
  it('Button Edge Detection: one press, one edge; keyboard and pad on the same action do not double up',()=>{
    const g=new InputAdapter();let edges=0;
    for(let i=0;i<10;i++)edges+=Number(g.sample(pad([0])).jump);
    expect(edges).toBe(1);expect(g.sample(pad()).jump).toBe(false);expect(g.sample(pad([0])).jump).toBe(true);
    const both=new InputAdapter();both.codes.add('KeyZ');expect(both.sample(pad()).jump).toBe(true);expect(both.sample(pad([0])).jump).toBe(false);
  });
  it('UI Navigation: immediate, then repeats after 400 ms every 150 ms; up/down navigate too',()=>{
    const g=new InputAdapter(),right=pad([15]);
    expect(g.sample(right,0).nav).toBe(1);expect(g.sample(right,100).nav).toBe(0);expect(g.sample(right,399).nav).toBe(0);
    expect(g.sample(right,400).nav).toBe(1);expect(g.sample(right,500).nav).toBe(0);expect(g.sample(right,550).nav).toBe(1);
    expect(g.sample(pad(),600).nav).toBe(0);
    // Keyboard: left/right navigate and repeat; ArrowDown and ArrowUp (jump) do not move menu focus.
    const k=new InputAdapter();k.codes.add('ArrowDown');expect(k.sample(null,0).nav).toBe(0);k.codes.clear();k.codes.add('ArrowUp');expect(k.sample(null,10).nav).toBe(0);
    k.codes.clear();k.codes.add('ArrowLeft');expect(k.sample(null,20).nav).toBe(-1);expect(k.sample(null,420).nav).toBe(-1);
    expect(g.sample(pad([12]),700)).toMatchObject({nav:0,navY:-1});expect(g.sample(pad(),710).navY).toBe(0);expect(g.sample(pad([],[0,1]),720)).toMatchObject({nav:0,navY:1});
    expect(g.sample(pad([],[0,1]),1120).navY).toBe(1);expect(g.sample(right,1130)).toMatchObject({nav:1,navY:0});
    // Gameplay parks the repeat: a direction held through a run does not scroll the next menu.
    const held=new InputAdapter();held.sample(right,0);held.navAt=Infinity;expect(held.sample(right,5000).nav).toBe(0);
    expect(held.sample(pad(),5010).nav).toBe(0);expect(held.sample(right,5020).nav).toBe(1);
  });
  it('Disconnect Fallback: held actions release and the keyboard keeps working',()=>{
    const g=new InputAdapter();expect(g.sample(pad([15,0]))).toMatchObject({move:1,jumpHeld:true});
    expect(g.sample(null)).toMatchObject({move:0,jumpHeld:false,jump:false});
    g.codes.add('ArrowLeft');g.codes.add('KeyZ');expect(g.sample(null)).toMatchObject({move:-1,jump:true});
  });
  it('Reconnect: the device is matched by id, not by index',()=>{
    store(JSON.stringify({'Mock Stick':{buttons:{jump:[7]},axisX:0,axisY:1}}));
    const g=new InputAdapter();expect(g.sample(pad([7],[0,0],{index:0,mapping:''})).jump).toBe(true);
    g.sample(null);expect(g.sample(pad([7],[0,0],{index:3,mapping:''})).jump).toBe(true);
  });
  it('a pad button or direction held across dispose / blur does not fire again',()=>{
    vi.stubGlobal('window',{removeEventListener(){}});
    const g=new InputAdapter();g.sample(pad([0,15]),0);g.dispose();expect(g.latch).toBe(true);
    expect(g.sample(pad([0,15]),10)).toMatchObject({jump:false,jumpHeld:true,nav:0,move:1});expect(g.sample(pad([0,15]),5000).nav).toBe(0);
    g.sample(pad(),5010);expect(g.sample(pad([0,15]),5020)).toMatchObject({jump:true,nav:1});
    // No pad on a focused page: nothing can be held, so the press that first reveals the pad works.
    const fresh=new InputAdapter();fresh.latch=true;fresh.sample(null);expect(fresh.sample(pad([0])).jump).toBe(true);
  });
  it('activePad: saved profile first, then standard; nothing while hidden; still read while unfocused (stick-only kiosk)',()=>{
    store(JSON.stringify({Saved:{buttons:{jump:[7]},axisX:0,axisY:1}}));
    const list:(Pad|null)[]=[null,pad([],[0,0],{id:'Raw',mapping:'',connected:true}),pad([],[0,0],{id:'Std',connected:true}),pad([],[0,0],{id:'Saved',mapping:'',connected:true}),pad([],[0,0],{id:'Gone',connected:false})];
    const doc={hidden:false,hasFocus:()=>true};vi.stubGlobal('document',doc);vi.stubGlobal('navigator',{getGamepads:()=>list});
    expect(activePad()?.id).toBe('Saved');list[3]=null;expect(activePad()?.id).toBe('Std');list[2]=null;expect(activePad()).toBeNull();
    list[2]=pad([],[0,0],{id:'Std',connected:true});doc.hidden=true;expect(activePad()).toBeNull();doc.hidden=false;doc.hasFocus=()=>false;expect(activePad()?.id).toBe('Std');
  });
});
describe('Gamepad Profile Loading',()=>{
  it('a saved profile wins over the standard layout',()=>{
    store(JSON.stringify({'Mock Stick':{buttons:{jump:[7],dash:[4,6]},axisX:2,axisY:3,deadzone:.5}}));
    const g=new InputAdapter(.22);
    expect(g.sample(pad([0])).jump).toBe(false);expect(g.sample(pad([7])).jump).toBe(true);expect(g.sample(pad([6])).dash).toBe(true);
    expect(g.sample(pad([],[1,0,0,0])).move).toBe(0);expect(g.sample(pad([],[0,0,.4,0])).move).toBe(0);expect(g.sample(pad([],[0,0,.6,0])).move).toBe(1);
  });
  it('a non-standard device with no saved profile is ignored entirely',()=>{
    store();const g=new InputAdapter(),raw=pad([0,1,2,3,5,9,15],[1,1],{mapping:''});
    expect(profileFor(raw)).toBeNull();
    expect(g.sample(raw,0)).toEqual(new InputAdapter().sample(null,0));
  });
  it('corrupt or malformed stored data is treated as absent',()=>{
    store('{broken');expect(profileFor(pad())).toBe(STANDARD);
    store(JSON.stringify({'Mock Stick':{buttons:{jump:'0'},axisX:0,axisY:1}}));expect(profileFor(pad())).toBe(STANDARD);
    store(JSON.stringify({'Mock Stick':{buttons:{jump:[-1]},axisX:0,axisY:1}}));expect(profileFor(pad())).toBe(STANDARD);
    store(JSON.stringify(['x']));expect(profileFor(pad())).toBe(STANDARD);
    for(const bad of [null,1,{},{buttons:{},axisX:0},{buttons:{},axisX:0,axisY:1.5},{buttons:{},axisX:0,axisY:1,deadzone:2},{buttons:[],axisX:'0',axisY:1}])expect(parseProfile(bad)).toBeNull();
    // An id that collides with Object.prototype must not resolve to a profile.
    store();expect(profileFor(pad([],[0,0],{id:'constructor',mapping:''}))).toBeNull();
  });
  it('saves, reloads and deletes per device id',()=>{
    const data=store(),custom={buttons:{jump:[2]},axisX:0,axisY:1};
    saveProfile('Mock Stick',custom);expect(JSON.parse(data.get(PROFILE_KEY)!)).toEqual({'Mock Stick':custom});
    expect(profileFor(pad())).toEqual(custom);expect(profileFor(pad([],[0,0],{id:'Other'}))).toBe(STANDARD);
    saveProfile('Mock Stick',null);expect(profileFor(pad())).toBe(STANDARD);
    saveProfile('__proto__',custom);expect(profileFor(pad([],[0,0],{id:'__proto__',mapping:''}))).toEqual(custom);
  });
});
it('24Hz Gameplay Regression: 60 fps sampling gives 24 steps/s and a one-frame press is consumed by exactly one step',()=>{
  // Same snapshot pattern as GameplayScene.update: latch the edge per render frame, consume it in the first fixed step.
  const g=new InputAdapter(),fixed=new FixedStepController(24);let pending=false,steps=0,jumps=0,frame=0;
  const render=(p:Pad)=>{const a=g.sample(p,frame++*1000/60);pending||=a.jump;fixed.update(1/60,()=>{steps++;if(pending)jumps++;pending=false;});};
  render(pad([0])); // first frame runs no fixed step: the press must survive until one does
  expect(steps).toBe(0);
  for(let i=1;i<60;i++)render(pad());
  expect(steps).toBe(24);expect(jumps).toBe(1);
  for(let i=0;i<60;i++)render(pad([0])); // held for a whole second: still one more jump only
  expect(steps).toBe(48);expect(jumps).toBe(2);
});
it('keyboard re-press between two samples still moves the menu (real keydown path)',()=>{
  const on:Record<string,(e:unknown)=>void>={};
  vi.stubGlobal('window',{addEventListener:(type:string,f:(e:unknown)=>void)=>{on[type]=f;},removeEventListener(){}});
  for(const name of ['HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','HTMLButtonElement'])vi.stubGlobal(name,class{});
  const k=new InputAdapter(),key=(code:string)=>({code,target:null,preventDefault(){}});k.attach();
  on.keydown(key('ArrowRight'));expect(k.sample(null,0).nav).toBe(1);
  on.keyup(key('ArrowRight'));on.keydown(key('ArrowRight'));expect(k.sample(null,16).nav).toBe(1); // released and pressed again within one frame
  expect(k.sample(null,32).nav).toBe(0);
  on.keyup(key('ArrowRight'));on.keydown(key('ArrowRight'));on.keyup(key('ArrowRight'));expect(k.sample(null,48)).toMatchObject({nav:1,move:1}); // a tap shorter than a frame
  expect(k.sample(null,64)).toMatchObject({nav:0,move:0});
});
it('rebind: a free button moves the action; a taken button swaps the two actions; fixed actions are untouched',()=>{
  expect(rebind(STANDARD,'dash',4).buttons).toMatchObject({dash:[4],jump:[0],home:[9]});
  const swapped=rebind(STANDARD,'dash',0).buttons;expect(swapped).toMatchObject({dash:[0],jump:[5],confirm:[3],home:[9],left:[14]});
  expect(STANDARD.buttons.dash).toEqual([5]); // not mutated
  const g=new InputAdapter();store(JSON.stringify({'Mock Stick':rebind(STANDARD,'dash',0)}));
  expect(g.sample(pad([0]))).toMatchObject({dash:true,jump:false});
});
