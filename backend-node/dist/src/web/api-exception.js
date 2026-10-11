"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiValidationException = exports.ApiException = void 0;
const common_1 = require("@nestjs/common");
class ApiException extends common_1.HttpException {
    constructor(status, message) {
        super(message, status);
    }
}
exports.ApiException = ApiException;
class ApiValidationException extends common_1.HttpException {
    fields;
    constructor(fields) {
        super(Object.values(fields)[0] ?? 'Datos invalidos', 400);
        this.fields = fields;
    }
}
exports.ApiValidationException = ApiValidationException;
//# sourceMappingURL=api-exception.js.map