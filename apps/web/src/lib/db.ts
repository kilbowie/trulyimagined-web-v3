import { Pool, QueryResult } from 'pg';

// Parse DATABASE_URL and remove sslmode parameter to avoid conflicts
let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes('?sslmode=')) {
  connectionString = connectionString.replace(/\?sslmode=\w+/, '');
}

// Parse connection URL
const dbUrl = connectionString
  ? new URL(connectionString.replace('postgresql://', 'postgres://'))
  : null;

// Initialize PostgreSQL connection pool
const pool = new Pool(
  dbUrl
    ? {
        host: dbUrl.hostname,
        port: parseInt(dbUrl.port) || 5432,
        database: dbUrl.pathname.split('/')[1],
        user: dbUrl.username,
        password: decodeURIComponent(dbUrl.password),
        ssl: {
          rejectUnauthorized: false, // Required for AWS RDS self-signed certificates
        },
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
        statement_timeout: 10000, // Cancel queries that take longer than 10 seconds
      }
    : {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statement_timeout: 10000,
      }
);

/**
 * Execute a SQL query
 *
 * @param text SQL query text
 * @param params Query parameters
 * @returns Query result
 */
export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  const start = Date.now();
  let client;

  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    console.log('[DB] Query executed', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('[DB] Query error', {
      text: text.substring(0, 100),
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW()');
    console.log('[DB] Connection test successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('[DB] Connection test failed:', error);
    return false;
  }
}

// Export pool for advanced use cases
export { pool };

export default { query, testConnection, pool };
