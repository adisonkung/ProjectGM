// @ts-nocheck — ported as-is from the approved 2.5D animatic (claude.ai artifact "Book of Heroes", user 2026-11-22);
// the scene code is dense three.js and kept close to the reviewed prototype so the look does not drift.
// Game changes: real pull results drive the cards / light colour, a mount() / dispose() lifecycle instead of a page
// script, a cover-fit canvas, several gold cards each with their own tap + intro, and no prototype controls.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

/** one card of the pull, already resolved to display data */
export interface BookCard { star: number; id: string; th: string; en: string; cls: string; epithet: string; quote: string; portrait: string; banner?: string }
/** DOM overlay the component owns (gold-card intro, caption, hint) */
export interface BookOverlay { cine: HTMLElement; cineQuote: HTMLElement; cineBan: HTMLElement; cineImg: HTMLImageElement; cineEp: HTMLElement; cineTh: HTMLElement; cineEn: HTMLElement; cineTap: HTMLElement; cap: HTMLElement; hint: HTMLElement }
export interface BookSceneOptions { cards: BookCard[]; suspense: boolean; overlay: BookOverlay; asset: (key: string) => string; onFinished: () => void }
export interface BookSceneHandle { dispose(): void }
/** textures the animatic declared but never shows: they share one 1 px image */
const BLANK_KEYS = ['bhCharge', 'bhLoop', 'coverInsideHd', 'pageAHd', 'pageBHd', 'pageCHd', 'pageBlankHd', 'astrolabeCore', 'astrolabeInner', 'astrolabeMiddle', 'astrolabeOuter', 'balconyRail', 'domeCeiling', 'floorMarble', 'fxCandleFlame', 'fxPageWisp', 'goldTrim', 'ledgeTrim', 'marbleWhite', 'oculusSky', 'pillarWood', 'shelfWall', 'shelfWallAlt'];
const ART_KEYS = { card: 'card.jpg', card3: 'card3.jpg', glyphs: 'glyphs.webp', burst: 'burst.webp', pillarBlue: 'pillarBlue.webp', pillarGold: 'pillarGold.webp', orbCard: 'orbCard.webp', coverFrontHd: 'coverFrontHd.webp', lSky: 'lSky.webp', plateC: 'plateC.webp', fxRaysB: 'fxRaysB.webp', fxRaysG: 'fxRaysG.webp', fxBurstB: 'fxBurstB.webp', fxBurstG: 'fxBurstG.webp', fxUpgrade: 'fxUpgrade.webp', fxFlareG: 'fxFlareG.webp', bookBack: 'bookBack.webp', bookSpine: 'bookSpine.webp', plateA: 'plateA.webp', circleOuter: 'circleOuter.webp', circleInner: 'circleInner.webp', pageEdgeHd: 'pageEdgeHd.webp', bookCovers: 'bookCovers.webp', bookSpines: 'bookSpines.webp', fxOculusFlare: 'fxOculusFlare.webp' };

export async function mountBookScene(host: HTMLElement, opts: BookSceneOptions): Promise<BookSceneHandle> {
let disposed = false, raf = 0;
const IMG = { ...Object.fromEntries(Object.entries(ART_KEYS).map(([k, f]) => [k, opts.asset(f)])), ...Object.fromEntries(BLANK_KEYS.map(k => [k, opts.asset('blank.webp')])) };
for (const c of opts.cards) IMG['por_' + c.id] = c.portrait;

// ---------------------------------------------------------------- helpers
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), seg = (t, a, b) => clamp((t - a) / (b - a)), lerp = (a, b, p) => a + (b - a) * p;
const eo3 = p => 1 - Math.pow(1 - p, 3), eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const eoBack = p => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const bump = (t, c, w) => { const d = Math.abs(t - c) / w; return d >= 1 ? 0 : (1 - d * d) * (1 - d * d); };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const V = (x, y, z) => new THREE.Vector3(x, y, z), TAU = Math.PI * 2;
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ---------------------------------------------------------------- state + timeline (seconds after the tap)
const TL = { charge: [0, 4.8], trace: [.8, 3.9], shake: [3.9, 4.8], burst: 4.8, open: [90, 90.5], flip: [90.4, 92], write: [92.1, 93], gold: 92.5, lift: [5.1, 5.65], cut: 5.65, cards: [6.0, 7.2] }; // the book never opens in this flow
const TRACE = [.8, 3.9], HOLD = 1.0; // the line takes 3.4 s; action 3 stops halfway for HOLD seconds, shakes, then turns gold
let TS = 3.5; // action 3: the gold burst
function retime() { const off = S.up && S.top === 3 ? HOLD : 0, mid = (TRACE[0] + TRACE[1]) / 2; TS = mid + HOLD;
  Object.assign(TL, { charge: [0, 4.8 + off], trace: [TRACE[0], TRACE[1] + off], shake: [3.9 + off, 4.8 + off], burst: 4.8 + off, lift: [4.8 + off, 5.35 + off], cut: 5.35 + off, cards: [5.7 + off, 6.9 + off] }); }
function traceProg(u) { // an even pace with soft ends; action 3 freezes the line at halfway during the hold
  const dur = TRACE[1] - TRACE[0], half = dur / 2; let t = u - TRACE[0]; if (S.up && S.top === 3 && t > half) t = t < half + HOLD ? half : t - HOLD;
  const q = clamp(t / dur), e = .14; return q < e ? q * q / (2 * e * (1 - e)) : q > 1 - e ? 1 - (1 - q) * (1 - q) / (2 * e * (1 - e)) : (q - e / 2) / (1 - e); }
const TOP_STAR = Math.max(...opts.cards.map(c => c.star)), GOLD_TOP = TOP_STAR >= 3;
const S = { T: 0, intro: 0, tap: null, n: opts.cards.length, top: GOLD_TOP ? 3 : 2, up: GOLD_TOP && opts.suspense, speed: 1, cards: [], once: new Set(), goldTaps: [], cineClosed: [] };
const once = k => S.once.has(k) ? false : (S.once.add(k), true);
const BLUE = new THREE.Color(.45, .95, 2.6), GOLD = new THREE.Color(2.8, 1.75, .45), STARC = { 1: new THREE.Color(.85, .9, 1.1), 2: new THREE.Color(.45, 1.3, .8), 3: new THREE.Color(2.2, 1.5, .5) };
// the cards are the real pull: star decides the frame / aura, every 3★ card waits for its own tap
function makeCards() { S.cards = opts.cards.map(c => ({ star: Math.min(3, c.star), hero: c, tex: null })); }
const goldIdx = () => S.cards.map((c, i) => c.star === 3 ? i : -1).filter(i => i >= 0);

