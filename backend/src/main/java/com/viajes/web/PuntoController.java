package com.viajes.web;

import com.viajes.domain.Punto;
import com.viajes.repo.PuntoRepository;
import com.viajes.repo.ViajeRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/puntos")
@RequiredArgsConstructor
public class PuntoController {

    private final PuntoRepository repo;
    private final ViajeRepository viajes;

    public record PuntoRequest(@NotBlank(message = "El nombre del punto es obligatorio") String nombre) {
    }

    @GetMapping
    public List<Punto> listar() {
        return repo.findAllByOrderByNombreAsc();
    }

    @PostMapping
    public Punto crear(@Valid @RequestBody PuntoRequest req) {
        String nombre = req.nombre().trim();
        if (repo.existsByNombreIgnoreCase(nombre)) {
            throw new ApiException(409, "Ya existe el punto " + nombre);
        }
        Punto punto = new Punto();
        punto.setNombre(nombre);
        return repo.save(punto);
    }

    @PutMapping("/{id}")
    public Punto actualizar(@PathVariable Long id, @Valid @RequestBody PuntoRequest req) {
        Punto punto = repo.findById(id).orElseThrow(() -> new ApiException(404, "Punto no encontrado"));
        String nombre = req.nombre().trim();
        if (repo.existsByNombreIgnoreCase(nombre) && !nombre.equalsIgnoreCase(punto.getNombre())) {
            throw new ApiException(409, "Ya existe el punto " + nombre);
        }
        punto.setNombre(nombre);
        return repo.save(punto);
    }

    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable Long id) {
        if (!repo.existsById(id)) {
            throw new ApiException(404, "Punto no encontrado");
        }
        if (viajes.existsByPuntoSalidaId(id) || viajes.existsByPuntoLlegadaId(id)) {
            throw new ApiException(409, "No se puede eliminar: el punto se usa en viajes registrados");
        }
        repo.deleteById(id);
    }
}
