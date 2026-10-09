package com.viajes.web;

import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder.FontStyle;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.viajes.domain.Empresa;
import com.viajes.domain.Gasto;
import com.viajes.domain.Punto;
import com.viajes.domain.Viaje;
import com.viajes.repo.EmpresaRepository;
import com.viajes.repo.ViajeRepository;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFClientAnchor;
import org.apache.poi.xssf.usermodel.XSSFDrawing;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class ExportController {

    private static final String[] COLUMNAS = {
        "FECHA INICIO",
        "FECHA FIN",
        "EMPRESA",
        "CHOFER",
        "CARGA",
        "PUNTO SALIDA",
        "PUNTO LLEGADA",
        "MONTO VIAJE $",
        "COMBUSTIBLE",
        "VIATICOS",
        "PEAJES",
        "PAGO CHOFER",
        "GASTOS VARIOS",
        "TOTAL BS",
        "TASA",
        "TOTAL $"
    };

    /** Indices de las columnas en Bs que se muestran tambien convertidas a $. */
    private static final int COL_MONTO = 7;
    private static final int COL_GASTOS = 12;
    private static final int COL_TOTAL_BS = 13;
    private static final int COL_TASA = 14;
    private static final int COL_TOTAL_USD = 15;

    private static final DateTimeFormatter FECHA = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter MARCA = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final Locale NUMEROS = Locale.GERMANY;

    private final ViajeRepository repo;
    private final EmpresaRepository empresas;

    /** Sumatoria vertical: valores en Bs y su equivalente en $ fila a fila. */
    private static final class Sumas {

        BigDecimal monto = BigDecimal.ZERO;
        BigDecimal combustible = BigDecimal.ZERO;
        BigDecimal viaticos = BigDecimal.ZERO;
        BigDecimal peajes = BigDecimal.ZERO;
        BigDecimal pagoChofer = BigDecimal.ZERO;
        BigDecimal gastos = BigDecimal.ZERO;
        BigDecimal totalBs = BigDecimal.ZERO;

        BigDecimal combustibleUsd = BigDecimal.ZERO;
        BigDecimal viaticosUsd = BigDecimal.ZERO;
        BigDecimal peajesUsd = BigDecimal.ZERO;
        BigDecimal pagoChoferUsd = BigDecimal.ZERO;
        BigDecimal gastosUsd = BigDecimal.ZERO;
        BigDecimal totalBsUsd = BigDecimal.ZERO;

        BigDecimal totalUsd = BigDecimal.ZERO;

        void sumar(Viaje v) {
            BigDecimal tasa = v.getTasa();
            BigDecimal gastosVarios = sumaGastos(v);
            monto = monto.add(nulo(v.getMontoViaje()));
            combustible = combustible.add(nulo(v.getCombustible()));
            viaticos = viaticos.add(nulo(v.getViaticos()));
            peajes = peajes.add(nulo(v.getPeajes()));
            pagoChofer = pagoChofer.add(nulo(v.getPagoChofer()));
            gastos = gastos.add(gastosVarios);
            totalBs = totalBs.add(nulo(v.getTotalBs()));

            combustibleUsd = combustibleUsd.add(enUsd(v.getCombustible(), tasa));
            viaticosUsd = viaticosUsd.add(enUsd(v.getViaticos(), tasa));
            peajesUsd = peajesUsd.add(enUsd(v.getPeajes(), tasa));
            pagoChoferUsd = pagoChoferUsd.add(enUsd(v.getPagoChofer(), tasa));
            gastosUsd = gastosUsd.add(enUsd(gastosVarios, tasa));
            totalBsUsd = totalBsUsd.add(enUsd(v.getTotalBs(), tasa));

            totalUsd = totalUsd.add(nulo(v.getTotalUsd()));
        }
    }

    /**
     * Suma de los gastos varios del viaje: es lo unico que viaja al Excel/PDF;
     * las descripciones se muestran solo en pantalla.
     */
    private static BigDecimal sumaGastos(Viaje v) {
        BigDecimal suma = BigDecimal.ZERO;
        if (v.getGastos() == null) {
            return suma;
        }
        for (Gasto g : v.getGastos()) {
            suma = suma.add(nulo(g.getMonto()));
        }
        return suma;
    }

    @GetMapping("/xlsx")
    public ResponseEntity<byte[]> xlsx(
            @RequestParam(required = false) Long empresaId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {

        List<Viaje> viajes = buscar(empresaId, desde, hasta);
        Sumas sumas = new Sumas();
        viajes.forEach(sumas::sumar);

        try (XSSFWorkbook libro = new XSSFWorkbook()) {
            Sheet hoja = libro.createSheet("Viajes");

            CellStyle estiloCabecera = estiloCabecera(libro);
            CellStyle estiloTotales = estiloRelleno(libro, IndexedColors.PALE_BLUE, true);
            CellStyle estiloSuma = estiloRelleno(libro, IndexedColors.ROYAL_BLUE, true);
            CellStyle estiloNumero = estiloNumero(libro);

            // Cabecera con el logo de la compania; la tabla arranca debajo.
            int filaCabecera = 3;
            for (int i = 0; i < filaCabecera; i++) {
                hoja.createRow(i).setHeightInPoints(18);
            }
            XSSFDrawing dibujo = (XSSFDrawing) hoja.createDrawingPatriarch();
            XSSFClientAnchor ancla = new XSSFClientAnchor(0, 0, 0, 0, 0, 0, 2, 2);
            dibujo.createPicture(ancla, libro.addPicture(logo(), Workbook.PICTURE_TYPE_JPEG));

            Row cabecera = hoja.createRow(filaCabecera);
            for (int i = 0; i < COLUMNAS.length; i++) {
                Cell celda = cabecera.createCell(i);
                celda.setCellValue(COLUMNAS[i]);
                celda.setCellStyle(estiloCabecera);
            }

            int numeroFila = filaCabecera + 1;
            for (Viaje v : viajes) {
                Row fila = hoja.createRow(numeroFila++);
                texto(fila, 0, FECHA.format(v.getFechaInicio()));
                texto(fila, 1, FECHA.format(v.getFechaFin()));
                texto(fila, 2, nombreEmpresa(v));
                texto(fila, 3, nombreChofer(v));
                texto(fila, 4, v.getCarga());
                texto(fila, 5, nombrePunto(v.getPuntoSalida()));
                texto(fila, 6, nombrePunto(v.getPuntoLlegada()));
                numerico(fila, COL_MONTO, v.getMontoViaje(), estiloNumero);
                texto(fila, 8, dual(v.getCombustible(), v.getTasa()));
                texto(fila, 9, dual(v.getViaticos(), v.getTasa()));
                texto(fila, 10, dual(v.getPeajes(), v.getTasa()));
                texto(fila, 11, dual(v.getPagoChofer(), v.getTasa()));
                texto(fila, COL_GASTOS, dual(sumaGastos(v), v.getTasa()));
                texto(fila, COL_TOTAL_BS, dual(v.getTotalBs(), v.getTasa()));
                numerico(fila, COL_TASA, v.getTasa(), estiloNumero);
                numerico(fila, COL_TOTAL_USD, v.getTotalUsd(), estiloNumero);
            }

            // Fila de totales: monto de viaje hasta total BS. Tasa y total $ no se suman aqui.
            Row totales = hoja.createRow(numeroFila++);
            for (int i = 0; i < 7; i++) {
                totales.createCell(i).setCellStyle(estiloTotales);
            }
            celdaTexto(totales, COL_MONTO, dolar(sumas.monto), estiloTotales);
            celdaTexto(totales, 8, dualValores(sumas.combustible, sumas.combustibleUsd), estiloTotales);
            celdaTexto(totales, 9, dualValores(sumas.viaticos, sumas.viaticosUsd), estiloTotales);
            celdaTexto(totales, 10, dualValores(sumas.peajes, sumas.peajesUsd), estiloTotales);
            celdaTexto(totales, 11, dualValores(sumas.pagoChofer, sumas.pagoChoferUsd), estiloTotales);
            celdaTexto(totales, COL_GASTOS, dualValores(sumas.gastos, sumas.gastosUsd), estiloTotales);
            celdaTexto(totales, COL_TOTAL_BS, dualValores(sumas.totalBs, sumas.totalBsUsd), estiloTotales);
            totales.createCell(COL_TASA).setCellStyle(estiloTotales);
            totales.createCell(COL_TOTAL_USD).setCellStyle(estiloTotales);

            // La sumatoria del total $ vive en su propia celda, en la fila siguiente.
            Row suma = hoja.createRow(numeroFila);
            for (int i = 0; i < COL_TASA; i++) {
                suma.createCell(i).setCellStyle(estiloSuma);
            }
            celdaTexto(suma, COL_TASA, "SUMA TOTAL $", estiloSuma);
            numerico(suma, COL_TOTAL_USD, sumas.totalUsd, estiloSuma);

            for (int i = 0; i < COLUMNAS.length; i++) {
                hoja.autoSizeColumn(i);
            }

            ByteArrayOutputStream salida = new ByteArrayOutputStream();
            libro.write(salida);
            return descargar(
                    salida.toByteArray(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "viajes.xlsx");
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo generar el XLSX: " + e.getMessage(), e);
        }
    }

    @GetMapping("/pdf")
    public ResponseEntity<byte[]> pdf(
            @RequestParam(required = false) Long empresaId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {

        List<Viaje> viajes = buscar(empresaId, desde, hasta);
        Sumas sumas = new Sumas();
        viajes.forEach(sumas::sumar);

        String empresaBox = empresaId == null
                ? ""
                : "<span class=\"dato\"><span class=\"k\">EMPRESA</span>" + esc(nombreEmpresaId(empresaId)) + "</span>\n                    ";

        StringBuilder cuerpo = new StringBuilder();
        int indice = 0;
        for (Viaje v : viajes) {
            // Zebra escrita a mano: no todos los motores de CSS interpretan :nth-child.
            cuerpo.append(indice++ % 2 == 0 ? "<tr>" : "<tr class=\"par\">")
                    .append(td(FECHA.format(v.getFechaInicio())))
                    .append(td(FECHA.format(v.getFechaFin())))
                    .append(td(nombreEmpresa(v)))
                    .append(td(nombreChofer(v)))
                    .append(td(v.getCarga()))
                    .append(td(nombrePunto(v.getPuntoSalida())))
                    .append(td(nombrePunto(v.getPuntoLlegada())))
                    .append(tdNum(dolar(v.getMontoViaje())))
                    .append(tdNumRaw(dualPdf(v.getCombustible(), v.getTasa())))
                    .append(tdNumRaw(dualPdf(v.getViaticos(), v.getTasa())))
                    .append(tdNumRaw(dualPdf(v.getPeajes(), v.getTasa())))
                    .append(tdNumRaw(dualPdf(v.getPagoChofer(), v.getTasa())))
                    .append(tdNumRaw(dualPdf(sumaGastos(v), v.getTasa())))
                    .append(tdNumRaw(dualPdf(v.getTotalBs(), v.getTasa())))
                    .append(tdNum(money(v.getTasa())))
                    .append(tdNum(dolar(v.getTotalUsd())))
                    .append("</tr>");
        }

        cuerpo.append("<tr class=\"totales\">")
                .append("<td colspan=\"7\"></td>")
                .append(tdNum(dolar(sumas.monto)))
                .append(tdNumRaw(dualValoresPdf(sumas.combustible, sumas.combustibleUsd)))
                .append(tdNumRaw(dualValoresPdf(sumas.viaticos, sumas.viaticosUsd)))
                .append(tdNumRaw(dualValoresPdf(sumas.peajes, sumas.peajesUsd)))
                .append(tdNumRaw(dualValoresPdf(sumas.pagoChofer, sumas.pagoChoferUsd)))
                .append(tdNumRaw(dualValoresPdf(sumas.gastos, sumas.gastosUsd)))
                .append(tdNumRaw(dualValoresPdf(sumas.totalBs, sumas.totalBsUsd)))
                .append(tdNum(""))
                .append(tdNum(""))
                .append("</tr>");

        cuerpo.append("<tr class=\"suma\">")
                .append("<td colspan=\"15\" class=\"etiqueta\">SUMA TOTAL $</td>")
                .append(tdNum(dolar(sumas.totalUsd)))
                .append("</tr>");

        String periodo = periodo(viajes, desde, hasta);
        int cantidad = viajes.size();

        String html = """
                <!DOCTYPE html>
                <html><head><meta charset="utf-8" /><style>
                  @page { size: 297mm 210mm; margin: 8mm; }
                  body { font-family: 'DejaVu Sans', sans-serif; font-size: 7px; color: #1f2937; }
                  .cab { margin-bottom: 6px; }
                  .logo { height: 32px; vertical-align: middle; }
                  .cab-texto { display: inline-block; vertical-align: middle; margin-left: 8px; }
                  h1 { font-size: 15px; margin: 0 0 2px; color: #26324a; }
                  .rango { color: #6b7280; font-size: 8.5px; }
                  .resumen { margin: 0 0 8px; }
                  .dato { display: inline-block; border: 1px solid #2f6fed; background: #eef3fb;
                          color: #26324a; font-size: 9px; font-weight: bold; padding: 3px 8px; margin-right: 6px; }
                  .dato .k { color: #2f6fed; font-size: 7.5px; margin-right: 5px; }
                  table { width: 100%%; border-collapse: collapse; }
                  th, td { border: 1px solid #c9d2e0; padding: 2px 3px; }
                  th { background: #26324a; color: #ffffff; font-size: 6.2px; text-align: left; }
                  thead { display: table-header-group; }
                  tbody tr { page-break-inside: avoid; }
                  td { font-size: 7px; }
                  td.num { text-align: right; white-space: nowrap; }
                  tbody tr.par td { background: #f4f6fa; }
                  tr.totales td { background: #dde6f5; font-weight: bold; border-top: 2px solid #26324a; }
                  tr.suma td { background: #2f6fed; color: #ffffff; font-weight: bold; }
                  tr.suma td.etiqueta { text-align: right; white-space: nowrap; }
                  .pie { margin-top: 8px; color: #6b7280; font-size: 7.5px; }
                </style></head>
                <body>
                  <div class="cab">
                    <img class="logo" src="%s" alt="Cabelum" />
                    <div class="cab-texto">
                      <h1>Viajes Cabelum</h1>
                      <div class="rango">Histórico de viajes</div>
                    </div>
                  </div>
                  <div class="resumen">
                    <span class="dato"><span class="k">PERIODO</span>%s</span>
                    <span class="dato"><span class="k">VIAJES</span>%d</span>
                    %s
                  </div>
                  <table>
                    <thead><tr>%s</tr></thead>
                    <tbody>%s</tbody>
                  </table>
                  <div class="pie">%s</div>
                </body></html>
                """
                .formatted(logoDataUri(), periodo, cantidad, empresaBox, ths(), cuerpo, pie(cantidad));

        try {
            ByteArrayOutputStream salida = new ByteArrayOutputStream();
            PdfRendererBuilder builder =
                    new com.openhtmltopdf.pdfboxout.PdfRendererBuilder();
            registrarFuentes(builder);
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(salida);
            builder.run();
            return descargar(salida.toByteArray(), MediaType.APPLICATION_PDF_VALUE, "viajes.pdf");
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo generar el PDF: " + e.getMessage(), e);
        }
    }

    /**
     * La fuente por defecto del renderizador no cubre acentos (ñ, ó), lo que
     * hace que se pierdan celdas con nombres como "Muñoz". Se registra DejaVu
     * Sans (licencia libre) para el texto normal y para las negritas.
     */
    private static void registrarFuentes(PdfRendererBuilder builder) {
        builder.useFont(() -> recurso("/fonts/DejaVuSans.ttf"), "DejaVu Sans", 400, FontStyle.NORMAL, true);
        builder.useFont(() -> recurso("/fonts/DejaVuSans-Bold.ttf"), "DejaVu Sans", 700, FontStyle.NORMAL, true);
    }

    private static InputStream recurso(String ruta) {
        InputStream flujo = ExportController.class.getResourceAsStream(ruta);
        if (flujo == null) {
            throw new IllegalStateException("No se encontro el recurso " + ruta);
        }
        return flujo;
    }

    /** Logo de la compania: se lee una sola vez y se reutiliza. */
    private static volatile byte[] logoBytes;
    private static volatile String logoUri;

    private static byte[] logo() {
        if (logoBytes == null) {
            synchronized (ExportController.class) {
                if (logoBytes == null) {
                    try (InputStream flujo = recurso("/logo.jpg")) {
                        logoBytes = flujo.readAllBytes();
                    } catch (IOException e) {
                        throw new IllegalStateException("No se pudo leer el logo", e);
                    }
                }
            }
        }
        return logoBytes;
    }

    /** El mismo logo como data URI, para incrustarlo en el HTML del PDF. */
    private static String logoDataUri() {
        if (logoUri == null) {
            synchronized (ExportController.class) {
                if (logoUri == null) {
                    logoUri = "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(logo());
                }
            }
        }
        return logoUri;
    }

    /**
     * Intervalo real en que se hicieron los viajes exportados: primera fecha de
     * inicio y ultima fecha de fin de la lista filtrada.
     */
    private static String periodo(List<Viaje> viajes, LocalDate desde, LocalDate hasta) {
        if (!viajes.isEmpty()) {
            LocalDate min = viajes.stream().map(Viaje::getFechaInicio).min(LocalDate::compareTo).orElseThrow();
            LocalDate max = viajes.stream().map(Viaje::getFechaFin).max(LocalDate::compareTo).orElseThrow();
            return FECHA.format(min) + " al " + FECHA.format(max);
        }
        if (desde != null || hasta != null) {
            return (desde == null ? "inicio" : FECHA.format(desde))
                    + " al "
                    + (hasta == null ? "hoy" : FECHA.format(hasta));
        }
        return "sin viajes";
    }

    private List<Viaje> buscar(Long empresaId, LocalDate desde, LocalDate hasta) {
        boolean conFechas = desde != null && hasta != null;
        if (empresaId != null && conFechas) {
            return repo.findByEmpresaIdAndFechaInicioBetweenOrderByFechaInicioDesc(empresaId, desde, hasta);
        }
        if (empresaId != null) {
            return repo.findByEmpresaIdOrderByFechaInicioDesc(empresaId);
        }
        if (conFechas) {
            return repo.findByFechaInicioBetweenOrderByFechaInicioDesc(desde, hasta);
        }
        return repo.findAllByOrderByFechaInicioDesc();
    }

    /* ---------------- Formato de valores ---------------- */

    /** Monto en $ ya convertido por la tasa del viaje. */
    private static BigDecimal enUsd(BigDecimal valor, BigDecimal tasa) {
        BigDecimal bs = nulo(valor);
        if (tasa == null || tasa.signum() == 0) {
            return BigDecimal.ZERO;
        }
        return bs.divide(tasa, 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal nulo(BigDecimal valor) {
        return valor == null ? BigDecimal.ZERO : valor;
    }

    private static String money(BigDecimal valor) {
        return String.format(NUMEROS, "%,.2f", nulo(valor));
    }

    private static String dolar(BigDecimal valor) {
        return "$ " + money(valor);
    }

    /** Celda en Bs mostrada tambien en $ usando la tasa de la fila. */
    private static String dual(BigDecimal valor, BigDecimal tasa) {
        return dualValores(valor, enUsd(valor, tasa));
    }

    /** Celda en Bs mostrada tambien en $ con un equivalente ya calculado. */
    private static String dualValores(BigDecimal valor, BigDecimal usd) {
        return "Bs " + money(valor) + " / $ " + money(usd);
    }

    /**
     * Variante del PDF en dos lineas ("Bs 40.000,00" sobre "$ 47,06") para que
     * la columna quede angosta y las 15 columnas entren en el ancho de la pagina.
     */
    private static String dualPdf(BigDecimal valor, BigDecimal tasa) {
        return dualValoresPdf(valor, enUsd(valor, tasa));
    }

    private static String dualValoresPdf(BigDecimal valor, BigDecimal usd) {
        return "Bs " + money(valor) + "<br/>$ " + money(usd);
    }

    /* ---------------- HTML ---------------- */

    private static String td(String valor) {
        return "<td>" + esc(valor) + "</td>";
    }

    private static String tdNum(String valor) {
        return "<td class=\"num\">" + esc(valor) + "</td>";
    }

    /** Numerica sin escape: recibe HTML propio (linea doble Bs/$). */
    private static String tdNumRaw(String valor) {
        return "<td class=\"num\">" + valor + "</td>";
    }

    private static String ths() {
        StringBuilder sb = new StringBuilder();
        for (String columna : COLUMNAS) {
            sb.append("<th>").append(columna).append("</th>");
        }
        return sb.toString();
    }

    private static String pie(int total) {
        return "Generado el "
                + MARCA.format(LocalDateTime.now())
                + " - "
                + total
                + (total == 1 ? " viaje" : " viajes");
    }

    private static String esc(String valor) {
        if (valor == null) {
            return "";
        }
        return valor.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    /* ---------------- Excel ---------------- */

    private static void texto(Row fila, int columna, String valor) {
        fila.createCell(columna).setCellValue(valor);
    }

    private static void celdaTexto(Row fila, int columna, String valor, CellStyle estilo) {
        Cell celda = fila.createCell(columna);
        celda.setCellValue(valor);
        celda.setCellStyle(estilo);
    }

    private static void numerico(Row fila, int columna, BigDecimal valor, CellStyle estilo) {
        Cell celda = fila.createCell(columna);
        celda.setCellValue(nulo(valor).doubleValue());
        celda.setCellStyle(estilo);
    }

    private static CellStyle estiloCabecera(XSSFWorkbook libro) {
        Font fuente = libro.createFont();
        fuente.setBold(true);
        fuente.setColor(IndexedColors.WHITE.getIndex());
        CellStyle estilo = libro.createCellStyle();
        estilo.setFont(fuente);
        estilo.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
        estilo.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        estilo.setAlignment(HorizontalAlignment.CENTER);
        borde(estilo);
        return estilo;
    }

    private static CellStyle estiloRelleno(XSSFWorkbook libro, IndexedColors color, boolean negrita) {
        Font fuente = libro.createFont();
        fuente.setBold(negrita);
        CellStyle estilo = libro.createCellStyle();
        estilo.setFont(fuente);
        estilo.setFillForegroundColor(color.getIndex());
        estilo.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        borde(estilo);
        return estilo;
    }

    private static CellStyle estiloNumero(XSSFWorkbook libro) {
        CellStyle estilo = libro.createCellStyle();
        estilo.setAlignment(HorizontalAlignment.RIGHT);
        return estilo;
    }

    private static void borde(CellStyle estilo) {
        estilo.setBorderBottom(BorderStyle.THIN);
        estilo.setBorderTop(BorderStyle.THIN);
        estilo.setBorderLeft(BorderStyle.THIN);
        estilo.setBorderRight(BorderStyle.THIN);
    }

    private static String nombreChofer(Viaje v) {
        return (v.getChofer().getNombre() + " " + v.getChofer().getApellido()).trim();
    }

    private static String nombreEmpresa(Viaje v) {
        return v.getEmpresa() == null ? "Sin empresa" : v.getEmpresa().getNombre();
    }

    private String nombreEmpresaId(Long id) {
        return empresas.findById(id).map(Empresa::getNombre).orElse("¿?");
    }

    private static String nombrePunto(Punto p) {
        return p == null ? "" : p.getNombre();
    }

    private static ResponseEntity<byte[]> descargar(byte[] bytes, String tipo, String nombre) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nombre + "\"")
                .contentType(MediaType.parseMediaType(tipo))
                .contentLength(bytes.length)
                .body(bytes);
    }
}
