import express from 'express';
import { authorize } from '../middleware/authorization.js';
import * as PermissionController from '../controllers/permissionController.js';
import response from '../utils/response.js';

const router = express.Router();

router.use(authorize);

const requireSuperAdmin = (req, res, next) => {
  const roles = req.user?.roles || req.user?.role;
  let isSuperAdmin = false;
  if (typeof roles === 'string') {
    isSuperAdmin = roles.toUpperCase() === 'SUPER_ADMIN';
  } else if (Array.isArray(roles)) {
    isSuperAdmin = roles.some(r => {
      const name = typeof r === 'object' ? (r.name || r.role?.name || '') : String(r);
      return name.toUpperCase() === 'SUPER_ADMIN';
    });
  }

  if (isSuperAdmin || req.user?.permissions === 'ALL_ACCESS' || req.user?.is_super_admin) {
    return next();
  }

  return response.error(res, 'Access denied. Only Super Admin can manage lab module and site permissions.');
};

// GET all dynamic sites from Site Master
router.get('/sites', requireSuperAdmin, PermissionController.getSites);

// GET all dynamic sub-modules under /labportal from Module Master
router.get('/modules', requireSuperAdmin, PermissionController.getModules);

// GET all master roles dynamically
router.get('/roles', requireSuperAdmin, PermissionController.getRoles);

// GET all portal master employees dynamically
router.get('/portal-users', requireSuperAdmin, PermissionController.getPortalUsers);

// GET all configured lab portal users
router.get('/configured-users', requireSuperAdmin, PermissionController.getConfiguredUsers);

// GET permissions for a user
router.get('/user/:userId', requireSuperAdmin, PermissionController.getUserPermissions);

// SAVE/UPDATE module & site rights matrix for a user
router.post('/save', requireSuperAdmin, PermissionController.saveUserPermissions);

export default router;
