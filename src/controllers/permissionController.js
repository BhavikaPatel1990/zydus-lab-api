import response from '../utils/response.js';
import * as permissionService from '../services/permissionService.js';

export const getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const permissions = await permissionService.getUserLabPermissions(userId);
    return response.success(res, "User lab permissions retrieved successfully", permissions);
  } catch (error) {
    console.error("Error in getUserPermissions:", error);
    return response.serverError(res, error.message);
  }
};

export const saveUserPermissions = async (req, res) => {
  try {
    const { user_id, emp_id, user_name, user_email, module_permissions } = req.body;
    if (!user_id) {
      return response.normalError(res, "user_id is required.");
    }
    const updated = await permissionService.saveUserLabPermissions(user_id, user_name, user_email, module_permissions, emp_id);
    return response.success(res, "User lab module & site rights saved successfully", updated);
  } catch (error) {
    console.error("Error in saveUserPermissions:", error);
    return response.serverError(res, error.message);
  }
};

export const getConfiguredUsers = async (req, res) => {
  try {
    const users = await permissionService.getConfiguredUsers();
    return response.success(res, "Configured lab users retrieved successfully", users);
  } catch (error) {
    console.error("Error in getConfiguredUsers:", error);
    return response.serverError(res, error.message);
  }
};

export const getPortalUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const users = await permissionService.getDynamicPortalUsers(req.headers.authorization, role, search);
    return response.success(res, "Portal master employees retrieved successfully", users);
  } catch (error) {
    console.error("Error in getPortalUsers:", error);
    return response.serverError(res, error.message);
  }
};

export const getRoles = async (req, res) => {
  try {
    const roles = await permissionService.fetchCentralRoleList(req.headers.authorization);
    return response.success(res, "Master roles retrieved successfully", roles);
  } catch (error) {
    console.error("Error in getRoles:", error);
    return response.serverError(res, error.message);
  }
};

export const getSites = async (req, res) => {
  try {
    const sites = await permissionService.getSites(req.headers.authorization);
    return response.success(res, "Dynamic site master list retrieved successfully", sites);
  } catch (error) {
    console.error("Error in getSites:", error);
    return response.serverError(res, error.message);
  }
};

export const getModules = async (req, res) => {
  try {
    const modules = await permissionService.getModules(req.headers.authorization);
    return response.success(res, "Dynamic lab sub-modules list retrieved successfully", modules);
  } catch (error) {
    console.error("Error in getModules:", error);
    return response.serverError(res, error.message);
  }
};
