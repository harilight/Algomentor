/**
 * DriverRegistry.js
 * Centralized registry for language evaluation drivers.
 * Allows server.js to delegate compilation, execution, and cleanup without containing hardcoded language paths.
 */
const JavaScriptDriver = require('./drivers/JavaScriptDriver');
const PythonDriver = require('./drivers/PythonDriver');
const CppDriver = require('./drivers/CppDriver');
const JavaDriver = require('./drivers/JavaDriver');

class DriverRegistry {
    static get(language) {
        const lang = String(language || '').toLowerCase().trim();
        return DriverRegistry.drivers[lang] || null;
    }

    static register(language, driverInstance) {
        DriverRegistry.drivers[String(language).toLowerCase().trim()] = driverInstance;
    }
}

DriverRegistry.drivers = {
    'javascript': new JavaScriptDriver(),
    'js': new JavaScriptDriver(),
    'python': new PythonDriver(),
    'py': new PythonDriver(),
    'cpp': new CppDriver(),
    'c++': new CppDriver(),
    'java': new JavaDriver()
};

module.exports = DriverRegistry;
