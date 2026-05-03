// 5-Layer Rate Limiting and Burst Prevention System
// Layer 1: Route-level sliding window rate limiter
// Layer 2: Circuit breaker (per-route consecutive failure tracking)
// Layer 3: Dedup cache (same SQL within 30 seconds returns cached result)
// Layer 4: Global hard ceiling (200 outbound calls per hour, in-memory)
// Layer 5: Persistent file ledger (survives server restarts, auto-pruning)

import * as path from 'path';

// ── Types ──

export interface LedgerEntry {
  ts: number;
  route: string;
  sql?: string;
  status: 'success' | 'error' | 'blocked';
}

interface RouteConfig {
  maxRequests: number;
  windowMs: number;
}

interface SlidingWindow {
  timestamps: number[];
}

interface CircuitState {
  consecutiveFailures: number;
  state: 'closed' | 'open' | 'half-open';
  openedAt?: number;
  cooldownMs: number;
}

interface DedupEntry {
  result: any;
  timestamp: number;
}

// ── Route configs ──

const ROUTE_CONFIGS: Record<string, RouteConfig> = {
  '/api/candidates':      { maxRequests: 5,  windowMs: 30_000 },
  '/api/candidates/[id]': { maxRequests: 20, windowMs: 30_000 },
  '/api/chat':            { maxRequests: 10, windowMs: 60_000 },
  '/api/query':           { maxRequests: 10, windowMs: 60_000 },
  '/api/schema':          { maxRequests: 3,  windowMs: 60_000 },
  '/api/catalogs':        { maxRequests: 3,  windowMs: 60_000 },
  'rest:query':           { maxRequests: 15, windowMs: 60_000 },
  'rest:metadata':        { maxRequests: 60, windowMs: 60_000 },
  'rest:mutation':        { maxRequests: 5,  windowMs: 60_000 },  // Phase 12: stricter for writes
};

const CIRCUIT_COOLDOWN_MS = 60_000;        // 60 seconds open before half-open
const CIRCUIT_FAILURE_THRESHOLD = 5;       // trips after 5 consecutive failures
const DEDUP_TTL_MS = 30_000;              // 30 seconds dedup window
const GLOBAL_CEILING = 500;               // max outbound calls per hour (bumped for multi-source discovery)
const LEDGER_PRUNE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours, for auto-prune
const LEDGER_COUNT_WINDOW_MS = 60 * 60 * 1000;      // 1 hour, for ceiling check

// ── In-memory stores ──

const slidingWindows = new Map<string, SlidingWindow>();
const circuitBreakers = new Map<string, CircuitState>();
const dedupCache = new Map<string, DedupEntry>();

// Global ceiling state
let globalHourStart = Date.now();
let globalCallCount = 0;

// ── Layer 1: Route-level sliding window ──

/**
 * Check whether a request for the given route is within its configured rate limit.
 * Uses a sliding window: timestamps older than windowMs are pruned before checking.
 */
