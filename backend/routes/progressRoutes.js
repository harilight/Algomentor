const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ==========================================
// FETCH USER PROGRESS BY USER ID
// ==========================================
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const [rows] = await pool.query('SELECT * FROM user_problem_progress WHERE user_id = ? ORDER BY last_submitted_at DESC', [userId]);
        return res.json({ success: true, progress: rows });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
