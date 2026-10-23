import { GameState } from '../models/game-state';

/**
 * Account identity (island name) + save transfer — pure rules, no browser APIs except the optional
 * CompressionStream path in `encodeSaveCode` (falls back to plain when the browser has none).
 *
 * Step 1 of the login plan (project doc `claude/account-login-cloud-save-plan.md`): the island is named on first launch
 * and a save can move to another device with a transfer code or a file. Cloud login / sync comes later and reuses
 * the same `SaveEnvelope` shape.
 */

// ------------------------------------------------------------------ island name

export const ISLAND_NAME_MIN = 2;
export const ISLAND_NAME_MAX = 16;

/** letters (any script, incl. Thai vowels / tone marks), digits, space and a few joiners */
const ALLOWED = /^[\p{L}\p{M}\p{N} '\-_.]+$/u;

/** trim, collapse inner whitespace, drop control / invisible characters */
export function normalizeIslandName(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** visible characters (Thai combining marks count with their base letter) */
export function nameLength(name: string): number {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<unknown> } }).Segmenter;
  if (Seg) return [...new Seg('th', { granularity: 'grapheme' }).segment(name)].length;
  return [...name.replace(/\p{M}/gu, '')].length;
}

/** null when the (normalized) name is valid, else a Thai message for the form */
export function islandNameError(name: string): string | null {
  const n = normalizeIslandName(name);
  if (!n) return 'ตั้งชื่อเกาะก่อนนะ';
  const len = nameLength(n);
  if (len < ISLAND_NAME_MIN) return `ชื่อสั้นไป (อย่างน้อย ${ISLAND_NAME_MIN} ตัวอักษร)`;
  if (len > ISLAND_NAME_MAX) return `ชื่อยาวไป (ไม่เกิน ${ISLAND_NAME_MAX} ตัวอักษร)`;
  if (!ALLOWED.test(n)) return 'ใช้ได้เฉพาะตัวอักษร ตัวเลข เว้นวรรค และ - _ . \'';
  if (!/[\p{L}\p{N}]/u.test(n)) return 'ต้องมีตัวอักษรหรือตัวเลขอย่างน้อย 1 ตัว';
  return null;
}

export const needsIslandName = (s: Pick<GameState, 'island'>) => !s.island?.name;

/** set / rename — null when the name is invalid */
export function setIslandName<S extends Pick<GameState, 'island'>>(s: S, raw: string): S | null {
  const name = normalizeIslandName(raw);
  if (islandNameError(name) || !s.island) return null;
  return { ...s, island: { ...s.island, name } };
}

const NAME_A = ['อรุณ', 'จันทรา', 'ดารา', 'มรกต', 'ไพลิน', 'หมอกเงิน', 'ลมทอง', 'สายรุ้ง', 'เมฆา', 'ประกาย', 'นิรันดร์', 'ราตรี'];
const NAME_B = ['ลอยฟ้า', 'สวรรค์', 'แห่งฝัน', 'พฤกษา', 'ดาวตก', 'รุ่งอรุณ', 'คีรี', 'นภา', 'วารี', 'อัคนี'];
/** a random suggestion for the naming screen (always valid) */
export function suggestIslandName(rng: () => number = Math.random): string {
  const a = NAME_A[Math.floor(rng() * NAME_A.length)];
  const b = NAME_B[Math.floor(rng() * NAME_B.length)];
  const n = `${a}${b}`;
  return nameLength(n) <= ISLAND_NAME_MAX ? n : a;
}

// ------------------------------------------------------------------ save transfer (code / file)

/** Stable legacy save identifier; the Eldervane display name does not change save compatibility. */
export const SAVE_APP_ID = 'summon-tower';
export const SAVE_FORMAT = 1;

/** what leaves the device (file / code); a future cloud save stores the same shape */
export interface SaveEnvelope {
  app: typeof SAVE_APP_ID;
  format: number;
  exportedAt: string;
  islandName?: string;
  state: GameState;
}

