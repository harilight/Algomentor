/**
 * engine/index.js
 * Modular Execution Pipeline entry point for AlgoMaster.
 * Coordinates all modular engine components without cluttering server.js routes.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const ExecutionContext = require('./ExecutionContext');
const DriverRegistry = require('./DriverRegistry');
const { normalizeType } = require('./TypeNormalizer');
const { normalizeError } = require('./ErrorNormalizer');
const VerdictEngine = require('./VerdictEngine');
const RuntimeMonitor = require('./RuntimeMonitor');
const ParserRegistry = require('./ParserRegistry');
const SerializerRegistry = require('./SerializerRegistry');
const ComparatorRegistry = require('./ComparatorRegistry');
const ComplexityAnalyzer = require('./ComplexityAnalyzer');

async function executePipeline({
    language = '',
    code = '',
    methodName = '',
    testCases = [],
    metadata = null,
    meta_data = null,
    cleanDataPath = '',
    problemId = null,
    mode = 'run'
} = {}) {
    metadata = metadata || meta_data;
    // Ensure test cases have raw_args populated via ParserRegistry if not already
    if (Array.isArray(testCases)) {
        testCases.forEach(tc => {
            if (tc && tc.input && (!tc.raw_args || tc.raw_args.length === 0)) {
                tc.raw_args = ParserRegistry.extractPositionalArgs(tc.input, metadata && metadata.params ? metadata.params.length : null, metadata);
            }
            if (tc && tc.output !== undefined && tc.output !== null) {
                const cleanExp = ParserRegistry.extractExpectedOutput(tc.output, metadata);
                if (cleanExp !== undefined) {
                    tc.output = cleanExp;
                }
            } else if (tc && tc.expected !== undefined && tc.expected !== null) {
                const cleanExp = ParserRegistry.extractExpectedOutput(tc.expected, metadata);
                if (cleanExp !== undefined) {
                    tc.expected = cleanExp;
                }
            }
        });
    }

    // 1. Initialize Execution Context
    const context = new ExecutionContext({
        problemId,
        language,
        code,
        methodName,
        testCases,
        metadata,
        mode
    });

    if (cleanDataPath && fs.existsSync(cleanDataPath)) {
        context.cleanDataPath = cleanDataPath;
    } else {
        const dataFileName = path.join(os.tmpdir(), `temp_data_${context.evalToken}.json`);
        context.trackFile(dataFileName);
        fs.writeFileSync(dataFileName, JSON.stringify({ testCases, meta_data: metadata || null, mode: context.mode }), 'utf-8');
        context.cleanDataPath = dataFileName.replace(/\\/g, '/');
    }

    // 2. Type Normalization check across parameters
    if (metadata && Array.isArray(metadata.params)) {
        metadata.params.forEach(p => {
            if (p && p.type) {
                p.normalizedType = normalizeType(p.type);
            }
        });
    }

    // 3. Driver Lookup from Driver Registry
    const driver = DriverRegistry.get(context.language);
    if (!driver) {
        return {
            success: false,
            error: `Selected language compiler engine (${language}) is not supported or registered in DriverRegistry.`
        };
    }
    context.driver = driver;

    // 4. Runtime Monitor start
    const monitor = new RuntimeMonitor();
    monitor.start();

    try {
        // 5. Driver Compilation & Execution
        try {
            await driver.compile(context);
            await driver.execute(context);
        } finally {
            monitor.stop({
                exitCode: context.execErr ? (context.execErr.code || 1) : 0,
                timedOut: Boolean(context.execErr && context.execErr.killed)
            });
            context.runtimeMetrics = monitor.getMetrics();
        }

        // 6. Error Normalization check
        let normalizedError = null;
        if (context.execErr || (context.rawStderr && context.rawStderr.trim().length > 0)) {
            // Only normalize if execErr occurred or rawStderr indicates real fatal exception
            if (context.execErr || context.rawStderr.toLowerCase().includes('error') || context.rawStderr.toLowerCase().includes('exception')) {
                normalizedError = normalizeError(context.language, context.execErr, context.rawStderr);
            }
        }

        // 7. Verdict Engine evaluation
        const verdictResult = VerdictEngine.evaluate({
            rawStdout: context.rawStdout,
            rawStderr: context.rawStderr,
            evalToken: context.evalToken,
            normalizedError,
            runtimeMetrics: context.runtimeMetrics
        });

        context.verdict = verdictResult.verdict;
        if (verdictResult.response && typeof verdictResult.response === 'object') {
            verdictResult.response.verdict = context.verdict;
            verdictResult.response.runtimeMetrics = context.runtimeMetrics;

            // 7b. Perform exact diagnostic Complexity Analysis
            try {
                verdictResult.response.complexityAnalysis = ComplexityAnalyzer.analyze({
                    code: context.code,
                    language: context.language,
                    verdict: context.verdict,
                    runtimeMetrics: context.runtimeMetrics,
                    testCases: verdictResult.response.caseResults || context.testCases,
                    problemMetadata: context.metadata
                });
            } catch (compErr) {
                console.error("Error running ComplexityAnalyzer:", compErr);
            }
        }
        return verdictResult.response;

    } catch (pipelineError) {
        monitor.stop({ exitCode: 1 });
        return {
            success: false,
            verdict: 'Internal Error',
            error: `Internal Engine Error: ${pipelineError.message}`
        };
    } finally {
        // 8. Driver Cleanup
        await driver.cleanup(context);
    }
}

module.exports = {
    executePipeline,
    ExecutionContext,
    DriverRegistry,
    normalizeType,
    normalizeError,
    VerdictEngine,
    RuntimeMonitor,
    ParserRegistry,
    SerializerRegistry,
    ComparatorRegistry,
    ComplexityAnalyzer
};
