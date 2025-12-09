const pool = require('../config/database');
const { safelyParseJSON } = require('../services/helperService');

exports.getAllRequests = async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const isAdminOrManager = req.session.user.role === 'admin' || req.session.user.role === 'quản lý';
    
    const whereClause = isAdminOrManager
      ? 'WHERE mr.status = ?' 
      : 'WHERE mr.status = ? AND mr.user_id = ?';
    
    const queryParams = isAdminOrManager
      ? [status]
      : [status, req.session.user.id];
    
    const [requests] = await pool.query(
      `SELECT mr.*, u.username as user_username, u.full_name as user_full_name
       FROM material_requests mr
       JOIN users u ON mr.user_id = u.id
       ${whereClause}
       ORDER BY mr.request_date DESC`,
      queryParams
    );
    
    const processedRequests = requests.map(request => {
      const processedRequest = {...request};
      
      if (processedRequest.request_data) {
        try {
          processedRequest.request_data = safelyParseJSON(processedRequest.request_data);
        } catch (error) {
          console.error(`Error processing request data for ID ${request.id}:`, error);
          processedRequest.request_data = {};
        }
      }
      
      return processedRequest;
    });
    
    res.json({ success: true, data: processedRequests });
  } catch (error) {
    console.error('Error fetching material requests:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch material requests' });
  }
};

