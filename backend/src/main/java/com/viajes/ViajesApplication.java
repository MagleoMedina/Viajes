package com.viajes;

import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ViajesApplication {

    public static void main(String[] args) throws Exception {
        // SQLite no crea directorios: el archivo data/cabelum.db necesita que exista data/.
        Files.createDirectories(Path.of("data"));
        SpringApplication.run(ViajesApplication.class, args);
    }

}
