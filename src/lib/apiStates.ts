//============================================================================
//Build-ahead empty-state helpers (deep-audit B3) — pure, node-testable.
//
//The API's gated surfaces return 202 {"status":"computing","retry_after":<s>}
//when a result is deliberately not served yet (freshness gate, first compute).
//That is a HEALTHY state, not an outage: tables must branch on isComputing()
//and say "Computing now …", keeping "The stats API is offline" reserved for
//real network/5xx failure. computingMessage() builds the Lane-Lab-style copy
//(LaneLabIsland.laneAheadMessage precedent) and surfaces the 202 body's
//retry_after as a coarse "check back in ~2 h" hint when present.
//============================================================================
import { ApiError } from './apiClient';

//retry_after (seconds) from a 202 ApiError body; null when the body is absent,
//malformed, or carries a non-positive value — the copy then falls back to
//"shortly" instead of a time hint.
export function retryAfterSeconds(error: unknown): number | null {
  if (!(error instanceof ApiError) || !error.body) return null;
  try {
    const retry = (JSON.parse(error.body) as { retry_after?: unknown }).retry_after;
    return typeof retry === 'number' && Number.isFinite(retry) && retry > 0 ? retry : null;
  } catch {
    return null;
  }
}

//Coarse human label for the retry hint — "~45 sec" / "~30 min" / "~2 h". It is
//a hint, not a countdown, so the rounding is deliberate.
export function retryAfterLabel(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))} sec`;
  if (seconds < 3600) return `~${Math.max(1, Math.round(seconds / 60))} min`;
  return `~${Math.max(1, Math.round(seconds / 3600))} h`;
}

//The 202 empty-state message: pass the "<what> is being generated"-style clause
//(no trailing period) and the query error; the retry_after hint rides along when
//the 202 body carried one.
export function computingMessage(what: string, error?: unknown): string {
  const hint = retryAfterLabel(retryAfterSeconds(error));
  return `Computing now — ${what}. ${hint ? `Check back in ${hint}.` : 'Check back shortly.'}`;
}
