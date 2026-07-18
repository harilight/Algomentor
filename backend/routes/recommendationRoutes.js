const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { generateRecommendations } = require('../recommendationEngine');

// ==========================================
// AI RECOMMENDATION ENGINE API (3-PILLAR DETERMINISTIC)
// ==========================================
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const [problems] = await pool.query('SELECT id, title, category, difficulty FROM problems ORDER BY id ASC');
        const [progressRows] = await pool.query('SELECT * FROM user_problem_progress WHERE user_id = ?', [userId]);
        const [submissionRows] = await pool.query('SELECT * FROM submissions WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 50', [userId]);
        const [userTopics] = await pool.query('SELECT topic_name FROM user_topics WHERE user_id = ?', [userId]);
        const topicsList = userTopics.map(t => t.topic_name);

        const recOutput = generateRecommendations(problems, progressRows, submissionRows, topicsList);

        return res.status(200).json(recOutput);
    } catch (err) {
        console.error("Error generating recommendations:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// RECOMMENDATION FEEDBACK LOOP API
// ==========================================
router.post('/feedback', async (req, res) => {
    try {
        const { userId, problemId, rating, reasonType = null, confidenceScore = null } = req.body;
        if (!userId || !problemId || !rating) {
            return res.status(400).json({ success: false, message: "userId, problemId, and rating ('USEFUL' | 'TOO_HARD' | 'KNOWN') are required" });
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS recommendation_feedback (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                problem_id INT NOT NULL,
                rating VARCHAR(32) NOT NULL,
                reason_type VARCHAR(64) NULL,
                confidence_score DECIMAL(5, 2) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(
            `INSERT INTO recommendation_feedback (user_id, problem_id, rating, reason_type, confidence_score) VALUES (?, ?, ?, ?, ?)`,
            [userId, problemId, rating, reasonType, confidenceScore]
        );

        return res.status(200).json({ success: true, message: "Feedback logged successfully to telemetry engine!" });
    } catch (err) {
        console.error("Error logging recommendation feedback:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
