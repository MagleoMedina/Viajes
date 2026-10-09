package com.viajes.web;

import com.viajes.domain.Chofer;
import com.viajes.repo.ChoferRepository;
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
@RequestMapping("/api/choferes")
@RequiredArgsConstructor
public class ChoferController {

    private final ChoferRepository repo;
    private final ViajeRepository viajes;

    public record ChoferRequest(
            @NotBlank(message = "El nombre es obligatorio") String nombre,
            @NotBlank(message = "El apellido es obligatorio") String apellido,
            @NotBlank(message = "La cedula es obligatoria") String cedula) {
    }

    @GetMapping
    public List<Chofer> listar() {
        return repo.findAll();
    }

    @PostMapping
    public Chofer crear(@Valid @RequestBody ChoferRequest req) {
        String cedula = req.cedula().trim();
        if (repo.existsByCedula(cedula)) {
            throw new ApiException(409, "Ya existe un chofer con cedula " + cedula);
        }
        Chofer chofer = new Chofer();
        aplicar(chofer, req, cedula);
        return repo.save(chofer);
    }

    @PutMapping("/{id}")
    public Chofer actualizar(@PathVariable Long id, @Valid @RequestBody ChoferRequest req) {
        Chofer chofer = repo.findById(id).orElseThrow(() -> new ApiException(404, "Chofer no encontrado"));
        String cedula = req.cedula().trim();
        if (repo.existsByCedula(cedula) && !cedula.equals(chofer.getCedula())) {
            throw new ApiException(409, "Ya existe un chofer con cedula " + cedula);
        }
        aplicar(chofer, req, cedula);
        return repo.save(chofer);
    }

    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable Long id) {
        if (!repo.existsById(id)) {
            throw new ApiException(404, "Chofer no encontrado");
        }
        if (viajes.existsByChoferId(id)) {
            throw new ApiException(409, "No se puede eliminar: el chofer tiene viajes registrados");
        }
        repo.deleteById(id);
    }

    private void aplicar(Chofer chofer, ChoferRequest req, String cedula) {
        chofer.setNombre(req.nombre().trim());
        chofer.setApellido(req.apellido().trim());
        chofer.setCedula(cedula);
    }
}
