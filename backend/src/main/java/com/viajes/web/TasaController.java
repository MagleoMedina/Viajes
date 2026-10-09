package com.viajes.web;

import com.viajes.domain.Tasa;
import com.viajes.repo.TasaRepository;
import com.viajes.service.TasaService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasa")
@RequiredArgsConstructor
public class TasaController {

    private final TasaRepository repo;
    private final TasaService servicio;

    public record TasaRequest(
            @NotNull(message = "La tasa es obligatoria") @Positive(message = "La tasa debe ser mayor que 0") BigDecimal valor) {
    }

    /** Devuelve la tasa vigente o un cuerpo vacio si nunca se registro una. */
    @GetMapping
    public Map<String, Object> actual() {
        return repo.findTopByOrderByIdDesc()
                .map(t -> {
                    Map<String, Object> cuerpo = new LinkedHashMap<>();
                    cuerpo.put("valor", t.getValor());
                    cuerpo.put("fecha", t.getFecha());
                    cuerpo.put("origen", t.getOrigen());
                    return cuerpo;
                })
                .orElse(Map.of());
    }

    /** Edicion manual del usuario; queda marcada como "Manual". */
    @PutMapping
    public Tasa actualizar(@Valid @RequestBody TasaRequest req) {
        Tasa tasa = new Tasa();
        tasa.setValor(req.valor());
        tasa.setOrigen("Manual");
        return repo.save(tasa);
    }

    /** Refresco a demanda desde GoCambio; el frontend muestra el modal de exito. */
    @PostMapping("/refrescar")
    public Tasa refrescar() {
        return servicio.refrescar();
    }
}
