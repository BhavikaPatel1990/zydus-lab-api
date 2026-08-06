import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Genomic Lab Register demo records...');

  const count = await prisma.genomicLabRegister.count({ where: { deleted_at: null } });

  if (count === 0) {
    await prisma.genomicLabRegister.createMany({
      data: [
        {
          mrn: '24001001',
          patient_name: 'Ramesh Patel',
          age_gender: '54 / Male',
          received_items: 'Biopsy tissue in formalin container (FFPE Block)',
          block_no: 'BLK-2026-A101',
          cellularity: '70% Tumor Cellularity',
          diagnosis: 'Adenocarcinoma of lungs - EGFR T790M Mutation Testing',
          emailed_status: true,
          emailed_date: new Date('2026-08-01T10:30:00Z'),
          uploaded_report_status: true,
          uploaded_report_date: new Date('2026-08-01T11:00:00Z'),
          print_report_status: true,
          print_report_date: new Date('2026-08-01T11:15:00Z'),
          others: 'High quality genomic DNA extracted. EGFR L858R detected.',
          mst_siteid: 1,
          created_by_name: 'Bhavika Javiya'
        },
        {
          mrn: '24001002',
          patient_name: 'Sunita Sharma',
          age_gender: '42 / Female',
          received_items: 'Peripheral EDTA Blood Sample (10 mL)',
          block_no: 'BLK-2026-B205',
          cellularity: 'Normal Leukocytes',
          diagnosis: 'BRCA1 / BRCA2 Germline Hereditary Breast Cancer Panel',
          emailed_status: true,
          emailed_date: new Date('2026-08-02T14:20:00Z'),
          uploaded_report_status: true,
          uploaded_report_date: new Date('2026-08-02T15:00:00Z'),
          print_report_status: false,
          others: 'Pathogenic BRCA1 c.5266dupC mutation identified.',
          mst_siteid: 2,
          created_by_name: 'Bhavika Javiya'
        },
        {
          mrn: '24001003',
          patient_name: 'Vikram Shah',
          age_gender: '61 / Male',
          received_items: 'Bone Marrow Aspirate EDTA Tube',
          block_no: 'BLK-2026-C312',
          cellularity: '85% Blasts',
          diagnosis: 'Acute Myeloid Leukemia - BCR-ABL1 & FLT3-ITD Panel',
          emailed_status: false,
          uploaded_report_status: true,
          uploaded_report_date: new Date('2026-08-03T09:45:00Z'),
          print_report_status: true,
          print_report_date: new Date('2026-08-03T10:00:00Z'),
          others: 'FLT3-ITD positive with allelic ratio 0.45.',
          mst_siteid: 3,
          created_by_name: 'Bhavika Javiya'
        }
      ]
    });
    console.log('✅ Seeded 3 demo Genomic Lab records successfully!');
  } else {
    console.log(`ℹ️ Table genomic_lab_register already has ${count} records, skipping seed.`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
