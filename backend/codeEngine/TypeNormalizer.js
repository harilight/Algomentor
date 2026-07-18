/**
 * TypeNormalizer.js
 * Normalizes all LeetCode / AlgoMaster type annotations and aliases into uniform standard keys.
 * Ensures parsers and serializers never do ad-hoc string comparisons.
 */
function normalizeType(rawType) {
    if (!rawType) return 'unknown';
    const clean = String(rawType).toLowerCase().trim().replace(/\s+/g, '').replace(/<.+>/g, (match) => {
        // e.g. optional<treenode> -> treenode, list<listnode> -> list[listnode]
        if (match.startsWith('<') && match.endsWith('>')) {
            const inner = match.slice(1, -1);
            if (rawType.toLowerCase().startsWith('optional')) return inner;
            if (rawType.toLowerCase().startsWith('list') || rawType.toLowerCase().startsWith('vector')) return `list[${inner}]`;
        }
        return match;
    }).replace(/\?$/g, '').replace(/^optional\[(.+)\]$/i, '$1');

    // Exact alias mapping table
    if (['treenode', 'binarytreenode', 'optional<treenode>', 'treenode?', 'optional[treenode]'].includes(clean)) return 'TreeNode';
    if (['listnode', 'linkedlistnode', 'optional<listnode>', 'listnode?', 'optional[listnode]'].includes(clean)) return 'ListNode';
    if (['graphnode', 'node(graph)', 'undirectedgraphnode'].includes(clean)) return 'GraphNode';
    if (['narynode', 'narytreenode', 'node(nary)'].includes(clean)) return 'NaryNode';
    if (['randomnode', 'node(random)', 'randomlinkedlistnode'].includes(clean)) return 'RandomNode';

    // Array / List alias mappings
    if (['list[listnode]', 'listnode[]', 'array<listnode>', 'vector<listnode*>', 'list[listnode*]', 'list[optional[listnode]]'].includes(clean)) return 'List[ListNode]';
    if (['list[treenode]', 'treenode[]', 'array<treenode>', 'vector<treenode*>', 'list[treenode*]', 'list[optional[treenode]]'].includes(clean)) return 'List[TreeNode]';
    if (['int[][]', 'list[list[int]]', 'list[list[integer]]', 'vector<vector<int>>', 'number[][]', 'matrix'].includes(clean)) return 'int[][]';
    if (['char[][]', 'list[list[str]]', 'list[list[character]]', 'vector<vector<char>>', 'string[][]'].includes(clean)) return 'char[][]';
    if (['int[]', 'list[int]', 'list[integer]', 'vector<int>', 'number[]'].includes(clean)) return 'int[]';
    if (['string[]', 'list[str]', 'list[string]', 'vector<string>'].includes(clean)) return 'string[]';
    if (['bool[]', 'list[bool]', 'list[boolean]', 'vector<bool>', 'boolean[]'].includes(clean)) return 'bool[]';
    if (['string', 'str'].includes(clean)) return 'string';
    if (['int', 'integer', 'number', 'long'].includes(clean)) return 'int';
    if (['float', 'double'].includes(clean)) return 'float';
    if (['bool', 'boolean'].includes(clean)) return 'bool';
    if (['void', 'none', 'nonetype'].includes(clean)) return 'void';

    return rawType;
}

module.exports = { normalizeType };
