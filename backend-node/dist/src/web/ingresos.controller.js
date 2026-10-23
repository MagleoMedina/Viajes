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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngresoController = exports.IngresoRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const ingreso_entity_1 = require("../domain/ingreso.entity");
const empresa_repository_1 = require("../repo/empresa.repository");
const ingreso_repository_1 = require("../repo/ingreso.repository");
const serialize_1 = require("../common/serialize");
const dates_1 = require("../common/dates");
const api_exception_1 = require("./api-exception");
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
class IngresoRequest {
    empresaId;
    fecha;
    condicionesPago;
    descripcion;
    cantidad;
    tasa;
    facturaNum;
    iva;
    montoDivisa;
    montoBs;
}
exports.IngresoRequest = IngresoRequest;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)({ message: 'La empresa es obligatoria' }),
    __metadata("design:type", Number)
], IngresoRequest.prototype, "empresaId", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'La fecha es obligatoria' }),
    __metadata("design:type", String)
], IngresoRequest.prototype, "fecha", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100, { message: 'Las condiciones de pago admiten hasta 100 caracteres' }),
    __metadata("design:type", String)
], IngresoRequest.prototype, "condicionesPago", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200, { message: 'La descripción admite hasta 200 caracteres' }),
    __metadata("design:type", String)
], IngresoRequest.prototype, "descripcion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'La cantidad debe ser numérica' }),
    __metadata("design:type", Number)
], IngresoRequest.prototype, "cantidad", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'La tasa debe ser numérica' }),
    __metadata("design:type", Number)
], IngresoRequest.prototype, "tasa", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)({ message: 'La factura debe ser un número entero' }),
    __metadata("design:type", Number)
], IngresoRequest.prototype, "facturaNum", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'El IVA debe ser numérico' }),
    __metadata("design:type", Number)
], IngresoRequest.prototype, "iva", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'El monto en divisas debe ser numérico' }),
    __metadata("design:type", Number)
], IngresoRequest.prototype, "montoDivisa", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'El monto en Bs debe ser numérico' }),
    __metadata("design:type", Number)
], IngresoRequest.prototype, "montoBs", void 0);
let IngresoController = class IngresoController {
    repo;
    empresas;
    constructor(repo, empresas) {
        this.repo = repo;
        this.empresas = empresas;
    }
    listar(empresaId, desde, hasta) {
        const id = empresaId ? Number(empresaId) : null;
        this.validarRango(desde, hasta);
        return this.repo.buscar(id, desde, hasta).then((lista) => lista.map(serialize_1.ingresoJson));
    }
    async crear(req) {
        this.validarFecha(req.fecha);
        const empresa = await this.buscarEmpresa(req.empresaId, true);
        const ingreso = new ingreso_entity_1.Ingreso();
        ingreso.empresa = empresa;
        ingreso.fecha = new Date((0, dates_1.dateOnlyToMillis)(req.fecha));
        ingreso.facturaNum = await this.factura(req.facturaNum);
        this.aplicar(ingreso, req);
        return this.guardar(ingreso);
    }
    async actualizar(id, req) {
        const ingreso = await this.repo.findById(id);
        if (!ingreso)
            throw new api_exception_1.ApiException(404, 'Ingreso no encontrado');
        this.validarFecha(req.fecha);
        if (req.empresaId !== undefined) {
            ingreso.empresa = await this.buscarEmpresa(req.empresaId, true);
        }
        ingreso.fecha = new Date((0, dates_1.dateOnlyToMillis)(req.fecha));
        if (req.facturaNum !== undefined) {
            ingreso.facturaNum = await this.factura(req.facturaNum, id);
        }
        this.aplicar(ingreso, req);
        return this.guardar(ingreso);
    }
    async eliminar(id) {
        if (!(await this.repo.findById(id))) {
            throw new api_exception_1.ApiException(404, 'Ingreso no encontrado');
        }
        await this.repo.deleteById(id);
    }
    aplicar(ingreso, req) {
        if (req.condicionesPago !== undefined) {
            ingreso.condicionesPago = req.condicionesPago.trim();
        }
        if (req.descripcion !== undefined)
            ingreso.descripcion = req.descripcion.trim();
        if (req.cantidad !== undefined)
            ingreso.cantidad = this.numero(req.cantidad, 'cantidad');
        if (req.tasa !== undefined)
            ingreso.tasa = this.tasa(req.tasa);
        if (req.iva !== undefined)
            ingreso.iva = this.numero(req.iva, 'iva');
        if (req.montoDivisa !== undefined) {
            ingreso.montoDivisa = this.numero(req.montoDivisa, 'montoDivisa');
        }
        if (req.montoBs !== undefined)
            ingreso.montoBs = this.numero(req.montoBs, 'montoBs');
    }
    async guardar(ingreso) {
        try {
            return (0, serialize_1.ingresoJson)(await this.repo.save(ingreso));
        }
        catch (e) {
            if (/UNIQUE constraint failed: ingresos\.factura_num/i.test(e.message)) {
                throw new api_exception_1.ApiValidationException({
                    facturaNum: 'Ya existe una factura con ese número',
                });
            }
            throw e;
        }
    }
    async factura(valor, excluirId) {
        const n = Number(valor);
        if (valor == null || !Number.isInteger(n) || n <= 0) {
            throw new api_exception_1.ApiValidationException({
                facturaNum: 'La factura es obligatoria y debe ser un entero mayor que 0',
            });
        }
        if (await this.repo.findByFacturaNum(n, excluirId)) {
            throw new api_exception_1.ApiValidationException({
                facturaNum: 'Ya existe una factura con ese número',
            });
        }
        return n;
    }
    numero(valor, campo) {
        const n = Number(valor);
        if (!Number.isFinite(n) || n < 0) {
            throw new api_exception_1.ApiValidationException({ [campo]: 'El valor no puede ser negativo' });
        }
        return (0, dates_1.round2)(n);
    }
    tasa(valor) {
        const n = Number(valor);
        if (!Number.isFinite(n) || n < 0) {
            throw new api_exception_1.ApiValidationException({ tasa: 'El valor no puede ser negativo' });
        }
        return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
    }
    validarFecha(fecha) {
        if (!fecha || !FECHA_ISO.test(fecha)) {
            throw new api_exception_1.ApiValidationException({ fecha: 'Formato de fecha inválido (AAAA-MM-DD)' });
        }
    }
    validarRango(desde, hasta) {
        if (desde && !FECHA_ISO.test(desde)) {
            throw new api_exception_1.ApiValidationException({ desde: 'Formato de fecha inválido (AAAA-MM-DD)' });
        }
        if (hasta && !FECHA_ISO.test(hasta)) {
            throw new api_exception_1.ApiValidationException({ hasta: 'Formato de fecha inválido (AAAA-MM-DD)' });
        }
        if (desde && hasta && desde > hasta) {
            throw new api_exception_1.ApiValidationException({ desde: 'La fecha "Desde" no puede ser mayor que "Hasta"' });
        }
    }
    async buscarEmpresa(id, obligatoria) {
        if (id == null || !Number.isFinite(Number(id)) || Number(id) <= 0) {
            if (obligatoria) {
                throw new api_exception_1.ApiValidationException({ empresaId: 'La empresa es obligatoria' });
            }
            return null;
        }
        const empresa = await this.empresas.findById(Number(id));
        if (!empresa)
            throw new api_exception_1.ApiException(404, 'Empresa no encontrada');
        return empresa;
    }
};
exports.IngresoController = IngresoController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('empresaId')),
    __param(1, (0, common_1.Query)('desde')),
    __param(2, (0, common_1.Query)('hasta')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], IngresoController.prototype, "listar", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [IngresoRequest]),
    __metadata("design:returntype", Promise)
], IngresoController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, IngresoRequest]),
    __metadata("design:returntype", Promise)
], IngresoController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], IngresoController.prototype, "eliminar", null);
exports.IngresoController = IngresoController = __decorate([
    (0, common_1.Controller)('api/ingresos'),
    __metadata("design:paramtypes", [ingreso_repository_1.IngresoRepository,
        empresa_repository_1.EmpresaRepository])
], IngresoController);
//# sourceMappingURL=ingresos.controller.js.map