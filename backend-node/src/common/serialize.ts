import { Chofer } from '../domain/chofer.entity';
import { Empresa } from '../domain/empresa.entity';
import { Gasto } from '../domain/gasto.entity';
import { Punto } from '../domain/punto.entity';
import { Recorrido } from '../domain/recorrido.entity';
import { Tasa } from '../domain/tasa.entity';
import { Vehiculo } from '../domain/vehiculo.entity';
import { Viaje } from '../domain/viaje.entity';
import { toIsoDate, toIsoDateTime } from './dates';

const num = (value: any): number | undefined =>
  value == null ? undefined : Number(value);
const text = (value: any): string | undefined =>
  value == null ? undefined : value;

export function choferJson(c: Chofer) {
  return {
    id: c.id,
    nombre: text(c.nombre),
    apellido: text(c.apellido),
    cedula: text(c.cedula),
  };
}

export function empresaJson(e: Empresa) {
  return { id: e.id, nombre: text(e.nombre) };
}

export function puntoJson(p: Punto) {
  return { id: p.id, nombre: text(p.nombre) };
}

export function recorridoJson(r: Recorrido) {
  return { id: r.id, nombre: text(r.nombre) };
}

export function vehiculoJson(v: Vehiculo) {
  return {
    id: v.id,
    marca: text(v.marca),
    modelo: text(v.modelo),
    tipo: text(v.tipo),
    placa: text(v.placa),
  };
}

export function tasaJson(t: Tasa) {
  return {
    id: t.id,
    valor: num(t.valor),
    fecha: t.fecha == null ? undefined : toIsoDateTime(t.fecha),
    origen: text(t.origen),
  };
}

export function gastoJson(g: Gasto) {
  return {
    id: g.id,
    monto: num(g.monto),
    descripcion: text(g.descripcion),
  };
}

export function viajeJson(v: Viaje) {
  return {
    id: v.id,
    fechaInicio: v.fechaInicio == null ? undefined : toIsoDate(v.fechaInicio),
    fechaFin: v.fechaFin == null ? undefined : toIsoDate(v.fechaFin),
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
