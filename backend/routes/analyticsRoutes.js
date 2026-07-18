const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ==========================================
// USER PROGRESS & ANALYTICS DASHBOARD API
// ==========================================
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const [totalDiffRows] = await pool.query(`
            SELECT difficulty, COUNT(*) as total 
            FROM problems 
            GROUP BY difficulty
        `);
        const totalByDiff = { Easy: 0, Medium: 0, Hard: 0, Total: 0 };
        totalDiffRows.forEach(r => {
            if (r.difficulty in totalByDiff) totalByDiff[r.difficulty] = r.total;
            totalByDiff.Total += r.total;
        });

        const [userProgressRows] = await pool.query(`
            SELECT p.difficulty, upp.status, COUNT(*) as count 
            FROM user_problem_progress upp 
            JOIN problems p ON upp.problem_id = p.id 
            WHERE upp.user_id = ? 
            GROUP BY p.difficulty, upp.status
        `, [userId]);

        const solvedByDiff = { Easy: 0, Medium: 0, Hard: 0, Total: 0 };
        const attemptedByDiff = { Easy: 0, Medium: 0, Hard: 0, Total: 0 };

        userProgressRows.forEach(r => {
            if (r.status === 'Accepted') {
                if (r.difficulty in solvedByDiff) solvedByDiff[r.difficulty] += r.count;
                solvedByDiff.Total += r.count;
            } else if (r.status === 'Attempted') {
                if (r.difficulty in attemptedByDiff) attemptedByDiff[r.difficulty] += r.count;
                attemptedByDiff.Total += r.count;
            }
        });

        const [allProblemsProgress] = await pool.query(`
            SELECT p.id, p.category, p.difficulty, p.expected_time_complexity, upp.status, upp.best_time_complexity 
            FROM problems p 
            LEFT JOIN user_problem_progress upp ON p.id = upp.problem_id AND upp.user_id = ?
        `, [userId]);

        const canonicalTopics = [
            { name: 'Arrays & Matrices', keywords: ['array', 'matrix'], icon: 'fa-layer-group' },
            { name: 'Dynamic Programming', keywords: ['dynamic programming', 'dp'], icon: 'fa-cubes' },
            { name: 'Strings', keywords: ['string'], icon: 'fa-font' },
            { name: 'Trees & BST', keywords: ['tree', 'bst'], icon: 'fa-project-diagram' },
            { name: 'Graphs & BFS/DFS', keywords: ['graph', 'breadth-first search', 'depth-first search', 'union find', 'topological sort'], icon: 'fa-network-wired' },
            { name: 'Hash Tables & Sets', keywords: ['hash table', 'hash set'], icon: 'fa-hashtag' },
            { name: 'Two Pointers & Window', keywords: ['two pointers', 'sliding window'], icon: 'fa-hand-pointer' },
            { name: 'Binary Search', keywords: ['binary search'], icon: 'fa-search' },
            { name: 'Greedy Algorithms', keywords: ['greedy'], icon: 'fa-coins' },
            { name: 'Stack & Monotonic Stack', keywords: ['stack'], icon: 'fa-layer-group' },
            { name: 'Queue & Priority Queue', keywords: ['queue', 'heap'], icon: 'fa-list-ol' },
            { name: 'Backtracking & Recursion', keywords: ['backtracking', 'recursion'], icon: 'fa-random' },
            { name: 'Math & Geometry', keywords: ['math', 'geometry', 'combinatorics'], icon: 'fa-square-root-alt' },
            { name: 'Bit Manipulation', keywords: ['bit manipulation'], icon: 'fa-microchip' }
        ];

        const categoryRows = canonicalTopics.map(t => ({
            category: t.name,
            icon: t.icon,
            total_problems: 0,
            solved_problems: 0,
            easy_solved: 0,
            medium_solved: 0,
            hard_solved: 0,
            attempted_problems: 0,
            optimal_complexity_count: 0
        }));

        let totalOptimalSolved = 0;

        allProblemsProgress.forEach(p => {
            const catStr = (p.category || '').toLowerCase();
            canonicalTopics.forEach((t, idx) => {
                if (t.keywords.some(k => catStr.includes(k))) {
                    categoryRows[idx].total_problems++;
                    if (p.status === 'Accepted') {
                        categoryRows[idx].solved_problems++;
                        if (p.difficulty === 'Easy') categoryRows[idx].easy_solved++;
                        else if (p.difficulty === 'Medium') categoryRows[idx].medium_solved++;
                        else if (p.difficulty === 'Hard') categoryRows[idx].hard_solved++;

                        const bestTC = (p.best_time_complexity || '').toLowerCase().replace(/\s+/g, '');
                        const expTC = (p.expected_time_complexity || '').toLowerCase().replace(/\s+/g, '');
                        const isOptimal = !expTC || bestTC === expTC || ['o(1)', 'o(logn)'].includes(bestTC);
                        if (isOptimal) {
                            categoryRows[idx].optimal_complexity_count++;
                            totalOptimalSolved++;
                        }
                    } else if (p.status === 'Attempted') {
                        categoryRows[idx].attempted_problems++;
                    }
                }
            });
        });

        categoryRows.forEach(row => {
            row.complexity_mastery_rate = row.solved_problems > 0
                ? Number(((row.optimal_complexity_count / row.solved_problems) * 100).toFixed(1))
                : 100.0;
        });

        const [errorRows] = await pool.query(`
            SELECT COALESCE(SUM(error_count), 0) as total_errors 
            FROM user_problem_progress 
            WHERE user_id = ?
        `, [userId]);
        const totalErrors = errorRows[0]?.total_errors || 0;

        const [submissionRows] = await pool.query(`
            SELECT language, status, COUNT(*) as count 
            FROM submissions 
            WHERE user_id = ? 
            GROUP BY language, status
        `, [userId]);

        let totalSubmissions = 0;
        let totalAcceptedSubs = 0;
        const languageStats = {};
        const statusStats = {};

        submissionRows.forEach(r => {
            totalSubmissions += r.count;
            if (r.status === 'Accepted') totalAcceptedSubs += r.count;
            
            const lang = r.language || 'unknown';
            languageStats[lang] = (languageStats[lang] || 0) + r.count;
            statusStats[r.status] = (statusStats[r.status] || 0) + r.count;
        });

        const [heatmapRows] = await pool.query(`
            SELECT DATE_FORMAT(submitted_at, '%Y-%m-%d') as date, COUNT(*) as count, SUM(CASE WHEN status = 'Accepted' THEN 1 ELSE 0 END) as solved_count 
            FROM submissions 
            WHERE user_id = ? AND submitted_at >= DATE_SUB(NOW(), INTERVAL 365 DAY) 
            GROUP BY DATE_FORMAT(submitted_at, '%Y-%m-%d') 
            ORDER BY date ASC
        `, [userId]);

        const [pendingRows] = await pool.query(`
            SELECT upp.problem_id, p.title, p.category, p.difficulty, upp.submission_count, upp.error_count, upp.last_submitted_at 
            FROM user_problem_progress upp 
            JOIN problems p ON upp.problem_id = p.id 
            WHERE upp.user_id = ? AND upp.status = 'Attempted' 
            ORDER BY upp.last_submitted_at DESC 
            LIMIT 15
        `, [userId]);

        const [fastestRows] = await pool.query(`
            SELECT s.problem_id, s.problem_title, s.topic, s.difficulty, s.language, s.execution_time_ms, s.submitted_at 
            FROM submissions s 
            WHERE s.user_id = ? AND s.status = 'Accepted' AND s.execution_time_ms IS NOT NULL 
            ORDER BY s.execution_time_ms ASC 
            LIMIT 10
        `, [userId]);

        const dateMap = {};
        let totalActiveDays = 0;
        heatmapRows.forEach(row => {
            const cnt = Number(row.count) || 0;
            const scnt = Number(row.solved_count) || 0;
            dateMap[row.date] = { count: cnt, solved_count: scnt };
            if (cnt > 0) totalActiveDays++;
        });

        const [uppDates] = await pool.query(`
            SELECT DATE_FORMAT(last_submitted_at, '%Y-%m-%d') as date, status 
            FROM user_problem_progress 
            WHERE user_id = ? AND last_submitted_at IS NOT NULL
        `, [userId]);
        uppDates.forEach(row => {
            if (row.date && !dateMap[row.date]) {
                dateMap[row.date] = { count: 1, solved_count: row.status === 'Accepted' ? 1 : 0 };
                totalActiveDays++;
            } else if (row.date && dateMap[row.date] && row.status === 'Accepted' && dateMap[row.date].solved_count === 0) {
                dateMap[row.date].solved_count = 1;
            }
        });

        const activeDateKeys = Object.keys(dateMap).filter(d => dateMap[d].count > 0 || dateMap[d].solved_count > 0).sort();

        let maxStreak = 0;
        let tempStreak = 0;
        let prevDateObj = null;
        activeDateKeys.forEach(dStr => {
            const curr = new Date(dStr + 'T00:00:00');
            if (!prevDateObj) {
                tempStreak = 1;
            } else {
                const diffDays = Math.round((curr - prevDateObj) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    tempStreak++;
                } else if (diffDays > 1) {
                    tempStreak = 1;
                }
            }
            if (tempStreak > maxStreak) maxStreak = tempStreak;
            prevDateObj = curr;
        });

        const nowLocal = new Date();
        const y = nowLocal.getFullYear();
        const m = String(nowLocal.getMonth() + 1).padStart(2, '0');
        const d = String(nowLocal.getDate()).padStart(2, '0');
        const localTodayStr = `${y}-${m}-${d}`;

        const yestLocal = new Date(nowLocal);
        yestLocal.setDate(yestLocal.getDate() - 1);
        const yestStr = `${yestLocal.getFullYear()}-${String(yestLocal.getMonth() + 1).padStart(2, '0')}-${String(yestLocal.getDate()).padStart(2, '0')}`;

        let currentStreak = 0;
        let checkDateObj = null;
        if (dateMap[localTodayStr] && (dateMap[localTodayStr].count > 0 || dateMap[localTodayStr].solved_count > 0)) {
            checkDateObj = new Date(nowLocal);
            checkDateObj.setHours(0,0,0,0);
        } else if (dateMap[yestStr] && (dateMap[yestStr].count > 0 || dateMap[yestStr].solved_count > 0)) {
            checkDateObj = new Date(yestLocal);
            checkDateObj.setHours(0,0,0,0);
        }

        if (checkDateObj) {
            currentStreak = 0;
            while (true) {
                const cy = checkDateObj.getFullYear();
                const cm = String(checkDateObj.getMonth() + 1).padStart(2, '0');
                const cd = String(checkDateObj.getDate()).padStart(2, '0');
                const cStr = `${cy}-${cm}-${cd}`;
                if (dateMap[cStr] && (dateMap[cStr].count > 0 || dateMap[cStr].solved_count > 0)) {
                    currentStreak++;
                    checkDateObj.setDate(checkDateObj.getDate() - 1);
                } else {
                    break;
                }
            }
        }

        const uniqueTouched = solvedByDiff.Total + attemptedByDiff.Total;
        const trueAcceptanceRate = uniqueTouched > 0 ? ((solvedByDiff.Total / uniqueTouched) * 100).toFixed(1) : "0.0";
        const rawSubmissionAccuracy = totalSubmissions > 0 ? ((totalAcceptedSubs / totalSubmissions) * 100).toFixed(1) : "0.0";
        const complexityMasteryRate = solvedByDiff.Total > 0 ? ((totalOptimalSolved / solvedByDiff.Total) * 100).toFixed(1) : "100.0";

        return res.json({
            success: true,
            kpis: {
                totalProblems: totalByDiff,
                solved: solvedByDiff,
                attempted: attemptedByDiff,
                totalSubmissions,
                totalAcceptedSubs,
                acceptanceRate: trueAcceptanceRate,
                rawSubmissionAccuracy,
                complexityMasteryRate,
                totalErrors,
                currentStreak,
                maxStreak,
                activeDays: totalActiveDays
            },
            categories: categoryRows,
            languageStats,
            statusStats,
            heatmap: heatmapRows,
            pendingProblems: pendingRows,
            fastestSubmissions: fastestRows
        });
    } catch (err) {
        console.error("Error fetching user analytics:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
