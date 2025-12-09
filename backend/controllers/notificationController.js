const pool = require('../config/database');

exports.getAllNotifications = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const [notifications] = await pool.query(
      `SELECT * FROM admin_notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [userId]
    );
    
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const [result] = await pool.query(
      `SELECT COUNT(*) as count FROM admin_notifications 
       WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    
    const unreadCount = result[0].count;
    
    res.json({ success: true, count: unreadCount });
  } catch (error) {
    console.error('Error counting unread notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to count unread notifications', count: 0 });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.session.user.id;
    
    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid notification IDs' });
    }
    
    const placeholders = notificationIds.map(() => '?').join(',');
    
    await pool.query(
      `UPDATE admin_notifications 
       SET is_read = 1 
       WHERE id IN (${placeholders}) AND user_id = ?`,
      [...notificationIds, userId]
    );
    
    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notifications as read' });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    
    await pool.query(
      'DELETE FROM admin_notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
};

exports.clearAllNotifications = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    await pool.query(
      'DELETE FROM admin_notifications WHERE user_id = ?',
      [userId]
    );
    
    res.json({ success: true, message: 'All notifications cleared' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to clear notifications' });
  }
};