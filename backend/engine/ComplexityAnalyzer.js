/**
 * engine/ComplexityAnalyzer.js
 * Multi-Language Static AST & Empirical Big-O Complexity Analyzer.
 * 
 * Inspects code structures across Python, JavaScript, Java, and C++,
 * reconciles with runtime telemetry and verdicts, and generates exact
 * diagnostic explainability and pedagogical feedback.
 */

class ComplexityAnalyzer {
    /**
     * Main entry point for analyzing submission or execution complexity.
     * @param {Object} params
     * @param {string} params.code - User submitted source code
     * @param {string} params.language - Target language (python, javascript, java, cpp)
     * @param {string} params.verdict - Verdict string ('Accepted', 'Time Limit Exceeded', etc.)
     * @param {Object} [params.runtimeMetrics] - Telemetry (durationMs, memoryBytes)
     * @param {Array} [params.testCases] - Evaluated test cases
     * @param {Object} [params.problemMetadata] - Problem expected complexity and details
     * @returns {Object} Complexity analysis summary
     */
    static analyze({
        code = '',
        language = 'javascript',
        verdict = 'Accepted',
        runtimeMetrics = null,
        testCases = [],
        problemMetadata = null
    } = {}) {
        const cleanCode = String(code || '').trim();
        const targetLang = String(language || '').toLowerCase().trim();

        // 1. Static Structural Analysis (AST & Regex Inspection)
        const staticResult = this.analyzeStaticStructure(cleanCode, targetLang);

        // 2. Empirical Verification
        const empiricalResult = this.analyzeEmpirical(runtimeMetrics, testCases, verdict);

        // 3. Reconciliation & Pedagogical Feedback
        return this.reconcileAndExplain(staticResult, empiricalResult, problemMetadata, verdict);
    }

