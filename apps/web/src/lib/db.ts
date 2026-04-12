import { Pool, QueryResult } from 'pg';

function normalizeConnectionString(connectionString?: string): string | undefined {
  if (!connectionString) {
    return undefined;
  }

  if (connectionString.includes('?sslmode=')) {
    return connectionString.replace(/\?sslmode=\w+/, '');
  }

  return connectionString;
}

function createPool(connectionString?: string): Pool {
  const normalized = normalizeConnectionString(connectionString);
  const dbUrl = normalized ? new URL(normalized.replace('postgresql://', 'postgres://')) : null;

  return new Pool(
    dbUrl
      ? {
          host: dbUrl.hostname,
          port: parseInt(dbUrl.port) || 5432,
          database: dbUrl.pathname.split('/')[1],
          user: dbUrl.username,
          password: decodeURIComponent(dbUrl.password),
          ssl: {
            rejectUnauthorized: false,
          },
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          statement_timeout: 10000,
        }
      : {
          connectionString: normalized,
          ssl: {
            rejectUnauthorized: false,
          },
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          statement_timeout: 10000,
        }
  );
}

const legacyConnectionString = process.env.DATABASE_URL;

const hdicrConnectionString = process.env.HDICR_DATABASE_URL || legacyConnectionString;
if (!process.env.HDICR_DATABASE_URL && legacyConnectionString) {
  console.warn(
    '[DB] Using legacy DATABASE_URL for HDICR pool. Set HDICR_DATABASE_URL for split credentials.'
  );
}

const tiConnectionString = process.env.TI_DATABASE_URL || legacyConnectionString;
if (!process.env.TI_DATABASE_URL && legacyConnectionString) {
  console.warn(
    '[DB] Using legacy DATABASE_URL for TI pool. Set TI_DATABASE_URL for split credentials.'
  );
}

const hdicrPool = createPool(hdicrConnectionString);
const tiPool = createPool(tiConnectionString);

// Backward compatible default pool. New code must use queryTi (TI-owned tables only).
const pool = tiPool;

async function executeQuery(
  targetPool: Pool,
  source: 'HDICR' | 'TI' | 'DEFAULT',
  text: string,
  params?: unknown[]
): Promise<QueryResult> {
  const start = Date.now();
  let client;

  try {
    client = await targetPool.connect();
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    console.log('[DB] Query executed', {
      source,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('[DB] Query error', {
      source,
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
 * Execute a SQL query
 *
 * @param text SQL query text
 * @param params Query parameters
 * @returns Query result
 */
export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  return executeQuery(pool, 'DEFAULT', text, params);
}

export async function queryTi(text: string, params?: unknown[]): Promise<QueryResult> {
  return executeQuery(tiPool, 'TI', text, params);
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

export async function testSplitConnections(): Promise<{ hdicr: boolean; ti: boolean }> {
  const hdicr = await executeQuery(hdicrPool, 'HDICR', 'SELECT NOW()')
    .then(() => true)
    .catch(() => false);

  const ti = await queryTi('SELECT NOW()')
    .then(() => true)
    .catch(() => false);

  return { hdicr, ti };
}

// hdicrPool is intentionally not exported — TI runtime must not query HDICR-owned tables directly.
export { pool, tiPool };

export default { query, queryTi, testConnection, testSplitConnections, pool };
