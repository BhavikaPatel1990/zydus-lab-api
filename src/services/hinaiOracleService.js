import oracledb from 'oracledb';
import { ORACLE_CONFIG } from '../config/oracleConfig.js';
import { getGenomicLabHinaiQuery } from '../queries/genomicLabQueries.js';
import { getHistoLabHinaiQuery } from '../queries/histoLabQueries.js';
import { getMicroLabHinaiQuery } from '../queries/microLabQueries.js';

// Enable Oracle Thin Mode (Default in oracledb v6+)
try {
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.fetchAsString = [oracledb.DATE, oracledb.NUMBER];
} catch (e) {
  // Ignored if already set
}

/**
 * Centralized Oracle DB Runner:
 * Manages connection lifecycle (open, execute, close) safely without duplicating code anywhere.
 */
export const runHinaiQuery = async (sqlQuery, params = []) => {
  let connection;
  try {
    console.log(`[Hinai Oracle] Connecting to Oracle HIS DB (${ORACLE_CONFIG.user}@${ORACLE_CONFIG.connectString})...`);

    connection = await oracledb.getConnection(ORACLE_CONFIG);

    const result = await connection.execute(sqlQuery, params);
    console.log(`[Hinai Oracle] Query executed successfully. Returned ${result.rows ? result.rows.length : 0} rows.`);
    return result.rows || [];
  } catch (error) {
    console.error('[Hinai Oracle Runner Error]:', error.message);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('[Hinai Oracle Connection Close Error]:', err.message);
      }
    }
  }
};

/**
 * Genomic Lab HINAI Fetcher
 */
export const executeHinaiQuery = async (serviceCodes = [], daysBack = 90, histoServiceCodes = []) => {
  const sqlQuery = getGenomicLabHinaiQuery(serviceCodes, daysBack, histoServiceCodes);
  return await runHinaiQuery(sqlQuery);
};

/**
 * Histo Lab HINAI Fetcher (Future Module Template)
 */
export const executeHistoLabHinaiQuery = async (serviceCodes = []) => {
  const sqlQuery = getHistoLabHinaiQuery(serviceCodes);
  return await runHinaiQuery(sqlQuery);
};

/**
 * Micro Lab HINAI Fetcher (Future Module Template)
 */
export const executeMicroLabHinaiQuery = async (serviceCodes = []) => {
  const sqlQuery = getMicroLabHinaiQuery(serviceCodes);
  return await runHinaiQuery(sqlQuery);
};
