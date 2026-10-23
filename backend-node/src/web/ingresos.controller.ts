import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Empresa } from '../domain/empresa.entity';
import { Ingreso } from '../domain/ingreso.entity';
import { EmpresaRepository } from '../repo/empresa.repository';
import { IngresoRepository } from '../repo/ingreso.repository';
import { ingresoJson } from '../common/serialize';
import { dateOnlyToMillis, round2 } from '../common/dates';
import { ApiException, ApiValidationException } from './api-exception';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export class IngresoRequest {
  @IsOptional()
  @IsInt({ message: 'La empresa es obligatoria' })
  empresaId?: number;

  @IsString({ message: 'La fecha es obligatoria' })
  fecha: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Las condiciones de pago admiten hasta 100 caracteres' })
  condicionesPago?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La descripción admite hasta 200 caracteres' })
  descripcion?: string;

  @IsOptional()
  @IsNumber({}, { message: 'La cantidad debe ser numérica' })
  cantidad?: number;

  @IsOptional()
  @IsNumber({}, { message: 'La tasa debe ser numérica' })
  tasa?: number;

  @IsOptional()
  @IsInt({ message: 'La factura debe ser un número entero' })
  facturaNum?: number;

  @IsOptional()
  @IsNumber({}, { message: 'El IVA debe ser numérico' })
  iva?: number;

  @IsOptional()
  @IsNumber({}, { message: 'El monto en divisas debe ser numérico' })
  montoDivisa?: number;

  @IsOptional()
  @IsNumber({}, { message: 'El monto en Bs debe ser numérico' })
  montoBs?: number;
}

@Controller('api/ingresos')
export class IngresoController {
  constructor(
    private readonly repo: IngresoRepository,
    private readonly empresas: EmpresaRepository,
  ) {}

  @Get()
  listar(
    @Query('empresaId') empresaId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const id = empresaId ? Number(empresaId) : null;
    this.validarRango(desde, hasta);
    return this.repo.buscar(id, desde, hasta).then((lista) => lista.map(ingresoJson));
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async crear(@Body() req: IngresoRequest) {
    this.validarFecha(req.fecha);
    const empresa = await this.buscarEmpresa(req.empresaId, true);

    const ingreso = new Ingreso();
    ingreso.empresa = empresa;
    ingreso.fecha = new Date(dateOnlyToMillis(req.fecha));
    ingreso.facturaNum = await this.factura(req.facturaNum);
    this.aplicar(ingreso, req);
    return this.guardar(ingreso);
  }

  @Put(':id')
  async actualizar(@Param('id', ParseIntPipe) id: number, @Body() req: IngresoRequest) {
    const ingreso = await this.repo.findById(id);
    if (!ingreso) throw new ApiException(404, 'Ingreso no encontrado');
    this.validarFecha(req.fecha);

    if (req.empresaId !== undefined) {
      ingreso.empresa = await this.buscarEmpresa(req.empresaId, true);
    }
    ingreso.fecha = new Date(dateOnlyToMillis(req.fecha));
    if (req.facturaNum !== undefined) {
      ingreso.facturaNum = await this.factura(req.facturaNum, id);
    }
    this.aplicar(ingreso, req);
    return this.guardar(ingreso);
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    if (!(await this.repo.findById(id))) {
      throw new ApiException(404, 'Ingreso no encontrado');
    }
    await this.repo.deleteById(id);
  }

  /** Monto en divisas y monto final en Bs son valores independientes. */
  private aplicar(ingreso: Ingreso, req: IngresoRequest) {
    if (req.condicionesPago !== undefined) {
      ingreso.condicionesPago = req.condicionesPago.trim();
    }
    if (req.descripcion !== undefined) ingreso.descripcion = req.descripcion.trim();
    if (req.cantidad !== undefined) ingreso.cantidad = this.numero(req.cantidad, 'cantidad');
    if (req.tasa !== undefined) ingreso.tasa = this.tasa(req.tasa);
    if (req.iva !== undefined) ingreso.iva = this.numero(req.iva, 'iva');
    if (req.montoDivisa !== undefined) {
      ingreso.montoDivisa = this.numero(req.montoDivisa, 'montoDivisa');
    }
    if (req.montoBs !== undefined) ingreso.montoBs = this.numero(req.montoBs, 'montoBs');
  }

  /**
   * Guarda y serializa. El índice único de facturas es la última defensa ante
   * dos altas simultáneas con el mismo número: se responde 400, no 500.
   */
  private async guardar(ingreso: Ingreso): Promise<ReturnType<typeof ingresoJson>> {
    try {
      return ingresoJson(await this.repo.save(ingreso));
    } catch (e) {
      if (/UNIQUE constraint failed: ingresos\.factura_num/i.test((e as Error).message)) {
        throw new ApiValidationException({
          facturaNum: 'Ya existe una factura con ese número',
        });
      }
      throw e;
    }
  }

  /**
   * FACTURA No.: obligatoria, entero positivo y unica en toda la tabla.
   * Al modificar se excluye la propia fila.
   */
  private async factura(valor: number | undefined, excluirId?: number): Promise<number> {
    const n = Number(valor);
    if (valor == null || !Number.isInteger(n) || n <= 0) {
      throw new ApiValidationException({
        facturaNum: 'La factura es obligatoria y debe ser un entero mayor que 0',
      });
    }
    if (await this.repo.findByFacturaNum(n, excluirId)) {
      throw new ApiValidationException({
        facturaNum: 'Ya existe una factura con ese número',
      });
    }
    return n;
  }

  private numero(valor: number, campo: string): number {
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0) {
      throw new ApiValidationException({ [campo]: 'El valor no puede ser negativo' });
    }
    return round2(n);
  }

  /** La tasa admite hasta 6 decimales (no se redondea a 2). */
  private tasa(valor: number): number {
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0) {
      throw new ApiValidationException({ tasa: 'El valor no puede ser negativo' });
    }
    return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
  }

  private validarFecha(fecha: string) {
    if (!fecha || !FECHA_ISO.test(fecha)) {
      throw new ApiValidationException({ fecha: 'Formato de fecha inválido (AAAA-MM-DD)' });
    }
  }

  private validarRango(desde?: string, hasta?: string) {
    if (desde && !FECHA_ISO.test(desde)) {
      throw new ApiValidationException({ desde: 'Formato de fecha inválido (AAAA-MM-DD)' });
    }
    if (hasta && !FECHA_ISO.test(hasta)) {
      throw new ApiValidationException({ hasta: 'Formato de fecha inválido (AAAA-MM-DD)' });
    }
    if (desde && hasta && desde > hasta) {
      throw new ApiValidationException({ desde: 'La fecha "Desde" no puede ser mayor que "Hasta"' });
    }
  }

  private async buscarEmpresa(id: number | undefined, obligatoria: boolean): Promise<Empresa> {
    if (id == null || !Number.isFinite(Number(id)) || Number(id) <= 0) {
      if (obligatoria) {
        throw new ApiValidationException({ empresaId: 'La empresa es obligatoria' });
      }
      return null as unknown as Empresa;
    }
    const empresa = await this.empresas.findById(Number(id));
    if (!empresa) throw new ApiException(404, 'Empresa no encontrada');
    return empresa;
  }
}
