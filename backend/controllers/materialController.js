const pool = require('../config/database');

exports.getAllMaterials = async (req, res) => {
  try {
    const [materials] = await pool.query('SELECT id,packet_no,part_name,material_code,length,width,material_type,quantity,supplier,updated_by,last_updated FROM materials ORDER BY id DESC');
    res.json({ success: true, data: materials });
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch materials' });
  }
};

exports.getMaterialById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.query('SELECT * FROM materials WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching material:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch material' });
  }
};

exports.createMaterial = async (req, res) => {
  try {
    const { packetNo, partName, materialCode, length, width, materialType, quantity, supplier } = req.body;
    const currentDate = new Date().toLocaleDateString('en-GB');
    
    const [existingMaterials] = await pool.query(
      'SELECT id FROM materials WHERE packet_no = ?',
      [packetNo]
    );
    
    if (existingMaterials.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'A material with this packet number already exists. Packet numbers must be unique.' 
      });
    }
    
    const [result] = await pool.query(
      `INSERT INTO materials 
       (packet_no, part_name, material_code, length, width, material_type, quantity, supplier, updated_by, last_updated) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [packetNo, partName, materialCode, length, width, materialType, quantity, supplier, req.session.user.username, currentDate]
    );
    res.json({ 
      success: true, 
      message: 'Material added successfully', 
      id: result.insertId 
    });
  } catch (error) {
    console.error('Error adding material:', error);
    res.status(500).json({ success: false, error: 'Failed to add material' });
  }
};

exports.deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM materials WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Error deleting material:', error);
    res.status(500).json({ success: false, error: 'Failed to delete material' });
  }
};

exports.deleteMaterials = async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid material IDs' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    await pool.query(`DELETE FROM materials WHERE id IN (${placeholders})`, ids);
    
    res.json({ success: true, message: 'Materials deleted successfully' });
  } catch (error) {
    console.error('Error deleting materials:', error);
    res.status(500).json({ success: false, error: 'Failed to delete materials' });
  }
};