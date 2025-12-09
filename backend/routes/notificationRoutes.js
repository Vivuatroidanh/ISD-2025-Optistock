const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { isAuthenticatedAPI } = require('../middleware/auth');

router.get('/', isAuthenticatedAPI, notificationController.getAllNotifications);
router.get('/unread-count', isAuthenticatedAPI, notificationController.getUnreadCount);
router.put('/read', isAuthenticatedAPI, notificationController.markAsRead);
router.delete('/:id', isAuthenticatedAPI, notificationController.deleteNotification);
router.delete('/', isAuthenticatedAPI, notificationController.clearAllNotifications);

module.exports = router;