import { guardianPose, AEGIS_BEAM_MOTION } from './guardian-motion';
import { FX, SHEETS } from '../../core/data/sprites';
import { fxLength } from './fx-clip';
import { AEGIS_SKILLS } from '../../core/data/aegis-sentinel';

describe('guardian art offset and beam recoil',()=>{
 it('moves only the two requested guardian sprites one cell forward',()=>{
  expect(guardianPose('enemy-aegis-sentinel.png').forward).toBe(1);
  expect(guardianPose('enemy-jadecrest-guardian.png').forward).toBe(1);
  expect(guardianPose('enemy-solar-oculus.png').forward).toBe(0);
 });
 it('recoils exactly two cells, holds throughout the full beam and walks back continuously',()=>{
  const m=AEGIS_BEAM_MOTION;
  expect(guardianPose('enemy-aegis-sentinel.png',0).forward).toBe(1);
  for(const t of [.16,.7,1.5,2.54])expect(guardianPose('enemy-aegis-sentinel.png',t)).toEqual({forward:-1,walking:false});
  expect(guardianPose('enemy-aegis-sentinel.png',2.9).walking).toBeTrue();
  expect(guardianPose('enemy-aegis-sentinel.png',m.returnUntil)).toEqual({forward:1,walking:false});
  for(const t of [m.recoil,m.holdUntil,m.returnUntil])expect(Math.abs(guardianPose('enemy-aegis-sentinel.png',t-.00001).forward-guardianPose('enemy-aegis-sentinel.png',t+.00001).forward)).toBeLessThan(.001);
 });
 it('keeps the beam, muzzle, held firing pose and recovery on the same release clock',()=>{
  expect(fxLength(FX['ae-s2-beam'])).toBeCloseTo(AEGIS_BEAM_MOTION.holdUntil);
  expect(fxLength(FX['ae-s2-muzzle'])).toBeCloseTo(AEGIS_BEAM_MOTION.holdUntil);
  expect(FX['ae-s2-beam'].attach).toBeTrue();expect(FX['ae-s2-muzzle'].attach).toBeTrue();
  expect(SHEETS['enemy-aegis-sentinel.png'].casts!['lance_firing'].ms).toBe(2550);
  expect(AEGIS_SKILLS['aegis_lance'].recovery).toBe(AEGIS_BEAM_MOTION.returnUntil);
 });
});
