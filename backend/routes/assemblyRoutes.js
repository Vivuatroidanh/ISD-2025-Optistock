const express = require('express');
const router = express.Router();
const assemblyController = require('../controllers/assemblyController');
const { isAuthenticatedAPI } = require('../middleware/auth');

router.get('/', isAuthenticatedAPI, assemblyController.getAllAssemblies);
router.get('/group/:groupId', isAuthenticatedAPI, assemblyController.getAssemblyByGroup);
router.get('/:id', isAuthenticatedAPI, assemblyController.getAssemblyById);
router.post('/', isAuthenticatedAPI, assemblyController.createAssembly);
router.put('/:id', isAuthenticatedAPI, assemblyController.updateAssembly);
router.put('/:id/status', isAuthenticatedAPI, assemblyController.updateAssemblyStatus);
router.post('/:id/plating', isAuthenticatedAPI, assemblyController.transferToPlating);

module.exports = router;