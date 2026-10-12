import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { EmpresaRepository } from '../repo/empresa.repository';

export interface ParametrosReporte {
  empresaId: number;
  desde?: string; // Formato YYYY-MM-DD
  hasta?: string; // Formato YYYY-MM-DD
  direccion?: string; // Dirección opcional si no existe en la base de datos
}

@Injectable()
export class ReporteEmpresaService {
  constructor(private readonly empresaRepo: EmpresaRepository) {}

  async generarPdf(params: ParametrosReporte): Promise<Buffer> {
    const { empresaId, desde, hasta, direccion: direccionParam } = params;

    // 1. Obtener la información de la empresa
    const empresa = Number.isFinite(empresaId)
      ? await this.empresaRepo.findById(empresaId)
      : null;
    const nombreEmpresa = empresa?.nombre ?? 'EMPRESA NO ENCONTRADA';
    const direccionEmpresa =
      empresa?.direccion?.trim() ||
      direccionParam ||
      'Zona Industrial Matanzas, Ciudad Guayana, Estado Bolívar';

    // 2. Intervalo dinámico de fechas
    const rangoFechas = this.formatearRangoFechas(desde, hasta);

    // 3. Logo en Base64
    const logoUri = this.obtenerLogoDataUri();

    // 4. Datos de la tabla provisional (3 cabeceras hardcodeadas)
    const cabeceras = ['FECHA', 'DESCRIPCIÓN / CONCEPTO', 'MONTO ($)'];
    const filasEjemplo = [
      { fecha: '22/09/2026', concepto: 'Transporte de bobinas de aluminio a planta', monto: '350,00' },
      { fecha: '26/09/2026', concepto: 'Flete de carga pesada y logística de retorno', monto: '520,00' },
      { fecha: '30/09/2026', concepto: 'Despacho de material y apoyo operativo', monto: '210,00' },
    ];

    // 5. Plantilla HTML con estilos idénticos al formato solicitado
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 12mm 15mm 12mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
          }

          /* Contenedor central de la cabecera */
          .header-container {
            text-align: center;
            margin-bottom: 24px;
          }
          .logo {
            max-width: 170px;
            height: auto;
            margin-bottom: 6px;
          }
          .slogan {
            font-size: 10px;
            color: #111827;
            font-weight: 500;
            margin-bottom: 7px;
          }
          .titulo-reporte {
            font-size: 13px;
            font-weight: 800;
            color: #111827;
            letter-spacing: 0.5px;
            margin: 0 0 5px 0;
            text-transform: uppercase;
          }
          .nombre-empresa {
            font-size: 15px;
            font-weight: 900;
            color: #8c3b87; /* Tono magenta / púrpura corporativo */
            letter-spacing: 0.8px;
            margin: 0 0 4px 0;
            text-transform: uppercase;
          }
          .direccion-empresa {
            font-size: 9.5px;
            color: #4b5563;
            margin: 0;
          }

          /* Tabla con 3 columnas */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th, td {
            border: 1px solid #c9d2e0;
            padding: 7px 10px;
            font-size: 8.5px;
          }
          th {
            background-color: #26324a;
            color: #ffffff;
            font-weight: bold;
            text-align: left;
            text-transform: uppercase;
          }
          th.num, td.num {
            text-align: right;
            white-space: nowrap;
          }
          tbody tr:nth-child(even) {
            background-color: #f4f6fa;
          }
        </style>
      </head>
      <body>

        <!-- Cabecera en el medio de la hoja -->
        <div class="header-container">
          ${logoUri ? `<img class="logo" src="${logoUri}" alt="Logo" />` : ''}
          <div class="slogan">Sin pausa, sin excusas, sin limites</div>
          <div class="titulo-reporte">REPORTE VIAJES DESDE EL ${rangoFechas}</div>
          <div class="nombre-empresa">${this.esc(nombreEmpresa)}</div>
          <div class="direccion-empresa">${this.esc(direccionEmpresa)}</div>
        </div>

        <!-- Tabla de 3 columnas -->
        <table>
          <thead>
            <tr>
              <th style="width: 20%;">${cabeceras[0]}</th>
              <th style="width: 55%;">${cabeceras[1]}</th>
              <th style="width: 25%;" class="num">${cabeceras[2]}</th>
            </tr>
          </thead>
          <tbody>
            ${filasEjemplo
              .map(
                (f) => `
                <tr>
                  <td>${f.fecha}</td>
                  <td>${this.esc(f.concepto)}</td>
                  <td class="num">$ ${f.monto}</td>
                </tr>
              `,
              )
              .join('')}
          </tbody>
        </table>

      </body>
      </html>
    `;

    // 6. Generación con Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });

      const pdfUint8 = await page.pdf({
        format: 'A4',
        landscape: false,
        printBackground: true,
        preferCSSPageSize: true,
      });

      return Buffer.from(pdfUint8);
    } finally {
      await browser.close();
    }
  }

  /**
   * Formatea el rango de fechas dinámico (ej: "22/09 AL 30/09/26")
   */
  private formatearRangoFechas(desde?: string, hasta?: string): string {
    if (!desde && !hasta) return 'HISTÓRICO GENERAL';

    const parsear = (fechaIso: string) => {
      const [y, m, d] = fechaIso.split('-');
      return {
        diaMes: `${d}/${m}`,
        anioCorto: y ? y.slice(-2) : '',
      };
    };

    if (desde && hasta) {
      const d = parsear(desde);
      const h = parsear(hasta);
      return `${d.diaMes} AL ${h.diaMes}/${h.anioCorto}`;
    }

    if (desde) {
      const d = parsear(desde);
      return `${d.diaMes}/${d.anioCorto} EN ADELANTE`;
    }

    const h = parsear(hasta!);
    return `HASTA EL ${h.diaMes}/${h.anioCorto}`;
  }

  private obtenerLogoDataUri(): string {
    const logoPath = join(process.cwd(), 'assets', 'logo.jpg');
    if (existsSync(logoPath)) {
      const buffer = readFileSync(logoPath);
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    }
    return '';
  }

  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
