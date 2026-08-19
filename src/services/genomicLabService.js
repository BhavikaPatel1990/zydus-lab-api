import ExcelJS from 'exceljs';
import * as GenomicLabModel from '../models/genomicLabModel.js';
import * as HinaiService from './hinaiService.js';
import * as HinaiOracleService from './hinaiOracleService.js';
import { getUserLabPermissions } from './permissionService.js';
import prisma from '../config/prisma.js';
import { formatDate } from '../utils/response.js';
import { fetchCentralSiteList } from '../middleware/attachUserProfile.js';
import masterPool from '../config/masterDb.js';

const getUserDetails = (user, userProfile, body = {}) => {
  const userId = user?.id || userProfile?.id;
  const userName = user?.full_name || user?.name || userProfile?.full_name || 'Portal User';
  const siteId = user?.siteId || user?.site_id || user?.siteID || userProfile?.site_id || body.mst_siteid || body.siteId || 1;
  return { userId, userName, siteId: Number(siteId) };
};



const calculateExpectedDate = (orderDateStr, tatTimeStr) => {
  let baseDate = new Date();
  if (orderDateStr) {
    const d = new Date(orderDateStr);
    if (!isNaN(d.getTime())) {
      baseDate = d;
    }
  }

  let daysToAdd = 7;
  if (tatTimeStr) {
    const match = String(tatTimeStr).match(/\d+/);
    if (match) {
      daysToAdd = parseInt(match[0], 10);
    }
  }

  baseDate.setDate(baseDate.getDate() + daysToAdd);
  return baseDate.toISOString().split('T')[0];
};

const buildDynamicSiteMap = (siteList = []) => {
  const dynamicMap = {};
  if (Array.isArray(siteList)) {
    siteList.forEach(s => {
      const localId = Number(s.id || s.mst_siteid || s.site_id || s.siteId);
      const hisId = String(s.his_site_id || s.his_siteid || s.hisSiteId || s.his_id || s.code || '').trim();
      if (localId && hisId) {
        dynamicMap[hisId] = localId;
      }
    });
  }
  return dynamicMap;
};

