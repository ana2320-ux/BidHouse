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
        String imagenUrl,
        String modo,                        // "subasta" | "precio_fijo" | "mixto" (null = "subasta")
        BigDecimal precioCompraInmediata) { // precio fijo, o el "Cómpralo ya" del modo mixto

    // Valores del CHECK activos_condicion_check en Supabase
    private static final Set<String> CONDICIONES = Set.of("nuevo", "como_nuevo", "buen_estado", "aceptable");

    // Los tres modos de publicación (ver "Decisiones de producto" en AGENTS.md).
    // En la BD no hay columna "modo": se guarda como permite_pujas +
    // precio_compra_inmediata (ver los métodos de abajo).
    public static final String SUBASTA = "subasta";
    public static final String PRECIO_FIJO = "precio_fijo";
    public static final String MIXTO = "mixto";
    private static final Set<String> MODOS = Set.of(SUBASTA, PRECIO_FIJO, MIXTO);

    // Un cliente viejo que no manda "modo" publica una subasta, como antes.
    public String modoEfectivo() {
        return modo == null || modo.isBlank() ? SUBASTA : modo;
    }

    public boolean permitePujas() {
        return !PRECIO_FIJO.equals(modoEfectivo());
    }

    // precio_base es obligatorio en la BD. En precio fijo no hay subasta, así
    // que se guarda el mismo precio de venta.
    public BigDecimal precioBaseEfectivo() {
        return PRECIO_FIJO.equals(modoEfectivo()) ? precioCompraInmediata : precioBase;
    }

    // En una subasta pura no hay "Cómpralo ya", aunque llegue un valor.
    public BigDecimal precioCompraInmediataEfectivo() {
        return SUBASTA.equals(modoEfectivo()) ? null : precioCompraInmediata;
    }

    public void validar() {
        if (nombre == null || nombre.isBlank() || nombre.length() > 150) error("El nombre es obligatorio (máx. 150 caracteres)");
        if (categoriaId == null) error("La categoría es obligatoria");
        if (condicion != null && !CONDICIONES.contains(condicion)) error("Condición inválida: " + CONDICIONES);
        if (!MODOS.contains(modoEfectivo())) error("Modo de venta inválido: " + MODOS);

        // Qué precios exige cada modo.
        switch (modoEfectivo()) {
            case PRECIO_FIJO -> {
                if (precioCompraInmediata == null || precioCompraInmediata.signum() <= 0) error("El precio de venta debe ser mayor a 0");
            }
            case MIXTO -> {
                if (precioBase == null || precioBase.signum() <= 0) error("El precio base debe ser mayor a 0");
                if (precioCompraInmediata == null || precioCompraInmediata.compareTo(precioBase) <= 0) {
                    error("El precio de \"Cómpralo ya\" debe ser mayor al precio base");
                }
            }
            default -> {
                if (precioBase == null || precioBase.signum() <= 0) error("El precio base debe ser mayor a 0");
            }
        }
        if (incrementoMinimo != null && incrementoMinimo.signum() < 0) error("El incremento mínimo no puede ser negativo");
        if (duracionDias == null || duracionDias < 1 || duracionDias > 30) error("La duración debe estar entre 1 y 30 días");
        if (imagenUrl != null && !imagenUrl.isBlank() && !imagenUrl.matches("(?i)^https?://\\S+$")) error("La imagen debe ser una URL http(s) válida");
    }

    private static void error(String mensaje) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
    }
}
