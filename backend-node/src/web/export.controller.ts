import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from '../service/export.service';
import { ReporteEmpresaService } from '../service/reporte-empresa.service';

/** "#8c3b87" -> si, cualquier otra cosa -> color por defecto (evita inyectar CSS). */
const COLOR_SEGURO = /^#[0-9a-fA-F]{6}$/;

function colorDe(color: string | undefined, porDefecto: string): string {
  return color && COLOR_SEGURO.test(color) ? color.toLowerCase() : porDefecto;
}

@Controller('api/export')
export class ExportController {
  constructor(
    private readonly servicio: ExportService,
    private readonly reporteServicio: ReporteEmpresaService,
  ) {}

  @Get('xlsx')
  xlsx(
    @Res() res: Response,
    @Query('empresaId') empresaId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.servicio.crearXlsx(empresaId ? Number(empresaId) : null, desde, hasta).then(
      (buffer) => {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="viajes.xlsx"');
        res.setHeader('Content-Length', String(buffer.length));
        res.end(buffer);
      },
    );
  }

  @Get('pdf')
  pdf(
    @Res() res: Response,
    @Query('empresaId') empresaId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('color') color?: string,
  ) {
    return this.servicio
      .crearPdf(empresaId ? Number(empresaId) : null, desde, hasta, colorDe(color, '#26324a'))
      .then((buffer) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="viajes.pdf"');
        res.setHeader('Content-Length', String(buffer.length));
        res.end(buffer);
      });
  }

  @Get('reporte')
  reporte(
    @Res() res: Response,
    @Query('empresaId') empresaId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('direccion') direccion?: string,
    @Query('conMonto') conMonto?: string,
    @Query('color') color?: string,
  ) {
    return this.reporteServicio
      .generarPdf({
        empresaId: empresaId ? Number(empresaId) : 0,
        desde,
        hasta,
        direccion,
        conMonto: conMonto !== 'false',
        color: colorDe(color, '#8c3b87'),
      })
      .then((buffer) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="reporte.pdf"');
        res.setHeader('Content-Length', String(buffer.length));
        res.end(buffer);
      });
  }
}
