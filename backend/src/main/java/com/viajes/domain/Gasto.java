package com.viajes.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Gasto varios de un viaje: monto en Bs con su descripcion. */
@Entity
@Table(name = "gastos")
@Getter
@Setter
@NoArgsConstructor
public class Gasto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Evita el ciclo Viaje -> gastos -> viaje al serializar a JSON.
    @JsonIgnore
    @ManyToOne(optional = false)
    @JoinColumn(name = "viaje_id")
    private Viaje viaje;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal monto = BigDecimal.ZERO;

    /** No se exporta a Excel ni a PDF: solo sirve para el desglose en pantalla. */
    @Column(length = 200)
    private String descripcion;
}
