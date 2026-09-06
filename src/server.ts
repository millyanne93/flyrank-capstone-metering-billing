import express from 'express';
import { config } from './config';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    phase: '1',
    timestamp: new Date().toISOString(),
  });
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`Health: http://localhost:${config.port}/health`);
});
