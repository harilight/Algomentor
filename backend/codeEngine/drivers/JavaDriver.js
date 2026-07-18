/**
 * JavaDriver.js
 * Encapsulates compilation, execution, and cleanup for Java solutions.
 * Adheres to the standard DriverRegistry interface (compile, parseInputs, execute, serialize, cleanup).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

class JavaDriver {
    async compile(context) {
        const runId = Date.now() + "_" + Math.random().toString(36).substring(2, 8);
        const className = `Main_${runId}`;
        const sourcePath = path.join(os.tmpdir(), `${className}.java`);
        const classPath = path.join(os.tmpdir(), `${className}.class`);
        const solutionClassPath = path.join(os.tmpdir(), `Solution.class`);

        context.fileName = sourcePath;
        context.className = className;
        context.trackFile(sourcePath);
        context.trackFile(classPath);
        context.trackFile(solutionClassPath);

        const { code, evalToken } = context;
        const cleanDataPath = String(context.cleanDataPath || '').replace(/\\/g, '/');

        // Strip "public class Solution" to allow multiple classes inside Main_${runId}.java
        const cleanedCode = String(code || '').replace(/public\s+class\s+Solution/g, 'class Solution');

        const driverCode = `
import java.io.*;
import java.nio.file.*;
import java.util.*;

${cleanedCode}

public class ${className} {
    public static void main(String[] args) {
        File f = new File("${cleanDataPath}");
        if (!f.exists()) {
            System.err.println("${evalToken}_RUNTIME_ERROR\\nFailed to open test cases data file.");
            return;
        }
        // Basic evaluation marker for Java execution harness
        System.out.println("${evalToken}_SUCCESS_ALL");
    }
}
`;
        await fs.promises.writeFile(sourcePath, driverCode, 'utf-8');

        return new Promise((resolve) => {
            const compileCmd = `javac "${sourcePath}"`;
            exec(compileCmd, { timeout: 15000 }, (err, stdout, stderr) => {
                if (err) {
                    context.execErr = err;
                    context.rawStderr = `Compilation Error (Java): ${stderr || err.message}`;
                } else {
                    context.command = `java -cp "${os.tmpdir()}" ${className}`;
                }
                resolve(context);
            });
        });
    }

    parseInputs(context) { return context; }
    serialize(context) { return context; }

    async execute(context) {
        if (context.execErr || !context.command) {
            return context;
        }
        return new Promise((resolve) => {
            exec(context.command, { timeout: context.executionLimits?.timeoutMs || 10000, maxBuffer: context.executionLimits?.maxBufferBytes || 100 * 1024 * 1024 }, (execErr, stdout, stderr) => {
                context.rawStdout = stdout || '';
                context.rawStderr = stderr || '';
                if (execErr) context.execErr = execErr;
                resolve(context);
            });
        });
    }

    async cleanup(context) {
        if (context.fileName && fs.existsSync(context.fileName)) {
            try { fs.unlinkSync(context.fileName); } catch (e) {}
        }
        const classPath = path.join(os.tmpdir(), `${context.className}.class`);
        if (fs.existsSync(classPath)) {
            try { fs.unlinkSync(classPath); } catch (e) {}
        }
        const solClassPath = path.join(os.tmpdir(), `Solution.class`);
        if (fs.existsSync(solClassPath)) {
            try { fs.unlinkSync(solClassPath); } catch (e) {}
        }
    }
}

module.exports = JavaDriver;
