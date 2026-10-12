"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.choferJson = choferJson;
exports.empresaJson = empresaJson;
exports.puntoJson = puntoJson;
exports.recorridoJson = recorridoJson;
exports.vehiculoJson = vehiculoJson;
exports.tasaJson = tasaJson;
exports.gastoJson = gastoJson;
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
function viajeJson(v) {
    return {
        id: v.id,
        fechaInicio: v.fechaInicio == null ? undefined : (0, dates_1.toIsoDate)(v.fechaInicio),
        fechaFin: v.fechaFin == null ? undefined : (0, dates_1.toIsoDate)(v.fechaFin),
        chofer: v.chofer ? choferJson(v.chofer) : undefined,
        empresa: v.empresa ? empresaJson(v.empresa) : undefined,
        carga: text(v.carga),
        recorrido: text(v.recorrido),
        puntoSalida: v.puntoSalida ? puntoJson(v.puntoSalida) : undefined,
        puntoLlegada: v.puntoLlegada ? puntoJson(v.puntoLlegada) : undefined,
        montoViaje: num(v.montoViaje),
        combustible: num(v.combustible),
        viaticos: num(v.viaticos),
        peajes: num(v.peajes),
        pagoChofer: num(v.pagoChofer),
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