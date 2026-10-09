package com.viajes.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "viajes")
@Getter
@Setter
@NoArgsConstructor
public class Viaje {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "fecha_inicio", nullable = false)
    private LocalDate fechaInicio;

    @Column(name = "fecha_fin", nullable = false)
    private LocalDate fechaFin;

    // EAGER: Jackson no sabe serializar los proxies Hibernate de ManyToOne.
    @ManyToOne(optional = false)
    @JoinColumn(name = "chofer_id")
    private Chofer chofer;

    /** Empresa cliente a la que se le presta el servicio. */
    @ManyToOne
    @JoinColumn(name = "empresa_id")
    private Empresa empresa;

    /** Tipos de carga separados por coma: "Hortalizas, neveras, Mani". */
    @Column(nullable = false)
    private String carga;

    /** Recorrido realizado; el texto se agrega al catalogo para autocompletar. */
    @Column(length = 150)
    private String recorrido;

    @ManyToOne
    @JoinColumn(name = "punto_salida_id")
    private Punto puntoSalida;

    @ManyToOne
    @JoinColumn(name = "punto_llegada_id")
    private Punto puntoLlegada;

    /** Se digita en $. El total en Bs lo convierte multiplicando por la tasa. */
    @Column(name = "monto_viaje")
    private BigDecimal montoViaje = BigDecimal.ZERO;
    private BigDecimal combustible = BigDecimal.ZERO;

    private BigDecimal viaticos = BigDecimal.ZERO;

    private BigDecimal peajes = BigDecimal.ZERO;

    @Column(name = "pago_chofer")
    private BigDecimal pagoChofer = BigDecimal.ZERO;

    // EAGER: Jackson serializa sin tocar proxies Hibernate lazy.
    @OneToMany(mappedBy = "viaje", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<Gasto> gastos = new ArrayList<>();

    /** combustible + viaticos + peajes + pagoChofer + gastos varios. */
    @Column(name = "total_bs")
    private BigDecimal totalBs = BigDecimal.ZERO;

    private BigDecimal tasa = BigDecimal.ZERO;

    /** totalBs / tasa. */
    @Column(name = "total_usd")
    private BigDecimal totalUsd = BigDecimal.ZERO;
}
