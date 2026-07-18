/**
 * ParserRegistry.js
 * Centralized registry for data structure parsers and positional input extraction.
 * Maps normalized types (from TypeNormalizer) to parser logic and extracts arguments from raw test case strings.
 */
class ParserRegistry {
    static get(normalizedType) {
        return ParserRegistry.parsers[normalizedType] || null;
    }

    static register(normalizedType, parserFunc) {
        ParserRegistry.parsers[normalizedType] = parserFunc;
    }

    /**
     * Extracts positional arguments from raw LeetCode-style test case strings
     * (e.g. `s = "abc", k = 2` -> `["abc", 2]`, or `[[1,2],[3,4]]` -> `[[[1,2],[3,4]]]`).
     */
    static extractPositionalArgs(inputStr, expectedParamCount = null, metadata = null) {
        if (!inputStr && inputStr !== 0 && inputStr !== false) return [];
        let str = String(inputStr).trim();
        
        const isPrimitiveString = (idx) => {
            if (!metadata || !metadata.params || !metadata.params[idx]) return false;
            const t = String(metadata.params[idx].type || '').toLowerCase().trim();
            return ['string', 'str', 'char', 'character'].includes(t);
        };

        const isStringOrStringArrayType = (idx) => {
            if (!metadata || !metadata.params || !metadata.params[idx]) return false;
            const t = String(metadata.params[idx].type || '').toLowerCase().trim().replace(/\s+/g, '');
            return ['string', 'str', 'char', 'character', 'string[]', 'list[str]', 'list[string]', 'vector<string>', 'char[][]', 'list[list[str]]', 'list[list[character]]', 'vector<vector<char>>', 'string[][]', 'char[]', 'list[char]', 'character[]'].includes(t) || t.includes('string') || t.includes('str') || t.includes('char');
        };

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
            for (let i = 0; i < s.length; i++) {
                let ch = s[i];
                if (inDouble) {
                    out += ch;
                    if (ch === '"' && (i === 0 || s[i-1] !== '\\' || (i >= 2 && s[i-1] === '\\' && s[i-2] === '\\'))) {
                        inDouble = false;
                    }
                } else if (inSingle) {
                    if (ch === "'" && (i === 0 || s[i-1] !== '\\' || (i >= 2 && s[i-1] === '\\' && s[i-2] === '\\'))) {
                        inSingle = false;
                        out += '"';
                    } else if (ch === '"') {
                        out += '\\"';
                    } else if (ch === '\\' && i + 1 < s.length && s[i+1] === "'") {
                        out += "'";
                        i++;
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

        // 🛡️ 1. DETECT AND STRIP IF IT'S A SINGLE VARIABLE ASSIGNMENT
        if (expectedParamCount === 1) {
            str = str.replace(/^['"]?[a-zA-Z0-9_]+['"]?\s*[:=]\s*/, '').trim();
            if (isPrimitiveString(0)) {
                if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
                    try {
                        let inner = JSON.parse(str);
                        if (typeof inner === 'string') return [inner];
                    } catch (e) {
                        if (str.startsWith("'") && str.endsWith("'")) {
                            return [str.slice(1, -1).replace(/\\'/g, "'")];
                        }
                        return [str.slice(1, -1)];
                    }
                }
                return [str];
            }
        }
        
        if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
            try {
                let inner = JSON.parse(str);
                if (typeof inner === 'string' && (inner.trim().startsWith('[') || inner.trim().startsWith('{') || /^['"]?[a-zA-Z0-9_]+['"]?\s*[:=]\s*/.test(inner.trim()))) {
                    str = inner.trim();
                    if (expectedParamCount === 1) {
                        str = str.replace(/^['"]?[a-zA-Z0-9_]+['"]?\s*[:=]\s*/, '').trim();
                    }
                }
            } catch (e) {}
        }
        
        // Try direct JSON parse of the entire string first before unescaping loops!
        try {
            let parsed = JSON.parse(str);
            if (expectedParamCount === 1) {
                if (Array.isArray(parsed) && parsed.length === 1 && Array.isArray(parsed[0]) && (Array.isArray(parsed[0][0]) || typeof parsed[0][0] === 'object')) {
                    return parsed;
                }
                return [parsed];
            }
            if (Array.isArray(parsed)) {
                if (expectedParamCount && parsed.length === expectedParamCount && expectedParamCount > 1) {
                    return parsed;
                }
                if (!expectedParamCount || expectedParamCount === null) {
                    return [parsed];
                }
            }
        } catch (e) {
            try {
                let parsed = JSON.parse(pythonToJSON(str));
                if (expectedParamCount === 1) {
                    if (Array.isArray(parsed) && parsed.length === 1 && Array.isArray(parsed[0]) && (Array.isArray(parsed[0][0]) || typeof parsed[0][0] === 'object')) {
                        return parsed;
                    }
                    return [parsed];
                }
                if (Array.isArray(parsed)) {
                    if (expectedParamCount && parsed.length === expectedParamCount && expectedParamCount > 1) {
                        return parsed;
                    }
                    if (!expectedParamCount || expectedParamCount === null) {
                        return [parsed];
                    }
                }
            } catch (e2) {
                if (str.includes('\\"') || str.includes("\\'")) {
                    let unescaped = str.replace(/\\+"/g, '"').replace(/\\+'/g, "'");
                    if (unescaped !== str) {
                        try {
                            let parsed = JSON.parse(unescaped);
                            if (expectedParamCount === 1) {
                                if (Array.isArray(parsed) && parsed.length === 1 && Array.isArray(parsed[0]) && (Array.isArray(parsed[0][0]) || typeof parsed[0][0] === 'object')) {
                                    return parsed;
                                }
                                return [parsed];
                            }
                            if (Array.isArray(parsed)) {
                                if (expectedParamCount && parsed.length === expectedParamCount && expectedParamCount > 1) return parsed;
                                if (!expectedParamCount || expectedParamCount === null) return [parsed];
                            }
                        } catch (e3) {
                            try {
                                let parsed = JSON.parse(pythonToJSON(unescaped));
                                if (expectedParamCount === 1) {
                                    if (Array.isArray(parsed) && parsed.length === 1 && Array.isArray(parsed[0]) && (Array.isArray(parsed[0][0]) || typeof parsed[0][0] === 'object')) {
                                        return parsed;
                                    }
                                    return [parsed];
                                }
                                if (Array.isArray(parsed)) {
                                    if (expectedParamCount && parsed.length === expectedParamCount && expectedParamCount > 1) return parsed;
                                    if (!expectedParamCount || expectedParamCount === null) return [parsed];
                                }
                            } catch (e4) {}
                        }
                    }
                }
            }
        }


        let parts = [];
        let depth = 0;
        let inQuote = false;
        let quoteChar = null;
        let curr = "";
        for (let i = 0; i < str.length; i++) {
            let ch = str[i];
            if (inQuote) {
                curr += ch;
                if (ch === quoteChar && (i === 0 || str[i-1] !== '\\' || (i >= 2 && str[i-1] === '\\' && str[i-2] === '\\'))) {
                    inQuote = false;
                }
            } else if (ch === '"' || ch === "'") {
                inQuote = true;
                quoteChar = ch;
                curr += ch;
            } else if (ch === '[' || ch === '{' || ch === '(') {
                depth++;
                curr += ch;
            } else if (ch === ']' || ch === '}' || ch === ')') {
                depth--;
                curr += ch;
            } else if ((ch === ',' || ch === '\n' || ch === '\r') && depth === 0) {
                if (curr.trim()) parts.push(curr.trim());
                curr = "";
            } else if (ch === '\\' && str[i+1] === 'n' && depth === 0) {
                if (curr.trim()) parts.push(curr.trim());
                curr = "";
                i++; // skip 'n'
            } else {
                curr += ch;
            }
        }
        if (curr.trim()) parts.push(curr.trim());

        return parts.map((part, idx) => {
            let clean = part.replace(/^['"]?[a-zA-Z0-9_]+['"]?\s*[:=]\s*/, '').trim();
            if (isPrimitiveString(idx)) {
                if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
                    try {
                        let inner = JSON.parse(clean);
                        if (typeof inner === 'string') return inner;
                    } catch (e) {
                        if (clean.startsWith("'") && clean.endsWith("'")) {
                            return clean.slice(1, -1).replace(/\\'/g, "'");
                        }
                        return clean.slice(1, -1);
                    }
                }
                return clean;
            }
            try {
                return JSON.parse(clean);
            } catch (e) {
                try {
                    if (clean.startsWith("'") && clean.endsWith("'")) {
                        let inner = clean.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"');
                        return JSON.parse('"' + inner + '"');
                    }
                    return JSON.parse(pythonToJSON(clean));
                } catch (e2) {
                    if (clean.includes('\\"') || clean.includes("\\'")) {
                        let unescaped = clean.replace(/\\+"/g, '"').replace(/\\+'/g, "'");
                        if (unescaped !== clean) {
                            try { return JSON.parse(unescaped); } catch (e3) {
                                try { return JSON.parse(pythonToJSON(unescaped)); } catch (e4) {}
                            }
                        }
                    }
                    if (clean === "True" || clean === "true") return true;
                    if (clean === "False" || clean === "false") return false;
                    if (clean === "None" || clean === "null" || clean === "undefined") return null;
                    if (!isNaN(Number(clean)) && clean !== "") return Number(clean);
                    if (!clean.startsWith('[') && !clean.startsWith('{')) {
                        return clean.replace(/^['"]|['"]$/g, '');
                    }
                    return clean;
                }
            }
        });
    }

    static extractExpectedOutput(rawOutput, metaData = null) {
        if (rawOutput === undefined || rawOutput === null) return null;
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
            for (let i = 0; i < s.length; i++) {
                let ch = s[i];
                if (inDouble) {
                    out += ch;
                    if (ch === '"' && (i === 0 || s[i-1] !== '\\' || (i >= 2 && s[i-1] === '\\' && s[i-2] === '\\'))) {
                        inDouble = false;
                    }
                } else if (inSingle) {
                    if (ch === "'" && (i === 0 || s[i-1] !== '\\' || (i >= 2 && s[i-1] === '\\' && s[i-2] === '\\'))) {
                        inSingle = false;
                        out += '"';
                    } else if (ch === '"') {
                        out += '\\"';
                    } else if (ch === '\\' && i + 1 < s.length && s[i+1] === "'") {
                        out += "'";
                        i++;
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

        let expected = rawOutput;
        for (let attempt = 0; attempt < 10; attempt++) {
            if (typeof expected !== 'string') break;
            let cleanExp = expected.trim().replace(/^['"]|['"]$/g, '');
            if (cleanExp === "True" || cleanExp === "true") { expected = true; break; }
            if (cleanExp === "False" || cleanExp === "false") { expected = false; break; }
            if (cleanExp === "None" || cleanExp === "null" || cleanExp === "undefined") { expected = null; break; }
            if (isPrimitiveString) {
                if ((expected.trim().startsWith('"') && expected.trim().endsWith('"')) || (expected.trim().startsWith("'") && expected.trim().endsWith("'"))) {
                    try {
                        let inner = JSON.parse(expected.trim());
                        if (typeof inner === 'string') { expected = inner; break; }
                    } catch(e) {
                        if (expected.trim().startsWith("'") && expected.trim().endsWith("'")) {
                            expected = expected.trim().slice(1, -1).replace(/\\'/g, "'");
                            break;
                        }
                    }
                }
                expected = cleanExp;
                break;
            }
            try {
                expected = JSON.parse(cleanExp);
            } catch (e) {
                try {
                    expected = JSON.parse(pythonToJSON(cleanExp));
                } catch (e2) {
                    if (cleanExp.includes('\\"') || cleanExp.includes("\\'")) {
                        let unescaped = cleanExp.replace(/\\+"/g, '"').replace(/\\+'/g, "'");
                        if (unescaped !== cleanExp) {
                            try { expected = JSON.parse(unescaped); break; } catch (e3) {
                                try { expected = JSON.parse(pythonToJSON(unescaped)); break; } catch (e4) {}
                            }
                        }
                    }
                    expected = cleanExp;
                    break;
                }
            }
        }
        return expected;
    }
}

ParserRegistry.parsers = {
    'TreeNode': (raw) => raw,
    'ListNode': (raw) => raw,
    'GraphNode': (raw) => raw,
    'NaryNode': (raw) => raw
};

module.exports = ParserRegistry;
