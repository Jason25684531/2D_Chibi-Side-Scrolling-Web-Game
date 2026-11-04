import level from '../level/data/level.json';
import items from '../level/data/attack-items.json';
// Runtime cell is 32 px (level JSON uses 64 px), keeping the 960x540 logic view equal to the editor's 1920x1080.
export const TILE=32;
type LevelPhysics={run:number;jump:number;djump:number;gravity:number;dashMult:number;dashTime:number;springH:number};
/** Planning v0.3 §8: jump heights come from v = sqrt(2gh); every value scales by TILE/64. */
export function deriveProfile(p:LevelPhysics,tile=TILE){
  const g=p.gravity*tile/64,v=(cells:number)=>Math.sqrt(2*g*cells*tile);
  return {gravity:g,speed:p.run*tile,jumpSpeed:v(p.jump),doubleJumpSpeed:v(p.djump),bounceSpeed:v(p.springH),
    dashSpeed:p.run*p.dashMult*tile,dashDuration:p.dashTime,terminalSpeed:1600*tile/64,
    groundAcceleration:4200*tile/64,airAcceleration:2800*tile/64};
}
// Rules follow CYBER RUN planning v0.3 (PO decision 2026-11-02); one run length per station, see timeTier.
export const TEST_PROFILE = {
  // timeTier = default run length (PO 2026-11-04: 120 s); operators switch between timeTiers in the P0 system menu (H).
  rulesStatus: 'test-only' as const, timeTier: 120, timeTiers: [60, 90, 100, 120],
  width: 960, height: 540, bodyWidth: TILE*.75, bodyHeight: TILE*2,
  ...deriveProfile(level.physics),
  dashCooldown: .6, coyoteTime: .1, jumpCut: .45, stompBounce: .75,
  deadzone: 0.22, scatterCap: 12, scatterPickupDelay: 0.25, scatterLaunch: 360, scatterSpread: 55, scatterBounce: .4, allySpeed: 1.1, allyAttract: 6*TILE,
  enemyPoints: 20, badgePoints: 10, comboTiers: [1, 1.5, 2, 2.5], shockTime: .6,
  unresolvedRuleIds: ['C3','B10','B11']
};
export type Mode={tag?:string;color?:string;speed:number;range:number;cooldown:number;height:number;lift:number;gravity:number;spin:number;hitbox:number[];pierce?:number;burst?:{size:number[];scale:number;time:number}};
export const ATTACK_ITEMS=items.items;
/** Attack mode from the file-name prefix (A_/B_/C_), planning v0.3 §3.2. Lengths in cells. */
export function weaponMode(src:string):Mode{
  const key=(/^([ABC])_/.exec(src)?.[1]??'default') as keyof typeof items.modes,m=items.modes[key] as Mode&{rangeMult?:number};
  return {...m,range:m.rangeMult?m.rangeMult*items.baseRange:m.range};
}
