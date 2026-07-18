/**
 * JavaScriptDriver.js
 * Encapsulates compilation, execution, and cleanup for JavaScript solutions.
 * Preserves 100% of the verified LeetCode evaluation heuristics and driver code generation.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

class JavaScriptDriver {
    async compile(context) {
        context.fileName = path.join(os.tmpdir(), `temp_solution_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.js`);
        context.command = `node --stack-size=65536 "${context.fileName}"`;
        context.trackFile(context.fileName);

        const { code, methodName, evalToken } = context;
        const cleanDataPath = String(context.cleanDataPath || '').replace(/\\/g, '/');

        const driverCode = `
function ListNode(val, next) {
    this.val = (val===undefined ? 0 : val);
    this.next = (next===undefined ? null : next);
}

function TreeNode(val, left, right) {
    this.val = (val===undefined ? 0 : val);
    this.left = (left===undefined ? null : left);
    this.right = (right===undefined ? null : right);
}

function Node(val, neighbors, children, next, random, left, right) {
    this.val = val === undefined ? 0 : val;
    this.neighbors = neighbors === undefined ? [] : neighbors;
    this.children = children === undefined ? [] : children;
    this.next = next === undefined ? null : next;
    this.random = random === undefined ? null : random;
    this.left = left === undefined ? null : left;
    this.right = right === undefined ? null : right;
}

${code}

if (typeof Solution !== 'function') {
    console.log("${evalToken}_RUNTIME_ERROR\\nClass 'Solution' not found or not defined properly.");
    process.exit(0);
}

try {
    const fs = require('fs');
    const _payload = JSON.parse(fs.readFileSync('${cleanDataPath}', 'utf-8'));
    const testCases = _payload.testCases || [];
    const metaData = _payload.meta_data || null;
    const mode = _payload.mode || 'run';

    (async () => {
        let allPassed = true;
        let firstFailedIndex = -1;
        let caseResults = [];
        let argsArray = [];
        let fn = null;
        const cleanFnName = '${methodName}'.replace(/[^a-zA-Z0-9_]/g, '');
        if (cleanFnName && typeof Solution.prototype[cleanFnName] === 'function') {
            fn = Solution.prototype[cleanFnName];
        } else if (cleanFnName && typeof Solution[cleanFnName] === 'function') {
            fn = Solution[cleanFnName];
        }
        
        let unboundFn = fn;
        if (!unboundFn && typeof Solution === 'function' && Solution.prototype) {
            for (let p of Object.getOwnPropertyNames(Solution.prototype)) {
                if (p !== 'constructor' && typeof Solution.prototype[p] === 'function') {
                    unboundFn = Solution.prototype[p];
                    break;
                }
            }
        }

        let fnStr = unboundFn ? unboundFn.toString() : '';
        let match = fnStr.match(/^[^(]*\(([^)]*)\)/);
        let paramNames = match && match[1] ? match[1].split(',').map(s => s.trim().split('=')[0].trim()).filter(Boolean) : [];
        let actualMethodName = unboundFn && unboundFn.name ? unboundFn.name.toLowerCase() : cleanFnName.toLowerCase();

        for (let i = 0; i < testCases.length; i++) {
            const rawInput = testCases[i].input;
            const rawArgs = testCases[i].raw_args || [];
            
            let rawExpected = (testCases[i].output !== undefined && testCases[i].output !== null) ? testCases[i].output : ((testCases[i].expected !== undefined && testCases[i].expected !== null) ? testCases[i].expected : null);
            let retType = metaData && metaData.return && metaData.return.type ? String(metaData.return.type).toLowerCase().trim().replace(/\s+/g, '') : '';
            let isPrimitiveString = ['string', 'str', 'char', 'character'].includes(retType);
            let isStringOrStringArray = ['string', 'str', 'char', 'character', 'string[]', 'list[str]', 'list[string]', 'vector<string>', 'char[][]', 'list[list[str]]', 'list[list[character]]', 'vector<vector<char>>', 'string[][]', 'char[]', 'list[char]', 'character[]'].includes(retType) || retType.includes('string') || retType.includes('str') || retType.includes('char');
            
            const pythonToJSON = (rawStr) => {
                if (typeof rawStr !== 'string') return rawStr;
                let s = rawStr.trim();
                let out = "";
                let inDouble = false;
                let inSingle = false;
                let word = "";
                const flushWord = () => {
                    if (!word) return;
                    if (word === 'None') out += 'null';
                    else if (word === 'True') out += 'true';
                    else if (word === 'False') out += 'false';
                    else out += word;
                    word = "";
                };
                for (let idx = 0; idx < s.length; idx++) {
                    let ch = s[idx];
                    if (inDouble) {
                        out += ch;
                        if (ch === '"' && (idx === 0 || s[idx-1] !== '\\\\' || (idx >= 2 && s[idx-1] === '\\\\' && s[idx-2] === '\\\\'))) {
                            inDouble = false;
                        }
                    } else if (inSingle) {
                        if (ch === "'" && (idx === 0 || s[idx-1] !== '\\\\' || (idx >= 2 && s[idx-1] === '\\\\' && s[idx-2] === '\\\\'))) {
                            inSingle = false;
                            out += '"';
                        } else if (ch === '"') {
                            out += '\\\\"';
                        } else if (ch === '\\\\' && idx + 1 < s.length && s[idx+1] === "'") {
                            out += "'";
                            idx++;
                        } else {
                            out += ch;
                        }
                    } else if (ch === '"') {
                        flushWord();
                        inDouble = true;
                        out += ch;
                    } else if (ch === "'") {
                        flushWord();
                        inSingle = true;
                        out += '"';
                    } else if (/[a-zA-Z0-9_]/.test(ch)) {
                        word += ch;
                    } else {
                        flushWord();
                        out += ch;
                    }
                }
                flushWord();
                return out;
            };

            let expected = rawExpected;
            if (typeof expected === 'string') {
                let cleanExp = expected.trim().replace(/^['"]|['"]$/g, '');
                if (cleanExp === "True" || cleanExp === "true") expected = true;
                else if (cleanExp === "False" || cleanExp === "false") expected = false;
                else if (cleanExp === "None" || cleanExp === "null" || cleanExp === "undefined") expected = null;
                else {
                    if (isPrimitiveString) {
                        if ((expected.trim().startsWith('"') && expected.trim().endsWith('"')) || (expected.trim().startsWith("'") && expected.trim().endsWith("'"))) {
                            try {
                                let inner = JSON.parse(expected.trim());
                                if (typeof inner === 'string') expected = inner;
                                else expected = cleanExp;
                            } catch(e) {
                                expected = expected.trim().slice(1, -1);
                            }
                        } else {
                            expected = cleanExp;
                        }
                    } else {
                        try {
                            expected = JSON.parse(cleanExp);
                        } catch (e) {
                            try {
                                expected = JSON.parse(pythonToJSON(cleanExp));
                            } catch (e2) {
                                expected = cleanExp;
                            }
                        }
                    }
                }
            }

            function buildBinaryTree(arr) {
                if (!arr || !arr.length || arr[0] === null || arr[0] === undefined) return null;
                let root = new TreeNode(arr[0]);
                let queue = [root];
                let i = 1;
                while (queue.length > 0 && i < arr.length) {
                    let curr = queue.shift();
                    if (i < arr.length && arr[i] !== null && arr[i] !== undefined) {
                        curr.left = new TreeNode(arr[i]);
                        queue.push(curr.left);
                    }
                    i++;
                    if (i < arr.length && arr[i] !== null && arr[i] !== undefined) {
                        curr.right = new TreeNode(arr[i]);
                        queue.push(curr.right);
                    }
                    i++;
                }
                return root;
            }

            function buildNaryTree(arr) {
                if (!arr || !arr.length || arr[0] === null || arr[0] === undefined) return null;
                let root = new Node(arr[0], [], []);
                let queue = [root];
                let i = 1;
                if (i < arr.length && arr[i] === null) i++;
                while (queue.length > 0 && i < arr.length) {
                    let curr = queue.shift();
                    while (i < arr.length && arr[i] !== null && arr[i] !== undefined) {
                        let child = new Node(arr[i], [], []);
                        curr.children.push(child);
                        queue.push(child);
                        i++;
                    }
                    if (i < arr.length && arr[i] === null) i++;
                }
                return root;
            }

            function arrayToLinkedList(arr) {
                if (!arr || !arr.length) return null;
                let dummy = new ListNode(0);
                let curr = dummy;
                for (let val of arr) {
                    curr.next = new ListNode(val);
                    curr = curr.next;
                }
                return dummy.next;
            }

            function buildGraph(adjList) {
                if (!adjList || !adjList.length) return null;
                let nodes = new Map();
                for (let i = 1; i <= adjList.length; i++) {
                    nodes.set(i, new Node(i, []));
                }
                for (let i = 0; i < adjList.length; i++) {
                    let node = nodes.get(i + 1);
                    for (let neighborVal of adjList[i]) {
                        node.neighbors.push(nodes.get(neighborVal));
                    }
                }
                return nodes.get(1) || null;
            }

            function buildRandomList(arr) {
                if (!arr || !arr.length) return null;
                let nodes = [];
                for (let item of arr) {
                    let val = Array.isArray(item) ? item[0] : item;
                    nodes.push(new Node(val));
                }
                for (let i = 0; i < arr.length; i++) {
                    if (i < arr.length - 1) nodes[i].next = nodes[i + 1];
                    let item = arr[i];
                    if (Array.isArray(item) && item[1] !== null && item[1] !== undefined) {
                        nodes[i].random = nodes[item[1]] || null;
                    }
                }
                return nodes[0] || null;
            }

            argsArray = rawArgs.map((arg, idx) => {
                let paramName = paramNames[idx] ? paramNames[idx].toLowerCase() : '';
                let paramType = (metaData && metaData.params && metaData.params[idx] && metaData.params[idx].type) 
                    ? String(metaData.params[idx].type).toLowerCase() 
                    : '';
                    
                if (!Array.isArray(arg)) return arg;

                const m = '${methodName}'.toLowerCase() + ' ' + actualMethodName;
                const p = paramName.toLowerCase();
                const isBinaryTree = paramType.includes('treenode') || paramType.includes('tree') || (['root', 'root1', 'root2', 'subroot', 'original', 'cloned', 'tree', 'p', 'q'].includes(p) || p.includes('tree') || p.includes('root') || ['treetodoublylist', 'inorder', 'preorder', 'postorder', 'levelorder', 'zigzag', 'maxdepth', 'mindepth', 'issymmetric', 'issubtree', 'isbalanced', 'isvalidbst', 'lowestcommonancestor', 'buildtree', 'flatten', 'pathsum', 'maxpathsum', 'binarytree', 'bst', 'invert', 'diameter', 'prunetree', 'addonerow', 'delnodes', 'goodnodes'].some(k => m.includes(k)));
                const isGraphProb = ['graph', 'clonegraph', 'adj'].some(k => m.includes(k) || p.includes(k));
                const isRandomProb = ['random', 'copyrandom'].some(k => m.includes(k) || p.includes(k));
                const isNaryProb = !isBinaryTree && ['nary', 'n_ary', 'quad'].some(k => (m.includes(k) || p.includes(k)) && !m.includes('binary') && !p.includes('binary'));
                const isMatrixProb = ['board', 'matrix', 'sudoku', 'grid', 'image'].some(k => m.includes(k) || p.includes(k));
                const isKListProb = ['klists', 'k_lists', 'mergek', 'ksum', '4sum', '3sum'].some(k => m.includes(k) || p.includes(k));

                if (isBinaryTree && !isMatrixProb && !isGraphProb) {
                    return buildBinaryTree(arg);
                }
                if (paramType.includes('listnode') || (!isMatrixProb && !isKListProb && !isGraphProb && !isRandomProb && (['head', 'heada', 'headb', 'head1', 'head2', 'l1', 'l2', 'l3', 'list1', 'list2', 'firstlist', 'secondlist', 'dummy', 'first', 'second'].includes(p) || p.startsWith('head') || ['addtwonumbers', 'mergetwolists', 'reorderlist', 'removenthfromend', 'reversebetween', 'swappairs', 'rotateright', 'partitionlist', 'reversekgroup', 'sortlist', 'deleteduplicates', 'detectcycle', 'hascycle', 'ispalindrome', 'oddevenlist', 'splitlisttoparts', 'insertionsortlist'].some(k => m.includes(k))))) {
                    return arrayToLinkedList(arg);
                }
                if (paramType.includes('graphnode') || isGraphProb) {
                    if (Array.isArray(arg) && arg.length > 0 && Array.isArray(arg[0])) {
                        return buildGraph(arg);
                    }
                    return arg;
                }
                if (paramType.includes('narynode') || isNaryProb) {
                    return buildNaryTree(arg);
                }
                if (paramType.includes('randomnode') || isRandomProb) {
                    return buildRandomList(arg);
                }
                if (paramType.includes('list[treenode]') || paramType.includes('treenode[]') || paramType.includes('list<treenode>')) {
                    return arg.map(subArr => Array.isArray(subArr) ? buildBinaryTree(subArr) : subArr);
                }
                if (paramType.includes('list[listnode]') || paramType.includes('listnode[]') || paramType.includes('list<listnode>') || (!isMatrixProb && (isKListProb || ['lists', 'klists', 'k_lists', 'linkedlists'].includes(p)))) {
                    return arg.map(subArr => Array.isArray(subArr) ? arrayToLinkedList(subArr) : subArr);
                }
                return arg;
            });

            let result = null;
            let isDesignProblem = false;
            // Check if this test case is Class Design format: ["LRUCache", "put", "get"] and [[2], [1, 1], [1]]
            if (Array.isArray(rawArgs) && rawArgs.length === 2 && Array.isArray(rawArgs[0]) && Array.isArray(rawArgs[1]) && rawArgs[0].length === rawArgs[1].length && typeof rawArgs[0][0] === 'string' && (typeof Solution === 'function' && !fn)) {
                isDesignProblem = true;
                const cmds = rawArgs[0];
                const cmdArgs = rawArgs[1];
                const clsName = cmds[0];
                const ClsObj = (typeof eval !== 'undefined') ? (tryGetClass(clsName) || Solution) : Solution;
                function tryGetClass(name) {
                    try { return eval(name); } catch(e) { return null; }
                }
                let objInstance = new (ClsObj || Solution)(...(cmdArgs[0] || []));
                let resList = [null];
                for (let c = 1; c < cmds.length; c++) {
                    let cmdName = cmds[c];
                    let cArgs = cmdArgs[c] || [];
                    if (typeof objInstance[cmdName] === 'function') {
                        let stepRes = objInstance[cmdName](...cArgs);
                        resList.push(stepRes === undefined ? null : stepRes);
                    } else {
                        resList.push(null);
                    }
                }
                result = resList;
            } else {
                let objInstance = new Solution();
                fn = null;
                if (cleanFnName && typeof objInstance[cleanFnName] === 'function') {
                    fn = objInstance[cleanFnName].bind(objInstance);
                }
                if (!fn && unboundFn) {
                    fn = unboundFn.bind(objInstance);
                }
                if (!fn) {
                    console.log("${evalToken}_RUNTIME_ERROR\\nMethod not found inside class Solution.");
                    process.exit(0);
                }

                result = fn(...argsArray);

                let retType = (metaData && metaData.return && metaData.return.type)
                    ? String(metaData.return.type).toLowerCase()
                    : '';
                let isVoidReturn = retType === 'void' || retType === 'null' || retType === 'undefined';

                if (result === undefined && argsArray.length > 0 && typeof argsArray[0] === 'object' && argsArray[0] !== null && (isVoidReturn || /^(setZeroes|moveZeroes|nextPermutation|solveSudoku|rotate|reverseString|sortColors)/i.test('${methodName}') || (expected !== undefined && expected !== null && expected !== 'null' && String(expected).trim() !== 'null'))) {
                    result = argsArray[0];
                }
            }

            function treeToList(root) {
                if (!root) return [];
                let res = [];
                let queue = [root];
                while (queue.length > 0) {
                    let curr = queue.shift();
                    if (curr) {
                        res.push(curr.val);
                        queue.push(curr.left || null);
                        queue.push(curr.right || null);
                    } else {
                        res.push(null);
                    }
                }
                while (res.length > 0 && res[res.length - 1] === null) {
                    res.pop();
                }
                return res;
            }

            function linkedListToArray(head) {
                let res = [];
                let curr = head;
                let visited = new Set();
                while (curr && !visited.has(curr)) {
                    visited.add(curr);
                    res.push(curr.val !== undefined ? curr.val : curr);
                    curr = curr.next;
                }
                return res;
            }

            function graphToList(node) {
                if (!node) return [];
                let visited = new Map();
                let queue = [node];
                visited.set(node.val, []);
                while (queue.length > 0) {
                    let curr = queue.shift();
                    for (let neighbor of (curr.neighbors || [])) {
                        if (neighbor) {
                            visited.get(curr.val).push(neighbor.val);
                            if (!visited.has(neighbor.val)) {
                                visited.set(neighbor.val, []);
                                queue.push(neighbor);
                            }
                        }
                    }
                }
                let maxVal = Math.max(...visited.keys());
                let res = [];
                for (let i = 1; i <= maxVal; i++) {
                    res.push(visited.get(i) || []);
                }
                return res;
            }

            function randomListToArray(head) {
                if (!head) return [];
                let nodes = [];
                let curr = head;
                let visited = new Map();
                let idx = 0;
                while (curr && !visited.has(curr)) {
                    visited.set(curr, idx++);
                    nodes.push(curr);
                    curr = curr.next;
                }
                let res = [];
                for (let node of nodes) {
                    let randIdx = node.random ? (visited.has(node.random) ? visited.get(node.random) : null) : null;
                    res.push([node.val !== undefined ? node.val : node, randIdx]);
                }
                return res;
            }

            function naryTreeToList(root) {
                if (!root) return [];
                let res = [root.val, null];
                let queue = [root];
                while (queue.length > 0) {
                    let curr = queue.shift();
                    if (curr.children && curr.children.length > 0) {
                        for (let child of curr.children) {
                            res.push(child.val);
                            queue.push(child);
                        }
                        res.push(null);
                    }
                }
                while (res.length > 0 && res[res.length - 1] === null) {
                    res.pop();
                }
                return res;
            }

            function serializeItem(item, seen = new Set()) {
                if (item === null || item === undefined) return item;
                if (typeof item !== 'object') return item;
                if (seen.has(item)) return "[Circular]";
                seen.add(item);

                if (Array.isArray(item)) {
                    return item.map(sub => serializeItem(sub, new Set(seen)));
                }
                if (item instanceof TreeNode || (typeof item === 'object' && item !== null && 'val' in item && 'left' in item && 'right' in item && !('neighbors' in item) && !('children' in item))) return treeToList(item);
                if (item instanceof ListNode || (typeof item === 'object' && item !== null && 'val' in item && 'next' in item && !('left' in item) && !('random' in item))) return linkedListToArray(item);
                if (item instanceof Node || (typeof item === 'object' && item !== null && ('neighbors' in item || 'children' in item || 'random' in item))) {
                    if (item.neighbors !== null && item.neighbors !== undefined) return graphToList(item);
                    if (item.children !== null && item.children !== undefined) return naryTreeToList(item);
                    if (item.random !== null || item.next !== null) return randomListToArray(item);
                    return item.val;
                }
                if (typeof item === 'object') {
                    let cleanObj = {};
                    for (let k of Object.keys(item)) {
                        cleanObj[k] = serializeItem(item[k], seen);
                    }
                    return cleanObj;
                }
                return item;
            }

            result = serializeItem(result);
            if ((result === null || (Array.isArray(result) && result.length === 1 && result[0] === null)) && Array.isArray(expected) && expected.length === 0) {
                result = [];
            }

            function trimTrailingNulls(arr) {
                if (!Array.isArray(arr)) return arr;
                let copy = arr.slice();
                while (copy.length > 0 && (copy[copy.length - 1] === null || copy[copy.length - 1] === undefined)) {
                    copy.pop();
                }
                return copy;
            }

            function floatCompare(r, e, eps = 1e-5) {
                if (typeof r === 'number' && typeof e === 'number') return Math.abs(r - e) <= eps;
                if (Array.isArray(r) && Array.isArray(e)) {
                    if (r.length !== e.length) return false;
                    for (let i = 0; i < r.length; i++) if (!floatCompare(r[i], e[i], eps)) return false;
                    return true;
                }
                return JSON.stringify(r) === JSON.stringify(e);
            }

            function unorderedCompare(r, e) {
                if (!Array.isArray(r) || !Array.isArray(e)) {
                    try { return JSON.stringify(r) === JSON.stringify(e); } catch(err) { throw new Error('Internal Error: Failed to serialize comparison data (' + err.message + ')'); }
                }
                if (r.length !== e.length) return false;
                try {
                    let rs = r.map(x => typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x)).sort();
                    let es = e.map(x => typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x)).sort();
                    for (let i = 0; i < rs.length; i++) if (rs[i] !== es[i]) return false;
                    return true;
                } catch(err) { throw new Error('Internal Error: Failed to serialize unordered comparison data (' + err.message + ')'); }
            }

            function areEqual(r, e, strategy) {
                if (r === e) return true;
                if (r === undefined && e === null) return true;
                if (r === null && e === undefined) return true;
                if (strategy === 'float' || strategy === 'floating_point' || strategy === 'double') {
                    return floatCompare(r, e, 1e-5);
                }
                if (strategy === 'unordered' || strategy === 'set' || strategy === 'any_order') {
                    return unorderedCompare(r, e);
                }
                if (Array.isArray(r) && Array.isArray(e)) {
                    let rt = trimTrailingNulls(r);
                    let et = trimTrailingNulls(e);
                    if (rt.length === et.length) {
                        try { if (JSON.stringify(rt) === JSON.stringify(et)) return true; } catch(err) {}
                    }
                }
                try { return JSON.stringify(r) === JSON.stringify(e); } catch(err) { throw new Error('Internal Error: Failed to serialize comparison data (' + err.message + ')'); }
            }

            let strategy = (metaData && metaData.return && metaData.return.comparison) ? String(metaData.return.comparison).toLowerCase() : 'exact';
            
            let casePassed = true;
            if (result === undefined) {
                casePassed = false;
            } else if (!areEqual(result, expected, strategy)) {
                casePassed = false;
            }

            caseResults.push({
                case: i + 1,
                input: (typeof rawInput === 'string') ? rawInput : JSON.stringify(rawInput),
                output: (result === undefined) ? 'undefined' : (typeof result === 'object' && result !== null ? JSON.stringify(result) : String(result)),
                expected: (expected === null) ? 'null' : (typeof expected === 'object' && expected !== null ? JSON.stringify(expected) : String(expected)),
                passed: casePassed
            });

            if (!casePassed) {
                allPassed = false;
                if (firstFailedIndex === -1) firstFailedIndex = i;
                if (mode === 'submit') {
                    break;
                }
            }
        }

        console.log("${evalToken}_CASE_RESULTS_:" + JSON.stringify({
            allPassed,
            mode,
            totalCases: testCases.length,
            passedCases: caseResults.filter(c => c.passed).length,
            firstFailedCase: firstFailedIndex !== -1 ? firstFailedIndex + 1 : null,
            caseResults
        }));

        if (allPassed) {
            console.log("${evalToken}_SUCCESS_ALL");
        } else if (firstFailedIndex !== -1) {
            let fc = caseResults[firstFailedIndex];
            console.log("${evalToken}_MISMATCH");
            console.log("Input: " + fc.input);
            console.log("Output: " + fc.output);
            console.log("Expected: " + fc.expected);
        }
    })().catch(err => {
        console.log("${evalToken}_RUNTIME_ERROR\\n" + err.stack + "\\nDEBUG_ARGS: " + JSON.stringify(typeof argsArray !== 'undefined' ? argsArray : 'N/A') + " PARAM_NAMES: " + JSON.stringify(typeof paramNames !== 'undefined' ? paramNames : 'N/A'));
        process.exit(0);
    });
} catch (err) {
    console.log("${evalToken}_RUNTIME_ERROR\\n" + err.stack + "\\nDEBUG_OUTER: " + err.message);
    process.exit(0);
}
`;
        await fs.promises.writeFile(context.fileName, driverCode, 'utf-8');
        return context;
    }

    parseInputs(context) { return context; }
    serialize(context) { return context; }

    async execute(context) {
        return new Promise((resolve) => {
            exec(context.command, { timeout: context.executionLimits.timeoutMs, maxBuffer: context.executionLimits.maxBufferBytes }, (execErr, stdout, stderr) => {
                context.rawStdout = stdout || '';
                context.rawStderr = stderr || '';
                context.execErr = execErr || null;
                resolve(context);
            });
        });
    }

    async cleanup(context) {
        if (context.fileName && fs.existsSync(context.fileName)) {
            try { fs.unlinkSync(context.fileName); } catch (e) {}
        }
    }
}

module.exports = JavaScriptDriver;
