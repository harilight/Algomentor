/**
 * SkillTracker.js
 * --------------------------------------------------------------------------
 * Advanced Deterministic Skill & Competency Tracker with Time-Based Decay
 * (Ebbinghaus Forgetting Curve) and Micro-Pattern Competency Clamping.
 *
 * Formula: R(t) = e^(-lambda * delta_t)
 * where delta_t is days elapsed since last successful solve or revision.
 */

const { CANONICAL_TOPICS, MICRO_PATTERNS, resolveTopic, resolveMicroPattern } = require('./PrerequisiteDAG');

/**
 * Computes canonical topic mastery, micro-pattern competency, decay metrics, and spaced revision targets.
 * @param {Array} allProblems - Array of all problems (`id, title, category, difficulty`)
 * @param {Array} progressRows - Array of `user_problem_progress` rows
 * @param {Array} submissionRows - Array of `submissions` records
 */
function analyzeUserSkills(allProblems = [], progressRows = [], submissionRows = []) {
    // 1. Initialize Canonical Topic Stats
    const topicStats = {};
    CANONICAL_TOPICS.forEach(topic => {
        topicStats[topic.id] = {
            id: topic.id,
            name: topic.name,
            icon: topic.icon,
            totalProblems: 0,
            easyTotal: 0, mediumTotal: 0, hardTotal: 0,
            solvedCount: 0,
            optimalComplexityCount: 0,
            easySolved: 0, mediumSolved: 0, hardSolved: 0,
            attemptedUnsolvedCount: 0,
            totalErrors: 0,
            totalSubmissions: 0,
            masteryScore: 0.0,
            accuracyRate: 0.0,
            complexityMasteryRate: 100.0,
            errorIntensity: 0.0
        };
    });

    // 2. Initialize Micro-Pattern Stats
    const patternStats = {};
    MICRO_PATTERNS.forEach(pat => {
        patternStats[pat.id] = {
            id: pat.id,
            name: pat.name,
            parentCategory: pat.parentCategory,
            difficultyWeight: pat.difficultyWeight,
            totalProblems: 0,
            easyTotal: 0, mediumTotal: 0, hardTotal: 0,
            solvedCount: 0,
            optimalComplexityCount: 0,
            easySolved: 0, mediumSolved: 0, hardSolved: 0,
            attemptedUnsolvedCount: 0,
            totalErrors: 0,
            totalSubmissions: 0,
            lastSolvedTimestamp: 0,
            rawMasteryScore: 0.0,
            decayAdjustedMastery: 0.0,
            retentionFactor: 1.0,
            complexityMasteryRate: 100.0,
            errorIntensity: 0.0
        };
    });

    const progressMap = new Map();
    progressRows.forEach(row => {
        progressMap.set(Number(row.problem_id), row);
    });

    // Build latest timestamp map from submissions and progress rows for recency tracking
    const problemLastSolvedTime = new Map();
    progressRows.forEach(row => {
        if (row.status === 'Accepted') {
            const timeVal = row.updated_at ? new Date(row.updated_at).getTime() : (row.created_at ? new Date(row.created_at).getTime() : Date.now());
            if (!isNaN(timeVal)) {
                problemLastSolvedTime.set(Number(row.problem_id), timeVal);
            }
        }
    });
    submissionRows.forEach(sub => {
        if (sub.status === 'Accepted' || sub.verdict === 'Accepted') {
            const timeVal = sub.created_at ? new Date(sub.created_at).getTime() : Date.now();
            if (!isNaN(timeVal)) {
                const existing = problemLastSolvedTime.get(Number(sub.problem_id)) || 0;
                if (timeVal > existing) {
                    problemLastSolvedTime.set(Number(sub.problem_id), timeVal);
                }
            }
        }
    });

    const now = Date.now();
    const solvedProblemsWithDecay = [];

    // 3. Tally problems and user solves per canonical topic & micro-pattern
    allProblems.forEach(prob => {
        const canonical = resolveTopic(prob.category);
        const pattern = resolveMicroPattern(prob);

        const tStats = topicStats[canonical.id];
        const pStats = patternStats[pattern.id];

        const diff = (prob.difficulty || 'Medium').toLowerCase();

        if (tStats) {
            tStats.totalProblems++;
            if (diff === 'easy') tStats.easyTotal++;
            else if (diff === 'hard') tStats.hardTotal++;
            else tStats.mediumTotal++;
        }
        if (pStats) {
            pStats.totalProblems++;
            if (diff === 'easy') pStats.easyTotal++;
            else if (diff === 'hard') pStats.hardTotal++;
            else pStats.mediumTotal++;
        }

        const prog = progressMap.get(Number(prob.id));
        if (prog) {
            const errs = Number(prog.error_count) || 0;
            const subs = Number(prog.submission_count) || 0;

            if (tStats) {
                tStats.totalErrors += errs;
                tStats.totalSubmissions += subs;
            }
            if (pStats) {
                pStats.totalErrors += errs;
                pStats.totalSubmissions += subs;
            }

            if (prog.status === 'Accepted') {
                if (tStats) {
                    tStats.solvedCount++;
                    const bestTC = (prog.best_time_complexity || '').toLowerCase().replace(/\s+/g, '');
                    const expTC = (prob.expected_time_complexity || '').toLowerCase().replace(/\s+/g, '');
                    if (!bestTC || !expTC || bestTC === expTC || ['o(1)', 'o(logn)'].includes(bestTC)) {
                        tStats.optimalComplexityCount++;
                    }
                    if (diff === 'easy') tStats.easySolved++;
                    else if (diff === 'hard') tStats.hardSolved++;
                    else tStats.mediumSolved++;
                }
                if (pStats) {
                    pStats.solvedCount++;
                    const bestTC = (prog.best_time_complexity || '').toLowerCase().replace(/\s+/g, '');
                    const expTC = (prob.expected_time_complexity || '').toLowerCase().replace(/\s+/g, '');
                    if (!bestTC || !expTC || bestTC === expTC || ['o(1)', 'o(logn)'].includes(bestTC)) {
                        pStats.optimalComplexityCount++;
                    }
                    if (diff === 'easy') pStats.easySolved++;
                    else if (diff === 'hard') pStats.hardSolved++;
                    else pStats.mediumSolved++;

                    const solvedTime = problemLastSolvedTime.get(Number(prob.id)) || (now - (14 * 24 * 60 * 60 * 1000)); // default 14 days if missing
                    if (solvedTime > pStats.lastSolvedTimestamp) {
                        pStats.lastSolvedTimestamp = solvedTime;
                    }

                    // Compute Spaced Repetition Retention for this exact problem
                    const daysSinceSolve = Math.max(0, (now - solvedTime) / (1000 * 60 * 60 * 24));
                    // Ebbinghaus formula: R(t) = e^(-0.035 * t)
                    const retention = Math.exp(-0.035 * daysSinceSolve);

                    solvedProblemsWithDecay.push({
                        problem: prob,
                        patternId: pattern.id,
                        patternName: pattern.name,
                        daysSinceSolve: Math.round(daysSinceSolve),
                        retentionFactor: Number(retention.toFixed(3)),
                        needsRevision: daysSinceSolve >= 20 && retention < 0.65
                    });
                }
            } else if (prog.status === 'Attempted') {
                if (tStats) tStats.attemptedUnsolvedCount++;
                if (pStats) pStats.attemptedUnsolvedCount++;
            }
        }
    });

    // 4. Compute Mastery Scores & Decay Adjustments
    const masteryMap = {};
    const patternMasteryMap = {};

    CANONICAL_TOPICS.forEach(topic => {
        const stats = topicStats[topic.id];
        const earned = (stats.easySolved * 1) + (stats.mediumSolved * 2) + (stats.hardSolved * 3);
        const max = (stats.easyTotal * 1) + (stats.mediumTotal * 2) + (stats.hardTotal * 3);
        stats.masteryScore = max > 0 ? Number(((earned / max) * 100).toFixed(1)) : 0.0;
        stats.accuracyRate = stats.totalSubmissions > 0 ? Number(((stats.solvedCount / stats.totalSubmissions) * 100).toFixed(1)) : 0.0;
        stats.complexityMasteryRate = stats.solvedCount > 0 ? Number(((stats.optimalComplexityCount / stats.solvedCount) * 100).toFixed(1)) : 100.0;
        const touched = stats.solvedCount + stats.attemptedUnsolvedCount;
        stats.errorIntensity = touched > 0 ? Number((stats.totalErrors / touched).toFixed(2)) : 0.0;
        masteryMap[topic.id] = stats.masteryScore;
    });

    MICRO_PATTERNS.forEach(pat => {
        const stats = patternStats[pat.id];
        const earned = (stats.easySolved * 1) + (stats.mediumSolved * 2) + (stats.hardSolved * 3);
        const max = (stats.easyTotal * 1) + (stats.mediumTotal * 2) + (stats.hardTotal * 3);
        stats.rawMasteryScore = max > 0 ? Number(((earned / max) * 100).toFixed(1)) : 0.0;

        // Compute retention decay factor for the pattern
        if (stats.solvedCount > 0 && stats.lastSolvedTimestamp > 0) {
            const daysElapsed = Math.max(0, (now - stats.lastSolvedTimestamp) / (1000 * 60 * 60 * 24));
            stats.retentionFactor = Number(Math.exp(-0.025 * daysElapsed).toFixed(3));
        } else {
            stats.retentionFactor = 1.0;
        }

        stats.decayAdjustedMastery = Number((stats.rawMasteryScore * stats.retentionFactor).toFixed(1));
        stats.complexityMasteryRate = stats.solvedCount > 0 ? Number(((stats.optimalComplexityCount / stats.solvedCount) * 100).toFixed(1)) : 100.0;
        const touched = stats.solvedCount + stats.attemptedUnsolvedCount;
        stats.errorIntensity = touched > 0 ? Number((stats.totalErrors / touched).toFixed(2)) : 0.0;

        patternMasteryMap[pat.id] = stats.decayAdjustedMastery;
    });

    // Sort solved problems needing revision by lowest retention factor
    const revisionCandidates = solvedProblemsWithDecay
        .filter(item => item.needsRevision)
        .sort((a, b) => a.retentionFactor - b.retentionFactor);

    // Compute true average accuracy across only touched topics (`totalSubmissions > 0`) to avoid dilution
    const activeTopics = Object.values(topicStats).filter(t => t.totalSubmissions > 0);
    const trueAverageAccuracy = activeTopics.length > 0
        ? Number((activeTopics.reduce((acc, t) => acc + t.accuracyRate, 0) / activeTopics.length).toFixed(1))
        : 0.0;

    return {
        topicStats,
        masteryMap,
        patternStats,
        patternMasteryMap,
        revisionCandidates,
        averageAccuracy: trueAverageAccuracy
    };
}

/**
 * Adaptive Difficulty Progression & Clamping (`Point #1`)
 * Returns the recommended target difficulty based on micro-pattern mastery.
 */
function getRecommendedDifficultyRange(patternStatsObj = {}) {
    const rawScore = patternStatsObj.rawMasteryScore || 0;
    const easyDone = patternStatsObj.easySolved || 0;
    const easyTotal = patternStatsObj.easyTotal || 1;

    if (rawScore < 35 && easyDone < easyTotal) {
        return { preferred: 'Easy', acceptable: ['easy', 'medium'], reason: 'Building core pattern foundations' };
    }
    if (rawScore < 75) {
        return { preferred: 'Medium', acceptable: ['medium', 'hard'], reason: 'Mastered basics; ready for standard interview challenges' };
    }
    return { preferred: 'Hard', acceptable: ['hard', 'medium'], reason: 'High competency detected; targeting placement stretch goals' };
}

module.exports = {
    analyzeUserSkills,
    getRecommendedDifficultyRange
};
