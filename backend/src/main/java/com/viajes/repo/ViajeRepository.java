package com.viajes.repo;

import com.viajes.domain.Viaje;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ViajeRepository extends JpaRepository<Viaje, Long> {

    List<Viaje> findByFechaInicioBetweenOrderByFechaInicioDesc(LocalDate desde, LocalDate hasta);

    List<Viaje> findByEmpresaIdOrderByFechaInicioDesc(Long empresaId);

    List<Viaje> findByEmpresaIdAndFechaInicioBetweenOrderByFechaInicioDesc(
            Long empresaId, LocalDate desde, LocalDate hasta);

    List<Viaje> findAllByOrderByFechaInicioDesc();

    boolean existsByChoferId(Long choferId);

    boolean existsByEmpresaId(Long empresaId);

    boolean existsByPuntoSalidaId(Long puntoId);

    boolean existsByPuntoLlegadaId(Long puntoId);
}
