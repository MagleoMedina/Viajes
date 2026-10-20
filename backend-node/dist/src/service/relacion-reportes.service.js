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
exports.RelacionReportesService = exports.TIPOS_GASTO = exports.TIPOS_RELACION = void 0;
exports.resumirIngresos = resumirIngresos;
exports.resumirGastos = resumirGastos;
exports.resumirGeneral = resumirGeneral;
exports.htmlRelacion = htmlRelacion;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const chromium_1 = require("../common/chromium");
const dates_1 = require("../common/dates");
const gasto_gasoil_repository_1 = require("../repo/gasto-gasoil.repository");
const gasto_impuesto_repository_1 = require("../repo/gasto-impuesto.repository");
const gasto_vario_repository_1 = require("../repo/gasto-vario.repository");
const tasa_repository_1 = require("../repo/tasa.repository");
const viaje_repository_1 = require("../repo/viaje.repository");
const api_exception_1 = require("../web/api-exception");
const gastos_seccion_builder_1 = require("./gastos-seccion.builder");
exports.TIPOS_RELACION = ['ingresos', 'gastos', 'general'];
exports.TIPOS_GASTO = [
    'GASTOS VARIOS',
    'IMPUESTOS',
    'GASOIL',
    'COMBUSTIBLE',
    'PAGO A CHOFERES',
    'PEAJES',
    'VIÁTICOS',
];
const num = (v) => Number(v || 0);
const sumar = (filas) => ({
    usd: (0, dates_1.round2)(filas.reduce((s, f) => s + num(f.montoUsd), 0)),
    bs: (0, dates_1.round2)(filas.reduce((s, f) => s + num(f.montoBs), 0)),
});
function resumirIngresos(viajes, tasa) {
    const mapa = new Map();
    for (const v of viajes) {
        const clave = (v.empresa ?? '').trim() || 'SIN EMPRESA';
        mapa.set(clave, (0, dates_1.round2)((mapa.get(clave) ?? 0) + num(v.montoViaje)));
    }
    return [...mapa.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'es'))
        .map(([etiqueta, montoUsd]) => ({
        etiqueta,
        montoUsd,
        montoBs: (0, dates_1.round2)(montoUsd * num(tasa)),
    }));
}
function resumirGastos(fuentes) {
    const delViaje = (campo) => {
        let usd = 0;
        let bs = 0;
        for (const v of fuentes.viajes) {
            const montoBs = num(v[campo]);
            bs += montoBs;
            const tasa = num(v.tasa);
            if (tasa > 0)
                usd += montoBs / tasa;
        }
        return { usd: (0, dates_1.round2)(usd), bs: (0, dates_1.round2)(bs) };
    };
    const porTitulo = (filas) => {
        if (!filas.length)
            return [];
        const mapa = new Map();
        for (const f of filas) {
            const clave = (f.titulo ?? '').trim() || 'SIN TÍTULO';
            const suma = mapa.get(clave) ?? { usd: 0, bs: 0 };
            suma.usd += num(f.montoUsd);
            suma.bs += num(f.montoBs);
            mapa.set(clave, suma);
        }
        return [...mapa.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], 'es'))
            .map(([etiqueta, suma]) => ({
            etiqueta,
            montoUsd: (0, dates_1.round2)(suma.usd),
            montoBs: (0, dates_1.round2)(suma.bs),
        }));
    };
    const filas = [];
    for (const [categoria, registros] of [
        [exports.TIPOS_GASTO[0], fuentes.varios],
        [exports.TIPOS_GASTO[1], fuentes.impuestos],
    ]) {
        const titulos = porTitulo(registros);
        if (titulos.length)
            filas.push(...titulos);
        else
            filas.push({ etiqueta: categoria, montoUsd: 0, montoBs: 0 });
    }
    const gasoil = sumar(fuentes.gasoil);
    const combustible = delViaje('combustible');
    const choferes = delViaje('pagoChofer');
    const peajes = delViaje('peajes');
    const viaticos = delViaje('viaticos');
    filas.push({ etiqueta: exports.TIPOS_GASTO[2], montoUsd: gasoil.usd, montoBs: gasoil.bs }, { etiqueta: exports.TIPOS_GASTO[3], montoUsd: combustible.usd, montoBs: combustible.bs }, { etiqueta: exports.TIPOS_GASTO[4], montoUsd: choferes.usd, montoBs: choferes.bs }, { etiqueta: exports.TIPOS_GASTO[5], montoUsd: peajes.usd, montoBs: peajes.bs }, { etiqueta: exports.TIPOS_GASTO[6], montoUsd: viaticos.usd, montoBs: viaticos.bs });
    return filas;
}
function resumirGeneral(ingresos, gastos) {
    const ingresosUsd = (0, dates_1.round2)(ingresos.reduce((s, f) => s + f.montoUsd, 0));
    const ingresosBs = (0, dates_1.round2)(ingresos.reduce((s, f) => s + f.montoBs, 0));
    const egresosUsd = (0, dates_1.round2)(gastos.reduce((s, f) => s + f.montoUsd, 0));
    const egresosBs = (0, dates_1.round2)(gastos.reduce((s, f) => s + f.montoBs, 0));
    return [
        { etiqueta: 'INGRESOS', montoUsd: ingresosUsd, montoBs: ingresosBs },
        { etiqueta: 'EGRESOS', montoUsd: egresosUsd, montoBs: egresosBs },
        {
            etiqueta: 'RELACIÓN',
            montoUsd: (0, dates_1.round2)(ingresosUsd - egresosUsd),
            montoBs: (0, dates_1.round2)(ingresosBs - egresosBs),
        },
    ];
}
function htmlRelacion(params) {
    const { titulo, rango, encabezadoEtiqueta, filas, tasa, totalUsd, totalBs, cantidad, mostrarTotal = true, color, logoUri, } = params;
    const cuerpo = filas
        .map((f, i) => `
        <tr class="${i % 2 ? 'par' : ''}">
          <td>${(0, gastos_seccion_builder_1.escapar)(f.etiqueta)}</td>
          <td class="num">$ ${(0, gastos_seccion_builder_1.formatearDinero)(f.montoUsd)}</td>
          <td class="num">Bs ${(0, gastos_seccion_builder_1.formatearDinero)(f.montoBs)}</td>
          <td class="num">${(0, gastos_seccion_builder_1.formatearDinero)(tasa)}</td>
        </tr>`)
        .join('');
    const total = mostrarTotal && filas.length
        ? `
        <tr class="total">
          <td>TOTAL</td>
          <td class="num">$ ${(0, gastos_seccion_builder_1.formatearDinero)(totalUsd)}</td>
          <td class="num">Bs ${(0, gastos_seccion_builder_1.formatearDinero)(totalBs)}</td>
          <td class="num">${(0, gastos_seccion_builder_1.formatearDinero)(tasa)}</td>
        </tr>`
        : '';
    const vacio = filas.length
        ? ''
        : `<tr><td colspan="4" class="vacio">Sin registros en este intervalo.</td></tr>`;
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: letter landscape; margin: 12mm 10mm; }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
          }
          .cab { text-align: center; margin-bottom: 10px; }
          .logo { max-width: 200px; height: auto; margin-bottom: 6px; }
          h1 {
            font-size: 15px;
            font-weight: 800;
            color: ${color ?? '#26324a'};
            letter-spacing: 0.5px;
            margin: 0 0 4px;
            text-transform: uppercase;
          }
          .rango { font-size: 16px; line-height: 1.2; color: #4b5563; margin: 0; }
          .resumen { margin: 8px 0 10px; text-align: center; }
          .dato {
            display: inline-block;
            border: 1px solid #2f6fed;
            background: #eef3fb;
            color: #26324a;
            font-size: 11px;
            font-weight: bold;
            padding: 3px 8px;
            margin: 0 3px;
          }
          .dato .k { color: #2f6fed; font-size: 9px; margin-right: 5px; }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: auto;
            margin-bottom: 4px;
          }
          th, td {
            border: 1px solid #c9d2e0;
            padding: 5px 6px;
            font-size: 10pt;
            overflow-wrap: break-word;
          }
          th {
            background-color: #26324a;
            color: #ffffff;
            font-weight: bold;
            text-align: left;
            text-transform: uppercase;
          }
          th.num, td.num { text-align: right; white-space: nowrap; }
          thead { display: table-header-group; }
          tbody tr { page-break-inside: avoid; }
          tbody tr.par td { background-color: #f4f6fa; }
          tr.total td {
            background-color: #26324a;
            color: #ffffff;
            font-weight: bold;
            font-size: 10pt;
          }
          td.vacio { text-align: center; color: #6b7280; font-style: italic; padding: 14px; }
          .total-general {
            margin-top: 12px;
            text-align: right;
            font-size: 12pt;
            font-weight: bold;
          }
          .total-general .caja {
            display: inline-block;
            background: #2f6fed;
            color: #ffffff;
            padding: 6px 14px;
            margin-left: 6px;
            border-radius: 6px;
          }
        </style>
      </head>
      <body>
        <div class="cab">
          ${logoUri ? `<img class="logo" src="${logoUri}" alt="Logo" />` : ''}
          <h1>${(0, gastos_seccion_builder_1.escapar)(titulo)}</h1>
          <p class="rango">${(0, gastos_seccion_builder_1.escapar)(rango)}</p>
        </div>

        <div class="resumen">
          <span class="dato"><span class="k">PERIODO</span>${(0, gastos_seccion_builder_1.escapar)(rango)}</span>
          <span class="dato"><span class="k">REGISTROS</span>${cantidad}</span>
          <span class="dato"><span class="k">TASA</span>${(0, gastos_seccion_builder_1.formatearDinero)(tasa)}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>${(0, gastos_seccion_builder_1.escapar)(encabezadoEtiqueta)}</th>
              <th class="num">MONTO $</th>
              <th class="num">MONTO BS</th>
              <th class="num">TASA</th>
            </tr>
          </thead>
          <tbody>
            ${cuerpo}
            ${vacio}
            ${total}
          </tbody>
        </table>

        ${mostrarTotal && filas.length
        ? `
        <div class="total-general">
          TOTAL GENERAL
          <span class="caja">$ ${(0, gastos_seccion_builder_1.formatearDinero)(totalUsd)}</span>
          <span class="caja">Bs ${(0, gastos_seccion_builder_1.formatearDinero)(totalBs)}</span>
        </div>`
        : ''}
      </body>
      </html>
    `;
}
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
let RelacionReportesService = class RelacionReportesService {
    viajeRepo;
    variosRepo;
    impuestosRepo;
    gasoilRepo;
    tasaRepo;
    constructor(viajeRepo, variosRepo, impuestosRepo, gasoilRepo, tasaRepo) {
        this.viajeRepo = viajeRepo;
        this.variosRepo = variosRepo;
        this.impuestosRepo = impuestosRepo;
        this.gasoilRepo = gasoilRepo;
        this.tasaRepo = tasaRepo;
    }
    validarRango(desde, hasta) {
        const campos = {};
        if (!desde || !FECHA_ISO.test(desde))
            campos.desde = 'La fecha de inicio es obligatoria';
        if (!hasta || !FECHA_ISO.test(hasta))
            campos.hasta = 'La fecha de fin es obligatoria';
        if (Object.keys(campos).length)
            throw new api_exception_1.ApiValidationException(campos);
        if (desde > hasta) {
            throw new api_exception_1.ApiValidationException({
                hasta: 'La fecha de fin no puede ser anterior a la de inicio',
            });
        }
    }
    async ingresos(desde, hasta) {
        const tasa = await this.tasaVigente();
        const viajes = await this.viajeRepo.findByFechaInicioBetweenOrderByFechaInicioDesc(desde, hasta);
        const filas = resumirIngresos(viajes.map((v) => ({
            empresa: v.empresa?.nombre ?? null,
            montoViaje: v.montoViaje,
        })), tasa);
        return this.resumen('ingresos', tasa, filas, viajes.length);
    }
    async gastos(desde, hasta) {
        const tasa = await this.tasaVigente();
        const [viajes, varios, impuestos, gasoil] = await Promise.all([
            this.viajeRepo.findByFechaInicioBetweenOrderByFechaInicioDesc(desde, hasta),
            this.variosRepo.buscar(null, desde, hasta),
            this.impuestosRepo.buscar(null, desde, hasta),
            this.gasoilRepo.buscar(null, desde, hasta),
        ]);
        const filas = resumirGastos({
            varios: varios.map((g) => ({
                montoUsd: g.montoUsd,
                montoBs: g.montoBs,
                titulo: g.tituloGasto?.nombre,
            })),
            impuestos: impuestos.map((g) => ({
                montoUsd: g.montoUsd,
                montoBs: g.montoBs,
                titulo: g.tituloImpuesto?.nombre,
            })),
            gasoil,
            viajes: viajes.map((v) => ({
                tasa: v.tasa,
                combustible: v.combustible,
                pagoChofer: v.pagoChofer,
                peajes: v.peajes,
                viaticos: v.viaticos,
            })),
        });
        const cantidad = varios.length +
            impuestos.length +
            gasoil.length +
            viajes.filter((v) => num(v.combustible) + num(v.pagoChofer) + num(v.peajes) + num(v.viaticos) > 0).length;
        return this.resumen('gastos', tasa, filas, cantidad);
    }
    async general(desde, hasta) {
        const [ingresos, gastos] = await Promise.all([
            this.ingresos(desde, hasta),
            this.gastos(desde, hasta),
        ]);
        const filas = resumirGeneral(ingresos.filas, gastos.filas);
        const resumen = this.resumen('general', ingresos.tasa, filas, ingresos.cantidad + gastos.cantidad);
        return resumen;
    }
    async resumenPorTipo(tipo, desde, hasta) {
        if (tipo === 'ingresos')
            return this.ingresos(desde, hasta);
        if (tipo === 'gastos')
            return this.gastos(desde, hasta);
        return this.general(desde, hasta);
    }
    async crearPdf(tipo, desde, hasta) {
        const resumen = await this.resumenPorTipo(tipo, desde, hasta);
        const html = htmlRelacion({
            titulo: TITULOS[tipo],
            rango: (0, gastos_seccion_builder_1.rangoFechas)(desde, hasta),
            encabezadoEtiqueta: ENCABEZADOS[tipo],
            filas: resumen.filas,
            tasa: resumen.tasa,
            totalUsd: resumen.totalUsd,
            totalBs: resumen.totalBs,
            cantidad: resumen.cantidad,
            mostrarTotal: tipo !== 'general',
            color: '#26324a',
            logoUri: this.logoDataUri(),
        });
        const browser = await (0, chromium_1.lanzarChrome)();
        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'load' });
            const pdfUint8 = await page.pdf({ printBackground: true, preferCSSPageSize: true });
            return Buffer.from(pdfUint8);
        }
        finally {
            await browser.close();
        }
    }
    async tasaVigente() {
        const tasa = await this.tasaRepo.findTopByOrderByIdDesc();
        if (!tasa || !(Number(tasa.valor) > 0)) {
            throw new api_exception_1.ApiException(400, 'No hay tasa registrada para convertir a Bs');
        }
        return Number(tasa.valor);
    }
    resumen(tipo, tasa, filas, cantidad) {
        return {
            tipo,
            tasa,
            filas,
            totalUsd: (0, dates_1.round2)(filas.reduce((s, f) => s + f.montoUsd, 0)),
            totalBs: (0, dates_1.round2)(filas.reduce((s, f) => s + f.montoBs, 0)),
            cantidad,
        };
    }
    logoDataUri() {
        const logoPath = (0, path_1.join)(process.cwd(), 'assets', 'logo.jpg');
        if ((0, fs_1.existsSync)(logoPath)) {
            return `data:image/jpeg;base64,${(0, fs_1.readFileSync)(logoPath).toString('base64')}`;
        }
        return '';
    }
};
exports.RelacionReportesService = RelacionReportesService;
exports.RelacionReportesService = RelacionReportesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [viaje_repository_1.ViajeRepository,
        gasto_vario_repository_1.GastoVarioRepository,
        gasto_impuesto_repository_1.GastoImpuestoRepository,
        gasto_gasoil_repository_1.GastoGasoilRepository,
        tasa_repository_1.TasaRepository])
], RelacionReportesService);
const TITULOS = {
    ingresos: 'Reporte de ingresos por empresa',
    gastos: 'Reporte de gastos por concepto',
    general: 'Relación ingresos − egresos',
};
const ENCABEZADOS = {
    ingresos: 'EMPRESA',
    gastos: 'CONCEPTO',
    general: 'RELACIÓN',
};
//# sourceMappingURL=relacion-reportes.service.js.map