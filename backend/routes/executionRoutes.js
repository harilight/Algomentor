const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { executePipeline } = require('../codeEngine');

// ==========================================================
// UNIVERSAL MULTI-LANGUAGE CODE RUNNER ENDPOINT (MODULAR)
// ==========================================================
router.post('/run', async (req, res) => {
    const { problemId, language, code, methodName, testCases, meta_data, mode } = req.body;

    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
        return res.json({ success: false, error: "No sample test cases provided for evaluation." });
    }

    let targetLanguage = String(language || '').toLowerCase().trim();
    if (code && (!targetLanguage || targetLanguage === 'undefined' || targetLanguage === 'null' || targetLanguage === '')) {
        if (/^\s*class\s+Solution\s*:/m.test(code) || /^\s*def\s+[a-zA-Z0-9_]+\s*\(/m.test(code) || /\bdef\s+[a-zA-Z0-9_]+\s*\(self\b/.test(code)) {
            targetLanguage = 'python';
        } else if (/^\s*#include\s+</m.test(code) || /\bvector</.test(code) || /\bstring\b/.test(code) && /\bclass\s+Solution\s*\{/m.test(code)) {
            targetLanguage = 'cpp';
        } else if (/\bpublic\s+class\s+Solution\b/.test(code) || /\bboolean\b/.test(code) && /\bclass\s+Solution\s*\{/m.test(code)) {
            targetLanguage = 'java';
        } else if (/^\s*function\s+[a-zA-Z0-9_]+\s*\(/m.test(code) || /^\s*var\s+|^\s*let\s+|^\s*const\s+/m.test(code)) {
            targetLanguage = 'javascript';
        }
    }

    try {
        const pipelineResult = await executePipeline({
            problemId,
            language: targetLanguage,
            code,
            methodName,
            testCases,
            metadata: meta_data,
            mode: mode || 'run'
        });
        return res.json(pipelineResult);
    } catch (err) {
        return res.json({ success: false, error: "Server Execution Error: " + err.message });
    }
});

// ==========================================================
// CODE SUBMIT ENDPOINT WITH FULL TELEMETRY & PROGRESS TRACKING
// ==========================================================
router.post('/submit', async (req, res) => {
    const { problemId, language, code, methodName, testCases, meta_data, userId, user_id } = req.body;
    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
        return res.json({ success: false, error: "No test cases provided for evaluation." });
    }
    let targetLanguage = String(language || '').toLowerCase().trim();
    const activeUserId = userId || user_id || null;

    try {
        const pipelineResult = await executePipeline({
            problemId,
            language: targetLanguage,
            code,
            methodName,
            testCases,
            metadata: meta_data,
            mode: 'submit'
        });

        // 1. Fetch problem metadata from DB for logging context
        let problemTitle = methodName || `Problem #${problemId}`;
        let topic = 'General';
        let difficulty = 'Medium';
        try {
            const [probRows] = await pool.query('SELECT title, category, difficulty FROM problems WHERE id = ?', [problemId]);
            if (probRows.length > 0) {
                if (probRows[0].title) problemTitle = probRows[0].title;
                if (probRows[0].category) topic = probRows[0].category;
                if (probRows[0].difficulty) difficulty = probRows[0].difficulty;
            }
        } catch (dbErr) {
            console.error("Error fetching problem metadata for submission log:", dbErr);
        }

        // 2. Extract execution telemetry & complexity analysis
        const verdict = pipelineResult.verdict || (pipelineResult.allPassed ? 'Accepted' : 'Wrong Answer');
        const durationMs = pipelineResult.runtimeMetrics?.durationMs || null;
        const memoryBytes = pipelineResult.runtimeMetrics?.memoryBytes || null;
        const passedCases = pipelineResult.passedCases !== undefined ? pipelineResult.passedCases : (pipelineResult.caseResults?.filter(c => c.passed).length || 0);
        const totalCases = pipelineResult.totalCases !== undefined ? pipelineResult.totalCases : (pipelineResult.caseResults?.length || 0);
        const errorMessage = verdict === 'Accepted' ? null : (pipelineResult.error || pipelineResult.output || null);
        
        const timeComplexity = pipelineResult.complexityAnalysis?.timeComplexity || null;
        const spaceComplexity = pipelineResult.complexityAnalysis?.spaceComplexity || null;
        const complexityFeedback = pipelineResult.complexityAnalysis?.feedback || null;

        // 3. Insert detailed submission log into `submissions` table
        try {
            await pool.query(
                `INSERT INTO submissions 
                (user_id, problem_id, problem_title, topic, difficulty, status, language, code, execution_time_ms, memory_bytes, passed_cases, total_cases, error_message, time_complexity, space_complexity, complexity_feedback) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [activeUserId, problemId, problemTitle, topic, difficulty, verdict, targetLanguage, code, durationMs, memoryBytes, passedCases, totalCases, errorMessage, timeComplexity, spaceComplexity, complexityFeedback]
            );
        } catch (logErr) {
            console.error("Error inserting into submissions table:", logErr);
        }

        // 4. If logged-in user, update aggregate `user_problem_progress` table
        if (activeUserId) {
            try {
                const isAccepted = verdict === 'Accepted';
                const errorInc = isAccepted ? 0 : 1;
                await pool.query(
                    `INSERT INTO user_problem_progress 
                    (user_id, problem_id, problem_title, topic, difficulty, status, error_count, submission_count, best_execution_time_ms, best_time_complexity, best_space_complexity, last_code, last_language, first_solved_at, last_submitted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON DUPLICATE KEY UPDATE
                        problem_title = VALUES(problem_title),
                        topic = VALUES(topic),
                        difficulty = VALUES(difficulty),
                        status = CASE WHEN user_problem_progress.status = 'Accepted' THEN 'Accepted' ELSE VALUES(status) END,
                        error_count = user_problem_progress.error_count + ?,
                        submission_count = user_problem_progress.submission_count + 1,
                        best_execution_time_ms = CASE 
                            WHEN ? = 1 AND (user_problem_progress.best_execution_time_ms IS NULL OR ? < user_problem_progress.best_execution_time_ms) THEN ? 
                            ELSE user_problem_progress.best_execution_time_ms END,
                        best_time_complexity = CASE 
                            WHEN ? = 1 THEN COALESCE(?, user_problem_progress.best_time_complexity) 
                            ELSE user_problem_progress.best_time_complexity END,
                        best_space_complexity = CASE 
                            WHEN ? = 1 THEN COALESCE(?, user_problem_progress.best_space_complexity) 
                            ELSE user_problem_progress.best_space_complexity END,
                        last_code = VALUES(last_code),
                        last_language = VALUES(last_language),
                        first_solved_at = CASE WHEN user_problem_progress.first_solved_at IS NULL AND ? = 1 THEN CURRENT_TIMESTAMP ELSE user_problem_progress.first_solved_at END,
                        last_submitted_at = CURRENT_TIMESTAMP`,
                    [
                        activeUserId, problemId, problemTitle, topic, difficulty, isAccepted ? 'Accepted' : 'Attempted', errorInc, isAccepted ? durationMs : null, isAccepted ? timeComplexity : null, isAccepted ? spaceComplexity : null, code, targetLanguage, isAccepted ? new Date() : null,
                        errorInc,
                        isAccepted ? 1 : 0, durationMs, durationMs,
                        isAccepted ? 1 : 0, timeComplexity,
                        isAccepted ? 1 : 0, spaceComplexity,
                        isAccepted ? 1 : 0
                    ]
                );
            } catch (progErr) {
                console.error("Error updating user_problem_progress:", progErr);
            }
        }

        return res.json(pipelineResult);
    } catch (err) {
        return res.json({ success: false, error: "Server Execution Error: " + err.message });
    }
});

module.exports = router;
