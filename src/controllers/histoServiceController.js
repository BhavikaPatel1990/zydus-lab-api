import * as HistoServiceModel from '../models/histoServiceModel.js';
import response from '../utils/response.js';

const getUserDetails = (user, userProfile) => {
  const userId = user?.id || userProfile?.id;
  const userName = user?.full_name || user?.name || userProfile?.full_name || 'Portal User';
  return { userId, userName };
};

export const getAllServices = async (req, res) => {
  try {
    const result = await HistoServiceModel.getAllHistoServices(req);
    return response.success(res, 'Histo services retrieved successfully', result);
  } catch (error) {
    console.error('[HistoServiceController Error] getAllServices:', error.message);
    return response.handleError(res, error, 'Failed to retrieve histo services');
  }
};

export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await HistoServiceModel.getHistoServiceById(id);
    if (!item) {
      return response.error(res, 'Histo service not found');
    }
    return response.success(res, 'Histo service details retrieved successfully', item);
  } catch (error) {
    console.error('[HistoServiceController Error] getServiceById:', error.message);
    return response.handleError(res, error, 'Failed to retrieve histo service details');
  }
};

export const createService = async (req, res) => {
  try {
    const { service_name, service_code, price, sample } = req.body;
    if (!service_name || !service_code) {
      return response.error(res, 'Service Name and Service Code are required');
    }

    const { userId, userName } = getUserDetails(req.user, req.userProfile);
    const created = await HistoServiceModel.createHistoService(req.body, userId, userName);
    return response.success(res, 'Histo service created successfully', created);
  } catch (error) {
    console.error('[HistoServiceController Error] createService:', error.message);
    return response.handleError(res, error, 'Failed to create histo service');
  }
};

export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await HistoServiceModel.getHistoServiceById(id);
    if (!existing) {
      return response.error(res, 'Histo service not found');
    }

    const { userId, userName } = getUserDetails(req.user, req.userProfile);
    const updated = await HistoServiceModel.updateHistoService(id, req.body, userId, userName);
    return response.success(res, 'Histo service updated successfully', updated);
  } catch (error) {
    console.error('[HistoServiceController Error] updateService:', error.message);
    return response.handleError(res, error, 'Failed to update histo service');
  }
};

export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await HistoServiceModel.getHistoServiceById(id);
    if (!existing) {
      return response.error(res, 'Histo service not found');
    }

    const { userId, userName } = getUserDetails(req.user, req.userProfile);
    const deleted = await HistoServiceModel.deleteHistoService(id, userId, userName);
    return response.success(res, 'Histo service deleted successfully', deleted);
  } catch (error) {
    console.error('[HistoServiceController Error] deleteService:', error.message);
    return response.handleError(res, error, 'Failed to delete histo service');
  }
};
