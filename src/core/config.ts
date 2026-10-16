// Existing movement/combat tuning is preserved for this integration.
// Scoring, scatter cap and 24Hz are approved by the 2026-10-15 resolution.
// Default tier is 90; station selection supplies 60/90/120 per attempt.
export const TEST_PROFILE = {
  rulesStatus: 'test-only' as const, timeTier: 90, physicsHz: 24, sourceAnimationFps: 12.5,
  width: 960, height: 540, gravity: 1200, bodyWidth: 32, bodyHeight: 48,
  speed: 240, acceleration: 1400, deceleration: 1800, jumpSpeed: 470,
  dashSpeed: 650, dashDuration: 0.18, dashCooldown: 0.65,
  bounceSpeed: 960, deadzone: 0.22, scatterCap: 10, scatterPickupDelay: 0.25,
  allyScale: 1.5, H: 64, throwCooldown: 0.35,
  paralysisDuration: 2, enemyPoints: { melee: 20, ranged: 20, drone: 20 },
  badgePoints: 10, comboTiers: [1, 1.2, 1.5, 2, 2.5],
  unresolvedRuleIds: ['C3','B1','B5','B6','B10','B11']
};