export const syncHinaiOrdersToDb = async (daysBack = 30) => {
  console.log(`[Genomic Lab Service] Starting Hinai HIS Oracle Data Sync (Last ${daysBack} days)...`);

  // 1. Dynamically fetch active service records from Genomic Service Master table
  const activeMasterServices = await prisma.genomicServiceMaster.findMany({
    where: { status: true, deleted_at: null }
  });
  const serviceCodes = activeMasterServices.map(s => s.service_code).filter(Boolean);

  // 2. Fetch Oracle HIS rows filtered by active service codes across daysBack window
  const oracleRows = await HinaiOracleService.executeHinaiQuery(serviceCodes, daysBack);
  const siteList = await fetchCentralSiteList();
  const dynamicSiteMap = buildDynamicSiteMap(siteList);

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const row of oracleRows) {
    const serviceOrderId = String(row.SERVICE_ORDER_ID || row.id || row.ID || '').trim();
    const mrn = String(row.MRNO || row.mrno || '').trim();
    const patientName = String(row.PATIENTNAME || row.patientname || '').trim();
    const patientEmail = String(row.PATIENT_EMAIL || row.patient_email || '').trim();
    const mobileNo = String(row.MOBILENO || row.mobileno || '').trim();
    const rawAge = row.AGE || row.age || '';
    const age = rawAge ? String(rawAge) : '';

    const rawGenderId = String(row.GENDER_ID || row.gender_id || row.GENDER || '').trim();
    let gender = '';
    if (rawGenderId === '1') {
      gender = 'Male';
    } else if (rawGenderId === '2') {
      gender = 'Female';
    } else if (rawGenderId) {
      gender = rawGenderId;
    }

    const ageGender = age && gender ? `${age} / ${gender}` : (age || gender || 'N/A');
    const doctor = String(row.DOCTOR || row.doctor || '').trim();
    const visitId = String(row.VISIT_ID || row.visit_id || '').trim();
    const specimen = String(row.SPECIMEN || row.specimen || '').trim();
    const serviceName = String(row.SERVICE_NAME || row.service_name || '').trim();
    const serviceCode = String(row.SERVICE_CODE || row.service_code || '').trim();
    const bedNo = String(row.BED_NO || row.bed_no || '').trim();
    const serviceCenterName = String(row.SERVICE_CENTER_NAME || row.service_center_name || '').trim();
    const orderDate = String(row.ORDERDATE || row.orderdate || '').trim();
    const orderStatus = String(row.ORDER_STATUS || row.order_status || '').trim();
    const acceptedDate = String(row.ACCEPTED_DATE || row.accepted_date || '').trim();
    const sampleAcceptedBy = String(row.SAMPLEACCEPTEDBY || row.sampleacceptedby || '').trim();
    const samAcceptedBy = String(row.SAM_ACCEPTED_BY || row.sam_accepted_by || '').trim();
    const sampleCollectedDate = String(row.SAMPLECOLLECTED_DATE || row.samplecollected_date || '').trim();
    const lbId = String(row.LBID || row.lbid || '').trim();
    const certifiedBy = String(row.CERTIFY_BY || row.certify_by || '').trim();
    const sampleSendDate = String(row.SAMPLESEND_DATE || row.samplesend_date || '').trim();
    const sampleSendBy = String(row.SAMPLESENDBY || row.samplesendby || '').trim();
    const genomicServices = String(row.GENOMIC_SERVICES || row.genomic_services || row.HISTOPATH_SERVICES || row.histopath_services || serviceName || '').trim();
    const uploadedDate = String(row.UPLOADED_DATE || row.uploaded_date || '').trim();
    const rawSiteId = String(row.SITE_ID || '').trim();

    if (!mrn || !patientName) continue;

    // Match Master Service to get exact TAT Time
    const matchedService = activeMasterServices.find(s =>
      s.service_code === serviceCode || s.service_name === serviceName || s.service_name === genomicServices
    );
    const tatTime = matchedService?.tat_time || '7 Days';

    // Calculate expected_date from order_date + TAT_days
    const calculatedExpectedDate = calculateExpectedDate(orderDate, tatTime);
    const receivedDate = uploadedDate ? uploadedDate.split(' ')[0] : null;
    const processStatus = uploadedDate ? 'Processed' : 'In-Progress';

    // Match site ID
    const matchedSite = Array.isArray(siteList) ? siteList.find(s =>
      String(s.his_site_id || s.his_siteid || s.site_id || s.siteid || s.id || s.code) === rawSiteId
    ) : null;

    const mst_siteid = matchedSite
      ? Number(matchedSite.id || matchedSite.siteid || matchedSite.mst_siteid || 1)
      : Number(dynamicSiteMap[rawSiteId] || rawSiteId || 1);

    // Check if record already exists to prevent duplicate insertion
    const existing = await GenomicLabModel.findExistingHinaiRecord(serviceOrderId, mrn, serviceCode, genomicServices);

    if (existing) {
      // UPDATE existing record with latest status, expected_date, received_date & process_status
      await GenomicLabModel.updateGenomicLabRecord(
        existing.id,
        {
          ...(serviceOrderId && { service_order_id: serviceOrderId }),
          ...(doctor && { doctor_name: doctor }),
          ...(serviceName && { service_name: serviceName }),
          ...(serviceCode && { service_code: serviceCode }),
          ...(orderDate && { order_date: orderDate }),
          ...(orderStatus && { order_status: orderStatus }),
          ...(acceptedDate && { accepted_date: acceptedDate }),
          ...(lbId && { lb_id: lbId }),
          ...(certifiedBy && { certified_by: certifiedBy }),
          ...(genomicServices && { genomic_services: genomicServices }),
          expected_date: calculatedExpectedDate,
          ...(receivedDate && { received_date: receivedDate }),
          process_status: processStatus,
          ...(uploadedDate && {
            uploaded_report_status: true,
            uploaded_report_date: new Date(uploadedDate)
          })
        },
        null,
        'HINAI Auto Sync Update'
      );
      updatedCount++;
    } else {
      // INSERT new record into PostgreSQL
      await GenomicLabModel.createGenomicLabRecord(
        {
          service_order_id: serviceOrderId || null,
          mrn,
          patient_name: patientName,
          patient_email: patientEmail || null,
          mobile_no: mobileNo || null,
          doctor_name: doctor || null,
          age: age || null,
          gender: gender || null,
          age_gender: ageGender,
          visit_id: visitId || null,
          specimen: specimen || null,
          service_name: serviceName || null,
          service_code: serviceCode || null,
          bed_no: bedNo || null,
          service_center_name: serviceCenterName || null,
          order_date: orderDate || null,
          order_status: orderStatus || null,
          accepted_date: acceptedDate || null,
          sample_accepted_by: sampleAcceptedBy || null,
          sam_accepted_by: samAcceptedBy || null,
          sample_collected_date: sampleCollectedDate || null,
          lb_id: lbId || null,
          certified_by: certifiedBy || null,
          sample_send_date: sampleSendDate || null,
          sample_send_by: sampleSendBy || null,
          received_items: serviceName || 'NGS Service',
          diagnosis: null,
          block_no: bedNo ? `Bed: ${bedNo}` : null,
          received_date: receivedDate,
          expected_date: calculatedExpectedDate,
          process_status: processStatus,
          genomic_services: genomicServices || null,
          uploaded_report_status: Boolean(uploadedDate),
          uploaded_report_date: uploadedDate ? new Date(uploadedDate) : null,
          mst_siteid
        },
        null,
        'HINAI Auto Sync'
      );
      insertedCount++;
    }
  }

  console.log(`[Hinai Sync Finished] Inserted: ${insertedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}, Total Processed: ${oracleRows.length}`);
  return { total: oracleRows.length, inserted: insertedCount, updated: updatedCount, skipped: skippedCount };
};

