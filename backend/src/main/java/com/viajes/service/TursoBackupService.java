package com.viajes.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Resguardo diario de la base local SQLite hacia Turso.
 *
 * Turso no permite re-subir un archivo .db a una base ya creada (el endpoint
 * /v1/upload es one-shot), por lo que el respaldo se hace por SQL over HTTP:
 * se vuelca el contenido local y se reemplaza el remoto dentro de una
 * transaccion. Es un espejo del estado actual, no un historico.
 */
@Slf4j
@Service
public class TursoBackupService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${viajes.backup.enabled:false}")
    private boolean enabled;

    @Value("${TURSO_DATABASE_URL:}")
    private String url;

    @Value("${TURSO_AUTH_TOKEN:}")
    private String token;

    public TursoBackupService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Cada 24 horas (3:00 a.m. por defecto). */
    @Scheduled(cron = "${viajes.backup.cron:0 0 3 * * *}")
    public void programada() {
        if (!enabled) {
            return;
        }
        if (url.isBlank() || token.isBlank()) {
            log.warn("Resguardo Turso omitido: falta TURSO_DATABASE_URL o TURSO_AUTH_TOKEN");
            return;
        }
        try {
            int sentencias = empujar();
            log.info("Resguardo a Turso completado: {} sentencias", sentencias);
        } catch (Exception e) {
            log.warn("Resguardo a Turso fallido: {}", e.getMessage());
        }
    }

    /** Reescribe el estado local en Turso. Devuelve cuantas sentencias ejecuto. */
    public int empujar() throws Exception {
        List<String> sentencias = volcado();
        List<Map<String, Object>> peticiones = new ArrayList<>();
        peticiones.add(ejecutar("BEGIN"));
        for (String sentencia : sentencias) {
            peticiones.add(ejecutar(sentencia));
        }
        peticiones.add(ejecutar("COMMIT"));
        peticiones.add(Map.of("type", "close"));

        String cuerpo = json.writeValueAsString(Map.of("requests", peticiones));
        HttpRequest peticion = HttpRequest.newBuilder(URI.create(urlPipeline()))
                .timeout(Duration.ofMinutes(2))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(cuerpo, StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> respuesta = http.send(peticion, HttpResponse.BodyHandlers.ofString());
        if (respuesta.statusCode() != 200) {
            throw new IllegalStateException(
                    "Turso respondio HTTP " + respuesta.statusCode() + ": " + recorte(respuesta.body()));
        }
        verificar(respuesta.body());
        return sentencias.size();
    }

    /**
     * Reconstruye schema + filas como sentencias SQL. Usa quote() de SQLite para
     * preservar el tipo de almacenamiento exacto (fechas como epoch ms, etc.).
     */
    private List<String> volcado() {
        List<String> tablas = jdbc.queryForList(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
                String.class);
        List<String> sentencias = new ArrayList<>();
        for (String tabla : tablas) {
            String ddl = jdbc.queryForObject(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", String.class, tabla);
            if (ddl != null && !ddl.isBlank()) {
                sentencias.add(ddl.replaceFirst("(?i)^\\s*CREATE TABLE", "CREATE TABLE IF NOT EXISTS"));
            }
            sentencias.add("DELETE FROM \"" + tabla + "\"");

            List<String> columnas = jdbc.queryForList(
                    "SELECT name FROM pragma_table_info(?)", String.class, tabla);
            if (columnas.isEmpty()) {
                continue;
            }
            String seleccion = IntStream.range(0, columnas.size())
                    .mapToObj(i -> "quote(\"" + columnas.get(i) + "\") AS c" + i)
                    .collect(Collectors.joining(","));
            List<Map<String, Object>> filas =
                    jdbc.queryForList("SELECT " + seleccion + " FROM \"" + tabla + "\"");
            String listaColumnas = columnas.stream()
                    .map(column -> "\"" + column + "\"")
                    .collect(Collectors.joining(","));
            for (Map<String, Object> fila : filas) {
                StringBuilder valores = new StringBuilder();
                for (int i = 0; i < columnas.size(); i++) {
                    if (i > 0) {
                        valores.append(',');
                    }
                    Object valor = fila.get("c" + i);
                    valores.append(valor == null ? "NULL" : valor.toString());
                }
                sentencias.add("INSERT INTO \"" + tabla + "\" (" + listaColumnas
                        + ") VALUES (" + valores + ")");
            }
        }
        return sentencias;
    }

    private static Map<String, Object> ejecutar(String sql) {
        return Map.of("type", "execute", "stmt", Map.of("sql", sql));
    }

    private void verificar(String cuerpo) throws Exception {
        JsonNode raiz = json.readTree(cuerpo);
        for (JsonNode resultado : raiz.path("results")) {
            if ("error".equals(resultado.path("type").asText())) {
                throw new IllegalStateException(
                        "Turso error: " + resultado.path("error").path("message").asText());
            }
        }
    }

    private String urlPipeline() {
        String base = url.replaceFirst("^libsql://", "https://")
                .replaceFirst("^turso://", "https://");
        if (!base.startsWith("http")) {
            base = "https://" + base;
        }
        base = base.replaceAll("/+$", "");
        return base.endsWith("/v2/pipeline") ? base : base + "/v2/pipeline";
    }

    private static String recorte(String texto) {
        if (texto == null) {
            return "";
        }
        return texto.length() > 300 ? texto.substring(0, 300) : texto;
    }
}
