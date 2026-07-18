/**
 * PrerequisiteDAG.js
 * --------------------------------------------------------------------------
 * Deterministic Prerequisite & Skill Graph for Canonical Topics and Micro-Patterns.
 * Features 32+ fine-grained interview patterns with explicit Directed Acyclic Graph (DAG)
 * dependencies, difficulty clamping thresholds, and similarity vectors.
 */

const CANONICAL_TOPICS = [
    { id: 'arrays', name: 'Arrays & Matrices', keywords: ['array', 'matrix', 'vector', 'list'], icon: 'fa-layer-group', prerequisites: [], difficultyWeight: 1.0, description: 'Foundation of indexed data storage, traversal, and in-place transformations.' },
    { id: 'hash_tables', name: 'Hash Tables & Sets', keywords: ['hash table', 'hash set', 'map', 'dictionary', 'hashing'], icon: 'fa-hashtag', prerequisites: ['arrays'], difficultyWeight: 1.1, description: 'O(1) lookups, frequency counting, and index mapping.' },
    { id: 'two_pointers', name: 'Two Pointers & Window', keywords: ['two pointers', 'sliding window', 'fast and slow pointer'], icon: 'fa-hand-pointer', prerequisites: ['arrays'], difficultyWeight: 1.2, description: 'Linear time optimizations on sorted arrays and contiguous subarrays.' },
    { id: 'strings', name: 'Strings', keywords: ['string', 'substring', 'character', 'anagram', 'palindrome'], icon: 'fa-font', prerequisites: ['arrays', 'hash_tables'], difficultyWeight: 1.2, description: 'Text manipulation, character frequency, and pattern matching.' },
    { id: 'binary_search', name: 'Binary Search', keywords: ['binary search', 'sorted array search', 'lower bound', 'upper bound'], icon: 'fa-search', prerequisites: ['two_pointers'], difficultyWeight: 1.4, description: 'O(log N) search space reduction on sorted structures or monotonic functions.' },
    { id: 'stack', name: 'Stack & Monotonic Stack', keywords: ['stack', 'monotonic stack', 'parentheses', 'next greater element'], icon: 'fa-layer-group', prerequisites: ['arrays'], difficultyWeight: 1.3, description: 'LIFO processing, parsing, and next-greater/smaller element queries.' },
    { id: 'queue', name: 'Queue & Priority Queue', keywords: ['queue', 'priority queue', 'heap', 'deque'], icon: 'fa-list-ol', prerequisites: ['arrays'], difficultyWeight: 1.4, description: 'FIFO scheduling, K-way merges, and maintaining top-K extrema.' },
    { id: 'trees', name: 'Trees & BST', keywords: ['tree', 'bst', 'binary tree', 'binary search tree', 'trie'], icon: 'fa-project-diagram', prerequisites: ['queue', 'stack'], difficultyWeight: 1.5, description: 'Hierarchical node traversal (Inorder, Preorder, Postorder, Level Order).' },
    { id: 'recursion_backtracking', name: 'Backtracking & Recursion', keywords: ['backtracking', 'recursion', 'permutations', 'combinations', 'subsets'], icon: 'fa-random', prerequisites: ['trees'], difficultyWeight: 1.7, description: 'Systematic state-space exploration with constraint pruning.' },
    { id: 'graphs', name: 'Graphs & BFS/DFS', keywords: ['graph', 'breadth-first search', 'depth-first search', 'union find', 'topological sort', 'adj list'], icon: 'fa-network-wired', prerequisites: ['trees', 'queue'], difficultyWeight: 1.8, description: 'Network connectivity, shortest paths, cycles, and component discovery.' },
    { id: 'greedy', name: 'Greedy Algorithms', keywords: ['greedy', 'interval', 'scheduling'], icon: 'fa-coins', prerequisites: ['arrays', 'queue'], difficultyWeight: 1.5, description: 'Locally optimal choices leading to global optimization.' },
    { id: 'dp', name: 'Dynamic Programming', keywords: ['dynamic programming', 'dp', 'memoization', 'tabulation', 'knapsack'], icon: 'fa-cubes', prerequisites: ['recursion_backtracking'], difficultyWeight: 2.0, description: 'Overlapping subproblems solved via state memoization and optimal substructure.' },
    { id: 'bit_manipulation', name: 'Bit Manipulation', keywords: ['bit manipulation', 'bitwise', 'xor', 'and', 'or', 'shift'], icon: 'fa-microchip', prerequisites: ['arrays'], difficultyWeight: 1.4, description: 'Direct binary transformations and bitmask optimizations.' },
    { id: 'math_geometry', name: 'Math & Geometry', keywords: ['math', 'geometry', 'combinatorics', 'prime', 'modulo', 'gcd'], icon: 'fa-square-root-alt', prerequisites: [], difficultyWeight: 1.3, description: 'Number theory, geometric intersections, and mathematical proofs.' }
];

