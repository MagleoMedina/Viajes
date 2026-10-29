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
exports.ViajeController = exports.ViajeRequest = exports.GastoRequest = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const gasto_entity_1 = require("../domain/gasto.entity");
const recorrido_entity_1 = require("../domain/recorrido.entity");
const viaje_entity_1 = require("../domain/viaje.entity");
const chofer_repository_1 = require("../repo/chofer.repository");
const empresa_repository_1 = require("../repo/empresa.repository");
const punto_repository_1 = require("../repo/punto.repository");
const recorrido_repository_1 = require("../repo/recorrido.repository");
const tasa_repository_1 = require("../repo/tasa.repository");
const vehiculo_repository_1 = require("../repo/vehiculo.repository");
const viaje_repository_1 = require("../repo/viaje.repository");
const stock_gasoil_service_1 = require("../service/stock-gasoil.service");
const serialize_1 = require("../common/serialize");
const dates_1 = require("../common/dates");
const api_exception_1 = require("./api-exception");
class GastoRequest {
    monto;
    descripcion;
}
exports.GastoRequest = GastoRequest;
class ViajeRequest {
    fechaInicio;
    fechaFin;
    choferId;
    empresaId;
    carga;
    puntoSalidaId;
    puntoLlegadaId;
    vehiculoId;
    montoViaje;
    combustible;
    viaticos;
    peajes;
    pagoChofer;
    litros;
    refCombustible;
    refViaticos;
    refPeajes;
    refPagoChofer;
    gastos;
    tasa;
    recorrido;
}
exports.ViajeRequest = ViajeRequest;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'La fecha de inicio es obligatoria' }),
    __metadata("design:type", String)
], ViajeRequest.prototype, "fechaInicio", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'La fecha de finalizacion es obligatoria' }),
    __metadata("design:type", String)
], ViajeRequest.prototype, "fechaFin", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El chofer es obligatorio' }),
    __metadata("design:type", Number)
], ViajeRequest.prototype, "choferId", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'La empresa es obligatoria' }),
    __metadata("design:type", Number)
], ViajeRequest.prototype, "empresaId", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'La carga es obligatoria' }),
    __metadata("design:type", String)
], ViajeRequest.prototype, "carga", void 0);
const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;
let ViajeController = class ViajeController {
    repo;
    choferRepo;
    empresaRepo;
    puntoRepo;
    tasaRepo;
    recorridoRepo;
    vehiculoRepo;
    stockGasoil;
    gastoRepo;
    constructor(repo, choferRepo, empresaRepo, puntoRepo, tasaRepo, recorridoRepo, vehiculoRepo, stockGasoil, gastoRepo) {
        this.repo = repo;
        this.choferRepo = choferRepo;
        this.empresaRepo = empresaRepo;
        this.puntoRepo = puntoRepo;
        this.tasaRepo = tasaRepo;
        this.recorridoRepo = recorridoRepo;
        this.vehiculoRepo = vehiculoRepo;
        this.stockGasoil = stockGasoil;
        this.gastoRepo = gastoRepo;
    }
    listar(empresaId, vehiculoId, desde, hasta) {
        this.validarFechas(desde, hasta);
        return this.repo
            .buscar(empresaId ? Number(empresaId) : null, vehiculoId ? Number(vehiculoId) : null, desde, hasta)
            .then((lista) => lista.map(serialize_1.viajeJson));
    }
    crear(req) {
        const viaje = new viaje_entity_1.Viaje();
        return this.guardar(viaje, req).then(serialize_1.viajeJson);
    }
    actualizar(id, req) {
        return this.repo.findById(id).then((viaje) => {
            if (!viaje)
                throw new api_exception_1.ApiException(404, 'Viaje no encontrado');
            return this.guardar(viaje, req).then(serialize_1.viajeJson);
        });
    }
    async eliminar(id) {
        if (!(await this.repo.existsById(id))) {
            throw new api_exception_1.ApiException(404, 'Viaje no encontrado');
        }
        await this.gastoRepo
            .createQueryBuilder()
            .delete()
            .where('viaje_id = :id', { id })
            .execute();
        await this.repo.deleteById(id);
    }
    validarFechas(desde, hasta) {
        for (const f of [desde, hasta]) {
            if (f && !ISO_DIA.test(f)) {
                throw new api_exception_1.ApiException(400, 'Fecha invalida: se espera YYYY-MM-DD');
            }
        }
    }
    guardarRecorrido(recorrido) {
        if (!recorrido || !recorrido.trim())
            return;
        const nombre = recorrido.trim();
        return this.recorridoRepo.existsByNombreIgnoreCase(nombre).then((existe) => {
            if (existe)
                return;
            const nuevo = new recorrido_entity_1.Recorrido();
            nuevo.nombre = nombre;
            return this.recorridoRepo.save(nuevo);
        });
    }
    async guardar(viaje, req) {
        if (req.fechaFin < req.fechaInicio) {
            throw new api_exception_1.ApiException(400, 'La fecha de finalizacion no puede ser anterior a la de inicio');
        }
        const chofer = await this.choferRepo.findById(req.choferId);
        if (!chofer)
            throw new api_exception_1.ApiException(404, 'Chofer no encontrado');
        viaje.fechaInicio = new Date((0, dates_1.dateOnlyToMillis)(req.fechaInicio));
        viaje.fechaFin = new Date((0, dates_1.dateOnlyToMillis)(req.fechaFin));
        viaje.chofer = chofer;
        viaje.empresa = await this.empresa(req.empresaId);
        viaje.carga = req.carga.trim();
        viaje.recorrido = req.recorrido ? req.recorrido.trim() : null;
        await this.guardarRecorrido(viaje.recorrido ?? '');
        viaje.puntoSalida = await this.punto(req.puntoSalidaId);
        viaje.puntoLlegada = await this.punto(req.puntoLlegadaId);
        viaje.vehiculo = await this.vehiculo(req.vehiculoId);
        viaje.montoViaje = cero(req.montoViaje);
        viaje.combustible = cero(req.combustible);
        viaje.viaticos = cero(req.viaticos);
        viaje.peajes = cero(req.peajes);
        viaje.pagoChofer = cero(req.pagoChofer);
        viaje.litros = cero(req.litros);
        viaje.refCombustible = referencia(req.refCombustible);
        viaje.refViaticos = referencia(req.refViaticos);
        viaje.refPeajes = referencia(req.refPeajes);
        viaje.refPagoChofer = referencia(req.refPagoChofer);
        viaje.tasa = cero(req.tasa);
        if ((viaje.litros ?? 0) > 0) {
            const stock = await this.stockGasoil.global(viaje.id ?? null);
            if ((viaje.litros ?? 0) > stock.disponible) {
                throw new api_exception_1.ApiException(400, `Litros exceden el gasoil disponible (disponible: ${Math.max(0, stock.disponible)} L)`);
            }
        }
        const plan = [];
        let gastosVarios = 0;
        if (req.gastos) {
            for (const g of req.gastos) {
                if (!g || g.monto == null || g.monto <= 0)
                    continue;
                if (g.descripcion == null || !g.descripcion.trim()) {
                    throw new api_exception_1.ApiException(400, 'Cada gasto varios necesita una descripcion');
                }
                plan.push({ monto: g.monto, descripcion: g.descripcion.trim() });
                gastosVarios += g.monto;
            }
        }
        const tasa = viaje.tasa ?? 0;
        const montoBs = tasa === 0 ? 0 : Math.round((viaje.montoViaje ?? 0) * tasa);
        const gastos = (viaje.combustible ?? 0) +
            (viaje.viaticos ?? 0) +
            (viaje.peajes ?? 0) +
            (viaje.pagoChofer ?? 0) +
            gastosVarios;
        const totalBs = montoBs - gastos;
        viaje.totalBs = totalBs;
        viaje.totalUsd = totalBs === 0 || tasa === 0 ? 0 : (0, dates_1.round2)(totalBs / tasa);
        const guardado = await this.repo.save(viaje);
        await this.gastoRepo
            .createQueryBuilder()
            .delete()
            .where('viaje_id = :id', { id: guardado.id })
            .execute();
        for (const g of plan) {
            const gasto = new gasto_entity_1.Gasto();
            gasto.viaje = guardado;
            gasto.monto = g.monto;
            gasto.descripcion = g.descripcion;
            await this.gastoRepo.insert(gasto);
        }
        guardado.gastos = await this.gastoRepo.find({
            where: { viaje: { id: guardado.id } },
            order: { id: 'ASC' },
        });
        return guardado;
    }
    async punto(id) {
        if (id == null)
            return null;
        const punto = await this.puntoRepo.findById(id);
        if (!punto)
            throw new api_exception_1.ApiException(404, 'Punto no encontrado');
        return punto;
    }
    async vehiculo(id) {
        if (id == null)
            return null;
        const vehiculo = await this.vehiculoRepo.findById(id);
        if (!vehiculo)
            throw new api_exception_1.ApiException(404, 'Vehiculo no encontrado');
        return vehiculo;
    }
    async empresa(id) {
        const empresa = await this.empresaRepo.findById(id);
        if (!empresa)
            throw new api_exception_1.ApiException(404, 'Empresa no encontrada');
        return empresa;
    }
};
exports.ViajeController = ViajeController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('empresaId')),
    __param(1, (0, common_1.Query)('vehiculoId')),
    __param(2, (0, common_1.Query)('desde')),
    __param(3, (0, common_1.Query)('hasta')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], ViajeController.prototype, "listar", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ViajeRequest]),
    __metadata("design:returntype", void 0)
], ViajeController.prototype, "crear", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, ViajeRequest]),
    __metadata("design:returntype", void 0)
], ViajeController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ViajeController.prototype, "eliminar", null);
exports.ViajeController = ViajeController = __decorate([
    (0, common_1.Controller)('api/viajes'),
    __param(8, (0, typeorm_1.InjectRepository)(gasto_entity_1.Gasto)),
    __metadata("design:paramtypes", [viaje_repository_1.ViajeRepository,
        chofer_repository_1.ChoferRepository,
        empresa_repository_1.EmpresaRepository,
        punto_repository_1.PuntoRepository,
        tasa_repository_1.TasaRepository,
        recorrido_repository_1.RecorridoRepository,
        vehiculo_repository_1.VehiculoRepository,
        stock_gasoil_service_1.StockGasoilService,
        typeorm_2.Repository])
], ViajeController);
const cero = (valor) => (valor == null ? 0 : valor);
const referencia = (valor) => {
    const texto = valor == null ? '' : String(valor).trim();
    return texto === '' ? '0' : texto;
};
//# sourceMappingURL=viajes.controller.js.map