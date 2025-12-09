const express = require('express');
const router = express.Router();
const platingController = require('../controllers/platingController');
const { isAuthenticatedAPI } = require('../middleware/auth');

router.get('/', isAuthenticatedAPI, platingController.getAllPlating);
router.get('/assembly/:assemblyId', isAuthenticatedAPI, platingController.getPlatingByAssembly);
router.get('/:id', isAuthenticatedAPI, platingController.getPlatingById);
router.put('/:id', isAuthenticatedAPI, platingController.updatePlating);
router.put('/:id/complete', isAuthenticatedAPI, platingController.completePlating);

module.exports = router;