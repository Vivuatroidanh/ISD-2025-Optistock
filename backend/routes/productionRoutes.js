const express = require('express');
const router = express.Router();
const productionController = require('../controllers/productionController');
const { isAuthenticatedAPI } = require('../middleware/auth');

router.get('/', isAuthenticatedAPI, productionController.getAllProduction);
router.get('/:id', isAuthenticatedAPI, productionController.getProductionById);
router.post('/', isAuthenticatedAPI, productionController.createProduction);
router.put('/:id', isAuthenticatedAPI, productionController.updateProduction);
router.put('/:id/archive', isAuthenticatedAPI, productionController.archiveProduction);
router.delete('/:id', isAuthenticatedAPI, productionController.deleteProduction);

module.exports = router;