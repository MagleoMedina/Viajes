package com.viajes.repo;

import com.viajes.domain.Tasa;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TasaRepository extends JpaRepository<Tasa, Long> {

    Optional<Tasa> findTopByOrderByIdDesc();
}
