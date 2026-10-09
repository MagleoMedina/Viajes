package com.viajes.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.viajes.domain.Tasa;
import com.viajes.repo.TasaRepository;
import com.viajes.web.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Tasa automatica desde GoCambio (https://api.gocambio.app): se refresca a las
 * 9:05 y a las 13:05 de cada dia y al arrancar la aplicacion. El usuario puede
 * sobreescribirla a mano desde el modulo de Tasa.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TasaService {

    private static final String PRECIOS =
            "https://api.gocambio.app/api/v1/prices?date=%s&bases=all";
    private static final DateTimeFormatter UTC =
            DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss'Z'", Locale.ROOT);

    private final TasaRepository repo;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    /** Actualiza desde la API. Lanza 502 si GoCambio no responde o no trae USD/VES. */
    public Tasa refrescar() {
        BigDecimal precio = consultarApi();
        Tasa tasa = new Tasa();
        tasa.setValor(precio);
        tasa.setFecha(LocalDateTime.now());
        tasa.setOrigen("GoCambio (BCV)");
        return repo.save(tasa);
    }

    /** 9:05 a.m. y 1:05 p.m. hora de Caracas, todos los dias. */
    @Scheduled(cron = "0 5 9,13 * * *", zone = "America/Caracas")
    public void programada() {
        try {
            Tasa tasa = refrescar();
            log.info("Tasa automatica actualizada: {}", tasa.getValor());
        } catch (Exception e) {
            log.warn("No se pudo actualizar la tasa programada: {}", e.getMessage());
        }
    }

    /** Al arrancar queda cargada aunque nadie abra el modulo. */
    @EventListener(ApplicationReadyEvent.class)
    public void alArrancar() {
        try {
            Tasa tasa = refrescar();
            log.info("Tasa inicial desde GoCambio: {}", tasa.getValor());
        } catch (Exception e) {
            log.warn("No se pudo obtener la tasa al arrancar: {}", e.getMessage());
        }
    }

    private BigDecimal consultarApi() {
        // date=ahora en UTC; GoCambio responde el ultimo precio conocido.
        LocalDateTime ahoraUtc = LocalDateTime.ofInstant(Instant.now(), ZoneOffset.UTC);
        String fecha = URLEncoder.encode(UTC.format(ahoraUtc), StandardCharsets.UTF_8);
        HttpRequest peticion = HttpRequest.newBuilder(URI.create(PRECIOS.formatted(fecha)))
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build();
        try {
            HttpResponse<String> respuesta = http.send(peticion, HttpResponse.BodyHandlers.ofString());
            if (respuesta.statusCode() != 200) {
                throw new ApiException(502, "GoCambio respondio HTTP " + respuesta.statusCode());
            }
            return extraerUsdVes(respuesta.body());
        } catch (ApiException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ApiException(502, "Consulta a GoCambio interrumpida");
        } catch (Exception e) {
            throw new ApiException(502, "No se pudo consultar GoCambio: " + e.getMessage());
        }
    }

    /** Precio USD en bolivares (base VES). Se redondea a 2 decimales: el input admite 0.01. */
    private BigDecimal extraerUsdVes(String cuerpo) throws Exception {
        JsonNode datos = json.readTree(cuerpo).path("data");
        if (!datos.isArray()) {
            throw new ApiException(502, "Respuesta inesperada de GoCambio");
        }
        for (JsonNode fila : datos) {
            if ("USD".equals(fila.path("code").asText())
                    && "VES".equals(fila.path("base").asText())) {
                BigDecimal precio = new BigDecimal(fila.path("price").asText());
                if (precio.signum() <= 0) {
                    break;
                }
                return precio.setScale(2, RoundingMode.HALF_UP);
            }
        }
        throw new ApiException(502, "GoCambio no devolvio precio USD/VES");
    }
}
