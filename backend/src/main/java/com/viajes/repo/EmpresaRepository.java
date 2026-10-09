package com.viajes.repo;

import com.viajes.domain.Empresa;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmpresaRepository extends JpaRepository<Empresa, Long> {

    boolean existsByNombreIgnoreCase(String nombre);

    List<Empresa> findAllByOrderByNombreAsc();
}