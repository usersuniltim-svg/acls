/**
 * The API routes, built as a function so tests can run them with fake
 * identity checks and no Gemini key.
 *
 * Every /api/gemini route requires a verified Firebase sign-in of the admin or
 * a KYC-approved doctor (see auth.ts), is rate-limited per user, and accepts
 * only validated input (see copilotPolicy.ts).
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import type { GoogleGenAI } from '@google/genai';
import { ACLS_RAG_KNOWLEDGE_BASE, queryAclsRag } from '../src/lib/aclsRagKnowledge';
import { COPILOT_ROLE_INSTRUCTIONS } from '../src/lib/copilotRoles';
import { AuthError, authorizeClinician, type AuthDeps, type ClinicianAccess } from './auth';
import { RateLimiter, codeContextLine, validateChatRequest, validateSearchRequest } from './copilotPolicy';

export interface AppDeps {
  auth: AuthDeps;
  getGenAI: () => GoogleGenAI | null;
  /** Defaults to 30 requests per 10 minutes per user. */
  rateLimiter?: RateLimiter;
}

type AuthedRequest = Request & { clinician?: ClinicianAccess };

export function createApp(deps: AppDeps) {
  const app = express();
  app.use(express.json({ limit: '200kb' }));
  const limiter = deps.rateLimiter ?? new RateLimiter(30, 10 * 60 * 1000);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now(), ragKnowledgeChunks: ACLS_RAG_KNOWLEDGE_BASE.length });
  });

  /** Signed-in admin or KYC-approved doctor only. */
  const requireClinician = async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      req.clinician = await authorizeClinician(req.header('authorization'), deps.auth);
      next();
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.status).json({ error: err.message });
      } else {
        console.error('Authorization check failed:', err);
        res.status(503).json({ error: 'Could not check your sign-in. Please try again.' });
      }
    }
  };

  const rateLimit = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const verdict = limiter.take(req.clinician!.user.uid);
    if (!verdict.allowed) {
      res.setHeader('Retry-After', String(verdict.retryAfterSeconds));
      res.status(429).json({ error: `Too many AI requests. Try again in ${verdict.retryAfterSeconds} seconds.` });
      return;
    }
    next();
  };

  app.post('/api/gemini/chat', requireClinician, rateLimit, async (req: AuthedRequest, res) => {
    const parsed = validateChatRequest(req.body);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    const { messages, model, role, useSearchGrounding, codeContext } = parsed.value;

    const latestUserMsg = messages[messages.length - 1].content;
    const relevantRagDocs = queryAclsRag(latestUserMsg, 3);
    const ragContextText = relevantRagDocs
      .map(doc => `### [Reference: ${doc.title} (${doc.category})]\n${doc.protocolContent}\nSource: ${doc.source}`)
      .join('\n\n');
    const systemInstruction = `${COPILOT_ROLE_INSTRUCTIONS[role]}${codeContextLine(codeContext)}\n\nReference notes:\n${ragContextText}`;

    const ai = model ? deps.getGenAI() : null;
    if (ai && model) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          config: { systemInstruction, ...(useSearchGrounding ? { tools: [{ googleSearch: {} }] } : {}) },
        });
        const grounding = response.candidates?.[0]?.groundingMetadata;
        return res.json({
          text: response.text || '',
          groundingChunks: (grounding?.groundingChunks || []).map((chunk: any) => ({
            uri: chunk.web?.uri || '',
            title: chunk.web?.title || 'Clinical Reference',
          })),
          webSearchQueries: grounding?.webSearchQueries || [],
          ragSources: relevantRagDocs.map(d => ({ title: d.title, category: d.category, source: d.source })),
        });
      } catch (err: any) {
        console.warn('Gemini chat call failed, returning reference notes:', err?.message);
      }
    }

    const primary = relevantRagDocs[0] || ACLS_RAG_KNOWLEDGE_BASE[0];
    return res.json({
      text: `**Offline ACLS reference notes** (AI assistant not connected)\n\n${primary.protocolContent}\n\n*These are built-in notes, not a live AI answer. Check against the current AHA guidelines.*`,
      groundingChunks: relevantRagDocs.map(d => ({ uri: 'https://cpr.heart.org', title: d.title })),
      ragSources: relevantRagDocs.map(d => ({ title: d.title, category: d.category, source: d.source })),
      webSearchQueries: [],
    });
  });

  app.post('/api/gemini/search', requireClinician, rateLimit, async (req: AuthedRequest, res) => {
    const parsed = validateSearchRequest(req.body);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    const { query } = parsed.value;

    const relevantDocs = queryAclsRag(query, 3);
    const ragContext = relevantDocs.map(d => `**${d.title}**:\n${d.summary}\n${d.protocolContent}`).join('\n\n');

    const ai = deps.getGenAI();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Clinical resuscitation question: ${query}\n\nReference notes:\n${ragContext}`,
          config: {
            systemInstruction: 'You are an emergency medicine information specialist. Use Google Search grounding with the reference notes to give high-yield, sourced evidence for clinicians. Say when evidence is uncertain.',
            tools: [{ googleSearch: {} }],
          },
        });
        const grounding = response.candidates?.[0]?.groundingMetadata;
        return res.json({
          text: response.text || '',
          groundingChunks: (grounding?.groundingChunks || []).map((chunk: any) => ({
            uri: chunk.web?.uri || '',
            title: chunk.web?.title || 'Medical Source',
          })),
          webSearchQueries: grounding?.webSearchQueries || [],
          ragSources: relevantDocs.map(d => ({ title: d.title, category: d.category, source: d.source })),
        });
      } catch (err: any) {
        console.warn('Gemini search call failed, returning reference notes:', err?.message);
      }
    }

    return res.json({
      text: `### Offline ACLS reference notes (AI assistant not connected)\n\n${ragContext}`,
      groundingChunks: relevantDocs.map(d => ({ uri: 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines', title: d.title })),
      webSearchQueries: [],
      ragSources: relevantDocs.map(d => ({ title: d.title, category: d.category, source: d.source })),
    });
  });

  // Unknown API routes: JSON 404 instead of falling through to the app shell.
  app.all('/api/*', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Errors from body parsing (e.g. oversized or malformed JSON): no internal details.
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (!err) return next();
    const status = err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : 500;
    if (status === 500) console.error('API error:', err);
    res.status(status).json({ error: status === 413 ? 'Request too large.' : status === 400 ? 'Malformed request.' : 'Server error.' });
  });

  return app;
}
