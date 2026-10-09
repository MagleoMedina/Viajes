package com.viajes.repo;

import com.viajes.domain.Punto;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PuntoRepository extends JpaRepository<Punto, Long> {

    List<Punto> findAllByOrderByNombreAsc();

    boolean existsByNombreIgnoreCase(String nombre);
}
