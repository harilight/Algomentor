/**
 * RuntimeMonitor.js
 * Separates execution monitoring from core execution logic.
 * Collects timing, exit code, timeout state, and memory metrics.
 */
class RuntimeMonitor {
    constructor() {
        this.startTime = 0;
        this.endTime = 0;
        this.exitCode = null;
        this.signal = null;
        this.timedOut = false;
        this.memoryBytes = 0;
    }

    start() {
        this.startTime = process.hrtime.bigint();
    }

    stop({ exitCode = 0, signal = null, timedOut = false, memoryBytes = 0 } = {}) {
        if (this.endTime !== 0 && this.exitCode !== null) return;
        this.endTime = process.hrtime.bigint();
        this.exitCode = exitCode;
        this.signal = signal;
        this.timedOut = timedOut;
        this.memoryBytes = memoryBytes;
    }

    getMetrics() {
        const end = this.endTime !== 0 ? this.endTime : process.hrtime.bigint();
        const start = this.startTime !== 0 ? this.startTime : end;
        const durationNs = end - start;
        const durationMs = Number(durationNs) / 1e6;
        return {
            durationMs: Math.round(durationMs * 100) / 100,
            exitCode: this.exitCode !== null ? this.exitCode : 0,
            signal: this.signal,
            timedOut: this.timedOut,
            memoryBytes: this.memoryBytes
        };
    }
}

module.exports = RuntimeMonitor;
