/**
 * ErrorNormalizer.js
 * Standardizes raw error messages and exit signals across all languages into formal verdicts:
 * Compilation Error, Runtime Error, Time Limit Exceeded, Memory Limit Exceeded, Internal Error.
 */
function normalizeError(language, rawError, stderr = '') {
    const combined = String(rawError || '') + ' ' + String(stderr || '');
    const lower = combined.toLowerCase();

    if (rawError && typeof rawError === 'object') {
        if (rawError.killed || lower.includes('time limit') || lower.includes('timed out')) {
            return {
                verdict: 'Time Limit Exceeded',
                message: 'Time Limit Exceeded (TLE): Your code took too long to execute or hit an infinite loop.'
            };
        }
        if (rawError.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' || lower.includes('maxbuffer') || lower.includes('out of memory') || lower.includes('heap out of memory')) {
            return {
                verdict: 'Memory Limit Exceeded',
                message: 'Output / Memory Limit Exceeded: Your code generated too much console output or exceeded memory buffer limits.'
            };
        }
    }

    // Language specific compilation vs runtime detection
    const lang = String(language).toLowerCase().trim();
    if (lang === 'cpp' || lang === 'java') {
        if (lower.includes('error:') || lower.includes('cannot find symbol') || lower.includes('syntax error') || lower.includes('expected')) {
            return {
                verdict: 'Compilation Error',
                message: stderr || String(rawError)
            };
        }
    }

    if (lower.includes('segmentation fault') || lower.includes('nullpointerexception') || lower.includes('arrayindexoutofbounds') || lower.includes('typeerror:') || lower.includes('referenceerror:') || lower.includes('rangeerror:') || lower.includes('indexerror:') || lower.includes('recursionerror:') || lower.includes('_runtime_error')) {
        return {
            verdict: 'Runtime Error',
            message: stderr || String(rawError)
        };
    }

    return {
        verdict: 'Runtime Error',
        message: stderr || String(rawError || 'Unknown execution failure')
    };
}

module.exports = { normalizeError };
