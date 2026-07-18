/**
 * PythonDriver.js
 * Encapsulates compilation, execution, and cleanup for Python solutions.
 * Preserves 100% of the verified LeetCode evaluation heuristics and driver code generation.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

class PythonDriver {
    async compile(context) {
        context.fileName = path.join(os.tmpdir(), `temp_solution_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.py`);
        context.command = `python "${context.fileName}"`;
        context.trackFile(context.fileName);

        const { code, methodName, evalToken } = context;
        const cleanDataPath = String(context.cleanDataPath || '').replace(/\\/g, '/');
        const camelMethod = methodName;
        const snakeMethod = methodName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

        const driverCode = `
from typing import *
import sys
import json
import collections
import inspect
import re
import math

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class Node:
    def __init__(self, val=0, neighbors=None, children=None, next=None, random=None, left=None, right=None):
        self.val = val
        self.neighbors = neighbors if neighbors is not None else []
        self.children = children if children is not None else []
        self.next = next
        self.random = random
        self.left = left
        self.right = right

def build_binary_tree(arr):
    if not arr: return None
    root = TreeNode(arr[0])
    queue = collections.deque([root])
    i = 1
    while queue and i < len(arr):
        curr = queue.popleft()
        if i < len(arr) and arr[i] is not None:
            curr.left = TreeNode(arr[i])
            queue.append(curr.left)
        i += 1
        if i < len(arr) and arr[i] is not None:
            curr.right = TreeNode(arr[i])
            queue.append(curr.right)
        i += 1
    return root

def build_nary_tree(arr):
    if not arr: return None
    root = Node(arr[0], [], [])
    queue = collections.deque([root])
    i = 1
    if i < len(arr) and arr[i] is None: i += 1
    while queue and i < len(arr):
        curr = queue.popleft()
        while i < len(arr) and arr[i] is not None:
            child = Node(arr[i], [], [])
            curr.children.append(child)
            queue.append(child)
            i += 1
        if i < len(arr) and arr[i] is None: i += 1
    return root

def array_to_linked_list(arr):
    if not arr: return None
    dummy = ListNode(0)
    curr = dummy
    for val in arr:
        curr.next = ListNode(val)
        curr = curr.next
    return dummy.next

def build_graph(adj_list):
    if not adj_list: return None
    nodes = {i: Node(i, []) for i in range(1, len(adj_list) + 1)}
    for idx, neighbors in enumerate(adj_list):
        u = idx + 1
        for v in neighbors:
            nodes[u].neighbors.append(nodes[v])
    return nodes[1] if 1 in nodes else None

def build_random_list(arr):
    if not arr: return None
    nodes = []
    for item in arr:
        val = item[0] if isinstance(item, list) else item
        nodes.append(Node(val))
    for i in range(len(arr)):
        if i < len(arr) - 1: nodes[i].next = nodes[i + 1]
        item = arr[i]
        if isinstance(item, list) and len(item) > 1 and item[1] is not None:
            nodes[i].random = nodes[item[1]] if 0 <= item[1] < len(nodes) else None
    return nodes[0] if nodes else None

${code}

try:
    with open('${cleanDataPath}', 'r', encoding='utf-8') as f:
        _payload = json.load(f)
    test_cases = _payload.get('testCases', [])
    meta_data = _payload.get('meta_data', None)
    mode = _payload.get('mode', 'run')
    
    target_function = None
    target_cls = None
    if 'Solution' in globals() and inspect.isclass(Solution):
        target_cls = Solution
        if hasattr(Solution, '${camelMethod}'):
            target_function = getattr(Solution, '${camelMethod}')
        elif hasattr(Solution, '${snakeMethod}'):
            target_function = getattr(Solution, '${snakeMethod}')
        else:
            for attr_name in dir(Solution):
                if not attr_name.startswith('_') and callable(getattr(Solution, attr_name)):
                    target_function = getattr(Solution, attr_name)
                    break

    def python_to_json(raw_str):
        if not isinstance(raw_str, str): return raw_str
        s = raw_str.strip()
        out = []
        in_double = False
        in_single = False
        word = []
        def flush_word():
            if not word: return
            w = "".join(word)
            if w == 'None': out.append('null')
            elif w == 'True': out.append('true')
            elif w == 'False': out.append('false')
            else: out.append(w)
            word.clear()
        idx = 0
        while idx < len(s):
            ch = s[idx]
            if in_double:
                out.append(ch)
                if ch == '"' and (idx == 0 or s[idx-1] != '\\\\' or (idx >= 2 and s[idx-1] == '\\\\' and s[idx-2] == '\\\\')):
                    in_double = False
            elif in_single:
                if ch == "'" and (idx == 0 or s[idx-1] != '\\\\' or (idx >= 2 and s[idx-1] == '\\\\' and s[idx-2] == '\\\\')):
                    in_single = False
                    out.append('"')
                elif ch == '"':
                    out.append('\\\\"')
                elif ch == '\\\\' and idx + 1 < len(s) and s[idx+1] == "'":
                    out.append("'")
                    idx += 1
                else:
                    out.append(ch)
            elif ch == '"':
                flush_word()
                in_double = True
                out.append(ch)
            elif ch == "'":
                flush_word()
                in_single = True
                out.append('"')
            elif ch.isalnum() or ch == '_':
                word.append(ch)
            else:
                flush_word()
                out.append(ch)
            idx += 1
        flush_word()
        return "".join(out)

    all_passed = True
    first_failed_index = -1
    case_results = []
    for tc_idx, tc in enumerate(test_cases):
        if not tc or 'input' not in tc or tc['input'] is None:
            continue
            
        raw_exp = tc.get('output') if tc.get('output') is not None else tc.get('expected')
        ret_type = str(meta_data.get('return', {}).get('type', '')).lower().strip().replace(' ', '') if meta_data else ''
        is_primitive_string = ret_type in ['string', 'str', 'char', 'character']
        is_string_or_string_array = ret_type in ['string', 'str', 'char', 'character', 'string[]', 'list[str]', 'list[string]', 'vector<string>', 'char[][]', 'list[list[str]]', 'list[list[character]]', 'vector<vector<char>>', 'string[][]', 'char[]', 'list[char]', 'character[]'] or 'string' in ret_type or 'str' in ret_type or 'char' in ret_type
        expected = raw_exp
        if isinstance(expected, str):
            clean_exp = expected.strip().strip("'").strip('"')
            if clean_exp in ["True", "true"]: expected = True
            elif clean_exp in ["False", "false"]: expected = False
            elif clean_exp in ["null", "None", "undefined"]: expected = None
            else:
                if is_primitive_string:
                    if (expected.strip().startswith('"') and expected.strip().endswith('"')) or (expected.strip().startswith("'") and expected.strip().endswith("'")):
                        try:
                            inner = json.loads(expected.strip())
                            if isinstance(inner, str): expected = inner
                            else: expected = clean_exp
                        except:
                            expected = expected.strip()[1:-1]
                    else:
                        expected = clean_exp
                else:
                    try:
                        expected = json.loads(clean_exp)
                    except:
                        try:
                            expected = json.loads(python_to_json(clean_exp))
                        except:
                            expected = clean_exp

        raw_args = tc.get('raw_args', [])
        if raw_args is None:
            raw_args = []
            
        transformed_args = []
        if target_function:
            sig = inspect.signature(target_function)
            params = list(sig.parameters.items())
            if params and params[0][0] == 'self':
                params = params[1:]
                
            for idx, arg in enumerate(raw_args):
                if not isinstance(arg, list):
                    transformed_args.append(arg)
                    continue
                    
                param_name = params[idx][0] if idx < len(params) else ''
                param_type = ''
                if idx < len(params) and params[idx][1].annotation != inspect.Parameter.empty:
                    param_type = str(params[idx][1].annotation)
                if meta_data and meta_data.get('params') and idx < len(meta_data['params']):
                    param_type = str(meta_data['params'][idx].get('type', param_type))
                    
                type_str = param_type.lower()
                m_str = '${camelMethod}'.lower() + (' ' + target_function.__name__.lower() if target_function and hasattr(target_function, '__name__') else '')
                p_str = param_name.lower()
                
                is_binary_tree = 'treenode' in type_str or 'tree' in type_str or (param_name in ['root', 'root1', 'root2', 'subroot', 'original', 'cloned', 'tree', 'p', 'q'] or 'tree' in p_str or 'root' in p_str or any(k in m_str for k in ['treetodoublylist', 'inorder', 'preorder', 'postorder', 'levelorder', 'zigzag', 'maxdepth', 'mindepth', 'issymmetric', 'issubtree', 'isbalanced', 'isvalidbst', 'lowestcommonancestor', 'buildtree', 'flatten', 'pathsum', 'maxpathsum', 'binarytree', 'bst', 'invert', 'diameter', 'prunetree', 'addonerow', 'delnodes', 'goodnodes']))
                is_graph_prob = any(k in m_str or k in p_str for k in ['graph', 'clonegraph', 'adj'])
                is_random_prob = any(k in m_str or k in p_str for k in ['random', 'copyrandom'])
                is_nary_prob = not is_binary_tree and any((k in m_str or k in p_str) and 'binary' not in m_str and 'binary' not in p_str for k in ['nary', 'n_ary', 'quad'])
                is_matrix_prob = any(k in m_str or k in p_str for k in ['board', 'matrix', 'sudoku', 'grid', 'image'])
                is_klist_prob = any(k in m_str or k in p_str for k in ['klists', 'k_lists', 'mergek', 'ksum', '4sum', '3sum'])
                
                if is_binary_tree and not is_matrix_prob and not is_graph_prob:
                    transformed_args.append(build_binary_tree(arg))
                elif 'listnode' in type_str or (not is_matrix_prob and not is_klist_prob and not is_graph_prob and not is_random_prob and (param_name in ['head', 'heada', 'headb', 'head1', 'head2', 'l1', 'l2', 'l3', 'list1', 'list2', 'firstlist', 'secondlist', 'dummy', 'first', 'second'] or param_name.startswith('head') or any(k in m_str for k in ['addtwonumbers', 'mergetwolists', 'reorderlist', 'removenthfromend', 'reversebetween', 'swappairs', 'rotateright', 'partitionlist', 'reversekgroup', 'sortlist', 'deleteduplicates', 'detectcycle', 'hascycle', 'ispalindrome', 'oddevenlist', 'splitlisttoparts', 'insertionsortlist']))):
                    transformed_args.append(array_to_linked_list(arg))
                elif 'graphnode' in type_str or is_graph_prob:
                    if isinstance(arg, list) and len(arg) > 0 and isinstance(arg[0], list):
                        transformed_args.append(build_graph(arg))
                    else:
                        transformed_args.append(arg)
                elif 'narynode' in type_str or is_nary_prob:
                    transformed_args.append(build_nary_tree(arg))
                elif 'randomnode' in type_str or is_random_prob:
                    transformed_args.append(build_random_list(arg))
                elif isinstance(arg, list) and ('list[treenode]' in type_str or 'treenode[]' in type_str or 'list<treenode>' in type_str):
                    transformed_args.append([build_binary_tree(sub) if isinstance(sub, list) else sub for sub in arg])
                elif isinstance(arg, list) and all(isinstance(sub, (list, ListNode, type(None))) for sub in arg) and ('list[listnode]' in type_str or 'listnode[]' in type_str or 'list<listnode>' in type_str or is_klist_prob or param_name in ['lists', 'klists', 'k_lists', 'linkedlists']) and not is_matrix_prob and (len(arg) == 0 or isinstance(arg[0], (list, ListNode, type(None)))):
                    transformed_args.append([array_to_linked_list(sub) if isinstance(sub, list) else sub for sub in arg])
                else:
                    transformed_args.append(arg)
        else:
            transformed_args = raw_args

        if not target_cls:
            # Class Design simulation
            lines = tc['input'].strip().split('\\n')
            cmds = json.loads(lines[0])
            args_list = json.loads(lines[1])
            cls_name = cmds[0]
            cls_obj = globals().get(cls_name) or (target_function if inspect.isclass(target_function) else None)
            if not cls_obj:
                print("${evalToken}_RUNTIME_ERROR\\nCould not find design class definition: " + cls_name)
                sys.exit(0)
            obj_instance = cls_obj(*args_list[0])
            result_list = [None]
            for cmd_name, cmd_args in zip(cmds[1:], args_list[1:]):
                if hasattr(obj_instance, cmd_name):
                    method = getattr(obj_instance, cmd_name)
                    res = method(*cmd_args)
                    result_list.append(res)
                else:
                    result_list.append(None)
            result = result_list
        else:
            obj_instance = target_cls()
            if target_function:
                result = target_function(obj_instance, *transformed_args)
            else:
                result = None

        ret_type = ''
        if target_function:
            sig = inspect.signature(target_function)
            if sig.return_annotation != inspect.Signature.empty:
                ret_type = str(sig.return_annotation).lower()
        if meta_data and meta_data.get('return'):
            ret_type = str(meta_data['return'].get('type', ret_type)).lower()
        is_void_return = ret_type in ['void', 'none', 'nonetype'] or (target_function and inspect.signature(target_function).return_annotation in [None, type(None)])
        if result is None and len(transformed_args) > 0 and isinstance(transformed_args[0], (list, dict, TreeNode, ListNode, Node)) and (is_void_return or re.search(r'^(setZeroes|moveZeroes|nextPermutation|solveSudoku|rotate|reverseString|sortColors)', '${camelMethod}', re.I) or (expected is not None and expected != 'null' and str(expected).strip() != 'null')):
            result = transformed_args[0]

        def serialize_item(item, seen=None):
            if seen is None: seen = set()
            if item is None: return None
            if isinstance(item, (int, float, str, bool)): return item
            if id(item) in seen: return "[Circular]"
            seen.add(id(item))

            if isinstance(item, list):
                return [serialize_item(sub, set(seen)) for sub in item]
            if isinstance(item, tuple):
                return [serialize_item(sub, set(seen)) for sub in item]
            if isinstance(item, dict):
                return {str(k): serialize_item(v, set(seen)) for k, v in item.items()}
            if isinstance(item, TreeNode) or (hasattr(item, 'val') and hasattr(item, 'left') and hasattr(item, 'right') and not hasattr(item, 'neighbors')):
                res = []
                queue = collections.deque([item])
                while queue:
                    curr = queue.popleft()
                    if curr:
                        res.append(curr.val)
                        queue.append(getattr(curr, 'left', None))
                        queue.append(getattr(curr, 'right', None))
                    else:
                        res.append(None)
                while res and res[-1] is None: res.pop()
                return res
            if isinstance(item, ListNode) or (hasattr(item, 'val') and hasattr(item, 'next') and not hasattr(item, 'left')):
                res = []
                curr = item
                visited = set()
                while curr and id(curr) not in visited:
                    visited.add(id(curr))
                    res.append(curr.val)
                    curr = getattr(curr, 'next', None)
                return res
            if isinstance(item, Node):
                if hasattr(item, 'neighbors') and item.neighbors is not None and len(item.neighbors) > 0:
                    visited_map = {}
                    queue = collections.deque([item])
                    visited_map[item.val] = []
                    while queue:
                        curr = queue.popleft()
                        for n in getattr(curr, 'neighbors', []):
                            if n:
                                visited_map[curr.val].append(n.val)
                                if n.val not in visited_map:
                                    visited_map[n.val] = []
                                    queue.append(n)
                    max_val = max(visited_map.keys()) if visited_map else 0
                    return [visited_map.get(i, []) for i in range(1, max_val + 1)]
                if hasattr(item, 'children') and item.children is not None and len(item.children) > 0:
                    res = [item.val, None]
                    queue = collections.deque([item])
                    while queue:
                        curr = queue.popleft()
                        if getattr(curr, 'children', None):
                            for child in curr.children:
                                res.append(child.val)
                                queue.append(child)
                            res.append(None)
                    while res and res[-1] is None: res.pop()
                    return res
                if getattr(item, 'random', None) is not None or getattr(item, 'next', None) is not None:
                    nodes = []
                    curr = item
                    visited_idx = {}
                    idx = 0
                    while curr and id(curr) not in visited_idx:
                        visited_idx[id(curr)] = idx
                        nodes.append(curr)
                        curr = getattr(curr, 'next', None)
                        idx += 1
                    res = []
                    for node in nodes:
                        rand_idx = visited_idx.get(id(node.random)) if getattr(node, 'random', None) else None
                        res.append([node.val, rand_idx])
                    return res
                return item.val
            if hasattr(item, '__dict__'):
                return serialize_item(item.__dict__, seen)
            return item

        result = serialize_item(result)
        if (result is None or result == [None]) and isinstance(expected, list) and len(expected) == 0:
            result = []

        def trim_trailing_nulls(arr):
            if not isinstance(arr, list): return arr
            copy = list(arr)
            while len(copy) > 0 and copy[-1] is None:
                copy.pop()
            return copy

        def float_compare(r, e, eps=1e-5):
            if isinstance(r, (int, float)) and isinstance(e, (int, float)):
                return abs(r - e) <= eps
            if isinstance(r, list) and isinstance(e, list):
                if len(r) != len(e): return False
                return all(float_compare(r[i], e[i], eps) for i in range(len(r)))
            return r == e

        def unordered_compare(r, e):
            if not isinstance(r, list) or not isinstance(e, list): return r == e
            if len(r) != len(e): return False
            try:
                rs = sorted([json.dumps(x, sort_keys=True) if isinstance(x, (dict, list)) else str(x) for x in r])
                es = sorted([json.dumps(x, sort_keys=True) if isinstance(x, (dict, list)) else str(x) for x in e])
                return rs == es
            except Exception as err:
                raise Exception("Internal Error: Failed to serialize unordered comparison data (" + str(err) + ")")

        def are_equal(r, e, strategy):
            if r == e: return True
            if r is None and e is None: return True
            if strategy in ['float', 'floating_point', 'double']:
                return float_compare(r, e, 1e-5)
            if strategy in ['unordered', 'set', 'any_order']:
                return unordered_compare(r, e)
            if isinstance(r, list) and isinstance(e, list):
                rt = trim_trailing_nulls(r)
                et = trim_trailing_nulls(e)
                if len(rt) == len(et) and rt == et: return True
            return r == e

        strategy = str(meta_data.get('return', {}).get('comparison', 'exact')).lower() if meta_data else 'exact'

        case_passed = True
        if result is None and expected is not None:
            case_passed = False
        elif not are_equal(result, expected, strategy):
            case_passed = False

        try:
            out_str = 'undefined' if result is None else (json.dumps(result) if isinstance(result, (dict, list, bool, int, float)) else str(result))
        except:
            out_str = str(result)
        try:
            exp_str = 'null' if expected is None else (json.dumps(expected) if isinstance(expected, (dict, list, bool, int, float)) else str(expected))
        except:
            exp_str = str(expected)

        case_results.append({
            'case': tc_idx + 1,
            'input': str(tc.get('input', '')),
            'output': out_str,
            'expected': exp_str,
            'passed': case_passed
        })

        if not case_passed:
            all_passed = False
            if first_failed_index == -1:
                first_failed_index = tc_idx
            if mode == 'submit':
                break

    print("${evalToken}_CASE_RESULTS_:" + json.dumps({
        'allPassed': all_passed,
        'mode': mode,
        'totalCases': len(test_cases),
        'passedCases': sum(1 for c in case_results if c['passed']),
        'firstFailedCase': (first_failed_index + 1) if first_failed_index != -1 else None,
        'caseResults': case_results
    }))

    if all_passed:
        print("${evalToken}_SUCCESS_ALL")
    elif first_failed_index != -1:
        fc = case_results[first_failed_index]
        print("${evalToken}_MISMATCH")
        print(fc['input'])
        print(fc['output'])
        print(fc['expected'])
except Exception as e:
    import traceback
    print("${evalToken}_RUNTIME_ERROR\\n" + traceback.format_exc())
    sys.exit(0)
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

module.exports = PythonDriver;
