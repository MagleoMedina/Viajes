"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const api_exception_1 = require("./api-exception");
const INTEGRIDAD = 'Registro en uso: otro registro lo referencia o ya existe un valor duplicado.';
const logger = new common_1.Logger('ApiExceptionFilter');
function detalleSql(error) {
    return error.driverError?.message ?? error.message;
}
function responder(res, error) {
    const detalle = detalleSql(error);
    if (/UNIQUE constraint failed:\s*ingresos\.factura_num/i.test(detalle)) {
        return res.status(common_1.HttpStatus.BAD_REQUEST).json({
            status: 400,
            message: 'Ya existe una factura con ese número',
            fields: { facturaNum: 'Ya existe una factura con ese número' },
        });
    }
    if (/UNIQUE constraint failed:\s*([^\s]+)/i.test(detalle)) {
        const [, tabla, columna] = /UNIQUE constraint failed:\s*([^\s]+?)\.([^\s]+)/i.exec(detalle) ?? [];
        return res.status(common_1.HttpStatus.CONFLICT).json({
            status: 409,
            message: `Valor duplicado en ${tabla}.${columna}`,
            fields: { [columna]: 'Ya existe un registro con ese valor' },
        });
    }
    if (/FOREIGN KEY constraint failed/i.test(detalle)) {
        return res.status(common_1.HttpStatus.CONFLICT).json({
            status: 409,
            message: INTEGRIDAD,
        });
    }
    logger.error(`Fallo de base de datos: ${detalle}`);
    return res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: 500,
        message: `Error de base de datos: ${detalle}`,
    });
}
let ApiExceptionFilter = class ApiExceptionFilter {
    catch(exception, host) {
        const res = host.switchToHttp().getResponse();
        if (exception instanceof api_exception_1.ApiValidationException) {
            const message = Object.values(exception.fields)[0] ?? 'Datos invalidos';
            return res
                .status(common_1.HttpStatus.BAD_REQUEST)
                .json({ status: 400, message, fields: exception.fields });
        }
        if (exception instanceof api_exception_1.ApiException) {
            const status = exception.getStatus();
            return res.status(status).json({ status, message: exception.message });
        }
        if (exception instanceof typeorm_1.QueryFailedError) {
            return responder(res, exception);
        }
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const response = exception.getResponse();
            const raw = typeof response === 'string'
                ? response
                : (response.message ?? exception.message);
            const message = Array.isArray(raw) ? raw[0] : raw;
            return res.status(status).json({ status, message });
        }
        const message = exception instanceof Error ? exception.message : 'Error interno';
        return res
            .status(common_1.HttpStatus.INTERNAL_SERVER_ERROR)
            .json({ status: 500, message });
    }
};
exports.ApiExceptionFilter = ApiExceptionFilter;
exports.ApiExceptionFilter = ApiExceptionFilter = __decorate([
    (0, common_1.Catch)()
], ApiExceptionFilter);
//# sourceMappingURL=api-exception.filter.js.map