import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

// Initialize Express
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initializer for Google GenAI client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. AI capabilities will fall back gracefully.");
    }
    genAIClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    hasApiKey: !!process.env.GEMINI_API_KEY
  });
});

/**
 * Multi-turn Gemini Chat Endpoint
 * Supports system instructions, conversation history, model switching, and Google Search Grounding
 */
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { 
      messages, 
      systemInstruction, 
      model = 'gemini-3.7-flash', 
      useSearchGrounding = false,
      role = 'acls_expert'
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const ai = getGenAI();

    // Default specialized clinical system instruction
    const defaultInstruction = `You are the ACLS 2025 Resuscitation Co-Pilot & Clinical AI Assistant for Nepal Med and emergency healthcare teams (Doctors, Residents, Medical Officers, Paramedics, and Nurses).
Follow the latest AHA 2025/2026 and ILCOR guidelines for Advanced Cardiovascular Life Support, Pediatric Advanced Life Support (PALS), and Acute Resuscitation.
Role focus: Provide concise, high-yield, structured medical emergency guidance.
- Emphasize High-Quality CPR (100-120 bpm, 5-6 cm depth, full chest recoil, minimal interruptions <10s).
- Shockable rhythms (VF/pVT): Immediate defib (200J biphasic / manufacturer max), CPR 2 min, Epinephrine 1mg IV/IO q3-5min after 2nd shock, Amiodarone 300mg then 150mg (or Lidocaine 1-1.5mg/kg then 0.5-0.75mg/kg) after 3rd shock.
- Non-shockable (PEA/Asystole): CPR 2 min, Epinephrine 1mg IV/IO immediately and q3-5min, investigate and aggressively treat Hs and Ts.
- Hs: Hypovolemia, Hypoxia, Hydrogen ion (acidosis), Hypo/Hyperkalemia, Hypothermia, Hypoglycemia.
- Ts: Tension pneumothorax, Tamponade (cardiac), Toxins, Thrombosis (pulmonary), Thrombosis (coronary).
- If Google Search grounding is enabled or clinical queries require real-time evidence, ground your answers in verified medical literature and cite sources clearly.
Format your responses with clean Markdown, bold headers, bullet points, and high clinical readability.`;

    const effectiveInstruction = systemInstruction || defaultInstruction;

    // Convert messages to GenAI contents format
    // In @google/genai, contents can be an array of Content objects or strings
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

    const response = await ai.models.generateContent({
      model: model || 'gemini-3.7-flash',
      contents,
      config,
    });

    const responseText = response.text || '';
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webSearchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

    res.json({
      text: responseText,
      groundingChunks: groundingChunks.map((chunk: any) => ({
        uri: chunk.web?.uri || '',
        title: chunk.web?.title || 'Clinical Reference',
      })),
      webSearchQueries,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/chat:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate chat response',
      details: String(error)
    });
  }
});

/**
 * Google Search Grounding Clinical Inquiry Endpoint
 * Performs real-time grounded searches for medical protocols, drug dosages, and recent trials
 */
app.post('/api/gemini/search', async (req, res) => {
  try {
    const { query, category = 'general' } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const ai = getGenAI();

    const systemInstruction = `You are a certified Emergency Medicine & Resuscitation Information Specialist. 
Perform a live Google Search to deliver up-to-date, grounded, and verified clinical resuscitation evidence, drug dosages, toxicology antidotes, or AHA/ERC guideline recommendations.
Always include direct citation sources and verified reference links found in the search results.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Clinical Query [Category: ${category}]: ${query}`,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });

    const responseText = response.text || '';
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webSearchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

    res.json({
      text: responseText,
      groundingChunks: groundingChunks.map((chunk: any) => ({
        uri: chunk.web?.uri || '',
        title: chunk.web?.title || 'Medical Source',
      })),
      webSearchQueries,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/search:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to perform grounded search',
      details: String(error)
    });
  }
});

/**
 * AI Case Debrief & Resuscitation Quality Review Endpoint
 */
app.post('/api/gemini/analyze-case', async (req, res) => {
  try {
    const { caseData } = req.body;
    if (!caseData) {
      return res.status(400).json({ error: 'Case data is required' });
    }

    const ai = getGenAI();

    const prompt = `Conduct a comprehensive, structured clinical quality debrief for this ACLS Resuscitation Code:
Case Summary:
- Patient: ${caseData.patientName || 'Unknown'}, Age: ${caseData.patientAge || 'N/A'}, Sex: ${caseData.patientSex || 'N/A'}
- Primary Rhythm: ${caseData.initialRhythm || 'N/A'}, Outcome: ${caseData.outcome || 'N/A'}
- Total Code Duration: ${Math.floor((caseData.duration || 0) / 60)}m ${(caseData.duration || 0) % 60}s
- CPR Cycles Completed: ${caseData.cprCycles || 0}
- Shocks Delivered: ${caseData.shocksCount || 0}
- Epinephrine Doses: ${caseData.epinephrineCount || 0}
- Amiodarone Doses: ${caseData.amiodaroneCount || 0}
- Event Timeline:
${(caseData.timeline || []).map((t: any) => `  * [${t.time}] ${t.event}: ${t.details || ''}`).join('\n')}

Please provide:
1. Executive Resuscitation Performance Score (1-10) with rationale
2. Adherence to 2025 ACLS Guideline Milestones (CPR cycle timing, Defib promptness, Drug intervals)
3. Reversible Causes (Hs & Ts) Analysis and Diagnostic Recommendations
4. Key Actionable Learning Points for the Resuscitation Team`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are a Senior Resuscitation Review Board Chair and Clinical Quality Officer.',
        tools: [{ googleSearch: {} }],
      },
    });

    const responseText = response.text || '';
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    res.json({
      analysis: responseText,
      groundingChunks: groundingChunks.map((chunk: any) => ({
        uri: chunk.web?.uri || '',
        title: chunk.web?.title || 'Reference',
      })),
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/analyze-case:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to analyze case',
      details: String(error)
    });
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
