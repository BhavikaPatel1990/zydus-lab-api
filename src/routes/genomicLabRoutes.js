import express from 'express';
import { authorize } from '../middleware/authorization.js';
import checkPermission from '../middleware/checkPermission.js';
import * as GenomicLabController from '../controllers/genomicLabController.js';

const router = express.Router();

router.use(authorize);

const MODULE_KEY = 'GENOMIC_LAB';

// HINAI Oracle Sync & Site Master Routes
router.post('/sync-hinai', GenomicLabController.syncHinai);
router.get('/sync-hinai', GenomicLabController.syncHinai);
router.get('/sites', GenomicLabController.getSites);

// Genomic Lab CRUD & Export Routes (Manual Entry Create, Update, Delete, Read, Export)
router.get('/', checkPermission(MODULE_KEY, 'READ'), GenomicLabController.getAllRecords);
router.get('/export', checkPermission(MODULE_KEY, 'EXPORT'), GenomicLabController.exportExcel);
router.get('/:id', checkPermission(MODULE_KEY, 'READ'), GenomicLabController.getRecordById);
router.post('/', checkPermission(MODULE_KEY, 'CREATE'), GenomicLabController.createRecord);
router.put('/:id', checkPermission(MODULE_KEY, 'UPDATE'), GenomicLabController.updateRecord);
router.delete('/:id', checkPermission(MODULE_KEY, 'DELETE'), GenomicLabController.deleteRecord);

export default router;