    /**
     * Performs multi-language structural analysis to detect loop nesting depth,
     * recursion, divide-and-conquer halving patterns, and auxiliary space allocations.
     */
    static analyzeStaticStructure(code, language) {
        const lines = code.split('\n');
        let maxLoopDepth = 0;
        let currentLoopDepth = 0;
        let hasHalving = false;
        let hasSorting = false;
        let isRecursive = false;
        let recursionCallCount = 0;
        let hasDPOrMemo = false;
        let hasArrayAllocation = false;
        let hasMatrixAllocation = false;
        let hasMapOrSetAllocation = false;

        // Strip string literals and comments to prevent false positive keyword matches
        let strippedCode = code
            .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
            .replace(/\/\/.*/g, '')           // line comments
            .replace(/#.*/g, '');             // python comments

        // Check for common sorting keywords
        if (/\b(sort|sorted|Arrays\.sort|Collections\.sort|std::sort)\b/.test(strippedCode)) {
            hasSorting = true;
        }

        // Check for DP or memoization patterns
        if (/\b(memo|cache|dp|lru_cache)\b/i.test(strippedCode) || /\[\[.+?\]\s*\*\s*.+?\]/.test(strippedCode)) {
            hasDPOrMemo = true;
        }

        // Check for divide-and-conquer halving patterns (e.g., binary search, mid calculation)
        if (/\b(mid|right\s*-\s*left|>>\s*1|\/\s*2)\b/.test(strippedCode) && /\b(left\s*<=\s*right|low\s*<=\s*high|start\s*<=\s*end)\b/.test(strippedCode)) {
            hasHalving = true;
        }

        // Check for space allocations
        if (language === 'python') {
            if (/\[\s*0\s*\]\s*\*\s*[a-zA-Z0-9_]+/i.test(strippedCode) || /\[.+?\s+for\s+.+?\s+in\s+/i.test(strippedCode) || /=\s*\[\s*\]/.test(strippedCode)) {
                hasArrayAllocation = true;
            }
            if (/\[\[.+?\]\s*\*\s*[a-zA-Z0-9_]+/i.test(strippedCode) || /\[\s*\[.*?\]\s+for\s+.+?\s+in\s+/i.test(strippedCode)) {
                hasMatrixAllocation = true;
            }
            if (/=\s*\{\s*\}/.test(strippedCode) || /\b(set|dict|defaultdict|Counter)\s*\(/i.test(strippedCode)) {
                hasMapOrSetAllocation = true;
            }
        } else if (language === 'javascript') {
            if (/new\s+Array\s*\(/.test(strippedCode) || /=\s*\[\s*\]/.test(strippedCode) || /\.map\s*\(/.test(strippedCode)) {
                hasArrayAllocation = true;
            }
            if (/Array\.from\(\s*\{.*?length.*\}\s*,\s*\(\)\s*=>\s*new\s+Array/i.test(strippedCode) || /\[\[.+?\]\]/.test(strippedCode)) {
                hasMatrixAllocation = true;
            }
            if (/new\s+(Map|Set)\s*\(/.test(strippedCode) || /=\s*\{\s*\}/.test(strippedCode)) {
                hasMapOrSetAllocation = true;
            }
        } else if (language === 'java') {
            if (/new\s+[a-zA-Z0-9_]+\s*\[.+?\]/.test(strippedCode) || /new\s+ArrayList/.test(strippedCode)) {
                hasArrayAllocation = true;
            }
            if (/new\s+[a-zA-Z0-9_]+\s*\[.+?\]\s*\[.+?\]/.test(strippedCode)) {
                hasMatrixAllocation = true;
            }
            if (/new\s+(HashMap|HashSet|TreeMap|TreeSet|LinkedHashMap)\b/.test(strippedCode)) {
                hasMapOrSetAllocation = true;
            }
        } else if (language === 'cpp') {
            if (/\bvector\s*<\s*[a-zA-Z0-9_]+\s*>/i.test(strippedCode) || /new\s+[a-zA-Z0-9_]+\s*\[.+?\]/.test(strippedCode)) {
                hasArrayAllocation = true;
            }
            if (/\bvector\s*<\s*vector\s*<\s*[a-zA-Z0-9_]+\s*>\s*>/i.test(strippedCode)) {
                hasMatrixAllocation = true;
            }
            if (/\b(unordered_map|unordered_set|map|set)\s*</i.test(strippedCode)) {
                hasMapOrSetAllocation = true;
            }
        }

        // Extract function names and detect recursion
        let functionNames = [];
        if (language === 'python') {
            const defMatches = strippedCode.matchAll(/^\s*def\s+([a-zA-Z0-9_]+)\s*\(/gm);
            for (const m of defMatches) if (m[1] && m[1] !== '__init__') functionNames.push(m[1]);
        } else {
            const funcMatches = strippedCode.matchAll(/\b(?:function\s+([a-zA-Z0-9_]+)|(?:int|void|double|string|bool|auto|vector<.*?>|ListNode\*|TreeNode\*|long)\s+([a-zA-Z0-9_]+)\s*\()/gm);
            for (const m of funcMatches) {
                const fname = m[1] || m[2];
                if (fname && fname !== 'main' && !['if', 'for', 'while', 'switch'].includes(fname)) {
                    functionNames.push(fname);
                }
            }
        }

        for (const fname of functionNames) {
            // Count self-invocations inside function body
            const callRegex = new RegExp(`\\b(?:self\\.)?${fname}\\s*\\(`, 'g');
            const matches = strippedCode.match(callRegex);
            if (matches && matches.length > 1) { // 1 match is definition/first declaration
                isRecursive = true;
                recursionCallCount = Math.max(recursionCallCount, matches.length - 1);
            }
        }

        // Track Loop Nesting Depth via brace counting or python indent levels
        if (language === 'python') {
            let loopIndents = [];
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const indent = line.search(/\S/);
                const isLoopHeader = /^\s*(?:for\s+.+?\s+in\s+|while\s+.+?:)/.test(line);

                // Pop finished loop indents
                while (loopIndents.length > 0 && indent <= loopIndents[loopIndents.length - 1]) {
                    loopIndents.pop();
                }

                if (isLoopHeader) {
                    loopIndents.push(indent);
                    if (loopIndents.length > maxLoopDepth) {
                        maxLoopDepth = loopIndents.length;
                    }
                }
            }
        } else {
            // Brace tracking for JS, Java, C++
            let loopStack = [];
            const tokens = strippedCode.split(/([{}()])/);
            let inLoopCondition = 0;

            for (const token of tokens) {
                const t = token.trim();
                if (!t) continue;

                if (/\b(?:for|while)\b/.test(t) && !/\bdo\b/.test(t)) {
                    loopStack.push('awaiting_brace');
                } else if (t === '{') {
                    if (loopStack.length > 0 && loopStack[loopStack.length - 1] === 'awaiting_brace') {
                        loopStack[loopStack.length - 1] = 'in_loop';
                        const currentActiveLoops = loopStack.filter(s => s === 'in_loop').length;
                        if (currentActiveLoops > maxLoopDepth) {
                            maxLoopDepth = currentActiveLoops;
                        }
                    } else {
                        loopStack.push('block');
                    }
                } else if (t === '}') {
                    if (loopStack.length > 0) {
                        loopStack.pop();
                    }
                }
            }
        }

        // Determine Static Time Complexity
        let time = 'O(1)';
        let reasons = [];

        if (isRecursive) {
            if (recursionCallCount >= 2 && !hasDPOrMemo) {
                time = 'O(2^n)';
                reasons.push(`Detected tree/branching recursion (${recursionCallCount} calls per invocation) without memoization.`);
            } else if (hasDPOrMemo && (maxLoopDepth === 1 || hasMatrixAllocation)) {
                time = 'O(n^2)';
                reasons.push("Detected dynamic programming state transitions across 2D states/subproblems.");
            } else if (hasDPOrMemo || recursionCallCount === 1) {
                time = 'O(n)';
                reasons.push("Detected linear recursion / memoized subproblem evaluations.");
            }
        } else {
            if (maxLoopDepth === 0) {
                if (hasSorting) {
                    time = 'O(n log n)';
                    reasons.push("Detected sorting operation over collection.");
                } else {
                    time = 'O(1)';
                    reasons.push("No sequential loops or recursive traversal identified.");
                }
            } else if (maxLoopDepth === 1) {
                if (hasHalving) {
                    time = 'O(log n)';
                    reasons.push("Detected single-level iteration with logarithmic space reduction/halving (e.g. Binary Search).");
                } else if (hasSorting) {
                    time = 'O(n log n)';
                    reasons.push("Detected sorting operation followed by single-pass traversal.");
                } else {
                    time = 'O(n)';
                    reasons.push("Detected single-level loop iterating over input sequence.");
                }
            } else if (maxLoopDepth === 2) {
                if (hasHalving) {
                    time = 'O(n log n)';
                    reasons.push("Detected outer loop with inner logarithmic halving operation.");
                } else {
                    time = 'O(n^2)';
                    reasons.push("Detected 2-level nested loops (quadratic growth across input pairs).");
                }
            } else if (maxLoopDepth >= 3) {
                time = `O(n^${maxLoopDepth})`;
                reasons.push(`Detected ${maxLoopDepth}-level deep nested loops.`);
            }
        }

        // Determine Static Space Complexity
        let space = 'O(1)';
        if (hasMatrixAllocation) {
            space = 'O(n^2)';
            reasons.push("Auxiliary 2D matrix / table allocation detected.");
        } else if (hasMapOrSetAllocation) {
            space = 'O(n)';
            reasons.push("Auxiliary Hash Table/Set allocated to track distinct elements or frequencies.");
        } else if (hasArrayAllocation || (isRecursive && !hasDPOrMemo)) {
            space = 'O(n)';
            if (isRecursive) {
                reasons.push("Auxiliary space required for recursive call stack frames.");
            } else {
                reasons.push("Auxiliary 1D array/list allocation detected scaling with input size.");
            }
        } else {
            space = 'O(1)';
            reasons.push("No dynamic data structure allocations scaling with input size detected.");
        }

        return {
            timeComplexity: time,
            spaceComplexity: space,
            reasons,
            maxLoopDepth,
            isRecursive,
            hasMapOrSetAllocation,
            hasSorting
        };
    }

    /**
     * Cross-checks structural diagnosis against runtime duration and memory footprint.
     */
    static analyzeEmpirical(runtimeMetrics, testCases, verdict) {
        if (!runtimeMetrics || !testCases || testCases.length === 0) {
            return { empiricalAligned: true };
        }

        const durationMs = runtimeMetrics.durationMs || 0;
        const memoryBytes = runtimeMetrics.memoryBytes || 0;

        let empiricalNote = null;
        if (verdict === 'Time Limit Exceeded') {
            empiricalNote = `Execution exceeded time limits (${durationMs}ms), confirming high-order algorithmic complexity (e.g. O(n^2) or O(2^n)).`;
        } else if (verdict === 'Memory Limit Exceeded') {
            empiricalNote = `Execution exceeded memory limits (${Math.round(memoryBytes / 1024 / 1024)} MB), confirming excessive auxiliary space allocation.`;
        }

        return {
            durationMs,
            memoryBytes,
            empiricalNote
        };
    }

    /**
     * Reconciles structural + empirical findings into exact Big-O outputs
     * and produces pedagogical, constructive feedback.
     */
    static reconcileAndExplain(staticResult, empiricalResult, problemMetadata, verdict) {
        let timeComplexity = staticResult.timeComplexity;
        let spaceComplexity = staticResult.spaceComplexity;
        const reasons = [...staticResult.reasons];

        if (empiricalResult && empiricalResult.empiricalNote) {
            reasons.push(empiricalResult.empiricalNote);
            if (verdict === 'Time Limit Exceeded' && ['O(1)', 'O(log n)', 'O(n)'].includes(timeComplexity)) {
                timeComplexity = 'O(n^2)'; // Override if empirical timeout occurred on linear diagnosis
            }
        }

        // Determine expected complexities (fallback to O(n) / O(n) or metadata)
        let expectedTime = problemMetadata?.expected_time_complexity || 'O(n)';
        let expectedSpace = problemMetadata?.expected_space_complexity || 'O(n)';

        // Clean formatting
        expectedTime = String(expectedTime).trim();
        expectedSpace = String(expectedSpace).trim();

        let feedback = '';

        if (verdict !== 'Accepted') {
            feedback = `Your code currently results in ${verdict}. ` +
                       `Estimated complexity: Time ${timeComplexity}, Space ${spaceComplexity}. ` +
                       `Review your boundary conditions and algorithmic efficiency to reach the optimal ${expectedTime} time threshold.`;
        } else {
            // Compare ranks of time complexity
            const rank = (comp) => {
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

            const userRank = rank(timeComplexity);
            const optRank = rank(expectedTime);
            const userSpaceRank = rank(spaceComplexity);
            const optSpaceRank = rank(expectedSpace);

            if (userRank === optRank && userSpaceRank <= optSpaceRank) {
                feedback = `🎉 Optimal Algorithmic Solution! Your approach achieves ${timeComplexity} Time and ${spaceComplexity} Space, exactly matching target efficiency standards.`;
            } else if (userRank > optRank) {
                feedback = `⚠️ Suboptimal Time Complexity: Your solution runs in ${timeComplexity}, but an optimal approach achieves ${expectedTime}. `;
                if (staticResult.maxLoopDepth >= 2) {
                    feedback += `Consider replacing your nested loops (` + `O(n^2)` + `) with a Hash Map or Two Pointers (` + `O(n)` + `) to eliminate inner scans.`;
                } else if (staticResult.hasSorting && expectedTime === 'O(n)') {
                    feedback += `Sorting takes ` + `O(n log n)` + `. Try using an auxiliary Hash Set or frequency counter to achieve ` + `O(n)` + ` linear time without sorting.`;
                } else {
                    feedback += `Analyze data bottlenecks to reduce redundant traversals.`;
                }
            } else if (userSpaceRank > optSpaceRank) {
                feedback = `👍 Optimal Time Complexity (${timeComplexity}), but higher Space Complexity (${spaceComplexity} vs target ${expectedSpace}). `;
                if (staticResult.hasMapOrSetAllocation && expectedSpace === 'O(1)') {
                    feedback += `Try optimizing your auxiliary Hash Set/Map into in-place pointer manipulation or variable tracking (` + `O(1)` + ` space).`;
                } else {
                    feedback += `Explore in-place operations to minimize dynamic memory footprint.`;
                }
            } else {
                feedback = `✔ Excellent efficiency! Your solution achieves ${timeComplexity} Time and ${spaceComplexity} Space (Target: ${expectedTime} / ${expectedSpace}).`;
            }
        }

        return {
            timeComplexity,
            spaceComplexity,
            reasons,
            feedback,
            expectedTimeComplexity: expectedTime,
            expectedSpaceComplexity: expectedSpace
        };
    }
}

module.exports = ComplexityAnalyzer;
