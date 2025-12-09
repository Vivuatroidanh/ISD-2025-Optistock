const express = require('express');
const router = express.Router();
const finishedProductController = require('../controllers/finishedProductController');
const { isAuthenticatedAPI } = require('../middleware/auth');

router.get('/', isAuthenticatedAPI, finishedProductController.getAllFinishedProducts);
router.get('/:id', isAuthenticatedAPI, finishedProductController.getFinishedProductById);
router.post('/', isAuthenticatedAPI, finishedProductController.createFinishedProduct);
router.put('/:id/status', isAuthenticatedAPI, finishedProductController.updateFinishedProductStatus);

module.exports = router;