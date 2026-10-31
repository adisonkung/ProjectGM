/** Presentation-only board-cell motion. Never supplied to occupancy, targeting or melee contact. */
export const AEGIS_BEAM_MOTION = { recoil: .16, holdUntil: 2.55, returnUntil: 3.25, cells: 2 } as const;
export interface GuardianPose { forward: number; walking: boolean }
export function guardianPose(sprite: string | undefined, sinceRelease?: number): GuardianPose {
  if (sprite !== 'enemy-aegis-sentinel.png' && sprite !== 'enemy-jadecrest-guardian.png') return {forward:0,walking:false};
  if (sprite !== 'enemy-aegis-sentinel.png' || sinceRelease == null || sinceRelease < 0) return {forward:1,walking:false};
  const m=AEGIS_BEAM_MOTION;
  if (sinceRelease < m.recoil) {
    const t=sinceRelease/m.recoil, ease=1-Math.pow(1-t,3);
    return {forward:1-m.cells*ease,walking:false};
  }
  if (sinceRelease < m.holdUntil) return {forward:1-m.cells,walking:false};
  if (sinceRelease < m.returnUntil) {
    const t=(sinceRelease-m.holdUntil)/(m.returnUntil-m.holdUntil);
    return {forward:1-m.cells*(1-t),walking:true};
  }
  return {forward:1,walking:false};
}
