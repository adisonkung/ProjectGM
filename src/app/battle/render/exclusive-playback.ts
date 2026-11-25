/** All visual IDs share the battle page's monotonic sequence. Existing effects wait; the new action plays. */
export interface UltimatePlayback { actor: number; afterId: number }

/** Per-instance sampling retains frozen time instead of jumping ahead when the action ends. */
export class PlaybackClocks {
  private readonly clocks = new Map<string, { time: number; input: number }>();
  sample(key: string, input: number, frozen: boolean): number {
    const c = this.clocks.get(key) ?? { time: input, input };
    if (!frozen) c.time += Math.max(0, input - c.input);
    c.input = input;
    this.clocks.set(key, c);
    return c.time;
  }
  retain(keys: Set<string>): void { for (const key of this.clocks.keys()) if (!keys.has(key)) this.clocks.delete(key); }
  clear(): void { this.clocks.clear(); }
}