export function checkRateLimit(routeKey: string): { allowed: boolean; retryAfterMs: number } {
  const config = ROUTE_CONFIGS[routeKey];
  if (!config) {
    // Unknown route — allow by default
    return { allowed: true, retryAfterMs: 0 };
  }

  const now = Date.now();
  let window = slidingWindows.get(routeKey);
  if (!window) {
    window = { timestamps: [] };
    slidingWindows.set(routeKey, window);
  }

  // Prune expired timestamps
  window.timestamps = window.timestamps.filter(ts => now - ts < config.windowMs);

  if (window.timestamps.length >= config.maxRequests) {
    // Oldest timestamp tells us when the window slides enough to allow one more
    const oldest = window.timestamps[0];
    const retryAfterMs = config.windowMs - (now - oldest);
    console.log(`[Rate Limiter] ${routeKey} rate limited — ${window.timestamps.length}/${config.maxRequests} in window. Retry in ${retryAfterMs}ms`);
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  // Record this request
  window.timestamps.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

// ── Layer 2: Circuit breaker ──

function getCircuit(routeKey: string): CircuitState {
  let circuit = circuitBreakers.get(routeKey);
  if (!circuit) {
    circuit = {
      consecutiveFailures: 0,
      state: 'closed',
      cooldownMs: CIRCUIT_COOLDOWN_MS,
    };
    circuitBreakers.set(routeKey, circuit);
  }
  return circuit;
}

/**
 * Record the outcome of a request for circuit breaker tracking.
 * On 5 consecutive failures, the circuit trips open.
 * On success during half-open, circuit closes.
 */
export function recordOutcome(routeKey: string, success: boolean): void {
  const circuit = getCircuit(routeKey);

  if (success) {
    if (circuit.state === 'half-open') {
      console.log(`[Rate Limiter] Circuit ${routeKey} closing (half-open success)`);
      circuit.state = 'closed';
    }
    circuit.consecutiveFailures = 0;
  } else {
    circuit.consecutiveFailures += 1;
    if (circuit.state === 'half-open') {
      // Half-open probe failed — re-open
      circuit.state = 'open';
      circuit.openedAt = Date.now();
      console.log(`[Rate Limiter] Circuit ${routeKey} re-opened (half-open failure)`);
    } else if (circuit.state === 'closed' && circuit.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      circuit.state = 'open';
      circuit.openedAt = Date.now();
      console.log(`[Rate Limiter] Circuit ${routeKey} OPENED after ${circuit.consecutiveFailures} failures`);
    }
  }
}

/**
 * Returns true if the circuit is open (requests should be blocked).
 * Transitions open → half-open automatically after the cooldown period.
 */
export function isCircuitOpen(routeKey: string): boolean {
  const circuit = getCircuit(routeKey);

  if (circuit.state === 'closed') return false;

  if (circuit.state === 'open') {
    const elapsed = Date.now() - (circuit.openedAt ?? 0);
    if (elapsed >= circuit.cooldownMs) {
      circuit.state = 'half-open';
      console.log(`[Rate Limiter] Circuit ${routeKey} now HALF-OPEN (cooldown elapsed)`);
      return false; // allow one probe through
    }
    return true; // still open
  }

  // half-open — allow one probe through
  return false;
}

// ── Layer 3: Dedup cache ──

/**
 * Simple non-crypto string hash (djb2 variant).
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash.toString(16);
}

/**
 * Returns cached result for the given SQL if it was stored within the last 30 seconds.
 * Returns null if no valid cache entry exists.
 */
export function getDedupResult(sql: string): any | null {
  const key = hashString(sql);
  const entry = dedupCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > DEDUP_TTL_MS) {
    dedupCache.delete(key);
    return null;
  }
  console.log(`[Rate Limiter] Dedup cache hit for SQL hash ${key}`);
  return entry.result;
}

/**
 * Store a query result in the dedup cache keyed by SQL hash.
 */
export function setDedupResult(sql: string, result: any): void {
  const key = hashString(sql);
  dedupCache.set(key, { result, timestamp: Date.now() });
}

// ── Layer 4: Global hard ceiling ──

/**
 * Check whether the global per-hour call ceiling has been reached.
 * Resets the counter automatically at the start of each new hour window.
 */
export function checkGlobalCeiling(): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  // Reset if we've passed the hour window
  if (now - globalHourStart >= 60 * 60 * 1000) {
    globalHourStart = now;
    globalCallCount = 0;
    console.log('[Rate Limiter] Global counter reset (new hour window)');
  }

  const resetAt = globalHourStart + 60 * 60 * 1000;
  const remaining = Math.max(0, GLOBAL_CEILING - globalCallCount);

  if (globalCallCount >= GLOBAL_CEILING) {
    console.log(`[Rate Limiter] Global ceiling hit — ${globalCallCount}/${GLOBAL_CEILING}. Resets at ${new Date(resetAt).toISOString()}`);
    return { allowed: false, remaining: 0, resetAt };
  }

  return { allowed: true, remaining, resetAt };
}

/**
 * Increment the global call counter. Call this after a successful outbound request.
 */
export function incrementGlobalCounter(): void {
  const now = Date.now();
  if (now - globalHourStart >= 60 * 60 * 1000) {
    globalHourStart = now;
    globalCallCount = 0;
  }
  globalCallCount += 1;
}

// ── Layer 5: Persistent file ledger ──

// Lazy-load fs/path to avoid errors on client-side imports
let fsModule: typeof import('fs') | null = null;

function getFs(): typeof import('fs') | null {
  if (fsModule) return fsModule;
  try {
    // Dynamic require to avoid client-side import errors
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    fsModule = require('fs') as typeof import('fs');
    return fsModule;
  } catch {
    return null;
  }
}

function getLedgerPath(): string {
  return path.join(process.cwd(), 'data', 'query-ledger.jsonl');
}

function ensureDataDir(): void {
  const fs = getFs();
  if (!fs) return;
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('[Rate Limiter] Created data/ directory for ledger');
  }
}

/**
 * Read ledger entries, prune those older than 2 hours, and write pruned file back.
 * Returns all remaining entries.
 */
