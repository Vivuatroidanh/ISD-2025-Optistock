const pool = require('../config/database');

exports.getAllFinishedProducts = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT fp.*, 
             p.product_name as plating_product_name,
             p.product_code as plating_product_code,
             a.group_id,
             u.username as created_by_name,
             COALESCE(qc.status, 'Pending') as quality_status,
             qc.defect_count,
             qc.checked_by as inspector_id,
             inspector.username as inspector_name
      FROM finished_products fp
      LEFT JOIN plating p ON fp.plating_id = p.id
      LEFT JOIN assembly_components a ON fp.assembly_id = a.id
      LEFT JOIN users u ON fp.created_by = u.id
      LEFT JOIN (
          SELECT product_id, status, defect_count, checked_by
          FROM quality_checks
          WHERE (product_id, check_date) IN (
              SELECT product_id, MAX(check_date)
              FROM quality_checks
              GROUP BY product_id
          )
      ) qc ON fp.id = qc.product_id
      LEFT JOIN users inspector ON qc.checked_by = inspector.id
      ORDER BY fp.created_at DESC
    `);
    
    const processedRows = rows.map(product => {
      const usableCount = Math.max(0, product.quantity - (product.defect_count || 0));
      
      return {
        ...product,
        qualityStatus: product.quality_status || 'Pending',
        defectCount: product.defect_count || 0,
        usableCount,
        displayStatus: product.quality_status === 'OK' ? 'OK' : 
                      product.quality_status === 'NG' ? 'NG' : 'Chờ kiểm tra'
      };
    });
    
    res.json({ success: true, data: processedRows });
  } catch (error) {
    console.error('Error fetching finished products:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch finished products' });
  }
};

exports.getFinishedProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [products] = await pool.query(`
      SELECT fp.*, 
             p.product_name as plating_product_name,
             p.product_code as plating_product_code,
             a.group_id,
             u.username as created_by_name,
             COALESCE(qc.status, 'Pending') as quality_status,
             qc.defect_count,
             qc.checked_by as inspector_id,
             inspector.username as inspector_name,
             qc.check_date as inspection_date
      FROM finished_products fp
      LEFT JOIN plating p ON fp.plating_id = p.id
      LEFT JOIN assembly_components a ON fp.assembly_id = a.id
      LEFT JOIN users u ON fp.created_by = u.id
      LEFT JOIN (
          SELECT product_id, status, defect_count, checked_by, check_date
          FROM quality_checks
          WHERE (product_id, check_date) IN (
              SELECT product_id, MAX(check_date)
              FROM quality_checks
              GROUP BY product_id
          )
      ) qc ON fp.id = qc.product_id
      LEFT JOIN users inspector ON qc.checked_by = inspector.id
      WHERE fp.id = ?
    `, [id]);
    
    if (products.length === 0) {
      return res.status(404).json({ success: false, error: 'Finished product not found' });
    }
    
    const product = products[0];
    
    product.usableCount = Math.max(0, product.quantity - (product.defect_count || 0));
    product.qualityStatus = product.quality_status || 'Pending';
    product.displayStatus = product.quality_status === 'OK' ? 'OK' : 
                           product.quality_status === 'NG' ? 'NG' : 'Chờ kiểm tra';
    
    const [materialRows] = await pool.query(`
      SELECT * FROM materials
      ORDER BY id DESC
      LIMIT 1
    `);
    
    const [productionRows] = await pool.query(`
      SELECT l.*, 
             m.ten_may_dap as machine_name,
             mold.ma_khuon as mold_code,
             u.username as operator_name,
             DATE_FORMAT(l.start_date, '%d/%m/%Y %H:%i:%s') as formatted_start_date,
             DATE_FORMAT(l.end_date, '%d/%m/%Y %H:%i:%s') as formatted_end_date
      FROM loHangHoa l
      LEFT JOIN machines m ON l.machine_id = m.id
      LEFT JOIN molds mold ON l.mold_id = mold.id
      LEFT JOIN users u ON l.created_by = u.id
      LEFT JOIN materials mat ON l.material_id = mat.id
      LEFT JOIN batches b ON b.machine_name = m.ten_may_dap AND b.mold_code = mold.ma_khuon
      LEFT JOIN batch_groups bg ON bg.batch_id = b.id
      WHERE bg.group_id = ?
      ORDER BY l.created_at DESC
      LIMIT 1
    `, [product.group_id]);
    
    const [assemblyRows] = await pool.query(`
      SELECT ac.*, 
             u.username as pic_name,
             u.full_name as pic_full_name
      FROM assembly_components ac
      JOIN users u ON ac.pic_id = u.id
      WHERE ac.id = ?
    `, [product.assembly_id]);
    
    const [platingRows] = await pool.query(`
      SELECT p.*,
             DATE_FORMAT(p.plating_start_time, '%Y-%m-%d') as formatted_start_date,
             DATE_FORMAT(p.plating_start_time, '%H:%i:%s') as formatted_start_time,
             DATE_FORMAT(p.plating_end_time, '%Y-%m-%d') as formatted_end_date, 
             DATE_FORMAT(p.plating_end_time, '%H:%i:%s') as formatted_end_time
      FROM plating p
      WHERE p.id = ?
    `, [product.plating_id]);
    
    const [batchRows] = await pool.query(`
      SELECT b.*
      FROM batches b
      JOIN batch_groups bg ON b.id = bg.batch_id
      WHERE bg.group_id = ?
    `, [product.group_id]);
    
    const [qualityHistory] = await pool.query(`
      SELECT qc.*, 
             u.username as inspector_name, 
             u.full_name as inspector_full_name,
             DATE_FORMAT(qc.check_date, '%Y-%m-%d %H:%i:%s') as formatted_check_date
      FROM quality_checks qc
      JOIN users u ON qc.checked_by = u.id
      WHERE qc.product_id = ?
      ORDER BY qc.check_date DESC
    `, [id]);
    
    product.history = {
      material: materialRows.length > 0 ? materialRows[0] : null,
      production: productionRows.length > 0 ? productionRows[0] : null,
      assembly: assemblyRows.length > 0 ? assemblyRows[0] : null,
      plating: platingRows.length > 0 ? platingRows[0] : null,
      batches: batchRows,
      quality_checks: qualityHistory
    };
    
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error fetching finished product:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch finished product', details: error.message });
  }
};

exports.createFinishedProduct = async (req, res) => {
  try {
    const { 
      platingId, 
      assemblyId, 
      groupId, 
      productName, 
      productCode, 
      quantity, 
      status = 'in_stock',
      qrCodeData = {}
    } = req.body;
    
    if (!platingId || !assemblyId || !groupId || !productName || !productCode || !quantity) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const [result] = await pool.query(`
      INSERT INTO finished_products 
      (plating_id, assembly_id, group_id, product_name, product_code, quantity, completion_date, created_by, status, qr_code_data)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)
    `, [
      platingId,
      assemblyId,
      groupId,
      productName,
      productCode,
      quantity,
      req.session.user.id,
      status,
      JSON.stringify(qrCodeData)
    ]);
    
    const [newProduct] = await pool.query(`
      SELECT * FROM finished_products WHERE id = ?
    `, [result.insertId]);
    
    res.status(201).json({ 
      success: true, 
      message: 'Finished product added successfully',
      data: newProduct[0]
    });
  } catch (error) {
    console.error('Error adding finished product:', error);
    res.status(500).json({ success: false, error: 'Failed to add finished product' });
  }
};

exports.updateFinishedProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, defect_count } = req.body;
    
    if (status !== 'OK' && status !== 'NG') {
      return res.status(400).json({ 
        success: false, 
        error: 'Status must be either OK or NG' 
      });
    }
    
    const [products] = await pool.query(
      'SELECT * FROM finished_products WHERE id = ?',
      [id]
    );
    
    if (products.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    const product = products[0];
    
    let finalDefectCount = 0;
    
    if (status === 'NG') {
      if (defect_count !== undefined) {
        finalDefectCount = parseInt(defect_count, 10);
        
        if (isNaN(finalDefectCount) || finalDefectCount < 0) {
          return res.status(400).json({ 
            success: false, 
            error: 'Defect count must be a non-negative number' 
          });
        }
        
        if (finalDefectCount > product.quantity) {
          return res.status(400).json({ 
            success: false, 
            error: 'Defect count cannot exceed total quantity' 
          });
        }
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'Defect count is required when status is NG' 
        });
      }
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      const productStatus = status === 'NG' ? 'defective' : 'in_stock';
      
      await connection.query(`
        UPDATE finished_products
        SET status = ?, defect_count = ?
        WHERE id = ?
      `, [productStatus, finalDefectCount, id]);
      
      await connection.query(`
        INSERT INTO quality_checks 
        (product_id, status, defect_count, checked_by, check_date, notes) 
        VALUES (?, ?, ?, ?, NOW(), ?)
      `, [
        id, 
        status, 
        finalDefectCount, 
        req.session.user.id, 
        `Quality check by ${req.session.user.username}: ${status}${status === 'NG' ? ' - ' + finalDefectCount + ' defective units' : ''}`
      ]);
      
      await connection.commit();
      
      res.json({ 
        success: true, 
        message: 'Product status and defect count updated successfully',
        data: {
          id,
          status,
          defect_count: finalDefectCount
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update product status',
      details: error.message 
    });
  }
};