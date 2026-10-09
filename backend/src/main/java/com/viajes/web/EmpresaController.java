package com.viajes.web;

import com.viajes.domain.Empresa;
import com.viajes.repo.EmpresaRepository;
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
@RequestMapping("/api/empresas")
@RequiredArgsConstructor
public class EmpresaController {

    private final EmpresaRepository repo;
    private final ViajeRepository viajes;

    public record EmpresaRequest(@NotBlank(message = "El nombre es obligatorio") String nombre) {
    }

    @GetMapping
    public List<Empresa> listar() {
        return repo.findAllByOrderByNombreAsc();
    }

    @PostMapping
    public Empresa crear(@Valid @RequestBody EmpresaRequest req) {
        String nombre = req.nombre().trim();
        if (repo.existsByNombreIgnoreCase(nombre)) {
            throw new ApiException(409, "Ya existe la empresa " + nombre);
        }
        Empresa empresa = new Empresa();
        empresa.setNombre(nombre);
        return repo.save(empresa);
    }

    @PutMapping("/{id}")
    public Empresa actualizar(@PathVariable Long id, @Valid @RequestBody EmpresaRequest req) {
        Empresa empresa = repo.findById(id).orElseThrow(() -> new ApiException(404, "Empresa no encontrada"));
        String nombre = req.nombre().trim();
        if (repo.existsByNombreIgnoreCase(nombre) && !nombre.equalsIgnoreCase(empresa.getNombre())) {
            throw new ApiException(409, "Ya existe la empresa " + nombre);
        }
        empresa.setNombre(nombre);
        return repo.save(empresa);
    }

    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable Long id) {
        if (!repo.existsById(id)) {
            throw new ApiException(404, "Empresa no encontrada");
        }
        if (viajes.existsByEmpresaId(id)) {
            throw new ApiException(409, "No se puede eliminar: la empresa se usa en viajes registrados");
        }
        repo.deleteById(id);
    }
}