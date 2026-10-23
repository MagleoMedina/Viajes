import { Chofer } from '../domain/chofer.entity';
import { Empresa } from '../domain/empresa.entity';
import { Gasto } from '../domain/gasto.entity';
import { GastoGasoil } from '../domain/gasto-gasoil.entity';
import { GasoilEstacionario } from '../domain/gasoil-estacionario.entity';
import { GastoImpuesto } from '../domain/gasto-impuesto.entity';
import { GastoVario } from '../domain/gasto-vario.entity';
import { Ingreso } from '../domain/ingreso.entity';
import { Punto } from '../domain/punto.entity';
import { Recorrido } from '../domain/recorrido.entity';
import { Tasa } from '../domain/tasa.entity';
import { TituloGasto } from '../domain/titulo-gasto.entity';
import { TituloImpuesto } from '../domain/titulo-impuesto.entity';
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
  return { id: e.id, nombre: text(e.nombre), direccion: text(e.direccion) };
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

export function tituloGastoJson(t: TituloGasto) {
  return { id: t.id, nombre: text(t.nombre) };
}

export function gastoVarioJson(g: GastoVario) {
  return {
    id: g.id,
    tituloGasto: g.tituloGasto ? tituloGastoJson(g.tituloGasto) : undefined,
    fecha: g.fecha == null ? undefined : toIsoDate(g.fecha),
    numero: text(g.numero),
    motivo: text(g.motivo),
    montoUsd: num(g.montoUsd),
    montoBs: num(g.montoBs),
    tasa: num(g.tasa),
    porcentajeDb: num(g.porcentajeDb),
    referencia: text(g.referencia),
  };
}

export function tituloImpuestoJson(t: TituloImpuesto) {
  return { id: t.id, nombre: text(t.nombre) };
}

export function gastoImpuestoJson(g: GastoImpuesto) {
  return {
    id: g.id,
    tituloImpuesto: g.tituloImpuesto ? tituloImpuestoJson(g.tituloImpuesto) : undefined,
    fecha: g.fecha == null ? undefined : toIsoDate(g.fecha),
    numero: text(g.numero),
    motivo: text(g.motivo),
    montoUsd: num(g.montoUsd),
    montoBs: num(g.montoBs),
    tasa: num(g.tasa),
    porcentajeDb: num(g.porcentajeDb),
    referencia: text(g.referencia),
  };
}

export function gastoGasoilJson(g: GastoGasoil) {
  return {
    id: g.id,
    vehiculo: g.vehiculo ? vehiculoJson(g.vehiculo) : undefined,
    fecha: g.fecha == null ? undefined : toIsoDate(g.fecha),
    estacion: text(g.estacion),
    litros: num(g.litros),
    precioLitro: num(g.precioLitro),
    montoUsd: num(g.montoUsd),
    montoBs: num(g.montoBs),
    tasa: num(g.tasa),
    referencia: text(g.referencia),
  };
}

export function gasoilEstacionarioJson(g: GasoilEstacionario) {
  return {
    id: g.id,
    vehiculo: g.vehiculo ? vehiculoJson(g.vehiculo) : undefined,
    fecha: g.fecha == null ? undefined : toIsoDate(g.fecha),
    litros: num(g.litros),
    referencia: text(g.referencia),
    motivo: text(g.motivo),
  };
}

export function ingresoJson(i: Ingreso) {
  return {
    id: i.id,
    fecha: i.fecha == null ? undefined : toIsoDate(i.fecha),
    empresa: i.empresa ? empresaJson(i.empresa) : undefined,
    condicionesPago: text(i.condicionesPago),
    descripcion: text(i.descripcion),
    cantidad: num(i.cantidad),
    tasa: num(i.tasa),
    facturaNum: i.facturaNum == null ? null : Number(i.facturaNum),
    iva: num(i.iva),
    montoDivisa: num(i.montoDivisa),
    montoBs: num(i.montoBs),
  };
}

export function viajeJson(v: Viaje) {
  return {
    id: v.id,
    fechaInicio: v.fechaInicio == null ? undefined : toIsoDate(v.fechaInicio),
    fechaFin: v.fechaFin == null ? undefined : toIsoDate(v.fechaFin),
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
