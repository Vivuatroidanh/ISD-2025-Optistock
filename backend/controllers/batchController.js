const pool = require('../config/database');

exports.getAllBatches = async (req, res) => {
  try {
    const [batches] = await pool.query('SELECT * FROM batches ORDER BY id DESC');
    res.json({ success: true, data: batches });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch batches' });
  }
};

exports.getUngroupedBatches = async (req, res) => {
  try {
    const [batches] = await pool.query(
      'SELECT * FROM batches WHERE status != "Grouped for Assembly" OR status IS NULL ORDER BY id DESC'
    );
    res.json({ success: true, data: batches });
  } catch (error) {
    console.error('Error fetching ungrouped batches:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch ungrouped batches' });
  }
};

exports.getGroupedBatches = async (req, res) => {
  try {
    const [batches] = await pool.query(
      'SELECT b.*, bg.group_id FROM batches b ' +
      'JOIN batch_groups bg ON b.id = bg.batch_id ' +
      'WHERE b.status = "Grouped for Assembly" ' +
      'ORDER BY bg.group_id, b.id'
    );
    res.json({ success: true, data: batches });
  } catch (error) {
    console.error('Error fetching grouped batches:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch grouped batches' });
  }
};

exports.getBatchById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query('SELECT * FROM batches WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch batch' });
  }
};

exports.createBatch = async (req, res) => {
  try {
    const { part_name, machine_name, mold_code, quantity, warehouse_entry_time, status, created_by } = req.body;
    
    if (!part_name || !machine_name || !mold_code || !quantity || !warehouse_entry_time) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO batches 
       (part_name, machine_name, mold_code, quantity, warehouse_entry_time, status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [part_name, machine_name, mold_code, quantity, warehouse_entry_time, status, created_by]
    );
    
    const [admins] = await pool.query('SELECT id FROM users WHERE role = "admin" OR role = "quản lý"');
    
    for (const admin of admins) {
      await pool.query(
        `INSERT INTO admin_notifications (user_id, message, notification_type)
         VALUES (?, ?, ?)`,
        [admin.id, `New batch created: ${part_name} (${quantity} units)`, 'system']
      );
    }
    
    res.status(201).json({ 
      success: true, 
      message: 'Batch created successfully',
      batchId: result.insertId
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    res.status(500).json({ success: false, error: 'Failed to create batch' });
  }
};

exports.groupBatches = async (req, res) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const { batchIds, status } = req.body;
    
    if (!Array.isArray(batchIds) || batchIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid batch IDs' });
    }
    
    const placeholders = batchIds.map(() => '?').join(',');
    const [existingGrouped] = await connection.query(
      `SELECT id, part_name FROM batches 
       WHERE id IN (${placeholders}) AND status = "Grouped for Assembly"`,
      batchIds
    );
    
    if (existingGrouped.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        error: `Lô ${existingGrouped[0].part_name} đã được nhóm` 
      });
    }
    
    const [groupResult] = await connection.query(
      'INSERT INTO batch_groups_counter (created_by) VALUES (?)',
      [req.session.user.id]
    );
    
    const groupId = groupResult.insertId;
    
    for (const batchId of batchIds) {
      await connection.query(
        'INSERT INTO batch_groups (group_id, batch_id) VALUES (?, ?)',
        [groupId, batchId]
      );
      
      await connection.query(
        'UPDATE batches SET status = ? WHERE id = ?',
        [status, batchId]
      );
    }
    
    await connection.query(
      `INSERT INTO activity_logs 
       (user_id, action_type, action_details, action_target) 
       VALUES (?, ?, ?, ?)`,
      [
        req.session.user.id,
        'BATCH_GROUP',
        JSON.stringify({ batchIds, groupId }),
        'batches'
      ]
    );
    
    await connection.commit();
    
    res.json({ 
      success: true, 
      message: 'Batches grouped successfully',
      groupId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error grouping batches:', error);
    res.status(500).json({ success: false, error: 'Failed to group batches' });
  } finally {
    connection.release();
  }
};

exports.updateBatchStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }
    
    await pool.query(
      'UPDATE batches SET status = ? WHERE id = ?',
      [status, id]
    );
    
    await pool.query(
      `INSERT INTO activity_logs 
       (user_id, action_type, action_details, action_target) 
       VALUES (?, ?, ?, ?)`,
      [
        req.session.user.id,
        'BATCH_STATUS_UPDATE',
        JSON.stringify({ batchId: id, newStatus: status }),
        'batches'
      ]
    );
    
    res.json({ 
      success: true, 
      message: 'Batch status updated successfully' 
    });
  } catch (error) {
    console.error('Error updating batch status:', error);
    res.status(500).json({ success: false, error: 'Failed to update batch status' });
  }
};
