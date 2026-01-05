import dotenv from 'dotenv';

dotenv.config();

export const appConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  executionMode: (process.env.EXECUTION_MODE || 'once') as 'once' | 'loop',
  intervalMinutes: parseInt(process.env.INTERVAL_MINUTES || '10'),
  collectLastMinutes: parseInt(process.env.COLLECT_LAST_MINUTES || '45'),
  logLevel: process.env.LOG_LEVEL || 'info',
};
