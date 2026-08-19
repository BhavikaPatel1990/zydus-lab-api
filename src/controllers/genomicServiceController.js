import * as GenomicServiceModel from '../models/genomicServiceModel.js';
import response from '../utils/response.js';

const getUserDetails = (user, userProfile) => {
  const userId = user?.id || userProfile?.id;
  const userName = user?.full_name || user?.name || userProfile?.full_name || 'Portal User';
  return { userId, userName };
};

export const getAllServices = async (req, res) => {
  try {
    const result = await GenomicServiceModel.getAllGenomicServices(req);
    return response.success(res, 'Genomic services retrieved successfully', result);
  } catch (error) {
    console.error('[GenomicServiceController Error] getAllServices:', error.message);
    return response.handleError(res, error, 'Failed to retrieve genomic services');
  }
};

export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await GenomicServiceModel.getGenomicServiceById(id);
    if (!item) {
      return response.error(res, 'Genomic service not found');
    }
    return response.success(res, 'Genomic service details retrieved successfully', item);
  } catch (error) {
    console.error('[GenomicServiceController Error] getServiceById:', error.message);
    return response.handleError(res, error, 'Failed to retrieve genomic service details');
  }
};

export const createService = async (req, res) => {
  try {
    const { service_name, service_code, price, sample } = req.body;
    if (!service_name || !service_code || price === undefined || !sample) {
      return response.error(res, 'Service Name, Service Code, Price, and Sample are required');
    }

    const { userId, userName } = getUserDetails(req.user, req.userProfile);
    const created = await GenomicServiceModel.createGenomicService(req.body, userId, userName);
    return response.success(res, 'Genomic service created successfully', created);
  } catch (error) {
    console.error('[GenomicServiceController Error] createService:', error.message);
    return response.handleError(res, error, 'Failed to create genomic service');
  }
};

export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await GenomicServiceModel.getGenomicServiceById(id);
    if (!existing) {
      return response.error(res, 'Genomic service not found');
    }

    const { userId, userName } = getUserDetails(req.user, req.userProfile);
    const updated = await GenomicServiceModel.updateGenomicService(id, req.body, userId, userName);
    return response.success(res, 'Genomic service updated successfully', updated);
  } catch (error) {
    console.error('[GenomicServiceController Error] updateService:', error.message);
    return response.handleError(res, error, 'Failed to update genomic service');
  }
};

export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await GenomicServiceModel.getGenomicServiceById(id);
    if (!existing) {
      return response.error(res, 'Genomic service not found');
    }

    const { userId, userName } = getUserDetails(req.user, req.userProfile);
    const deleted = await GenomicServiceModel.deleteGenomicService(id, userId, userName);
    return response.success(res, 'Genomic service deleted successfully', deleted);
  } catch (error) {
    console.error('[GenomicServiceController Error] deleteService:', error.message);
    return response.handleError(res, error, 'Failed to delete genomic service');
  }
};
