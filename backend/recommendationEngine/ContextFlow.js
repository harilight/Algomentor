/**
 * ContextFlow.js
 * --------------------------------------------------------------------------
 * Deterministic Contextual & Momentum Engine.
 * Evaluates real-time user flow state: recent 1st-try solves (momentum),
 * recent consecutive failures (cognitive fatigue rescue), and user onboarding bubbles.
 */

const { resolveTopic } = require('./PrerequisiteDAG');

/**
 * Evaluates real-time contextual flow recommendations.
 * @param {Array} submissionRows - Recent submissions sorted by submitted_at DESC
 * @param {Array} allProblems - Array of all DB problems
 * @param {Array} progressRows - User progress rows
 * @param {Array} userTopics - Array of strings (user's selected interest bubbles)
 * @param {Set} alreadyRecommendedIds - Set of problem IDs already picked
 */
function identifyContextualRecommendations(submissionRows = [], allProblems = [], progressRows = [], userTopics = [], alreadyRecommendedIds = new Set()) {
    const progressMap = new Map();
    progressRows.forEach(r => progressMap.set(Number(r.problem_id), r));

    const problemMap = new Map();
    allProblems.forEach(p => problemMap.set(Number(p.id), p));

    const recommendations = [];

    // 1. Check recent activity within the last 5 submissions
    const recentSubs = submissionRows.slice(0, 5);
    const hasRecentSubmissions = recentSubs.length > 0;

    let recentAcceptedCount = 0;
    let recentFailedCount = 0;
    let lastAcceptedTopicId = null;

    for (const sub of recentSubs) {
        const prob = problemMap.get(Number(sub.problem_id));
        const topicStr = prob ? prob.category : (sub.topic || '');
        if (sub.status === 'Accepted') {
            recentAcceptedCount++;
            if (!lastAcceptedTopicId && topicStr) {
                const canonical = resolveTopic(topicStr);
                lastAcceptedTopicId = canonical.id;
            }
        } else {
            recentFailedCount++;
        }
    }

    // A. FATIGUE RESCUE CONTEXT: If last 3+ submissions failed without an Accepted solve recently
    if (recentSubs.length >= 3 && recentAcceptedCount === 0 && recentFailedCount >= 3) {
        // Find a confident, clean Easy problem from user's favorite bubbles or general strong areas
        const favoriteTopics = Array.isArray(userTopics) && userTopics.length > 0
            ? userTopics.map(t => resolveTopic(t).id)
            : ['arrays', 'two_pointers', 'hash_tables'];

        const rescueCandidate = allProblems.find(p => {
            if (alreadyRecommendedIds.has(Number(p.id))) return false;
            const prog = progressMap.get(Number(p.id));
            if (prog && prog.status === 'Accepted') return false; // Must be unsolved
            const canonical = resolveTopic(p.category);
            const diff = (p.difficulty || '').toLowerCase();
            return diff === 'easy' && favoriteTopics.includes(canonical.id);
        });

        if (rescueCandidate) {
            const canonical = resolveTopic(rescueCandidate.category);
            alreadyRecommendedIds.add(Number(rescueCandidate.id));
            recommendations.push({
                problemId: rescueCandidate.id,
                title: rescueCandidate.title || `Problem #${rescueCandidate.id}`,
                category: canonical.name,
                categoryId: canonical.id,
                difficulty: rescueCandidate.difficulty || 'Easy',
                reasonType: 'CONTEXT_RESCUE',
                reasonTitle: '🛡️ Cognitive Restore (Quick Win)',
                reasonDetail: `Sensing some tough debugging friction recently! Take a quick brain-break with this confident ${canonical.name} challenge to reset your streak and regain momentum.`,
                priorityScore: 95
            });
        }
    }

    // B. FLOW / MOMENTUM CONTEXT: If user just solved a problem on 1st/2nd attempt recently
    if (lastAcceptedTopicId && recentAcceptedCount > 0) {
        // Find the next adjacent/slight step up in the exact same category
        const momentumCandidate = allProblems.find(p => {
            if (alreadyRecommendedIds.has(Number(p.id))) return false;
            const prog = progressMap.get(Number(p.id));
            if (prog && prog.status === 'Accepted') return false;
            const canonical = resolveTopic(p.category);
            return canonical.id === lastAcceptedTopicId;
        });

        if (momentumCandidate) {
            const canonical = resolveTopic(momentumCandidate.category);
            alreadyRecommendedIds.add(Number(momentumCandidate.id));
            recommendations.push({
                problemId: momentumCandidate.id,
                title: momentumCandidate.title || `Problem #${momentumCandidate.id}`,
                category: canonical.name,
                categoryId: canonical.id,
                difficulty: momentumCandidate.difficulty || 'Medium',
                reasonType: 'CONTEXT_MOMENTUM',
                reasonTitle: '🔥 Flow State Momentum',
                reasonDetail: `You're crushing ${canonical.name} right now! Keep the neural pathways hot by tackling this next challenge while the mental model is fresh.`,
                priorityScore: 88
            });
        }
    }

    // C. ONBOARDING BUBBLE CONTEXT (Always ensure we honor user's chosen topics)
    if (Array.isArray(userTopics) && userTopics.length > 0) {
        for (const rawTopic of userTopics) {
            if (recommendations.length >= 4) break;
            const canonical = resolveTopic(rawTopic);

            const bubbleProblem = allProblems.find(p => {
                if (alreadyRecommendedIds.has(Number(p.id))) return false;
                const prog = progressMap.get(Number(p.id));
                if (prog && prog.status === 'Accepted') return false;
                const pCat = resolveTopic(p.category);
                return pCat.id === canonical.id;
            });

            if (bubbleProblem) {
                const canonicalProb = resolveTopic(bubbleProblem.category);
                alreadyRecommendedIds.add(Number(bubbleProblem.id));
                recommendations.push({
                    problemId: bubbleProblem.id,
                    title: bubbleProblem.title || `Problem #${bubbleProblem.id}`,
                    category: canonicalProb.name,
                    categoryId: canonicalProb.id,
                    difficulty: bubbleProblem.difficulty || 'Medium',
                    reasonType: 'USER_INTEREST_BUBBLE',
                    reasonTitle: '🌟 Chosen Interest Bubble',
                    reasonDetail: `Directly aligned with your self-selected focus topic: "${rawTopic}". Master this to level up your targeted interview tracks.`,
                    priorityScore: 82
                });
            }
        }
    }

    // D. DAG COMPLEXITY UNLOCK WARNING (`DAG_COMPLEXITY_UNLOCK_NEEDED`):
    const suboptimalSolved = progressRows.filter(r => r.status === 'Accepted' && (r.best_time_complexity || r.best_space_complexity));
    for (const subItem of suboptimalSolved) {
        if (recommendations.length >= 6) break;
        const prob = problemMap.get(Number(subItem.problem_id));
        if (!prob || alreadyRecommendedIds.has(Number(prob.id))) continue;
        if (prob.expected_time_complexity && subItem.best_time_complexity && subItem.best_time_complexity !== prob.expected_time_complexity && !['O(1)', 'O(log n)'].includes(subItem.best_time_complexity)) {
            const canonical = resolveTopic(prob.category);
            alreadyRecommendedIds.add(Number(prob.id));
            recommendations.push({
                problemId: prob.id,
                title: prob.title || `Problem #${prob.id}`,
                category: canonical.name,
                categoryId: canonical.id,
                difficulty: prob.difficulty || 'Medium',
                reasonType: 'DAG_COMPLEXITY_UNLOCK_NEEDED',
                reasonTitle: '🔓 Prerequisite Complexity Upgrade Needed',
                reasonDetail: `You solved this prerequisite with ${subItem.best_time_complexity} Time. To unlock advanced ${canonical.name} mastery, optimize your solution to ${prob.expected_time_complexity}.`,
                priorityScore: 86
            });
        }
    }

    return {
        recommendations,
        recommendedProblemIds: alreadyRecommendedIds
    };
}

module.exports = {
    identifyContextualRecommendations
};