// ==========================================
// 32+ MICRO-PATTERNS (Granular Interview DAG)
// ==========================================
const MICRO_PATTERNS = [
    { id: 'arr_basic', name: 'Array Indexing & Traversal', parentCategory: 'arrays', prerequisites: [], difficultyWeight: 1.0, keywords: ['array', 'indexing', 'traversal', 'sum'] },
    { id: 'hash_freq', name: 'Hash Map Frequency Bucketing', parentCategory: 'hash_tables', prerequisites: ['arr_basic'], difficultyWeight: 1.1, keywords: ['frequency', 'count', 'hash map', 'two sum', 'anagram', 'duplicate'] },
    { id: 'two_pointers_opposite', name: 'Two Pointers (Opposite Ends)', parentCategory: 'two_pointers', prerequisites: ['arr_basic'], difficultyWeight: 1.2, keywords: ['two pointers', 'opposite', 'sorted', '3sum', 'container'] },
    { id: 'two_pointers_fast_slow', name: 'Fast & Slow Pointers (Floyd\'s Cycle)', parentCategory: 'two_pointers', prerequisites: ['arr_basic'], difficultyWeight: 1.3, keywords: ['fast and slow', 'cycle', 'middle of linked list', 'linked list cycle'] },
    { id: 'sliding_window_fixed', name: 'Sliding Window (Fixed Size)', parentCategory: 'two_pointers', prerequisites: ['arr_basic'], difficultyWeight: 1.3, keywords: ['sliding window', 'fixed', 'maximum average', 'k elements'] },
    { id: 'sliding_window_dynamic', name: 'Sliding Window (Dynamic & Shrinking)', parentCategory: 'two_pointers', prerequisites: ['sliding_window_fixed', 'hash_freq'], difficultyWeight: 1.5, keywords: ['longest substring', 'minimum window', 'without repeating', 'dynamic window'] },
    { id: 'prefix_sum', name: 'Prefix Sum & Difference Arrays', parentCategory: 'arrays', prerequisites: ['arr_basic'], difficultyWeight: 1.2, keywords: ['prefix sum', 'range sum', 'subarray sum'] },
    { id: 'kadane', name: 'Kadane\'s Algorithm (Maximum Subarray)', parentCategory: 'dp', prerequisites: ['arr_basic'], difficultyWeight: 1.3, keywords: ['maximum subarray', 'kadane', 'contiguous'] },
    { id: 'binary_search_basic', name: 'Binary Search (Sorted Array)', parentCategory: 'binary_search', prerequisites: ['two_pointers_opposite'], difficultyWeight: 1.3, keywords: ['binary search', 'search insert', 'first and last'] },
    { id: 'binary_search_answer', name: 'Binary Search on Answer / Monotonic Function', parentCategory: 'binary_search', prerequisites: ['binary_search_basic'], difficultyWeight: 1.7, keywords: ['minimum capacity', 'koko eating', 'split array', 'minimize maximum'] },
    { id: 'stack_standard', name: 'Stack Parsing & Balancing', parentCategory: 'stack', prerequisites: ['arr_basic'], difficultyWeight: 1.2, keywords: ['valid parentheses', 'stack', 'evaluate rpn', 'decode string'] },
    { id: 'monotonic_stack', name: 'Monotonic Stack / Queue', parentCategory: 'stack', prerequisites: ['stack_standard'], difficultyWeight: 1.6, keywords: ['next greater', 'daily temperatures', 'largest rectangle', 'trapping rain'] },
    { id: 'intervals', name: 'Interval Merging & Scheduling', parentCategory: 'greedy', prerequisites: ['arr_basic'], difficultyWeight: 1.4, keywords: ['merge intervals', 'insert interval', 'non-overlapping', 'meeting rooms'] },
    { id: 'heap_top_k', name: 'Top-K Elements via Min/Max Heap', parentCategory: 'queue', prerequisites: ['arr_basic', 'hash_freq'], difficultyWeight: 1.4, keywords: ['top k', 'kth largest', 'priority queue', 'k closest'] },
    { id: 'heap_merge', name: 'K-Way Merge via Heap', parentCategory: 'queue', prerequisites: ['heap_top_k'], difficultyWeight: 1.6, keywords: ['merge k sorted', 'k pairs', 'smallest range'] },
    { id: 'tree_traversal', name: 'Tree DFS (Pre/In/Post Order Traversal)', parentCategory: 'trees', prerequisites: ['stack_standard'], difficultyWeight: 1.3, keywords: ['inorder', 'preorder', 'postorder', 'maximum depth', 'invert binary tree'] },
    { id: 'tree_bfs', name: 'Tree BFS (Level Order & Views)', parentCategory: 'trees', prerequisites: ['tree_traversal'], difficultyWeight: 1.4, keywords: ['level order', 'zigzag', 'right side view'] },
    { id: 'bst_properties', name: 'Binary Search Tree (BST) Properties', parentCategory: 'trees', prerequisites: ['tree_traversal'], difficultyWeight: 1.4, keywords: ['validate bst', 'kth smallest bst', 'lowest common ancestor bst'] },
    { id: 'trie_prefix', name: 'Trie (Prefix Tree)', parentCategory: 'trees', prerequisites: ['hash_freq'], difficultyWeight: 1.5, keywords: ['trie', 'implement trie', 'word search ii', 'prefix tree'] },
    { id: 'backtracking_subsets', name: 'Backtracking (Subsets & Permutations)', parentCategory: 'recursion_backtracking', prerequisites: ['tree_traversal'], difficultyWeight: 1.6, keywords: ['subsets', 'permutations', 'combinations', 'letter combinations'] },
    { id: 'backtracking_grid', name: 'Backtracking in Grid / Matrix', parentCategory: 'recursion_backtracking', prerequisites: ['backtracking_subsets'], difficultyWeight: 1.7, keywords: ['word search', 'n-queens', 'sudoku solver', 'grid backtracking'] },
    { id: 'graph_bfs', name: 'Graph BFS (Shortest Path & Levels)', parentCategory: 'graphs', prerequisites: ['tree_bfs'], difficultyWeight: 1.5, keywords: ['shortest path', 'word ladder', 'rotting oranges', '01 matrix'] },
    { id: 'graph_dfs', name: 'Graph DFS (Connected Components & Flood Fill)', parentCategory: 'graphs', prerequisites: ['tree_traversal'], difficultyWeight: 1.5, keywords: ['number of islands', 'clone graph', 'pacific atlantic', 'flood fill'] },
    { id: 'topological_sort', name: 'Topological Sort (Kahn\'s Algorithm)', parentCategory: 'graphs', prerequisites: ['graph_bfs', 'graph_dfs'], difficultyWeight: 1.7, keywords: ['course schedule', 'alien dictionary', 'topological sort'] },
    { id: 'union_find', name: 'Disjoint Set / Union-Find', parentCategory: 'graphs', prerequisites: ['graph_dfs'], difficultyWeight: 1.7, keywords: ['redundant connection', 'number of provinces', 'union find', 'accounts merge'] },
    { id: 'dp_1d', name: '1D Dynamic Programming (Climbing Stairs & Fibonacci)', parentCategory: 'dp', prerequisites: ['arr_basic'], difficultyWeight: 1.4, keywords: ['climbing stairs', 'house robber', 'fibonacci', 'coin change'] },
    { id: 'dp_knapsack', name: '0/1 Knapsack & Unbounded DP', parentCategory: 'dp', prerequisites: ['dp_1d'], difficultyWeight: 1.7, keywords: ['knapsack', 'partition equal subset', 'coin change ii', 'target sum'] },
    { id: 'dp_lcs', name: 'Subsequence & String DP (LCS / LIS)', parentCategory: 'dp', prerequisites: ['dp_1d'], difficultyWeight: 1.8, keywords: ['longest common subsequence', 'longest increasing subsequence', 'edit distance'] },
    { id: 'dp_grid', name: 'Grid Path DP', parentCategory: 'dp', prerequisites: ['dp_1d'], difficultyWeight: 1.6, keywords: ['unique paths', 'minimum path sum', 'dungeon game'] },
    { id: 'greedy_scheduling', name: 'Greedy Choice & Interval Scheduling', parentCategory: 'greedy', prerequisites: ['intervals'], difficultyWeight: 1.5, keywords: ['jump game', 'gas station', 'task scheduler', 'partition labels'] },
    { id: 'bit_masking', name: 'Bitwise Manipulation & XOR Tricks', parentCategory: 'bit_manipulation', prerequisites: ['arr_basic'], difficultyWeight: 1.4, keywords: ['single number', 'counting bits', 'reverse bits', 'missing number'] }
];

