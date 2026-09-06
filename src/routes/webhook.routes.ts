import { Router, Request, Response } from 'express';
import { handleWebhook } from '../services/stripe/webhook.handler';
import { log } from '../config';

const router = Router();

router.post('/api/webhooks/stripe', async (req: Request, res: Response) => {
  try {
    await handleWebhook(req, res);
  } catch (error: any) {
    log('error', 'Webhook route error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
