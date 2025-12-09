const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { isAuthenticatedAPI } = require('../middleware/auth');

router.get('/', isAuthenticatedAPI, dashboardController.getDashboard);

module.exports = router;