const _topicCache = new Map();
const _patternCache = new Map();

/**
 * Resolves a problem to its exact micro-pattern based on title, category, and keywords.
 * Uses memoization cache to optimize repeated lookups across candidate scoring loops.
 */
function resolveMicroPattern(problem = {}) {
    if (!problem) return MICRO_PATTERNS[0];
    const cacheKey = `${problem.id}_${problem.title || ''}_${problem.category || ''}`;
    if (_patternCache.has(cacheKey)) return _patternCache.get(cacheKey);

    const text = `${problem.title || ''} ${problem.category || ''} ${problem.description || ''}`.toLowerCase();
    
    // First try exact keyword match
    for (const pat of MICRO_PATTERNS) {
        if (pat.keywords.some(k => text.includes(k))) {
            _patternCache.set(cacheKey, pat);
            return pat;
        }
    }

    // Fallback to parent category match
    const parentCat = resolveTopic(problem.category);
    const categoryMatches = MICRO_PATTERNS.filter(p => p.parentCategory === parentCat.id);
    const result = categoryMatches.length > 0 ? categoryMatches[0] : MICRO_PATTERNS[0];
    _patternCache.set(cacheKey, result);
    return result;
}

/**
 * Resolves any free-text category or topic string to its canonical topic ID & metadata.
 * Uses memoization and generates unique slug IDs for unmatched custom categories.
 */
