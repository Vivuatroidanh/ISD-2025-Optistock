const express = require('express');
const router = express.Router();
const machineController = require('../controllers/machineController');
const { isAuthenticatedAPI } = require('../middleware/auth');

router.get('/', isAuthenticatedAPI, machineController.getAllMachines);
router.post('/:id/stop', isAuthenticatedAPI, machineController.saveMachineStop);

module.exports = router;