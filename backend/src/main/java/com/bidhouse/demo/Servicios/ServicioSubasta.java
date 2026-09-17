package com.bidhouse.demo.Servicios;

import com.bidhouse.demo.Modelos.Subasta;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
public class ServicioSubasta {

    // Metodo que devuelve un objeto de tipo Subasta

    public Subasta obtenerSubastaDePrueba() {
        return new Subasta(
                "Laptop ASUS ROG Strix",
                "Laptop de alto rendimiento, ideal para desarrollo backend y multitarea.",
                new BigDecimal("1500.00"),
                LocalDateTime.now(),
                LocalDateTime.now().plusDays(5)
        );
    }
}