/**
 * recommendationEngine/index.js
 * --------------------------------------------------------------------------
 * Exports the clean, deterministic 3-Pillar Recommendation Engine.
 */

const { generateRecommendations } = require('./RecommendationService');
const { CANONICAL_TOPICS, MICRO_PATTERNS, resolveTopic, resolveMicroPattern, checkPrerequisitesSatisfied, checkPatternPrerequisitesSatisfied } = require('./PrerequisiteDAG');
const { analyzeUserSkills } = require('./SkillTracker');
const { scoreAllCandidates } = require('./CandidateScorer');

module.exports = {
    generateRecommendations,
    scoreAllCandidates,
    CANONICAL_TOPICS,
    MICRO_PATTERNS,
    resolveTopic,
    resolveMicroPattern,
    checkPrerequisitesSatisfied,
    checkPatternPrerequisitesSatisfied,
    analyzeUserSkills
};
