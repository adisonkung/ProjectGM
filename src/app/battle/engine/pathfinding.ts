import { Cell } from '../../core/models/unit';
import { distance, Grid } from './grid';

/**
 * หาก้าวถัดไปจาก start ไปยังช่องใดก็ได้ที่ isGoal เป็นจริง ด้วย BFS 8 ทิศ
 * เดินผ่านได้เฉพาะช่องที่ยังไม่เต็ม (grid.canEnter) คืนค่า null ถ้าไม่มีทางไป หรือยืนอยู่ในเป้าหมายแล้ว
 */
export function nextStep(grid: Grid, start: Cell, isGoal: (c: Cell) => boolean): Cell | null {
  if (isGoal(start)) return null;
  const startKey = Grid.key(start);
  const firstStep = new Map<number, Cell>();
  const queue: Cell[] = [];
  const seen = new Set<number>([startKey]);

  for (const n of Grid.neighbors(start)) {
    if (!grid.canEnter(n)) continue;
    const k = Grid.key(n);
    seen.add(k);
    firstStep.set(k, n);
    queue.push(n);
  }

  while (queue.length) {
    const cur = queue.shift()!;
    const first = firstStep.get(Grid.key(cur))!;
    if (isGoal(cur)) return first;
    for (const n of Grid.neighbors(cur)) {
      const k = Grid.key(n);
      if (seen.has(k) || !grid.canEnter(n)) continue;
      seen.add(k);
      firstStep.set(k, first);
      queue.push(n);
    }
  }
  return null;
}

/** ถ้าไปไม่ถึงเป้าหมาย ให้ขยับเข้าใกล้ target มากที่สุดเท่าที่ทำได้ 1 ก้าว */
export function greedyStep(grid: Grid, start: Cell, target: Cell): Cell | null {
  let best: Cell | null = null;
  let bestD = distance(start, target);
  for (const n of Grid.neighbors(start)) {
    if (!grid.canEnter(n)) continue;
    const d = distance(n, target);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}