export const getAllRecords = async (req) => {
  if (!req.query.allowedSiteIds && !req.query.allowed_site_ids) {
    const userId = req.userProfile?.id || req.user?.id;
    if (userId) {
      const perms = await getUserLabPermissions(userId);
      const modulePerm = perms.find(p => p.module_key === 'GENOMIC_LAB') || perms[0];
      if (modulePerm && Array.isArray(modulePerm.allowed_site_ids) && modulePerm.allowed_site_ids.length > 0) {
        req.query.allowedSiteIds = modulePerm.allowed_site_ids.join(',');
      }
    }
  }
  return await GenomicLabModel.getAllGenomicLabRecords(req);
};

export const getSites = async (authHeader) => {
  try {
    const centralSites = await fetchCentralSiteList(authHeader);
    if (Array.isArray(centralSites) && centralSites.length > 0) {
      return centralSites.map(s => ({
        id: Number(s.id || s.site_id || s.mst_siteid || s.code || 1),
        site_name: s.site_name || s.name || s.siteName || `Site ${s.id || s.site_id || 1}`
      }));
    }
  } catch (e) {
    console.warn('[genomicLabService] getSites warning:', e.message);
  }

  // Fallback to Master DB (zydusapp DB public.mst_sites) so all 8 sites are ALWAYS available!
  try {
    const masterRes = await masterPool.query(`
      SELECT id, site_name
      FROM public.mst_sites
      ORDER BY id ASC;
    `);
    if (masterRes.rows && masterRes.rows.length > 0) {
      return masterRes.rows.map(s => ({
        id: Number(s.id),
        site_name: String(s.site_name)
      }));
    }
  } catch (e) {
    console.warn('[genomicLabService] Master DB site lookup notice:', e.message);
  }

  return [];
};

export const getRecordById = async (id) => {
  return await GenomicLabModel.getGenomicLabById(id);
};