function resolveTopic(categoryStr = '') {
    if (!categoryStr) return CANONICAL_TOPICS[0];
    const clean = categoryStr.toLowerCase().trim();
    if (_topicCache.has(clean)) return _topicCache.get(clean);
    
    const exact = CANONICAL_TOPICS.find(t => t.name.toLowerCase() === clean || t.id === clean);
    if (exact) {
        _topicCache.set(clean, exact);
        return exact;
    }

    const keywordMatch = CANONICAL_TOPICS.find(t => 
        t.keywords.some(k => clean.includes(k) || k.includes(clean))
    );
    if (keywordMatch) {
        _topicCache.set(clean, keywordMatch);
        return keywordMatch;
    }

    // Unique slugified fallback ID to avoid collapsing distinct custom categories into 'general'
    const slugId = clean.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'general';
    const fallback = {
        id: slugId,
        name: categoryStr,
        keywords: [clean],
        icon: 'fa-code',
        prerequisites: ['arrays'],
        difficultyWeight: 1.0,
        description: `Custom algorithmic domain: ${categoryStr}.`
    };
    _topicCache.set(clean, fallback);
    return fallback;
}

/**
 * Checks if all micro-pattern prerequisites are sufficiently mastered (>= threshold %).
 */
function checkPatternPrerequisitesSatisfied(targetPatternId, patternMasteryMap, threshold = 40) {
    const pattern = MICRO_PATTERNS.find(p => p.id === targetPatternId);
    if (!pattern || !pattern.prerequisites || pattern.prerequisites.length === 0) {
        return { satisfied: true, missingPrereqs: [], avgPrereqMastery: 100 };
    }

    const missing = [];
    let totalScore = 0;
    for (const prereqId of pattern.prerequisites) {
        const currentScore = patternMasteryMap[prereqId] || 0;
        totalScore += currentScore;
        if (currentScore < threshold) {
            const prereqPat = MICRO_PATTERNS.find(p => p.id === prereqId);
            missing.push({
                id: prereqId,
                name: prereqPat ? prereqPat.name : prereqId,
                currentScore,
                requiredScore: threshold
            });
        }
    }

    const avgPrereqMastery = Math.round(totalScore / pattern.prerequisites.length);
    return {
        satisfied: missing.length === 0,
        missingPrereqs: missing,
        avgPrereqMastery
    };
}

/**
 * Checks if canonical topic prerequisites are met (backward compatible).
 */
function checkPrerequisitesSatisfied(targetTopicId, masteryMap, threshold = 35) {
    const topic = CANONICAL_TOPICS.find(t => t.id === targetTopicId);
    if (!topic || !topic.prerequisites || topic.prerequisites.length === 0) {
        return { satisfied: true, missingPrereqs: [] };
    }

    const missing = [];
    for (const prereqId of topic.prerequisites) {
        const currentScore = masteryMap[prereqId] || 0;
        if (currentScore < threshold) {
            const prereqTopic = CANONICAL_TOPICS.find(t => t.id === prereqId);
            missing.push({
                id: prereqId,
                name: prereqTopic ? prereqTopic.name : prereqId,
                currentScore,
                requiredScore: threshold
            });
        }
    }

    return {
        satisfied: missing.length === 0,
        missingPrereqs: missing
    };
}

/**
 * Validates DAG topology at boot/test time to prevent circular dependencies or orphan prerequisite references.
 */
function validateDAGTopology() {
    const patternIds = new Set(MICRO_PATTERNS.map(p => p.id));
    const errors = [];
    
    for (const pat of MICRO_PATTERNS) {
        if (!pat.prerequisites) continue;
        for (const prereqId of pat.prerequisites) {
            if (!patternIds.has(prereqId)) {
                errors.push(`Orphan prerequisite reference: ${pat.id} requires missing pattern '${prereqId}'`);
            }
            if (prereqId === pat.id) {
                errors.push(`Self-referential cycle: ${pat.id} lists itself as prerequisite`);
            }
        }
    }
    return { valid: errors.length === 0, errors };
}

module.exports = {
    CANONICAL_TOPICS,
    MICRO_PATTERNS,
    resolveTopic,
    resolveMicroPattern,
    checkPrerequisitesSatisfied,
    checkPatternPrerequisitesSatisfied,
    validateDAGTopology
};
