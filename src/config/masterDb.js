import pg from 'pg';

const MASTER_DB_URL = process.env.MASTER_DATABASE_URL || 'postgresql://postgres:Action%23123@localhost:5432/zydusapp?schema=public';

export const masterPool = new pg.Pool({
  connectionString: MASTER_DB_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

masterPool.on('error', (err) => {
  console.error('[Master DB Pool] Unexpected error on idle client:', err.message);
});

export default masterPool;
