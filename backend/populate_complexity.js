const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_NAME || 'algomentor'
}).promise();

/**
 * Derives canonical expected Time & Space Complexity based on problem category, title, and difficulty.
 */
function inferExpectedComplexity(title = '', category = '', difficulty = '') {
    const tLower = String(title).toLowerCase();
    const cLower = String(category).toLowerCase();

    // 1. Specific title overrides
    if (tLower.includes('two sum') || tLower.includes('contains duplicate') || tLower.includes('valid anagram')) {
        return { time: 'O(n)', space: 'O(n)' };
    }
    if (tLower.includes('3sum') || tLower.includes('three sum')) {
        return { time: 'O(n^2)', space: 'O(1)' };
    }
    if (tLower.includes('binary search') || tLower.includes('search insert') || tLower.includes('first bad version')) {
        return { time: 'O(log n)', space: 'O(1)' };
    }
    if (tLower.includes('fibonacci') || tLower.includes('climbing stairs')) {
        return { time: 'O(n)', space: 'O(1)' };
    }
    if (tLower.includes('merge sort') || tLower.includes('quick sort') || tLower.includes('kth largest')) {
        return { time: 'O(n log n)', space: 'O(log n)' };
    }

    // 2. Category / Topic defaults
    if (cLower.includes('binary search')) {
        return { time: 'O(log n)', space: 'O(1)' };
    }
    if (cLower.includes('two pointers') || cLower.includes('sliding window')) {
        return { time: 'O(n)', space: 'O(1)' };
    }
    if (cLower.includes('hash table') || cLower.includes('hash set')) {
        return { time: 'O(n)', space: 'O(n)' };
    }
    if (cLower.includes('trees') || cLower.includes('bst') || cLower.includes('tree')) {
        return { time: 'O(n)', space: 'O(h)' }; // h is height of tree
    }
    if (cLower.includes('graphs') || cLower.includes('bfs') || cLower.includes('dfs')) {
        return { time: 'O(V + E)', space: 'O(V + E)' };
    }
    if (cLower.includes('dynamic programming') || cLower.includes('dp')) {
        if (difficulty === 'Easy') return { time: 'O(n)', space: 'O(n)' };
        return { time: 'O(n * m)', space: 'O(n * m)' };
    }
    if (cLower.includes('sorting') || cLower.includes('heap') || cLower.includes('priority queue')) {
        return { time: 'O(n log n)', space: 'O(n)' };
    }
    if (cLower.includes('matrix')) {
        return { time: 'O(r * c)', space: 'O(1)' };
    }
    if (cLower.includes('backtracking') || cLower.includes('recursion')) {
        return { time: 'O(2^n)', space: 'O(n)' };
    }

    // 3. General defaults by difficulty
    if (difficulty === 'Easy') return { time: 'O(n)', space: 'O(1)' };
    if (difficulty === 'Hard') return { time: 'O(n log n)', space: 'O(n)' };
    return { time: 'O(n)', space: 'O(n)' };
}

async function populateComplexity() {
    try {
        console.log("=== Running Big-O Complexity Database Migration & Population ===");

        // Ensure columns exist first
        const columnsToAdd = [
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

        const [rows] = await pool.query('SELECT id, title, category, difficulty FROM problems');
        console.log(`Found ${rows.length} problems to inspect and populate...`);

        let count = 0;
        for (const prob of rows) {
            const comp = inferExpectedComplexity(prob.title, prob.category, prob.difficulty);
            
            // Update problems table
            await pool.query(
                'UPDATE problems SET expected_time_complexity = ?, expected_space_complexity = ? WHERE id = ?',
                [comp.time, comp.space, prob.id]
            );

            // Update problem_details table if exists
            await pool.query(
                'UPDATE problem_details SET expected_time_complexity = ?, expected_space_complexity = ? WHERE problem_id = ?',
                [comp.time, comp.space, prob.id]
            );

            count++;
        }

        console.log(`✔ Successfully populated canonical expected Time & Space complexities for ${count} problems!`);
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

populateComplexity();
