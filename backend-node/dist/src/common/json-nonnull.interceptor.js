"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonNonNullInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const db_saver_service_1 = require("./db-saver.service");
let JsonNonNullInterceptor = class JsonNonNullInterceptor {
    dbSaver;
    constructor(dbSaver) {
        this.dbSaver = dbSaver;
    }
    intercept(context, next) {
        const metodo = context.switchToHttp().getRequest().method;
        if (metodo !== 'GET') {
            this.dbSaver.marcarSucia();
        }
        return next.handle().pipe((0, operators_1.map)((data) => stripNulls(data)));
    }
};
exports.JsonNonNullInterceptor = JsonNonNullInterceptor;
exports.JsonNonNullInterceptor = JsonNonNullInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [db_saver_service_1.DbSaverService])
], JsonNonNullInterceptor);
function stripNulls(data) {
    if (data == null || Buffer.isBuffer(data)) {
        return data;
    }
    return JSON.parse(JSON.stringify(data, (_key, value) => (value === null ? undefined : value)));
}
//# sourceMappingURL=json-nonnull.interceptor.js.map