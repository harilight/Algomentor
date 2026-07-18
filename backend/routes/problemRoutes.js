const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ==========================================
// FETCH ALL PROBLEMS ROUTE
// ==========================================
router.get('/', async (req, res) => {
    try {
        const queryStr = `
            SELECT p.id, p.title, p.category, p.difficulty, p.leetcode_id, pd.description,
                   COALESCE(pd.expected_time_complexity, p.expected_time_complexity) as expected_time_complexity,
                   COALESCE(pd.expected_space_complexity, p.expected_space_complexity) as expected_space_complexity
            FROM problems p
            LEFT JOIN problem_details pd ON p.id = pd.problem_id
        `;
        const [results] = await pool.query(queryStr);
        return res.status(200).json(results);
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to pull problem tracking logs" });
    }
});

// ==========================================
// LIGHTWEIGHT SUMMARY ENDPOINT (<150KB instead of 3.4MB)
// ==========================================
router.get('/summary', async (req, res) => {
    try {
        const [results] = await pool.query('SELECT p.id, p.title, p.category, p.difficulty, p.leetcode_id, COALESCE(pd.expected_time_complexity, p.expected_time_complexity) as expected_time_complexity, COALESCE(pd.expected_space_complexity, p.expected_space_complexity) as expected_space_complexity FROM problems p LEFT JOIN problem_details pd ON p.id = pd.problem_id ORDER BY p.id ASC');
        return res.status(200).json(results);
    } catch (error) {
        console.error("Database error fetching problem summaries:", error);
        return res.status(500).json({ success: false, message: "Failed to pull problem summaries" });
    }
});

// ==========================================
// FETCH SINGLE PROBLEM DETAIL BY ID OR LEETCODE ID
// ==========================================
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const queryStr = `
            SELECT p.id, p.title, p.category, p.difficulty, p.leetcode_id, p.starter_code,
                   pd.description, pd.test_cases, pd.meta_data,
                   COALESCE(pd.expected_time_complexity, p.expected_time_complexity) as expected_time_complexity,
                   COALESCE(pd.expected_space_complexity, p.expected_space_complexity) as expected_space_complexity
            FROM problems p
            LEFT JOIN problem_details pd ON p.id = pd.problem_id
            WHERE p.id = ? OR p.leetcode_id = ?
            ORDER BY (p.id = ?) DESC, (p.leetcode_id = ?) DESC
            LIMIT 1
        `;
        const [results] = await pool.query(queryStr, [id, id, id, id]);

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: "Problem not found in database records" });
        }

        return res.status(200).json(results[0]);
    } catch (error) {
        console.error("Database error fetching problem workspace parameters:", error);
        return res.status(500).json({ success: false, message: "Internal server database failure" });
    }
});

module.exports = router;