export const createRecord = async (body, user, userProfile) => {
  const { userId, userName, siteId } = getUserDetails(user, userProfile, body);

  const { mrn, patient_name, age_gender } = body;
  if (!mrn || !patient_name || !age_gender) {
    throw new Error("MRN, Patient Name, and Age/Gender are required.");
  }

  return await GenomicLabModel.createGenomicLabRecord(
    { ...body, mst_siteid: siteId },
    userId,
    userName
  );
};

export const updateRecord = async (id, body, user, userProfile) => {
  const existing = await GenomicLabModel.getGenomicLabById(id);
  if (!existing) {
    const error = new Error("Record not found");
    error.status = 404;
    throw error;
  }

  const { userId, userName } = getUserDetails(user, userProfile);
  return await GenomicLabModel.updateGenomicLabRecord(id, body, userId, userName);
};

export const deleteRecord = async (id, user, userProfile) => {
  const existing = await GenomicLabModel.getGenomicLabById(id);
  if (!existing) {
    const error = new Error("Record not found");
    error.status = 404;
    throw error;
  }

  const { userId, userName } = getUserDetails(user, userProfile);
  return await GenomicLabModel.deleteGenomicLabRecord(id, userId, userName);
};

export const generateExcelWorkbook = async (req) => {
  const records = await GenomicLabModel.exportGenomicLabModel(req);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Genomic Lab Register");

  worksheet.columns = [
    { header: "Sr. Number", key: "sr_no", width: 10 },
    { header: "Ordered date", key: "order_date", width: 18 },
    { header: "Received Date", key: "received_date", width: 16 },
    { header: "Expected Date", key: "expected_date", width: 16 },
    { header: "Status", key: "process_status", width: 15 },
    { header: "Clinician", key: "doctor_name", width: 22 },
    { header: "ZyGENE Number", key: "zygene_number", width: 18 },
    { header: "Service", key: "service_name", width: 22 },
    { header: "Genomic Service", key: "genomic_services", width: 22 },
    { header: "MRN", key: "mrn", width: 15 },
    { header: "Patient Name", key: "patient_name", width: 22 },
    { header: "Age/Gender", key: "age_gender", width: 14 },
    { header: "Received items", key: "received_items", width: 20 },
    { header: "Block no", key: "block_no", width: 14 },
    { header: "Cellularity", key: "cellularity", width: 16 },
    { header: "Diagnosis", key: "diagnosis", width: 25 },
    { header: "Emailed Date", key: "emailed_info", width: 24 },
    { header: "Upload Report", key: "uploaded_info", width: 26 },
    { header: "Print Report", key: "print_info", width: 24 },
    { header: "Others", key: "others", width: 20 }
  ];

  records.forEach((row, index) => {
    worksheet.addRow({
      sr_no: index + 1,
      order_date: String(row.order_date || ""),
      received_date: String(row.received_date || ""),
      expected_date: String(row.expected_date || ""),
      process_status: String(row.process_status || "In-Progress"),
      doctor_name: String(row.doctor_name || ""),
      zygene_number: String(row.zygene_number || ""),
      service_name: String(row.service_name || ""),
      genomic_services: String(row.genomic_services || row.histopath_services || ""),
      mrn: String(row.mrn || ""),
      patient_name: String(row.patient_name || ""),
      age_gender: String(row.age_gender || (row.age || row.gender ? `${row.age || ''} / ${row.gender || ''}`.trim() : "")),
      received_items: String(row.received_items || ""),
      block_no: String(row.block_no || ""),
      cellularity: String(row.cellularity || ""),
      diagnosis: String(row.diagnosis || ""),
      emailed_info: row.emailed_status ? (row.emailed_date ? `Yes (${formatDate(row.emailed_date)})` : "Yes") : "No",
      uploaded_info: row.uploaded_report_status ? (row.uploaded_report_date ? `Yes (${formatDate(row.uploaded_report_date)})` : "Yes") : "No",
      print_info: row.print_report_status ? (row.print_report_date ? `Yes (${formatDate(row.print_report_date)})` : "Yes") : "No",
      others: String(row.others || "")
    });
  });

  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "1E40AF" }
  };

  return workbook;
};
