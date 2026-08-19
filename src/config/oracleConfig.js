import dotenv from 'dotenv';
dotenv.config();

/**
 * Centralized HINAI Oracle Database Configuration
 * Avoids inline connection variable duplication across services.
 */
export const ORACLE_CONFIG = Object.freeze({
  user: process.env.ORACLE_USER || 'zylivero',
  password: process.env.ORACLE_PASSWORD || 'ZyliveRO',
  connectString: process.env.ORACLE_CONNECTION_STRING || '20.193.154.239:17001/zyhisdb1'
});
