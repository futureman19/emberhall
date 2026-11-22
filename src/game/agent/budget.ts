/**
 * Budget guard — the pre-call cost gate. Enforces at most
 * DEFAULT_DAILY_CAP_MICROS ($0.50) per agent per COST DAY.
 *
 * COST DAY DEFINITION (the plan leaves "day" unspecified — this is the
 * locked interpretation): a UTC calendar day, derived from the wall clock.
 * Provider billing and the plan's $0.50/agent/day gate are wall-clock
 * concepts; the vale's in-simulation day (24 sim hours over ticks) plays
 * NO role in cost accounting and is never consulted here.
 *
 * Model: the guard holds, per (agent, cost-day) bucket, the SETTLED spend
 * (actual costs from completed attempts) plus open RESERVATIONS
 * (conservative pre-call estimates). reserve() is a single synchronous
 * check-and-add — in Node's single-threaded runtime that makes concurrent
 * authorization atomic within the process: two interleaved callers can
 * never both pass a check that only has budget for one.
 *
 * Crash/restart story: reservations die with the process, but every attempt
 * is already durable in the attempt log — BudgetGuard.fromAttempts() rebuilds
 * settled spend from the log (interrupted attempts included, at estimated
 * cost), so a restarted host re-derives the same day bucket instead of
 * resetting it. Reservations that never settle within reservationTtlMs are
 * reconciled by charging their full estimate (a lost reservation may have
 * been a billed call — fail closed).
 *
 * Honesty note: this is a pre-call gate with post-call reconciliation, not
 * a hard real-time billing limit. If a provider's actual usage exceeds the
 * reservation estimate, settled spend can overshoot the cap by at most the
 * final call's delta; every later reserve() then refuses. Estimates are
 * deliberately conservative (see pricing.ts) to make that path rare.
 */
import { costDayOf, type FoldedAttempt } from "./attempts.ts";

import { assertAmount } from "./pricing.ts";

export const DEFAULT_DAILY_CAP_MICROS = 500_000; // $0.50 — the Phase 3 hard gate.
export const DEFAULT_RESERVATION_TTL_MS = 5 * 60 * 1000;

export interface BudgetConfig {
  dailyCapMicros?: number;
  /** Wall clock in ms epoch — injected for tests and day-boundary work. */
  clock?: () => number;
  reservationTtlMs?: number;
}

export interface BudgetSnapshot {
  agentId: string;
  day: string;
  capMicros: number;
  spentMicros: number;
  reservedMicros: number;
  remainingMicros: number;
  openReservations: number;
}

export type ReserveResult =
  | { ok: true; reservationId: string; snapshot: BudgetSnapshot }
  | { ok: false; reason: string; snapshot: BudgetSnapshot };

interface Reservation {
  id: string;
  estimateMicros: number;
  createdAt: number;
}

interface DayBucket {
  day: string;
  spentMicros: number;
  reservations: Map<string, Reservation>;
}

export class BudgetGuard {
  readonly capMicros: number;
  readonly clock: () => number;
  readonly ttlMs: number;
  /** Key: `${agentId}${day}` — old day buckets are kept for audit. */
  private buckets = new Map<string, DayBucket>();
  private seq = 0;
  private closedReason: string | null = null;

  /** Persistent for this guard instance; only reconstruction can reopen it. */
  failClosed(reason: string): void {
    this.closedReason ??= reason;
  }

  constructor(cfg: BudgetConfig = {}) {
    this.capMicros =
      cfg.dailyCapMicros === undefined ? DEFAULT_DAILY_CAP_MICROS : cfg.dailyCapMicros;
    this.clock = cfg.clock ?? Date.now;
    this.ttlMs =
      cfg.reservationTtlMs === undefined ? DEFAULT_RESERVATION_TTL_MS : cfg.reservationTtlMs;
    assertAmount(this.capMicros, "daily cap");
    assertAmount(this.ttlMs, "reservation TTL");
  }

