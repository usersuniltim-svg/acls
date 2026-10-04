/**
 * What a signed-in clinician may ask the AI endpoints for. Everything from the
 * browser is treated as untrusted input: sizes are capped, the model and role
 * must be on an allowlist, and the system instructions come from the server.
 */
import { COPILOT_ROLES } from '../src/lib/copilotRoles';
import type { CopilotRole } from '../src/types';

/** Models the copilot screen offers. Anything else falls back to the default. */
export const ALLOWED_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.7-flash'] as const;
export const DEFAULT_MODEL = 'gemini-2.5-flash';
/** Choosing this on screen means "built-in reference notes only, no AI call". */
export const OFFLINE_MODEL = 'rag-protocol-engine';

export const LIMITS = {
  maxMessages: 30,
  maxMessageChars: 4000,
  maxTotalChars: 24000,
  maxQueryChars: 1000,
};

export interface CodeContext {
  elapsedMinutes?: number;
  cprCycle?: number;
  shocks?: number;
  epinephrineDoses?: number;
  rhythm?: 'SHOCKABLE' | 'NON_SHOCKABLE' | 'UNKNOWN';
}

export interface ChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** null = offline reference notes only. */
  model: string | null;
  role: CopilotRole;
  useSearchGrounding: boolean;
  codeContext: CodeContext | null;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function pickModel(model: unknown): string | null {
  if (model === OFFLINE_MODEL) return null;
  return typeof model === 'string' && (ALLOWED_MODELS as readonly string[]).includes(model) ? model : DEFAULT_MODEL;
}

function pickRole(role: unknown): CopilotRole {
  return typeof role === 'string' && (COPILOT_ROLES as string[]).includes(role) ? (role as CopilotRole) : 'acls_expert';
}

function smallCount(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 10000 ? Math.floor(v) : undefined;
}

function pickCodeContext(ctx: unknown): CodeContext | null {
  if (!ctx || typeof ctx !== 'object') return null;
  const c = ctx as Record<string, unknown>;
  const rhythm = c.rhythm === 'SHOCKABLE' || c.rhythm === 'NON_SHOCKABLE' ? c.rhythm : 'UNKNOWN';
  const out: CodeContext = {
    elapsedMinutes: smallCount(c.elapsedMinutes),
    cprCycle: smallCount(c.cprCycle),
    shocks: smallCount(c.shocks),
    epinephrineDoses: smallCount(c.epinephrineDoses),
    rhythm,
  };
  return out.cprCycle ? out : null;
}

export function validateChatRequest(body: unknown): Result<ChatRequest> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    return { ok: false, error: 'Messages are required.' };
  }
  if (b.messages.length > LIMITS.maxMessages) {
    return { ok: false, error: `Too many messages in one request (max ${LIMITS.maxMessages}). Start a new conversation.` };
  }
  const messages: ChatRequest['messages'] = [];
  let total = 0;
  for (const m of b.messages) {
    const content = (m as any)?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      return { ok: false, error: 'Each message needs text.' };
    }
    if (content.length > LIMITS.maxMessageChars) {
      return { ok: false, error: `A message is too long (max ${LIMITS.maxMessageChars} characters).` };
    }
    total += content.length;
    messages.push({ role: (m as any)?.role === 'assistant' ? 'assistant' : 'user', content });
  }
  if (total > LIMITS.maxTotalChars) {
    return { ok: false, error: 'This conversation is too long. Start a new conversation.' };
  }
  return {
    ok: true,
    value: {
      messages,
      model: pickModel(b.model),
      role: pickRole(b.role),
      useSearchGrounding: b.useSearchGrounding === true,
      codeContext: pickCodeContext(b.codeContext),
    },
  };
}

export function validateSearchRequest(body: unknown): Result<{ query: string }> {
  const q = (body as any)?.query;
  if (typeof q !== 'string' || q.trim().length === 0) return { ok: false, error: 'A search query is required.' };
  if (q.length > LIMITS.maxQueryChars) return { ok: false, error: `The search query is too long (max ${LIMITS.maxQueryChars} characters).` };
  return { ok: true, value: { query: q.trim() } };
}

/** One line describing the live code, built from numbers only (no free text from the browser). */
export function codeContextLine(ctx: CodeContext | null): string {
  if (!ctx) return '';
  const rhythm = ctx.rhythm === 'SHOCKABLE' ? 'VF/pVT' : ctx.rhythm === 'NON_SHOCKABLE' ? 'asystole/PEA' : 'not recorded';
  return `\n[Live code: ${ctx.elapsedMinutes ?? 0} min elapsed, CPR cycle ${ctx.cprCycle ?? 0}, ${ctx.shocks ?? 0} shocks, ${ctx.epinephrineDoses ?? 0} epinephrine doses, current rhythm ${rhythm}]`;
}

/**
 * Per-user request limit (sliding window). In memory: each server instance
 * keeps its own count, which is enough to stop runaway use of the API key.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private limit: number, private windowMs: number, private now: () => number = Date.now) {}

  take(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter(h => h > t - this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + this.windowMs - t) / 1000)) };
    }
    recent.push(t);
    this.hits.set(key, recent);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
