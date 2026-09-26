import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { ACLS_RAG_KNOWLEDGE_BASE, queryAclsRag } from './src/lib/aclsRagKnowledge';

// Initialize Express
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initializer for Google GenAI client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim().length > 0) {
      genAIClient = new GoogleGenAI({
        apiKey: apiKey.trim(),
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } else {
      console.warn("GEMINI_API_KEY is not set or empty. Using embedded ACLS RAG knowledge engine.");
    }
  }
  return genAIClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    hasApiKey: !!process.env.GEMINI_API_KEY,
    ragKnowledgeChunks: ACLS_RAG_KNOWLEDGE_BASE.length
  });
});

/**
 * Multi-turn Gemini Chat with Retrieval-Augmented Generation (RAG) + Google Search
 */
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { 
      messages, 
      systemInstruction, 
      model = 'gemini-2.5-flash', 
      useSearchGrounding = false,
      role = 'acls_expert'
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const latestUserMsg = messages[messages.length - 1]?.content || '';
    
    // Retrieve relevant RAG clinical protocols
    const relevantRagDocs = queryAclsRag(latestUserMsg, 3);
    const ragContextText = relevantRagDocs.map(doc => 
      `### [RAG Protocol: ${doc.title} (${doc.category})]\n${doc.protocolContent}\nSource: ${doc.source}`
    ).join('\n\n');

    const defaultInstruction = `You are the ACLS 2025 Resuscitation Director & Clinical AI Assistant for Nepal Med.
Adhere strictly to AHA 2025/2026 and ILCOR Resuscitation Standards.
Retrieved Evidence-Based RAG Context:
${ragContextText}

Guidelines:
- Emphasize High-Quality CPR (100-120 bpm, 5-6 cm depth, complete recoil, CCF > 80%).
- Shockable (VF/pVT): 200J Biphasic, immediate CPR 2 min, Epi 1mg after 2nd shock, Amiodarone 300mg then 150mg (or Lidocaine 1-1.5mg/kg) after 3rd shock.
- Non-shockable (PEA/Asystole): Epi 1mg IV/IO immediately and q3-5min, investigate Hs & Ts.
- Highlight specific drug dosages and reversible causes clearly with bold markdown.`;

    const effectiveInstruction = systemInstruction ? `${systemInstruction}\n\n${ragContextText}` : defaultInstruction;

    const ai = getGenAI();

    // If Gemini API is available, generate with model and search grounding
    if (ai) {
      const contents = messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const config: any = {
        systemInstruction: effectiveInstruction,
      };

      if (useSearchGrounding) {
        config.tools = [{ googleSearch: {} }];
      }

      try {
        const response = await ai.models.generateContent({
          model: model || 'gemini-2.5-flash',
          contents,
          config,
        });

        const responseText = response.text || '';
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const webSearchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

        return res.json({
          text: responseText,
          groundingChunks: groundingChunks.map((chunk: any) => ({
            uri: chunk.web?.uri || '',
            title: chunk.web?.title || 'Clinical Reference',
          })),
          webSearchQueries,
          ragSources: relevantRagDocs.map(d => ({ title: d.title, category: d.category, source: d.source }))
        });
      } catch (geminiError: any) {
        console.warn('Gemini API call failed, providing RAG response:', geminiError.message);
      }
    }

    // Direct RAG Response Fallback when API Key is pending or network throttled
    const primaryRag = relevantRagDocs[0] || ACLS_RAG_KNOWLEDGE_BASE[0];
    const fallbackResponse = `**Offline ACLS reference notes** (AI assistant not connected)\n\n${primaryRag.protocolContent}\n\n*These are built-in notes, not a live AI answer. Check against the current AHA guidelines.*`;

    return res.json({
      text: fallbackResponse,
      groundingChunks: relevantRagDocs.map(d => ({
        uri: 'https://cpr.heart.org',
        title: d.title,
      })),
      ragSources: relevantRagDocs.map(d => ({ title: d.title, category: d.category, source: d.source })),
      webSearchQueries: [latestUserMsg]
    });

  } catch (error: any) {
    console.error('Error in /api/gemini/chat:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process chat query',
      details: String(error)
    });
  }
});

