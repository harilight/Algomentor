/**
 * ComparatorRegistry.js
 * Exposes specialized comparison strategies: exact JSON comparison, floating point epsilon tolerance,
 * and order-insensitive collection comparisons.
 */
class ComparatorRegistry {
    static get(strategyName = 'exact') {
        const lower = String(strategyName).toLowerCase().trim();
        if (lower === 'float' || lower === 'floating_point' || lower === 'double') return ComparatorRegistry.floatCompare;
        if (lower === 'unordered' || lower === 'set' || lower === 'any_order') return ComparatorRegistry.unorderedCompare;
        return ComparatorRegistry.exactCompare;
    }

    static compare(result, expected, strategy = 'exact', epsilon = 1e-5) {
        if (result === undefined && expected === undefined) return true;
        if (result === null && expected === null) return true;
        if (result === undefined || result === null) {
            if (Array.isArray(expected) && expected.length === 0) return true;
            return false;
        }
        if (expected === undefined || expected === null) {
            if (Array.isArray(result) && result.length === 0) return true;
            return false;
        }

        const compFunc = ComparatorRegistry.get(strategy);
        if (strategy === 'float' || strategy === 'floating_point' || strategy === 'double') {
            return compFunc(result, expected, epsilon);
        }
        return compFunc(result, expected);
    }

    static trimTrailingNulls(arr) {
        if (!Array.isArray(arr)) return arr;
        let copy = arr.slice();
        while (copy.length > 0 && (copy[copy.length - 1] === null || copy[copy.length - 1] === undefined)) {
            copy.pop();
        }
        return copy;
    }

    static exactCompare(result, expected) {
        if (result === expected) return true;
        if (Array.isArray(result) && Array.isArray(expected)) {
            let rTrim = ComparatorRegistry.trimTrailingNulls(result);
            let eTrim = ComparatorRegistry.trimTrailingNulls(expected);
            if (rTrim.length === eTrim.length) {
                let allMatch = true;
                for (let i = 0; i < rTrim.length; i++) {
                    if (!ComparatorRegistry.exactCompare(rTrim[i], eTrim[i])) {
                        allMatch = false;
                        break;
                    }
                }
                if (allMatch) return true;
            }
        }
        try {
            return JSON.stringify(result) === JSON.stringify(expected);
        } catch (e) {
            throw new Error(`Internal Error: Failed to serialize comparison data (${e.message})`);
        }
    }

    static floatCompare(result, expected, epsilon = 1e-5) {
        if (typeof result === 'number' && typeof expected === 'number') {
            return Math.abs(result - expected) <= epsilon;
        }
        if (Array.isArray(result) && Array.isArray(expected)) {
            if (result.length !== expected.length) return false;
            for (let i = 0; i < result.length; i++) {
                if (!ComparatorRegistry.floatCompare(result[i], expected[i], epsilon)) return false;
            }
            return true;
        }
        if (typeof result === 'object' && result !== null && typeof expected === 'object' && expected !== null) {
            const keysR = Object.keys(result);
            const keysE = Object.keys(expected);
            if (keysR.length !== keysE.length) return false;
            for (let k of keysR) {
                if (!keysE.includes(k) || !ComparatorRegistry.floatCompare(result[k], expected[k], epsilon)) return false;
            }
            return true;
        }
        return ComparatorRegistry.exactCompare(result, expected);
    }

    static unorderedCompare(result, expected) {
        if (!Array.isArray(result) || !Array.isArray(expected)) {
            return ComparatorRegistry.exactCompare(result, expected);
        }
        if (result.length !== expected.length) return false;
        try {
            const rSorted = result.map(x => typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x)).sort();
            const eSorted = expected.map(x => typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x)).sort();
            for (let i = 0; i < rSorted.length; i++) {
                if (rSorted[i] !== eSorted[i]) return false;
            }
            return true;
        } catch (e) {
            throw new Error(`Internal Error: Failed to serialize unordered comparison data (${e.message})`);
        }
    }
}

module.exports = ComparatorRegistry;
