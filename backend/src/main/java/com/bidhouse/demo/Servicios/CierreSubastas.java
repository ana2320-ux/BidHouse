package com.bidhouse.demo.Servicios;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// Tarea programada: cada minuto le pide a la BD que cierre las subastas
// vencidas. Toda la lógica (ganador, contrato, avisos) vive en la función
// cerrar_subastas_vencidas() de Postgres (backend/sql/fase2_cierre.sql),
// que la hace en una sola transacción y aguanta que varios backends la
// llamen a la vez.
//
// Se puede apagar con bidhouse.cierre-automatico=false (los tests lo hacen
// para no cerrar subastas reales mientras corren).
@Component
@ConditionalOnProperty(name = "bidhouse.cierre-automatico", havingValue = "true", matchIfMissing = true)
public class CierreSubastas {

    private static final Logger log = LoggerFactory.getLogger(CierreSubastas.class);

    private final SupabaseClient db;

    public CierreSubastas(SupabaseClient db) {
        this.db = db;
    }

    // fixedDelay: espera 60 s DESPUÉS de que termina la vuelta anterior (no
    // cada 60 s en punto), así dos vueltas nunca se enciman.
    // initialDelay: deja arrancar la app antes de la primera.
    @Scheduled(initialDelay = 10_000, fixedDelay = 60_000)
    public void cerrarVencidas() {
        try {
            Map<String, Object> resultado = db.llamarFuncion("cerrar_subastas_vencidas", Map.of());
            Object cerradas = resultado.get("cerradas");
            if (cerradas instanceof Number n && n.intValue() > 0) {
                log.info("Subastas cerradas: {} (con ganador: {})", cerradas, resultado.get("con_ganador"));
            }
        } catch (RuntimeException e) {
            // Un fallo (BD caída, falta correr el SQL) no debe tumbar la app:
            // se avisa en el log y se reintenta en la siguiente vuelta.
            log.warn("No se pudieron cerrar las subastas vencidas: {}", e.getMessage());
        }
    }

    // Plazos de los contratos de garantía (backend/sql/fase4b_entrega.sql):
    // sin pagar en 48 h → cancelado; sin enviar en 5 días → reembolso al
    // comprador; sin confirmar en 7 días → se libera el pago al vendedor.
    @Scheduled(initialDelay = 20_000, fixedDelay = 60_000)
    public void procesarVencimientosContratos() {
        try {
            Map<String, Object> r = db.llamarFuncion("procesar_vencimientos_contratos", Map.of());
            if (r.values().stream().anyMatch(v -> v instanceof Number n && n.intValue() > 0)) {
                log.info("Contratos vencidos: {}", r);
            }
        } catch (RuntimeException e) {
            log.warn("No se pudieron procesar los vencimientos de contratos: {}", e.getMessage());
        }
    }
}
