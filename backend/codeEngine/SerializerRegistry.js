/**
 * SerializerRegistry.js
 * Centralized registry for data structure serializers.
 * Maps normalized types (or runtime objects) back into standard JSON-compatible formats.
 */
class SerializerRegistry {
    static get(normalizedType) {
        return SerializerRegistry.serializers[normalizedType] || null;
    }

    static register(normalizedType, serializerFunc) {
        SerializerRegistry.serializers[normalizedType] = serializerFunc;
    }
}

SerializerRegistry.serializers = {
    'TreeNode': (node) => {
        return node;
    },
    'ListNode': (node) => {
        return node;
    },
    'GraphNode': (node) => {
        return node;
    },
    'NaryNode': (node) => {
        return node;
    }
};

module.exports = SerializerRegistry;
