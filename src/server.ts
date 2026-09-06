import express from 'express';
import { config } from './config';
import usageRoutes from './routes/usage.routes';
import subscriptionRoutes from './routes/subscription.routes';
import webhookRoutes from './routes/webhook.routes';

const app = express();

app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

app.use(express.json());

app.use('/', usageRoutes);
app.use('/', subscriptionRoutes);
app.use('/', webhookRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    phase: '3',
    timestamp: new Date().toISOString(),
    features: ['metering', 'quota', 'pricing', 'checkout', 'webhooks'],
  });
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`Health: http://localhost:${config.port}/health`);
  console.log(`POST /api/generate - Record usage (idempotent)`);
  console.log(`GET /api/usage/:tenantId - Get usage summary`);
  console.log(`POST /api/checkout - Create Stripe Checkout session`);
  console.log(`POST /api/webhooks/stripe - Stripe webhook handler`);
});
