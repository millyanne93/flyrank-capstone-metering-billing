import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5434/metering_billing',
  
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    proPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
  },
  
  pricing: {
    PRICE_INPUT_PER_TOKEN: 0.000003,
    PRICE_CACHED_INPUT_PER_TOKEN: 0.00000075,
    PRICE_OUTPUT_PER_TOKEN: 0.000015,
  },
};

export function log(level: string, message: string, data?: any) {
  const levels = { error: 0, warn: 1, info: 2, debug: 3 };
  const currentLevel = levels[config.logLevel as keyof typeof levels] ?? 2;
  const messageLevel = levels[level as keyof typeof levels] ?? 2;
  
  if (messageLevel <= currentLevel) {
    const prefix = level.toUpperCase();
    if (data) {
      console.log(`[${prefix}] ${message}`, data);
    } else {
      console.log(`[${prefix}] ${message}`);
    }
  }
}
