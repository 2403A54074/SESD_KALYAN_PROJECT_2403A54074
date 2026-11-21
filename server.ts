import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGenAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.post('/api/music/generate', async (req, res) => {
    try {
      const { prompt, mode, imageBase64, imageMimeType } = req.body ?? {};
      if (typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Please enter a music prompt.' });
        return;
      }

      const ai = getGenAiClient();
      if (!ai) {
        res.status(400).json({
          error:
            'GEMINI_API_KEY is not configured. Select or add a billing-enabled API key in the Settings > Secrets panel to generate music with Lyria.',
        });
        return;
      }

      const model = mode === 'pro' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';
      const trimmedPrompt = prompt.trim().slice(0, 1200);

      const parts: Array<
        | { text: string }
        | { inlineData: { data: string; mimeType: string } }
      > = [{ text: trimmedPrompt }];

      if (typeof imageBase64 === 'string' && imageBase64.length > 0) {
        parts.push({
          inlineData: {
            data: imageBase64,
            mimeType: typeof imageMimeType === 'string' && imageMimeType ? imageMimeType : 'image/jpeg',
          },
        });
      }

      const response = await ai.models.generateContentStream({
        model,
        contents: { parts },
      });

      const audioChunks: Buffer[] = [];
      let lyrics = '';
      let mimeType = 'audio/mpeg';

      for await (const chunk of response) {
        const candidateParts = chunk.candidates?.[0]?.content?.parts;
        if (!candidateParts) continue;
        for (const part of candidateParts) {
          if (part.inlineData?.data) {
            if (audioChunks.length === 0 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
          }
          if (part.text) {
            lyrics += part.text;
          }
        }
      }

      if (audioChunks.length === 0) {
        res.status(502).json({
          error:
            'Lyria returned no audio stream for this prompt. Please refine your prompt and try again.',
        });
        return;
      }

      const audioBase64 = Buffer.concat(audioChunks).toString('base64');
      res.json({
        audioDataUrl: `data:${mimeType};base64,${audioBase64}`,
        lyrics: lyrics.trim(),
        mimeType,
        model,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Music generation request failed.';
      const lower = msg.toLowerCase();
      if (lower.includes('403') || lower.includes('permission_denied') || lower.includes('api_key_invalid') || lower.includes('400')) {
        res.status(403).json({
          error: `Gemini API key error (${msg}). Please verify or select a valid paid API key in the Settings > Secrets panel.`,
        });
        return;
      }
      if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
        res.status(429).json({
          error: `Quota / billing limit reached (${msg}). Lyria models require a billing-enabled API key in the Settings > Secrets panel.`,
        });
        return;
      }
      res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
