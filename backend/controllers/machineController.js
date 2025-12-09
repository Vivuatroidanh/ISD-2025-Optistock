const pool = require('../config/database');

exports.getAllMachines = async (req, res) => {
  try {
    const [machines] = await pool.query('SELECT * FROM machines ORDER BY id');
    res.json({
      success: true,
      data: machines
    });
  } catch (error) {
    console.error('Error fetching machines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch machines'
    });
  }
};

exports.saveMachineStop = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, stopTime, stopDate } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason is required'
      });
    }
    
    await pool.query(
      `INSERT INTO machine_stop_logs 
       (machine_id, reason, stop_time, stop_date, user_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, reason, stopTime, stopDate, req.session.user.id]
    );
    
    await pool.query(
      'UPDATE machines SET status = ? WHERE id = ?',
      ['stopping', id]
    );
    
    res.json({
      success: true,
      message: 'Machine stop reason saved successfully'
    });
  } catch (error) {
    console.error('Error saving machine stop reason:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save machine stop reason'
    });
  }
};
