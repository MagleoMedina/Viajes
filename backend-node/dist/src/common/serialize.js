"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.choferJson = choferJson;
exports.empresaJson = empresaJson;
exports.puntoJson = puntoJson;
exports.recorridoJson = recorridoJson;
exports.vehiculoJson = vehiculoJson;
exports.tasaJson = tasaJson;
exports.gastoJson = gastoJson;
exports.tituloGastoJson = tituloGastoJson;
exports.gastoVarioJson = gastoVarioJson;
exports.tituloImpuestoJson = tituloImpuestoJson;
exports.gastoImpuestoJson = gastoImpuestoJson;
exports.gastoGasoilJson = gastoGasoilJson;
exports.viajeJson = viajeJson;
const dates_1 = require("./dates");
const num = (value) => value == null ? undefined : Number(value);
const text = (value) => value == null ? undefined : value;
function choferJson(c) {
    return {
        id: c.id,
        nombre: text(c.nombre),
        apellido: text(c.apellido),
        cedula: text(c.cedula),
    };
}
function empresaJson(e) {
    return { id: e.id, nombre: text(e.nombre), direccion: text(e.direccion) };
}
function puntoJson(p) {
    return { id: p.id, nombre: text(p.nombre) };
}
function recorridoJson(r) {
    return { id: r.id, nombre: text(r.nombre) };
}
function vehiculoJson(v) {
    return {
        id: v.id,
        marca: text(v.marca),
        modelo: text(v.modelo),
        tipo: text(v.tipo),
        placa: text(v.placa),
    };
}
function tasaJson(t) {
    return {
        id: t.id,
        valor: num(t.valor),
        fecha: t.fecha == null ? undefined : (0, dates_1.toIsoDateTime)(t.fecha),
        origen: text(t.origen),
    };
}
function gastoJson(g) {
    return {
        id: g.id,
        monto: num(g.monto),
        descripcion: text(g.descripcion),
    };
}
function tituloGastoJson(t) {
    return { id: t.id, nombre: text(t.nombre) };
}
function gastoVarioJson(g) {
    return {
        id: g.id,
        tituloGasto: g.tituloGasto ? tituloGastoJson(g.tituloGasto) : undefined,
        fecha: g.fecha == null ? undefined : (0, dates_1.toIsoDate)(g.fecha),
        numero: text(g.numero),
        motivo: text(g.motivo),
        montoUsd: num(g.montoUsd),
        montoBs: num(g.montoBs),
        tasa: num(g.tasa),
        porcentajeDb: num(g.porcentajeDb),
        referencia: text(g.referencia),
    };
}
function tituloImpuestoJson(t) {
    return { id: t.id, nombre: text(t.nombre) };
}
function gastoImpuestoJson(g) {
    return {
        id: g.id,
        tituloImpuesto: g.tituloImpuesto ? tituloImpuestoJson(g.tituloImpuesto) : undefined,
        fecha: g.fecha == null ? undefined : (0, dates_1.toIsoDate)(g.fecha),
        numero: text(g.numero),
        motivo: text(g.motivo),
        montoUsd: num(g.montoUsd),
        montoBs: num(g.montoBs),
        tasa: num(g.tasa),
        porcentajeDb: num(g.porcentajeDb),
        referencia: text(g.referencia),
    };
}
function gastoGasoilJson(g) {
    return {
        id: g.id,
        vehiculo: g.vehiculo ? vehiculoJson(g.vehiculo) : undefined,
        fecha: g.fecha == null ? undefined : (0, dates_1.toIsoDate)(g.fecha),
        estacion: text(g.estacion),
        litros: num(g.litros),
        precioLitro: num(g.precioLitro),
        montoUsd: num(g.montoUsd),
        montoBs: num(g.montoBs),
        tasa: num(g.tasa),
        referencia: text(g.referencia),
    };
}
function viajeJson(v) {
    return {
        id: v.id,
        fechaInicio: v.fechaInicio == null ? undefined : (0, dates_1.toIsoDate)(v.fechaInicio),
        fechaFin: v.fechaFin == null ? undefined : (0, dates_1.toIsoDate)(v.fechaFin),
        chofer: v.chofer ? choferJson(v.chofer) : undefined,
        empresa: v.empresa ? empresaJson(v.empresa) : undefined,
        vehiculo: v.vehiculo ? vehiculoJson(v.vehiculo) : undefined,
        carga: text(v.carga),
        recorrido: text(v.recorrido),
        puntoSalida: v.puntoSalida ? puntoJson(v.puntoSalida) : undefined,
        puntoLlegada: v.puntoLlegada ? puntoJson(v.puntoLlegada) : undefined,
        montoViaje: num(v.montoViaje),
        combustible: num(v.combustible),
        viaticos: num(v.viaticos),
        peajes: num(v.peajes),
        pagoChofer: num(v.pagoChofer),
        litros: num(v.litros),
        refCombustible: text(v.refCombustible),
        refViaticos: text(v.refViaticos),
        refPeajes: text(v.refPeajes),
        refPagoChofer: text(v.refPagoChofer),
        gastos: (v.gastos ?? [])
            .slice()
            .sort((a, b) => a.id - b.id)
            .map(gastoJson),
        totalBs: num(v.totalBs),
        tasa: num(v.tasa),
        totalUsd: num(v.totalUsd),
    };
}
//# sourceMappingURL=serialize.js.map