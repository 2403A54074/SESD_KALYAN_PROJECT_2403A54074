import 'dotenv/config';
import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const AUTH_DIR = path.resolve(process.cwd(), '.data');
const AUTH_FILE = path.resolve(AUTH_DIR, 'auth-users.json');

interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  organization: string;
  passwordHash: string;
  createdAt: string;
}

interface SessionPayload {
  jti: string;
  sub: string;
  email: string;
  displayName: string;
  role: string;
  organization: string;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  authUser?: SessionPayload;
}

const revokedTokenIds = new Set<string>();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function ensureAuthStorePath(): string {
  if (!AUTH_FILE.startsWith(AUTH_DIR + path.sep)) {
    throw new Error('Invalid auth storage path.');
  }
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true, mode: 0o700 });
  }
  return AUTH_FILE;
}

function loadUsers(): StoredUser[] {
  try {
    const filePath = ensureAuthStorePath();
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]): void {
  const filePath = ensureAuthStorePath();
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), { mode: 0o600 });
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function signSessionToken(user: StoredUser): string {
  const payload: SessionPayload = {
    jti: crypto.randomUUID(),
    sub: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    organization: user.organization,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!decoded || typeof decoded.exp !== 'number' || decoded.exp < Date.now()) {
      return null;
    }
    if (revokedTokenIds.has(decoded.jti)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  req.authUser = payload;
  next();
}

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

  app.get('/api/auth/status', (_req, res) => {
    const users = loadUsers();
    res.json({ hasUsers: users.length > 0 });
  });

  app.post('/api/auth/register', (req, res) => {
    const { displayName, email, password, organization } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanName = typeof displayName === 'string' ? displayName.trim() : '';
    const cleanOrg = typeof organization === 'string' ? organization.trim() : '';

    if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
      res.status(400).json({ error: 'Display name must be between 2 and 80 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
      return;
    }

    const users = loadUsers();
    if (users.some((u) => u.email === cleanEmail)) {
      res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
      return;
    }

    const newUser: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      email: cleanEmail,
      displayName: cleanName,
      role: users.length === 0 ? 'Lead Systems Architect' : 'Custodian Operator',
      organization: cleanOrg || 'RelayWatermark Engineering',
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    const token = signSessionToken(newUser);
    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role,
        organization: newUser.organization,
      },
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail || typeof password !== 'string' || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const rateKey = `${req.ip || 'local'}:${cleanEmail}`;
    const now = Date.now();
    const record = loginAttempts.get(rateKey);
    if (record && record.resetAt > now && record.count >= 10) {
      res.status(429).json({ error: 'Too many sign-in attempts. Please wait a few minutes.' });
      return;
    }

    const users = loadUsers();
    const found = users.find((u) => u.email === cleanEmail);
    if (!found || !verifyPassword(password, found.passwordHash)) {
      const nextCount = record && record.resetAt > now ? record.count + 1 : 1;
      loginAttempts.set(rateKey, { count: nextCount, resetAt: now + 5 * 60 * 1000 });
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    loginAttempts.delete(rateKey);
    const token = signSessionToken(found);
    res.json({
      token,
      user: {
        id: found.id,
        email: found.email,
        displayName: found.displayName,
        role: found.role,
        organization: found.organization,
      },
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const u = req.authUser!;
    res.json({
      user: {
        id: u.sub,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        organization: u.organization,
      },
    });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== 'string' || !currentPassword) {
      res.status(400).json({ error: 'Current password is required.' });
      return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      res.status(400).json({ error: 'New password must be between 8 and 128 characters.' });
      return;
    }

    const users = loadUsers();
    const index = users.findIndex((u) => u.id === req.authUser?.sub);
    if (index === -1) {
      res.status(404).json({ error: 'Account record not found.' });
      return;
    }
    if (!verifyPassword(currentPassword, users[index].passwordHash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    users[index] = {
      ...users[index],
      passwordHash: hashPassword(newPassword),
    };
    saveUsers(users);
    res.json({ ok: true });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.authUser?.jti) {
      revokedTokenIds.add(req.authUser.jti);
    }
    res.json({ ok: true });
  });

  app.post('/api/music/generate', requireAuth, async (req, res) => {
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