// ---------------------------------------------------------------- renderer + passes
let renderer;
renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); // throws without WebGL: the component falls back to the 2D scene
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);cursor:pointer;touch-action:manipulation'; host.prepend(renderer.domElement);
const bg = new THREE.Scene(), fg = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 16 / 9, .05, 300);
const pmrem = new THREE.PMREMGenerator(renderer); fg.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
const composer = new EffectComposer(renderer);
const bgPass = new RenderPass(bg, camera), fgPass = new RenderPass(fg, camera); fgPass.clear = false; fgPass.clearDepth = true;
const bloom = new UnrealBloomPass(new THREE.Vector2(1280, 720), .55, .5, 1.02);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uDark: { value: 0 }, uFlash: { value: 0 }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uDark, uFlash, uTime; varying vec2 vUv;
    float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - .5; float r = length(d * vec2(1.6, 1.));
      c.rgb *= 1. - smoothstep(.5, 1.15, r) * .5; c.rgb *= 1. - uDark * smoothstep(.1, .75, r);
      c.rgb += uFlash; c.rgb += (rnd(vUv * vec2(1280., 720.) + uTime) - .5) * .03; gl_FragColor = c; }` });
const bokeh = new BokehPass(fg, camera, { focus: 4, aperture: .001, maxblur: .007 }), fxHide = [];
{ const r = bokeh.render.bind(bokeh); bokeh.render = (...a) => { const v = fxHide.map(o => o.visible); fxHide.forEach(o => o.visible = false); r(...a); fxHide.forEach((o, i) => o.visible = v[i]); }; }
composer.addPass(bgPass); composer.addPass(fgPass); composer.addPass(bokeh); composer.addPass(bloom); composer.addPass(grade); composer.addPass(new OutputPass());

// ---------------------------------------------------------------- textures
const loader = new THREE.TextureLoader(), T = {};
await Promise.all(Object.keys(IMG).map(async k => { const t = await loader.loadAsync(IMG[k]); t.colorSpace = k === 'glyphs' ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); T[k] = t; }));
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const glowTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.2, 'rgba(255,255,255,.6)'); r.addColorStop(.5, 'rgba(255,255,255,.15)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
const darkTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(4,2,12,1)'); r.addColorStop(.45, 'rgba(6,3,16,.85)'); r.addColorStop(1, 'rgba(6,3,16,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
const shaftTex = canvasTex(64, 256, (g, w, h) => { const l = g.createLinearGradient(0, 0, w, 0); l.addColorStop(0, 'rgba(255,240,220,0)'); l.addColorStop(.5, 'rgba(255,240,220,1)'); l.addColorStop(1, 'rgba(255,240,220,0)'); g.fillStyle = l; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'destination-in'; const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = v; g.fillRect(0, 0, w, h); });
const sheenTex = canvasTex(256, 256, (g) => { const l = g.createLinearGradient(0, 256, 256, 0); [[0, 'rgba(255,255,255,0)'], [.42, 'rgba(255,120,200,0)'], [.47, 'rgba(255,150,220,.8)'], [.5, 'rgba(255,240,160,.9)'], [.53, 'rgba(140,230,255,.8)'], [.58, 'rgba(160,140,255,0)'], [1, 'rgba(255,255,255,0)']].forEach(([s, c]) => l.addColorStop(s, c)); g.fillStyle = l; g.fillRect(0, 0, 256, 256); });
sheenTex.wrapS = sheenTex.wrapT = THREE.RepeatWrapping;

// ---------------------------------------------------------------- the Astral Archive: a real 3D round library
const hall = new THREE.Group(), low = new THREE.Group(), islands = new THREE.Object3D(), hallFg = new THREE.Group(), lowFg = new THREE.Object3D(); fg.add(hallFg);
fg.fog = new THREE.FogExp2(0x1e1730, .022);
const aniso = renderer.capabilities.getMaxAnisotropy();
function tx(k, o = {}) { const t = T[k].clone(); t.anisotropy = aniso; if (o.rx || o.ry) { t.wrapS = THREE.RepeatWrapping; t.wrapT = o.ry ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.repeat.set(o.rx || 1, o.ry || 1); } if (o.box) { const b = o.box; t.repeat.set((b[2] - b[0]) * (o.rx || 1), b[3] - b[1]); t.offset.set(b[0], 1 - b[3]); } t.needsUpdate = true; return t; }
function alphaBoxes(tex, cols, rows) { // the bounding box of the painted part inside each grid cell (uv space, y down)
  const im = tex.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height, out = [];
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = Math.floor(r * H / rows); y < (r + 1) * H / rows; y += 2) for (let x = Math.floor(q * W / cols); x < (q + 1) * W / cols; x += 2) if (d[(y * W + x) * 4 + 3] > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    out.push([(x0 + 3) / W, (y0 + 3) / H, (x1 - 2) / W, (y1 - 2) / H]); }
  return out;
}
const FLOOR = -2.1, NT = 6, TIER = 2.9, Rk = k => 10.5 - k * .55, TOP = FLOOR + NT * TIER, SEG = 14;
const room = new THREE.Group(); hallFg.add(room);
const roomGold = new THREE.MeshStandardMaterial({ color: 0xc89a55, metalness: 1, roughness: .32, envMapIntensity: 2 });
const darkWood = new THREE.MeshStandardMaterial({ color: 0x24140e, roughness: .75, side: THREE.DoubleSide });
const pillarMat = new THREE.MeshStandardMaterial({ map: tx('pillarWood'), emissiveMap: tx('pillarWood'), emissive: new THREE.Color(.5, .38, .28), emissiveIntensity: .35, roughness: .6, metalness: .1 });
const ledgeTex = (R) => tx('ledgeTrim', { rx: Math.round(TAU * R / 1.35) });
const railBox = alphaBoxes(T.balconyRail, 1, 1)[0];
const shelfKeys = ['shelfWall', 'shelfWallAlt'];
const tiers = [];
for (let k = 0; k < NT; k++) {
  const R = Rk(k), y0 = FLOOR + k * TIER, H = TIER - .45, mats = shelfKeys.map(key => { const t = tx(key); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color(1, .8, .58), emissiveIntensity: .34, roughness: .85, side: THREE.BackSide, envMapIntensity: .15 }); });
  for (let q = 0; q < SEG; q++) {
    const a0 = q / SEG * TAU, m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 10, 1, true, a0, TAU / SEG), mats[(q + k) % 2]); m.position.y = y0 + H / 2; room.add(m);
    const pl = new THREE.Mesh(new THREE.BoxGeometry(.46, H, .34), pillarMat); pl.position.set(Math.sin(a0) * (R - .15), y0 + H / 2, Math.cos(a0) * (R - .15)); pl.lookAt(0, pl.position.y, 0); room.add(pl);
  }
  // the balcony: floor slab, carved front edge, gilded rail
  const r0 = R - 1.05, slab = new THREE.Mesh(new THREE.RingGeometry(r0, R, 96), darkWood); slab.rotation.x = -Math.PI / 2; slab.position.y = y0 + H; room.add(slab);
  const top = slab.clone(); top.position.y = y0 + TIER; room.add(top);
  const front = new THREE.Mesh(new THREE.CylinderGeometry(r0, r0, .45, 96, 1, true), new THREE.MeshStandardMaterial({ map: ledgeTex(r0), emissiveMap: ledgeTex(r0), emissive: new THREE.Color(.6, .45, .3), emissiveIntensity: .3, roughness: .5, metalness: .3, side: THREE.DoubleSide })); front.position.y = y0 + H + .225; room.add(front);
  const railH = .78, rt = tx('balconyRail', { box: railBox, rx: Math.round(TAU * r0 / (railH * (railBox[2] - railBox[0]) / (railBox[3] - railBox[1]) * T.balconyRail.image.width / T.balconyRail.image.height)) });
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(r0 + .02, r0 + .02, railH, 96, 1, true), new THREE.MeshStandardMaterial({ map: rt, alphaTest: .45, emissiveMap: rt, emissive: new THREE.Color(.55, .42, .3), emissiveIntensity: .35, metalness: .5, roughness: .4, side: THREE.DoubleSide })); rail.position.y = y0 + TIER + railH / 2; room.add(rail);
  tiers.push({ mats, y: y0 + H / 2, R });
}
// the dome with its star oculus
const RT = Rk(NT) + .4, domeT = tx('domeCeiling');
const dome = new THREE.Mesh(new THREE.CircleGeometry(RT, 96), new THREE.MeshStandardMaterial({ map: domeT, emissiveMap: domeT, emissive: new THREE.Color(.75, .7, .9), emissiveIntensity: .55, alphaTest: .5, side: THREE.DoubleSide, roughness: .6, metalness: .3 }));
dome.rotation.x = Math.PI / 2; dome.position.y = TOP; room.add(dome);
const skyMat = new THREE.MeshBasicMaterial({ map: tx('oculusSky'), toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.25), fog: false });
const skyDisc = new THREE.Mesh(new THREE.CircleGeometry(RT * .62, 64), skyMat); skyDisc.rotation.x = Math.PI / 2; skyDisc.position.y = TOP + 3; room.add(skyDisc);
const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const t = tx('fxOculusFlare'); t.repeat.set(1 / 4, 1 / 3); return t; })(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false })); flare.position.set(0, TOP + 2.6, 0); flare.scale.setScalar(9); flare.visible = false; room.add(flare);
// the floor: rune circle around the lectern, dark marble beyond
const floorIn = new THREE.Mesh(new THREE.CircleGeometry(3.4, 96), new THREE.MeshStandardMaterial({ map: tx('floorMarble'), roughness: .2, metalness: .05, envMapIntensity: .7 }));
floorIn.rotation.x = -Math.PI / 2; floorIn.position.set(0, FLOOR + .002, -.2); floorIn.receiveShadow = true; room.add(floorIn);
const outerT = tx('marbleWhite', { rx: 7, ry: 7 });
const floorOut = new THREE.Mesh(new THREE.RingGeometry(3.39, 10.6, 128, 1), new THREE.MeshStandardMaterial({ map: outerT, color: 0x7a6c88, roughness: .3, metalness: .05, envMapIntensity: .5, transparent: true, opacity: .46, depthWrite: false }));
{ const uv = floorOut.geometry.attributes.uv, pos = floorOut.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 21 + .5, pos.getY(i) / 21 + .5); } // planar uvs, so the tiling does not swirl
floorOut.rotation.x = -Math.PI / 2; floorOut.position.y = FLOOR; room.add(floorOut);
// a real mirror under the polished marble: shelves, candles and the lectern reflect in the floor
const mirror = new Reflector(new THREE.CircleGeometry(10.6, 96), { textureWidth: 1024, textureHeight: 576, color: 0x8a8090, clipBias: .003 }); mirror.rotation.x = -Math.PI / 2; mirror.position.y = FLOOR - .004; room.add(mirror);
// the lectern: turned white marble with gold rings, a slab on top for the stand
const marbleT = tx('marbleWhite', { rx: 2, ry: 1 });
const lathe = new THREE.LatheGeometry([[0, 0], [1.1, 0], [1.1, .12], [.95, .17], [.95, .27], [.7, .34], [.48, .46], [.36, .6], [.3, .74], [.27, .86], [.3, .96], [.42, 1.0], [.58, 1.06], [.7, .98 + .02]].map(([r, y]) => new THREE.Vector2(r, y)), 96);
const marble = new THREE.MeshStandardMaterial({ map: marbleT, color: 0xc4bcc4, roughness: .32, metalness: .02, envMapIntensity: .55 });
const lect = new THREE.Mesh(lathe, marble); lect.position.set(0, FLOOR, -.2); lect.castShadow = lect.receiveShadow = true; room.add(lect);
for (const [r, y, t] of [[.98, .15, .03], [.31, .78, .025], [.5, 1.02, .02]]) { const g = new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 96), roomGold); g.rotation.x = Math.PI / 2; g.position.set(0, FLOOR + y, -.2); room.add(g); }
const trimT = tx('goldTrim', { rx: 5 }), trimM = new THREE.MeshStandardMaterial({ map: trimT, metalness: .9, roughness: .3, envMapIntensity: 1 });
const slabTop = new THREE.Mesh(new RoundedBoxGeometry(2.95, .13, 1.55, 3, .03), [trimM, trimM, marble, marble, trimM, trimM]); slabTop.position.set(0, -1.06, -.2); slabTop.castShadow = slabTop.receiveShadow = true; room.add(slabTop);
// the astrolabe hovering over the lectern
const astro = new THREE.Group(); astro.position.set(0, 3.7, -.8); room.add(astro);
const ringMat = (k) => { const t = tx(k); t.premultiplyAlpha = true; return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color(.9, .7, .45), emissiveIntensity: .45, alphaTest: .4, premultipliedAlpha: true, metalness: .85, roughness: .3, side: THREE.DoubleSide, envMapIntensity: 2.2 }); };
const AR = [['astrolabeOuter', 3.4], ['astrolabeMiddle', 2.8], ['astrolabeInner', 2.05]].map(([k, s]) => { const pv = new THREE.Group(), m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), ringMat(k)); pv.add(m); astro.add(pv); return pv; });
const coreT = tx('astrolabeCore'); coreT.premultiplyAlpha = true;
const astroCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreT, premultipliedAlpha: true, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.3) })); astroCore.scale.setScalar(.62); astro.add(astroCore);
const astroGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(.35, .5, 1.1), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })); astroGlow.scale.setScalar(2.6); astro.add(astroGlow);
const moon = new THREE.SpotLight(0x9cbcff, 1.1, 0, .32, .7, 0); moon.position.set(0, TOP, -.2); moon.target.position.set(0, FLOOR, -.2); fg.add(moon, moon.target);
// candle flames along every balcony (painted flame sheet, billboards with depth)
const flameSheet = T.fxCandleFlame, wallFlames = [];
for (let k = 0; k < NT; k++) for (let q = 0; q < 12; q++) {
  const a = (q + .5) / 12 * TAU + k * .21, r = Rk(k) - 1.0, y = FLOOR + k * TIER + TIER + .92, t = flameSheet.clone(); t.repeat.set(1 / 4, 1 / 2); t.needsUpdate = true;
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.6, 1.25, .9) })); f.position.set(Math.sin(a) * r, y, Math.cos(a) * r); f.scale.set(.16, .32, 1); room.add(f);
  const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(.55, .3, .12) })); h.position.copy(f.position); h.scale.setScalar(1.1); room.add(h);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(.035, .04, .22, 10), new THREE.MeshStandardMaterial({ color: 0xe8dcc4, emissive: 0x5a3a20, emissiveIntensity: .6 })); stick.position.set(f.position.x, y - .26, f.position.z); room.add(stick);
  wallFlames.push({ f, t, h, k, ph: hash(k * 31 + q) * 8 });
}
// floating books, built from the supplied covers and spines
const coverBoxes = alphaBoxes(T.bookCovers, 4, 2), spineBoxes = alphaBoxes(T.bookSpines, 8, 1);
const edgeH = T.pageEdgeHd.clone(); edgeH.needsUpdate = true; const edgeR = T.pageEdgeHd.clone(); edgeR.center.set(.5, .5); edgeR.rotation = Math.PI / 2; edgeR.needsUpdate = true;
const pageSide = [new THREE.MeshStandardMaterial({ map: edgeR, color: 0xf0d8a0, roughness: .6 }), new THREE.MeshStandardMaterial({ map: edgeH, color: 0xf0d8a0, roughness: .6 })];
const bookKinds = coverBoxes.map((b, i) => { const cv = new THREE.MeshStandardMaterial({ map: tx('bookCovers', { box: b }), roughness: .5, metalness: .2, envMapIntensity: .8 }), sp = new THREE.MeshStandardMaterial({ map: tx('bookSpines', { box: spineBoxes[i] }), roughness: .5, metalness: .2, envMapIntensity: .8 });
  return [pageSide[0], sp, pageSide[1], pageSide[1], cv, cv]; });
const flyGeo = new THREE.BoxGeometry(.34, .5, .085);
const FBW = .34, FBH = .5, FBT = .17, FBC = .018, fbPages = new THREE.BoxGeometry(FBW - .02, FBH - .03, FBT - 2 * FBC), fbBoard = new THREE.BoxGeometry(FBW, FBH, FBC), fbSpine = new THREE.CylinderGeometry(FBT / 2, FBT / 2, FBH, 16, 1, false, Math.PI, Math.PI);
function makeFlyBook(k) { const g = new THREE.Group(), [pe0, sp, pe1, , cv] = bookKinds[k], dark = new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: .6 });
  const pages = new THREE.Mesh(fbPages, [pe0, dark, pe1, pe1, dark, dark]); pages.position.x = .01; g.add(pages);
  for (const z of [1, -1]) { const b = new THREE.Mesh(fbBoard, [dark, dark, dark, dark, cv, cv]); b.position.z = z * (FBT / 2 - FBC / 2); g.add(b); }
  const spn = new THREE.Mesh(fbSpine, sp); spn.rotation.y = -Math.PI / 2; spn.position.x = -FBW / 2; g.add(spn); return g; }
const FLY = Array.from({ length: 16 }, (_, i) => { const m = new THREE.Mesh(flyGeo, bookKinds[i % 8]); room.add(m);
  return { m, a: hash(i + 50) * TAU, r: 3.2 + hash(i + 51) * 3.4, y: .2 + hash(i + 52) * 4.2, sp: (.05 + hash(i + 53) * .06) * (i % 3 ? 1 : -1), tilt: hash(i + 54), open: 0 }; });
// light wisps pulled from the shelves into the book while it charges
const wispT = T.fxPageWisp, WISPS = Array.from({ length: 18 }, (_, i) => { const t = wispT.clone(); t.repeat.set(1 / 4, 1 / 2); t.needsUpdate = true;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.4, 1.6, 2.2) })); s.visible = false; room.add(s);
  const a = hash(i + 80) * TAU, k = Math.floor(hash(i + 81) * 3); return { s, t, from: V(Math.sin(a) * (Rk(k) - .3), FLOOR + k * TIER + 1.2 + hash(i + 82), Math.cos(a) * (Rk(k) - .3)), ph: i / 18 }; });
function updateArchive(T2, dt, u, ink, hole) {
  const ch = u == null ? 0 : seg(u, ...TL.charge) * (u < TL.burst ? 1 : 0), boom = u == null ? 0 : bump(u, TL.burst + .2, .6);
  const storm = u == null ? 0 : seg(u, TL.burst, TL.flip[0] + .3) * (1 - seg(u, TL.flip[1] - .2, TL.write[0] + .4));
  const w = u == null ? 0 : seg(u, ...TL.write), lift = u == null ? 0 : seg(u, TL.lift[0], TL.cut + .6);
  AR[0].rotation.set(.35, T2 * .12 * (1 + 6 * storm + 3 * ch), 0); AR[1].rotation.set(T2 * .09 * (1 + 6 * storm + 3 * ch), .6, .2); AR[2].rotation.set(.9, .3, T2 * .16 * (1 + 6 * storm + 3 * ch));
  astro.position.y = 3.7 + Math.sin(T2 * .4) * .08; astroGlow.material.opacity = .35 + .5 * ch + .6 * lift; astroGlow.material.color.copy(u != null && u > TL.write[0] ? ink : BLUE).multiplyScalar(.45);
  tiers.forEach((t, k) => { const lit = clamp(w * 1.4 - k / NT * .9), e = .34 * (1 - .6 * ch) + 1.1 * lit * (1 - seg(u ?? 0, TL.lift[1], TL.cut)) + .5 * boom;
    t.mats.forEach(m => { m.emissiveIntensity = e; m.emissive.setRGB(1, .8, .58).lerp(ink, clamp(lit * .55)); }); });
  wallFlames.forEach(o => { const fr = Math.floor(T2 * 10 + o.ph) % 8; o.t.offset.set((fr % 4) / 4, fr < 4 ? .5 : 0); const lean = ch * .8; o.f.material.rotation = -lean * Math.sign(o.f.position.x) * .5; o.f.material.opacity = o.h.material.opacity = 1 - .5 * ch; });
  FLY.forEach((b, i) => { const sp = b.sp * (1 + 14 * storm) + (b.sp > 0 ? 1 : -1) * .2 * boom; b.a += sp * dt * 6; const r = b.r * (1 - .35 * storm) + 1.5 * boom, y = b.y * (1 - .4 * storm) + .4 * storm + Math.sin(T2 * .6 + i) * .15;
    const front = clamp(Math.cos(b.a) * 2 - 1) * (1 - storm); b.m.position.set(Math.sin(b.a) * r, y + front * 2.4, Math.cos(b.a) * r * .85 - .6 - front * 1.5); b.m.rotation.set(Math.sin(T2 * .3 + i) * .4 + b.tilt, b.a + Math.PI / 2 + storm * T2 * 3, Math.sin(T2 * .4 + i * 2) * .3 + storm * .8); });
  WISPS.forEach(o => { const vis = false; o.s.visible = vis; if (!vis) return; const q = (T2 * .55 + o.ph) % 1, e = eio(q), p = o.from.clone().lerp(hole, e); p.y += Math.sin(q * Math.PI) * 1.4;
    o.s.position.copy(p); const fr = Math.floor(T2 * 12 + o.ph * 8) % 8; o.t.offset.set((fr % 4) / 4, fr < 4 ? .5 : 0); o.s.scale.set(.9 * (1 - .6 * e), .45 * (1 - .6 * e), 1); o.s.material.opacity = ch * Math.sin(q * Math.PI);
    const a = camera.position.clone(); const sa = o.from.clone().project(camera), sb = hole.clone().project(camera); o.s.material.rotation = Math.atan2(sb.y - sa.y, sb.x - sa.x); });
  moon.intensity = 1.1 + 2.5 * lift; skyMat.color.setRGB(1.1, 1.1, 1.25).multiplyScalar(1 + 1.6 * lift);
}

// ---------------------------------------------------------------- lights (foreground only; the paintings are unlit)
const key = new THREE.DirectionalLight(0xffd6a8, 1.45); key.position.set(-2.5, 5.5, 5); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: .5, far: 20 }); key.shadow.bias = -.0006; key.shadow.normalBias = .02;
const rim = new THREE.DirectionalLight(0xb48cff, .55); rim.position.set(2.5, 3, -4);
const hemi = new THREE.HemisphereLight(0x9c8cd8, 0x3a2430, .55);
const bookLight = new THREE.PointLight(0x9ccaff, 0, 7, 1);
fg.add(key, key.target, rim, hemi, bookLight);

// ---------------------------------------------------------------- the book (real geometry, leaning back on a gold stand)
const PW = 1.3, PH = 1.82, TH = .26, NSEG = 22, CW = PW * 1.03, CH = PH * 1.03, CT = .034; // page size, cover board size and thickness
const book = new THREE.Group(); book.position.set(0, -.2, -.15); book.rotation.x = -.62; fg.add(book); key.target = book;
const std = (map, o = {}) => new THREE.MeshStandardMaterial({ map, color: 0xd6ccbc, roughness: .9, metalness: 0, envMapIntensity: .3, ...o });
function mirrored(t) { const c = t.clone(); c.wrapS = THREE.RepeatWrapping; c.repeat.x = -1; c.offset.x = 1; c.needsUpdate = true; return c; }
function leaf(front, back, o = {}) { // a sheet hinged at the spine (local x = 0), bent per vertex column
  const g = new THREE.PlaneGeometry(PW * (o.scale || 1), PH * (o.scale || 1), NSEG, 1); g.translate(PW * (o.scale || 1) / 2, 0, 0);
  const f = new THREE.Mesh(g, std(front, o.mat)), b = new THREE.Mesh(g, std(mirrored(back), { ...o.mat, side: THREE.BackSide }));
  f.castShadow = b.castShadow = true; f.receiveShadow = b.receiveShadow = true;
  const grp = new THREE.Group(); grp.add(f, b); book.add(grp);
  const pos = g.attributes.position, w = PW * (o.scale || 1), ds = w / NSEG;
  return { grp, f, b, set(th, curl = 0, lift = 0) {
    let x = 0, z = 0;
    for (let i = 0; i <= NSEG; i++) {
      if (i) { const s = (i - .5) / NSEG, a = th + curl * Math.sin(th) * (s - .35) * 1.5; x += Math.cos(a) * ds; z += Math.sin(a) * ds; }
      for (const row of [0, 1]) { const k = row * (NSEG + 1) + i; pos.setX(k, x); pos.setZ(k, z + lift); }
    }
    pos.needsUpdate = true; g.computeVertexNormals();
  } };
}
// premium materials: painted gold on the cover becomes real metal, leather gets grain and a soft sheen
function pbrFrom(tex, grain) { // gold paint -> metal + gloss, leather -> rough; brightness -> relief
  const im = tex.image, w = im.width, h = im.height, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const p = g.getImageData(0, 0, w, h).data, rm = g.createImageData(w, h), bm = g.createImageData(w, h);
  for (let i = 0; i < p.length; i += 4) { const r = p[i], gg = p[i + 1], b = p[i + 2], lum = (r * .3 + gg * .59 + b * .11) / 255, gold = clamp(((gg - b) / 255 - .1) * 5) * clamp((lum - .22) * 4), n = (Math.random() - .5) * grain;
    rm.data[i + 1] = 255 * clamp(lerp(.58 + n, .22, gold)); rm.data[i + 2] = 255 * gold; rm.data[i + 3] = 255;
    const v = 255 * clamp(.25 + lum * .55 + gold * .3 + n * .6); bm.data[i] = bm.data[i + 1] = bm.data[i + 2] = v; bm.data[i + 3] = 255; }
  const mk = (d) => { const cc = document.createElement('canvas'); cc.width = w; cc.height = h; cc.getContext('2d').putImageData(d, 0, 0); const t = new THREE.CanvasTexture(cc); t.colorSpace = THREE.NoColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  return { rm: mk(rm), bump: mk(bm) };
}
const grainTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 2600; k++) { const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * 7, v = 100 + rnd() * 60; for (const [dx, dy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) { g.fillStyle = `rgba(${v},${v},${v},.35)`; g.beginPath(); g.ellipse(x + dx, y + dy, r, r * (.5 + rnd() * .5), rnd() * 3, 0, TAU); g.fill(); } }
  const d = g.getImageData(0, 0, w, h); for (let i = 0; i < d.data.length; i += 4) { const n = (rnd() - .5) * 40; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; } g.putImageData(d, 0, 0); });
grainTex.colorSpace = THREE.NoColorSpace; grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping; grainTex.repeat.set(3, 4);
const leatherMat = new THREE.MeshPhysicalMaterial({ color: 0x55201a, roughness: .62, metalness: 0, bumpMap: grainTex, bumpScale: 1.4, sheen: .5, sheenColor: new THREE.Color(0x9a5040), sheenRoughness: .5, clearcoat: .12, clearcoatRoughness: .5, envMapIntensity: .7 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xc09650, metalness: .95, roughness: .28, envMapIntensity: 2 });
const fineGold = new THREE.MeshPhysicalMaterial({ color: 0xe6b866, metalness: 1, roughness: .24, envMapIntensity: 2.6 });
const edgeV = T.pageEdgeHd.clone(); edgeV.center.set(.5, .5); edgeV.rotation = Math.PI / 2; edgeV.needsUpdate = true;
const gilt = (map) => new THREE.MeshStandardMaterial({ map, color: 0xf2cf86, metalness: .78, roughness: .3, envMapIntensity: 1.4 }); // gilded page edges
const hidden = new THREE.MeshBasicMaterial({ visible: false });
function block() { const m = new THREE.Mesh(new THREE.BoxGeometry(PW, PH, 1), [gilt(edgeV), gilt(edgeV), gilt(T.pageEdgeHd), gilt(T.pageEdgeHd), hidden, leatherMat]); m.castShadow = m.receiveShadow = true; book.add(m); return m; }
const pageZ = (ax) => .035 * Math.pow(Math.sin(Math.PI * clamp(ax / PW)), .7) - .055 * Math.max(0, 1 - ax / .32) ** 2; // an open page arcs up from its outer edge and dives into the gutter
function pageTop(map, side) { // the top sheet of a page block: flat, dipping into the gutter, shaded near the spine
  const g = new THREE.PlaneGeometry(PW, PH, 40, 1); g.translate(side * PW / 2, 0, 0); const pos = g.attributes.position, col = [];
  for (let k = 0; k < pos.count; k++) { const ax = Math.abs(pos.getX(k)), q = Math.max(0, 1 - ax / .36); pos.setZ(k, pageZ(ax)); const sh = (1 - .62 * q * q) * (1 - .14 * Math.pow(ax / PW, 6)); col.push(sh, sh, sh); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, vertexColors: true, color: 0xd6ccbc, roughness: .85, envMapIntensity: .3 })); m.receiveShadow = true; book.add(m); return m;
}
const backMat = new THREE.MeshStandardMaterial({ map: T.bookBack, roughness: .55, metalness: .25, envMapIntensity: 1 }), backCover = new THREE.Mesh(new RoundedBoxGeometry(CW, CH, CT, 3, .01), [leatherMat, leatherMat, leatherMat, leatherMat, leatherMat, backMat]); backCover.position.set(CW / 2, 0, -CT / 2); backCover.castShadow = true; book.add(backCover);
// a rounded spine with raised bands and gold fillets
const spineGrp = new THREE.Group(); book.add(spineGrp);
const SPZ = TH / 2; spineGrp.position.z = SPZ;
{ const R = (TH + 2 * CT) / 2, zc = 0;
  const spT = T.bookSpine.clone(); spT.repeat.set(382 / 1042, 1); spT.offset.set(332 / 1042, 0); spT.needsUpdate = true; // the painted spine strip sits in the middle of the supplied image
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(R, R, CH, 32, 1, false, Math.PI, Math.PI), new THREE.MeshStandardMaterial({ map: spT, roughness: .55, metalness: .25, envMapIntensity: 1 })); sp.position.set(0, 0, zc); sp.castShadow = true; spineGrp.add(sp);
  const ring = (y, r, m) => { const g = new THREE.TorusGeometry(R, r, 10, 40, Math.PI); g.rotateX(Math.PI / 2); g.rotateY(-Math.PI / 2); const t = new THREE.Mesh(g, m); t.position.set(0, y, zc); t.castShadow = true; spineGrp.add(t); };
  // the painted spine carries its own raised bands
  for (const y of [-.86, .86]) ring(y * CH / 2, .007, fineGold);
}
// the front cover: a thick rigid board hinged at the spine, with real metal corners, a raised star and a sapphire
const pbr = pbrFrom(T.coverFrontHd, .1);
const coverFront = new THREE.MeshPhysicalMaterial({ map: T.coverFrontHd, roughnessMap: pbr.rm, metalnessMap: pbr.rm, roughness: 1, metalness: 1, bumpMap: pbr.bump, bumpScale: 2.2, sheen: .45, sheenColor: new THREE.Color(0x9a5040), sheenRoughness: .5, clearcoat: .05, clearcoatRoughness: .6, envMapIntensity: 1.5 });
const coverInside = new THREE.MeshStandardMaterial({ map: T.coverInsideHd, color: 0xd6ccbc, roughness: .75, envMapIntensity: .35 });
const coverGrp = new THREE.Group(); book.add(coverGrp);
const coverBoard = new THREE.Mesh(new RoundedBoxGeometry(CW, CH, CT, 3, .01), [leatherMat, leatherMat, leatherMat, leatherMat, coverFront, coverInside]); coverBoard.position.set(CW / 2, 0, CT / 2); coverBoard.castShadow = coverBoard.receiveShadow = true; coverGrp.add(coverBoard);
const extr = (sh, depth, bev) => new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 3, curveSegments: 24 });
{ const s = .315, sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(s, 0); sh.lineTo(s, -s * .17); sh.quadraticCurveTo(s * .3, -s * .3, s * .17, -s); sh.lineTo(0, -s); sh.closePath();
  const cg = extr(sh, .006, .005), engr = (t) => { const c = t.clone(); c.repeat.set(1 / CW, 1 / CH); c.offset.set(0, 1); c.needsUpdate = true; return c; };
  const cornerMat = new THREE.MeshPhysicalMaterial({ map: engr(T.coverFrontHd), color: 0xffe2b0, metalness: 1, roughness: .32, bumpMap: engr(pbr.bump), bumpScale: 3, envMapIntensity: 2.1 }); // the painted engraving, now on real metal
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const m = new THREE.Mesh(cg, cornerMat); m.scale.set(sx, sy, 1); m.position.set(sx > 0 ? .006 : CW - .006, sy > 0 ? CH / 2 - .006 : -CH / 2 + .006, CT); m.castShadow = true; coverGrp.add(m);
    for (const [a, b, r] of [[.075, .075, .022], [.24, .03, .011], [.03, .24, .011]]) { const st = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), fineGold); st.scale.z = .55; st.position.set(m.position.x + sx * a, m.position.y - sy * b, CT + .011); coverGrp.add(st); }
  } }
const EM = V(CW / 2, CH * (.5 - 655 / 1434), CT); // emblem centre, measured on the cover painting
{ // faceted four-point star: every arm has a ridge, like hammered gold
  const tips = [[0, .555], [.35, 0], [0, -.64], [-.35, 0]], wi = .066, hgt = .055, P = [], ap = [0, 0, hgt];
  for (let k = 0; k < 4; k++) { const [tx, ty] = tips[k], [nx, ny] = tips[(k + 1) % 4], ix = (Math.sign(tx) || Math.sign(nx)) * wi, iy = (Math.sign(ty) || Math.sign(ny)) * wi;
    P.push(...ap, ix, iy, .012, tx, ty, 0, ...ap, nx, ny, 0, ix, iy, .012); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
  const star = new THREE.Mesh(g, fineGold.clone()); star.material.flatShading = true; star.position.copy(EM); star.castShadow = true; coverGrp.add(star);
  for (const k of [0, 1, 2, 3]) { const a = Math.PI / 4 + k * Math.PI / 2, sp = new THREE.Mesh(new THREE.ConeGeometry(.018, .11, 4), fineGold); sp.rotation.z = a - Math.PI / 2; sp.position.set(EM.x + Math.cos(a) * .085, EM.y + Math.sin(a) * .085, CT + .006); sp.scale.z = .4; coverGrp.add(sp); }
  for (const r of [.452, .384]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, .0065, 8, 160), fineGold); t.position.copy(EM); t.position.z += .002; coverGrp.add(t); }
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8, d = new THREE.Mesh(new THREE.OctahedronGeometry(.02, 0), fineGold); d.scale.z = .5; d.position.set(EM.x + Math.cos(a) * .418, EM.y + Math.sin(a) * .418, CT + .006); coverGrp.add(d); }
}
coverGrp.children.forEach(c => { if (c !== coverBoard) c.visible = false; }); // the arcane cover carries its own painted filigree
const capGem = new THREE.Mesh(new THREE.SphereGeometry(.05, 32, 20), new THREE.MeshPhysicalMaterial({ color: 0x1b2f8a, emissive: 0x4a72ff, emissiveIntensity: 0, roughness: .04, metalness: .1, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 2.2 }));
capGem.scale.z = .6; capGem.position.set(EM.x, EM.y, CT + .058); capGem.visible = false; coverGrp.add(capGem);

// gold light that runs along the cover's engraved lines, from the central star outwards
const traceTex = (() => {
  const im = T.coverFrontHd.image, W2 = im.width, H2 = im.height, c = document.createElement('canvas'); c.width = W2; c.height = H2; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, W2, H2);
  const px = x.getImageData(0, 0, W2, H2).data, N = W2 * H2, gold = new Float32Array(N), dist = new Float32Array(N).fill(Infinity);
  for (let i = 0; i < N; i++) { const r = px[i * 4], g2 = px[i * 4 + 1], b = px[i * 4 + 2]; gold[i] = clamp((g2 - b - 22) / 40) * clamp((r - 85) / 50); }
  const cx = W2 * .5, cy = H2 * .472, on = i => gold[i] > .25;
  // flood outward along the lines from the star; every island it cannot reach starts from its point nearest the star
  const order = []; for (let i = 0; i < N; i++) if (on(i)) { const ex = Math.hypot((i % W2) - cx, ((i / W2) | 0) - cy); order.push([i, ex]); } order.sort((a, b) => a[1] - b[1]);
  const bfs = (seedI, d0) => { const q = [seedI]; dist[seedI] = d0; let h = 0; while (h < q.length) { const i = q[h++], ix = i % W2, iy = (i / W2) | 0, d = dist[i];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = ix + dx, ny = iy + dy; if (nx < 0 || ny < 0 || nx >= W2 || ny >= H2) continue; const j = ny * W2 + nx; if (!on(j)) continue; const nd = d + (dx && dy ? 1.414 : 1); if (nd < dist[j] - .5) { dist[j] = nd; q.push(j); } } } };
  for (const [i, ex] of order) if (dist[i] === Infinity) bfs(i, ex * 1.05);
  let mx = 0; for (let i = 0; i < N; i++) if (dist[i] < Infinity) mx = Math.max(mx, dist[i]);
  const hf = THREE.DataUtils.toHalfFloat, one = hf(1), data = new Uint16Array(N * 4); // half floats: the front moves smoothly, with no 8-bit steps
  for (let i = 0; i < N; i++) { const y = H2 - 1 - ((i / W2) | 0), o = (y * W2 + (i % W2)) * 4; data[o] = hf(gold[i]); data[o + 1] = dist[i] < Infinity ? hf(dist[i] / mx) : one; data[o + 3] = one; }
  const t = new THREE.DataTexture(data, W2, H2, THREE.RGBAFormat, THREE.HalfFloatType); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; })();
const traceMat = new THREE.ShaderMaterial({ uniforms: { map: { value: traceTex }, prog: { value: 0 }, flash: { value: 0 }, fade: { value: 0 }, colA: { value: BLUE.clone() }, colB: { value: GOLD.clone() }, sw: { value: 0 }, time: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D map; uniform float prog, flash, fade, sw, time; uniform vec3 colA, colB; varying vec2 vUv;
    void main(){ vec4 t = texture2D(map, vUv); float m = t.r, d = t.g; float lit = 1. - smoothstep(prog - .004, prog + .002, d); float head = exp(-abs(d - prog) * 55.) * step(.001, prog) * (1. - step(.999, prog));
      vec3 col = mix(colA, colB, 1. - smoothstep(sw - .02, sw, d)); float mm = smoothstep(.22, .55, m); vec3 base = col / max(col.r, max(col.g, col.b));
      float front = exp(-abs(d - prog) * 140.) * step(.001, prog) * (1. - step(.999, prog)); float shimmer = .92 + .08 * sin(time * 5. - d * 60.);
      vec3 c = base * mm * (lit * 1.18 * shimmer + front * .55) * fade + col * mm * flash * 1.25 * fade; gl_FragColor = vec4(c, 1.); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
const tracePlane = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), traceMat); tracePlane.position.set(CW / 2, 0, CT + .0015); tracePlane.renderOrder = 4; coverGrp.add(tracePlane);

// a satin ribbon marker hanging out of the pages over the stand's lip
{ const pts = [V(.16, -PH / 2 + .06, TH * .62), V(.16, -PH / 2 - .01, TH * .7), V(.165, -PH / 2 - .05, .108), V(.17, -PH / 2 - .1, .09), V(.18, -PH / 2 - .2, .04), V(.19, -PH / 2 - .34, -.04)], cv = new THREE.CatmullRomCurve3(pts), N = 40, Wd = .05, P = [], I = [], UV = [];
  for (let k = 0; k <= N; k++) { const t = k / N, c = cv.getPoint(t); P.push(c.x - Wd / 2, c.y, c.z, c.x + Wd / 2, c.y, c.z); UV.push(0, t, 1, t); if (k < N) { const a = k * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const last = cv.getPoint(1); P.push(last.x, last.y - .035, last.z - .02); const tipI = (N + 1) * 2; I.push(N * 2 + 1, N * 2, tipI); UV.push(.5, 1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
  const rib = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0x8e1424, roughness: .35, sheen: 1, sheenColor: new THREE.Color(0xff8a8a), sheenRoughness: .3, side: THREE.DoubleSide, envMapIntensity: .8 })); rib.castShadow = true; rib.visible = false; /* old open-book marker: the closed floating book has none */ book.add(rib); }
const rightBlock = block(), leftBlock = block(); leftBlock.visible = false;
const rightTop = pageTop(T.pageAHd, 1), leftTop = pageTop(T.pageBlankHd, -1); leftTop.visible = false;
const pageTex = [T.pageAHd, T.pageBHd, T.pageCHd];
const flips = Array.from({ length: 7 }, (_, k) => { const l = leaf(pageTex[k % 3], pageTex[(k + 1) % 3]); l.grp.visible = false; return l; });
const lip = new THREE.Mesh(new THREE.CylinderGeometry(.042, .042, PW * 2.24, 24), goldMat); lip.rotation.z = Math.PI / 2; lip.position.set(0, -PH / 2 - .04, .05); lip.castShadow = true; book.add(lip);
for (const sx of [-1, 1]) {
  const curve = new THREE.CatmullRomCurve3([V(sx * PW * 1.1, -PH / 2 - .04, .05), V(sx * PW * 1.16, -PH * .22, -.1), V(sx * PW * 1.02, PH * .08, -.14), V(sx * PW * .8, PH * .04, -.12), V(sx * PW * .84, -PH * .1, -.1), V(sx * PW * .96, -PH * .06, -.1)]);
  const scroll = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, .022, 10), goldMat); scroll.castShadow = true; book.add(scroll);
  for (const [x, y, z, r] of [[sx * PW * 1.13, -PH / 2 - .04, .05, .06], [sx * PW * .96, -PH * .06, -.1, .035]]) { const f = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), goldMat); f.position.set(x, y, z); book.add(f); }
}
const brace = new THREE.Mesh(new THREE.CylinderGeometry(.026, .05, PH * .78, 14), goldMat); brace.position.set(0, -PH * .12, -.1); brace.castShadow = true; book.add(brace);
const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.06, 0), new THREE.MeshStandardMaterial({ color: 0x9fb8ff, emissive: 0x3346aa, emissiveIntensity: 1.2, metalness: .3, roughness: .05, flatShading: true })); gem.position.set(0, PH * .28, -.11); book.add(gem);
const stand = new THREE.Group(); stand.position.copy(book.position); stand.rotation.copy(book.rotation); fg.add(stand); stand.updateMatrixWorld(); book.updateMatrixWorld();
book.children.filter(c => c.material === goldMat || c === gem).forEach(c => stand.attach(c));
const BOOK_Y = book.position.y, BOOK_RX = book.rotation.x;
const FLOAT_Y = -.02; // the book floats just above the dais in the room painting
const pivot = new THREE.Group(); pivot.position.set(0, FLOAT_Y, -.15); fg.add(pivot); fg.remove(book); pivot.add(book); book.position.set(-PW / 2, 0, -TH / 2); book.rotation.set(0, 0, 0); stand.visible = false;
const shadowCatch = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.5), new THREE.ShadowMaterial({ opacity: .32, depthWrite: false })); shadowCatch.rotation.x = -Math.PI / 2; shadowCatch.position.set(0, -.99 + .004, -.2); shadowCatch.receiveShadow = true; fg.add(shadowCatch);

// ---------------------------------------------------------------- the approved room painting, placed so its empty lectern carries the book
const PLATE_Z = -.8, CAM_Z = 12.65, PLATE_H = 8.05 * (CAM_Z - PLATE_Z) / (CAM_Z + .15), PLATE_W = PLATE_H * T.plateA.image.width / T.plateA.image.height;
const plate = new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W * 1.08, PLATE_H * 1.08), new THREE.MeshBasicMaterial({ map: T.plateA, toneMapped: false, fog: false, color: new THREE.Color(.92, .92, .95) }));
plate.position.set(0, -1.0 + (.627 - .5) * PLATE_H, PLATE_Z); plate.renderOrder = -10; fg.add(plate);
// scene A is the single master painting; only the living parts move, inside the picture itself:
// the candle flames sway and flicker (the painted pixels are displaced, not drawn over), the sky drifts inside the oculus,
// and a soft shimmer moves through the painted moonlight
const CANDLE_PX = [[223, 1118, 1], [282, 1078, 1.1], [333, 1163, .8], [360, 1140, .9], [421, 1262, .6], [446, 1237, .6], [472, 1262, .6], [3193, 1143, 1], [3268, 1082, 1.1], [3331, 1125, .9], [3010, 1262, .6], [3034, 1236, .6], [3059, 1262, .6]];
const skyTex = T.lSky.clone(); skyTex.wrapS = skyTex.wrapT = THREE.MirroredRepeatWrapping; skyTex.needsUpdate = true;
plate.material = new THREE.ShaderMaterial({ uniforms: { map: { value: T.plateA }, sky: { value: skyTex }, time: { value: 0 }, cand: { value: CANDLE_PX.map(([x, y, k]) => new THREE.Vector4(x / 3344, 1 - y / 1882, 15 * k / 3344, 30 * k / 1882)) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D map, sky; uniform float time; uniform vec4 cand[13]; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec2 uv = vUv, duv = vec2(0.); float flick = 0., glow = 0.;
      for (int i = 0; i < 13; i++) { vec4 c = cand[i]; vec2 q = (uv - c.xy) / c.zw; float fi = float(i);
        float n = sin(time * 8.3 + fi * 2.3) * .5 + sin(time * 13.1 + fi * 1.7) * .3 + sin(time * 3.7 + fi * 4.1) * .4;
        float f = exp(-dot(q, q) * 1.6), up = clamp(q.y + .8, 0., 2.);
        duv.x += f * c.z * .22 * n * up; duv.y += f * c.w * .07 * sin(time * 10.7 + fi * 3.);
        flick += f * (.5 + .5 * n); glow += exp(-dot(q, q) * .045) * (.6 + .4 * n); }
      vec3 col = texture2D(map, uv - duv).rgb * vec3(.92, .92, .95);
      col *= 1. + flick * .22; col += vec3(1., .55, .22) * glow * .025;
      vec2 o = (uv - vec2(.5036, 1.0531)) / vec2(.163, .186); float m = 1. - smoothstep(.9, .985, length(o));
      vec2 su = vec2(uv.x * 2.4 + time * .0045, uv.y * 1.6 + sin(time * .04) * .02); vec2 cell = floor(uv * vec2(900., 500.));
      vec3 sk = texture2D(sky, su).rgb * 1.05 + step(.9965, hash(cell)) * (.5 + .5 * sin(time * 3. + hash(cell + 7.) * 40.)) * .8;
      col = mix(col, sk, m);
      vec3 src = texture2D(map, uv).rgb; float lum = dot(src, vec3(.3, .59, .11)), vimg = 1. - uv.y;
      vec2 d = (uv - vec2(.5036, 1.)) * vec2(1.78, 1.); float ang = atan(d.x, -d.y), r = length(d);
      // the painted moonlight: bluish bright streaks below the oculus
      float ray = smoothstep(.02, .16, src.b - max(src.r, src.g) * .82) * smoothstep(.22, .55, lum) * (1. - m) * smoothstep(.7, .45, vimg) * smoothstep(.34, .22, abs(uv.x - .5));
      float sheen = .5 + .5 * sin(r * 34. - time * 1.1 + sin(ang * 9. + time * .2) * 1.5); // light flowing down the beams
      vec2 gc = floor(uv * vec2(700., 394.)); float gh = hash(gc), glit = step(.975, gh) * pow(max(0., sin(time * (1.5 + gh * 3.) + gh * 60.)), 6.);
      // the gold constellations painted on the dome
      float dome = (1. - m) * step(1.18, length(o)) * smoothstep(.4, .3, vimg) * smoothstep(.43, .36, abs(uv.x - .5));
      float hi = clamp((lum - dot(texture2D(map, uv, 3.5).rgb, vec3(.3, .59, .11))) * 5., 0., 1.); float gold = hi * smoothstep(-.06, .08, src.r - src.b) * dome;
      float wave = .5 + .5 * sin(atan(uv.x - .5036, (1. - uv.y) + .05) * 7. - time * .55 + r * 10.);
      col += vec3(1., .8, .45) * gold * (pow(wave, 3.) * .75 + .08 + glit * 1.);
      gl_FragColor = vec4(col, 1.); }`, toneMapped: false, depthWrite: false });
