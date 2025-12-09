const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { isAuthenticatedAPI } = require('../middleware/auth');

router.get('/', isAuthenticatedAPI, batchController.getAllBatches);
router.get('/ungrouped', isAuthenticatedAPI, batchController.getUngroupedBatches);
router.get('/grouped', isAuthenticatedAPI, batchController.getGroupedBatches);
router.get('/:id', isAuthenticatedAPI, batchController.getBatchById);
router.post('/', isAuthenticatedAPI, batchController.createBatch);
router.post('/group', isAuthenticatedAPI, batchController.groupBatches);
router.put('/:id/status', isAuthenticatedAPI, batchController.updateBatchStatus);

module.exports = router;