package com.viajes.web;

import com.viajes.domain.Recorrido;
import com.viajes.repo.RecorridoRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recorridos")
@RequiredArgsConstructor
public class RecorridoController {

    private final RecorridoRepository repo;

    public record RecorridoRequest(@NotBlank(message = "El recorrido es obligatorio") String nombre) {
    }

    @GetMapping
    public List<Recorrido> listar() {
        return repo.findAllByOrderByNombreAsc();
    }

    @PostMapping
    public Recorrido crear(@Valid @RequestBody RecorridoRequest req) {
        String nombre = req.nombre().trim();
        if (repo.existsByNombreIgnoreCase(nombre)) {
            throw new ApiException(409, "Ya existe el recorrido " + nombre);
        }
        Recorrido recorrido = new Recorrido();
        recorrido.setNombre(nombre);
        return repo.save(recorrido);
    }

    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable Long id) {
        if (!repo.existsById(id)) {
            throw new ApiException(404, "Recorrido no encontrado");
        }
        repo.deleteById(id);
    }
}
