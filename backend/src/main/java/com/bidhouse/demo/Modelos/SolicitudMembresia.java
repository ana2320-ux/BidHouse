package com.bidhouse.demo.Modelos;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record SolicitudMembresia(String periodicidad) {

    public String periodicidadNormalizada() {
        String valor = periodicidad == null ? "" : periodicidad.strip().toLowerCase();
        if (!valor.equals("mensual") && !valor.equals("anual")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La periodicidad debe ser mensual o anual.");
        }
        return valor;
    }
}
