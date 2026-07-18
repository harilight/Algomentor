/**
 * VerdictEngine.js
 * Converts execution outputs, comparison results, and normalized errors into standardized verdicts:
 * Accepted, Wrong Answer, Runtime Error, Compilation Error, Time Limit Exceeded, Memory Limit Exceeded, Internal Error.
 * Preserves exact frontend response format ({ success: true/false, output: ... }).
 */
class VerdictEngine {
    static evaluate({
        rawStdout = '',
        rawStderr = '',
        evalToken = '',
        normalizedError = null,
        runtimeMetrics = null
    } = {}) {
        const tokenIndex = evalToken ? rawStdout.indexOf(evalToken) : -1;

        // 1. If evaluation token markers are found in stdout
        if (tokenIndex !== -1) {
            let lineStart = rawStdout.lastIndexOf('\n', tokenIndex);
            const evalPortion = rawStdout.slice(lineStart === -1 ? 0 : lineStart + 1);

            if (evalPortion.includes(`${evalToken}_RUNTIME_ERROR`) || rawStdout.includes(`${evalToken}_RUNTIME_ERROR`)) {
                const marker = `${evalToken}_RUNTIME_ERROR`;
                const idx = rawStdout.indexOf(marker);
                const errorDetails = (rawStdout.slice(idx + marker.length) || '').trim().replace(/\\n/g, '\n') || rawStderr || 'Runtime execution error';
                const isInternal = errorDetails.includes('Internal Error') || (rawStderr && rawStderr.includes('Internal Error'));
                const verdict = isInternal ? 'Internal Error' : 'Runtime Error';
                return {
                    verdict,
                    response: {
                        success: false,
                        verdict,
                        error: errorDetails
                    }
                };
            }

            if (evalPortion.includes(`${evalToken}_CASE_RESULTS_:`) || rawStdout.includes(`${evalToken}_CASE_RESULTS_:`)) {
                const marker = `${evalToken}_CASE_RESULTS_:`;
                const idx = rawStdout.indexOf(marker);
                const jsonStr = (rawStdout.slice(idx + marker.length) || '').trim().split(/\r?\n/)[0];
                try {
                    const data = JSON.parse(jsonStr);
                    const verdict = data.allPassed ? 'Accepted' : 'Wrong Answer';
                    return {
                        verdict,
                        response: {
                            success: true,
                            verdict,
                            allPassed: data.allPassed,
                            mode: data.mode || 'run',
                            totalCases: data.totalCases,
                            passedCases: data.passedCases,
                            firstFailedCase: data.firstFailedCase,
                            caseResults: data.caseResults,
                            output: data.allPassed ? 'All test cases passed successfully!' : `Wrong Answer on Test Case #${data.firstFailedCase || 1}:\r\nInput: ${data.caseResults && data.firstFailedCase && data.caseResults[data.firstFailedCase - 1] ? data.caseResults[data.firstFailedCase - 1].input : ''}\r\nOutput: ${data.caseResults && data.firstFailedCase && data.caseResults[data.firstFailedCase - 1] ? data.caseResults[data.firstFailedCase - 1].output : ''}\r\nExpected: ${data.caseResults && data.firstFailedCase && data.caseResults[data.firstFailedCase - 1] ? data.caseResults[data.firstFailedCase - 1].expected : ''}`
                        }
                    };
                } catch(e) {}
            }

            if (evalPortion.includes(`${evalToken}_MISMATCH`) || rawStdout.includes(`${evalToken}_MISMATCH`)) {
                const marker = `${evalToken}_MISMATCH`;
                const idx = rawStdout.indexOf(marker);
                const mismatchDetails = (rawStdout.slice(idx + marker.length) || '').trim().replace(/\\n/g, '\n') || 'Output mismatch on test case';
                return {
                    verdict: 'Wrong Answer',
                    response: {
                        success: true,
                        verdict: 'Wrong Answer',
                        output: `Wrong Answer:\r\n${mismatchDetails}`
                    }
                };
            }

            if (evalPortion.includes(`${evalToken}_SUCCESS_ALL`) || rawStdout.includes(`${evalToken}_SUCCESS_ALL`)) {
                const marker = `${evalToken}_SUCCESS_ALL`;
                const idx = rawStdout.indexOf(marker);
                let cleanOutput = rawStdout.slice(0, idx).trim();
                if (cleanOutput.length > 65536) cleanOutput = cleanOutput.slice(0, 65536) + '\n... [output truncated due to large size]';
                return {
                    verdict: 'Accepted',
                    response: {
                        success: true,
                        verdict: 'Accepted',
                        output: cleanOutput ? `${cleanOutput}\r\nAll test cases passed successfully!` : 'All test cases passed successfully!'
                    }
                };
            }

            const tokenPrefix = evalToken + "_";
            const evalLines = evalPortion.split(/\r?\n/).map((l, idx) => {
                if (idx === 0) return l.trim().replace(tokenPrefix, '').replace(evalToken, '');
                return l.trim();
            });
            const outputStr = evalLines.join('\r\n');
            const verdict = outputStr.includes('SUCCESS_ALL') || outputStr.includes('Accepted') ? 'Accepted' : 'Wrong Answer';
            return {
                verdict,
                response: { success: true, verdict, output: outputStr }
            };
        }

        // 2. If evalToken was not found, check for process failure or normalized error
        if (normalizedError) {
            const isInternal = (normalizedError.message && normalizedError.message.includes('Internal Error')) || (rawStderr && rawStderr.includes('Internal Error'));
            const verdict = isInternal ? 'Internal Error' : (normalizedError.verdict || 'Runtime Error');
            return {
                verdict,
                response: {
                    success: false,
                    verdict,
                    error: `${verdict}: ${normalizedError.message}`
                }
            };
        }

        // Fallback for direct output or stdout
        let fallbackOut = rawStdout;
        if (fallbackOut.length > 65536) fallbackOut = fallbackOut.slice(0, 65536) + '\n... [output truncated due to large size]';
        return {
            verdict: 'Accepted',
            response: { success: true, verdict: 'Accepted', output: fallbackOut }
        };
    }
}

module.exports = VerdictEngine;
