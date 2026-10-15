// All unconfirmed values below belong to a graybox test profile, not the GDD.
// From docs/UX_Q版橫向卷軸_v01_260930.pdf: H = character height (128px@1080 → 64px@540), bounce 6H, badge ×10 (p12 example; C4 sum conflict still open).
// timeTier fixed to 90s by the user (2026-10-15).
export const TEST_PROFILE = {
  rulesStatus: 'test-only' as const, timeTier: 90, physicsHz: 24, sourceAnimationFps: 12.5,
  width: 960, height: 540, gravity: 1200, bodyWidth: 32, bodyHeight: 48,
  speed: 240, acceleration: 1400, deceleration: 1800, jumpSpeed: 470,
  dashSpeed: 650, dashDuration: 0.18, dashCooldown: 0.65,
  bounceSpeed: 960, deadzone: 0.22, scatterCap: 12, scatterPickupDelay: 0.25,
  allyScale: 1.5, H: 64, throwCooldown: 0.35,
  paralysisDuration: 2, enemyPoints: { melee: 10, ranged: 15, drone: 20 },
  badgePoints: 10, comboTiers: [1, 1.25, 1.5, 2, 2.5],
  unresolvedRuleIds: ['C2','C3','C4','C5','B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11']
};
