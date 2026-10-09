package com.viajes.web;

import com.viajes.domain.Tasa;
import com.viajes.repo.TasaRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasa")
@RequiredArgsConstructor
public class TasaController {

    private final TasaRepository repo;

    public record TasaRequest(
            @NotNull(message = "La tasa es obligatoria") @Positive(message = "La tasa debe ser mayor que 0") BigDecimal valor) {
    }

    /** Devuelve la tasa vigente o un cuerpo vacio si nunca se registro una. */
    @GetMapping
    public Map<String, Object> actual() {
        return repo.findTopByOrderByIdDesc()
                .map(t -> Map.<String, Object>of("valor", t.getValor(), "fecha", t.getFecha()))
                .orElse(Map.of());
    }

    /** Registro manual por ahora; despues vendra de una API. */
    @PutMapping
    public Tasa actualizar(@Valid @RequestBody TasaRequest req) {
        Tasa tasa = new Tasa();
        tasa.setValor(req.valor());
        return repo.save(tasa);
    }
}