const updatePlate = T2 => { plate.material.uniforms.time.value = T2; };
// scene C (low angle up the tower) as one painting for now, kept in front of the camera
const flareB = flare.material.map, flareG = (() => { const t = T.fxFlareG.clone(); t.repeat.set(1 / 4, 1 / 3); t.needsUpdate = true; return t; })(); fg.add(flare);
const plateCFore = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: { map: { value: T.plateC } }, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; void main(){ vec2 e = (vec2(vUv.x, 1. - vUv.y) - vec2(.5, 1.35)) / vec2(.51, .5); float a = 1. - smoothstep(.985, 1.0, length(e));
    gl_FragColor = vec4(texture2D(map, vUv).rgb * vec3(.95, .95, 1.), a); }` })); plateCFore.renderOrder = 26; plateCFore.visible = false; fg.add(plateCFore); // the dais face, in front of the pillar
const plateC = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: T.plateC, toneMapped: false, fog: false, depthWrite: false, color: new THREE.Color(.95, .95, 1) })); plateC.renderOrder = -30; plateC.visible = false; fg.add(plateC);
const SILVER = new THREE.Color(.72, .78, .95);
const circleMat = k => new THREE.MeshBasicMaterial({ map: T[k], color: SILVER.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
function mkCircle(k, size, y, ratio) { // a flat ellipse facing the camera, squashed like the dais top in the painting; the circle spins inside it
  const g = new THREE.Group(), mat = circleMat(k); mat.map = T[k].clone(); mat.map.center.set(.5, .5); mat.map.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.scale.set(size, size * ratio, 1); m.renderOrder = 3; g.add(m); g.position.set(0, y, -.15); fg.add(g); return { g, m }; }
const ringO = mkCircle('circleOuter', 3.5, FLOAT_Y - 1.02, .2), ringI = mkCircle('circleInner', 2.4, FLOAT_Y - 1.2, .2); // under the book: it floats on the circles // lie flat, parallel to the dais top, so they share the painting's perspective // the big circle rings the foot of the book, the small one lies just above the dais
// books flying in loose loops behind the main book; each follows its own tilted orbit, facing along its path
const FB = Array.from({ length: 7 }, (_, i) => { const m = makeFlyBook((i * 3) % 8); m.scale.setScalar(.95 + hash(i + 330) * .45); fg.add(m);
  return { m, lane: -.55 - i * .42, a0: i / 7 * TAU + hash(i + 300) * .4, rx: 2 + hash(i + 310) * 1.5, ry: .5 + hash(i + 320) * .5, cy: .2 + i * .22 + hash(i + 340) * .3, tilt: (hash(i + 350) - .5) * .6, sp: (.22 + hash(i + 360) * .12) * (i % 3 === 2 ? -1 : 1), flap: hash(i + 370) * TAU }; });
function updateFloatBooks(T2, on, push, spin = 1) { FB.forEach(b => { b.m.visible = on; if (!on) return;
  b.a = (b.a ?? b.a0) + .016 * b.sp * spin; const a = b.a, k = 1 + .6 * push, x = Math.cos(a) * b.rx * k, y = b.cy + Math.sin(a) * b.ry + x * b.tilt * .25 + .8 * push;
  b.m.position.set(x, y, b.lane); // each book keeps its own depth lane behind the main book, so they never pass through each other
  b.m.rotation.set(.18 * Math.sin(T2 * 1.3 + b.flap), .5 * Math.sin(a) * Math.sign(b.sp), .3 * Math.sin(a + b.flap) + b.tilt); }); } // covers mostly toward the camera, swinging as they travel
const bokehTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 62); r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(.72, 'rgba(255,255,255,.7)'); r.addColorStop(.88, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill(); });
function dustLayer(n, z0, z1, size, map, warm, seed) { const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, map, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })); pts.frustumCulled = false; pts.renderOrder = 55; fg.add(pts);
  const P = Array.from({ length: n }, (_, i) => ({ x: (hash(i + seed) - .5), y: hash(i + seed + 1), z: z0 + hash(i + seed + 2) * (z1 - z0), s: .5 + hash(i + seed + 3), ph: hash(i + seed + 4) * TAU }));
  return { pts, pos, col, g, P, warm }; }
const sparkTex = canvasTex(64, 64, (g) => { g.translate(32, 32); const r = g.createRadialGradient(0, 0, 0, 0, 0, 7); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(-32, -32, 64, 64);
  for (const a of [0, Math.PI / 2]) { g.save(); g.rotate(a); const l = g.createLinearGradient(-30, 0, 30, 0); l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(.5, 'rgba(255,255,255,.9)'); l.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = l; g.fillRect(-30, -1, 60, 2); g.restore(); } });
const DUST = [dustLayer(110, -1.2, 1.5, .028, glowTex, [1, .85, .6], 400), dustLayer(55, 1.5, 6, .045, glowTex, [1, .82, .55], 600), dustLayer(22, 6, 10.5, .1, sparkTex, [1, .8, .5], 800)];
function updateDust(T2, on) { DUST.forEach((L, li) => { L.pts.visible = on; if (!on) return; const span = 7 - li * 1.5;
  L.P.forEach((q, i) => { const w = (CAM_Z - q.z) * .55 + 1.5, y = -2.2 + ((q.y * span + T2 * (.05 + .04 * li) * q.s) % span);
    L.pos.set([q.x * w * 2 + Math.sin(T2 * .3 * q.s + q.ph) * .2, y, q.z], i * 3); const k = (li === 2 ? .7 * Math.max(0, Math.sin(T2 * .9 + q.ph * 3)) ** 3 : .5 * (.55 + .45 * Math.sin(T2 * 1.1 + q.ph)));
    L.col.set([L.warm[0] * k, L.warm[1] * k, L.warm[2] * k], i * 3); });
  L.g.attributes.position.needsUpdate = true; L.g.attributes.color.needsUpdate = true; }); }
function updateCircles(T2, u, dt) {
  const up3 = S.up && S.top === 3, fc = S.top === 3 ? GOLD : BLUE; let col = SILVER, a = .95, glowA = .12, spin = 1, out = 0;
  if (u != null) { const tc = up3 && u < TS ? BLUE : fc, tq = seg(u, ...TL.trace), sh = eio(seg(u, ...TL.shake)), hold = up3 ? seg(u, TS - HOLD, TS) * (u < TS ? 1 : 0) : 0;
    col = SILVER.clone().lerp(tc, clamp(tq * 3)); out = seg(u, TL.burst, TL.burst + .45);
    a = (.95 + .25 * hold * (.6 + .4 * Math.sin(T2 * 28))) * (1 - out); glowA = (.12 + 1.1 * sh + (up3 ? .8 * bump(u, TS + .05, .25) : 0)) * (1 - out); spin = 1 + 3 * hold + 7 * sh; }
  const base = col.clone().multiplyScalar(1 / Math.max(col.r, col.g, col.b)); // a clean line colour while tracing; the bloom only comes with the shake
  ringO.g.visible = ringI.g.visible = true; ringO.m.material.map.rotation += dt * .1 * spin; ringI.m.material.map.rotation -= dt * .16 * spin;
  ringO.g.scale.setScalar(1 + .7 * eo3(out)); ringI.g.scale.setScalar(1 + 1.1 * eo3(out));
  ringO.m.material.color.copy(base).multiplyScalar(a).add(col.clone().multiplyScalar(glowA)); ringI.m.material.color.copy(base).multiplyScalar(a * .9).add(col.clone().multiplyScalar(glowA * .9));
}
// ---------------------------------------------------------------- props at many depths (they are what makes the room read as space)
const props = new THREE.Group(); fg.add(props);
const runeTex = canvasTex(1024, 1024, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024); g.translate(512, 512); g.strokeStyle = '#ffe2ac'; g.fillStyle = '#ffe2ac';
  for (const [r, lw] of [[490, 7], [458, 3], [338, 4], [306, 2], [150, 3]]) { g.lineWidth = lw; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); }
  g.lineWidth = 3; for (let k = 0; k < 96; k++) { const a = k / 96 * TAU, r0 = k % 8 ? 466 : 440; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * 484, Math.sin(a) * 484); g.stroke(); }
  g.lineWidth = 2.5; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 306, Math.sin(a) * 306); g.lineTo(Math.cos(a + TAU * 3 / 8) * 306, Math.sin(a + TAU * 3 / 8) * 306); g.stroke(); }
  const gi = T.glyphs.image, cs = gi.width / 5; for (let k = 0; k < 20; k++) { g.save(); g.rotate(k / 20 * TAU); g.drawImage(gi, (k % 5) * cs + cs * .1, Math.floor(k / 5) * cs + cs * .1, cs * .8, cs * .8, -34, -430, 68, 68); g.restore(); } });
const ring = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: runeTex, color: new THREE.Color(1, .8, .5), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, opacity: .3 }));
const ringPivot = new THREE.Group(); ringPivot.position.set(0, FLOOR + .012, -.2); ringPivot.quaternion.setFromUnitVectors(V(0, 0, 1), V(0, 1, 0)); ring.scale.setScalar(.68); ringPivot.add(ring); props.add(ringPivot); ring.renderOrder = 2;
const flameTex = canvasTex(64, 128, (g) => { const r = g.createRadialGradient(32, 84, 2, 32, 74, 46); r.addColorStop(0, 'rgba(255,255,235,1)'); r.addColorStop(.3, 'rgba(255,205,120,.95)'); r.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = r; g.beginPath(); g.ellipse(32, 76, 20, 50, 0, 0, TAU); g.fill(); });
const candleMat = new THREE.MeshStandardMaterial({ color: 0x9c7f62, roughness: .7, emissive: 0x5a2e10, emissiveIntensity: .55 });
const addSprite = (parent, map, color, sx, sy, o = {}) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, opacity: o.opacity ?? 1 })); sp.scale.set(sx, sy, 1); if (o.center) sp.center.set(...o.center); parent.add(sp); return sp; };
const CANDLES = Array.from({ length: 18 }, (_, k) => {
  const a = hash(k + 3) * TAU, r = 2.3 + hash(k + 11) * 3.6; let x = Math.cos(a) * r; const z = Math.sin(a) * r * .8 - .9; if (Math.abs(x) < 1.8 && z > -1.8) x = (x < 0 ? -1 : 1) * (1.8 + hash(k) * 1.2);
  const h = .14 + hash(k + 31) * .18, body = new THREE.Mesh(new THREE.CylinderGeometry(.042, .048, h, 14), candleMat); body.position.set(x, -.1 + hash(k + 21) * 2.7, z); props.add(body);
  const fl = addSprite(body, flameTex, new THREE.Color(2.4, 1.6, .8), .14, .28, { center: [.5, .18] }); fl.position.y = h / 2;
  const halo = addSprite(body, glowTex, new THREE.Color(.9, .52, .22), .75, .75, { opacity: .45 }); halo.position.y = h / 2 + .05;
  return { body, fl, halo, y: body.position.y, h }; });
const warm = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffb06a, .35, 5, 1.5); fg.add(l); return l; });
const crystalMat = new THREE.MeshStandardMaterial({ color: 0xd4e2ff, emissive: 0x2a3d96, emissiveIntensity: .8, metalness: .3, roughness: .06, flatShading: true, envMapIntensity: 1.8 });
const CRYS = Array.from({ length: 0 }, (_, k) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), crystalMat); m.scale.set(.09 + hash(k) * .06, .28 + hash(k + 5) * .2, .09 + hash(k) * .06); props.add(m);
  return { m, gl: addSprite(props, glowTex, new THREE.Color(.35, .55, 1.4), .9, .9, { opacity: .4 }), a: k / 8 * TAU + hash(k) * .5, r: 2.6 + hash(k + 9) * 1.8, y: .3 + hash(k + 19) * 2.2 }; });
// big soft motes close to the lens (left out of the depth render, so the depth of field turns them into round bokeh)
const NB = 46, bPos = new Float32Array(NB * 3), bCol = new Float32Array(NB * 3), bGeo = new THREE.BufferGeometry(); bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3)); bGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
const bokehMotes = new THREE.Points(bGeo, new THREE.PointsMaterial({ size: .32, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); bokehMotes.frustumCulled = false; bokehMotes.renderOrder = 50; props.add(bokehMotes);
// light shafts that hang in the air between the windows and the altar, always turned toward the camera around their own axis
const SHAFTS = [[V(-1.6, TOP, -1.2), V(-.5, FLOOR, -.2), 2.6], [V(1.8, TOP, -.4), V(.7, FLOOR, -.3), 1.9], [V(.2, TOP, 1.6), V(.1, FLOOR, .3), 1.5]].map(([a, b, w], k) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shaftTex, color: new THREE.Color(1, .92, .8), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, opacity: .1, side: THREE.DoubleSide })); m.renderOrder = 3; props.add(m); return { m, a, b, w, k }; });
function orientShaft(sh) { const d = sh.b.clone().sub(sh.a), len = d.length(); d.normalize(); const mid = sh.a.clone().add(sh.b).multiplyScalar(.5), toCam = camera.position.clone().sub(mid);
  const x = new THREE.Vector3().crossVectors(d, toCam).normalize(), z = new THREE.Vector3().crossVectors(x, d).normalize(); sh.m.position.copy(mid); sh.m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, d, z)); sh.m.scale.set(sh.w, len, 1); }
function updateProps(T2, dt, inkCol, glowAmt) {
  CANDLES.forEach((c, k) => { c.body.position.y = c.y + Math.sin(T2 * .7 + k * 1.7) * .06; const f = .85 + .15 * Math.sin(T2 * 11 + k * 3) * Math.sin(T2 * 7.3 + k); c.fl.scale.set(.14 * f, .28 * (2 - f), 1); c.halo.material.opacity = .32 + .14 * f; });
  warm.forEach((l, i) => { const c = CANDLES[i * 5]; l.position.copy(c.body.position); l.intensity = .3 + .08 * Math.sin(T2 * 9 + i * 2); });
  CRYS.forEach((c, k) => { const a = c.a + T2 * .11, front = clamp(Math.sin(a) * 2 - .6); c.m.position.set(Math.cos(a) * c.r, c.y + Math.sin(T2 * .8 + k) * .12 + front * 2.2, Math.sin(a) * c.r * .75 - .7); c.m.rotation.y += dt * .6; c.m.rotation.z = Math.sin(T2 * .5 + k) * .2; c.gl.position.copy(c.m.position); });
  for (let i = 0; i < NB; i++) { const near = i < NB / 2, x = (hash(i) - .5) * (near ? 5 : 9) + Math.sin(T2 * .15 + i) * .3, y = -1.2 + ((hash(i + 7) * 4 + T2 * .05 * (.5 + hash(i + 3))) % 4), z = near ? 1.6 + hash(i + 11) * 1.4 : 6 + hash(i + 13) * 5;
    bPos.set([x, y, z], i * 3); const k = (.12 + .1 * Math.sin(T2 * .9 + i * 2)); bCol.set([k * 1.1, k * .85, k * .6], i * 3); }
  bGeo.attributes.position.needsUpdate = true; bGeo.attributes.color.needsUpdate = true;
  SHAFTS.forEach(sh => { orientShaft(sh); sh.m.material.opacity = .075 + .035 * Math.sin(T2 * .6 + sh.k * 2.1); });
  ring.rotation.z = T2 * .03; ring.material.opacity = .26 + .8 * glowAmt; ring.material.color.setRGB(1, .8, .5).lerp(inkCol, clamp(glowAmt)).multiplyScalar(1 + glowAmt);
}

// glyphs: tiles of the supplied rune sheet, written top to bottom in glowing ink
const glyphMat = (k, halo) => new THREE.ShaderMaterial({
  uniforms: { map: { value: T.glyphs }, tile: { value: new THREE.Vector2((k % 5) / 5, 1 - (Math.floor(k / 5) + 1) / 5) }, prog: { value: 0 }, opac: { value: 1 }, flare: { value: 0 }, col: { value: BLUE.clone() } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D map; uniform vec2 tile; uniform float prog, opac, flare; uniform vec3 col; varying vec2 vUv;
    void main(){ vec2 g = ${halo ? '(vUv - .5) * 1.3 + .5' : 'vUv'}; vec2 uv = tile + (vec2(.1) + clamp(g, 0., 1.) * .8) / 5.;
      float l = ${halo ? 'texture2D(map, uv, 2.2).r * 1.5' : 'texture2D(map, uv).r'};
      float y = 1. - g.y; float rev = 1. - smoothstep(prog - .03, prog + .01, y); float tip = exp(-abs(y - prog) * 26.) * step(prog, .995);
      ${halo ? 'gl_FragColor = vec4(col * l * (rev * (.32 + flare * 1.3) + tip * 1.2) * opac / max(1., max(col.r, col.b) * .55), 1.);'
             : 'float a = clamp(l * (rev + tip * .6) * opac, 0., 1.); gl_FragColor = vec4(mix(col * .22, col * 1.1, tip + flare * .6), a);'} }`,
  transparent: true, depthWrite: false, toneMapped: false, blending: halo ? THREE.AdditiveBlending : THREE.NormalBlending });
