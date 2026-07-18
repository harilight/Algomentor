/**
 * ExecutionContext.js
 * Encapsulates the entire execution state for a problem run.
 * Passes cleanly through the pipeline without polluting global or local function scopes.
 */
class ExecutionContext {
    constructor({
        runId = null,
        problemId = null,
        language = '',
        code = '',
        methodName = '',
        testCases = [],
        metadata = null,
        mode = 'run',
        workingDirectory = '',
        executionLimits = {}
    } = {}) {
        this.runId = runId || `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        this.problemId = problemId;
        this.language = String(language).toLowerCase().trim();
        this.code = code;
        this.methodName = methodName;
        this.testCases = testCases;
        this.metadata = metadata || {};
        this.mode = mode || 'run';
        this.workingDirectory = workingDirectory;
        this.executionLimits = {
            timeoutMs: executionLimits.timeoutMs || 10000,
            maxBufferBytes: executionLimits.maxBufferBytes || 100 * 1024 * 1024,
            stackSizeBytes: executionLimits.stackSizeBytes || 65536
        };

        // Populated dynamically during execution flow
        this.temporaryFiles = [];
        this.driver = null;
        this.evalToken = `__ALGOMASTER_EVAL_${this.runId}__`;
        this.runtimeMetrics = null;
        this.verdict = null;
    }

    trackFile(filePath) {
        if (filePath && !this.temporaryFiles.includes(filePath)) {
            this.temporaryFiles.push(filePath);
        }
    }
}

module.exports = ExecutionContext;
