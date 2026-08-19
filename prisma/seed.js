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

  // Seed / Update Genomic Service Master Catalog
  const defaultServices = [
    { service_name: 'ZyGENE BRCA assay (somatic) (Only DNA)', service_code: 'NGS0000001', price: 10000.00, sample: 'FFPE', tat_time: '7 Days', mst_siteid: 1, created_by_name: 'System Admin' },
    { service_name: 'ZyGENE BRCA assay (germline)(Only DNA)', service_code: 'NGS0000002', price: 8000.00, sample: 'BLOOD', tat_time: '7 Days', mst_siteid: 1, created_by_name: 'System Admin' },
    { service_name: 'ZyGENE Onco Focus Assay - Solid 52 genes', service_code: 'NGS0000003', price: 15750.00, sample: 'FFPE', tat_time: '10 Days', mst_siteid: 1, created_by_name: 'System Admin' },
    { service_name: 'ZyGENE Onco Comprehensive Assay - Solid 161 genes', service_code: 'NGS0000004', price: 22000.00, sample: 'FFPE', tat_time: '14 Days', mst_siteid: 1, created_by_name: 'System Admin' },
    { service_name: 'ZyGENE Onco Plus Assay - 500 gene + TMB + MSI', service_code: 'NGS0000005', price: 47250.00, sample: 'FFPE', tat_time: '21 Days', mst_siteid: 1, created_by_name: 'System Admin' },
    { service_name: 'ZyGENE Neuro Profile (Histo Molecular)', service_code: 'NGS0000006', price: 32000.00, sample: 'FFPE', tat_time: '14 Days', mst_siteid: 1, created_by_name: 'System Admin' },
    { service_name: 'ZYGENE Neuro Profile 2', service_code: 'NGS0000007', price: 23100.00, sample: 'FFPE', tat_time: '14 Days', mst_siteid: 1, created_by_name: 'System Admin' },
    { service_name: 'ZYGENE Endometrial Histo-Molecular Profile*', service_code: 'NGS0000012', price: 28000.00, sample: 'FFPE', tat_time: '14 Days', mst_siteid: 1, created_by_name: 'System Admin' },
    { service_name: 'ZYGENE Endometrial Profile -2', service_code: 'NGS0000011', price: 25000.00, sample: 'FFPE', tat_time: '14 Days', mst_siteid: 1, created_by_name: 'System Admin' },
    { service_name: 'ZYGENE Whole Exome*', service_code: 'HEM0000155', price: 18000.00, sample: 'BLOOD', tat_time: '21 Days', mst_siteid: 1, created_by_name: 'System Admin' },
    { service_name: 'ZyGENE Pharmecogenomics Single Gene Genotyping', service_code: 'NGS0000008', price: 4400.00, sample: 'BLOOD', tat_time: '5 Days', mst_siteid: 1, created_by_name: 'System Admin' }
  ];

  for (const s of defaultServices) {
    await prisma.genomicServiceMaster.upsert({
      where: { service_code: s.service_code },
      update: {
        tat_time: s.tat_time,
        price: s.price,
        sample: s.sample
      },
      create: s
    });
  }
  console.log('✅ Synchronized 11 Genomic Service Master catalog records with fixed TAT Days!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
