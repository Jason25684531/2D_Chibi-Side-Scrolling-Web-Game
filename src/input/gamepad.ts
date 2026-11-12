import type {Action} from './adapter';
export type Pad = { id?: string; index?: number; mapping?: string; connected?: boolean; axes: readonly number[]; buttons: readonly { pressed: boolean }[] };
/** action → button indexes, plus the stick axes. Stored per device id; see the diagnostic page (/gamepad.html). */
export type Profile = { buttons: Partial<Record<Action, number[]>>; axisX: number; axisY: number; deadzone?: number };
export const ACTIONS = ['left','right','up','down','jump','dash','throw','confirm','back','home','pause'] as const satisfies readonly Action[];
/**
 * W3C Standard Gamepad positions, used only when the browser itself reports mapping === 'standard'.
 * 0 bottom face (Cross) · 1 right (Circle) · 2 left (Square) · 3 top (Triangle) · 5 R1 · 9 Start/OPTIONS · 12-15 D-pad.
 * Jump doubles as confirm in station menus; `confirm` stays separate because in P3 it starts the game.
 */
export const STANDARD: Profile = { buttons: { jump:[0], back:[1], throw:[2], confirm:[3], dash:[5], home:[9], up:[12], down:[13], left:[14], right:[15] }, axisX: 0, axisY: 1 };
/** Actions the player may rebind in the in-game controls panel. Directions and home stay fixed so the panel can always be reached and left. */
export const REBINDABLE = ['jump','dash','throw','confirm','back'] as const;
/** Bind one button to an action. Whichever rebindable action had that button takes the old one (swap), so no action ends up unbound or doubled. */
export function rebind(p: Profile, action: typeof REBINDABLE[number], button: number): Profile {
  const buttons = { ...p.buttons }, old = buttons[action] ?? [];
  for (const other of REBINDABLE) if (other !== action && buttons[other]?.includes(button)) buttons[other] = [...buttons[other]!.filter(b => b !== button), ...old];
  buttons[action] = [button]; return { ...p, buttons };
}
export const PROFILE_KEY = 'gamepad-profiles';
let cache: Record<string, Profile> | null = null;
const index = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
/** localStorage is a trust boundary: anything malformed is treated as absent. */
export function parseProfile(v: unknown): Profile | null {
  const p = v as Profile;
  if (!p || typeof p !== 'object' || !index(p.axisX) || !index(p.axisY) || !p.buttons || typeof p.buttons !== 'object') return null;
  if (p.deadzone !== undefined && !(typeof p.deadzone === 'number' && p.deadzone >= 0 && p.deadzone < 1)) return null;
  const buttons: Profile['buttons'] = {};
  for (const a of ACTIONS) { const list = p.buttons[a]; if (list === undefined) continue; if (!Array.isArray(list) || !list.every(index)) return null; buttons[a] = [...list]; }
  return { buttons, axisX: p.axisX, axisY: p.axisY, ...(p.deadzone !== undefined ? { deadzone: p.deadzone } : {}) };
}
export function loadProfiles(fresh = false): Record<string, Profile> {
  if (cache && !fresh) return cache;
  cache = Object.create(null) as Record<string, Profile>;
  try { for (const [id, v] of Object.entries(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}') ?? {})) { const p = parseProfile(v); if (p) cache[id] = p; } } catch { /* no storage or broken JSON: no saved profiles */ }
  return cache;
}
/** null removes the saved profile for that device. */
export function saveProfile(id: string, profile: Profile | null) {
  const all = Object.assign(Object.create(null) as Record<string, Profile>, loadProfiles(true)); if (profile) all[id] = profile; else delete all[id];
  localStorage.setItem(PROFILE_KEY, JSON.stringify(all)); cache = null;
}
// The diagnostic page saves from another tab; pick that up without a reload.
if (typeof window !== 'undefined') window.addEventListener?.('storage', e => { if (e.key === PROFILE_KEY) cache = null; });
/** Saved profile for this device id, else the standard layout when the browser vouches for it, else none (device ignored). */
export function profileFor(pad: Pad): Profile | null {
  return (pad.id !== undefined && loadProfiles()[pad.id]) || (pad.mapping === 'standard' ? STANDARD : null);
}
export function padActions(pad: Pad | null | undefined, deadzone: number): Set<Action> {
  const held = new Set<Action>(), p = pad && profileFor(pad);
  if (!pad || !p) return held;
  for (const a of ACTIONS) if (p.buttons[a]?.some(i => pad.buttons[i]?.pressed)) held.add(a);
  const dz = p.deadzone ?? deadzone, x = pad.axes[p.axisX] ?? 0, y = pad.axes[p.axisY] ?? 0;
  if (x < -dz) held.add('left'); if (x > dz) held.add('right'); if (y < -dz) held.add('up'); if (y > dz) held.add('down');
  return held;
}
/**
 * The one pad the game reads this frame: first with a saved profile, else first standard one.
 * Not gated on document.hasFocus(): a stick-only kiosk cannot click the page to give focus back
 * (a camera permission prompt or the address bar taking focus would leave every button dead).
 * Polled every frame and matched by id, so unplug / replug (possibly on another index) needs no bookkeeping.
 * ponytail: one active pad, no per-player routing; add when the station needs two players.
 */
export function activePad(): Pad | null {
  if (typeof document === 'undefined' || document.hidden) return null;
  const pads = Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p?.connected), saved = loadProfiles();
  return pads.find(p => p.id in saved) ?? pads.find(p => p.mapping === 'standard') ?? null;
}
