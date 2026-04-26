import type { VercelRequest, VercelResponse } from '@vercel/node';
import { webhookCallback } from 'grammy';
import dotenv from 'dotenv';
dotenv.config();

// Dynamic import so the bot module initialises fresh per cold-start
import { bot } from '../src/bot/index.js';

// Direct handling instead of grammy's express adapter to avoid Vercel compatibility issues
let debugTrace = '';
function log(msg: string) {
  debugTrace += msg + '\\n';
  console.log(msg);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    debugTrace = '';
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 8000));
    
    const taskPromise = (async () => {
      try {
        log('1. Webhook received');
        if (!bot.isInited()) {
          log('2. Init bot starting');
          await bot.init();
          log('3. Init bot finished');
        } else {
          log('2. Bot already inited');
        }
        
        log('4. Calling handleUpdate');
        await bot.handleUpdate(req.body);
        log('5. handleUpdate finished');
        return 'SUCCESS';
      } catch (err) {
        log('ERROR: ' + (err instanceof Error ? err.message : String(err)));
        return 'ERROR';
      }
    })();

    const result = await Promise.race([taskPromise, timeoutPromise]);
    
    if (result === 'TIMEOUT') {
      res.status(500).json({ error: 'Function timed out', trace: debugTrace });
    } else {
      res.status(200).json({ ok: true, result, trace: debugTrace });
    }
  } else {
    res.status(200).json({ status: 'IITR Fitness Bot is live ✅' });
  }
}
