import { lanzarChrome } from '../../src/common/chromium';

/**
 * Valida que el PDF del listado (export) sea responsivo y visible, tomando el
 * reporte con montos como referencia de estilo. Mide, en un Chrome real, el
 * tamaño de fuente de cada celda y detecta contenido recortado.
 *
 * El viewport imita el area imprimible de una carta horizontal (letter
 * landscape, 11in x 8.5in) menos los margenes de 8mm del @page.
 */
const PULGADA_PX = 96;
const ANCHO_PAGINA_PX = Math.round(((279.4 - 16) / 25.4) * PULGADA_PX); // ~996px
const ALTO_PAGINA_PX = Math.round(((215.9 - 16) / 25.4) * PULGADA_PX); // ~755px

const viajeFalso = (): any => ({
  id: 1,
  fechaInicio: new Date(Date.UTC(2026, 0, 1)),
  fechaFin: new Date(Date.UTC(2026, 0, 2)),
  chofer: { nombre: 'Juan', apellido: 'Perez' },
  empresa: { nombre: 'CABELUM' },
  carga: 'Hortalizas',
  puntoSalida: { nombre: 'Matanzas' },
  puntoLlegada: { nombre: 'Puerto Ordaz' },
  montoViaje: 1234.56,
  combustible: 300,
  viaticos: 150,
  peajes: 40,
  pagoChofer: 500,
  litros: 42.5,
  gastos: [{ monto: 25 }],
  tasa: 36.5,
  totalBs: 100000,
  totalUsd: 2739.72,
});

interface Medida {
  fuenteTh: number;
  fuenteTd: number;
  anchoTabla: number;
  anchoPagina: number;
  celdas: number;
  desbordan: number;
}

describe('Layout PDF: listado visible con referencia del reporte con montos', () => {
  let browser: any;

  beforeAll(async () => {
    browser = await lanzarChrome();
  }, 60000);

  afterAll(async () => {
    if (browser) await browser.close();
  });

  it('ordena los viajes del PDF por fecha ascendente (y por id en empate)', () => {
    const { ordenarPorFechaAscendente } = require('../../src/service/export.service');
    const orden = ordenarPorFechaAscendente([
      { id: 9, fechaInicio: new Date(Date.UTC(2026, 2, 3)) },
      { id: 5, fechaInicio: new Date(Date.UTC(2026, 0, 1)) },
      { id: 2, fechaInicio: new Date(Date.UTC(2026, 0, 1)) },
      { id: 1, fechaInicio: new Date(Date.UTC(2025, 11, 31)) },
    ]).map((v: any) => v.id);
    expect(orden).toEqual([1, 2, 5, 9]);
  });

  it('celdas del listado no desbordan y usan fuente comparable al reporte', async () => {
    const { htmlViajes } = require('../../src/service/export.service');
    const { htmlReporte } = require('../../src/service/reporte-empresa.service');

    const htmlListado = htmlViajes([viajeFalso()], {
      empresaNombre: 'CABELUM',
      color: '#26324a',
    });

    // Referencia: mismo boton "Reporte con montos" (conMonto = true, 8 columnas).
    const htmlReferencia = htmlReporte({
      nombreEmpresa: 'CABELUM',
      direccionEmpresa: 'Zona Industrial',
      rangoFechas: 'HISTORICO GENERAL',
      columnas: [
        'FECHA',
        'VEHICULO',
        'CHOFER',
        'RECORRIDO',
        'SALIDA',
        'LLEGADA',
        'CARGA',
        'MONTO ($)',
      ],
      filas: [
        [
          '01/01/2026',
          'Toyota',
          'Juan Perez',
          'Ruta 1',
          'Matanzas',
          'Puerto Ordaz',
          'Hortalizas',
          '1.234,56',
        ],
      ],
      conMonto: true,
      anchos: [10, 17, 15, 17, 11, 11, 12, 7],
      color: '#8c3b87',
    });

    const page = await browser.newPage();
    await page.setViewport({ width: ANCHO_PAGINA_PX, height: ALTO_PAGINA_PX });

    const medir = async (html: string): Promise<Medida> => {
      await page.setContent(html, { waitUntil: 'load' });
      return page.evaluate(() => {
        const th = document.querySelector('th');
        const tds = Array.from(document.querySelectorAll('tbody td')) as HTMLElement[];
        const tabla = document.querySelector('table') as HTMLElement | null;
        const primeraFila = document.querySelector('tbody tr');
        const celdas = primeraFila ? primeraFila.querySelectorAll('td').length : 0;
        const desbordan = tds.filter((td) => td.scrollWidth > td.clientWidth + 1).length;
        return {
          fuenteTh: th ? parseFloat(getComputedStyle(th).fontSize) : 0,
          fuenteTd: tds[0] ? parseFloat(getComputedStyle(tds[0]).fontSize) : 0,
          anchoTabla: tabla ? tabla.getBoundingClientRect().width : 0,
          anchoPagina: document.documentElement.clientWidth,
          celdas,
          desbordan,
        };
      });
    };

    const listado = await medir(htmlListado);
    const referencia = await medir(htmlReferencia);
    await page.close();

    // 17 columnas de datos => 17 celdas por fila de cuerpo.
    expect(listado.celdas).toBe(17);

    // El listado no usa fuente mayor que la referencia conocida como visible.
    expect(listado.fuenteTh).toBeLessThanOrEqual(referencia.fuenteTh + 0.01);
    expect(listado.fuenteTd).toBeLessThanOrEqual(referencia.fuenteTd + 0.01);

    // Con celdas a medida del contenido la tabla se ajusta a lo que pide
    // su contenido (sin ancho fijo por columna), sin exceder la hoja.
    expect(listado.anchoTabla).toBeLessThanOrEqual(listado.anchoPagina + 1);
    expect(listado.anchoTabla).toBeGreaterThan(listado.anchoPagina * 0.6);

    // Visible: ninguna celda recorta su contenido.
    expect(listado.desbordan).toBe(0);
  }, 60000);
});
