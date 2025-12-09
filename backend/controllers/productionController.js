const pool = require('../config/database');

exports.getAllProduction = async (req, res) => {
  try {
    const status = req.query.status || 'all';
    
    let query = `
      SELECT loHangHoa.*, 
             materials.part_name AS material_name,
             machines.ten_may_dap AS machine_name,
             molds.ma_khuon AS mold_code,
             users.username AS created_by_username
      FROM loHangHoa
      LEFT JOIN materials ON loHangHoa.material_id = materials.id
      LEFT JOIN machines ON loHangHoa.machine_id = machines.id
      LEFT JOIN molds ON loHangHoa.mold_id = molds.id
      LEFT JOIN users ON loHangHoa.created_by = users.id
      WHERE loHangHoa.is_hidden = 0
    `;
    
    if (status !== 'all') {
      query += ` AND loHangHoa.status = ?`;
    }
    
    query += ` ORDER BY loHangHoa.created_at DESC`;
    
    const [batches] = status === 'all' 
      ? await pool.query(query)
      : await pool.query(query, [status]);
    
    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    console.error('Error fetching production batches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch production batches'
    });
  }
};

exports.getProductionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [batches] = await pool.query(
      `SELECT loHangHoa.*, 
              materials.part_name AS material_name,
              machines.ten_may_dap AS machine_name,
              molds.ma_khuon AS mold_code,
              users.username AS created_by_username
       FROM loHangHoa
       LEFT JOIN materials ON loHangHoa.material_id = materials.id
       LEFT JOIN machines ON loHangHoa.machine_id = machines.id
       LEFT JOIN molds ON loHangHoa.mold_id = molds.id
       LEFT JOIN users ON loHangHoa.created_by = users.id
       WHERE loHangHoa.id = ?`,
      [id]
    );
    
    if (batches.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Production batch not found'
      });
    }
    
    res.json({
      success: true,
      data: batches[0]
    });
  } catch (error) {
    console.error('Error fetching production batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch production batch'
    });
  }
};

exports.createProduction = async (req, res) => {
  try {
    const { 
      materialId, 
      machineId, 
      moldId, 
      expectedOutput
    } = req.body;
    
    if (!materialId || !machineId || !moldId) {
      return res.status(400).json({
        success: false,
        error: 'Material, machine, and mold are required'
      });
    }
    
    const currentDate = new Date();
    
    const [result] = await pool.query(
      `INSERT INTO loHangHoa (
        material_id,
        machine_id,
        mold_id,
        created_by,
        status,
        expected_output,
        start_date
      ) VALUES (?, ?, ?, ?, 'running', ?, ?)`,
      [
        materialId,
        machineId,
        moldId,
        req.session.user.id,
        expectedOutput || 0,
        currentDate
      ]
    );
    
    await pool.query(
      `UPDATE machines SET status = 'running' WHERE id = ?`,
      [machineId]
    );
    
    const [newBatch] = await pool.query(
      `SELECT loHangHoa.*, 
              materials.part_name AS material_name,
              machines.ten_may_dap AS machine_name,
              molds.ma_khuon AS mold_code,
              users.username AS created_by_username
       FROM loHangHoa
       LEFT JOIN materials ON loHangHoa.material_id = materials.id
       LEFT JOIN machines ON loHangHoa.machine_id = machines.id
       LEFT JOIN molds ON loHangHoa.mold_id = molds.id
       LEFT JOIN users ON loHangHoa.created_by = users.id
       WHERE loHangHoa.id = ?`,
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Production batch created successfully',
      data: newBatch[0]
    });
  } catch (error) {
    console.error('Error creating production batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create production batch'
    });
  }
};

exports.updateProduction = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actualOutput } = req.body;
    
    const [currentBatch] = await pool.query(
      'SELECT * FROM loHangHoa WHERE id = ?',
      [id]
    );
    
    if (currentBatch.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Production batch not found'
      });
    }
    
    if (status) {
      if (status === 'stopping' && currentBatch[0].status !== 'stopping') {
        await pool.query(
          `UPDATE loHangHoa SET 
           status = ?,
           actual_output = ?,
           end_date = NOW()
           WHERE id = ?`,
          [status, actualOutput || currentBatch[0].actual_output, id]
        );
        
        await pool.query(
          `UPDATE machines SET status = 'stopping' WHERE id = ?`,
          [currentBatch[0].machine_id]
        );
      } 
      else if (status === 'running' && currentBatch[0].status === 'stopping') {
        await pool.query(
          `UPDATE loHangHoa SET 
           status = ?,
           actual_output = ?,
           end_date = NULL
           WHERE id = ?`,
          [status, actualOutput || currentBatch[0].actual_output, id]
        );
        
        await pool.query(
          `UPDATE machines SET status = 'running' WHERE id = ?`,
          [currentBatch[0].machine_id]
        );
      }
      else {
        await pool.query(
          `UPDATE loHangHoa SET 
           status = ?,
           actual_output = ?
           WHERE id = ?`,
          [status, actualOutput || currentBatch[0].actual_output, id]
        );
      }
    } else {
      await pool.query(
        `UPDATE loHangHoa SET 
         actual_output = ?
         WHERE id = ?`,
        [actualOutput || currentBatch[0].actual_output, id]
      );
    }
    
    const [updatedBatch] = await pool.query(
      `SELECT loHangHoa.*, 
              materials.part_name AS material_name,
              machines.ten_may_dap AS machine_name,
              molds.ma_khuon AS mold_code,
              users.username AS created_by_username
       FROM loHangHoa
       LEFT JOIN materials ON loHangHoa.material_id = materials.id
       LEFT JOIN machines ON loHangHoa.machine_id = machines.id
       LEFT JOIN molds ON loHangHoa.mold_id = molds.id
       LEFT JOIN users ON loHangHoa.created_by = users.id
       WHERE loHangHoa.id = ?`,
      [id]
    );
    
    res.json({
      success: true,
      message: 'Production batch updated successfully',
      data: updatedBatch[0]
    });
  } catch (error) {
    console.error('Error updating production batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update production batch'
    });
  }
};

exports.deleteProduction = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [batch] = await pool.query(
      'SELECT machine_id, status FROM loHangHoa WHERE id = ?',
      [id]
    );
    
    if (batch.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Production batch not found'
      });
    }
    
    await pool.query(
      'UPDATE loHangHoa SET status = ?, end_date = NOW(), is_hidden = 1 WHERE id = ?', 
      ['stopping', id]
    );
    
    if (batch[0].status === 'running') {
      await pool.query(
        'UPDATE machines SET status = ? WHERE id = ?',
        ['stopping', batch[0].machine_id]
      );
    }
    
    res.json({
      success: true,
      message: 'Production batch archived successfully'
    });
  } catch (error) {
    console.error('Error archiving production batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive production batch'
    });
  }
};

exports.archiveProduction = async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      'UPDATE loHangHoa SET status = ?, end_date = NOW(), is_hidden = 1 WHERE id = ?', 
      ['stopping', id]
    );
    
    res.json({
      success: true,
      message: 'Production batch archived successfully'
    });
  } catch (error) {
    console.error('Error archiving production batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive production batch'
    });
  }
};