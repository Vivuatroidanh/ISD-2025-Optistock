const express = require('express');
const router = express.Router();
const materialController = require('../controllers/materialController');
const { isAuthenticatedAPI } = require('../middleware/auth');

router.get('/', isAuthenticatedAPI, materialController.getAllMaterials);
router.get('/:id', isAuthenticatedAPI, materialController.getMaterialById);
router.post('/', isAuthenticatedAPI, materialController.createMaterial);
router.delete('/:id', isAuthenticatedAPI, materialController.deleteMaterial);
router.delete('/', isAuthenticatedAPI, materialController.deleteMaterials);

module.exports = router;