/**
 * Google Search Grounding & RAG Clinical Inquiry Endpoint
 */
app.post('/api/gemini/search', async (req, res) => {
  try {
    const { query, category = 'general' } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const relevantDocs = queryAclsRag(query, 3);
    const ragContext = relevantDocs.map(d => `**${d.title}**:\n${d.summary}\n${d.protocolContent}`).join('\n\n');

    const ai = getGenAI();

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Clinical Resuscitation Query: ${query}\n\nReference notes:\n${ragContext}`,
          config: {
            systemInstruction: 'You are an Emergency Medicine Information Specialist. Use Google Search Grounding along with provided ACLS knowledge to deliver high-yield evidence.',
            tools: [{ googleSearch: {} }],
          },
        });

        const responseText = response.text || '';
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const webSearchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

        return res.json({
          text: responseText,
          groundingChunks: groundingChunks.map((chunk: any) => ({
            uri: chunk.web?.uri || '',
            title: chunk.web?.title || 'Medical Source',
          })),
          webSearchQueries,
          ragSources: relevantDocs
        });
      } catch (err: any) {
        console.warn('Search grounding call error, returning verified RAG text:', err.message);
      }
    }

    // Direct RAG Search fallback
    res.json({
      text: `### Offline ACLS reference notes (AI assistant not connected)\n\n${ragContext}`,
      groundingChunks: relevantDocs.map(d => ({
        uri: 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines',
        title: d.title
      })),
      webSearchQueries: [query],
      ragSources: relevantDocs
    });

  } catch (error: any) {
    console.error('Error in /api/gemini/search:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to perform clinical search',
      details: String(error)
    });
  }
});

/**
 * Case Analysis & Quality Debrief Endpoint
 */
app.post('/api/gemini/analyze-case', async (req, res) => {
  try {
    const { caseData } = req.body;
    if (!caseData) {
      return res.status(400).json({ error: 'Case data is required' });
    }

    const ai = getGenAI();
    const prompt = `Conduct a structured clinical quality review for this ACLS code:
Patient: ${caseData.patientName || 'Unknown'}, Age: ${caseData.patientAge || 'N/A'}, Sex: ${caseData.patientSex || 'N/A'}
Initial Rhythm: ${caseData.initialRhythm || 'N/A'}, Outcome: ${caseData.outcome || 'N/A'}
Total Time: ${Math.floor((caseData.duration || 0) / 60)}m ${(caseData.duration || 0) % 60}s
CPR Cycles: ${caseData.cprCycles || 0}, Shocks: ${caseData.shocksCount || 0}, Epinephrine Doses: ${caseData.epinephrineCount || 0}
Timeline:
${(caseData.timeline || []).map((t: any) => `  * [${t.time}] ${t.event}: ${t.details || ''}`).join('\n')}`;

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            systemInstruction: 'You are the Resuscitation Quality Review Board Chair. Provide score (1-10), guideline adherence, Hs & Ts analysis, and team learning points.',
            tools: [{ googleSearch: {} }],
          },
        });

        return res.json({
          analysis: response.text || '',
          groundingChunks: (response.candidates?.[0]?.groundingMetadata?.groundingChunks || []).map((c: any) => ({
            uri: c.web?.uri || '',
            title: c.web?.title || 'Reference',
          })),
        });
      } catch (err: any) {
        console.warn('AI analysis fallback:', err.message);
      }
    }

    // No AI available: say so. Never return a made-up score or review.
    res.status(503).json({
      error: 'AI case review is unavailable right now. No score or review was generated for this case.',
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/analyze-case:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze case' });
  }
});

// Vite & Static Asset Handler
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ACLS 2025 Express & Vite server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

