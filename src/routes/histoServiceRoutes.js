import express from 'express';
import { authorize } from '../middleware/authorization.js';
import * as HistoServiceController from '../controllers/histoServiceController.js';
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

  if (isSuperAdmin || req.user?.permissions === 'ALL_ACCESS') {
    return next();
  }

  return response.error(res, 'Access denied. Only Super Admin can modify Histo Services catalog.');
};

// All authenticated users can read services to populate dropdown lists
router.get('/', HistoServiceController.getAllServices);
router.get('/:id', HistoServiceController.getServiceById);

// Catalog modifications (create, update, delete) restricted to Super Admin
router.post('/', requireSuperAdmin, HistoServiceController.createService);
router.put('/:id', requireSuperAdmin, HistoServiceController.updateService);
router.delete('/:id', requireSuperAdmin, HistoServiceController.deleteService);

export default router;
