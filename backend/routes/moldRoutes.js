const express = require('express');
const router = express.Router();
const moldController = require('../controllers/moldController');
const { isAuthenticatedAPI } = require('../middleware/auth');

router.get('/', isAuthenticatedAPI, moldController.getAllMolds);

module.exports = router;