const NG = 140, GP = NG / 2, glyphs = [];
for (let i = 0; i < NG; i++) {
  const page = i < GP ? -1 : 1, j = i % GP, col = j % 7, row = Math.floor(j / 7), sz = .118;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), glyphMat((i * 7) % 25, false)), h = new THREE.Mesh(new THREE.PlaneGeometry(sz * 1.3, sz * 1.3), glyphMat((i * 7) % 25, true));
  const gx = page < 0 ? -(.16 + (6 - col) * .163) : (.16 + col * .163); m.position.set(gx, .74 - row * .164, TH * .5 + .004 + pageZ(Math.abs(gx))); h.position.copy(m.position); h.position.z += .001;
  m.visible = h.visible = false; m.renderOrder = 5; h.renderOrder = 6; m.userData.halo = h; book.add(m, h); glyphs.push(m);
}

// ---------------------------------------------------------------- VFX: painted sprite sheets as additive billboards
class Sheet { constructor(tex, cols, rows, gain = 1.6, center = [.5, .5]) { this.t = tex.clone(); this.t.repeat.set(1 / cols, 1 / rows); this.t.needsUpdate = true; this.c = cols; this.r = rows;
    this.s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.t, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, toneMapped: false, color: new THREE.Color().setScalar(gain) })); this.s.center.set(...center); this.s.renderOrder = 20; this.s.visible = false; fg.add(this.s); }
  set(f, a, pos, w, h) { const n = this.c * this.r, k = clamp(Math.floor(f), 0, n - 1); this.t.offset.set((k % this.c) / this.c, 1 - (Math.floor(k / this.c) + 1) / this.r); this.s.material.opacity = a; this.s.visible = a > .01; if (pos) this.s.position.copy(pos); if (w) this.s.scale.set(w, h || w, 1); } }
