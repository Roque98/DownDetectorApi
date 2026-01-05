import * as mssql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

// Build database configuration
const buildDbConfig = (): mssql.config => {
  const config: mssql.config = {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'DowndetectorDB',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
      enableArithAbort: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    connectionTimeout: 30000,
    requestTimeout: 30000,
  };

  // Handle SQL Authentication
  if (process.env.DB_USER && process.env.DB_PASSWORD) {
    config.user = process.env.DB_USER;
    config.password = process.env.DB_PASSWORD;
  }

  // Handle port
  if (process.env.DB_PORT) {
    const port = parseInt(process.env.DB_PORT);
    if (!isNaN(port) && port > 0) {
      config.port = port;
    }
  }

  return config;
};

export const dbConfig = buildDbConfig();

let pool: mssql.ConnectionPool | null = null;

export async function getConnection(): Promise<mssql.ConnectionPool> {
  if (!pool) {
    pool = await mssql.connect(dbConfig);
    console.log('✓ Database connection established');
  }
  return pool;
}

export async function closeConnection(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('✓ Database connection closed');
  }
}
