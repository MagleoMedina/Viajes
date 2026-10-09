package com.viajes.repo;

import com.viajes.domain.Recorrido;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecorridoRepository extends JpaRepository<Recorrido, Long> {

    boolean existsByNombreIgnoreCase(String nombre);

    List<Recorrido> findAllByOrderByNombreAsc();
}
