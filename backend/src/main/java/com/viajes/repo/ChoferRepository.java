package com.viajes.repo;

import com.viajes.domain.Chofer;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChoferRepository extends JpaRepository<Chofer, Long> {

    boolean existsByCedula(String cedula);

    Optional<Chofer> findByCedula(String cedula);
}