export const makeEnvelope = (state: GameState, now = new Date()): SaveEnvelope => ({
  app: SAVE_APP_ID,
  format: SAVE_FORMAT,
  exportedAt: now.toISOString(),
  ...(state.island?.name ? { islandName: state.island.name } : {}),
  state,
});

/** 32-bit FNV-1a → 8 hex (detects a truncated / mistyped paste, not tampering) */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const toB64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

type Stream = { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> };
const streamCtor = (name: 'CompressionStream' | 'DecompressionStream') =>
  (globalThis as unknown as Record<string, (new (f: string) => Stream) | undefined>)[name];

async function pipe(bytes: Uint8Array, s: Stream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(s)).arrayBuffer();
  return new Uint8Array(await out);
}

/**
 * Transfer code: `ST1Z.<base64url deflate(json)>.<checksum>` (compressed) or `ST1.<base64url json>.<checksum>`.
 * The checksum covers the JSON text, so a damaged code is refused before anything is overwritten.
 */
export async function encodeSaveCode(env: SaveEnvelope, compress = true): Promise<string> {
  const json = JSON.stringify(env);
  const sum = checksum(json);
  const raw = new TextEncoder().encode(json);
  const CS = streamCtor('CompressionStream');
  if (compress && CS) {
    try {
      return `ST1Z.${toB64Url(await pipe(raw, new CS('deflate-raw')))}.${sum}`;
    } catch {
      /* fall through to plain */
    }
  }
  return `ST1.${toB64Url(raw)}.${sum}`;
}

export type DecodeResult = { ok: true; envelope: SaveEnvelope } | { ok: false; error: string };

/** a transfer code or the text of an exported .json file */
export async function decodeSaveText(text: string): Promise<DecodeResult> {
  const t = text.trim().replace(/\s+/g, '');
  if (!t) return { ok: false, error: 'ยังไม่ได้ใส่รหัสหรือไฟล์' };
  let json: string;
  if (t.startsWith('{')) {
    json = text.trim();
  } else {
    const m = /^(ST1Z?)\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(t);
    if (!m) return { ok: false, error: 'รูปแบบรหัสไม่ถูกต้อง — คัดลอกมาไม่ครบหรือเปล่า?' };
    try {
      let bytes = fromB64Url(m[2]);
      if (m[1] === 'ST1Z') {
        const DS = streamCtor('DecompressionStream');
        if (!DS) return { ok: false, error: 'เบราว์เซอร์นี้เปิดรหัสแบบบีบอัดไม่ได้ — ใช้ไฟล์เซฟแทน' };
        bytes = await pipe(bytes, new DS('deflate-raw'));
      }
      json = new TextDecoder().decode(bytes);
    } catch {
      return { ok: false, error: 'รหัสเสียหาย — คัดลอกมาไม่ครบหรือเปล่า?' };
    }
    if (checksum(json) !== m[3]) return { ok: false, error: 'รหัสไม่ตรงกับ checksum — คัดลอกมาไม่ครบหรือพิมพ์ผิด' };
  }
  let env: Partial<SaveEnvelope>;
  try {
    env = JSON.parse(json);
  } catch {
    return { ok: false, error: 'อ่านข้อมูลเซฟไม่ได้' };
  }
  if (env?.app !== SAVE_APP_ID || typeof env.format !== 'number' || !env.state) return { ok: false, error: 'ไม่ใช่เซฟของ Eldervane' };
  if (env.format > SAVE_FORMAT) return { ok: false, error: 'เซฟนี้มาจากเกมเวอร์ชันใหม่กว่า — อัปเดตเกมก่อน' };
  return { ok: true, envelope: env as SaveEnvelope };
}

/** a short human summary for the "overwrite this device?" confirmation */
export function saveSummary(s: Pick<GameState, 'island' | 'heroes' | 'cleared' | 'gems'>) {
  return { name: s.island?.name ?? '(ยังไม่ตั้งชื่อ)', heroes: s.heroes.length, cleared: s.cleared, gems: s.gems };
}