function readAndPruneLedger(): LedgerEntry[] {
  const fs = getFs();
  if (!fs) return [];

  const ledgerPath = getLedgerPath();
  ensureDataDir();

  if (!fs.existsSync(ledgerPath)) return [];

  let content: string;
  try {
    content = fs.readFileSync(ledgerPath, 'utf-8');
  } catch {
    return [];
  }

  const now = Date.now();
  const cutoff = now - LEDGER_PRUNE_WINDOW_MS;

  const entries: LedgerEntry[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = JSON.parse(trimmed) as LedgerEntry;
      if (entry.ts >= cutoff) {
        entries.push(entry);
      }
    } catch {
      // Skip malformed lines
    }
  }

  // Write pruned file back (only if something was removed)
  const pruned = content.split('\n').filter(l => l.trim()).length - entries.length;
  if (pruned > 0) {
    const newContent = entries.map(e => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '');
    try {
      fs.writeFileSync(ledgerPath, newContent, 'utf-8');
      console.log(`[Rate Limiter] Pruned ${pruned} old ledger entries`);
    } catch (err) {
      console.log('[Rate Limiter] Failed to write pruned ledger:', (err as Error).message);
    }
  }

  return entries;
}

/**
 * Count ledger entries within the given window (default: last 1 hour).
 * Also triggers auto-prune of entries older than 2 hours.
 */
export function getLedgerCount(windowMs: number = LEDGER_COUNT_WINDOW_MS): number {
  const entries = readAndPruneLedger();
  const cutoff = Date.now() - windowMs;
  // Only count actual outbound calls (success/error), NOT blocked entries
  // Blocked entries are local rejections that never hit the remote API
  return entries.filter(e => e.ts >= cutoff && e.status !== 'blocked').length;
}

/**
 * Append a single entry to the ledger file.
 * Creates the data/ directory and file if they don't exist.
 */
export function persistQuery(entry: LedgerEntry): void {
  const fs = getFs();
  if (!fs) return;

  ensureDataDir();
  const ledgerPath = getLedgerPath();

  try {
    fs.appendFileSync(ledgerPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (err) {
    console.log('[Rate Limiter] Failed to persist ledger entry:', (err as Error).message);
  }
}

// ── Mutation detection ──

/**
 * Detect whether a SQL string is a mutation (UPDATE/INSERT/DELETE).
 * Used to route through stricter rate limiting and bypass dedup cache.
 */
export function isMutation(sql: string): boolean {
  const trimmed = sql.trim().toUpperCase();
  return trimmed.startsWith('UPDATE ') ||
    trimmed.startsWith('INSERT ') ||
    trimmed.startsWith('DELETE ') ||
    trimmed.startsWith('MERGE ');
}

// ── Combined gateway function ──

export interface GatewayResult {
  allowed: boolean;
  reason?: 'rate-limit' | 'circuit-open' | 'dedup' | 'ceiling' | 'ledger-ceiling';
  cachedResult?: any;
  retryAfterMs?: number;
  remaining?: number;
}

/**
 * The single entry point for all API routes.
 * Checks all 5 protection layers in order and returns the first block reason.
 *
 * Layer order:
 *   1. Persistent ledger ceiling (survives restarts)
 *   2. Global in-memory ceiling
 *   3. Circuit breaker
 *   4. Route rate limit (sliding window)
 *   5. Dedup cache (returns cached result if hit)
 */
export function gatewayCheck(routeKey: string, sql?: string): GatewayResult {
  // Layer 1: Persistent ledger ceiling
  const ledgerCount = getLedgerCount();
  if (ledgerCount >= GLOBAL_CEILING) {
    console.log(`[Rate Limiter] BLOCKED by ledger ceiling — ${ledgerCount} calls in last hour`);
    persistQuery({ ts: Date.now(), route: routeKey, sql, status: 'blocked' });
    return { allowed: false, reason: 'ledger-ceiling', remaining: 0 };
  }

  // Layer 2: Global in-memory ceiling
  const ceiling = checkGlobalCeiling();
  if (!ceiling.allowed) {
    persistQuery({ ts: Date.now(), route: routeKey, sql, status: 'blocked' });
    return { allowed: false, reason: 'ceiling', remaining: 0, retryAfterMs: ceiling.resetAt - Date.now() };
  }

  // Layer 3: Circuit breaker
  if (isCircuitOpen(routeKey)) {
    const circuit = getCircuit(routeKey);
    const elapsed = Date.now() - (circuit.openedAt ?? 0);
    const retryAfterMs = Math.max(0, circuit.cooldownMs - elapsed);
    console.log(`[Rate Limiter] BLOCKED by circuit breaker — ${routeKey}`);
    persistQuery({ ts: Date.now(), route: routeKey, sql, status: 'blocked' });
    return { allowed: false, reason: 'circuit-open', retryAfterMs };
  }

  // Layer 4: Route rate limit
  const rl = checkRateLimit(routeKey);
  if (!rl.allowed) {
    persistQuery({ ts: Date.now(), route: routeKey, sql, status: 'blocked' });
    return { allowed: false, reason: 'rate-limit', retryAfterMs: rl.retryAfterMs };
  }

  // Layer 5: Dedup cache
  if (sql) {
    const cached = getDedupResult(sql);
    if (cached !== null) {
      return { allowed: true, reason: 'dedup', cachedResult: cached };
    }
  }

  return { allowed: true, remaining: ceiling.remaining };
}
