import express from 'express';
import { config } from './config';
import usageRoutes from './routes/usage.routes';

const app = express();
app.use(express.json());

app.use('/', usageRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    phase: '2',
    timestamp: new Date().toISOString(),
    features: ['metering', 'quota', 'pricing'],
  });
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`Health: http://localhost:${config.port}/health`);
  console.log(`POST /api/generate - Record usage (idempotent)`);
  console.log(`GET /api/usage/:tenantId - Get usage summary`);
});