exports.createRequest = async (req, res) => {
  try {
    console.log('Received material request payload:', JSON.stringify(req.body));
    
    const { requestType, materialId, requestData } = req.body;
    
    if (!['add', 'edit', 'delete'].includes(requestType)) {
      return res.status(400).json({ success: false, error: 'Invalid request type' });
    }
    
    if ((requestType === 'edit' || requestType === 'delete') && !materialId) {
      return res.status(400).json({ success: false, error: 'Material ID is required for edit/delete requests' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO material_requests 
       (request_type, material_id, request_data, user_id) 
       VALUES (?, ?, ?, ?)`,
      [
        requestType, 
        materialId || null, 
        JSON.stringify(requestData || {}), 
        req.session.user.id
      ]
    );
    
    console.log(`Created material request with ID ${result.insertId}`);
    
    const [admins] = await pool.query('SELECT id FROM users WHERE role = "admin"');
    
    for (const admin of admins) {
      await pool.query(
        `INSERT INTO admin_notifications (user_id, message)
         VALUES (?, ?)`,
        [admin.id, `New ${requestType} material request from ${req.session.user.username}`]
      );
    }
    
    res.status(201).json({ 
      success: true, 
      message: 'Material request submitted successfully', 
      requestId: result.insertId 
    });
  } catch (error) {
    console.error('Error creating material request:', error);
    res.status(500).json({ success: false, error: `Failed to create material request: ${error.message}` });
  }
};

exports.getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    const isAdminOrManager = req.session.user.role === 'admin' || req.session.user.role === 'quản lý';
    
    const query = `
      SELECT mr.*, u.username as requested_by_username, u.full_name as requested_by_fullname,
             a.username as admin_username, a.full_name as admin_fullname
      FROM material_requests mr
      LEFT JOIN users u ON mr.user_id = u.id
      LEFT JOIN users a ON mr.admin_id = a.id
      WHERE mr.id = ?
    `;
    
    const permissionCheck = isAdminOrManager ? '' : ' AND mr.user_id = ?';
    
    const [requests] = await pool.query(
      query + permissionCheck,
      isAdminOrManager ? [id] : [id, userId]
    );
    
    if (requests.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }
    
    const request = requests[0];
    if (typeof request.request_data === 'string') {
      try {
        request.request_data = JSON.parse(request.request_data);
      } catch (error) {
        console.error('Error parsing request data:', error);
      }
    }
    
    res.json({ success: true, data: request });
  } catch (error) {
    console.error('Error fetching material request:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch material request' });
  }
};

exports.updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    
    console.log(`Processing material request ${id} with status ${status}`);
     
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const [requests] = await pool.query('SELECT * FROM material_requests WHERE id = ?', [id]);
    
    if (requests.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }
    
    const request = requests[0];
    
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Request already processed' });
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      await connection.query(
        `UPDATE material_requests 
         SET status = ?, response_date = NOW(), admin_id = ?, admin_notes = ? 
         WHERE id = ?`,
        [status, req.session.user.id, adminNotes || null, id]
      );
      
      console.log(`Updated material request ${id} status to ${status}`);
      
      if (status === 'approved') {
        let requestData = {};
        try {
          requestData = safelyParseJSON(request.request_data);
          console.log("Parsed request data:", JSON.stringify(requestData, null, 2));
        } catch (error) {
          console.error('Error parsing request data:', error);
          await connection.rollback();
          return res.status(400).json({ success: false, error: 'Invalid request data format' });
        }
        
        if (request.request_type === 'add') {
          const packetNo = requestData.packetNo || requestData.packet_no;
          const partName = requestData.partName || requestData.part_name;
          const materialCode = requestData.materialCode || requestData.material_code;
          const length = requestData.length;
          const width = requestData.width;
          const materialType = requestData.materialType || requestData.material_type;
          const quantity = requestData.quantity;
          const supplier = requestData.supplier;
          const currentDate = new Date().toLocaleDateString('en-GB');

          if (!packetNo || !partName || !materialCode || !length || !width || !materialType || !quantity || !supplier) {
            console.error('Missing required fields in request data:', requestData);
            await connection.rollback();
            return res.status(400).json({ 
              success: false, 
              error: 'Missing required fields in request data' 
            });
          }

          const [existingMaterials] = await connection.query(
            'SELECT id FROM materials WHERE packet_no = ?',
            [packetNo]
          );
          
          if (existingMaterials.length > 0) {
            await connection.rollback();
            return res.status(400).json({ 
              success: false, 
              error: 'A material with this packet number already exists. The request cannot be approved.' 
            });
          }
          
          try {
            const [userResult] = await connection.query('SELECT username FROM users WHERE id = ?', [request.user_id]);
            const username = userResult[0]?.username || 'system';
            
            const [addResult] = await connection.query(
              `INSERT INTO materials 
               (packet_no, part_name, material_code, length, width, material_type, quantity, supplier, updated_by, last_updated) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [packetNo, partName, materialCode, length, width, materialType, quantity, supplier, username, currentDate]
            );
            
            console.log(`Added new material with ID ${addResult.insertId}`);
          } catch (dbError) {
            console.error('Database error when adding material:', dbError);
            await connection.rollback();
            return res.status(500).json({ 
              success: false, 
              error: 'Database error when adding material' 
            });
          }
        } else if (request.request_type === 'edit') {
          const packetNo = requestData.packetNo || requestData.packet_no;
          const partName = requestData.partName || requestData.part_name;
          const materialCode = requestData.materialCode || requestData.material_code;
          const length = requestData.length;
          const width = requestData.width;
          const materialType = requestData.materialType || requestData.material_type;
          const quantity = requestData.quantity;
          const supplier = requestData.supplier;
          const currentDate = new Date().toLocaleDateString('en-GB');

          if (!packetNo || !partName || !materialCode || !length || !width || !materialType || !quantity || !supplier) {
            console.error('Missing required fields in edit request data:', requestData);
            await connection.rollback();
            return res.status(400).json({ 
              success: false, 
              error: 'Missing required fields in edit request data' 
            });
          }

          const [existingMaterials] = await connection.query(
            'SELECT id FROM materials WHERE packet_no = ? AND id != ?',
            [packetNo, request.material_id]
          );
          
          if (existingMaterials.length > 0) {
            await connection.rollback();
            return res.status(400).json({ 
              success: false, 
              error: 'Another material with this packet number already exists. The request cannot be approved.' 
            });
          }
          
          try {
            const [userResult] = await connection.query('SELECT username FROM users WHERE id = ?', [request.user_id]);
            const username = userResult[0]?.username || 'system';
            
            await connection.query(
              `UPDATE materials 
               SET packet_no = ?, part_name = ?, material_code = ?, length = ?, width = ?, material_type = ?, 
                   quantity = ?, supplier = ?, updated_by = ?, last_updated = ? 
               WHERE id = ?`,
              [packetNo, partName, materialCode, length, width, materialType, quantity, supplier, username, currentDate, request.material_id]
            );
            
            console.log(`Updated material ${request.material_id}`);
          } catch (dbError) {
            console.error('Database error when updating material:', dbError);
            await connection.rollback();
            return res.status(500).json({ 
              success: false, 
              error: 'Database error when updating material' 
            });
          }
        } else if (request.request_type === 'delete') {
          try {
            await connection.query('DELETE FROM materials WHERE id = ?', [request.material_id]);
            console.log(`Deleted material ${request.material_id}`);
          } catch (dbError) {
            console.error('Database error when deleting material:', dbError);
            await connection.rollback();
            return res.status(500).json({ 
              success: false, 
              error: 'Database error when deleting material' 
            });
          }
        }
      }
      
      await connection.commit();
      
      let notificationMessage = '';
      const requestTypeMap = {
        'add': 'thêm',
        'edit': 'sửa',
        'delete': 'xóa'
      };

      const requestTypeInVietnamese = requestTypeMap[request.request_type] || request.request_type;

      let materialInfo = '';
      if (request.material_id) {
        try {
          const [materialResult] = await connection.query(
            'SELECT part_name FROM materials WHERE id = ?',
            [request.material_id]
          );
          
          if (materialResult.length > 0) {
            materialInfo = materialResult[0].part_name;
          }
        } catch (err) {
          console.error('Error fetching material info:', err);
        }
      }

      if (status === 'approved') {
        notificationMessage = `Yêu cầu ${requestTypeInVietnamese} nguyên vật liệu${materialInfo ? ` "${materialInfo}"` : ''} đã được phê duyệt`;
      } else {
        notificationMessage = `Yêu cầu ${requestTypeInVietnamese} nguyên vật liệu${materialInfo ? ` "${materialInfo}"` : ''} đã bị từ chối`;
      }

      if (status === 'rejected' && adminNotes) {
        notificationMessage += `. Lý do: ${adminNotes}`;
      }

      await pool.query(
        `INSERT INTO admin_notifications (user_id, related_request_id, message, notification_type)
        VALUES (?, ?, ?, 'request')`,
        [request.user_id, request.id, notificationMessage]
      );
      
      res.json({ 
        success: true, 
        message: `Request ${status} successfully`,
        requestId: id
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error processing material request:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to process material request: ${error.message}` 
    });
  }
};