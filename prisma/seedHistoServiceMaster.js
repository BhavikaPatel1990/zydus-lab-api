import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import oracledb from 'oracledb';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

const ORACLE_CONFIG = {
  user: process.env.ORACLE_USER || 'zylivero',
  password: process.env.ORACLE_PASSWORD || 'ZyliveRO',
  connectString: process.env.ORACLE_CONNECTION_STRING || '20.193.154.239:17001/zyhisdb1'
};

const CSV_FILE_PATH = path.join(__dirname, 'tbl_tat_hours.csv');

export async function seedHistoServiceMaster() {
  console.log('🚀 Starting Histo Service Master Seed from', CSV_FILE_PATH);

  if (!fs.existsSync(CSV_FILE_PATH)) {
    throw new Error(`CSV file not found at: ${CSV_FILE_PATH}`);
  }

  // 1. Read and parse CSV
  const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
  const lines = fileContent.split('\n').map(l => l.trim()).filter(Boolean);
  console.log(`📄 Read ${lines.length} lines from CSV`);

  const csvMap = new Map();
  for (const line of lines) {
    // Format: "1","HIS0000060","96","INHOUSE","1","2023-07-25 14:25:44"
    const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').trim());
    const serviceCode = parts[1];
    if (serviceCode) {
      const hours = parseInt(parts[2], 10) || 72;
      const days = hours >= 24 ? Math.round(hours / 24) : 1;
      const tatTime = `${days} Days (${hours} Hours)`;
      const sample = parts[3] ? parts[3].toUpperCase() : 'INHOUSE';
      const siteId = parseInt(parts[4], 10) || 1;

      csvMap.set(serviceCode, {
        service_code: serviceCode,
        tat_hours: hours,
        tat_time: tatTime,
        sample,
        mst_siteid: siteId
      });
    }
  }

  const uniqueCodes = Array.from(csvMap.keys());
  console.log(`🔍 Total unique service codes to seed: ${uniqueCodes.length}`);

  // 2. Fetch authoritative service names and amounts from Oracle servicemaster
  let oracleConnection;
  const oracleServiceMap = new Map();

  try {
    console.log(`🔌 Connecting to Oracle HIS DB (${ORACLE_CONFIG.connectString})...`);
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracleConnection = await oracledb.getConnection(ORACLE_CONFIG);

    // Fetch in batches of 100
    for (let i = 0; i < uniqueCodes.length; i += 100) {
      const batch = uniqueCodes.slice(i, i + 100);
      const inClause = batch.map(c => `'${c}'`).join(',');
      const res = await oracleConnection.execute(
        `SELECT service_code, service_name, amount FROM servicemaster WHERE service_code IN (${inClause})`
      );
      for (const row of res.rows) {
        oracleServiceMap.set(row.SERVICE_CODE, {
          service_name: row.SERVICE_NAME,
          amount: parseFloat(row.AMOUNT) || 0
        });
      }
    }
    console.log(`✅ Loaded ${oracleServiceMap.size} service descriptions from Oracle HIS`);
  } catch (err) {
    console.warn(`⚠️ Oracle query warning: ${err.message}. Will use code as fallback name if needed.`);
  } finally {
    if (oracleConnection) {
      try {
        await oracleConnection.close();
      } catch (e) {}
    }
  }

  // 3. Upsert records into PostgreSQL histo_service_masters
  console.log('💾 Upserting records into PostgreSQL (histo_service_masters)...');
  let inserted = 0;
  let updated = 0;

  for (const item of csvMap.values()) {
    const oracleInfo = oracleServiceMap.get(item.service_code);
    const serviceName = oracleInfo?.service_name || `Histopathology Service ${item.service_code}`;
    const price = oracleInfo?.amount || 0;

    const recordData = {
      service_name: serviceName,
      service_code: item.service_code,
      price,
      sample: item.sample,
      tat_time: item.tat_time,
      status: true,
      mst_siteid: item.mst_siteid,
      created_by_name: 'Histo CSV Seeder'
    };

    const existing = await prisma.histoServiceMaster.findUnique({
      where: { service_code: item.service_code }
    });

    if (existing) {
      await prisma.histoServiceMaster.update({
        where: { service_code: item.service_code },
        data: {
          service_name: serviceName,
          price,
          sample: item.sample,
          tat_time: item.tat_time,
          status: true,
          updated_at: new Date()
        }
      });
      updated++;
    } else {
      await prisma.histoServiceMaster.create({
        data: recordData
      });
      inserted++;
    }
  }

  console.log(`🎉 Histo Service Master Seed Complete! Inserted: ${inserted}, Updated: ${updated}, Total: ${csvMap.size}`);
  return { total: csvMap.size, inserted, updated };
}

// Execute directly if run via node
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedHistoServiceMaster()
    .catch(err => {
      console.error('❌ Seed Failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
