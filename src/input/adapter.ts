import {padActions,type Pad} from './gamepad';
export type {Pad};
export type Action = 'left'|'right'|'up'|'down'|'jump'|'dash'|'throw'|'pause'|'home'|'confirm'|'back';
export type Actions = { move: number; movePressed?:boolean; /** Menu direction (nav left/right, navY stick up/down): fires on change, then repeats while held. */ nav?:number; navY?:number; jumpHeld: boolean; jump: boolean; down: boolean; dash: boolean; throw: boolean; pause: boolean; home: boolean; confirm:boolean; back:boolean };
const KEYS: Record<string, Action> = { ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right', Space:'jump', ArrowUp:'jump', ShiftLeft:'dash', ShiftRight:'dash', KeyJ:'throw', Escape:'pause', KeyH:'home',
  KeyZ:'jump', KeyX:'dash', KeyC:'throw', ArrowDown:'down' }; // planning v0.3 keys: ← → Z X C ↓
KEYS.Enter='confirm';KEYS.Backspace='back';
export class InputAdapter {
  previous = new Set<Action>();
  private pending = new Set<Action>();
  readonly codes = new Set<string>();
  /** Set after a blur or on a fresh adapter: pad buttons already held then must not fire again (one press, one action). */
  latch = false;
  /** Next menu repeat. Gameplay sets Infinity so a direction held through a run does not start scrolling a menu. */
  navAt = 0;
  private navDir = 0;
  private keyDown = (e: KeyboardEvent) => {
    const action=KEYS[e.code];
    if(!action||e.isComposing||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement)return;
    e.preventDefault();if(e.repeat)return;
    // Activate the focused button now: a render before the next frame can move
    // focus from Replay to Exit. Queuing only "confirm" would click that new target.
    if(e.target instanceof HTMLButtonElement&&(action==='confirm'||action==='jump')){e.target.click();return;}
    if(!Array.from(this.codes).some(code=>KEYS[code]===action))this.pending.add(action);
    this.codes.add(e.code);
  };
  private keyUp = (e: KeyboardEvent) => { if(KEYS[e.code]&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLSelectElement))e.preventDefault();this.codes.delete(e.code); };
  private blur = () => {this.codes.clear();this.previous.clear();this.pending.clear();this.latch=true;};
  constructor(readonly deadzone = 0.22) {}
  attach() { window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp);window.addEventListener('blur',this.blur); }
  dispose() { window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp);window.removeEventListener('blur',this.blur);this.blur(); }
  clear() { this.pending.clear(); }
  sample(pad?: Pad | null, t = performance.now()): Actions {
    const now = new Set(Array.from(this.codes,code=>KEYS[code])), held = padActions(pad, this.deadzone);
    // Latch: held pad buttons count as already pressed. No pad visible: nothing can be held, so just disarm
    // (the press that first reveals a pad to the browser must work).
    const latched = this.latch && !!pad; this.latch = false;
    if (latched) for (const a of held) this.previous.add(a);
    for (const a of held) now.add(a);
    const on = (action: Action) => now.has(action) || this.pending.has(action);
    const edge = (action: Action) => this.pending.has(action) || (now.has(action) && !this.previous.has(action));
    // Vertical menu movement is stick-only: on the keyboard Up is jump/confirm and Down keeps doing nothing in menus.
    // dir: ±1 horizontal, ±2 vertical.
    const move = Number(on('right')) - Number(on('left')), dir = move || 2 * (Number(held.has('down')) - Number(held.has('up'))), movePressed = edge('left') || edge('right');
    let nav = 0;
    if (latched) { this.navDir = dir; this.navAt = Infinity; } // a direction held across the switch does not move the new screen
    else if (dir !== this.navDir || (dir && movePressed)) { nav = dir; this.navDir = dir; this.navAt = t + 400; } // movePressed: a re-press between two samples
    else if (dir && t >= this.navAt) { nav = dir; this.navAt = t + 150; }
    const value = { move, nav: Math.abs(nav) === 1 ? nav : 0, navY: Math.abs(nav) === 2 ? nav / 2 : 0, movePressed, jumpHeld: now.has('jump'), jump:edge('jump'), down:edge('down'), dash:edge('dash'), throw:edge('throw'), pause:edge('pause'), home:edge('home'),confirm:edge('confirm'),back:edge('back') };
    this.previous = now; this.pending.clear(); return value;
  }
}
