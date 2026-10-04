/**
 * Express server: AI copilot API + the app itself.
 *
 * The API routes live in server/app.ts. Every AI route requires a verified
 * Firebase sign-in (server/auth.ts); nothing the browser says about itself
 * (email, "verified doctor") is trusted.
 */
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import firebaseConfig from './firebase-applet-config.json';
import { createApp } from './server/app';
import { cachedKycStatus, fetchKycStatus, verifyFirebaseIdToken } from './server/auth';

const PORT = 3000;
const projectId: string = (firebaseConfig as any).projectId;
const databaseId: string | undefined = (firebaseConfig as any).firestoreDatabaseId;

let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim().length > 0) {
      genAIClient = new GoogleGenAI({
        apiKey: apiKey.trim(),
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
    } else {
      console.warn('GEMINI_API_KEY is not set. The copilot will answer from the built-in reference notes.');
    }
  }
  return genAIClient;
}

const app = createApp({
  auth: {
    verifyToken: (idToken) => verifyFirebaseIdToken(idToken, projectId),
    getKycStatus: cachedKycStatus((user) => fetchKycStatus(user, { projectId, databaseId })),
  },
  getGenAI,
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ACLS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