const glowSprite = (color, order = 19, blend = THREE.AdditiveBlending, map = glowTex) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, blending: blend, transparent: true, depthWrite: false, depthTest: false, toneMapped: false })); s.renderOrder = order; s.visible = false; fg.add(s); return s; };
const burstB = new Sheet(T.fxBurstB, 4, 3, 1.25, [.5, .32]), burstG = new Sheet(T.fxBurstG, 4, 3, 1.25, [.5, .32]), upFlare = new Sheet(T.fxUpgrade, 4, 3, .75);
const bhCharge = new Sheet(T.bhCharge, 4, 3, 1.6), bhLoop = new Sheet(T.bhLoop, 4, 2, 1.6), burst = new Sheet(T.burst, 4, 3, 1.25); burst.s.material.color.setRGB(1.7, 1.25, .55); // the opening burst is gold
const pillarB = new Sheet(T.pillarBlue, 4, 2, 1.3, [.5, .02]), pillarG = new Sheet(T.pillarGold, 4, 2, 1.3, [.5, .02]);
const raysTex = canvasTex(512, 512, (g, w, h) => { g.translate(w / 2, h / 2); for (let k = 0; k < 36; k++) { const a = k / 36 * TAU + (hash(k) - .5) * .12, len = 150 + hash(k + 40) * 106, wd = .025 + hash(k + 80) * .05;
  const gr = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, len, a - wd, a + wd); g.closePath(); g.fill(); } });
const rays = glowSprite(new THREE.Color(1, 1, 1), 17, THREE.AdditiveBlending, raysTex), halo = glowSprite(new THREE.Color(1, 1, 1), 16);
const sheetTex = (k, c, r) => { const t = T[k].clone(); t.repeat.set(1 / c, 1 / r); t.needsUpdate = true; return t; }, raysB = sheetTex('fxRaysB', 4, 2), raysG = sheetTex('fxRaysG', 4, 2);
const dark = glowSprite(new THREE.Color(1, 1, 1), 18, THREE.NormalBlending, darkTex), coreGlow = glowSprite(new THREE.Color(.6, .9, 2), 21), liftGlow = glowSprite(new THREE.Color(1, 1, 1), 21);

// ---------------------------------------------------------------- particles (real depth, additive)
class Particles { constructor(max, size, order = 30, depthTest = true) { this.max = max; this.p = []; this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3)); this.g = g;
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest, toneMapped: false, sizeAttenuation: true }));
    this.points.frustumCulled = false; this.points.renderOrder = order; fg.add(this.points); }
  emit(n, at, color, o = {}) { for (let i = 0; i < n && this.p.length < this.max; i++) { const a = rnd() * TAU, b = (rnd() - .5) * Math.PI, sp = (o.speed ?? 1) * (.3 + rnd() * .9), d = o.dir;
      const v = d ? V(d.x + (rnd() - .5) * (o.spread ?? .6), d.y + (rnd() - .5) * (o.spread ?? .6), d.z + (rnd() - .5) * (o.spread ?? .6)).normalize().multiplyScalar(sp) : V(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)).multiplyScalar(sp);
      this.p.push({ x: at.x, y: at.y, z: at.z, v, life: 0, max: (o.life ?? .9) * (.6 + rnd() * .7), c: color, g: o.grav ?? 0, drag: o.drag ?? 1.4 }); } }
  step(dt) { let n = 0; this.p = this.p.filter(p => (p.life += dt) < p.max);
    for (const p of this.p) { const d = Math.exp(-p.drag * dt); p.v.multiplyScalar(d); p.v.y += p.g * dt; p.x += p.v.x * dt; p.y += p.v.y * dt; p.z += p.v.z * dt;
      const f = 1 - p.life / p.max; this.pos.set([p.x, p.y, p.z], n * 3); this.col.set([p.c.r * f, p.c.g * f, p.c.b * f], n * 3); n++; }
    this.g.setDrawRange(0, n); this.g.attributes.position.needsUpdate = true; this.g.attributes.color.needsUpdate = true; }
  clear() { this.p = []; } }
