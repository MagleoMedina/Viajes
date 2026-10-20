import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from '../service/export.service';
import { ReporteEmpresaService } from '../service/reporte-empresa.service';
import { GastosVariosService } from '../service/gastos-varios.service';
import { GastosImpuestosService } from '../service/gastos-impuestos.service';
import { GastosGasoilService } from '../service/gastos-gasoil.service';
import { GasoilEstacionarioService } from '../service/gasoil-estacionario.service';
import {
  RelacionReportesService,
  TIPOS_RELACION,
  TipoRelacion,
} from '../service/relacion-reportes.service';
import { EmpresaRepository } from '../repo/empresa.repository';
import { ApiException } from './api-exception';

/** "#8c3b87" -> si, cualquier otra cosa -> color por defecto (evita inyectar CSS). */
const COLOR_SEGURO = /^#[0-9a-fA-F]{6}$/;

function colorDe(color: string | undefined, porDefecto: string): string {
  return color && COLOR_SEGURO.test(color) ? color.toLowerCase() : porDefecto;
}

/** Convierte un nombre en un fragmento seguro para el nombre de archivo. */
function slug(texto: string): string {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'documento';
}

function fechaArchivo(valor: string | undefined, porDefecto: string): string {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : porDefecto;
}

@Controller('api/export')
export class ExportController {
  constructor(
    private readonly servicio: ExportService,
    private readonly reporteServicio: ReporteEmpresaService,
    private readonly empresaRepo: EmpresaRepository,
    private readonly gastosServicio: GastosVariosService,
    private readonly impuestosServicio: GastosImpuestosService,
    private readonly gasoilServicio: GastosGasoilService,
    private readonly estacionarioServicio: GasoilEstacionarioService,
    private readonly relacionServicio: RelacionReportesService,
  ) {}

  /** Nombre base "<prefijo>_<empresa>_<desde>_<hasta>" para adjuntar. */
  private async nombre(empresaId: number | null, prefijo: string, desde?: string, hasta?: string) {
    const empresa = empresaId != null ? await this.empresaRepo.findById(empresaId) : null;
    const empresaSlug = slug(empresa?.nombre ?? 'todas');
    const d = fechaArchivo(desde, 'inicio');
    const h = fechaArchivo(hasta, 'hoy');
    return `${prefijo}_${empresaSlug}_${d}_${h}`;
  }

  @Get('xlsx')
  async xlsx(
    @Res() res: Response,
    @Query('empresaId') empresaId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const idEmpresa = empresaId ? Number(empresaId) : null;
    const buffer = await this.servicio.crearXlsx(idEmpresa, desde, hasta);
    const nombre = await this.nombre(idEmpresa, 'viajes', desde, hasta);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.xlsx"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  @Get('pdf')
  async pdf(
    @Res() res: Response,
    @Query('empresaId') empresaId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('color') color?: string,
  ) {
    const idEmpresa = empresaId ? Number(empresaId) : null;
    const buffer = await this.servicio.crearPdf(idEmpresa, desde, hasta, colorDe(color, '#26324a'));
    const nombre = await this.nombre(idEmpresa, 'viajes', desde, hasta);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  @Get('reporte')
  async reporte(
    @Res() res: Response,
    @Query('empresaId') empresaId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('direccion') direccion?: string,
    @Query('conMonto') conMonto?: string,
    @Query('sinChofer') sinChofer?: string,
    @Query('color') color?: string,
  ) {
    const idEmpresa = empresaId ? Number(empresaId) : 0;
    const buffer = await this.reporteServicio.generarPdf({
      empresaId: idEmpresa,
      desde,
      hasta,
      direccion,
      conMonto: conMonto !== 'false',
      sinChofer: sinChofer === 'true',
      color: colorDe(color, '#8c3b87'),
    });
    const nombre = await this.nombre(idEmpresa > 0 ? idEmpresa : null, 'reporte', desde, hasta);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  /** PDF de gastos varios: un bloque por título con subtotales y total general. */
  @Get('gastos-varios')
  async gastosVarios(
    @Res() res: Response,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('tituloId') tituloId?: string,
  ) {
    const idTitulo = tituloId ? Number(tituloId) : null;
    const buffer = await this.gastosServicio.crearPdf(desde, hasta, idTitulo);
    const d = fechaArchivo(desde, 'inicio');
    const h = fechaArchivo(hasta, 'hoy');
    const nombre = `gastos_varios_${d}_${h}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  /** PDF de gastos de impuestos: un bloque por tipo con subtotales y total general. */
  @Get('gastos-impuestos')
  async gastosImpuestos(
    @Res() res: Response,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('tituloId') tituloId?: string,
  ) {
    const idTitulo = tituloId ? Number(tituloId) : null;
    const buffer = await this.impuestosServicio.crearPdf(desde, hasta, idTitulo);
    const d = fechaArchivo(desde, 'inicio');
    const h = fechaArchivo(hasta, 'hoy');
    const nombre = `gastos_impuestos_${d}_${h}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  /** PDF de gastos de gasoil: un bloque por vehículo con subtotales y total general. */
  @Get('gastos-gasoil')
  async gastosGasoil(
    @Res() res: Response,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('vehiculoId') vehiculoId?: string,
  ) {
    const idVehiculo = vehiculoId ? Number(vehiculoId) : null;
    const buffer = await this.gasoilServicio.crearPdf(desde, hasta, idVehiculo);
    const d = fechaArchivo(desde, 'inicio');
    const h = fechaArchivo(hasta, 'hoy');
    const nombre = `gastos_gasoil_${d}_${h}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  /** PDF de consumos estacionarios: una fila por registro con total de litros. */
  @Get('gasoil-estacionario')
  async gasoilEstacionario(
    @Res() res: Response,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('vehiculoId') vehiculoId?: string,
  ) {
    const idVehiculo = vehiculoId ? Number(vehiculoId) : null;
    const buffer = await this.estacionarioServicio.crearPdf(desde, hasta, idVehiculo);
    const d = fechaArchivo(desde, 'inicio');
    const h = fechaArchivo(hasta, 'hoy');
    const nombre = `gasoil_estacionario_${d}_${h}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  /** PDF de relación: ingresos por empresa, gastos por tipo o relación general. */
  @Get('relacion/:tipo')
  async relacion(
    @Res() res: Response,
    @Param('tipo') tipo: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const valido = TIPOS_RELACION.includes(tipo as TipoRelacion)
      ? (tipo as TipoRelacion)
      : null;
    if (!valido) throw new ApiException(404, `Reporte desconocido: ${tipo}`);
    this.relacionServicio.validarRango(desde, hasta);

    const buffer = await this.relacionServicio.crearPdf(valido, desde!, hasta!);
    const d = fechaArchivo(desde, 'inicio');
    const h = fechaArchivo(hasta, 'hoy');
    const nombre = `relacion_${valido}_${d}_${h}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }
}
