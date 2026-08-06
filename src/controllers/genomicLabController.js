import response from '../utils/response.js';
import * as genomicLabService from '../services/genomicLabService.js';

export const searchHimsPatients = async (req, res) => {
  try {
    const { q } = req.query;
    const patients = await genomicLabService.searchHimsPatients(q);
    return response.success(res, "HIMS patient search completed", patients);
  } catch (error) {
    console.error("Error in searchHimsPatients:", error);
    return response.serverError(res, error.message);
  }
};

export const getHimsPatientDetails = async (req, res) => {
  try {
    const { mrn } = req.query;
    const patient = await genomicLabService.getHimsPatientDetails(mrn);
    if (!patient) {
      return response.normalError(res, "Patient not found in HIMS");
    }
    return response.success(res, "HIMS patient details retrieved", patient);
  } catch (error) {
    console.error("Error in getHimsPatientDetails:", error);
    return response.serverError(res, error.message);
  }
};

export const getAllRecords = async (req, res) => {
  try {
    const result = await genomicLabService.getAllRecords(req);
    return response.success(
      res,
      "Genomic lab records retrieved successfully",
      result.data,
      result.pagination
    );
  } catch (error) {
    console.error("Error in getAllRecords:", error);
    return response.serverError(res, error.message);
  }
};

export const getRecordById = async (req, res) => {
  try {
    const record = await genomicLabService.getRecordById(req.params.id);
    if (!record) {
      return response.normalError(res, "Record not found");
    }
    return response.success(res, "Record retrieved successfully", record);
  } catch (error) {
    return response.serverError(res, error.message);
  }
};

export const createRecord = async (req, res) => {
  try {
    const newRecord = await genomicLabService.createRecord(req.body, req.user, req.userProfile);
    return response.success(res, "Genomic lab entry created successfully", newRecord);
  } catch (error) {
    console.error("Error in createRecord:", error);
    return response.serverError(res, error.message);
  }
};

export const updateRecord = async (req, res) => {
  try {
    const updated = await genomicLabService.updateRecord(req.params.id, req.body, req.user, req.userProfile);
    return response.success(res, "Genomic lab entry updated successfully", updated);
  } catch (error) {
    console.error("Error in updateRecord:", error);
    if (error.status === 404) {
      return response.normalError(res, error.message);
    }
    return response.serverError(res, error.message);
  }
};

export const deleteRecord = async (req, res) => {
  try {
    await genomicLabService.deleteRecord(req.params.id, req.user, req.userProfile);
    return response.success(res, "Genomic lab entry deleted successfully", null);
  } catch (error) {
    console.error("Error in deleteRecord:", error);
    if (error.status === 404) {
      return response.normalError(res, error.message);
    }
    return response.serverError(res, error.message);
  }
};

export const exportExcel = async (req, res) => {
  try {
    const workbook = await genomicLabService.generateExcelWorkbook(req);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Genomic_Lab_Register_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error("Error in exportExcel:", error);
    return response.serverError(res, error.message);
  }
};
