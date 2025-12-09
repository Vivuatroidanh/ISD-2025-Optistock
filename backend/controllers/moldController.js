const pool = require('../config/database');

exports.getAllMolds = async (req, res) => {
  try {
    const [molds] = await pool.query('SELECT * FROM molds ORDER BY id');
    res.json({
      success: true,
      data: molds
    });
  } catch (error) {
    console.error('Error fetching molds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch molds'
    });
  }
};