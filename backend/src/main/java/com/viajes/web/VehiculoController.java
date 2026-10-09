package com.viajes.web;

import com.viajes.domain.Vehiculo;
import com.viajes.repo.VehiculoRepository;
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
@RequestMapping("/api/vehiculos")
@RequiredArgsConstructor
public class VehiculoController {

    private final VehiculoRepository repo;

    public record VehiculoRequest(
            @NotBlank(message = "La marca es obligatoria") String marca,
            @NotBlank(message = "El modelo es obligatorio") String modelo,
            @NotBlank(message = "El tipo es obligatorio") String tipo,
            @NotBlank(message = "La placa es obligatoria") String placa) {
    }

    @GetMapping
    public List<Vehiculo> listar() {
        return repo.findAll();
    }

    @PostMapping
    public Vehiculo crear(@Valid @RequestBody VehiculoRequest req) {
        String placa = req.placa().trim().toUpperCase();
        if (repo.existsByPlaca(placa)) {
            throw new ApiException(409, "Ya existe un vehiculo con placa " + placa);
        }
        Vehiculo vehiculo = new Vehiculo();
        aplicar(vehiculo, req, placa);
        return repo.save(vehiculo);
    }

    @PutMapping("/{id}")
    public Vehiculo actualizar(@PathVariable Long id, @Valid @RequestBody VehiculoRequest req) {
        Vehiculo vehiculo = repo.findById(id).orElseThrow(() -> new ApiException(404, "Vehiculo no encontrado"));
        String placa = req.placa().trim().toUpperCase();
        if (repo.existsByPlaca(placa) && !placa.equals(vehiculo.getPlaca())) {
            throw new ApiException(409, "Ya existe un vehiculo con placa " + placa);
        }
        aplicar(vehiculo, req, placa);
        return repo.save(vehiculo);
    }

    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable Long id) {
        if (!repo.existsById(id)) {
            throw new ApiException(404, "Vehiculo no encontrado");
        }
        repo.deleteById(id);
    }

    private void aplicar(Vehiculo vehiculo, VehiculoRequest req, String placa) {
        vehiculo.setMarca(req.marca().trim());
        vehiculo.setModelo(req.modelo().trim());
        vehiculo.setTipo(req.tipo().trim());
        vehiculo.setPlaca(placa);
    }
}
