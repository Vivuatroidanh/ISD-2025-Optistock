const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAuthenticatedAPI, isAdminAPI } = require('../middleware/auth');

router.get('/', isAuthenticatedAPI, isAdminAPI, userController.getAllUsers);
router.get('/:id', isAuthenticatedAPI, userController.getUserById);
router.post('/', isAuthenticatedAPI, isAdminAPI, userController.createUser);
router.put('/:id', isAuthenticatedAPI, userController.updateUser);

module.exports = router;