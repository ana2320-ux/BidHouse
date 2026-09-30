package com.bidhouse.demo.Servicios;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// Lleva los hitos de cada contrato de garantía a la blockchain.
//
// ¿Por qué una tarea aparte y no en el momento de pagar/enviar/confirmar?
//  - Cada transacción tarda ~12 s en entrar a un bloque: el usuario no espera.
//  - Algunos cambios los hace la BD sola (vencimientos, liberación a los 7
//    días) y Java no se entera en el momento.
//  - Si la red falla, se reintenta en la siguiente vuelta.
// Cada minuto compara lo que dice la BD con los hitos ya registrados
// (tabla hitos_blockchain) y manda los que faltan, en orden.
//
// Solo debe tenerlo activo UN backend (el que tenga BLOCKCHAIN_PRIVATE_KEY):
// dos backends firmando con la misma billetera chocarían.
@Component
@ConditionalOnProperty(name = "bidhouse.cierre-automatico", havingValue = "true", matchIfMissing = true)
public class SincronizadorBlockchain {

    private static final Logger log = LoggerFactory.getLogger(SincronizadorBlockchain.class);
    private static final int MAX_POR_VUELTA = 6; // ~12 s cada una: la vuelta no pasa de ~1-2 min

    private final SupabaseClient db;
    private final RegistroBlockchain cadena;

    public SincronizadorBlockchain(SupabaseClient db, RegistroBlockchain cadena) {
        this.db = db;
        this.cadena = cadena;
    }

    @Scheduled(initialDelay = 30_000, fixedDelay = 60_000)
    public void sincronizar() {
        if (!cadena.activo()) return;

        List<Map<String, Object>> contratos;
        try {
            // Solo los que llegaron a pagarse: antes del pago no hay nada que registrar.
            contratos = db.consultar("/transacciones?pagado_en=not.is.null"
                    + "&select=id,subasta_id,estado,monto,pagado_en,fecha_limite_envio,enviado_en,"
                    + "fecha_limite_confirmacion,liberado_en,hitos_blockchain(hito)&order=pagado_en");
        } catch (RuntimeException e) {
            log.warn("Blockchain: no se pudieron leer los contratos: {}", e.getMessage());
            return;
        }

        int enviados = 0;
        for (Map<String, Object> t : contratos) {
            for (String hito : pendientes(t)) {
                if (enviados >= MAX_POR_VUELTA) return;
                try {
                    String txHash = registrar(t, hito);
                    Map<String, Object> fila = new HashMap<>();
                    fila.put("transaccion_id", t.get("id"));
                    fila.put("hito", hito);
                    fila.put("tx_hash", txHash);
                    db.insertar("hitos_blockchain", fila);
                    enviados++;
                    log.info("Blockchain: hito '{}' del contrato {} → {}", hito, t.get("id"), txHash);
                } catch (RuntimeException e) {
                    // El siguiente hito depende de este: se sigue con otro contrato
                    // y se reintenta en la próxima vuelta (ej. liberar antes de que
                    // venza el plazo en la cadena).
                    log.warn("Blockchain: hito '{}' del contrato {} falló: {}", hito, t.get("id"), e.getMessage());
                    break;
                }
            }
        }
    }

    // Qué hitos le faltan en la cadena a este contrato, en el orden en que
    // deben ir (el contrato de Solidity los exige en ese orden).
    static List<String> pendientes(Map<String, Object> t) {
        Set<String> hechos = new HashSet<>();
        if (t.get("hitos_blockchain") instanceof List<?> lista) {
            for (Object h : lista) {
                if (h instanceof Map<?, ?> m) hechos.add(String.valueOf(m.get("hito")));
            }
        }
        List<String> plan = new ArrayList<>();
        plan.add("pago");
        if (t.get("enviado_en") != null) plan.add("envio");
        switch (String.valueOf(t.get("estado"))) {
            case "completada" -> plan.add("liberacion");
            case "cancelada" -> plan.add("cancelacion");
            case "en_disputa" -> plan.add("disputa");
            default -> { }
        }
        plan.removeIf(hechos::contains);
        return plan;
    }

    private String registrar(Map<String, Object> t, String hito) {
        String id = String.valueOf(t.get("id"));
        return switch (hito) {
            case "pago" -> {
                // La cadena no maneja decimales: el monto va en centavos.
                BigInteger centavos = new BigDecimal(String.valueOf(t.get("monto"))).movePointRight(2).toBigInteger();
                long limiteEnvio = t.get("fecha_limite_envio") == null ? 0
                        : OffsetDateTime.parse(String.valueOf(t.get("fecha_limite_envio"))).toEpochSecond();
                byte[] huella = RegistroBlockchain.huella(id, String.valueOf(t.get("subasta_id")), centavos,
                        String.valueOf(t.get("pagado_en")));
                yield cadena.registrarPago(id, huella, centavos, limiteEnvio);
            }
            case "envio" -> cadena.registrarEnvio(id);
            // Si se liberó antes de vencer el plazo, fue porque el comprador confirmó.
            case "liberacion" -> cadena.liberar(id, confirmoElComprador(t));
            case "cancelacion" -> cadena.cancelar(id);
            case "disputa" -> cadena.abrirDisputa(id);
            default -> throw new IllegalArgumentException("Hito desconocido: " + hito);
        };
    }

    static boolean confirmoElComprador(Map<String, Object> t) {
        Object limite = t.get("fecha_limite_confirmacion");
        Object liberado = t.get("liberado_en");
        if (limite == null || liberado == null) return true; // confirmó sin que se marcara el envío
        return OffsetDateTime.parse(String.valueOf(liberado)).isBefore(OffsetDateTime.parse(String.valueOf(limite)));
    }
}
