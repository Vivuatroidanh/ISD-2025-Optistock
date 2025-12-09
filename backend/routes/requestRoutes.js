const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { isAuthenticatedAPI, isAdminAPI } = require('../middleware/auth');

router.get('/', isAuthenticatedAPI, requestController.getAllRequests);
router.get('/:id', isAuthenticatedAPI, requestController.getRequestById);
router.post('/', isAuthenticatedAPI, requestController.createRequest);
router.put('/:id', isAuthenticatedAPI, isAdminAPI, requestController.updateRequest);

module.exports = router;