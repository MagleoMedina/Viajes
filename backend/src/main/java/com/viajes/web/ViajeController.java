package com.viajes.web;

import com.viajes.domain.Chofer;
import com.viajes.domain.Empresa;
import com.viajes.domain.Gasto;
import com.viajes.domain.Punto;
import com.viajes.domain.Tasa;
import com.viajes.domain.Viaje;
import com.viajes.repo.ChoferRepository;
import com.viajes.repo.EmpresaRepository;
import com.viajes.repo.PuntoRepository;
import com.viajes.repo.TasaRepository;
import com.viajes.repo.ViajeRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/viajes")
@RequiredArgsConstructor
public class ViajeController {

    private final ViajeRepository repo;
    private final ChoferRepository choferRepo;
    private final EmpresaRepository empresaRepo;
    private final PuntoRepository puntoRepo;
    private final TasaRepository tasaRepo;

    public record GastoRequest(BigDecimal monto, String descripcion) {
    }

    public record ViajeRequest(
            @NotNull(message = "La fecha de inicio es obligatoria") LocalDate fechaInicio,
            @NotNull(message = "La fecha de finalizacion es obligatoria") LocalDate fechaFin,
            @NotNull(message = "El chofer es obligatorio") Long choferId,
            @NotNull(message = "La empresa es obligatoria") Long empresaId,
            @NotNull(message = "La carga es obligatoria") String carga,
            Long puntoSalidaId,
            Long puntoLlegadaId,
            BigDecimal montoViaje,
            BigDecimal combustible,
            BigDecimal viaticos,
            BigDecimal peajes,
            BigDecimal pagoChofer,
            List<GastoRequest> gastos,
            BigDecimal tasa) {
    }

    @GetMapping
    public List<Viaje> listar(
            @RequestParam(required = false) Long empresaId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
        boolean conFechas = desde != null && hasta != null;
        if (empresaId != null && conFechas) {
            return repo.findByEmpresaIdAndFechaInicioBetweenOrderByFechaInicioDesc(empresaId, desde, hasta);
        }
        if (empresaId != null) {
            return repo.findByEmpresaIdOrderByFechaInicioDesc(empresaId);
        }
        if (conFechas) {
            return repo.findByFechaInicioBetweenOrderByFechaInicioDesc(desde, hasta);
        }
        return repo.findAllByOrderByFechaInicioDesc();
    }

    @PostMapping
    public Viaje crear(@Valid @RequestBody ViajeRequest req) {
        Viaje viaje = new Viaje();
        aplicar(viaje, req);
        return repo.save(viaje);
    }

    @PutMapping("/{id}")
    public Viaje actualizar(@PathVariable Long id, @Valid @RequestBody ViajeRequest req) {
        Viaje viaje = repo.findById(id).orElseThrow(() -> new ApiException(404, "Viaje no encontrado"));
        aplicar(viaje, req);
        return repo.save(viaje);
    }

    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable Long id) {
        if (!repo.existsById(id)) {
            throw new ApiException(404, "Viaje no encontrado");
        }
        repo.deleteById(id);
    }

    private void aplicar(Viaje viaje, ViajeRequest req) {
        if (req.fechaFin().isBefore(req.fechaInicio())) {
            throw new ApiException(400, "La fecha de finalizacion no puede ser anterior a la de inicio");
        }
        Chofer chofer = choferRepo.findById(req.choferId())
                .orElseThrow(() -> new ApiException(404, "Chofer no encontrado"));

        viaje.setFechaInicio(req.fechaInicio());
        viaje.setFechaFin(req.fechaFin());
        viaje.setChofer(chofer);
        viaje.setEmpresa(empresa(req.empresaId()));
        viaje.setCarga(req.carga().trim());
        viaje.setPuntoSalida(punto(req.puntoSalidaId()));
        viaje.setPuntoLlegada(punto(req.puntoLlegadaId()));
        viaje.setMontoViaje(cero(req.montoViaje()));
        viaje.setCombustible(cero(req.combustible()));
        viaje.setViaticos(cero(req.viaticos()));
        viaje.setPeajes(cero(req.peajes()));
        viaje.setPagoChofer(cero(req.pagoChofer()));
        viaje.setTasa(cero(req.tasa()));

        // Gastos varios: se reemplaza la lista completa; orphanRemoval borra los quitados.
        viaje.getGastos().clear();
        BigDecimal gastosVarios = BigDecimal.ZERO;
        if (req.gastos() != null) {
            for (GastoRequest g : req.gastos()) {
                if (g == null || g.monto() == null || g.monto().signum() <= 0) {
                    continue;
                }
                if (g.descripcion() == null || g.descripcion().isBlank()) {
                    throw new ApiException(400, "Cada gasto varios necesita una descripcion");
                }
                Gasto gasto = new Gasto();
                gasto.setViaje(viaje);
                gasto.setMonto(g.monto());
                gasto.setDescripcion(g.descripcion().trim());
                viaje.getGastos().add(gasto);
                gastosVarios = gastosVarios.add(gasto.getMonto());
            }
        }

        // El monto del viaje se digita en $: se multiplica por la tasa para pasarlo a Bs.
        BigDecimal montoBs = viaje.getTasa().signum() == 0
                ? BigDecimal.ZERO
                : viaje.getMontoViaje().multiply(viaje.getTasa());
        BigDecimal totalBs = montoBs
                .add(viaje.getCombustible())
                .add(viaje.getViaticos())
                .add(viaje.getPeajes())
                .add(viaje.getPagoChofer())
                .add(gastosVarios);
        viaje.setTotalBs(totalBs);
        viaje.setTotalUsd(dividir(totalBs, viaje.getTasa()));
    }

    private Punto punto(Long id) {
        if (id == null) {
            return null;
        }
        return puntoRepo.findById(id).orElseThrow(() -> new ApiException(404, "Punto no encontrado"));
    }

    private Empresa empresa(Long id) {
        return empresaRepo.findById(id).orElseThrow(() -> new ApiException(404, "Empresa no encontrada"));
    }

    /** Si no hay tasa guardada todavia, se usa la ultima conocida; si no, 1. */
    BigDecimal tasaVigente() {
        return tasaRepo.findTopByOrderByIdDesc().map(Tasa::getValor).orElse(BigDecimal.ONE);
    }

    private static BigDecimal cero(BigDecimal valor) {
        return valor == null ? BigDecimal.ZERO : valor;
    }

    private static BigDecimal dividir(BigDecimal numerador, BigDecimal tasa) {
        if (tasa == null || tasa.signum() == 0) {
            return BigDecimal.ZERO;
        }
        return numerador.divide(tasa, 2, RoundingMode.HALF_UP);
    }
}
