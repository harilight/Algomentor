const mysql = require('mysql2');
require('dotenv').config();

// MySQL Database Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'algomaster',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

// Self-healing migration check for extended profile & complexity columns
(async () => {
    try {
        const columnsToAdd = [
            { name: 'gender', query: 'ALTER TABLE users ADD COLUMN gender VARCHAR(50) NULL' },
            { name: 'country', query: 'ALTER TABLE users ADD COLUMN country VARCHAR(100) NULL' },
            { name: 'age', query: 'ALTER TABLE users ADD COLUMN age INT NULL' },
            { name: 'headline', query: 'ALTER TABLE users ADD COLUMN headline VARCHAR(255) NULL' },
            { name: 'career_goal', query: 'ALTER TABLE users ADD COLUMN career_goal VARCHAR(100) NULL' },
            { name: 'linkedin_url', query: 'ALTER TABLE users ADD COLUMN linkedin_url VARCHAR(255) NULL' },
            { name: 'preferred_languages', query: 'ALTER TABLE users ADD COLUMN preferred_languages VARCHAR(255) NULL' },
            { name: 'expected_time_complexity_pd', query: 'ALTER TABLE problem_details ADD COLUMN expected_time_complexity VARCHAR(32) NULL' },
            { name: 'expected_space_complexity_pd', query: 'ALTER TABLE problem_details ADD COLUMN expected_space_complexity VARCHAR(32) NULL' },
            { name: 'expected_time_complexity_p', query: 'ALTER TABLE problems ADD COLUMN expected_time_complexity VARCHAR(32) NULL' },
            { name: 'expected_space_complexity_p', query: 'ALTER TABLE problems ADD COLUMN expected_space_complexity VARCHAR(32) NULL' },
            { name: 'time_complexity_s', query: 'ALTER TABLE submissions ADD COLUMN time_complexity VARCHAR(32) NULL' },
            { name: 'space_complexity_s', query: 'ALTER TABLE submissions ADD COLUMN space_complexity VARCHAR(32) NULL' },
            { name: 'complexity_feedback_s', query: 'ALTER TABLE submissions ADD COLUMN complexity_feedback TEXT NULL' },
            { name: 'best_time_complexity_u', query: 'ALTER TABLE user_problem_progress ADD COLUMN best_time_complexity VARCHAR(32) NULL' },
            { name: 'best_space_complexity_u', query: 'ALTER TABLE user_problem_progress ADD COLUMN best_space_complexity VARCHAR(32) NULL' }
        ];
        for (const col of columnsToAdd) {
            try { await pool.query(col.query); } catch (e) {}
        }
    } catch (err) {
        console.error("Self-healing schema check error:", err.message);
    }
})();

module.exports = pool;
