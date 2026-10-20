import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { lanzarChrome } from '../common/chromium';
import { round2 } from '../common/dates';
import { gasoilEstacionarioJson } from '../common/serialize';
import { GasoilEstacionarioRepository } from '../repo/gasoil-estacionario.repository';
import { VehiculoRepository } from '../repo/vehiculo.repository';
import { escapar, fechaCorta, rangoFechas } from './gastos-seccion.builder';

/** Fila serializada que consume el HTML (función pura, testeable). */
export interface FilaGasoilEstacionario {
  fecha?: string;
  litros?: number;
  referencia?: string;
  motivo?: string;
  vehiculo?: { placa?: string };
}

export interface GasoilEstacionarioHtmlParams {
  rango: string;
  filas: FilaGasoilEstacionario[];
  totalLitros: number;
  cantidad: number;
  /** Placa filtrada, si la consulta fue por un vehículo. */
  vehiculoPlaca?: string | null;
  logoUri?: string;
}

const litros = (valor: number | undefined): string =>
  Number(valor || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** HTML del PDF de consumos estacionarios: una fila por registro y total. */
export function htmlGasoilEstacionario(params: GasoilEstacionarioHtmlParams): string {
  const { rango, filas, totalLitros, cantidad, vehiculoPlaca, logoUri } = params;

  const cuerpo = filas.length
    ? filas
        .map(
          (f, i) => `
            <tr class="${i % 2 ? 'par' : ''}">
              <td>${fechaCorta(f.fecha)}</td>
              <td>${escapar(f.vehiculo?.placa ?? 'SIN VEHÍCULO')}</td>
              <td class="num">${litros(f.litros)}</td>
              <td>${escapar(f.referencia ?? '')}</td>
              <td>${escapar(f.motivo ?? '')}</td>
            </tr>`,
        )
        .join('')
    : `<tr><td colspan="5" class="vacio">Sin consumos en este intervalo.</td></tr>`;

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
            color: #26324a;
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
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #c9d2e0; padding: 4px 6px; }
          th {
            background: #26324a;
            color: #ffffff;
            font-size: 9px;
            text-align: left;
          }
          td { font-size: 10pt; }
          td.num, th.num { text-align: right; }
          tbody tr.par td { background: #f4f6fa; }
          td.vacio { text-align: center; color: #6b7280; }
          tr.total td {
            background: #dde6f5;
            font-weight: bold;
            border-top: 2px solid #26324a;
          }
        </style>
      </head>
      <body>
        <div class="cab">
          ${logoUri ? `<img class="logo" src="${logoUri}" alt="Logo" />` : ''}
          <h1>Gasoil estacionario</h1>
          <div class="rango">${escapar(rango)}</div>
        </div>

        <div class="resumen">
          <span class="dato"><span class="k">PERIODO</span>${escapar(rango)}</span>
          <span class="dato"><span class="k">REGISTROS</span>${cantidad}</span>
          ${
            vehiculoPlaca
              ? `<span class="dato"><span class="k">VEHÍCULO</span>${escapar(
                  vehiculoPlaca,
                )}</span>`
              : ''
          }
        </div>

        <table>
          <thead>
            <tr>
              <th>FECHA</th>
              <th>VEHÍCULO</th>
              <th class="num">LITROS</th>
              <th>N° REF</th>
              <th>MOTIVO</th>
            </tr>
          </thead>
          <tbody>
            ${cuerpo}
            <tr class="total">
              <td colspan="2">TOTAL</td>
              <td class="num">${litros(totalLitros)}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
}

@Injectable()
export class GasoilEstacionarioService {
  constructor(
    private readonly repo: GasoilEstacionarioRepository,
    private readonly vehiculos: VehiculoRepository,
  ) {}

  async crearPdf(
    desde?: string,
    hasta?: string,
    vehiculoId?: number | null,
  ): Promise<Buffer> {
    const registros = await this.repo.buscar(vehiculoId, desde, hasta);
    const vehiculo =
      vehiculoId != null && vehiculoId > 0
        ? await this.vehiculos.findById(vehiculoId)
        : null;
    const filas = registros.map(gasoilEstacionarioJson);
    const totalLitros = round2(filas.reduce((s, f) => s + Number(f.litros || 0), 0));

    const html = htmlGasoilEstacionario({
      rango: rangoFechas(desde, hasta),
      filas,
      totalLitros,
      cantidad: filas.length,
      vehiculoPlaca: vehiculo?.placa ?? null,
      logoUri: this.logoDataUri(),
    });

    const browser = await lanzarChrome();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfUint8 = await page.pdf({ printBackground: true, preferCSSPageSize: true });
      return Buffer.from(pdfUint8);
    } finally {
      await browser.close();
    }
  }

  private logoDataUri(): string {
    const logoPath = join(process.cwd(), 'assets', 'logo.jpg');
    if (existsSync(logoPath)) {
      return `data:image/jpeg;base64,${readFileSync(logoPath).toString('base64')}`;
    }
    return '';
  }
}
