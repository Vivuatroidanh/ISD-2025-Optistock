const pool = require('../config/database');

exports.getAllAssemblies = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT ac.*, u.username as pic_name 
      FROM assembly_components ac
      JOIN users u ON ac.pic_id = u.id
      ORDER BY ac.created_at DESC
    `);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching assemblies:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assemblies' });
  }
};

exports.getAssemblyById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query(`
      SELECT ac.*, u.username as pic_name, u.full_name as pic_full_name
      FROM assembly_components ac
      JOIN users u ON ac.pic_id = u.id
      WHERE ac.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Assembly not found' });
    }
    
    const [batchRows] = await pool.query(`
      SELECT b.id, b.part_name, b.machine_name, b.mold_code, b.quantity
      FROM batches b
      JOIN batch_groups bg ON b.id = bg.batch_id
      WHERE bg.group_id = ?
    `, [rows[0].group_id]);
    
    const assemblyData = {
      ...rows[0],
      batches: batchRows
    };
    
    res.json({ success: true, data: assemblyData });
  } catch (error) {
    console.error('Error fetching assembly:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assembly' });
  }
};

exports.getAssemblyByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const [rows] = await pool.query(`
      SELECT ac.*, u.username as pic_name 
      FROM assembly_components ac
      JOIN users u ON ac.pic_id = u.id
      WHERE ac.group_id = ?
    `, [groupId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No assembly found for this group' });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching assembly by group:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assembly by group' });
  }
};

exports.createAssembly = async (req, res) => {
  try {
    const { groupId, picId, startTime, completionTime, productQuantity, productName, productCode, notes } = req.body;
    
    if (!groupId || !picId || !productQuantity) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    let parsedStartTime = null;
    try {
      if (startTime && startTime.includes(' - ')) {
        const [time, date] = startTime.split(' - ');
        const [hours, minutes, seconds] = time.split(':');
        const [day, month, year] = date.split('/');
        
        parsedStartTime = new Date(year, month - 1, day, hours, minutes, seconds);
      } else {
        parsedStartTime = new Date();
      }
    } catch (e) {
      parsedStartTime = new Date();
    }
    
    let parsedCompletionTime = null;
    if (completionTime && completionTime.includes(' - ')) {
      try {
        const [time, date] = completionTime.split(' - ');
        const [hours, minutes, seconds] = time.split(':');
        const [day, month, year] = date.split('/');
        
        parsedCompletionTime = new Date(year, month - 1, day, hours, minutes, seconds);
      } catch (e) {
        // If parsing fails, leave as null
      }
    }
    
    const [result] = await pool.query(`
      INSERT INTO assembly_components 
      (group_id, pic_id, start_time, completion_time, product_quantity, product_name, product_code, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing')
    `, [
      groupId,
      picId,
      parsedStartTime,
      parsedCompletionTime,
      productQuantity,
      productName || null,
      productCode || null,
      notes || null
    ]);
    
    res.status(201).json({ 
      success: true, 
      message: 'Assembly created successfully', 
      assemblyId: result.insertId 
    });
  } catch (error) {
    console.error('Error creating assembly:', error);
    res.status(500).json({ success: false, error: 'Failed to create assembly' });
  }
};

exports.updateAssembly = async (req, res) => {
  try {
    const { id } = req.params;
    const { picId, startTime, completionTime, productQuantity, status } = req.body;
    
    let updateFields = [];
    let queryParams = [];
    
    if (picId) {
      updateFields.push('pic_id = ?');
      queryParams.push(picId);
    }
    
    if (startTime) {
      updateFields.push('start_time = ?');
      queryParams.push(new Date(startTime));
    }
    
    if (completionTime) {
      updateFields.push('completion_time = ?');
      queryParams.push(new Date(completionTime));
    }
    
    if (productQuantity) {
      updateFields.push('product_quantity = ?');
      queryParams.push(productQuantity);
    }
    
    if (status) {
      updateFields.push('status = ?');
      queryParams.push(status);
    }
    
    queryParams.push(id);
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    const query = `UPDATE assembly_components SET ${updateFields.join(', ')} WHERE id = ?`;
    
    await pool.query(query, queryParams);
    
    res.json({ success: true, message: 'Assembly updated successfully' });
  } catch (error) {
    console.error('Error updating assembly:', error);
    res.status(500).json({ success: false, error: 'Failed to update assembly' });
  }
};

exports.updateAssemblyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }
    
    await pool.query(
      'UPDATE assembly_components SET status = ? WHERE id = ?',
      [status, id]
    );
    
    res.json({ success: true, message: 'Assembly status updated successfully' });
  } catch (error) {
    console.error('Error updating assembly status:', error);
    res.status(500).json({ success: false, error: 'Failed to update assembly status' });
  }
};

exports.transferToPlating = async (req, res) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const { id } = req.params;
    
    const [assemblyResults] = await connection.query(
      `SELECT * FROM assembly_components WHERE id = ?`,
      [id]
    );
    
    if (assemblyResults.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Assembly not found'
      });
    }
    
    const assembly = assemblyResults[0];
    
    await connection.query(
      `UPDATE assembly_components SET status = 'plating' WHERE id = ?`,
      [id]
    );
    
    const now = new Date();
    await connection.query(
      `INSERT INTO plating 
       (assembly_id, product_name, product_code, notes, plating_start_time, status) 
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        assembly.product_name,
        assembly.product_code,
        assembly.notes,
        now
      ]
    );
    
    await connection.commit();
    connection.release();
    
    res.json({
      success: true,
      message: 'Successfully transferred to plating process'
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Error transferring to plating:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to transfer to plating process'
    });
  }
};