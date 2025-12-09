const pool = require('../config/database');

exports.getAllPlating = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.id, p.assembly_id, p.plating_start_time, p.plating_end_time, 
        p.status, p.created_at, p.product_name, p.product_code, p.notes,
        a.group_id, a.product_quantity, a.pic_id,
        u.username as pic_name
      FROM plating p
      JOIN assembly_components a ON p.assembly_id = a.id
      JOIN users u ON a.pic_id = u.id
      ORDER BY p.created_at DESC
    `);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching plating records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plating records'
    });
  }
};

exports.getPlatingById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query(`
      SELECT 
        p.id, p.assembly_id, p.plating_start_time, p.plating_end_time, 
        p.status, p.created_at, p.product_name, p.product_code, p.notes,
        a.group_id, a.product_quantity, a.pic_id,
        u.username as pic_name
      FROM plating p
      JOIN assembly_components a ON p.assembly_id = a.id
      JOIN users u ON a.pic_id = u.id
      WHERE p.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Plating record not found'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching plating record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plating record'
    });
  }
};

exports.getPlatingByAssembly = async (req, res) => {
  try {
    const { assemblyId } = req.params;
    
    const [rows] = await pool.query(`
      SELECT 
        p.id, p.assembly_id, p.plating_start_time, p.plating_end_time, 
        p.status, p.created_at, p.product_name, p.product_code, p.notes,
        a.group_id, a.product_quantity, a.pic_id,
        u.username as pic_name
      FROM plating p
      JOIN assembly_components a ON p.assembly_id = a.id
      JOIN users u ON a.pic_id = u.id
      WHERE p.assembly_id = ?
    `, [assemblyId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No plating record found for this assembly'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching plating by assembly:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plating by assembly'
    });
  }
};

exports.updatePlating = async (req, res) => {
  try {
    const { id } = req.params;
    const { product_name, product_code, notes, status, platingDate, platingTime } = req.body;
    
    let updateFields = [];
    let queryParams = [];
    
    if (product_name !== undefined) {
      updateFields.push('product_name = ?');
      queryParams.push(product_name);
    }
    
    if (product_code !== undefined) {
      updateFields.push('product_code = ?');
      queryParams.push(product_code);
    }
    
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      queryParams.push(notes);
    }
    
    if (platingDate && platingTime) {
      const [day, month, year] = platingDate.split('/');
      const formattedDateTime = `${year}-${month}-${day} ${platingTime}:00`;
      
      updateFields.push('plating_start_time = ?');
      queryParams.push(formattedDateTime);
    }
    
    if (status !== undefined) {
      updateFields.push('status = ?');
      queryParams.push(status);
      
      if (status === 'completed') {
        updateFields.push('plating_end_time = NOW()');
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    queryParams.push(id);
    
    await pool.query(
      `UPDATE plating SET ${updateFields.join(', ')} WHERE id = ?`,
      queryParams
    );
    
    res.json({
      success: true,
      message: 'Plating record updated successfully'
    });
  } catch (error) {
    console.error('Error updating plating record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update plating record'
    });
  }
};

exports.completePlating = async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(`
      UPDATE plating
      SET status = 'completed', plating_end_time = NOW()
      WHERE id = ?
    `, [id]);
    
    res.json({
      success: true,
      message: 'Plating process completed successfully'
    });
  } catch (error) {
    console.error('Error completing plating process:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete plating process'
    });
  }
};