package com.bidhouse.demo.Modelos;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record NuevaSubasta(
        String nombre,
        UUID categoriaId,
        String descripcion,
        String condicion,
        BigDecimal precioBase,
        BigDecimal incrementoMinimo,
        Integer duracionDias,
        String imagenUrl) {

    // Valores del CHECK activos_condicion_check en Supabase
    private static final Set<String> CONDICIONES = Set.of("nuevo", "como_nuevo", "buen_estado", "aceptable");

    public void validar() {
        if (nombre == null || nombre.isBlank() || nombre.length() > 150) error("El nombre es obligatorio (máx. 150 caracteres)");
        if (categoriaId == null) error("La categoría es obligatoria");
        if (condicion != null && !CONDICIONES.contains(condicion)) error("Condición inválida: " + CONDICIONES);
        if (precioBase == null || precioBase.signum() <= 0) error("El precio base debe ser mayor a 0");
        if (incrementoMinimo != null && incrementoMinimo.signum() < 0) error("El incremento mínimo no puede ser negativo");
        if (duracionDias == null || duracionDias < 1 || duracionDias > 30) error("La duración debe estar entre 1 y 30 días");
        if (imagenUrl != null && !imagenUrl.isBlank() && !imagenUrl.matches("(?i)^https?://\\S+$")) error("La imagen debe ser una URL http(s) válida");
    }

    private static void error(String mensaje) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
    }
}
