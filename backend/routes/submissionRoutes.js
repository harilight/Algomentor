const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ==========================================
// SUBMISSIONS BY PROBLEM ID ROUTE
// ==========================================
router.get('/problem/:problemId', async (req, res) => {
    try {
        const { problemId } = req.params;
        const { userId } = req.query;
        let queryStr = 'SELECT id, user_id, problem_id, problem_title, status, language, execution_time_ms, memory_bytes, passed_cases, total_cases, submitted_at, code, time_complexity, space_complexity, complexity_feedback FROM submissions WHERE problem_id = ?';
        const queryParams = [problemId];

        if (userId && userId !== 'null' && userId !== 'undefined') {
            queryStr += ' AND user_id = ?';
            queryParams.push(userId);
        }

        queryStr += ' ORDER BY submitted_at DESC LIMIT 20';
        const [rows] = await pool.query(queryStr, queryParams);
        return res.json({ success: true, submissions: rows });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// SUBMISSIONS BY USER ID ROUTE
// ==========================================
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const [rows] = await pool.query('SELECT * FROM submissions WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 100', [userId]);
        return res.json({ success: true, submissions: rows });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
