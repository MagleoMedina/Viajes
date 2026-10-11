"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.epochMs = void 0;
exports.epochMs = {
    to: (value) => value instanceof Date ? value.getTime() : value,
    from: (value) => value == null ? null : new Date(value),
};
//# sourceMappingURL=epoch.transformer.js.map