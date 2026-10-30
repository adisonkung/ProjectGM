import type { FxDef, SheetDef } from './sprites';

const ground = ['jc-charge-under', 'jc-charge-front'];
const tracks = (durationMs: number) => Object.fromEntries(ground.map(n => [n, {
  durationMs, alpha: [[0,0],[120,1],[durationMs-90,1],[durationMs,0]] as [number,number][],
}]));
export const JADECREST_PRESENTATION: Partial<SheetDef> = {
  pixelated: true, hitFlashStrength: .3, preloadFx: ['jc-contact'],
  anchors: { mouth: [132,-152], roarCharge: [105,-115], jadeCore: [-10,-115] },
  statusFx: { broken: { loop: 'jc-core' } }, deathFx: 'jc-death', attackFx: ['jc-claw'],
  monsterFx: {
    stomp: { cast: ground, activate: ['jc-s1-paw','jc-s1-front'], tracks: tracks(1300) },
    pounce: { cast: [...ground,'jc-s2-trail'], activate: ['jc-s2-land','jc-s2-rim','jc-s2-ripple'], tracks: {
      ...tracks(1200), 'jc-s2-trail': { durationMs: 1800, alpha: [[0,0],[1200,0],[1260,.85],[1720,.85],[1800,0]],
        frames: Array.from({length:8},(_,i)=>[1200+i*75,i] as [number,number]),
        motion: Array.from({length:9},(_,i)=>[1200+i*75,0,-360*(i/8)*(1-i/8)] as [number,number,number]),
      },
    } },
    roar: { cast: [...ground,'jc-s3-charge'], activate: ['jc-s3-wave'], tracks: tracks(1050) },
  },
};
export const JADECREST_FX: Record<string,FxDef> = {
  'jc-charge-under': { file: 'fx-jadecrest-charge-under.png',frames: 60,w: 360,h: 270,frameMs: 30,
    at: 'self',fitCells: 4.8,pivot: [.5,260/384],dy: 27.25,attach: false,layer: 'under' },
  'jc-charge-front': { file: 'fx-jadecrest-charge-front.png',frames: 60,w: 360,h: 270,frameMs: 30,
    at: 'self',fitCells: 4.8,pivot: [.5,260/384],dy: 27.25,attach: false },
  // Original right-facing S1 art on a left-facing enemy. dx follows the actor; mirror only reverses the texture.
  'jc-s1-paw': { file: 'fx-jadecrest-s1-paw.png',frames: 1,w: 180,h: 180,frameMs: 100,fadeOutMs: 140,
    at: 'self',dx: 200,dy: 40,fitCells: 1.9,pivot: [.5,.78],attach: false },
  'jc-s1-front': { file: 'fx-jadecrest-s1-front.png',frames: 5,w: 384,h: 308,frameMs: 160,
    at: 'self',dx: 200,dy: 43,fitCells: 4.5,pivot: [110/640,410/512],mirror: true,attach: false },
  'jc-s2-trail': { file: 'fx-jadecrest-s2-trail.png',frames: 8,w: 280,h: 170,frameMs: 75,
    at: 'self',fitCells: 2.8,pivot: [.85,.5],dy: -85,attach: true,blend: 'add' },
  'jc-s2-land': { file: 'fx-jadecrest-s2-land.png',frames: 8,w: 480,h: 360,frameMs: 100,
    at: 'self',fitCells: 5,pivot: [.5,430/600],dy: 35,attach: false,layer: 'under' },
  'jc-s2-rim': { file: 'fx-jadecrest-s2-rim.png',frames: 8,w: 480,h: 360,frameMs: 100,
    at: 'self',fitCells: 5,pivot: [.5,430/600],dy: 35,attach: false },
  'jc-s2-ripple': { file: 'fx-jadecrest-s2-ripple.png',frames: 24,w: 400,h: 180,frameMs: 100/3,
    at: 'self',fitCells: 4,pivot: [.5,.5],dy: 35,attach: false,blend: 'add' },
  'jc-s3-charge': { file: 'fx-jadecrest-s3-charge.png',frames: 8,w: 180,h: 180,frameMs: 131.25,
    at: 'self',anchor: 'roarCharge',fitCells: 1.6,attach: true },
  'jc-s3-wave': { file: 'fx-jadecrest-s3-wave.png',frames: 36,w: 600,h: 300,frameMs: 30,
    at: 'self',anchor: 'mouth',fitCells: 4.4,pivot: [.1,.5],attach: false },
  'jc-contact': { file: 'fx-jadecrest-hit.png',frames: 8,w: 110,h: 110,frameMs: 40,
    at: 'target',fitCells: .8,dy: -30,blend: 'add' },
  'jc-claw': { file: 'fx-jadecrest-hit.png',frames: 8,w: 110,h: 110,frameMs: 35,
    at: 'self',dx: 110,dy: -15,delayMs: 380,fitCells: .65,blend: 'add' },
  'jc-core': { file: 'fx-jadecrest-break.png',frames: 8,w: 160,h: 160,frameMs: 100,
    at: 'self',anchor: 'jadeCore',fitCells: 1.2,attach: true,blend: 'add' },
  'jc-death': { file: 'fx-jadecrest-death.png',frames: 8,w: 240,h: 260,frameMs: 130,
    at: 'self',dy: -45,delayMs: 950,fitCells: 2.4,attach: true },
};
