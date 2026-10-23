"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fechaCorta = exports.formatearDinero = exports.escapar = void 0;
exports.rangoFechas = rangoFechas;
exports.agruparPor = agruparPor;
exports.htmlGastosSeccion = htmlGastosSeccion;
exports.htmlResumenTitulos = htmlResumenTitulos;
const dates_1 = require("../common/dates");
const numDe = (v) => Number(v || 0);
const escapar = (str) => String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
exports.escapar = escapar;
const formatearDinero = (valor) => Number(valor || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
exports.formatearDinero = formatearDinero;
const fechaCorta = (iso) => {
    if (!iso)
        return '—';
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : '—';
};
exports.fechaCorta = fechaCorta;
function rangoFechas(desde, hasta) {
    const corta = (iso) => {
        const [a, m, d] = iso.split('-');
        return `${d}/${m}/${a ? a.slice(-2) : ''}`;
    };
    if (desde && hasta)
        return `${corta(desde)} AL ${corta(hasta)}`;
    if (desde)
        return `DESDE ${corta(desde)}`;
    if (hasta)
        return `HASTA ${corta(hasta)}`;
    return 'HISTÓRICO GENERAL';
}
function agruparPor(filas, claveDe) {
    const mapa = new Map();
    for (const f of filas) {
        const clave = claveDe(f).trim() || 'SIN CLAVE';
        let bloque = mapa.get(clave);
        if (!bloque) {
            bloque = { clave, filas: [], sumaUsd: 0, sumaBs: 0 };
            mapa.set(clave, bloque);
        }
        bloque.filas.push(f);
        bloque.sumaUsd += numDe(f.montoUsd);
        bloque.sumaBs += numDe(f.montoBs);
    }
    const bloques = [...mapa.values()].sort((a, b) => a.clave.localeCompare(b.clave, 'es'));
    for (const b of bloques) {
        b.sumaUsd = (0, dates_1.round2)(b.sumaUsd);
        b.sumaBs = (0, dates_1.round2)(b.sumaBs);
        b.filas.sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)));
    }
    return bloques;
}
function htmlGastosSeccion(params) {
    const { titulo, rango, columnas, bloques, totalUsd, totalBs, cantidad, color, logoUri, etiquetaSubtotal, mensajeVacio, } = params;
    const ths = columnas
        .map((c) => `<th class="${c.num ? 'num' : ''}">${(0, exports.escapar)(c.encabezado)}</th>`)
        .join('');
    const idxUsd = Math.max(0, columnas.findIndex((c) => c.clave === 'usd'));
    const idxBs = Math.max(0, columnas.findIndex((c) => c.clave === 'bs'));
    const filaSubtotal = (bloque) => {
        const texto = (etiquetaSubtotal ?? ((clave) => `SUBTOTAL ${clave}`))(bloque.clave).toLocaleUpperCase('es');
        const antes = columnas
            .slice(0, idxUsd)
            .map((_, i) => (i === 0 ? `<td colspan="${idxUsd}">${(0, exports.escapar)(texto)}</td>` : ''))
            .join('');
        const dinero = `<td class="num">$ ${(0, exports.formatearDinero)(bloque.sumaUsd)}</td>` +
            `<td class="num">Bs ${(0, exports.formatearDinero)(bloque.sumaBs)}</td>`;
        const despues = columnas.length - 1 - idxBs;
        const cola = despues > 0 ? `<td colspan="${despues}"></td>` : '';
        return `<tr class="subtotal">${antes}${dinero}${cola}</tr>`;
    };
    const secciones = bloques
        .map((b) => `
        <div class="bloque-titulo">${(0, exports.escapar)(b.clave)}</div>
        <table>
          <thead><tr>${ths}</tr></thead>
          <tbody>
            ${b.filas
        .map((f, i) => `<tr class="${i % 2 ? 'par' : ''}">${columnas
        .map((c) => `<td class="${c.num ? 'num' : ''}">${c.celda(f)}</td>`)
        .join('')}</tr>`)
        .join('')}
            ${filaSubtotal(b)}
          </tbody>
        </table>`)
        .join('');
    const vacio = !bloques.length
        ? `<p class="vacio">${mensajeVacio ?? 'Sin gastos en este intervalo.'}</p>`
        : '';
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
          .bloque-titulo {
            background: #26324a;
            color: #ffffff;
            font-size: 10pt;
            font-weight: bold;
            text-transform: uppercase;
            padding: 4px 8px;
            margin: 10px 0 0;
            page-break-after: avoid;
          }
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
          tr.subtotal td {
            background-color: #dde6f5;
            font-weight: bold;
            font-size: 10pt;
          }
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
          .vacio { text-align: center; color: #6b7280; font-style: italic; padding: 14px; }
        </style>
      </head>
      <body>
        <div class="cab">
          ${logoUri ? `<img class="logo" src="${logoUri}" alt="Logo" />` : ''}
          <h1>${(0, exports.escapar)(titulo)}</h1>
          <p class="rango">${(0, exports.escapar)(rango)}</p>
        </div>

        <div class="resumen">
          <span class="dato"><span class="k">PERIODO</span>${(0, exports.escapar)(rango)}</span>
          <span class="dato"><span class="k">REGISTROS</span>${cantidad}</span>
        </div>

        ${secciones}
        ${vacio}

        ${bloques.length
        ? `
        <div class="total-general">
          TOTAL GENERAL
          <span class="caja">$ ${(0, exports.formatearDinero)(totalUsd)}</span>
          <span class="caja">Bs ${(0, exports.formatearDinero)(totalBs)}</span>
        </div>`
        : ''}
      </body>
      </html>
    `;
}
function htmlResumenTitulos(params) {
    const { titulo, encabezado = 'TÍTULO', rango, filas, totalUsd, totalBs, cantidad, color, logoUri, } = params;
    const cuerpo = filas
        .map((f, i) => `
        <tr class="${i % 2 ? 'par' : ''}">
          <td>${(0, exports.escapar)(f.etiqueta)}</td>
          <td class="num">$ ${(0, exports.formatearDinero)(f.montoUsd)}</td>
          <td class="num">Bs ${(0, exports.formatearDinero)(f.montoBs)}</td>
        </tr>`)
        .join('');
    const vacio = filas.length
        ? ''
        : `<tr><td colspan="3" class="vacio">Sin gastos en este intervalo.</td></tr>`;
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
          <h1>${(0, exports.escapar)(titulo)}</h1>
          <p class="rango">${(0, exports.escapar)(rango)}</p>
        </div>

        <div class="resumen">
          <span class="dato"><span class="k">PERIODO</span>${(0, exports.escapar)(rango)}</span>
          <span class="dato"><span class="k">REGISTROS</span>${cantidad}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>${(0, exports.escapar)(encabezado)}</th>
              <th class="num">MONTO $</th>
              <th class="num">MONTO BS</th>
            </tr>
          </thead>
          <tbody>
            ${cuerpo}
            ${vacio}
          </tbody>
        </table>

        ${filas.length
        ? `
        <div class="total-general">
          TOTAL GENERAL
          <span class="caja">$ ${(0, exports.formatearDinero)(totalUsd)}</span>
          <span class="caja">Bs ${(0, exports.formatearDinero)(totalBs)}</span>
        </div>`
        : ''}
      </body>
      </html>
    `;
}
//# sourceMappingURL=gastos-seccion.builder.js.map