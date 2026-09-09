/**
 * Sliding event window.
 *
 * Detection needs history: beaconing is invisible in a single event and a DGA
 * burst only looks like one when you can count the failures. The agent keeps a
 * bounded window in memory and re-analyses it on a timer.
 *
 * Bounded on purpose — an unbounded buffer is how a demo dies at minute four.
 */

import type { DnsEvent } from "@sentinel/dns-schema";

export class EventWindow {
  #events: DnsEvent[] = [];

  constructor(
    /** How much event-time history to keep. */
    private readonly windowSec: number = 300,
    /** Hard ceiling regardless of time, to bound memory. */
    private readonly maxEvents: number = 20_000,
  ) {}

  add(e: DnsEvent): void {
    this.#events.push(e);
    if (this.#events.length > this.maxEvents) {
      this.#events.splice(0, this.#events.length - this.maxEvents);
    }
  }

  /** Drops anything older than `windowSec` before the newest event seen. */
  prune(): void {
    if (this.#events.length === 0) return;
    const newest = this.#events.reduce(
      (m, e) => Math.max(m, Date.parse(e.timestamp)),
      0,
    );
    const cutoff = newest - this.windowSec * 1000;
    this.#events = this.#events.filter((e) => Date.parse(e.timestamp) >= cutoff);
  }

  snapshot(): DnsEvent[] {
    this.prune();
    return [...this.#events];
  }

  get size(): number {
    return this.#events.length;
  }
}
