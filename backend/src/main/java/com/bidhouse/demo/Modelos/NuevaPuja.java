package com.bidhouse.demo.Modelos;

import java.math.BigDecimal;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

// Lo que llega en POST /api/subastas/{id}/pujas: solo el monto. El pujador NO
// viene en el cuerpo: sale del token (si viniera aquí, cualquiera podría pujar
// a nombre de otro cambiando un campo del JSON).
public record NuevaPuja(BigDecimal monto) {

    public void validar() {
        // Aquí solo lo que se puede revisar sin mirar la subasta. Si el monto
        // alcanza o no, lo decide pujar() en la BD, que ve la oferta actual.
        if (monto == null || monto.signum() <= 0) error("El monto de la puja debe ser mayor a 0");
        if (monto.stripTrailingZeros().scale() > 2) error("El monto puede tener máximo 2 decimales");
    }

    private static void error(String mensaje) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
    }
}
