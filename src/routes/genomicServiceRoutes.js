import express from 'express';
import { authorize } from '../middleware/authorization.js';
import checkPermission from '../middleware/checkPermission.js';
import * as GenomicServiceController from '../controllers/genomicServiceController.js';
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

  // Also check dev mode or permission override if applicable
  if (isSuperAdmin || req.user?.permissions === 'ALL_ACCESS') {
    return next();
  }

  return response.error(res, 'Access denied. Only Super Admin can modify Genomic Services catalog.');
};

const MODULE_KEY = 'GENOMIC_SERVICE_MASTER';

// All authenticated users can read services to populate dropdown lists
router.get('/', GenomicServiceController.getAllServices);
router.get('/:id', GenomicServiceController.getServiceById);

// Catalog modifications (create, update, delete) restricted to Super Admin
router.post('/', requireSuperAdmin, GenomicServiceController.createService);
router.put('/:id', requireSuperAdmin, GenomicServiceController.updateService);
router.delete('/:id', requireSuperAdmin, GenomicServiceController.deleteService);

export default router;
