import ExcelJS from 'exceljs';
import * as GenomicLabModel from '../models/genomicLabModel.js';
import * as HinaiService from './hinaiService.js';
import { formatDate } from '../utils/response.js';

const getUserDetails = (user, userProfile, body = {}) => {
  const userId = user?.id || userProfile?.id;
  const userName = user?.full_name || user?.name || userProfile?.full_name || 'Portal User';
  const siteId = user?.siteId || user?.site_id || user?.siteID || userProfile?.site_id || body.mst_siteid || body.siteId || 1;
  return { userId, userName, siteId: Number(siteId) };
};

export const searchHimsPatients = async (query) => {
  return await HinaiService.searchPatients(query);
};

export const getHimsPatientDetails = async (mrn) => {
  return await HinaiService.getPatientByMrn(mrn);
};

export const getAllRecords = async (req) => {
  return await GenomicLabModel.getAllGenomicLabRecords(req);
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
    { header: "Sr No", key: "sr_no", width: 8 },
    { header: "MRN", key: "mrn", width: 15 },
    { header: "Patient Name", key: "patient_name", width: 22 },
    { header: "Age / Gender", key: "age_gender", width: 14 },
    { header: "Received Items", key: "received_items", width: 20 },
    { header: "Block No", key: "block_no", width: 14 },
    { header: "Cellularity", key: "cellularity", width: 16 },
    { header: "Diagnosis", key: "diagnosis", width: 25 },
    { header: "Emailed Date & Time", key: "emailed_info", width: 24 },
    { header: "Uploaded Report Date & Time", key: "uploaded_info", width: 26 },
    { header: "Print Report Date & Time", key: "print_info", width: 24 },
    { header: "Others", key: "others", width: 20 },
    { header: "Site Name", key: "site_name", width: 18 },
    { header: "Created By", key: "created_by_name", width: 18 },
    { header: "Created At (Date & Time)", key: "created_at", width: 24 }
  ];

  records.forEach((row, index) => {
    worksheet.addRow({
      sr_no: index + 1,
      mrn: String(row.mrn || ""),
      patient_name: String(row.patient_name || ""),
      age_gender: String(row.age_gender || ""),
      received_items: String(row.received_items || ""),
      block_no: String(row.block_no || ""),
      cellularity: String(row.cellularity || ""),
      diagnosis: String(row.diagnosis || ""),
      emailed_info: row.emailed_status ? (row.emailed_date ? `Yes (${formatDate(row.emailed_date)})` : "Yes") : "No",
      uploaded_info: row.uploaded_report_status ? (row.uploaded_report_date ? `Yes (${formatDate(row.uploaded_report_date)})` : "Yes") : "No",
      print_info: row.print_report_status ? (row.print_report_date ? `Yes (${formatDate(row.print_report_date)})` : "Yes") : "No",
      others: String(row.others || ""),
      site_name: typeof row.site === 'object' ? String(row.site?.site_name || row.site_name || "") : String(row.site_name || ""),
      created_by_name: typeof row.created_by_name === 'string' ? row.created_by_name : "Portal User",
      created_at: formatDate(row.created_at) || "-"
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
