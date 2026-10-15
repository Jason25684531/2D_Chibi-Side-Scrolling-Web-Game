export type Action = 'left'|'right'|'jump'|'dash'|'throw'|'pause'|'home';
export type Actions = { move: number; jumpHeld: boolean; jump: boolean; dash: boolean; throw: boolean; pause: boolean; home: boolean };
const KEYS: Record<string, Action> = { ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right', Space:'jump', ArrowUp:'jump', ShiftLeft:'dash', ShiftRight:'dash', KeyJ:'throw', Escape:'pause', KeyH:'home' };
export type Pad = { axes: readonly number[]; buttons: readonly { pressed: boolean }[] };
export class InputAdapter {
  previous = new Set<Action>();
  private pending = new Set<Action>();
  readonly codes = new Set<string>();
  private keyDown = (e: KeyboardEvent) => { const action=KEYS[e.code]; if (action) { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)return;e.preventDefault();if(e.repeat)return;if(!Array.from(this.codes).some(code=>KEYS[code]===action))this.pending.add(action);this.codes.add(e.code); } };
  private keyUp = (e: KeyboardEvent) => { this.codes.delete(e.code); };
  private blur = () => {this.codes.clear();this.previous.clear();this.pending.clear();};
  constructor(readonly deadzone = 0.22) {}
  attach() { window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp);window.addEventListener('blur',this.blur); }
  dispose() { window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp);window.removeEventListener('blur',this.blur);this.blur(); }
  clear() { this.pending.clear(); }
  sample(pad?: Pad | null): Actions {
    const now = new Set(Array.from(this.codes,code=>KEYS[code]));
    const press = (i: number) => pad?.buttons[i]?.pressed ?? false;
    if ((pad?.axes[0] ?? 0) < -this.deadzone || press(14)) now.add('left');
    if ((pad?.axes[0] ?? 0) > this.deadzone || press(15)) now.add('right');
    for (const [i, action] of [[1,'jump'],[3,'dash'],[2,'throw'],[9,'pause'],[8,'home']] as const) if (press(i)) now.add(action);
    const edge = (action: Action) => this.pending.has(action) || (now.has(action) && !this.previous.has(action));
    const value = { move: Number(now.has('right')) - Number(now.has('left')), jumpHeld: now.has('jump'), jump:edge('jump'), dash:edge('dash'), throw:edge('throw'), pause:edge('pause'), home:edge('home') };
    this.previous = now; this.pending.clear(); return value;
  }
}
