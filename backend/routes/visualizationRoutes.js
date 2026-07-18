const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { trackTempFile, cleanupTempFile } = require('../visualizationEngine/tempFileManager');

// ==========================================================
// VISUALIZATION ENGINE PROXY & AUTO-LAUNCH ROUTE (ALGOMENTOR)
// ==========================================================
router.post(['/trace', '/api/trace', '/api/visualize/trace', '/api/problems/trace'], async (req, res) => {
    const payload = req.body || {};
    let parsedArgs = [];

    if (Array.isArray(payload.args)) {
        parsedArgs = payload.args;
    } else if (typeof payload.args === 'string' && payload.args.trim() !== '') {
        const raw = payload.args.trim();
        try {
            parsedArgs = JSON.parse(`[${raw}]`);
        } catch (e) {
            const results = [];
            let current = '';
            let depth = 0;
            let inString = false;
            let stringChar = '';

            for (let i = 0; i < raw.length; i++) {
                const char = raw[i];
                if (inString) {
                    current += char;
                    if (char === stringChar && raw[i - 1] !== '\\') inString = false;
                } else if (char === '"' || char === "'") {
                    inString = true;
                    stringChar = char;
                    current += char;
                } else if (char === '[' || char === '{' || char === '(') {
                    depth++;
                    current += char;
                } else if (char === ']' || char === '}' || char === ')') {
                    depth--;
                    current += char;
                } else if (char === ',' && depth === 0) {
                    if (current.trim()) results.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            if (current.trim()) results.push(current.trim());
            parsedArgs = results.map(s => !isNaN(Number(s)) && s !== '' ? Number(s) : s);
        }
    }

    const normalizedPayload = {
        code: payload.code || '',
        function_name: payload.function_name || payload.func_name || 'two_sum',
        args: parsedArgs
    };

    const tempTraceFile = path.join(__dirname, `../visualizationEngine/temp_trace_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
    trackTempFile(tempTraceFile);

    try {
        fs.writeFileSync(tempTraceFile, JSON.stringify(normalizedPayload), 'utf-8');
        const traceEnginePath = path.join(__dirname, '../visualizationEngine/trace_engine.py');

        exec(`python "${traceEnginePath}" "${tempTraceFile}"`, { timeout: 5000 }, (err, stdout, stderr) => {
            cleanupTempFile(tempTraceFile);

            if (err && !stdout) {
                return res.status(500).json({
                    success: false,
                    status: 'error',
                    error_type: 'ExecutionError',
                    detail: stderr || err.message,
                    message: stderr || err.message
                });
            }

            try {
                const result = JSON.parse(stdout.trim());
                return res.json(result);
            } catch (parseErr) {
                return res.status(500).json({
                    success: false,
                    status: 'error',
                    error_type: 'ParseError',
                    detail: 'Failed to parse JSON output from trace engine: ' + (stdout || stderr),
                    message: 'Failed to parse JSON output from trace engine'
                });
            }
        });
    } catch (writeErr) {
        cleanupTempFile(tempTraceFile);
        return res.status(500).json({
            success: false,
            status: 'error',
            error_type: 'ServerError',
            detail: 'Failed to prepare trace payload: ' + writeErr.message,
            message: 'Failed to prepare trace payload: ' + writeErr.message
        });
    }
});

module.exports = router;
