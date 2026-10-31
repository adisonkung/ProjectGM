/** Cell-relative FX offsets use the cell centre; authored feet stay at 78.5% of its height. */
export function bossPoint(point: readonly [number,number], ratio:number): [number,number] {
  return [point[0]*ratio,28.5+(point[1]-28.5)*ratio];
}
