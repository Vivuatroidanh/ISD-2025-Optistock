const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.get('/status', authController.getStatus);
router.post('/logout', authController.logout);

module.exports = router;