const sparks = new Particles(700, .05), embers = new Particles(300, .065, 31, false);
// dust motes drifting in the hall light (fixed field, wraps)
const MOTES = 320, mPos = new Float32Array(MOTES * 3), mCol = new Float32Array(MOTES * 3), mSeed = Array.from({ length: MOTES }, (_, i) => [hash(i) * 14 - 7, hash(i + 99) * 7 - 3.2, hash(i + 199) * 9 - 3.5, hash(i + 299)]);
const mGeo = new THREE.BufferGeometry(); mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3)); mGeo.setAttribute('color', new THREE.BufferAttribute(mCol, 3));
const motes = new THREE.Points(mGeo, new THREE.PointsMaterial({ size: .045, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); motes.frustumCulled = false; motes.renderOrder = 29; fg.add(motes);
// inflow streak field for the charge
const INF = 220, iPos = new Float32Array(INF * 3), iCol = new Float32Array(INF * 3), iGeo = new THREE.BufferGeometry(); iGeo.setAttribute('position', new THREE.BufferAttribute(iPos, 3)); iGeo.setAttribute('color', new THREE.BufferAttribute(iCol, 3));
const inflow = new THREE.Points(iGeo, new THREE.PointsMaterial({ size: .045, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false })); inflow.frustumCulled = false; inflow.renderOrder = 22; inflow.visible = false; fg.add(inflow);

// ---------------------------------------------------------------- cards (shot 2)
const cardGeo = new THREE.PlaneGeometry(1, 1.5);
const cardMask = canvasTex(200, 300, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 200, 300); g.fillStyle = '#fff'; g.beginPath(); g.roundRect(3, 3, 194, 294, 14); g.fill(); }); cardMask.colorSpace = THREE.NoColorSpace;
function roundRect(w, h, r) { const sh = new THREE.Shape(), x = -w / 2, y = -h / 2; sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y); return sh; }
const cardBody = new THREE.ExtrudeGeometry(roundRect(1.04, 1.56, .08), { depth: .03, bevelEnabled: true, bevelThickness: .012, bevelSize: .014, bevelSegments: 4, curveSegments: 8 }); cardBody.translate(0, 0, -.015);
const rimMat = new THREE.MeshStandardMaterial({ color: 0xc99d55, metalness: 1, roughness: .22, envMapIntensity: 1.7 });
const cardLight = new THREE.PointLight(0xfff0d8, 0, 14, 1.2); fg.add(cardLight);
const faceMat = () => new THREE.MeshBasicMaterial({ map: T.card, alphaMap: cardMask, transparent: true, toneMapped: false });
// the card face: the hero's portrait in a frame whose colour tells the rarity, stars and name below
const RAR = { 1: { a: '#a3a9b2', b: '#6d737c', t: '#c9ced6', glow: 'rgba(160,170,190,.0)' }, 2: { a: '#b9c4d2', b: '#4a5260', t: '#e4ebf3', glow: 'rgba(170,200,235,.18)' }, 3: { a: '#ffe3a3', b: '#b07a28', t: '#ffe7b0', glow: 'rgba(255,200,110,.32)' } };
function cardFace(hero, star) { return canvasTex(800, 1200, (g, W, H) => { const { id, th, en, cls } = hero, im = T['por_' + id].image, R = RAR[star], gold = star === 3;
  g.save(); g.beginPath(); g.roundRect(0, 0, W, H, 44); g.clip();
  g.fillStyle = '#0b0a10'; g.fillRect(0, 0, W, H);
  const s = Math.max(W / im.width, (H * .86) / im.height); g.drawImage(im, W / 2 - im.width * s / 2, -H * .02, im.width * s, im.height * s); // full-bleed portrait
  const fade = g.createLinearGradient(0, H * .5, 0, H); fade.addColorStop(0, 'rgba(8,7,12,0)'); fade.addColorStop(.45, 'rgba(8,7,12,.82)'); fade.addColorStop(1, 'rgba(8,7,12,.98)'); g.fillStyle = fade; g.fillRect(0, H * .5, W, H * .5);
  const top = g.createLinearGradient(0, 0, 0, H * .16); top.addColorStop(0, 'rgba(8,7,12,.65)'); top.addColorStop(1, 'rgba(8,7,12,0)'); g.fillStyle = top; g.fillRect(0, 0, W, H * .16);
  if (gold) { const gl = g.createRadialGradient(W / 2, H * .82, 10, W / 2, H * .82, W * .7); gl.addColorStop(0, 'rgba(255,190,90,.22)'); gl.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gl; g.fillRect(0, H * .55, W, H * .45); }
  // class tag, top-left
  g.font = '600 30px "IBM Plex Sans Thai", sans-serif'; const tw = g.measureText(cls).width; g.fillStyle = 'rgba(10,9,14,.66)'; g.beginPath(); g.roundRect(44, 44, tw + 44, 54, 27); g.fill(); g.strokeStyle = R.a; g.lineWidth = 2; g.stroke(); g.fillStyle = R.t; g.textBaseline = 'middle'; g.fillText(cls, 66, 72);
  // name plate
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = R.t; g.globalAlpha = .82; g.font = '600 30px Cinzel, serif'; const spaced = en.toUpperCase().split('').join(String.fromCharCode(8202)); g.fillText(spaced, W / 2, H - 236); g.globalAlpha = 1;
  g.font = '700 ' + (th.length > 12 ? 56 : 70) + 'px "IBM Plex Sans Thai", sans-serif'; g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 16; g.fillText(th, W / 2, H - 162); g.shadowBlur = 0;
  // divider with a diamond
  const ln = g.createLinearGradient(W * .2, 0, W * .8, 0); ln.addColorStop(0, 'rgba(0,0,0,0)'); ln.addColorStop(.5, R.a); ln.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = ln; g.fillRect(W * .2, H - 128, W * .6, 2);
  g.fillStyle = R.a; g.save(); g.translate(W / 2, H - 127); g.rotate(Math.PI / 4); g.fillRect(-7, -7, 14, 14); g.restore();
  // stars
  for (let k = 0; k < star; k++) { const x = W / 2 + (k - (star - 1) / 2) * 62, y = H - 72; g.beginPath(); for (let j = 0; j < 10; j++) { const r = j % 2 ? 11 : 25, a = j * Math.PI / 5 - Math.PI / 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath();
    const sg = g.createLinearGradient(x, y - 25, x, y + 25); sg.addColorStop(0, gold ? '#fff2c8' : '#f1f4f8'); sg.addColorStop(1, gold ? '#d39a3a' : '#8d96a3'); g.fillStyle = sg; g.fill(); }
  g.restore();
  // frame: a fine double line; gold foil with corner flourishes only for 3★
  const fr = g.createLinearGradient(0, 0, W, H); fr.addColorStop(0, R.a); fr.addColorStop(.5, R.b); fr.addColorStop(1, R.a);
  g.strokeStyle = fr; g.lineWidth = gold ? 14 : 5; g.beginPath(); g.roundRect(gold ? 7 : 3, gold ? 7 : 3, W - (gold ? 14 : 6), H - (gold ? 14 : 6), 40); g.stroke();
  if (gold) { g.lineWidth = 2; g.globalAlpha = .7; g.beginPath(); g.roundRect(26, 26, W - 52, H - 52, 30); g.stroke(); g.globalAlpha = 1; }
  if (gold) for (const [cx, cy, sx, sy] of [[26, 26, 1, 1], [W - 26, 26, -1, 1], [26, H - 26, 1, -1], [W - 26, H - 26, -1, -1]]) { g.save(); g.translate(cx, cy); g.scale(sx, sy); g.fillStyle = fr; g.beginPath(); g.moveTo(0, 0); g.lineTo(70, 0); g.quadraticCurveTo(26, 6, 0, 70); g.closePath(); g.fill(); g.fillStyle = '#fff1c4'; g.beginPath(); g.arc(18, 18, 6, 0, Math.PI * 2); g.fill(); g.restore(); }
  }); }
// a living aura for the gold card: dark smoke with gold fire licking up around the edges
const auraMat = () => new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, amt: { value: 0 } }, transparent: true, depthWrite: true, toneMapped: false, // writes depth so the depth of field keeps it sharp with its card
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform float time, amt; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.03; a *= .5; } return v; }
    void main(){ vec2 p = (vUv - .5) * vec2(1.75, 1.6); vec2 q = abs(p) - vec2(.52, .5); float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - .04; /* distance from the card's edge */
      float f = fbm(vec2(atan(p.y, p.x) * 2.2, d * 3. - time * 1.6)) + .35 * fbm(p * 5. + vec2(0., -time * 2.));
      float reach = .1 + .22 * f * amt + .06 * max(0., p.y) * amt; float outside = smoothstep(-.015, .02, d);
      float body = 1. - smoothstep(0., reach, d), smokeBody = 1. - smoothstep(0., reach * 1.9 + .08, d - .02 * fbm(p * 7. - vec2(0., time)));
      float smoke = smokeBody * outside; float tongue = fbm(vec2(atan(p.y, p.x) * 6., d * 9. - time * 3.)); float flame = smoothstep(.52, .72, tongue) * smoothstep(.16, 0., d - .06 * tongue) * outside; /* thin licking tongues near the edge */ float rim = exp(-max(d, 0.) * 40.) * outside;
      vec3 col = mix(vec3(.02, .005, .03), vec3(.07, .03, .06), fbm(p * 4. + time * .2)); col = mix(col, vec3(.95, .62, .2), clamp(flame * 1.3, 0., 1.)) + vec3(.05, .1, .1) * pow(flame, 3.) + vec3(.9, .66, .26) * rim * .55; col = min(col, vec3(.98)); /* stay under the bloom threshold: crisp flames, visible dark smoke */
      gl_FragColor = vec4(col, clamp(smoke * .95 + flame + rim * .8, 0., 1.) * min(amt, 1.)); }` });
const rimDark = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: .75, roughness: .35, envMapIntensity: 1.1 });
const cards = Array.from({ length: 10 }, () => { const m = new THREE.Group(); m.visible = false; fg.add(m);
  const body = new THREE.Mesh(cardBody, rimMat); m.add(body); m.userData.body = body;
  const face = new THREE.Mesh(cardGeo, faceMat()); face.position.z = .032; face.renderOrder = 40; m.add(face);
  const back = new THREE.Mesh(cardGeo, faceMat()); back.position.z = -.032; back.rotation.y = Math.PI; m.add(back);
  const sheen = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: sheenTex.clone(), alphaMap: cardMask, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: .3 })); sheen.material.map.needsUpdate = true; sheen.material.map.wrapS = sheen.material.map.wrapT = THREE.RepeatWrapping; sheen.position.z = .034; sheen.renderOrder = 41; m.add(sheen);
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), auraMat()); aura.renderOrder = 38; aura.visible = false; fg.add(aura);
  return { m, face, back, sheen, aura, glow: glowSprite(new THREE.Color(1, 1, 1), 39), orb: glowSprite(new THREE.Color(1, 1, 1), 42), bloom: new Sheet(T.orbCard, 4, 3, 1.05) }; });
// the reveal: plain cards flip first one by one, the gold card waits, flares, then flips last
// the reveal: plain cards flip first one by one; each gold card waits for its own tap, plays its intro behind a black
// screen and flips while hidden. Gold cards open in pull order.
const plainIdx = () => S.cards.map((c, j) => c.star === 3 ? -1 : j).filter(j => j >= 0);
function revealAt(i) { const r0 = TL.cards[1] + .8, k = goldIdx().indexOf(i);
  if (k >= 0) return S.goldTaps[k] == null ? Infinity : S.goldTaps[k] - S.tap + 1.0; // turned over behind the black screen
  return r0 + plainIdx().indexOf(i) * .14; }
const goldWaitAt = () => TL.cards[1] + .8 + Math.max(0, plainIdx().length - 1) * .14 + .5; // the plain cards are all turned by now
const cineIndex = () => S.goldTaps.length - 1; // the gold card whose intro is showing (or last showed)
function cineActive() { const k = cineIndex(); return S.tap != null && k >= 0 && S.cineClosed[k] == null; }
const cineFaded = () => { const k = cineIndex(); return k < 0 || (S.cineClosed[k] != null && S.T - S.cineClosed[k] > .45); };
const goldWaiting = () => S.tap != null && S.goldTaps.length < goldIdx().length && !cineActive() && cineFaded() && S.T - S.tap > goldWaitAt();
const revealEnd = () => S.cards.length ? Math.max(...S.cards.map((c, i) => revealAt(i))) + 1.2 : TL.cards[1] + .6;

// ---------------------------------------------------------------- camera paths
const SHOT = { wide: [V(0, .15, CAM_Z), V(0, .02, PLATE_Z)], close: [V(0, .05, 4.25), V(0, -.28, -.15)], open: [V(0, .75, 3.7), V(0, -.2, -.12)], write: [V(0, .55, 3.15), V(0, -.2, -.12)], lift: [V(0, -.2, 4.6), V(0, 2.4, -.6)] };
const mixShot = (a, b, p) => [a[0].clone().lerp(b[0], p), a[1].clone().lerp(b[1], p)];
function shot1Camera(T2, u) {
  const p = u == null ? 0 : eio(seg(u, 0, 1.05));
  let [pos, look] = mixShot(SHOT.wide, SHOT.close, p); pos.x += Math.sin(T2 * .13) * .42 * (1 - p) + Math.sin(p * Math.PI) * .5; pos.y += Math.sin(T2 * .09) * .2 * (1 - p); pos.z -= (.5 + .5 * Math.sin(T2 * .07 - 1.4)) * .7 * (1 - p); // drift and push in, never back past the painting's edge
  if (u != null) {
    const ch = seg(u, ...TL.charge), push = .06 * eio(ch) * (1 - seg(u, TL.burst, TL.burst + .25));
    pos.lerp(look, push);
    [pos, look] = mixShot([pos, look], SHOT.open, eio(seg(u, TL.burst + .05, TL.flip[0] + .4)));
    [pos, look] = mixShot([pos, look], SHOT.write, eio(seg(u, TL.flip[1] - .5, TL.write[0] + .4)));
    [pos, look] = mixShot([pos, look], SHOT.lift, eio(seg(u, TL.lift[0], TL.cut)));
    const UP3 = S.up && S.top === 3, shake = .03 * eio(seg(u, ...TL.shake)) * (u < TL.burst ? 1 : 0) + .07 * bump(u, TL.burst + .05, .3) + (UP3 ? .028 * seg(u, TS - HOLD, TS) * (u < TS ? 1 : 0) + .08 * bump(u, TS + .04, .28) : 0);
    pos.x += Math.sin(T2 * 47) * shake; pos.y += Math.cos(T2 * 53) * shake;
  }
  pos.x += Math.sin(T2 * .21) * .05 * p; pos.y += Math.sin(T2 * .17) * .03; pos.z += Math.sin(T2 * .13) * .06 * p;
  if (camera.fov !== 35) { camera.fov = 35; camera.updateProjectionMatrix(); }
  camera.position.copy(pos); camera.lookAt(look);
  return p;
}

// ---------------------------------------------------------------- per-frame update
const tmp = V(0, 0, 0);
const coverCentre = () => book.localToWorld(V(PW * .5, 0, TH + CT + .01));
function setPillar(base, h, w, a, T2) { const gold = S.top === 3; (gold ? pillarB : pillarG).set(0, 0); (gold ? pillarG : pillarB).set(Math.floor(T2 * 12) % 8, a, base, w, h); }
function updateShot1(T2, u, dt) {
  hall.visible = true; low.visible = false; lowFg.visible = false; props.visible = false; book.visible = true; // the painting carries the room: no floating 3D candles or code-drawn shafts on top shadowCatch.visible = false; motes.visible = true; cardLight.intensity = 0;
  const close = shot1Camera(T2, u); hallFg.visible = false; plate.visible = true; plateC.visible = plateCFore.visible = false; updatePlate(T2); ringPivot.visible = false;
  { const k = u == null ? 1 : 1 - eio(seg(u, 0, 1.0)), sh = u == null ? 0 : Math.max(eio(seg(u, ...TL.shake)) * (u < TL.burst + .25 ? 1 : 0), S.up && S.top === 3 ? .55 * seg(u, TS - HOLD, TS) * (u < TS + .1 ? 1 : 0) : 0), up = u == null ? 0 : .14 * eio(seg(u, TL.shake[0], TL.burst));
    pivot.position.set((rnd() - .5) * .06 * sh * sh, FLOAT_Y + .06 * Math.sin(T2 * 1.1) * (.3 + .7 * k) + up + (rnd() - .5) * .05 * sh * sh, -.15);
    pivot.rotation.set(-.14 + .03 * Math.sin(T2 * .8) * k + (rnd() - .5) * .035 * sh, .4 * Math.sin(T2 * .33) * k, .02 * Math.sin(T2 * .6) * k + (rnd() - .5) * .06 * sh); } [pillarB, pillarG].forEach(s => { s.s.material.depthTest = false; s.s.material.color.setScalar(1.3); });
  const focusAt = book.localToWorld(V(u != null && u > TL.burst ? 0 : PW * .5, 0, 0)); bokeh.uniforms.focus.value = camera.position.distanceTo(focusAt); bokeh.uniforms.aperture.value = lerp(.00015, .0017, close);
  // book state
  const open = u == null ? 0 : eo3(seg(u, ...TL.open)), f = u == null ? 0 : seg(u, ...TL.flip);
  const rightT = TH * (1 - .5 * eio(f)), leftT = TH * .5 * eio(f) * (open > .99 ? 1 : 0);
  rightBlock.scale.z = rightT; rightBlock.position.set(PW / 2, 0, rightT / 2); rightTop.position.z = rightT + .001; rightTop.scale.z = Math.max(.001, open); rightTop.material.map = f >= 1 ? T.pageBlankHd : T.pageAHd;
  leftBlock.visible = leftTop.visible = leftT > .002; leftBlock.scale.z = Math.max(.001, leftT); leftBlock.position.set(-PW / 2, 0, leftT / 2); leftTop.position.z = leftT + .001;
  spineGrp.rotation.y = -open * Math.PI / 2; spineGrp.position.z = lerp(SPZ, -.02, open); spineGrp.scale.x = lerp(1, .6, open); // the spine swings under the gutter as the book opens
  coverGrp.rotation.y = -open * Math.PI; coverGrp.position.z = lerp(rightT + .004, 0, open);
  capGem.material.emissiveIntensity = u == null ? 0 : 1.6 * eio(seg(u, ...TL.charge)) * (u < TL.burst ? 1 : 0) + .6 * (u > TL.burst ? 1 : 0);
  flips.forEach((l, k) => { const st = k / flips.length, p = clamp((eio(f) - st * .8) / .2); l.grp.visible = u != null && f > 0 && f < 1 && p > 0 && p < 1; if (l.grp.visible) l.set(eio(p) * Math.PI, Math.sin(p * Math.PI) * 1.2, TH * .5 + .006 + k * .001); });
  // light from the book
  const cc = coverCentre(); let bl = 0, blc = BLUE;
  if (u != null) {
    const ch = seg(u, ...TL.charge), pre = u < TL.burst;
    // charge: a black hole on the cover, light streaming in
    const toCam = camera.position.clone().sub(cc).normalize(), hole = cc.clone().add(toCam.multiplyScalar(.12)), sz = lerp(1.5, 1.3, ch);
    dark.visible = false; dark.position.copy(hole); dark.scale.setScalar(lerp(.6, .55, ch)); dark.material.opacity = .9 * ch;
    bhCharge.set(0, 0); bhLoop.set(0, 0); inflow.visible = false;
    const UPG = S.up && S.top === 3, FC = S.top === 3 ? GOLD : BLUE, C0 = UPG ? BLUE : FC, swp = UPG ? eo3(seg(u, TS, TS + .7)) * 1.05 : 0, TC = UPG && u > TS ? GOLD : C0;
    const tq = seg(u, ...TL.trace), tr = traceProg(u), hold = UPG ? seg(u, TS - HOLD, TS - .05) * (u < TS ? 1 : 0) : 0;
    const tf = .9 * eio(seg(u, ...TL.shake)) + .8 * bump(u, TL.burst - .05, .2) + .22 * hold + (UPG ? .3 * bump(u, TS + .05, .2) : 0);
    Object.assign(traceMat.uniforms, {}); traceMat.uniforms.prog.value = tr; traceMat.uniforms.flash.value = tf; traceMat.uniforms.fade.value = 1 - seg(u, TL.burst + .1, TL.burst + .5); traceMat.uniforms.time.value = T2;
    traceMat.uniforms.colA.value.copy(C0); traceMat.uniforms.colB.value.copy(GOLD); traceMat.uniforms.sw.value = UPG ? swp : (S.top === 3 ? 2 : -1);
    // light motes lifting off the cover while the seal awakens, rays wheeling behind the book
    if (pre && u > TL.shake[0] && rnd() < .3 + 1.6 * seg(u, ...TL.shake)) embers.emit(1, book.localToWorld(V(PW * (.1 + rnd() * .8), (rnd() - .5) * PH * .9, TH + CT + .02)), TC, { dir: V(0, 1, .4), speed: .5 + seg(u, ...TL.shake), spread: .5, life: 1.1, drag: .4, grav: .15 });
    const rk = pre ? eio(seg(u, ...TL.shake)) : 1 - seg(u, TL.burst, TL.burst + .3);
    rays.visible = rk > .01; rays.position.copy(cc); rays.scale.setScalar(2.2 + 2.6 * rk + 3 * bump(u, TL.burst, .3)); rays.material.rotation = T2 * .25; { const rt = TC === GOLD ? raysG : raysB, f = Math.floor(T2 * 10) % 8; rt.offset.set((f % 4) / 4, f < 4 ? .5 : 0); rays.material.map = rt; } rays.material.color.setScalar(1.15 * rk); rays.scale.multiplyScalar(1.7);
    const hp = UPG ? bump(u, TS + .15, .45) : 0; // action 3: a gold pulse where the light turns
    halo.visible = rk > .01 || hp > .01; halo.position.copy(cc); halo.scale.setScalar(2.4 + 1.6 * rk + 2.2 * hp); halo.material.color.copy(TC).multiplyScalar(.28 * rk).add(GOLD.clone().multiplyScalar(.16 * hp));
    if (UPG && u > TS && once('upgrade')) { const at = book.localToWorld(V(PW * .5, CH * (.5 - .472) - 0, TH + CT + .02)); sparks.emit(260, at, GOLD, { speed: 3, life: 1, drag: 1.2 }); embers.emit(70, at, GOLD, { speed: 1.4, life: 1.3, grav: .3 }); }
    if (u > TL.burst && once('clasp')) sparks.emit(60, coverGrp.localToWorld(V(CW * .955, CH * (.5 - .472), CT + .02)), FC, { speed: 1.6, life: .7 });
    if (inflow.visible) for (let k = 0; k < INF; k++) { const q = (T2 * (.8 + hash(k) * .7) + hash(k + 7)) % 1, r = .25 + Math.pow(1 - q, 1.5) * 2.6, a = hash(k + 9) * TAU + q * 5.5, y = (hash(k + 40) - .5) * 1.6 * (1 - q);
      iPos.set([hole.x + Math.cos(a) * r, hole.y + y + Math.sin(a) * r * .55, hole.z + Math.sin(a) * r * .4], k * 3); const c = k % 7 ? BLUE : GOLD, f2 = q * ch * .9; iCol.set([c.r * f2, c.g * f2, c.b * f2], k * 3); }
    iGeo.attributes.position.needsUpdate = true; iGeo.attributes.color.needsUpdate = true;
    grade.uniforms.uDark.value = .55 * eio(seg(u, 0, TL.trace[1])) * (1 - seg(u, TL.burst, TL.burst + .3));
    // burst
    const bF = seg(u, TL.burst, TL.burst + .75), bM = UPG ? seg(u, TS, TS + .7) : 0;
    burst.set(0, 0); const sbF = seg(u, TL.burst, TL.burst + .9), sb = S.top === 3 ? burstG : burstB; (S.top === 3 ? burstB : burstG).set(0, 0); sb.set(sbF * 12, sbF > 0 && sbF < 1 ? 1 : 0, cc.clone().add(V(0, -.45, .1)), 6.4);
    const uf = UPG ? seg(u, TS - .12, TS + .8) : 0; upFlare.set(uf * 12, uf > 0 && uf < 1 ? 1 : 0, cc.clone().add(V(0, 0, .12)), 3.6); // the painted burst is blue-white; tinting it gold needs extra red or it turns green
    if (u > TL.burst && once('burst')) { sparks.emit(340, cc, FC, { speed: 3.6, life: 1.1, drag: 1.1 }); sparks.emit(140, cc, new THREE.Color(1.3, 1.2, 1.1), { speed: 2.2, life: .8 }); embers.emit(80, cc, FC, { speed: 1.8, life: 1.5, grav: .5 }); }
    // wind through the pages
    if (f > 0 && f < 1) sparks.emit(3, book.localToWorld(V(PW * (.4 + rnd() * .6), (rnd() - .5) * PH, TH + .05)), new THREE.Color(1.2, 1.5, 2), { dir: V(-1, .3, .2), speed: 2.4, spread: .5, life: .5, drag: .4 });
    // glowing ink
    const w = seg(u, ...TL.write), gm = S.top === 3 ? eio(seg(u, TL.gold, TL.gold + .35)) : 0, flare = bump(u, TL.lift[0] + .12, .2), fade = 1 - seg(u, TL.lift[0] + .15, TL.lift[1]);
    const ink = BLUE.clone().lerp(GOLD, gm);
    glyphs.forEach((m, i) => { const p = clamp(w * (GP * .4 + 1) - (i % GP) * .4); m.visible = m.userData.halo.visible = u > TL.write[0] && p > 0 && fade > .01;
      for (const un of [m.material.uniforms, m.userData.halo.material.uniforms]) { un.prog.value = p; un.opac.value = fade; un.flare.value = flare; un.col.value.copy(ink); }
      if (p >= 1 && i % 4 === 0 && once('g' + i)) embers.emit(2, m.getWorldPosition(tmp), ink, { dir: V(0, 1, .3), speed: .4, spread: .4, life: .9, drag: .5, grav: .2 }); });
    if (S.top === 3 && u > TL.gold && once('goldturn')) glyphs.forEach(m => embers.emit(2, m.getWorldPosition(tmp), GOLD, { speed: .6, life: .7 }));
    // the light lifts off the letters into a pillar
    const lf = seg(u, ...TL.lift), bm = seg(u, TL.lift[0] + .15, TL.cut);
    if (lf > 0 && once('lift')) glyphs.forEach(m => embers.emit(2, m.getWorldPosition(tmp), ink.clone().multiplyScalar(.55), { dir: V(0, 1, 0), speed: 1.6, spread: .25, life: 1, drag: .3 }));
    const base = cc.clone(); setPillar(base, 9 * eo3(bm), 2.4, bm, T2);
    liftGlow.visible = bm > 0; liftGlow.position.copy(base); liftGlow.scale.setScalar(2.5 * bm); liftGlow.material.color.copy(S.top === 3 ? GOLD : BLUE).multiplyScalar(.25); liftGlow.material.opacity = bm;
    // how much light the book throws on itself
    bl = 1.6 * eio(seg(u, ...TL.shake)) * (pre ? 1 : 0) + 2.2 * bump(u, TL.burst + .05, .35) + .35 * (f > 0 && f < 1 ? 1 : 0) + (u > TL.write[0] ? .35 + .5 * w + 1.4 * flare : 0) + 1.2 * bm;
    blc = pre ? TC : FC;
    grade.uniforms.uFlash.value = .45 * bump(u, TL.burst + .03, .16) + (UPG ? .06 * bump(u, TS + .03, .14) : 0) + 1.1 * bump(u, TL.cut, .22);
    coreGlow.visible = false; coreGlow.position.copy(hole); coreGlow.scale.setScalar(.9 * ch); coreGlow.material.opacity = .25 * ch;
  } else { traceMat.uniforms.fade.value = 0; rays.visible = halo.visible = false; [burstB, burstG, upFlare].forEach(s => s.set(0, 0)); [bhCharge, bhLoop, burst, pillarB, pillarG].forEach(s => s.set(0, 0)); dark.visible = coreGlow.visible = liftGlow.visible = inflow.visible = false; glyphs.forEach(m => m.visible = m.userData.halo.visible = false); grade.uniforms.uDark.value = 0; grade.uniforms.uFlash.value = 0; }
  updateArchive(T2, dt, u, blc, cc); flare.visible = false; updateCircles(T2, u, dt); updateDust(T2, true); updateFloatBooks(T2, true, u == null ? 0 : eo3(seg(u, TL.burst, TL.burst + .6)), 1 + (u == null ? 0 : 2.5 * eio(seg(u, ...TL.shake)) + 1.2 * clamp(seg(u, ...TL.trace) * 2)));
  updateProps(T2, dt, blc, u == null ? 0 : clamp(1.2 * seg(u, ...TL.charge) + bump(u, TL.burst + .1, .5) + (u > TL.write[0] ? .5 : 0) + seg(u, ...TL.lift)));
  bookLight.position.copy(book.localToWorld(V(0, .1, 1.6))); bookLight.color.copy(blc).multiplyScalar(.45); bookLight.intensity = bl;
  // motes
  for (let i = 0; i < MOTES; i++) { const [x, y, z, s] = mSeed[i]; mPos.set([x + Math.sin(T2 * .2 + i) * .15, -3.2 + ((y + 3.2 + T2 * .06 * (.4 + s)) % 7), z], i * 3); const k = (.35 + .5 * Math.sin(T2 * 1.3 + i)) * .5; mCol.set([1 * k, .85 * k, .62 * k], i * 3); }
  mGeo.attributes.position.needsUpdate = true; mGeo.attributes.color.needsUpdate = true;
  cards.forEach(c => { c.m.visible = c.glow.visible = c.orb.visible = false; c.bloom.set(0, 0); });
  return cc;
}
const CARD_D = 4; function px2w(px, py) { const h = 2 * CARD_D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), s = h / 720; return camera.localToWorld(V((px - 640) * s, (360 - py) * s, -CARD_D)); }
function cardSlot(i) { if (S.n === 1) return { x: 640, y: 320, w: 196 }; const r = i < 5 ? 0 : 1, c = i % 5; return { x: 640 + (c - 2) * 152, y: 228 + r * 214, w: 122 }; }
function updateShot2(T2, u, dt) {
  plate.visible = false; updateFloatBooks(T2, false, 0); updateDust(T2, false); ringPivot.visible = false; pivot.position.set(0, FLOAT_Y, -.15); pivot.rotation.set(-.14, 0, 0); ringO.g.visible = ringI.g.visible = false; rays.visible = halo.visible = false; hall.visible = false; low.visible = false; hallFg.visible = false; lowFg.visible = false; props.visible = false; book.visible = false; shadowCatch.visible = false; motes.visible = true; inflow.visible = false;
  [bhCharge, bhLoop, burst, burstB, burstG, upFlare].forEach(s => s.set(0, 0)); dark.visible = coreGlow.visible = false; glyphs.forEach(m => m.visible = m.userData.halo.visible = false);
  const v = u - TL.cut; if (camera.fov !== 58) { camera.fov = 58; camera.updateProjectionMatrix(); }
  camera.position.set(Math.sin(T2 * .2) * .1, FLOOR + .6, 7.4 - .6 * eo3(seg(v, 0, 3))); camera.lookAt(0, 6.2 + 1.2 * eo3(seg(v, 0, 3)), -1.4); camera.updateMatrixWorld(); bokeh.uniforms.focus.value = CARD_D; bokeh.uniforms.aperture.value = .0005;
  const inkC = S.top === 3 ? GOLD : BLUE; [pillarB, pillarG].forEach(s => s.s.material.depthTest = true);
  const PD = 30, ph = 2 * PD * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (1.08 - .05 * eo3(seg(v, 0, 4))), pw = ph * T.plateC.image.width / T.plateC.image.height;
  plateC.visible = true; plateC.position.copy(camera.localToWorld(V(0, 0, -PD))); plateC.quaternion.copy(camera.quaternion); plateC.scale.set(pw, ph, 1);
  plateCFore.visible = true; plateCFore.position.copy(camera.localToWorld(V(0, 0, -PD + 2))); plateCFore.quaternion.copy(camera.quaternion); plateCFore.scale.set(pw * (PD - 2) / PD, ph * (PD - 2) / PD, 1);
  const inC = (u2, v2, d = PD - 1) => camera.localToWorld(V((u2 - .5) * pw * d / PD, (.5 - v2) * ph * d / PD, -d)); // a point of the painting, at depth d in front of the camera
  const fl = seg(u, TL.cut + .1, TL.cut + 1.1); flare.visible = fl > 0 && fl < 1; flare.material.map = S.top === 3 ? flareG : flareB; flare.position.copy(inC(.5, .18)); flare.scale.setScalar(ph * .36); flare.material.map.offset.set((Math.floor(fl * 10) % 4) / 4, 1 - (Math.floor(Math.floor(fl * 10) / 4) + 1) / 3); if (S.top === 3) flare.material.color.setScalar(1); else flare.material.color.copy(inkC).multiplyScalar(.7);
  cardLight.position.set(Math.sin(T2 * .7) * 5, 2.2, 7); cardLight.intensity = 2.2;
  grade.uniforms.uDark.value = S.goldTaps.length < goldIdx().length ? .3 * seg(u, goldWaitAt(), goldWaitAt() + .8) : 0; grade.uniforms.uFlash.value = 1.1 * bump(u, TL.cut, .22);
  const fade = 1 - seg(u, TL.cards[1], TL.cards[1] + 1.2) * .65, base = inC(.5, .875);
  setPillar(base, ph * 1.35, pw * .34, fade, T2); [pillarB, pillarG].forEach(p => p.s.material.color.setScalar(1.7));
  liftGlow.visible = true; liftGlow.position.copy(base); liftGlow.scale.setScalar(ph * .32); liftGlow.material.color.copy(S.top === 3 ? GOLD : BLUE).multiplyScalar(.2); liftGlow.material.opacity = fade;
  for (let i = 0; i < MOTES; i++) { const [x, y, z, s] = mSeed[i]; mPos.set([x * 1.2, -4 + ((y + 3.2 + T2 * .15 * (.4 + s)) % 8), z + 2], i * 3); const k = (.3 + .5 * Math.sin(T2 * 1.3 + i)) * .45; mCol.set([k, .8 * k, 1.1 * k], i * 3); }
  mGeo.attributes.position.needsUpdate = true; mGeo.attributes.color.needsUpdate = true;
  cards.forEach((c, i) => {
    const card = S.cards[i]; if (!card) { c.m.visible = c.glow.visible = c.orb.visible = false; c.bloom.set(0, 0); return; }
    const t0 = TL.cards[0] + i * (S.n === 1 ? 0 : .07), q = seg(u, t0, t0 + .5), sl = cardSlot(i), at = px2w(sl.x, sl.y), w = sl.w * (2 * CARD_D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / 720), col = STARC[card.star];
    const from = V(0, lerp(.5, 7, hash(i)), -.2), pos = from.clone().lerp(at, eio(q)); pos.y += Math.sin(q * Math.PI) * .8;
    const g3 = card.star === 3; c.orb.visible = q > 0 && q < 1; c.orb.position.copy(pos); c.orb.scale.setScalar(g3 ? .55 : .4); c.orb.material.color.copy(g3 ? col : STARC[1]).multiplyScalar(g3 ? 1.5 : .9);
    if (g3 && q > 0 && once('orb' + i)) sparks.emit(12, from, col, { speed: 1.4, life: .6 });
    const ob = seg(u, t0 + .45, t0 + 1.05); c.bloom.set(ob * 12, ob > 0 && ob < 1 ? (g3 ? .85 : .45) : 0, at, w / .44);
    const k = seg(u, t0 + .68, t0 + 1.0), e = eoBack(k);
    const rs = revealAt(i), fl = isFinite(rs) ? eio(seg(u, rs, rs + .45)) : 0, wait = g3 ? seg(u, goldWaitAt(), goldWaitAt() + .8) * (u < rs + .3 ? 1 : 0) : 0, pop = g3 ? bump(u, rs + .3, .35) : 0;
    const lift = (g3 ? .12 * eio(wait) - (isFinite(rs) ? .12 * eio(seg(u, rs + .3, rs + .8)) : 0) : 0), shk = wait * wait * (.004 + .004 * Math.max(0, Math.sin(T2 * 2.4)));
    c.m.visible = k > 0; c.m.position.copy(at); c.m.position.y += lift + (rnd() - .5) * shk; c.m.position.x += (rnd() - .5) * shk; c.m.scale.setScalar(w * Math.min(1.05, e) * (1 + .12 * pop + .06 * wait));
    c.m.quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(T2 * .5 + i) * .05 * k * (1 - fl), (1 - eio(k)) * Math.PI * .55 + Math.sin(T2 * .7 + i * 1.3) * .06 * k * (1 - fl) + fl * Math.PI, (1 - eio(k)) * .25)));
    c.m.userData.body.material = g3 ? rimMat : rimDark; c.m.userData.body.scale.set(g3 ? 1 : .978, g3 ? 1 : .985, 1); /* plain cards: only a thin grey edge shows */ c.face.material.map = g3 ? T.card3 : T.card; if (!card.tex) card.tex = cardFace(card.hero, card.star); c.back.material.map = card.tex; c.face.material.opacity = c.back.material.opacity = Math.min(1, k * 2);
    c.sheen.visible = false; // no shimmer on the cards
    c.glow.visible = g3 && pop > .02; c.glow.position.copy(at).addScaledVector(camera.getWorldDirection(tmp), .05); c.glow.scale.setScalar(w * (2.4 + 1.6 * pop)); c.glow.material.color.copy(col).multiplyScalar(.5 * pop); c.glow.material.opacity = Math.min(1, k * 2);
    c.aura.visible = g3 && k > 0; if (c.aura.visible) { c.aura.position.copy(c.m.position).addScaledVector(camera.getWorldDirection(tmp), .04); c.aura.quaternion.copy(camera.quaternion); c.aura.scale.set(w * 1.75 * (1 + .1 * pop), w * 1.6 * 1.5 * (1 + .1 * pop), 1); c.aura.renderOrder = 39.5; c.aura.material.uniforms.time.value = T2; c.aura.material.uniforms.amt.value = Math.min(1, k * 2) * (.75 + wait * (.5 + .2 * Math.sin(T2 * 3)) + .8 * pop); }
    if (g3 && k > 0 && once('land' + i)) sparks.emit(40, at, col, { speed: 1.6, life: .7 });
    if (g3 && u > rs + .3 && once('pop' + i)) { sparks.emit(160, at, col, { speed: 2.6, life: 1, drag: 1.2 }); embers.emit(50, at, col, { speed: 1.2, life: 1.3, grav: .3 }); }
  });
  bookLight.intensity = 0;
}

// ---------------------------------------------------------------- UI overlay (owned by the Angular component)
const { cine, cineQuote, cineBan, cineImg, cineEp, cineTh, cineEn, cineTap, cap, hint } = opts.overlay;
function captionOf(u) {
  const w = (t, a, b) => seg(t, a, a + .45) * (1 - seg(t, b - .45, b));
  if (u == null) return ['', '', 0];
  const list = [[S.up && S.top === 3 && u > TS + .1 ? 'แสงแปรเป็นทอง · วีรชนผู้ยิ่งใหญ่กำลังมา' : S.top === 3 ? 'แสงทองตื่นขึ้นบนผนึกโบราณ' : 'แสงไหลตามลวดลายโบราณบนปก', 'THE ARCANE SEAL AWAKENS', TL.trace[0], TL.burst]];
  for (const [a, b, s0, s1] of list) { const o = w(u, s0, s1); if (o > 0) return [a, b, o]; }
  return ['', '', 0];
}
let lastCap = '', shownHero = -1, finished = false;
function ui(u) {
  const [a, b, o] = captionOf(u); if (a !== lastCap && a) { cap.querySelector('b').textContent = a; cap.querySelector('small').textContent = b; lastCap = a; } cap.style.opacity = o.toFixed(3);
  // the current gold card's intro: black, the hero's line, then the banner with both names
  const k = cineIndex(), gi = k >= 0 ? goldIdx()[k] : -1, cv = u == null || gi < 0 ? -1 : u - (S.goldTaps[k] - S.tap);
  const closed = k >= 0 ? S.cineClosed[k] : null, cineOn = gi >= 0 && cv >= 0 && !(closed != null && S.T - closed > .45);
  cine.hidden = !cineOn;
  if (cineOn) { const h = S.cards[gi].hero, out = closed != null ? 1 - clamp((S.T - closed) / .45) : 1;
    if (shownHero !== gi) { shownHero = gi; cineQuote.textContent = h.quote; cineQuote.hidden = !h.quote; if (h.banner) cineImg.src = h.banner; else cineImg.removeAttribute('src'); cineTh.textContent = h.th; cineEn.textContent = h.en; cineEp.textContent = h.epithet; }
    cine.style.opacity = (clamp(cv / .5) * out).toFixed(3);
    const qa = clamp((cv - .6) / .6) * (1 - clamp((cv - 3.1) / .4)); cineQuote.style.opacity = qa.toFixed(3); cineQuote.style.transform = `translateY(${(1 - clamp((cv - .6) / .8)) * 10}px)`;
    const ba = clamp((cv - 3.5) / .5); cineBan.style.opacity = ba.toFixed(3); cineImg.style.transform = `scale(${(1.12 - .1 * clamp((cv - 3.5) / 6)).toFixed(4)})`;
    const pa = clamp((cv - 3.9) / .5), pl = cineBan.querySelector('.cine-plate'); pl.style.opacity = pa.toFixed(3); pl.style.transform = `translateX(${(1 - pa) * -40}px)`;
    cineTap.style.opacity = (clamp((cv - 4.8) / .5) * (.6 + .4 * Math.sin(S.T * 3))).toFixed(3); }
  const gw = goldWaiting(); hint.textContent = gw ? 'แตะเพื่อเปิดการ์ดทอง' : ''; hint.hidden = !gw;
  if (!finished && u != null && u > revealEnd() && !cineOn) { finished = true; opts.onFinished(); }
}

// ---------------------------------------------------------------- loop + input
// the canvas keeps the animatic's 16:9 frame and covers the screen (crops the long side), so every shot keeps its framing
let lastW = 0, lastH = 0;
function resize() { const W = host.clientWidth, H = host.clientHeight; if (!W || !H || (W === lastW && H === lastH)) return; lastW = W; lastH = H;
  const w = Math.max(W, H * 16 / 9), h = w * 9 / 16; renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  const rw = Math.round(Math.min(w, 1920)), rh = Math.round(rw * 9 / 16); renderer.setSize(rw, rh, false); composer.setSize(rw, rh); bloom.setSize(rw, rh); }
function step(raw) {
  resize(); const dt = raw * S.speed; S.T += dt; if (S.tap == null) S.intro += dt;
  if (S.tap == null && S.intro > .6) tap(); // the player already chose to summon: a short look at the archive, then the book wakes
  const u = S.tap == null ? null : S.T - S.tap;
  if (u == null || u < TL.cut) updateShot1(S.T, u, dt); else updateShot2(S.T, u, dt);
  sparks.step(dt); embers.step(dt); grade.uniforms.uTime.value = S.T % 10;
  composer.render(dt); ui(u);
}
let last = 0;
function frame(now) { if (disposed) return; const raw = last ? clamp((now - last) / 1000, 0, .1) : 0; last = Math.max(last, now); step(raw); raf = requestAnimationFrame(frame); }
function tap() { if (S.tap != null) return; retime(); S.goldTaps = []; S.cineClosed = []; S.tap = S.T; S.once.clear(); makeCards(); }
function closeCine() { const k = cineIndex(); if (cineActive() && S.T - S.goldTaps[k] > 3.9) S.cineClosed[k] = S.T; }
const onCanvas = () => { if (S.tap == null) return; if (goldWaiting()) S.goldTaps.push(S.T); else closeCine(); };
const onCine = e => { e.stopPropagation(); closeCine(); };
renderer.domElement.addEventListener('click', onCanvas); cine.addEventListener('click', onCine);
fg.traverse(o => { if (o.isSprite || o.isPoints) fxHide.push(o); });

{ // reflections come from the library itself: bake the room once into the environment map
  const rt = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType }), cube = new THREE.CubeCamera(.1, 60, rt); cube.position.set(0, .4, 1.2); fg.add(cube);
  const hide = [book, shadowCatch, mirror, ...cards.map(c => c.m)]; hide.forEach(o => o.userData.v = o.visible); hide.forEach(o => o.visible = false);
  const fog = fg.fog; fg.fog = null; cube.update(renderer, fg); fg.fog = fog; hide.forEach(o => o.visible = o.userData.v);
  fg.environment = pmrem.fromCubemap(rt.texture).texture; fg.remove(cube); rt.dispose(); fxHide.push(mirror); }
raf = requestAnimationFrame(frame);

return { dispose() {
  if (disposed) return; disposed = true; cancelAnimationFrame(raf);
  renderer.domElement.removeEventListener('click', onCanvas); cine.removeEventListener('click', onCine);
  const seen = new Set();
  const free = m => { if (!m || seen.has(m)) return; seen.add(m); for (const v of Object.values(m)) if (v && v.isTexture) v.dispose(); if (m.uniforms) for (const un of Object.values(m.uniforms)) if (un.value && un.value.isTexture) un.value.dispose(); m.dispose(); };
  for (const sc of [bg, fg]) sc.traverse(o => { o.geometry?.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(free); });
  Object.values(T).forEach(t => t.dispose()); mirror.dispose?.(); pmrem.dispose(); composer.dispose?.();
  renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
} };
}
