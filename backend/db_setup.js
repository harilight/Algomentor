const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_NAME || 'algomentor'
}).promise();

async function setupDatabase() {
    try {
        console.log("Checking and updating database schema...");

        // Add gender, country, and age columns to users table
        const columnsToAdd = [
            { name: 'gender', query: 'ALTER TABLE users ADD COLUMN gender VARCHAR(50) NULL' },
            { name: 'country', query: 'ALTER TABLE users ADD COLUMN country VARCHAR(100) NULL' },
            { name: 'age', query: 'ALTER TABLE users ADD COLUMN age INT NULL' },
            { name: 'headline', query: 'ALTER TABLE users ADD COLUMN headline VARCHAR(255) NULL' },
            { name: 'career_goal', query: 'ALTER TABLE users ADD COLUMN career_goal VARCHAR(100) NULL' },
            { name: 'linkedin_url', query: 'ALTER TABLE users ADD COLUMN linkedin_url VARCHAR(255) NULL' },
            { name: 'preferred_languages', query: 'ALTER TABLE users ADD COLUMN preferred_languages VARCHAR(255) NULL' },
            { name: 'meta_data', query: 'ALTER TABLE problem_details ADD COLUMN meta_data JSON NULL' },
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
            try {
                await pool.query(col.query);
                console.log(`Successfully added column: ${col.name}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column')) {
                    console.log(`Column '${col.name}' already exists.`);
                } else {
                    console.error(`Error adding column '${col.name}':`, err.message);
                }
            }
        }

        // Create user_topics table for multiple topics of interest (like LeetCode bubbles)
        const createUserTopicsQuery = `
            CREATE TABLE IF NOT EXISTS user_topics (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                topic_name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_topic (user_id, topic_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        await pool.query(createUserTopicsQuery);
        console.log("Successfully created/verified 'user_topics' table.");

        const [usersSchema] = await pool.query("DESCRIBE users");
        console.log("\nUsers Table Schema:");
        console.table(usersSchema);

        const [topicsSchema] = await pool.query("DESCRIBE user_topics");
        console.log("\nUser Topics Table Schema:");
        console.table(topicsSchema);

        process.exit(0);
    } catch (error) {
        console.error("Database setup failed:", error);
        process.exit(1);
    }
}

setupDatabase();
