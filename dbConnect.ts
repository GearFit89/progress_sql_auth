import { Pool, PoolConfig, Client,  } from 'pg';

// 1. Decode your Base64 CA
const caCert = process.env.PG_CA_BASE64
    ? Buffer.from(process.env.PG_CA_BASE64, 'base64').toString('utf-8')
    : undefined;

const poolConfig: PoolConfig = {
    user: "avnadmin",
    password: process.env.PG_PASSWORD,
    host: "pg-2ebf1971-jscram1775-bdd2.g.aivencloud.com",
    port: 22534,
    database: "defaultdb",
    ssl: {
        rejectUnauthorized: true,
        ca: caCert,
    },
    // Max connections in the pool
    max: 10,
    // Close idle clients after 30 seconds
    idleTimeoutMillis: 30000,
};

/**
 * Singleton pattern for Next.js to prevent 
 * multiple pools during hot-reloads.
 */
const globalForPg = global as unknown as { pool: Pool };

export const db = globalForPg.pool || new Pool(poolConfig);

if (process.env.NODE_ENV !== 'production') globalForPg.pool = db;

export default db;

/**
 * Connects to the database and fetches the version.
 * Using async/await prevents "callback hell."
 */
