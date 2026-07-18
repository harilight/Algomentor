/**
 * WeaknessAnalyzer.js
 * --------------------------------------------------------------------------
 * Deterministic Weakness & Stagnation Diagnostic Engine.
 * Identifies high error zones, abandoned attempts, and conceptual friction
 * without guesswork.
 */

const { resolveTopic } = require('./PrerequisiteDAG');

/**
 * Identifies user weakness zones and finds optimal target problems to remediate.
 * @param {Object} topicStats - Output from SkillTracker.analyzeUserSkills().topicStats
 * @param {Array} allProblems - Array of all DB problems
 * @param {Array} progressRows - Array of user progress rows
 */
function identifyWeaknessRecommendations(topicStats, allProblems = [], progressRows = []) {
    const progressMap = new Map();
    const attemptedUnsolvedList = [];

    progressRows.forEach(row => {
        progressMap.set(Number(row.problem_id), row);
        if (row.status === 'Attempted') {
            attemptedUnsolvedList.push(row);
        }
    });

    const recommendations = [];
    const recommendedProblemIds = new Set();

    // 1. PRIORITY 1: "Finish What You Started" (High-friction attempted problems)
    // Sort attempted problems by error_count descending (most struggle first)
    attemptedUnsolvedList.sort((a, b) => (Number(b.error_count) || 0) - (Number(a.error_count) || 0));

    for (const item of attemptedUnsolvedList) {
        if (recommendations.length >= 3) break;
        const prob = allProblems.find(p => Number(p.id) === Number(item.problem_id));
        if (!prob || recommendedProblemIds.has(Number(prob.id))) continue;

        const canonical = resolveTopic(prob.category);
        recommendedProblemIds.add(Number(prob.id));

        recommendations.push({
            problemId: prob.id,
            title: prob.title || item.problem_title || `Problem #${prob.id}`,
            category: canonical.name,
            categoryId: canonical.id,
            difficulty: prob.difficulty || item.difficulty || 'Medium',
            reasonType: 'WEAKNESS_RESCUE',
            reasonTitle: '🛠️ Finish What You Started',
            reasonDetail: `You have ${item.error_count || 1} previous attempt(s) on this ${canonical.name} problem. Let's conquer it and turn that yellow status green!`,
            priorityScore: 90 + (Number(item.error_count) || 1) * 2
        });
    }

    // 2. PRIORITY 2: High Error Intensity / Low Accuracy Topics (Concept Remediation)
    // Find topics that user has touched (solved + attempted > 0) with high errors or low accuracy
    const weakTopics = Object.values(topicStats)
        .filter(t => (t.solvedCount + t.attemptedUnsolvedCount) > 0 && (t.errorIntensity >= 1.5 || (t.accuracyRate < 45 && t.totalSubmissions >= 2)))
        .sort((a, b) => b.errorIntensity - a.errorIntensity);

    for (const weakTopic of weakTopics) {
        if (recommendations.length >= 6) break;

        // Find an unsolved Easy or Medium problem in this weak category
        const candidateProblems = allProblems.filter(p => {
            if (recommendedProblemIds.has(Number(p.id))) return false;
            const canonical = resolveTopic(p.category);
            if (canonical.id !== weakTopic.id) return false;
            const prog = progressMap.get(Number(p.id));
            if (prog && prog.status === 'Accepted') return false; // Already solved
            
            // Prefer Easy or Medium to step down friction
            const diff = (p.difficulty || '').toLowerCase();
            return diff === 'easy' || diff === 'medium';
        });

        // Sort candidates: Easy first, then lower ID
        candidateProblems.sort((a, b) => {
            const diffA = (a.difficulty || '').toLowerCase() === 'easy' ? 0 : 1;
            const diffB = (b.difficulty || '').toLowerCase() === 'easy' ? 0 : 1;
            if (diffA !== diffB) return diffA - diffB;
            return Number(a.id) - Number(b.id);
        });

        if (candidateProblems.length > 0) {
            const chosen = candidateProblems[0];
            recommendedProblemIds.add(Number(chosen.id));

            recommendations.push({
                problemId: chosen.id,
                title: chosen.title || `Problem #${chosen.id}`,
                category: weakTopic.name,
                categoryId: weakTopic.id,
                difficulty: chosen.difficulty || 'Medium',
                reasonType: 'WEAKNESS_STEP_DOWN',
                reasonTitle: '🎯 Targeted Concept Reinforcement',
                reasonDetail: `Your error intensity in ${weakTopic.name} is ${weakTopic.errorIntensity} errors/problem. Step down to this foundational ${chosen.difficulty} problem to solidify core patterns without frustration.`,
                priorityScore: 85 + (weakTopic.errorIntensity * 3)
            });
        }
    }

    // 3. PRIORITY 3: Suboptimal Complexity Solved Problems (Algorithmic Efficiency Remediation)
    const solvedList = progressRows.filter(r => r.status === 'Accepted' && (r.best_time_complexity || r.best_space_complexity));
    for (const item of solvedList) {
        if (recommendations.length >= 9) break;
        const prob = allProblems.find(p => Number(p.id) === Number(item.problem_id));
        if (!prob || recommendedProblemIds.has(Number(prob.id))) continue;

        const rank = (comp) => {
            if (!comp) return 3;
            const c = comp.toLowerCase().replace(/\s+/g, '');
            if (c === 'o(1)') return 1;
            if (c === 'o(logn)') return 2;
            if (c === 'o(n)') return 3;
            if (c === 'o(nlogn)') return 4;
            if (c === 'o(n^2)' || c === 'o(n*m)') return 5;
            if (c === 'o(n^3)') return 6;
            if (c.includes('2^n')) return 7;
            return 3;
        };

        const userTimeRank = rank(item.best_time_complexity);
        const optTimeRank = rank(prob.expected_time_complexity || 'O(n)');
        const userSpaceRank = rank(item.best_space_complexity);
        const optSpaceRank = rank(prob.expected_space_complexity || 'O(1)');

        if (userTimeRank > optTimeRank || (userSpaceRank > optSpaceRank && optSpaceRank <= 2)) {
            const canonical = resolveTopic(prob.category);
            recommendedProblemIds.add(Number(prob.id));

            recommendations.push({
                problemId: prob.id,
                title: prob.title || item.problem_title || `Problem #${prob.id}`,
                category: canonical.name,
                categoryId: canonical.id,
                difficulty: prob.difficulty || item.difficulty || 'Medium',
                reasonType: 'WEAKNESS_SUBOPTIMAL_COMPLEXITY',
                reasonTitle: '⚡ Complexity Optimization Challenge',
                reasonDetail: `You solved this with ${item.best_time_complexity || 'suboptimal'} Time and ${item.best_space_complexity || 'suboptimal'} Space. Target optimal efficiency is ${prob.expected_time_complexity || 'O(n)'} Time / ${prob.expected_space_complexity || 'O(1)'} Space. Can you optimize it?`,
                priorityScore: 88 + (userTimeRank - optTimeRank) * 5
            });
        }
    }

    return {
        recommendations,
        recommendedProblemIds
    };
}

module.exports = {
    identifyWeaknessRecommendations
};
