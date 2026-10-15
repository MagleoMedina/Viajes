import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from '../service/export.service';
import { ReporteEmpresaService } from '../service/reporte-empresa.service';
import { EmpresaRepository } from '../repo/empresa.repository';

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
    @Query('color') color?: string,
  ) {
    const idEmpresa = empresaId ? Number(empresaId) : 0;
    const buffer = await this.reporteServicio.generarPdf({
      empresaId: idEmpresa,
      desde,
      hasta,
      direccion,
      conMonto: conMonto !== 'false',
      color: colorDe(color, '#8c3b87'),
    });
    const nombre = await this.nombre(idEmpresa > 0 ? idEmpresa : null, 'reporte', desde, hasta);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }
}