  private bucketFor(agentId: string, day: string): DayBucket {
    const key = `${agentId}${day}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { day, spentMicros: 0, reservations: new Map() };
      this.buckets.set(key, b);
    }
    return b;
  }

  private charge(b: DayBucket, amount: number): void {
    const total = b.spentMicros + amount;
    if (!Number.isSafeInteger(total)) {
      this.failClosed("accounting total overflow");
      throw new RangeError("invalid accounting total");
    }
    b.spentMicros = total;
  }

  private reservedMicros(b: DayBucket): number {
    let sum = 0;
    for (const r of b.reservations.values()) sum += r.estimateMicros;
    return sum;
  }

  snapshot(agentId: string, day: string = costDayOf(this.clock())): BudgetSnapshot {
    const b = this.bucketFor(agentId, day);
    const reserved = this.reservedMicros(b);
    return {
      agentId,
      day,
      capMicros: this.capMicros,
      spentMicros: b.spentMicros,
      reservedMicros: reserved,
      remainingMicros: this.capMicros - b.spentMicros - reserved,
      openReservations: b.reservations.size,
    };
  }

  /**
   * Pre-call authorization. Synchronous and atomic: the availability check
   * and the reservation insert happen in one uninterrupted run, so
   * concurrent async callers cannot oversubscribe the day.
   */
  reserve(agentId: string, estimateMicros: number): ReserveResult {
    assertAmount(estimateMicros, "reservation");
    const day = costDayOf(this.clock());
    if (this.closedReason !== null) {
      return { ok: false, reason: this.closedReason, snapshot: this.snapshot(agentId, day) };
    }
    const b = this.bucketFor(agentId, day);
    const committed = b.spentMicros + this.reservedMicros(b);
    if (committed + estimateMicros > this.capMicros) {
      return {
        ok: false,
        reason:
          `daily cap $${(this.capMicros / 1e6).toFixed(2)} for agent ${agentId} on ${day}: ` +
          `${committed} micros committed + ${estimateMicros} requested > ${this.capMicros}`,
        snapshot: this.snapshot(agentId, day),
      };
    }
    this.seq += 1;
    const id = `r${this.clock().toString(36)}-${this.seq.toString(36)}`;
    b.reservations.set(id, { id, estimateMicros, createdAt: this.clock() });
    return { ok: true, reservationId: id, snapshot: this.snapshot(agentId, day) };
  }

  /**
   * Replace a reservation with the attempt's ACTUAL cost, charged to the
   * reservation's own day bucket (the call belongs to the day it started).
   * Actual may exceed the estimate — see the header honesty note.
   */
  settle(agentId: string, reservationId: string, actualMicros: number): void {
    assertAmount(actualMicros, "settlement");
    const b = this.findBucketWith(agentId, reservationId);
    if (!b) {
      // Unknown reservation (e.g. the guard was rebuilt mid-flight): fail
      // closed — charge the current day rather than losing the spend.
      this.charge(this.bucketFor(agentId, costDayOf(this.clock())), actualMicros);
      return;
    }
    this.charge(b, actualMicros);
    b.reservations.delete(reservationId);
  }

  /** The call was never sent (validation failed pre-flight): drop the hold. */
  voidReservation(agentId: string, reservationId: string): void {
    this.findBucketWith(agentId, reservationId)?.reservations.delete(reservationId);
  }

  private findBucketWith(agentId: string, reservationId: string): DayBucket | null {
    for (const [key, b] of this.buckets) {
      if (key.startsWith(`${agentId}`) && b.reservations.has(reservationId)) return b;
    }
    return null;
  }

  /**
   * Fail-closed cleanup: reservations older than the TTL are charged their
   * full estimate and closed. A reservation whose process died mid-call may
   * have been billed; silence is never free.
   */
  reconcile(now: number = this.clock()): { expired: string[]; chargedMicros: number } {
    const expired: string[] = [];
    let charged = 0;
    for (const b of this.buckets.values()) {
      for (const [id, r] of b.reservations) {
        if (now - r.createdAt >= this.ttlMs) {
          this.charge(b, r.estimateMicros);
          b.reservations.delete(id);
          expired.push(id);
          charged += r.estimateMicros;
        }
      }
    }
    return { expired, chargedMicros: charged };
  }

  /**
   * Rebuild day buckets from the durable attempt log — the reconciliation
   * path after a restart. Every folded attempt (settled AND interrupted)
   * charges its cost to its own cost day; blocked attempts contribute their
   * honest $0. Open reservations start empty: the log is the truth.
   */
  static fromAttempts(folded: FoldedAttempt[], cfg: BudgetConfig = {}): BudgetGuard {
    const guard = new BudgetGuard(cfg);
    for (const a of folded) {
      assertAmount(a.cost.micros, "restored cost");
      const bucket = guard.bucketFor(a.agentId, a.day);
      assertAmount(bucket.spentMicros + a.cost.micros, "restored total");
      bucket.spentMicros += a.cost.micros;
    }
    return guard;
  }
}
