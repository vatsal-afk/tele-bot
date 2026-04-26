import type { VercelRequest, VercelResponse } from '@vercel/node';
import { webhookCallback } from 'grammy';
import dotenv from 'dotenv';
dotenv.config();

// Dynamic import so the bot module initialises fresh per cold-start
import { bot } from '../src/bot/index.js';

// Direct handling instead of grammy's express adapter to avoid Vercel compatibility issues
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    try {
      if (!bot.isInited) {
        await bot.init();
      }
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(500).json({ error: 'Internal server error', details: err instanceof Error ? err.message : String(err) });
    }
  } else {
    res.status(200).json({ status: 'IITR Fitness Bot is live ✅' });
  }
}
